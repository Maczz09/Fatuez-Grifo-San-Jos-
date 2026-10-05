# Primer flujo desacoplado implementado

Fecha: 2026-09-11

## Recorrido

```text
POST /api/v1/documents
  -> billing-service
  -> transacción: correlativo + documento + ítems + idempotencia + Outbox
  -> OutboxPublisher
  -> BullMQ sunat-submissions
  -> sunat-service / Inbox
  -> UBL 2.1 sin firmar + SHA-256 + almacenamiento de artefacto
  -> Outbox de estado SUNAT
  -> BullMQ billing-status-updates
  -> billing-service / Inbox
  -> Document.sunatStatus = PROCESSING
```

Ambas direcciones usan `jobId = eventId` e Inbox/Outbox, por lo que una
reentrega no vuelve a procesar el mismo evento. La reserva del correlativo y el
documento ocurren en la misma transacción PostgreSQL.

## Código portado y corregido

- Cálculo de IGV caracterizado desde RestoApp, reescrito con `bigint` y
  decimales textuales para evitar `number`/IEEE-754.
- Builder Invoice UBL para tipos 01/03 con unidades comerciales (`GLL`, `LTR`,
  `NIU`) y afectación tributaria por línea.
- Contratos `billing.document.issued.v1` y
  `sunat.document.status-changed.v1`.
- Idempotency-Key asociado a SHA-256 del comando.
- Artefacto XML fuera de PostgreSQL, con tamaño y SHA-256 registrados.

## Bloqueo fiscal intencional

Este corte **no llama a SUNAT**. El worker deja el documento en procesamiento
después de construir el UBL. La activación de firma y transporte requiere:

1. completar el UBL con todos los nodos obligatorios del caso fiscal;
2. ejecutar XSD/Schematron y golden files oficiales;
3. configurar certificado y SOL mediante secrets, nunca desde el snapshot;
4. parsear CDR y mapear aceptado/observado/rechazado;
5. homologar en Beta con datos controlados;
6. aprobar explícitamente el cambio a producción.

## Autorización integrada

El endpoint de emisión ya no acepta `x-user-id`. `identity-service` emite JWT
RS256 con roles, permisos y puntos de emisión; Billing verifica firma, issuer,
audience, expiración, permiso `document.issue` y el alcance del punto antes de
reservar un correlativo. La matriz y la inicialización segura están en
`docs/RBAC_USUARIOS_Y_ROLES.md`.

## Verificación ejecutada

- Legado RestoApp: 8 suites, 89 pruebas aprobadas.
- `@factuez/contracts`: 4 pruebas aprobadas.
- `@factuez/sunat-core`: 4 pruebas aprobadas.
- TypeScript estricto: `billing-service` y `sunat-service` sin errores.
- Prisma Client 7.8 generado correctamente para ambos servicios.
