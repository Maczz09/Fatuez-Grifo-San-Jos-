# B2B-04 — borradores y emisión local 01/03

Fecha: 20/10/2026. **Implementación técnica candidata completada y ensayada
en aislamiento. No desplegada en QA/Kong ni habilitada para envío oficial.**
Esta fase B2B no cierra las etapas fiscales históricas 2/3 ni un piloto SUNAT.

## Implementado

Agregado propio de Billing para crear, consultar, editar, validar y cancelar
borradores 01/03. La edición no utiliza Document como tabla de trabajo, no reserva
números ni crea XML o eventos de emisión/Outbox. Perfil local inicial: contado,
venta gravada IGV 18%, PEN/USD; otros perfiles se rechazan, no se ignoran campos.

- Revisión fuerte `"v1"`, If-Match obligatorio para cambios, 412 al desactualizarse
  y 428 cuando falta precondición. Una edición invalida la validación anterior.
- Estado cancelado inmutable. No se modifica un documento fiscal ya emitido.
- Idempotency-Key estable, almacenada como hash, con namespace por cliente/actor.
  Mismo comando: respuesta y operación originales; otro contenido: 409.
- Unicidad adicional de origen externo por cliente/actor/RUC/namespace/valor.
  Usar otra clave de idempotencia no duplica el mismo origen.
- Operación durable con commandId/requestId, actor SERVICE o USER real, contexto
  y resultado. Nunca se atribuye un SERVICE a un usuario humano inventado.
- Auditoría/operación y borrador se confirman en una sola transacción. Fallo de
  persistencia o revocación detectada antes del commit revierte el cambio.
- Recuperación por operationId o por Idempotency-Key en HEADER, no en URL/logs.
- PostgreSQL candidato con locks de namespace, revisión optimista, dos tablas
  de borradores/operaciones y diario separado de emisión. No migración de arranque
  ni SQL aplicado sobre la base QA existente.

## Emisión atómica implementada

El puerto de emisión recibe la MISMA transacción Prisma del borrador; no llama
al método humano execute(), que abriría una transacción anidada. Comparte el
motor executeWithinTransaction() con el camino humano existente.

Dentro del commit se incluyen:

- Borrador bloqueado con revisión exacta validada; pasa a ISSUED y queda inmutable.
- Comprobante, ítems, snapshot congelado, origen y actor verificado.
- Incremento único del contador y registro de idempotencia de Billing.
- Operación durable con clave hasheada, commandId/requestId y respuesta original.
- Outbox fiscal existente con su contrato original, sin tipos competidores.
- Diario B2bCommitEvent independiente para el fan-out posterior de B2B-05.

Los locks siguen emisor → sede → punto → serie, además del namespace y borrador.
Se comprueban emisor BETA/activo y tupla completa contra los datos canónicos bajo
locks; los números fuera de 1..99999999 se rechazan. Fallo de escritura, auditoría
o revocación detectada en la comprobación final revierte TODO el commit. No se
afirma atomicidad distribuida con Identity: la revisión se comprueba de nuevo
inmediatamente antes de devolver la transacción, sin lock remoto.

Emitir requiere validar la revisión vigente, cuerpo vacío, If-Match fuerte y
Idempotency-Key estable. Devuelve 202 con operationId, documentId, serie/número y
state=COMMITTED: confirma el registro LOCAL, nunca una aceptación fiscal.
Un reintento idéntico devuelve los mismos IDs/número incluso tras reiniciar el
servicio. Otra clave no vuelve a emitir un borrador ISSUED; otro contenido con
la misma clave produce 409. La operación B2B no caduca al vencer el registro
legacy de 24 h: no hay purga de idempotencia B2B configurada.

Si se pierde la respuesta, conservar clave/cuerpo/revisión: repetir exactamente
o consultar /operations/lookup y después el documento resourceId. No crear otra
venta ni cambiar de clave para resolver un timeout.

## Identidad y habilitación explícita

- SERVICE conserva createdByUserId=NULL y createdByActor.kind=SERVICE. Nunca
  se utiliza el clientId como si fuera un usuario humano.
- USER conserva el subjectId real y su revisión de autorización; los permisos
  y asignaciones humanas vigentes se intersectan con los del cliente B2B.
- Emitir requiere AMBOS scopes b2b:drafts:write y b2b:documents:issue. El nuevo
  scope no se concede por defecto ni por disponer de lectura/admin local.
- El propietario debe enlazar explícitamente b2bDraftIssuer() con perfil BETA y
  lista de RUC autorizados. Sin puerto/perfil se rechaza PROFILE_NOT_ENABLED.
- La fachada requiere issuanceConfigured=true; las capacidades no prometen
  autenticación fiscal ni aceptación. fiscalActivation permanece false.
- HTTPS/mTLS y verificación vigente en fachada y propietario. No se aceptan
  userId, roles, correlativo o secretos suministrados en el cuerpo.

## Rutas candidatas

```text
POST  /b2b/v1/document-drafts
GET   /b2b/v1/document-drafts/{id}
PATCH /b2b/v1/document-drafts/{id}
POST  /b2b/v1/document-drafts/{id}/validate
POST  /b2b/v1/document-drafts/{id}/cancel
POST  /b2b/v1/document-drafts/{id}/issue
GET   /b2b/v1/operations/lookup
GET   /b2b/v1/operations/{id}
```

Excepto CREATE, las rutas exigen issuerId y environment=BETA en consulta.
CREATE toma contexto canónico del cuerpo. Mutaciones: Idempotency-Key;
edición/validación/cancelación/emisión: también If-Match. Las respuestas incluyen ETag,
X-Operation-Id, X-Command-Id y X-Idempotent-Replay. Validar es comprobar el perfil
LOCAL del borrador: no XSD completo, firma, confianza, aceptación SUNAT ni emisión.
Emisión y replay de emisión devuelven 202. El contrato combinado contiene
[operaciones candidatas](b2b/openapi.candidate.v1.json); la API legacy no cambia.

USER necesita document.issue vigente además del scope y la tupla asignada;
document.view por sí solo no autoriza comandos. Los permisos humanos y los grants
de la aplicación se intersectan en Identity. No se aceptan userId/roles del body.

## Ensayos

- Concurrencia/replay, cambio de contenido con misma clave, origen duplicado,
  revisión obsoleta, cancelación, caída de auditoría y revocación.
- Tres listeners HTTPS/mTLS reales de Identity/fachada/Billing con datos ficticios.
- PostgreSQL NUEVO aislado: ocho solicitudes concurrentes => un borrador y una
  operación; recuperación tras recrear el servicio, rollback/retry y unicidad.
  El contenedor tmpfs fue retirado; no se borró historial del usuario.

Ensayo PostgreSQL REAL NUEVO de emisión: 11 comprobaciones aprobadas con Prisma
y el motor Billing real. Factura/boleta, SERVICE/USER, dos borradores en la misma
serie, rollback tras escritura fiscal y tras el callback transaccional,
revocación antes del commit, recreación del servicio, emisor inactivo/producción
y serie agotada. Ocho solicitudes simultáneas confirmaron una sola factura,
operación e identidad fiscal. El contenedor tmpfs/network=none/cero puertos fue
retirado. No se leyó ni cambió ningún dato o contador del cliente.

Reproducir: `pnpm test:b2b-issuance` y
`node tests/b2b-issuance-db.e2e.cjs --isolated-synthetic-only`.
El ensayo SQL requiere builds actuales de contracts/service-access/Billing y el
cliente Prisma generado con el schema candidato. Generate/diff usan URL ficticia,
sin conectar a QA. No usar migrate/db push contra una base existente.

## Límites y siguiente fase

Los SQL b2b-drafts-schema.candidate.sql y b2b-issuance-schema.candidate.sql son
blueprints, NO migraciones de arranque. El schema Prisma candidato permite actor
SERVICE sin humano; el ensayo agrega un constraint de consistencia. Instalarlo
en una base existente requiere revisión/migración controlada y aprobación de
rollout; no se aplicaron esquemas ni rutas sobre localhost:8091.

No se leyeron certificados/claves ni se enviaron SOAP, REST, OAuth, correo o
webhooks reales. No se generaron nuevos PDF/XML/CDR físicos en este ensayo.
El Outbox fiscal quedó pendiente dentro de la BD sintética, sin publicador.
Publicarlo en una futura instalación exige los gates fiscales correspondientes.

B2bCommitEvent.fannedOutAt es independiente de OutboxEvent.publishedAt. Al cerrar
B2B-04 quedó esta dependencia preparada; el [circuito B2B-05](B2B_FASE5_WEBHOOKS.md)
ya implementa su consumo y notificación candidata LOCAL 01/03, sin rollout.
