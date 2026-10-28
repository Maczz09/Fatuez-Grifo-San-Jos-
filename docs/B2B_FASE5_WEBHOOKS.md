# B2B-05 — webhooks privados: perfil local 01/03

Fecha: 20/10/2026. **Circuito candidato implementado y ensayado para el evento
document.issued-locally.v1 de facturas/boletas locales BETA. Sin rollout en QA,
sin callbacks del cliente, sin SUNAT oficial ni producción.**

No se afirma cobertura operativa de todos los eventos del catálogo de diseño:
aceptación/rechazo tributario verificados, archivos, NC/ND, guías, correo y
recepción necesitan sus productores específicos y gates del propietario.

## Arquitectura implementada

```text
Billing: Document + operación + Outbox + B2bCommitEvent (un commit)
  → B2bCommitPublisher / B2bCommitPump (cursor y lease propios)
  → HTTPS/mTLS → webhook-service: Inbox + fan-out + auditoría (un commit)
  → BD durable de entregas → dispatcher / avisos BullMQ independientes
  → autorización vigente + DNS aprobado/fijado + HTTPS + firma
  → receptor: verificar bytes/fecha/firma → Inbox durable → confirmar 2xx
```

La fachada B2B no accede a las BD de Billing ni webhooks. Cada servicio mantiene
sus propios puertos y persistencia. El publicador no consume sunat-submissions,
no modifica OutboxEvent.publishedAt ni anuncia entrega externa al confirmar Inbox.

El microservicio nuevo es `services/webhook-service`. Sus factories no arrancan
listeners, publicadores, workers ni migraciones al importarse. El stack actual
y Kong no se modificaron. No se crearon clientes técnicos o grants de QA.

## Suscripciones y permisos

Cada suscripción pertenece al cliente/actor que la crea y a UNA tupla completa
RUC–sede–punto–serie–tipo BETA, comprobada contra el principal vigente. No se cruzan
listas de IDs para inventar permisos. Para más tuplas se crean más suscripciones.
Límite inicial explícito: 100 suscripciones globales; se rechaza el alta excedente.

- Lectura: b2b:documents:read + b2b:webhooks:read.
- Alta, cambios, verificación, rotación y replay: b2b:documents:read +
  b2b:webhooks:manage. El envío exige también el grant actual de lectura webhooks.
- USER necesita document.view y, para gestionar, setup.manage; se conservan
  usuario real, revisión, vínculo habilitado y asignaciones. SERVICE no se
  convierte en un usuario ADMIN ni recibe un userId inventado.
- Ningún scope nuevo se concede por defecto: Identity sigue iniciando con su
  política B2B-02 de contexto/catálogo. Las políticas posteriores son explícitas.
- Los trabajos no guardan JWT, Bearer, client_secret ni contraseña. Un endpoint
  mTLS específico de Identity revalida el cliente/revisión, vínculo USER y sus
  permisos/asignaciones actuales. Ante indisponibilidad no se envía el callback.

El alta acepta un destinationId de la lista aprobada por TI, NO una URL libre.
Verificar envía un nonce y exige respuesta HTTP 200 con JSON exacto {challenge}.
Challenges usan los mismos controles de destino que una entrega. Cambiar o
desactivar la suscripción invalida la verificación; una entrega pendiente nunca
se redirige automáticamente a otro destino. Un replay explícito puede volver a
vincular una entrega cancelada al destino actualmente verificado y autorizado.

Se toma como destinatarias a las suscripciones activas/verificadas al ingresar
el evento; no hay backfill automático para altas posteriores. Para recuperar
historial anterior se conserva el circuito /changes y extracción B2B-03.

## Rutas candidatas

Todas exigen issuerId y environment=BETA; los IDs no sustituyen autorización.

```text
GET/POST  /b2b/v1/webhook-subscriptions
GET/PATCH /b2b/v1/webhook-subscriptions/{id}
POST      /b2b/v1/webhook-subscriptions/{id}/verify
POST      /b2b/v1/webhook-subscriptions/{id}/rotate-secret
GET       /b2b/v1/webhook-deliveries
GET       /b2b/v1/webhook-deliveries/{id}
POST      /b2b/v1/webhook-deliveries/{id}/replay
```

Mutaciones: Idempotency-Key en cabecera. Cambios/verificación/rotación/replay:
If-Match con la revisión de la SUSCRIPCIÓN. 412 si cambió; 428 si falta.
Listados paginados de metadatos: hasta 100 filas, after/nextCursor y hasMore;
no se presentan como un corte fiscal inmutable. El detalle devuelve intentos
con attemptId, ronda, fecha, código seguro y estado HTTP, sin respuesta remota.

Replay sólo desde DEAD_LETTER/CANCELLED; mismo eventId/deliveryId y mismo cuerpo,
otra ronda auditada. Máximo cinco replays. 202 significa volver a programar,
no entrega confirmada. El servidor vuelve a autorizar antes de cada envío.

Contrato combinado: [OpenAPI de 39 operaciones](b2b/openapi.candidate.v1.json).
[AsyncAPI del perfil implementado](b2b/asyncapi.webhooks.candidate.v1.json).
El [catálogo de diseño](b2b/webhooks.design.v1.json) sigue separado; sus tipos
futuros no se habilitan por estar enumerados.

## Firma, confidencialidad y recuperación

Se utiliza el SDK mantenido standardwebhooks 1.1.1, fijado en el lockfile.
Formato [Standard Webhooks](https://github.com/standard-webhooks/standard-webhooks/blob/main/spec/standard-webhooks.md):
webhook-id=deliveryId, webhook-timestamp en segundos y webhook-signature v1;
HMAC sobre ID + timestamp + bytes UTF-8 exactos. Tolerancia del verificador: 300 s.
Cada intento renueva timestamp/attemptId, no la identidad de entrega ni el cuerpo.

El payload es mínimo: documento, versión/hash, correlación, emisor interno,
ambiente y procedencia LOCAL. No contiene cliente/ítems, XML/CDR, enlaces de
descarga públicos, tokens, contraseñas o rutas de almacenamiento. El consumidor
consulta el documento/artefactos con un token vigente y autorización independiente.

El secreto de firma se muestra una sola vez al crear/rotar. En BD se conserva
cifrado AES-256-GCM con clave dedicada y AAD ligada a la suscripción. No se cifra
con el P12 del emisor. GET o replay no recuperan texto plano. Si se pierde la
respuesta, se solicita una NUEVA rotación autorizada; no se expone la clave vieja.
La rotación conserva una clave anterior durante cinco minutos y firma con ambas;
otra rotación se bloquea mientras esa ventana siga activa.

Entrega al menos una vez, sin orden global ni exactly-once. Si el receptor
confirmó pero se perdió su 2xx, recibirá un duplicado. El receptor debe confirmar
su Inbox y efecto de negocio dentro de SU transacción antes de responder.
ReferenceReceiver/PostgresReceiverInbox conservan el payload mínimo/hash en BD
antes del ACK y son una referencia comprobada, no una integración con el negocio
del cliente ni un reemplazo de su transacción/consumidor de efectos.

## Seguridad de red

- URLs HTTPS aprobadas, hostname/puerto/path exactos y lista de IP concretas.
- Una IP privada de VPN sólo se admite por aprobación exacta; no toda la LAN.
- Userinfo/query/fragment y destinos IP literales se rechazan en la aprobación.
- Loopback, link-local, metadata, multicast y variantes IPv6 de traducción se
  bloquean; no se relaja este guard para poder ejecutar las pruebas locales.
- Se revisan TODAS las respuestas DNS; una no aprobada bloquea el envío.
  La conexión usa la IP validada, conservando hostname/SNI y verificación TLS.
- No redirects ni TLS inseguro. Máximo 10 s de petición, DNS 2 s, cuerpo 16 KiB
  y respuesta 4 KiB. [Opciones HTTPS de Node](https://nodejs.org/api/https.html).

Las pruebas HTTPS de loopback usan un transporte sintético fijo, ajeno al
transporte de producción, con PKI efímera y TLS verificado. Separadamente se
comprueban la política de destino y las opciones de conexión fijada del código
de producción, incluyendo DNS rebinding, IPv4/IPv6 y redirects.

## Durabilidad y operación

WebhookInbox/fan-out/auditoría se confirman juntos antes de ACK. Un eventId con
otro contenido produce conflicto, no sobrescritura. Un ACK perdido se reenvía
desde Billing y deduplica en Inbox, sin crear otra entrega.

Las entregas residen en PostgreSQL dedicado b2b_webhooks_beta. BullMQ usa una
cola nueva de avisos; el polling de BD recupera pendientes incluso SIN Redis.
No se afirma un ensayo de caída de un Redis real: se verificó recuperación desde
BD sin depender de él. Redis no es la única copia de una entrega.

Claims/leases persistentes evitan trabajos simultáneos. Una lease vencida se
recupera, registrando UNKNOWN_DELIVERY_OUTCOME en el intento interrumpido. Hay
ocho intentos por ronda/24 h con backoff, jitter y Retry-After numérico acotado.
3xx/4xx permanentes van a DEAD_LETTER; 408/429, 5xx y fallos de red reintentan.
Revocación o suscripción no verificable cancelan sin enviar. Una petición ya
iniciada no puede deshacerse por una revocación posterior: no se promete un
lock distribuido con Identity ni con el receptor.

Los SQL son candidatos para BD NUEVAS y están separados por propietario.
No se aplicaron sobre QA. Retención, cuotas finales, backups, egress y despliegue
son parte del rollout aprobado, no se configuran borrando historial existente.

## Panel

`apps/web-pwa/features/b2b/webhook-panel.tsx` conserva los componentes shadcn
del proyecto. Muestra destinos/estados, intentos, errores, paginación y replay
confirmado con clave estable. «Notificado» no significa «Aceptado por SUNAT».
Está preparado como componente integrable con cliente B2B/BFF inyectado;
NO usa useWorkspace ni la cookie/token PWA, ni está montado en el menú actual.
Se comprobó compilación, render SSR y controles de contrato; no se afirma QA
visual de una pantalla desplegada o un nuevo login SSO operativo.

## Verificado y siguiente paso

- Regresión general: 154 archivos y 5 556 pruebas aprobadas; una omitida.
  Bloque específico B2B-05: 50 pruebas / 7 archivos. Tipos del monorepo:
  28 tareas correctas, 21 paquetes; comprobación adicional del panel también correcta.
- Pruebas de firma/SDK, bytes alterados, ventanas/rotación, cifrado/AAD, grants,
  USER vigente, Inbox, concurrencia, retry, dead-letter, replay y cambios de destino.
- Recorrido HTTPS/mTLS real Identity → fachada → propietario → autoridad de
  worker → receptor ficticio que verifica con el SDK.
- Siete comprobaciones PostgreSQL aprobadas en TRES BD nuevas: Billing,
  webhooks y receptor. Commit fiscal real, publicación sólo post-commit, ACK
  perdido, fallo al confirmar entrega, recreación del servicio/receptor,
  rollback, recuperación sin Redis, revocación y cola fiscal independiente.
- Revalidado el ensayo B2B-04: 11 comprobaciones PostgreSQL aprobadas.

Reproducir: pnpm test:b2b-webhooks y, tras builds actuales, node
tests/b2b-webhooks-db.e2e.cjs --isolated-synthetic-only. Los contenedores tmpfs
etiquetados, sin red ni puertos, fueron retirados. No se usó información real.

Siguiente bloque de negocio: B2B-06, notas de venta y comandos NC/ND según sus
perfiles habilitados. No se activarán los demás eventos tributarios hasta tener
su productor/evidencia comprobados. El rollout privado requiere TI: destinos y
red/VPN, CA/certificados mTLS, clave de vault, esquemas/roles y clientes/scopes;
se configuran por canales seguros, nunca enviando secretos por el chat.
