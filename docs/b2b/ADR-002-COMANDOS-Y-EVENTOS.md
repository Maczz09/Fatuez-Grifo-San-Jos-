# ADR B2B-002 — comandos idempotentes, inmutabilidad y webhooks

Fecha: 20/10/2026. Aceptado para el diseño. Implementación distribuida pendiente.

## Escritura

- Un borrador 01/03 no reserva correlativo. Sus cambios/cancelación/validación y
  emisión usan `If-Match` con ETag fuerte. Un conflicto no se resuelve sobrescribiendo.
- `Idempotency-Key` estable, contenido canónico y `commandId` estable. El namespace
  interno incluye cliente/actor, emisor y operación. Mismo comando/cuerpo devuelve
  el mismo resultado; reutilizar una clave con otro cuerpo devuelve conflicto.
- Billing registra deduplicación, comprobante, correlativo y Outbox en la misma
  transacción. La fachada no reserva números ni intenta una transacción distribuida.
- Tras el commit local se congelan los hechos fiscales, aunque SUNAT no haya
  respondido. No existe PATCH/DELETE genérico de esos hechos. Corregir mediante
  notas/baja autorizada y reglas específicas, no reescribir XML/CDR.
- `202` es solicitud registrada. `SUCCEEDED` describe la operación solicitada,
  no aceptación fiscal. Respuesta perdida: consultar/conciliar por clave/commandId;
  nunca crear otra emisión con otra clave para resolver un timeout.
- Colas guardan referencias y contexto auditable, no Bearer ni contraseñas.
  Reautorizar trabajo pendiente. Revocar no borra un hecho ya confirmado y no
  se promete atomicidad global de revocación entre servicios.

## Publicación y entrega

El Outbox actual tiene `publishedAt` único. **No es fan-out por consumidor.**
Antes de conectar webhooks, incorporar seguimiento transaccional por destino o
publicaciones independientes en el propietario. No añadir un worker competidor
de las colas fiscales ni marcar entregado a todos después de una sola publicación.

Owner Outbox → publicación independiente → Inbox durable de webhook-service →
entregas por suscripción → worker. Persistir Inbox/entregas antes del ack.
Restricción única evento/suscripción; BD como fuente de verdad y reconstrucción
de cola. Cada servicio confirma sólo su transacción local.

- `eventId`: hecho estable, para deduplicación de negocio del receptor.
- `deliveryId`: evento/suscripción estable incluso en reintentos; valor del
  encabezado Standard Webhooks `webhook-id` en este contrato.
- `attemptId`: intento HTTP único, para auditoría del dispatcher.
- Firma HMAC-SHA256 con clave por suscripción sobre ID + timestamp + bytes
  exactos del cuerpo. Rotación y ventana propuesta de cinco minutos. No firmar
  un JSON reserializado distinto del que se transmite.
- Entrega al menos una vez, sin orden global. Receptor verifica firma/ventana,
  deduplica y guarda durablemente antes de responder 2xx. Usar versión del recurso
  y GET autorizado para conciliar eventos reordenados o perdidos.
- Propuesta inicial: 10 s por intento, 8 intentos/24 h, backoff+jitter y
  Retry-After acotado. DLQ/replay auditable, con permisos vigentes.

## Seguridad y datos

Destino HTTPS aprobado; política de host/puerto/IP, validación y pinning DNS
A/AAAA. Bloquear redirects, userinfo, loopback, link-local y metadata. Destinos
privados sólo con aprobación explícita, no permitir una LAN completa por defecto.
Probar DNS rebinding/IPv6 y cambios de destino antes de activar callbacks.

Payload mínimo: identificadores y versión, no snapshots internos con clientes,
XML, CDR, correos, credenciales ni URLs públicas/firmadas. Los originales se
descargan con autorización actual. Un CDR de lote requiere acceso a todos los
miembros. PDF actual puede cambiar de presentación sin alterar los hechos ni
reemplazar XML/CDR originales.

Eventos `*-verified` exigen procedencia SUNAT_BETA, firma/confianza/identidad y
binding verificados. El esquema no realiza la verificación criptográfica: el
propietario deberá acreditarla. Un código 0 aislado, hash correcto o emulador
no bastan. Nada en esta ADR autoriza envíos oficiales o a producción.
