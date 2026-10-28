# Recepción automática: verificación local

Fecha: 07/10/2026. Proyecto exclusivo `factuez-stage2-qa`.

## Entregado

- API NestJS de configuración por RUC y worker BullMQ independiente.
- Adaptador SIRE de lectura: OAuth, exportación de propuesta, ticket, descarga
  ZIP y proyección de registros; incidentes visibles, sin ignorar filas inválidas.
- IMAP TLS de sólo lectura, adjuntos XML/ZIP/PDF, deduplicación y checkpoint
  transaccional por UID/UIDVALIDITY. Nunca marca, mueve o elimina mensajes.
- Configuración cifrada y revisionada, auditoría segura, claves fuera de Redis
  y del navegador; autorización actual por empresa y sede.
- Conciliación SIRE/XML con decimales exactos; estados XML pendiente,
  coincidencia o conflicto, sin convertir coincidencia en aceptación SUNAT.
- Bandeja shadcn, ejecuciones, incidentes y asignación administrativa de sede.
  La sede no se infiere automáticamente del RUC; el XML y su identidad no cambian.
- Notificaciones Socket.io autorizadas y sondeo de respaldo, sin recarga de
  página ni reemplazo del borrador al volver a la pestaña.

## Evidencia

1. Regresión general: **109 suites, 4.043 pruebas aprobadas y una omitida**.
2. Suite focal final de automatización/UI/contratos SIRE: **367 aprobadas**.
3. HTTP + PostgreSQL de automatización: **63 comprobaciones aprobadas**.
   Incluye SIRE ficticio seguido de correo XML, conciliación, duplicados,
   cifrado/AAD, revisión concurrente, permisos y bloqueo del gate externo.
4. Regresión HTTP de recepción manual: **36 comprobaciones aprobadas**.
5. Worker y scheduler reales sobre fixtures locales: **12 comprobaciones
   aprobadas**, dos fuentes, relación con XML, idempotencia y liberación de jobs.

Los números corresponden a ensayos distintos y se superponen: no se suman como
si fueran pruebas únicas. Los E2E se ejecutaron sólo en `factuez_received_qa`,
con datos ficticios, sin escrituras en Billing ni uso de claves reales.
La migración `202610070002_reception_automation` es aditiva y exclusiva de
recepción. No se reiniciaron correlativos ni se modificaron originales fiscales.

## Runtime verificado al entregar

PWA recompilada (Next.js, TypeScript y build aprobados) y recreada únicamente
en QA; la imagen en ejecución coincide con la nueva imagen compilada.
Recepción y worker devuelven health HTTP 200; realtime recompilado y recreado
por separado devuelve HTTP 200. `/login` y `/received` devuelven 200 por Kong;
configuración de automatización sin sesión devuelve **401**.
Los demás servicios de emisión no se recrearon en la verificación final.

## Límites honestos

En QA: `RECEIVED_LIVE_READ_ALLOWED=false`, fixtures sólo con RUC prefijo `00`.
No se probaron autenticación SUNAT, conectividad IMAP real, recepción de todos
los proveedores, firma/PKI/CDR oficial ni integración contable automática.
SIRE proporciona registros para descubrimiento/conciliación, no el detalle
XML completo por ítem: éste debe llegar por un canal autorizado del proveedor.
La activación externa es independiente del modo SOAP Beta y queda a cargo de
TI, con acceso seguro por RUC. No habilita emisión de producción.

La infraestructura on-premise y su overlay quedaron preparados y validados
sintácticamente; no fueron desplegados ni activados contra servicios externos.
Consultar [guía TI](RECEPCION_AUTOMATICA_TI.md).
