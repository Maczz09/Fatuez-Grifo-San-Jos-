# B2B fase 9 — Rotación de custodia del vault de webhooks

## Alcance y estado

Implementación privada y deshabilitada por defecto. Cambia exclusivamente el cifrado de custodia de `Subscription.secret` y, cuando existe, `previousSecret`. Los secretos HMAC en claro siguen siendo exactamente los mismos. No usa la acción pública `ROTATE`, que sí cambia el secreto del cliente.

No se cambian `revision`, `verifiedRevision`, `actor` (incluidas las revisiones de cliente y usuario), `binding`, `previousUntil`, destinos, Inbox, entregas, intentos ni comandos de clientes. Un secreto anterior vencido se autentica y recifra; nunca se elimina como efecto secundario. Se acepta un par mixto origen/destino y solo se recifran los campos de origen. Cada suscripción seleccionada debe tener al menos un campo de origen.

No se añadieron endpoints, permisos, variables de entorno, tablas ni composición de arranque. El servicio existente sigue usando su constructor actual hasta que una composición privada autorizada inyecte el keyring. Este documento describe el contrato; no ejecuta un cutover ni habilita producción.

## Contrato criptográfico

`new HookVault(bufferDe32Bytes)` conserva las escrituras y lecturas legacy: base64 canónico de `IV(12) || tag GCM(16) || ciphertext(50)`, con AAD igual al ID de suscripción. Sigue leyendo sus propios valores existentes.

El constructor opcional admite un keyring:

```ts
const vault = new HookVault({
  activeKeyVersion: 'custody_v2',
  keys: [
    { version: 'custody_v1', key: dedicatedOldBuffer32 },
    { version: 'custody_v2', key: dedicatedNewBuffer32 },
  ],
  legacyKeyVersion: 'custody_v1', // solo durante la migración legacy
});
```

Los buffers del ejemplo son referencias suministradas por el operador; no son valores reales ni se leen automáticamente del entorno. Deben ser claves de custodia dedicadas, distintas de SOL/P12, OAuth y los secretos HMAC del cliente.

- Se admiten 1 o 2 claves de 32 bytes, con versiones únicas y material distinto. Una sola versión es activa para todas las escrituras. La otra solo descifra.
- Las versiones contienen 1..64 caracteres ASCII alfanuméricos, `_` o `-`. `legacy` está reservado al formato sin versión.
- Las escrituras del keyring generan `hookvault.1.<keyVersion>.<base64>` con IV aleatorio de 12 bytes y AES-256-GCM. Su AAD es UTF-8 de `JSON.stringify(['factuez.hook-vault.v1', subscriptionId, keyVersion])`.
- Se rechazan schema/formato desconocido, versión desconocida, cambio de contexto, tag/IV/cuerpo alterado y base64 no canónico. No se prueban otras claves al fallar GCM.
- El keyring solo abre base64 legacy si se declaró `legacyKeyVersion`, apuntando a una clave de ese mismo keyring. No supone que la clave activa sea la legacy.
- El máximo es 512 caracteres por ciphertext. El payload decodificado debe tener exactamente 78 bytes. El texto autenticado debe cumplir el formato existente de secreto Standard Webhooks.
- Las claves se copian al construir y residen en campos privados de JavaScript `#`; JSON, propiedades e inspección normal/con `showHidden` no las muestran. `metadata()` devuelve una copia de versiones, nunca claves. `ciphertextVersion()` solo inspecciona sintaxis y no sustituye a `open()`.
- Los errores criptográficos son `503 SIGNING_KEY_UNAVAILABLE`, sin mensajes de OpenSSL, claves, valores cifrados ni causa encadenada.

## Adaptador privado y política

`HookVaultRotation` recibe `HookStore`, el vault destino y opciones explícitas `{enabled: true, policy}`. Sin habilitación, `plan()` y `rotate()` rechazan con `503 VAULT_ROTATION_DISABLED`. No acepta un token B2B ni convierte `b2b:webhooks:manage` en autorización de mantenimiento.

La política fija en la composición privada debe coincidir exactamente con la enviada al plan/comando:

```ts
const policy = {
  environment: 'BETA' as const,
  fromKeyVersion: 'legacy', // o la versión de origen del envelope
  toKeyVersion: 'custody_v2',
  cutoverAt: approvedUnixMilliseconds,
  proofSha256: approvedEvidenceSha256,
};
```

Cuando `fromKeyVersion` nombra una clave versionada, también cubre los campos legacy si `legacyKeyVersion` apunta explícitamente a esa misma clave. Así se acepta un par origen versionado/legacy durante la transición, sin probar claves alternativas. Una política con origen `legacy` solo selecciona los campos sin envelope.

Origen y destino deben ser distintos; el destino debe ser la versión activa del vault. `proofSha256` es el digest hexadecimal de una evidencia aprobada. La biblioteca valida su formato y la coincidencia con la política privada instalada: **no certifica por sí sola el contenido ni la aprobación de esa evidencia**. Esa verificación y el acceso de operador corresponden a la composición privada. No hay carga ni búsqueda de documentos o secretos.

Se exige una lista explícita de 1..100 selecciones únicas:

```ts
const batch = {
  policy,
  subscriptions: approvedSnapshots.map(s => ({
    subscriptionId: s.id,
    expectedRevision: s.revision,
    expectedIdentitySha256: hookVaultRotationIdentity(s),
  })),
};
const rotation = new HookVaultRotation(store, vault, { enabled: true, policy });
const plan = await rotation.plan(batch);
// Revisar metadatos y aprobar el snapshot en la operación privada.
const result = await rotation.rotate({
  ...batch,
  commandKey: uniquePrivateMaintenanceCommand,
  expectedPlanSha256: plan.snapshotSha256,
});
```

`approvedSnapshots` proviene de una lectura privada y autorizada; la API no ofrece selección global implícita. La huella de identidad incluye todo `actor` y el binding BETA completo, por lo que detecta cambios de propietario y revisiones de cliente/usuario. Se verifica la identidad persistida de la suscripción; no se consulta en vivo a Identity ni se otorgan o revocan grants.

`plan()` autentica ambos campos presentes bajo la misma transacción, incluso el anterior vencido y los campos que ya están en destino. No escribe suscripciones, comandos ni auditoría. Solo devuelve schema, política, IDs/revisiones esperadas, huella de identidad, versiones, huella del registro anterior y huella del plan; no devuelve plaintext ni cuerpos cifrados. Puede prepararse antes del cutover; `rotate()` exige haber llegado a `cutoverAt` en milisegundos.

## Atomicidad, replay y auditoría durable

El adaptador solo usa las interfaces existentes `transaction`, `sub`, `putSub`, `prior`, `command` y `audit`. Con `PostgresHookStore` participa del mismo `BEGIN`/`pg_advisory_xact_lock(1985126506)`/`COMMIT` que las operaciones actuales. No agrega SQL ni tablas ni utiliza otra conexión por fuera de la transacción.

Antes de la primera escritura se leen **todas** las selecciones, se comprueban IDs, revisiones, identidad y tamaños, se autentican todos los ciphertext y se compara la huella completa del plan. Esa huella detecta también cambios de ciphertext o de otros atributos que no hayan incrementado la revisión funcional. Cualquier discrepancia aborta todo el lote. Los inputs y la política se copian antes de esperar el bloqueo.

Para cada suscripción se persiste un `WebhookAudit` con owner privado `vault-rotation`, acción `VAULT_REWRAP` e ID de suscripción. El `WebhookCommand` usa el mismo owner, una huella de la clave de comando, `bodyHash` con la huella de la solicitud normalizada (política, selecciones ordenadas y plan esperado), y respuesta de metadatos con snapshot anterior y huella del conjunto posterior. No guarda claves de comando en claro, claves de custodia ni secretos HMAC.

Los cambios de ciphertext, todos los audits y el comando se confirman juntos. Fallar en auditoría, escritura de comando o commit revierte el lote. Fuera del caso deshabilitado, el adaptador devuelve el error genérico `409 VAULT_ROTATION_REJECTED`, incluso ante una indisponibilidad interna; no expone detalles del almacén.

Una nueva instancia puede repetir el mismo comando tras perder el acuse. `prior()` recupera la respuesta durable sin volver a recifrar ni duplicar auditorías. Antes de devolverla se exige la misma solicitud, identidad/revisión y **snapshot posterior completo**. Un cambio posterior, aunque no incremente revisión, invalida el replay. Esto funciona también después de retirar la clave de origen, porque el replay compara el snapshot persistido y no necesita descifrarlo. Una migración nueva de ciphertext de origen sigue exigiendo su clave explícita.

## Secuencia operativa pendiente de integración

1. Preparar y aprobar evidencia BETA, versiones de claves y fecha de cutover. Entregar las claves dedicadas a través del mecanismo privado de custodia ya aprobado; no colocarlas en requests, logs, documentación o argumentos visibles.
2. Coordinar todos los lectores/escritores y entregas en curso antes de introducir el formato nuevo. Un proceso que conserve `HookVault(Buffer32)` **no puede leer envelopes versionados**. Esta entrega no incorpora un protocolo de despliegue gradual ni cambia el worker/composición actual. La barrera o pausa coordinada y la inyección del keyring en todos los procesos son responsabilidad de esa integración futura.
3. Con ambos lectores capaces y el vault destino activo, instalar la política privada y habilitar solo el adaptador de mantenimiento. Elegir la lista aprobada y capturar revisiones/huellas de identidad. Generar el plan autenticado y aprobar su huella.
4. Después del cutover, ejecutar el comando con esa misma huella y una clave idempotente privada. Conservar el acuse y la referencia a su evidencia. Un plan obsoleto requiere una nueva revisión explícita; no se omiten fallos ni se borran valores corruptos.
5. Verificar por el canal privado que los ciphertext objetivo están en destino, incluidos los `previousSecret` vencidos que se conserven. Revisar comandos/audits y entregas sin exponer valores. Ante pérdida del acuse, repetir el mismo comando, no uno nuevo.
6. Retirar la clave anterior y el mapping legacy únicamente cuando ningún registro, backup que deba recuperarse o proceso en vuelo dependa de ellos. El límite de dos claves obliga a completar ese retiro antes de incorporar una tercera generación.
7. Deshabilitar el adaptador al terminar. Volver al binario anterior/constructor legacy no es un rollback válido después de escribir envelopes nuevos. La recuperación requiere una versión capaz de leerlos y las claves de custodia correspondientes; no se implementa una reversión automática.

El solapamiento HMAC de cinco minutos pertenece al cliente y sigue regido por `previousUntil`. El retiro de una clave de **custodia** depende de completar el recifrado y la política de recuperación, no de ese plazo HMAC.

## Verificación y límites

Se ejecutó sin leer `.env`, claves/certificados reales, conexión a base de datos ni despliegue:

```text
pnpm --filter @factuez/webhook-service typecheck
pnpm exec vitest run tests/b2b-webhook-vault-rotation-crypto.spec.ts tests/b2b-webhook-vault-rotation.spec.ts tests/b2b-webhooks.spec.ts tests/b2b-webhooks-security.spec.ts tests/b2b-webhooks-http.spec.ts tests/b2b-webhooks-authority.spec.ts tests/b2b-webhooks-contract.spec.ts tests/b2b-webhooks-panel.spec.ts tests/b2b-webhooks-pinned-http.spec.ts --maxWorkers=2 --hookTimeout=30000 --testTimeout=15000
```

Resultado: tipos del servicio sin errores; **9 archivos y 92 pruebas aprobadas**. Los casos nuevos usan buffers sintéticos y el `MemoryHookStore` transaccional existente de `tests/b2b-webhooks.fixture.ts`, con el núcleo real `Webhooks`, identidad sintética y callback simulado. Cubren legacy, separación de claves/versiones/AAD/schema, manipulación de IV/tag/cuerpo, límites, campos privados, lote de 100, concurrencia, snapshot/revisión/identidad obsoletos, rollback de audit/command/commit, replay durable con clave anterior retirada, idempotencia pública preservada y `Webhooks.dispatch()` con ciphertext recifrado, doble HMAC y vencimiento del solapamiento. Los journals y entregas se comparan antes/después; los reintentos mantienen bytes e IDs.

No se probó una base PostgreSQL real, un reinicio de un proceso desplegado, el protocolo de corte coordinado, almacenamiento real de claves, recuperación de backups ni una conexión Ubuntu. La durabilidad real y el bloqueo de PostgreSQL se apoyan en el `HookStore` existente; las pruebas nuevas verifican el contrato y rollback en memoria. Los strings de plaintext existen temporalmente para descifrar/recifrar; JavaScript no garantiza su borrado de memoria. Los campos `#` previenen exposición por reflexión habitual, no sustituyen el aislamiento del proceso.

Continuación: el nuevo arranque privado de `webhook-service/src/main.ts` admite
keyring montado de una o dos versiones, mTLS y cierre ordenado de worker/pool.
La prueba de `tests/b2b-webhook-runtime.spec.ts` usa HTTP real sobre loopback y
schema SQL simulado; no demuestra persistencia PostgreSQL.

Se añadió al runner `tests/b2b-webhooks-db.e2e.cjs` el caso
`VAULT_REWRAP_POSTGRES_ROLLBACK_RESTART_AND_REPLAY`: rollback de commit,
recifrado, replay tras reconstruir el adaptador, una sola auditoría y conservación
de HMAC, revisiones, journals y correlativos. **Este caso no se pudo ejecutar**
el 26/10/2026 porque Docker Desktop Linux Engine no estaba disponible. Falló al
crear el contenedor nuevo; no se creó base ni se tocó QA. Debe repetirse con
Docker disponible antes de afirmar validación persistente de esta rotación.

