# Etapa 2 — Seguimiento integrado de notas y lotes

Fecha: 03/10/2026. Instalación de destino: `factuez-stage2-qa`, localhost:8091.

## Qué incorpora este incremento

- Detalle del comprobante con panel shadcn de notas 07/08 y lotes RC/RA
  vinculados: referencia, acción solicitada, estado registrado, fase de
  transporte, intento y hash del snapshot correspondiente.
- Ruta de lectura `GET /api/v1/fiscal-evidence/:documentId` publicada por Kong.
  Billing revalida sesión, permisos y alcance del original en cada petición;
  SUNAT-service exige su snapshot propio, mismo RUC y BETA. Sin secretos ni
  artefactos en la respuesta; `private, no-store`.
- Lectura acotada a 100 notas y 200 lotes. Un historial mayor requiere
  conciliación; no se trunca silenciosamente. Snapshots heredados sin miembros
  versionados no se convierten automáticamente al nuevo formato.
- Consumidor de la cola existente `sunat-beta-supplement-evidence-v1`.
  Contrasta evento, Outbox, reserva, propietario, snapshot y fase persistidos.
  Sólo registra Inbox en transacción serializable e invalida por WebSocket las
  lecturas de la nota, su original o los miembros propios del lote.
- Replay idempotente: Inbox se registra una vez; la invalidación se puede
  repetir después de un fallo de Redis. Los errores no incluyen payloads,
  snapshots ni secretos en logs o `failedReason`.

El publicador Live existente es best-effort y puede absorber un fallo de
encolamiento. La deduplicación permite repetir avisos si llega un replay, pero
no garantiza que ese fallo lo genere automáticamente ni la entrega a cada
navegador. La PWA conserva actualización REST periódica como respaldo.

## Qué NO hace

Esta vista y su consumidor **no son una proyección financiera**. No cambian
importes, versiones financieras, estados de Billing, correlativos, certificados
ni miembros de un lote. No firman, transmiten ni reintentan SOAP/REST.

`ACCEPTED` es un estado registrado de la fuente, no una certificación creada por
esta pantalla. La interfaz conserva el aviso de que no acredita aceptación,
anulación ni confianza del CDR. `CDR_UNVERIFIED` y `UNKNOWN` siguen explícitos.

No hubo nuevos envíos oficiales ni uso de la clave real en este incremento. El
piloto separado FQ02-1 ya consumido conserva su resultado y bloqueo de reenvío.
Ver [incremento Beta previo](ETAPA2_INCREMENTO_BETA.md).

## Pruebas y límites

275 casos nuevos aprobados en cinco suites: 18 API, 7 interfaz SSR, 123 consumidor
y 127 conciliación/CLI. El consumidor se prueba con dobles transaccionales:
rollback, replay, concurrencia simulada, cruces de RUC, versiones y claims
inconsistentes. No acredita concurrencia real de PostgreSQL ni aceptación SUNAT.

Regresión completa: **1.389 pruebas PASS en 45 suites**, sin omisiones.
**15 tareas TypeScript PASS** y compilación de la herramienta histórica PASS.

```powershell
pnpm test:supplement-tracking
pnpm test:history-preview
```

Builds Docker SUNAT-service y PWA PASS; desplegados únicamente esos dos servicios
en el QA existente con los tres overlays y `--no-deps --no-build --pull never`.
Kong validado y recargado; PostgreSQL/Redis no se recrearon ni migraron.

Auditoría HTTP desplegada PASS: nueva consulta sin sesión 401 y ID inválido con
sesión demo 400, antes de consultar ventas. Previsualización fiscal autenticada
200/no-store con cálculo exacto; PRODUCTION rechazada 400. No se consultó la
configuración de ningún emisor, no se firmó ni se enviaron documentos.

Login localhost y LAN 192.168.100.5:8091, y salud SUNAT por Kong: HTTP 200.
Once contenedores saludables, red QA interna, `SUNAT_ENVIRONMENT=BETA`, workflow
y transmisión Beta oficiales en `false`, y guard compilado de activación cerrado. La prueba
genera sólo la sesión normal demo de Identity. No acredita impresión física,
concurrencia PostgreSQL del consumidor ni homologación.

## Gate y etapa siguiente

**Etapa 2 fiscal oficial permanece abierta.** Siguen pendientes la confianza
del CDR oficial, productores/proyecciones financieros de notas y lotes en
Billing/PWA y perfiles fiscales adicionales integrados. Este incremento cierra
el seguimiento de lectura y notificación, no esos pendientes.

Por solicitud de continuar, se prepara en paralelo la conciliación histórica
de [etapa 3](ETAPA3_PREPARACION_HISTORICOS.md), sin iniciar importación, corte
ni cambios de base. Producción permanece bloqueada.
