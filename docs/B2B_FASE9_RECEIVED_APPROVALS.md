# B2B-09 — Aprobaciones Received privadas y durables

## Entrega y alcance

Servidor real del protocolo utilizado por `B2bReceivedStepUpHttp` de Received. Instala preparación autenticada y verificación privadas mediante un módulo Nest; no añade rutas públicas, no modifica hosts/runtime/shared/main ni activa automáticamente permisos, grants o listeners.

Archivos nuevos:

- `services/identity-service/src/b2b/received-approval.ts`
- `services/identity-service/src/b2b/received-approval-model.ts`
- `services/identity-service/src/b2b/received-approval-core.ts`
- `services/identity-service/src/b2b/received-approval-store.ts`
- `services/identity-service/src/b2b/received-approval-http.ts`
- `services/identity-service/src/b2b/received-approval-schema.sql`
- `tests/b2b-received-approval.spec.ts`
- Este documento.

No se ejecutaron Docker, PostgreSQL real, SUNAT, migraciones, build global ni regresiones de otros propietarios. El trabajo TLS previo de Identity no forma parte de esta continuación y no se modificó su infraestructura.

## Integración pendiente del padre

`createReceivedApprovalServer()` devuelve `null` sin `enabled: true`. `ReceivedApprovalModule.isolated()` tampoco registra controladores por defecto. La composición explícita requiere:

```ts
const approvals = createReceivedApprovalServer({
  enabled: true,
  db: identityPrisma,
  permissions: identityUserPermissions,
  provider: new HttpsOidcIntrospection(approvedEndpoint, mountedBasicCredential, oidcMtls),
  catalogue: new B2bBindingCatalogueHttp(new B2bPrivateHttp(billingOrigin, billingMtls)),
  issuer: approvedOidcIssuer,
  clientId: approvedReceivedOperatorClient,
  acceptedAcr: approvedMfaAcr,
  peers: {prepare: approvedPreparationFingerprints, verify: approvedReceivedFingerprints},
});
await approvals!.store.ready();
// Importar approvals.module en la aplicación privada del mismo owner antes de init/listen.
```

La fábrica reutiliza `PostgresLinkedUsers`, `PostgresQueuedUsers`, `PostgresB2bLiveHumanIdentity`, `OidcDelegationVerifier` y `PgTransaction` existentes. No hay implementación alternativa que devuelva siempre ADMIN/step-up verdadero. El padre debe proporcionar el Prisma y transportes TLS reales aprobados; esta fábrica no crea conexiones, lee secretos ni interpreta configuración de un caller.

Antes de instalar el módulo se debe provisionar **por el procedimiento separado autorizado** el esquema candidato. `store.ready()` solo hace `SELECT ... WHERE false` sobre las columnas propias y `B2bAudit`; no crea tablas. Debe incorporarse al readiness del owner por el padre. Las restricciones, ACL e integridad reales del motor no se demuestran con esas proyecciones.

El padre también configura el endpoint ya existente del cliente Received como:

```text
https://<identity-private>/internal/b2b/received-stepup/verify
```

Es una ruta implementada aquí. No se presupone una ruta externa inexistente. El fingerprint de servidor configurado en Received debe corresponder al certificado del listener Identity. Preparación y verificación usan listas de peers fijas, explícitas, únicas y separadas (máximo 32 por grupo). El listener de la aplicación debe exigir mTLS, body parser JSON acotado y el drenaje propietario existente; el módulo no abre otro listener por su cuenta.

## Autorización de preparación

`POST /internal/b2b/received-stepup/prepare` exige peer mTLS de preparación y `Authorization: Bearer <token OIDC delegado>`. No acepta un principal, bandera ADMIN o aprobación declarada por el cuerpo.

En preparación y nuevamente en verificación se comprueban:

1. Introspección autenticada real, issuer y cliente OIDC fijos, audiencia B2B, token activo/vigente y scopes válidos mediante el verificador existente.
2. MFA con `amr` que contiene `mfa`, ACR permitido y `auth_time` reciente (menos de 300 segundos).
3. Enlace USER persistido, revisión de usuario vigente, aplicación USER activa y su revisión actual.
4. Usuario actual GLOBAL, rol ADMIN activo y permiso **persistido/vigente** `setup.manage`; no se usan permisos por defecto ni roles del IdP.
5. Scope Received en token y aplicación: `b2b:received:configure` para GRANT/CONFIG, o `b2b:received:sync` para SYNC.
6. Coincidencia exacta de empresa, RUC receptor, sede y entorno BETA con un binding persistido de la aplicación. El binding completo anclado se valida por el HTTP privado real de Billing.

Para GRANT también se revisan la aplicación destinataria, su tipo y `clientRevision`, scopes requeridos y su binding en la misma tupla validada. Un destinatario USER necesita enlace persistido actual, `userAuthRevision` correcto, permisos de lectura/artefacto o setup según el grant y alcance de sede/punto/serie vigente. El servidor no hereda permisos Received simplemente por existir un binding 01/03.

La identidad y aplicación se comparan antes y después de auditar; las decisiones no se cachean por bearer. La introspección se repite y se deniega si cambian sus claims. Después de la última espera de IdP se releen enlace/usuario y, cuando corresponde, el destinatario USER; revocar durante esa espera también deniega. Una aprobación nunca permite sobrepasar la vigencia del token, del MFA o del usuario.

## GRANT: política completa, nunca un hash arbitrario

Ejemplo del cuerpo privado de preparación para un grant de lectura:

```json
{
  "schemaVersion": "factuez.b2b.received-approval-prepare.v1",
  "purpose": "GRANT",
  "policy": {
    "scope": {
      "environment": "BETA",
      "companyId": 1,
      "recipientRuc": "00000000001",
      "branchId": "00000001-0000-4000-8000-000000000001"
    },
    "subject": {
      "kind": "SERVICE",
      "clientId": "00000093-0000-4000-8000-000000000001",
      "subjectId": null
    },
    "permission": "READ",
    "clientRevision": 2,
    "userAuthRevision": null,
    "active": true
  },
  "expectedRevision": 0
}
```

Los IDs/RUC del ejemplo son sintéticos. `permission` admite únicamente READ/ARTIFACT. Para grants de automatización se sustituye por `action`, con el vocabulario existente: CONFIG_READ, CONFIG_SAVE, SYNC_CREATE, SYNC_READ, LIVE_READ_ONLY o SYNC_EXECUTE. Las formas son excluyentes y rechazan campos adicionales.

El servidor calcula `requestSha256 = correctionEvidenceHash({policy, expectedRevision})`, exactamente como `B2bReceptionReads.setGrant()` y `PostgresReceptionAutomationAuthority.setGrant()`. Un cuerpo GRANT con solo `requestSha256` se rechaza: no se firma un hash que no tenga política y contexto aprobados. Tampoco se aceptan credentials o payloads de configuración en esa política.

Al verificar GRANT, aunque el cliente solo envíe handle y digest, se recupera la política durable y se reconstruye su digest. Se revisan de nuevo contexto, administrador, aplicación destinataria y revisiones. Cambiar expectedRevision, destinatario, scope, permiso o digest requiere otra preparación. Preparar una aprobación no escribe el grant Received: la mutación de negocio sigue siendo propiedad de Received y su control de revisión existente.

## AUTOMATION: contexto exacto y fingerprint aprobado

Preparación privada:

```json
{
  "schemaVersion": "factuez.b2b.received-approval-prepare.v1",
  "purpose": "AUTOMATION",
  "action": "CONFIG_READ",
  "scope": {
    "environment": "BETA",
    "companyId": 1,
    "recipientRuc": "00000000001",
    "branchId": "00000001-0000-4000-8000-000000000001"
  },
  "requestSha256": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
}
```

Se admiten las cuatro acciones de ejecución de `ReceptionAutomationAction`: CONFIG_READ, CONFIG_SAVE, SYNC_CREATE, SYNC_READ. La aprobación liga el fingerprint, acción, scope, aplicación/revisión y usuario/revisión del administrador preparado. Verify exige que `actor`, `scope` y `action` del cliente coincidan exactamente con esa aprobación.

El fingerprint de automatización puede ser HMAC calculado con una clave privada del vault Received. Identity no posee esa clave, no recibe contraseñas de configuración y **no puede recomputar sus bytes semánticos**. La preparación privada aprueba ese fingerprint concreto junto a su contexto autenticado; el padre debe obtenerlo del flujo propietario confiable. No debe inventar un hash diferente ni agregar una API pública que acepte autorizaciones declaradas. GRANT no tiene esta excepción: su hash siempre se calcula desde la política completa.

## Handle y persistencia

La respuesta de preparación contiene schema, purpose, action, scope, requestSha256, expiresAt y un handle base64url canónico de `{nonce, tokenOIDC}`. El nonce tiene 32 bytes aleatorios. El handle completo está limitado a 8192 caracteres; si el token no cabe, se rechaza antes de persistir. No hay fallback que guarde el token para aceptar un handle largo.

El usuario ya posee el bearer y el handle sigue siendo una credencial: solo se devuelve por el canal privado con `Cache-Control: private, no-store`. Verify no admite un segundo header Authorization. No se registra el handle ni se incorpora a excepciones o inspección. `ReceivedApprovalAuthority` y el store usan campos privados; el core redacta JSON/inspect.

`B2bReceivedApproval` guarda hash del nonce, hash del token y metadatos cerrados: UUID de aprobación, contexto/política no secreta, digest de solicitud, IDs y revisiones de administrador/aplicación, hashes de snapshots, creación y expiración. No guarda token OIDC, nonce en claro, handle, cuerpo de configuración ni credenciales Received.

El plazo es como máximo 30 segundos, puede ser menor por la vigencia restante y no se renueva al verificar. La aprobación es reutilizable exclusivamente para la misma operación y durante ese plazo: el cliente actual verifica varias veces dentro de setGrant/automation, por lo que consumirla al primer verify rompería el protocolo.

Una nueva instancia puede verificar la misma fila sin caché de nonces. Esto es revalidación contextual, no un permiso para reusar otro digest o propósito. Un cambio de aplicación, usuario, permisos, enlace, scope o política invalida la aprobación.

## Transacciones, auditoría y proof

El store PostgreSQL usa el Prisma/transaction existente. Cada operación está en una transacción; la lectura de aprobación usa `FOR UPDATE`, y los clientes se consultan con el `PgTransaction` existente. Preparación inserta la fila y añade un `B2bAudit` antes de confirmar. Verify añade otro audit antes de entregar un proof, con una última revisión de identidad/expiración. Un fallo de auditoría o commit impide devolver aprobación/proof y revierte sus escrituras.

Los audits usan acciones RECEIVED_APPROVAL_PREPARE/RECEIVED_APPROVAL_VERIFY; `requestId` es el UUID durable de la aprobación, correlacionando todas sus comprobaciones, y `peerHash` contiene solo el hash del peer. Se reutiliza `B2bAudit`; no se añade un almacén de bearer ni una tabla de grants Received.

La ruta privada compatible con `B2bReceivedStepUpHttp` recibe exactamente:

```ts
// GRANT
{schemaVersion:'factuez.b2b.received-stepup-request.v1',purpose:'GRANT',handle,requestSha256}
// AUTOMATION
{schemaVersion:'factuez.b2b.received-stepup-request.v1',purpose:'AUTOMATION',handle,requestSha256,
 actor:{clientId,subjectId,authRevision},scope,action}
```

El proof tiene exactamente los campos del cliente actual: schemaVersion, purpose, requestSha256, **requestBindingSha256 = correctionEvidenceHash(body completo de verify)**, adminId UUID v4, authRevision, authority GLOBAL_ADMIN, permission setup.manage y expiresAt. Las constantes de autoridad/permisos solo se devuelven después de las comprobaciones reales; no son una decisión siempre verdadera. Errores HTTP y de almacenamiento son genéricos y no muestran mensajes privados del driver/IdP.

## Pruebas y estado de tipos

Resultado focalizado: **28 pruebas aprobadas** con:

```text
pnpm exec vitest run tests/b2b-received-approval.spec.ts --maxWorkers=1 --hookTimeout=30000 --testTimeout=15000
```

Se utilizaron Nest y mTLS reales exclusivamente en loopback, PKI sintética, `HttpsOidcIntrospection` y catálogo HTTP reales frente a servidores sintéticos, cliente `B2bReceivedStepUpHttp` sin modificar y el store SQL de producción sobre una simulación transaccional. No hubo PostgreSQL real.

Cobertura: default disabled; separación de peers/bearer; GRANT desde política completa; interoperabilidad repetida; binding exacto del body del proof; automation ligada a actor/acción/scope; snapshots y revisiones; target SERVICE y USER con userAuthRevision; rechazo por MFA, roles, permisos, app, enlaces, IdP, audiencia o contexto cambiados; expiración, handles falsificados y límites; replay con nueva instancia; rollback ante audit/commit; ausencia de tokens/nonces/handles en persistencia e inspect.

Los **cinco archivos TypeScript nuevos pasan typecheck noEmit aislado** usando las opciones del tsconfig de Identity. El intento de typecheck completo del target encontró errores ajenos al alcance en `src/b2b/owner-administration.ts`: import compartido `dist/b2b-owner-administration` ausente y posibles `live` nulos. No se modificó ese archivo ni se construyó el paquete compartido. El padre debe resolver su integración antes de exigir el target completo.

## Límites concretos y trabajo del padre

- Aplicar/revisar el SQL candidato y permisos del store por un proceso autorizado separado; no se verificaron durabilidad, aislamiento, constraints ni índices de PostgreSQL real.
- Conectar este módulo y `store.ready()` al host/readiness propietario, definir CA/peers fijos y actualizar el endpoint/fingerprint del cliente Received. No se tocaron runtime-host/runtime/main/shared.
- Proveer Prisma con TLS verificado, transporte IdP autenticado y Billing privado reales; no se modificó ni certificó aquí la conexión PostgreSQL del host.
- Diseñar la futura UI/preparación pública por separado. Hoy solo existe preparación privada autenticada; no hay enrolamiento ni grants automáticos.
- Recibir el fingerprint de automatización del flujo propietario Received; Identity no puede verificar el HMAC sin compartir una clave que este diseño no comparte.
- La validación de contexto depende del contrato existente de Billing; no inventa revisiones de filas no devueltas por ese contrato.
- Operación real, reinicio de proceso/DB, backups, limpieza de aprobaciones expiradas, límites distribuidos de tráfico e integración Ubuntu quedan fuera de estas pruebas. La prueba de nueva instancia conserva el estado del transporte SQL simulado.
