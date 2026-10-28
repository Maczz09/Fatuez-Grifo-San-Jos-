# B2B09: recurso SMTP preparado del host Mailer

Implementación concreta e independiente del guard QA. No habilita SMTP externo ni entrega al cliente. No modifica MailerSourceArtifacts, main, runtime-files, runtime-config, Prisma ni los módulos legacy. El único bridge existente ampliado es src/b2b/phase8-admin.ts, para asociar opcionalmente el binding real al handle.

## Contrato de composición

Exportaciones desde `services/mailer-worker/src/b2b/host-smtp.ts`:

```ts
loadMailerSmtpOwnerMount(root: string): MailerSmtpOwnerMount;
createMailerSmtpOwnerResource({
  pool,                      // EmailDeliveryPgPool compartido, creado por el parent
  key,                       // Buffer binario de 32 bytes desde el secreto montado
  keyVersion,                // entero 1..10000
  approvedHosts,             // 1..16 hostnames exactos y canónicos, sin duplicados
  database: { name: 'factuez_mailer_beta', user },
  billingHttp,               // instancia B2bPrivateHttp con cliente mTLS explícito
}): MailerSmtpOwnerResource;
```

El resultado implementa `createOwner(capabilities: Phase8AdminCapabilities): SmtpConfigurationService`, `checkStorage(): Promise<void>` y `close(): Promise<void>`.

```ts
const smtpMount = loadMailerSmtpOwnerMount(root);
let smtpOwner: MailerSmtpOwnerResource;
try {
  smtpOwner = createMailerSmtpOwnerResource({
    pool, key: smtpMount.key, keyVersion: smtpMount.keyVersion,
    approvedHosts: smtpMount.approvedHosts,
    database: { name: config.database.name, user: config.database.user },
    billingHttp,
  });
} finally {
  smtpMount.close(); // borra la copia temporal; el recurso conserva su propia copia
}
```

El parent configura primero el pool mediante las opciones PostgreSQL explícitas existentes, CA verificada, `rejectUnauthorized: true`, TLS >=1.2, límites de conexión/consulta y search_path fijo. La fábrica es inerte: no conecta PG, lee archivos, hace RPC ni crea transporte. `close()` nunca llama `pool.end()`; el parent conserva la propiedad del pool y de `billingHttp`.

## Montaje fijo

`loadMailerSmtpOwnerMount(root)` usa B2bRuntimeFiles y lee solamente `smtp-host.json` y `smtp-key.bin`. Sin descubrimiento, .env ni rutas alternativas. JSON exacto:

```json
{
  "schemaVersion": "factuez.b2b.mailer-smtp-host.v1",
  "environment": "BETA",
  "profile": "PREPARED_ONLY",
  "keyFile": "smtp-key.bin",
  "keyVersion": 1,
  "approvedHosts": ["smtp.example.com"]
}
```

El dominio anterior es ficticio. El archivo de clave contiene exactamente 32 bytes binarios; no admite una cadena hexadecimal/base64 ni APP_MASTER_KEY. B2bRuntimeFiles comprueba raíz absoluta, archivos ordinarios, enlaces, tamaño y permisos restrictivos donde la plataforma lo permite. El resultado mantiene la clave en un campo `#`, no expone bytes en JSON/inspect y dispone de getters `key`, `keyVersion`, `approvedHosts` y `close()`. El parent debe cerrar el mount incluso si falla la composición. No se entrega ningún secreto real ni ejemplo de clave reutilizable.

## Contrato obligatorio de capacidad y fuente emisora

La fábrica recibe la misma instancia real de Phase8AdminCapabilities que usa B2bPhase8SmtpAdmin. El servicio llama al mismo método propietario `caps.resolve(handle, {action, companyId, environment:'BETA', payload})` del contrato legacy. No acepta Bearer/string, objetos forjados, otra acción, otro payload ni otro companyId.

El resolver interno optativo añade esta proyección:

```ts
interface MailerSmtpOwnerContext extends Phase8AdminOwnerContext {
  currentIssuerB2bOwnerBinding: B2bBinding;
}
```

Ese campo se obtiene exclusivamente de la operación actual que custodia la capacidad, después de revalidarla, y debe incluir el binding completo issuerId/issuerRuc/environment/branchId/pointId/seriesId/documentType. No puede venir de JSON público, una configuración del host, un catálogo local o IDs inventados. La fábrica comprueba la igualdad de issuerId/companyId, RUC y BETA y llama además `HttpB2bOwnerBinding.revalidate(binding)`, por `/internal/b2b/validate-bindings` sobre B2bPrivateHttp mTLS. Billing sigue siendo dueño del catálogo y de la jerarquía activa; Mailer no lee su base de datos.

Integración implementada en host-smtp.context.ts y B2bPhase8SmtpAdmin: createOwner(caps) registra un wrapper optativo por instancia real de Phase8AdminCapabilities. Después de Phase8AdminOperation.open, el bridge usa un opener que llama caps.open con esa misma operación y asocia su op.input.binding al handle en un WeakMap privado. El wrapper exige esa asociación, llama al método original caps.resolve (sin cambiar su implementación), revalida que siga vigente y devuelve el binding asociado. No se espera ni se parchea ningún campo en el resolver compartido. Al salir, el bridge elimina asociación y capacidad en finally. Sin registro del recurso, el opener/revoker conserva exactamente el flujo legacy. Un handle abierto directamente fuera de este opener falla cerrado en el recurso BETA. Las pruebas positivas usan ahora Phase8AdminCapabilities y Phase8AdminOperation reales, sin subclase ni ampliación de fixture.

Cada save revalida antes de preparar, después del bloqueo CAS, antes del commit y tras él. El bridge hace su comprobación final y revoca el handle en finally. Las comprobaciones posteriores al commit no son rollback distribuido: una revocación tardía puede ocultar una escritura confirmada. El caller debe reconciliar la revisión vigente después de una respuesta ambigua.

## Persistencia y preparación

Tablas exclusivas `public.B2bHostSmtpPreparedSchema`, `public.B2bHostSmtpConfiguration` y `public.B2bHostSmtpConfigurationAudit`. No se reutilizan ni renombran las tablas CorporateSmtpConfiguration QA. No se modifica el guard de factuez_mailer_qa.

`checkStorage()` ejecuta sólo SELECT: base y rol exactos, conexión PG cifrada TLS 1.2/1.3 mediante pg_stat_ssl, marcador de versión, columnas y tres triggers habilitados. No hace DDL, DML, BEGIN, RPC, lectura de credenciales SMTP ni prueba de red SMTP. Las comprobaciones acreditan los objetos esperados; no son una auditoría de privilegios o de la definición completa de cada función instalada.

Guardado: transacción con timeout, bloqueo advisory por RUC y lectura FOR UPDATE; CAS por revisión y companyId también en el UPSERT; configuración cifrada y auditoría se confirman juntas. La auditoría contiene emisor, actor, revisión, indicador de sustitución de credenciales y fecha, nunca credenciales ni ciphertext. Reutilizar credenciales exige descifrado auténtico de la revisión existente. Una revisión diferente devuelve 409; un fallo de almacenamiento da un error fijo sin texto PG. Rollback fallido descarta la conexión exactamente una vez.

`host-smtp-schema.candidate.sql` es únicamente candidato para revisión. Contiene guard BETA, tablas independientes, CHECKs, auditoría inmutable y constraint trigger diferido que exige auditoría vinculada a emisor/revisión/actor. El trigger de actualización permite el UPSERT; la revisión inicial se comprueba después del INSERT efectivo. No instala ni cambia propietarios/grants de bases existentes. No se ejecutó SQL DDL en esta tarea.

## Custodia y límites

AES-256-GCM, IV aleatorio de 12 bytes, tag de 16 bytes y AAD ligada a namespace B2B preparado, BETA, versión de clave, companyId, RUC y campo. La clave propia se mantiene en `#key`; los otros objetos que la contienen son campos `#`. Se borran buffers temporales de texto plano y la clave propia después de drenar operaciones activas al cerrar. Cierre idempotente, admisión nueva bloqueada, máximo 16 operaciones concurrentes. La copia entregada por el caller es su responsabilidad; el loader facilita borrarla con close(). No se garantiza borrado físico de strings inmutables JavaScript ni copias internas de las bibliotecas criptográficas.

El servicio extiende el tipo nominal SmtpConfigurationService para cumplir runtime.ts; todas sus operaciones están sobreescritas. El constructor base recibe dependencias ausentes que nunca se usan. No se construye el store Prisma ni la bóveda/transporte legacy. Sólo status/save son admitidos; remove/audit/dryRun de la API legacy están bloqueados. status puede devolver settings sin usuario/contraseña a su caller propietario; el bridge Phase8 elimina también settings en su proyección. No se exponen ciphertext ni versiones de clave en esa respuesta.

Política local de configuración: lista explícita de hosts, TLS 465 o STARTTLS 587 estrictos y remitente/credenciales válidos. No existe transporte SMTP activo en este recurso. Todos los resultados conservan EXTERNAL_SMTP_DISABLED y networkAttempted/dnsValidated/smtpAuthenticationVerified/deliveredToClient/readyToSend=false. No hay DNS SMTP, verify, autenticación SMTP, send, SUNAT, DB QA ni envío real.

## Verificación realizada

- Pruebas nuevas: 22 del recurso (capacidad real con binding interno optativo, PG de protocolo en memoria, cliente Billing mTLS real sólo loopback, CAS, rollback, integridad, cierre y proyección) y 22 del montaje fijo.
- Regresión dirigida: tests/smtp-configuration.spec.ts, tests/b2b-phase8-owner-admin.spec.ts, tests/b2b-phase8-admin-http.spec.ts y tests/b2b-mailer-runtime.spec.ts.
- Resultado conjunto: 174 pruebas, seis archivos, todas aprobadas; typecheck de @factuez/mailer-worker aprobado.
- No se ha ejecutado PostgreSQL real, SQL candidato, migraciones, SMTP, DNS externo, verify/send, SUNAT ni acceso a secretos del despliegue. La ejecución real del candidato, sus constraints y grants queda pendiente de revisión/aplicación explícita por integración.
