# Etapa 2 — productor desacoplado y conciliación local

Incremento de desarrollo: 03/10/2026. QA existente `factuez-stage2-qa`.

Seguimiento posterior: [persistencia candidata](ETAPA2_PERSISTENCIA_CANDIDATA.md).
Los conteos y el despliegue registrados aquí pertenecen a este incremento previo.
El esquema posterior sigue sin aplicar y no habilita efectos fiscales.

## Alcance

Sólo BETA y desarrollo local. Sin nuevos envíos SUNAT, firmas con el certificado
real, OAuth, correo externo, migraciones, importación histórica o cambios en
ventas/correlativos existentes. Producción sigue prohibida. No se consulta la
configuración de otros RUC. Los fixtures de pruebas son datos inventados, no
operaciones comerciales ni evidencias SUNAT.

## Productor interno preparado, no activado

`BetaSupplementCommandService` está registrado en Billing, sin controlador ni
tarea automática. Su guard siempre rechaza **antes** de inspeccionar datos,
reservar documentos, consultar la BD, consumir correlativos o escribir Outbox.
Cambiar variables de entorno no lo activa.

El repositorio interno usa tablas existentes de Billing y transacciones
serializables: empresa/RUC/BETA propios, sede/punto/serie autorizados, copia
inmutable, historial propio de créditos, CAS del correlativo de nota, nota/ítems/
referencia/Outbox atómicos y deduplicación por comando exacto. RC/RA usan el
registro de lotes existente, sin reiniciar ni reutilizar numeración. RC2 permanece
bloqueado en este productor hasta contar con versiones financieras persistidas.

La revisión de estados propios no sustituye confianza PKI. Antes de una futura
activación se necesita un resolvedor server-side de evidencia auténtica; ninguna
aceptación o declaración `NOT_DELIVERED` del cliente es una autorización.

El canal preparado es:

1. Billing: transacción propia + `billing.beta.supplement.requested.v1` en Outbox.
2. Publicador: cola dedicada `billing-beta-supplement-requests-v1`, distinta de
   facturas individuales y del emulador QA.
3. SUNAT: contrato JSON limitado, RUC/sede/operación/hash, guard oficial cerrado,
   staging idempotente y comprobación de reserva antes de Inbox.
4. Seguimiento existente: evidencia y notificaciones WebSocket; no aplica todavía
   automáticamente efectos financieros en Billing.

Las pruebas del repositorio usan dobles transaccionales. No demuestran locks ni
rollback bajo concurrencia de PostgreSQL real.

## Conciliación versionada pura

`projectFiscalFinancialLedger()` no tiene BD, red, reloj, entorno ni secretos.
Preserva el original y deriva versiones separadas con importes decimales exactos,
hash anterior, secuencia y deduplicación. Créditos y reservas consumen capacidad;
los débitos no amplían capacidad de devolución. RC2 sólo permite boletas sin
notas/reservas anteriores. Las bajas conservan importes y exigen vinculación de
la declaración de no entrega. Un CDR no verificado no produce efectos.

El resultado siempre declara `simulationOnly=true`, `persisted=false`,
`evidenceAuthenticityVerified=false` y `transmissionAuthorized=false`.
Los booleanos sintéticos no prueban firmas CDR. El caller futuro deberá enlazar
CDR/XML/versiones/historial auténticos y persistir con fencing transaccional.
No existe liberación automática de reservas ni reconciliación automática de un
resultado desconocido; esas operaciones requieren un circuito explícito.

## Cómo probar desde la aplicación

Entrar como administrador general en
`http://localhost:8091/fiscal-lab`. Debajo del cálculo de venta aparece
**Conciliación financiera · Simulación Beta**, con componentes shadcn.

Hay ocho escenarios fijos: crédito, débito, modificación RC, baja, CDR no
verificado, rechazo, duplicado y versión antigua. El endpoint protegido
`POST /api/v1/fiscal-rules/financial-ledger-preview` acepta únicamente el nombre
del escenario: no recibe RUC, documentos reales, contraseñas ni evidencias.
Responde con `private, no-store` y cero escrituras fiscales.

El panel distingue importe original, versión financiera, neto simulado y capacidad
restante; mantiene visible que las evidencias son ficticias. No crea ventas,
notas, lotes, firmas o correos y no cambia el estado de los comprobantes emitidos.

## Verificación y gate

El overlay QA desactiva `FACTUEZ_DEMO_SEED` en Billing: el QA ya está inicializado
y actualizar el servicio no debe volver a ejecutar bootstrap de emisores o series.
Esto no elimina datos existentes ni modifica configuraciones fiscales.

Regresión integrada final del 03/10: **1.683 pruebas PASS en 53 suites, sin omisiones**;
**15 tareas TypeScript PASS**. Incluye 127 casos del reductor financiero, 90 del
repositorio Billing y contratos, gates, consumidor, routing y panel sintético.
Es evidencia de los casos cubiertos, no certificación SUNAT ni E2E PostgreSQL.

Despliegue QA del 03/10:

- Imágenes Billing, SUNAT y PWA construidas correctamente; sólo esos tres
  servicios actualizados con los tres overlays, `--no-deps --no-build --pull never`.
- Once contenedores saludables; red QA sigue `internal=true`.
- Auditoría por Kong: 16 comprobaciones PASS, incluidos los ocho escenarios,
  autorización, `no-store`, rechazo de datos reales/producción y guards de detalle.
- Billing: `FACTUEZ_DEMO_SEED=false`, `SUNAT_ENVIRONMENT=BETA` y gate del
  productor comprobado cerrado en la imagen desplegada.
- SUNAT: entorno BETA, workflow/transmisión oficiales `false`; guard oficial
  comprobado cerrado en la imagen desplegada.
- Cero consultas a credenciales SUNAT, firmas con clave real, solicitudes
  oficiales, OAuth o SMTP externo durante esta verificación. Sólo login demo
  normal y previews; ninguna nueva venta, reserva fiscal o migración.

Comandos de regresión:

```powershell
pnpm test:supplement-command
pnpm test:financial-ledger
pnpm exec vitest run --maxWorkers=2
pnpm typecheck
node tests/fiscal-lab.runtime.audit.mjs --existing-qa-only
```

La auditoría runtime sólo usa el QA existente: login de demostración, previews
sintéticos y rutas que rechazan antes de consultar documentos. El login escribe
su sesión normal, no datos fiscales. No inspecciona credenciales SUNAT.

**No cierra la etapa 2 fiscal oficial.** Siguen pendientes la proyección financiera
persistida de evidencia auténtica, el circuito integrado autorizado de notas y
lotes, confianza CDR oficial y perfiles fiscales no implementados. El piloto 01
anterior ya consumido no se repite y sigue `CDR_UNVERIFIED`. No se necesita otra
clave para ejecutar estas pruebas locales; habilitar un piloto externo es una
decisión separada con alcance concreto.

La etapa 3 conserva su [dry-run histórico](ETAPA3_PREPARACION_HISTORICOS.md).
No se leen ni importan históricos de RestoApp y no se autoriza un corte fiscal
porque pase este laboratorio.
