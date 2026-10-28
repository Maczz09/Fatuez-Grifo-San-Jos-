# B2B-06 — Notas de venta y solicitudes de corrección

Fecha inicial: 20/10/2026. Actualización: 21/10/2026.
**Implementación técnica candidata completada para NV/conversión y el perfil
individual F07/F08 BETA**: [productor y journal dinámico V2](B2B_FASE6_PRODUCTOR_Y_JOURNAL_V2.md).
No desplegada, sin ejecución fiscal oficial de NC/ND/bajas.
No confundir con las etapas fiscales históricas 2/3.

El contenido siguiente documenta el agregado comercial/intenciones original.
Sus bloqueos fiscales se conservan. El productor nuevo es independiente: no
convierte un `readiness` ilustrativo en permiso ni publica el laboratorio.
Contrato vigente: 55 operaciones candidatas. Resultados: [verificación final](B2B_VERIFICACION_2026-10-21.md).

## Implementado

- Agregado comercial separado de `Document`: crear, consultar, listar, editar,
  completar, cancelar y convertir una nota de venta. Tipo comercial `NV`,
  `fiscal=false`; no representa una boleta ni acredita venta aceptada por SUNAT.
- Numeración propia `NV-00000001`, por empresa/punto, en `B2bSalesNoteCounter`.
  No reutiliza `SeriesCounter`. La cancelación conserva el historial y no libera
  números. Una operación que no confirma revierte también el contador comercial.
- Revisión fuerte `If-Match: "vN"`, clave estable `Idempotency-Key`, hash canónico
  del comando y auditoría persistente. Origen único por cliente/RUC/tipo de
  recurso/referencia externa, incluso entre usuarios distintos de ese cliente.
- El cierre congela cabecera, cliente e ítems con SHA-256. Después del cierre no
  se puede editar. Después de convertir no se puede cancelar ni volver a convertir.
- Conversión 1:1 atómica al motor LOCAL/BETA 01/03 existente: borrador interno,
  documento/ítems, contador fiscal, idempotencia, ambos diarios B2B, enlace y
  operación comercial se confirman o revierten juntos. No hay transacción anidada.
- Actor SERVICE genuino sin UUID humano inventado; actor USER con vínculo local.
  Permisos y tupla completa RUC/sede/punto/serie comprobados por Identity y Billing,
  nuevamente antes de confirmar. Revocación detectada antes del commit revierte
  todos los efectos; no se promete atomicidad distribuida con Identity.
- Registro de **intenciones** de NC, ND o baja, consultable/cancelable, contra un
  comprobante 01/03 local propio. Captura referencia, hash del snapshot, motivo e
  importe propuesto. No modifica el documento original ni contabiliza efectos.
- Evaluación propietaria de preparación: referencias, moneda e importes locales
  exactos; informa inconsistencias sin inventar evidencia o saldo fiscal disponible.
- Swagger candidato: 13 acciones comerciales nuevas, 52 acciones B2B en total.
  No se añaden rutas ficticias de emisión NC/ND ni se publica el laboratorio.

## API y permisos

Todas las rutas son candidatas bajo `/b2b/v1`, con HTTPS/mTLS + Bearer B2B,
`issuerId` y `environment=BETA` obligatorios en la consulta. Nunca reciben RUC,
actor, número fiscal, certificado, CDR confiable o permisos como autoridad del
cliente. Los identificadores provienen del catálogo autorizado, no de etiquetas.

| Acción | Ruta | Scope específico |
| --- | --- | --- |
| Listar/crear | `GET/POST /sales-notes` | `b2b:sales-notes:read/write` |
| Consultar/editar | `GET/PATCH /sales-notes/{id}` | `b2b:sales-notes:read/write` |
| Completar/cancelar | `POST /sales-notes/{id}/complete` o `/cancel` | `b2b:sales-notes:write` |
| Convertir | `POST /sales-notes/{id}/convert` | `b2b:sales-notes:write` + `b2b:documents:issue` |
| Listar/crear solicitudes | `GET/POST /correction-requests` | `b2b:corrections:read/write` + `b2b:documents:read` |
| Consultar/cancelar solicitud | `GET /correction-requests/{id}`, `POST .../{id}/cancel` | Lectura/escritura de correcciones + documentos |
| Evaluar preparación local | `GET /correction-requests/{id}/readiness` | `b2b:corrections:read` + `b2b:documents:read` |
| Recuperar operación | `GET /commercial-operations/{id}` | `b2b:operations:read` + lectura del recurso correspondiente |

La política predeterminada de Identity permanece en contexto/catálogo. Añadir
vocabulario de scopes no otorga grants ni activa funcionalidades del cliente.
USER necesita `document.view` para estos recursos y también `document.issue`
para escribir. SERVICE sólo recibe scopes/tuplas concedidos explícitamente.

Crear una nota recibe `{ "conversion": <DraftCreate existente> }`: la tupla
01/03 expresa el **destino previsto**, no el tipo fiscal de la nota de venta.
El perfil soporta contado, PEN/USD, afectación 10 e IGV 18%; otros perfiles se
rechazan, no se convierten silenciosamente. PATCH admite sólo cliente, ítems y
fecha. Completar, convertir y cancelar reciben `{}` más revisión/clave.

Alta devuelve 201 (200 al recuperar la misma alta). Convertir devuelve 202
**después del commit local**, no aceptación SUNAT. Conservar la misma clave,
cuerpo y revisión originales al reintentar tras perder la respuesta. Una nueva
clave sobre una nota convertida no produce otro comprobante. `X-Operation-Id`
permite consultar el resultado; si también se pierde ese encabezado, repetir
exactamente el comando recupera su respuesta y encabezados.

Listados limitados a 100, filtrados por tupla antes del límite, con `after` por
UUID. Son recorridos vivos `LIVE_KEYSET_NOT_A_SNAPSHOT`, **no** cortes históricos
consistentes; para extracción fiscal consistente se utiliza el circuito B2B-03.

## Correcciones: límite intencional y explícito

La solicitud admite `originalDocumentId`, tipo `CREDIT_NOTE`/`DEBIT_NOTE`/`VOID`,
motivo y referencia externa. NC/ND requieren `proposedAmount` decimal positivo de
dos decimales; baja no lo admite. Un crédito propuesto mayor al total original se
rechaza. Eso NO verifica saldo acumulado, elegibilidad, plazos, catálogo de motivos,
CDR, firma o confianza PKI; no permite reservar crédito ni emitir después.

Su estado es `BLOCKED_FISCAL_EXECUTION`, `fiscalExecutionEnabled=false`.
Cancelar la solicitud sólo cancela la intención local, no la venta original.
El servicio no acepta `cdrVerified` u otras afirmaciones del consumidor como
evidencia. No existe ruta `/execute`, ni envoltorio empresarial de `notes-qa`.

### Evaluación de preparación, no autorización fiscal

`readiness` sólo recibe el ID de la solicitud y su contexto autorizado. Obtiene
referencia e historial del propietario; no recibe snapshots, evidencia o cálculos
del cliente. Si cambió el original desde el registro devuelve conflicto 409.
Calcula con `bigint` en céntimos, contrasta totales declarados con el snapshot,
moneda y referencia/hash del original. No publica IDs ni detalle de otras NC.

La consulta usa un único statement con ramas limitadas y `UNION` para no contar
dos veces la nota cuando existen tanto referencia JSON como relación explícita.
También detecta referencias históricas por tipo/serie/número sin target ID.
Los tres índices de lectura son candidatos, sólo aplicados en BD desechable.

Incluye conservadoramente las declaraciones locales de NC sin liberar importes
por una proyección `REJECTED`. No afirma que esas notas sean aceptadas ni que un
historial vacío o acotado sea íntegro. Si supera 100 notas o encuentra una
inconsistencia, `illustrativeRemainingAmount` es null y explica el problema.
Siempre conserva `historyCompleteness=NOT_VERIFIED`, `spendableBalance=false`,
`evidenceAuthenticityVerified=false`, `readiness=BLOCKED`. El remanente ilustrativo
**no es un saldo utilizable**. No consulta XML/CDR, no prueba su firma/confianza,
no reemplaza el ledger, no reserva importes y no habilita transmisión.

Permanecen intactos `assertBillingSupplementActivation()` y
`assertFinancialLedgerCandidateActivation()`. Para cerrar la parte fiscal de
B2B-06 falta integrar y probar en conjunto:

1. El resolvedor propietario individual/RC/paquete y de resultados tiene
   composición y [puente privado candidato](B2B_FASE6_PUENTE_PRIVADO_EVIDENCIA.md);
   falta integrarlo con el productor empresarial y extender autoridad de lotes
   e historial cruzado. Una proyección `ACCEPTED` no es evidencia.
2. [Reserva/retención financiera atómica](B2B_FASE6_RESERVAS_FINANCIERAS.md) ya
   implementada y ensayada con evidencia/autoridad por ports sintéticos; también
   existen commits financieros verificados candidatos. Faltan reservas dinámicas
   y composición empresarial entre propietarios. No es un ledger oficial.
3. Productor empresarial NC/ND/baja, reautorización, transporte y recuperación de
   resultados ambiguos. No se implementa esto eliminando los bloqueos existentes.

Continuación 21/10: [autoridad de series NC/ND](B2B_FASE6_AUTORIZACION_SERIES_NOTAS.md)
implementada y ensayada como componente candidato: pares explícitos, revisiones,
step-up, auditoría y permisos SERVICE/USER. Falta componerla con evidencia y reserva
del propietario; no concede emisión al registrar una solicitud comercial.

[Resolvedor individual propietario](B2B_FASE6_EVIDENCIA_DOCUMENTO_PROPIETARIO.md):
implementada su composición candidata de sólo lectura para 01/F07/F08, con
firmas/XML/CDR y relectura. No implica historia financiera completa ni paquete
de despacho acreditado; falta composición con RC, reservas y productor.

[Composición actual y resultados de pruebas](B2B_FASE6_COMPOSICION_Y_RESULTADOS.md):
detalla lo implementado y separa los pendientes de código del piloto/despliegue.
No se declara cerrada B2B-06 ni habilitada B2B-07 por entregar estas solicitudes.
Estos pendientes son de integración técnica, no se resuelven sólo con documentos.

## Ensamblaje y despliegue

Código propietario: `services/billing-service/src/b2b/commercial*.ts`.
Fachada: `services/b2b-api-service/src/commercial.ts`. RPC privado fijo
`POST /internal/b2b/commercial`, sólo peer mTLS autorizado.

`B2bCommercialOwnerModule.isolated(...)` y el argumento opcional `commercial` de
`createB2bDraftApplication(...)` permiten ensamblarlo explícitamente. La conversión
requiere tanto bandera configurada como port emisor del propietario vinculado a
la misma transacción, perfil `BETA_01_03_TAXABLE18_V1` y allowlist RUC explícita.
Sin ello falla cerrado antes de consumir numeración fiscal.

DDL `services/billing-service/b2b-commercial-schema.candidate.sql`: tres tablas
aditivas y tres índices de lectura candidatos, **no es una migración aplicada**. Depende del esquema Billing
y de los candidatos de borradores/emisión. No se instala automáticamente ni se
ha aplicado a QA. No se deben ejecutar `db push`, Compose general ni migradores
para habilitarlo incidentalmente. Requiere revisión de despliegue y permisos.

El evento de una conversión confirmada es el existente
`document.issued-locally.v1`, con su diario de fan-out independiente. No publica
la nota comercial como aceptación fiscal, no lee certificados ni envía a SUNAT,
correo o callbacks reales. No modifica `OutboxEvent.publishedAt`.

El Swagger activo de localhost:8091 permanece sin estas rutas mientras no se
apruebe y ejecute el rollout. Contrato verificable en
[OpenAPI candidato](b2b/openapi.candidate.v1.json).

## Verificación reproducible

- `pnpm test:b2b-commercial`: reglas, replay, permisos, aislamiento de actores,
  integridad de snapshots, contratos y recorrido real HTTPS/mTLS con PKI efímera.
- `pnpm test:b2b-commercial:db`: PostgreSQL real NUEVO en tmpfs, sin red/puertos,
  datos sintéticos y motor Billing/Prisma reales; 11 grupos de comprobaciones.
- Confirma concurrencia, rollback tras emisión/fallo de commit/revocación,
  recuperación después de reinicio, unicidad de origen, cancelación, factura y
  boleta, original intacto y cero escritura en el ledger financiero.
- Detección adicional del error real Prisma pg `P2010 / UniqueConstraintViolation`:
  devuelve conflicto 409 sin filtrar mensajes SQL, no un error genérico engañoso.
- La evaluación se probó con NC local declarada/rechazada, doble vínculo sin doble
  conteo, referencia histórica por número y cambio de hash, sin efectos nuevos.
- Los contenedores temporales etiquetados se retiraron al terminar cada ensayo.

Resultados finales de regresión y tipos en
[verificación B2B](B2B_VERIFICACION_2026-10-20.md).
