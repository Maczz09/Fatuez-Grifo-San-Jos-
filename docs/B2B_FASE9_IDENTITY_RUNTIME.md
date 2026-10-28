# B2B fase 9 — Arranque propietario Identity

## Estado final del bloque

Hay un entrypoint ejecutable opt-in en `src/b2b/main.ts`, un host concreto en `runtime-host.ts` y una rama explícita en `src/main.ts`. El host lee mounts privados, construye `PrismaService`, `UserPermissionsService` y `PasswordService` existentes, instala autoridades privilegiadas concretas, reutiliza `createB2bIdentityRuntime()` y abre API/control mTLS después de comprobar el esquema.

**La DI/composición de Identity y la selección de arranque ya están implementadas.** El proceso no requiere que otro servicio le entregue callbacks de autorización ni una fábrica incompleta. La provisión de mounts, base BETA, clientes/enlaces OIDC y certificados reales sigue siendo externa y no se ejecutó aquí.

`B2B_IDENTITY_ENABLED` distinto del literal `true` conserva el arranque legacy normal, con `AppModule`, shutdown hooks y `PORT`/3001. En el entrypoint B2B separado, flag ausente significa salir sin leer mounts, construir Prisma ni abrir sockets. Con el flag activo, un fallo bloquea el arranque B2B: nunca se cae al legacy como fallback.

No se modifica `AppModule`, no se ejecutan RBAC bootstrap, migraciones, seed, SUNAT ni componentes de otros propietarios en el modo standalone. No se creó/inició Docker ni se ejecutó build global.

## Archivos

Ensamblaje reutilizado del bloque anterior:

- `services/identity-service/src/b2b/runtime.ts`
- `services/identity-service/src/b2b/runtime-config.ts`
- `services/identity-service/src/b2b/runtime-schema.ts`
- `services/identity-service/src/b2b/runtime-files.ts`
- `tests/b2b-identity-runtime.spec.ts`

Archivos añadidos/modificados para el arranque ejecutable:

- `services/identity-service/src/main.ts`
- `services/identity-service/src/b2b/main.ts`
- `services/identity-service/src/b2b/runtime-host.ts`
- `services/identity-service/src/b2b/runtime-host-config.ts`
- `services/identity-service/src/b2b/runtime-host-authority.ts`
- `services/identity-service/src/b2b/runtime-files.ts` — separa lectura validada y ensamblaje para reutilizar las mismas credenciales.
- `tests/b2b-identity-runtime-host.spec.ts`
- `tests/b2b-identity-runtime-entrypoint.spec.ts`
- Este documento.

## Composición concreta

| Área | Implementación |
| --- | --- |
| Base Identity | Una instancia existente de `PrismaService`, creada por el host y conectada explícitamente |
| Permisos y contraseñas | `UserPermissionsService` y `PasswordService` legítimos; sin defaults de autorización |
| Clientes, rate y audit | `PostgresB2bStore` sobre ese mismo Prisma |
| JWT SERVICE | `B2bTokenCodec`, clave RSA dedicada y separación de claves humanas/integration/TLS |
| Administración de aplicaciones | `OidcB2bAdministrator`, `HttpsOidcIntrospection`, `PostgresOidcAdminDirectory` |
| USER delegado | `OidcDelegationVerifier`, `PostgresLinkedUsers`, enlaces y permisos actuales |
| Catálogos | HTTP privado mTLS a las rutas existentes de Billing |
| Grants independientes | Stores persistentes y autoridades existentes de correcciones, guías, emisión de guías y webhooks |
| Administración privilegiada Users/Roles | `B2bPhase8IdentityAdmin`, `UserAdministrationService.createWithOwnerResources`, `Phase8AdminCapabilities`, autoridades concretas descritas abajo |

`B2bIdentityRuntimeModule.composite()` instala los módulos HTTP privados existentes en la misma aplicación creada por `createB2bIdentityApplication()`. El host exige instalar las seis capacidades de Identity, incluida `PRIVILEGED_ADMIN`; no reduce la expectativa de la fachada ni declara módulos ausentes.

No se instancia `AuthService` para convertir un login PWA en MFA: el modo B2B usa OIDC autenticado y el directorio/RBAC actual de Identity. Ninguna contraseña PWA, claim externo `ADMIN` ni SERVICE principal reemplaza el step-up.

## Autoridades privilegiadas concretas

La búsqueda encontró los contratos `PrivilegedHumanAuthority`, `Phase8LiveHumanIdentity` y `Phase8AdminBindingOwner`, pero no una implementación concreta reutilizable de los tres para este host. Se añadieron adaptadores cerrados:

- `PostgresB2bLiveHumanIdentity`: lee el usuario y roles activos reales, mapea únicamente permisos persistidos y consulta `UserPermissionsService.effective`. Relee para detectar cambios de identidad/revisión/RBAC durante la operación. Exige ADMIN activo y produce una proyección interna vigente de tipo `AccessTokenClaims`; no firma ni emite un token humano.
- `OidcB2bPrivilegedHumanAuthority`: usa `HttpsOidcIntrospection` real. Exige issuer, cliente delegado configurado, audiencia B2B y scopes validados por `OidcDelegationVerifier`, token vigente de vida acotada, MFA reciente y ACR permitido. Verifica el `B2bUserLink`, revisión de usuario, aplicación USER activa/revisión actual, permiso `b2b:identity:manage` y binding de la aplicación. Exige ADMIN GLOBAL y los permisos actuales `setup.manage`, `user.manage`, `role.manage`, además del permiso de la acción. Repite introspección, usuario y aplicación antes de decidir; cualquier cambio deniega. La decisión caduca como máximo en 30 segundos y antes del token o del MFA.
- `HttpB2bIdentityBindingOwner`: pide la validación de la tupla completa y activa a `/internal/b2b/validate-bindings` de Billing por mTLS. Rechaza respuestas distintas de `{valid:true}` y nunca fabrica IDs o un catálogo local de recursos.

Solo se admiten `USERS_LIST`, `USERS_CREATE`, `USERS_UPDATE`, `ROLES_LIST`, `ROLES_UPDATE`. La revisión de decisión liga política instalada, aplicación, identidad, acción, binding, ID y digest del payload. Los handles de capacidad permanecen locales a la operación, se revocan al terminar y las escrituras reales siguen las validaciones del servicio Users existente.

**Límite de la prueba Billing:** la ruta existente devuelve `valid`, no versiones persistidas de filas. El adaptador devuelve un digest estructural de la tupla validada como revisión de prueba; no afirma una versión de filas ni detecta cambios en atributos que Billing no devuelve. La jerarquía/activación se consulta de nuevo en cada revalidación. Si se requiere una garantía más fuerte de versiones de filas, hace falta ampliar el contrato propietario Billing de forma separada.

Los tokens para aplicaciones administrativas y los USER privilegiados tienen propósitos diferentes. Las aplicaciones se administran con `factuez-b2b-admin`/`factuez.b2b.admin` según el administrador OIDC existente. Las operaciones Users/Roles usan el cliente delegado explícito del host, audiencia `factuez-b2b-v1`, scope `b2b:identity:manage`, enlace USER y MFA; no se relajan los validadores para intercambiar ambas credenciales.

## Activación y mounts

Después del build coordinado de entrega, ambos ejecutables están preparados:

```text
node services/identity-service/dist/main.js
node services/identity-service/dist/b2b/main.js
```

No se ejecutaron aquí. El primero conserva legacy por defecto; el segundo solo arranca B2B con el opt-in. El host usa exclusivamente:

```text
B2B_IDENTITY_ENABLED=true
B2B_IDENTITY_CONFIG_ROOT=<directorio absoluto privado aprobado>
DB_HOST=<host exacto aprobado>
DB_PORT=<puerto exacto aprobado>
DB_USER=<usuario exacto aprobado>
DB_NAME=<base aprobada con sufijo _beta>
DB_PASSWORD_FILE=<root privado>/<passwordFile aprobado>
```

No admite `DATABASE_URL`, ni siquiera para sustituir los parámetros del mount.
El host no reescribe `process.env`: comprueba los campos de conexión contra la
configuración aprobada y construye Prisma con opciones explícitas. La contraseña
de base procede del `.bin` nombrado dentro del root privado y la CA de
`database-ca.pem`. Se exige TLS 1.2, verificación de certificado/hostname,
máximo de cuatro conexiones y timeouts; no se entrega una URL con parámetros
capaces de reemplazar esa política. El constructor legacy sigue su comportamiento
anterior cuando no recibe las opciones B2B. No hay valor secreto en JSON, logs,
excepciones o argumentos del proceso.

El root lo valida `B2bRuntimeFiles`, incluyendo sus controles de symlinks, archivos y permisos. Se leen dos documentos fijos:

### `identity-host.json`

Ejemplo de metadata sin credenciales:

```json
{
  "schemaVersion": "factuez.b2b.identity-host.v1",
  "environment": "BETA",
  "mode": "STANDALONE",
  "workerCoordination": "GLOBAL_PHASE_BARRIER",
  "database": {
    "host": "identity-db.internal",
    "port": 5432,
    "user": "identity_owner",
    "name": "identity_beta",
    "passwordFile": "database-password.bin"
  },
  "privileged": {
    "clientId": "approved-delegated-identity-client",
    "policyRevision": "approved-identity-policy-v1"
  }
}
```

Son obligatorios el modo standalone, BETA, la barrera global y todos los campos de la configuración. Se rechazan nombres/rutas inesperados y claves desconocidas. `policyRevision` identifica la política privada instalada, no constituye por sí mismo una aprobación externa ni concede permisos. La política estática del proceso cambia con un nuevo arranque; el RBAC/enlaces/aplicaciones se releen en cada operación.

### `identity-runtime.json`

Se conserva el formato `{config, files}` del runtime. `config` contiene exactamente:

```ts
{
  enabled: true, environment: 'BETA', deploymentId, instanceId,
  api: {host, port}, control: {host: operatorHost, port: operatorPort},
  tokenIssuer, billingOrigin,
  oidc: {issuer, introspectionEndpoint, adminClientId, acceptedAcr},
  scopes,
  peers: {token, admin, resource, correctionOwner, guideOwner, guideIssueOwner, webhook, operator},
}
```

El host exige `b2b:identity:manage` entre los scopes instalados. Los UUID de despliegue/instancia deben ser v4; hosts locales admitidos `127.0.0.1`/`0.0.0.0`, puertos enteros 0..65535 y distintos cuando son fijos. El puerto 0 permite las pruebas aisladas. Issuers/orígenes/endpoints deben ser HTTPS fijos sin credenciales, query o fragmento; Billing solo admite origen sin path y la introspección debe compartir origen con el issuer OIDC. Los peers son fingerprints SHA-256 únicos, máximo 100 por grupo y 32 operadores, con admin/operator separados de los peers de negocio.

El mapa `files` contiene nombres relativos simples, nunca rutas elegidas por un caller:

```json
{
  "signingKey": "b2b-signing.key",
  "pepper": "b2b-pepper.bin",
  "humanPublicKey": "human-public.pem",
  "integrationPublicKey": "integration-public.pem",
  "oidcCredential": "oidc-basic.bin",
  "apiTls": {"ca":"api-ca.crt","cert":"api-server.crt","key":"api-server.key"},
  "controlTls": {"ca":"operator-ca.crt","cert":"operator-server.crt","key":"operator-server.key"},
  "billingTls": {"ca":"billing-ca.crt","cert":"billing-client.crt","key":"billing-client.key"},
  "oidcTls": {"ca":"oidc-ca.crt","cert":"oidc-client.crt","key":"oidc-client.key"}
}
```

Todos los nombres se validan antes de leer la primera credencial. El pepper contiene 32 bytes; `oidc-basic.bin`, el header Basic completo ASCII sin newline. Se comprueban límites, claves parseables, parejas cert/key y separación de la clave B2B respecto de humanas/integration y las cuatro identidades TLS. API y control requieren certificados distintos. La validación de credenciales ocurre antes de conectar Prisma.

No hay discovery, lectura automática de `.env` ni configuración de runtime desde requests. La lectura `DB_PASSWORD_FILE` corresponde únicamente al constructor legítimo de Prisma, tras comprobar la ruta aprobada.

## Readiness y generación

Se mantienen las 22 proyecciones constantes `SELECT <columnas> FROM <tabla fija> WHERE false`: clientes/rate/audit, enlaces OIDC, heads/revisiones independientes, Users/RBAC/extra-permissions/refresh/audit. Se ejecutan antes del ensamblaje, antes de escuchar y en cada probe. No leen filas ni aplican DDL, migraciones o seed; cualquier fallo impide readiness.

Las seis capacidades anuncian componentes realmente instalados. El estado significa **ensamblado y esquema comprobado**; no demuestra que exista ya un usuario autorizado, que un token específico sea válido, ni que IdP/Billing estén disponibles. Esas comprobaciones son reales y fallan cerradas en cada solicitud. Las proyecciones tampoco certifican constraints, triggers, índices o integridad de datos.

`runtime.bootId`, `runtime.status.bootId`, `runtime.statusMetadata.bootId` y `maintenance.snapshot().instance.bootId` siguen siendo el único `status.bootId`. El padre debe mantener su exigencia de todos los owners/capacidades del grafo completo. Esta entrega no inicia ni modifica otros propietarios.

## Hooks standalone y cierre

El host standalone solo construye Prisma, servicios de permisos/contraseña, adaptadores de identidad y la aplicación HTTP B2B. No importa `AppModule`, no registra RBAC bootstrap, consumers, jobs, outbox publishers, timers de negocio, Redis ni otro listener propietario. `B2bStandaloneIdentityLifecycle` conserva inventarios vacíos e inmutables de producers/workers/otros listeners y sus hooks comprueban esa ausencia. No se devuelve una autorización ficticia ni se certifican workers externos desde esos inventarios.

El contrato `GLOBAL_PHASE_BARRIER` es obligatorio: el coordinador padre debe completar WORKERS en todos los nodos antes de emitir STORAGE. Identity mantiene introspección y `authorize*` disponibles hasta STORAGE, incluso después de su propio WORKERS; su hook local no dice que los workers de otros servicios hayan terminado.

`B2bOwnerDrain` compartido se instala antes de `init/listen`, con máximo 16 tickets:

| Fase | Efecto |
| --- | --- |
| ADMISSION | `pauseCommands()` y esperar `drain('COMMANDS')` |
| PRODUCERS | Comprobar ausencia de productores locales standalone |
| WORKERS | Comprobar ausencia de workers locales y `drain('MUTATIONS')`; lecturas de workers siguen abiertas |
| STORAGE | `closeAdmission()`, `drain('ALL')`, cerrar listeners propietarios, `app.close()` y `prisma.$disconnect()` |

Un resultado `DRAINING` o un fallo de hook no produce éxito. La suscripción independiente espera SQL/controladores incluso cuando el cliente aborta, sin liberar el ticket como si hubiera terminado. El control HTTPS privado permanece PARKED después de STORAGE para observar/repetir recibos. El shutdown del host por SIGTERM/SIGINT utiliza `stopB2bMaintenanceNode` compartido, reutiliza el run ya coordinado cuando existe, ejecuta el cierre idempotente y cierra también el listener operador. No fuerza `process.exit` ni mata trabajo para cumplir un plazo.

Un shutdown local sin inventario global no demuestra que otros propietarios hayan dejado de escribir: para mantenimiento/backup global sigue siendo obligatorio el protocolo padre.

## Pruebas y comprobación final

Se ejecutó:

```text
pnpm --filter @factuez/identity-service typecheck
pnpm exec vitest run tests/b2b-identity-runtime-entrypoint.spec.ts tests/b2b-identity-runtime-host.spec.ts tests/b2b-identity-runtime.spec.ts --maxWorkers=1 --hookTimeout=30000 --testTimeout=15000
```

**Resultado: typecheck aprobado y 46 pruebas aprobadas en 3 archivos.** Sin build global ni regresión de otros propietarios. Ya estaban disponibles los artefactos compartidos generados por el padre; este bloque no escribió `dist`.

Las pruebas usan Nest real, mTLS real en loopback, OIDC/Billing locales sintéticos, mounts temporales con claves/certificados sintéticos y el constructor Prisma sustituido exclusivamente por métodos simulados. Los servicios de permisos, contraseñas, stores, bridge Users y autoridades son los de producción.

Se verifica default legacy y rama opt-in exclusiva, sin fallback; default disabled sin I/O/Prisma; mounts y DB BETA concordantes; seis capacidades y boot ID único; ausencia de seed y recursos legacy; OIDC/MFA/enlaces/revisiones/RBAC actuales; alta real `UserAdministrationService.create` con recursos exactos, hash scrypt y audit; rechazo ante MFA/token/link/rol/permiso/revisión/aplicación/binding/IdP inválidos, SERVICE, peers no autorizados y recursos fuera del binding; cierre por fases y almacenamiento idempotente; además del drenaje tras abortos ya cubierto por las pruebas del runtime.

## Límites y gates que siguen externos

- No se ejecutó PostgreSQL real: ni transacciones/durabilidad del motor, constraints, triggers o migraciones. Docker Desktop Linux no estaba disponible según el padre; no se intentó crear/iniciar Docker ni ejecutar la prueba PostgreSQL del vault.
- No se conectó un IdP/Billing de despliegue ni se leyeron claves, certificados, credenciales o `.env` reales. Deben provisionarse los clientes, audiencias/scopes, enlaces persistidos y MFA aprobados; no hay auto-enrollment ni concesión de permisos.
- La garantía Billing es la validación actual de la jerarquía completa y un digest estructural; no una revisión persistida de filas que la ruta no devuelve.
- No se probó infraestructura Ubuntu, mounts de producción, el grafo completo de owners ni un cierre distribuido real. La barrera global y el inventario padre siguen siendo requisitos.
- No se construyó globalmente ni se alteraron AppModule, paquetes, publishers o propietarios adicionales. El build/regresión final coordinados quedan a cargo del padre sobre esta fuente estable.
