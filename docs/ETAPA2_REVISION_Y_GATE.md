# Revisión de etapa 2 y criterio de avance

Revisión y reparación local: 02/10/2026. Instalación: `factuez-stage2-qa`, `http://localhost:8091`.

## Decisión

Desarrollo posterior: [primer incremento de etapa 4](ETAPA4_MODO_SOMBRA_LOCAL.md).
Comparación y clasificación offline con fixtures ficticios, sin emisión,
correlativos, datos reales o despliegue. No cierra la etapa 2 fiscal ni acredita
migración real de etapa 3; verificación actual documentada allí.

Incremento anterior: [consulta protegida y conciliación de etapa 3](ETAPA3_CONSULTA_Y_CONCILIACION.md).
API candidata de sólo lectura, identidad RS256/revalidación y reportes exactos
ensayados con autoridad ficticia y PostgreSQL nuevo. Regresión de ese incremento: **2.212
pruebas/66 suites PASS, ninguna omitida; 18 tareas TypeScript y 24 checks E2E
PASS**. Sin nuevos despliegues, datos reales ni envíos. **No cierra etapa 2 fiscal
ni habilita importación/corte real de etapa 3.**

Incremento anterior de etapa 3: [persistencia y restauración aisladas](ETAPA3_PERSISTENCIA_Y_RESTAURACION.md).
Adaptador propio y snapshots completos ensayados sólo con PostgreSQL nuevo y
datos sintéticos; 18 checks de persistencia/restauración PASS. Regresión de ese incremento:
2.112 pruebas/63 suites, ninguna omitida con XSD offline; 18 tareas TypeScript
PASS. No se desplegó ni accedió a bases activas. **No cierra etapa 2 fiscal,
no acredita confianza CDR ni habilita importación/corte real.**

Solicitud posterior del 03/10: avanzar con desarrollo de etapa 3 en paralelo.
[Integridad de bundle y ensayo histórico](ETAPA3_BUNDLE_Y_ENSAYO.md) añadidos
sin BD, migradores, datos del cliente ni red. No cierra etapa 2 fiscal ni
habilita importación/corte. La preparación técnica ya puede continuar.
Regresión con ese incremento: 1.993 pruebas/59 suites PASS, ninguna omitida
con runtime XSD offline; 15 tareas TypeScript aprobadas. No hubo nuevo piloto.

Último incremento fiscal del 03/10: [persistencia financiera candidata](ETAPA2_PERSISTENCIA_CANDIDATA.md).
Contrato, repositorio, schema Prisma y blueprint SQL preparados; SQL no aplicado
y servicio cerrado antes de la BD. No acredita proyección fiscal persistida.
Regresión de ese incremento de etapa 2: 1.847 pruebas/56 suites y 15 tareas TypeScript PASS.
Billing/SUNAT actualizados sin migraciones; once contenedores saludables,
16 comprobaciones por Kong PASS y login local/LAN HTTP 200. Gates cerrados.

Incremento del 03/10: [productor desacoplado y conciliación local](ETAPA2_PRODUCTOR_Y_CONCILIACION.md).
Contrato y cola Billing → SUNAT preparados con ambos guards cerrados. La PWA
añade un laboratorio financiero ficticio; no es una proyección persistida ni
una habilitación fiscal. Los conteos de este incremento se registran allí.

Seguimiento del 03/10: [consulta de notas/lotes y notificaciones](ETAPA2_SEGUIMIENTO_INTEGRADO.md).
Se prepara la [conciliación histórica de etapa 3](ETAPA3_PREPARACION_HISTORICOS.md)
como dry-run local, sin importación ni corte. No cierra el gate fiscal.

Actualización de desarrollo del 03/10/2026:
[notas, lotes, persistencia y laboratorio Beta](ETAPA2_INCREMENTO_BETA.md).
Las comprobaciones y el alcance de esa actualización prevalecen sobre los
contadores de pruebas históricos de este documento. El gate oficial continúa
cerrado; producción sigue prohibida y no hay importación/corte de etapa 3.

Incremento anterior del 02/10: [integración, pagos y transporte de notas](ETAPA2_INTEGRACION_Y_NOTAS.md).
Se implementó el staging/pipeline normal 01/03 con gate oficial cerrado,
forma de pago contado/crédito y cuotas, confianza CDR fail-closed y transporte/CDR
propios de notas exclusivamente simulados. Estos cambios no acreditan emisión
oficial ni cobertura completa de reglas. Producción permanece bloqueada.

**Los dos defectos locales identificados están corregidos y desplegados en QA.**
Se añadieron reintentos limitados para indisponibilidad XSD, recuperación por
lease/heartbeat y protección contra workers antiguos, conservando las mismas
reservas. La PWA también puede encadenar emisión y circuito SOAP/CDR simulado
para emisores ficticios. Detalle: [recuperación e integración local](ETAPA2_RECUPERACION_LOCAL.md).

**Etapa 2 fiscal no cerrada; importación/corte de etapa 3 no iniciados.** Siguen pendientes funciones
del circuito fiscal oficial y reglas, descritas más abajo. Las pruebas en memoria
acreditan los casos cubiertos, no una auditoría exhaustiva ni un E2E contra la BD.

La preparación local está avanzada, pero no equivale a un circuito fiscal terminado.
Los pilotos técnicos 01 autorizados y ya consumidos están separados de Billing;
no integran automáticamente la emisión de la PWA. FQ02-1 queda `CDR_UNVERIFIED`,
según el incremento posterior enlazado arriba. Producción continúa fuera de alcance.

## Comprobaciones del incremento anterior (02/10)

| Comprobación | Resultado | Qué demuestra |
|---|---|---|
| Suite habitual `pnpm exec vitest run --maxWorkers=2` | 603 pruebas, 31 suites aprobadas | Incluye pagos, CDR sintéticos, transporte propio de notas y regresión anterior |
| `pnpm typecheck` | 15 tareas aprobadas en 11 paquetes | Comprobación de contratos, servicios y PWA |
| Auditoría criptográfica sin red | 4 combinaciones de notas aprobadas | Firmas y XSD reales sobre fixtures; sin DB/Redis/secretos montados |
| PDF de crédito ticket/A4 | Renderizados e inspeccionados | Saldo y cuotas visibles; no impresión física ni PDF fiscal |
| Auditoría aislada | 77 pruebas, 5 suites aprobadas | Sustituye el diagnóstico inicial por criterios positivos de reparación |
| Build Docker SUNAT / Billing / PWA | Aprobado, incluido Next.js | Paquetes internos compilados antes de la PWA |
| Runtime QA | 11 contenedores saludables | Se actualizaron SUNAT, emulador, Billing y PWA con `--no-deps`; sin migraciones |
| Login por Kong / salud interna SUNAT | HTTP 200 desde el servidor | Login local/LAN y salud interna; no acceso de otra PC ni impresión física |
| Nueva ruta workflow sin sesión | HTTP 401 por Kong | Guard rechaza antes de crear o firmar documentos |
| Nueva ruta de transporte de notas sin sesión | HTTP 401 por Kong | Identidad requerida antes de consultar la nota o reservar transporte |
| Red Docker | `internal=true` | Se conserva aislamiento del QA |
| Configuración de despliegue | Transmisión y workflow Beta oficiales deshabilitados | Guard de activación comprobado cerrado desde el runtime |

El alcance de esta revisión es acotado, no una auditoría exhaustiva. No se
ejecutaron E2E que crean emisores/documentos ni se releyeron secretos reales.
No hubo nuevos envíos SUNAT, OAuth, correo real, nuevas ventas de prueba ni
cambios manuales de correlativos. No se usó el certificado real del usuario.

## Diagnóstico inicial y reparaciones

La descripción siguiente registra el comportamiento anterior a la reparación;
no representa el estado actual del código desplegado.

### E2 B01 Error temporal XSD convertido en bloqueo permanente

El validador devuelve `ServiceUnavailableException` si está ocupado. Notas 07/08
convierten cualquier excepción del proceso en `BLOCKED`; su despachador sólo
recoge `QUEUED`. RC/RA también transforman el fallo de preparación en `BLOCKED`.
Repetir la misma solicitud devuelve la reserva detenida, no recupera la preparación.

Se reprodujo con dobles en memoria: una nota 07 y un lote RC válidos alcanzaron
XSD; éste rechazó una vez por ocupación. Tras quedar disponible, repetir el proceso
o la clave idempotente no firmó/preparó de nuevo ni produjo artefactos. No hubo envío.
La nota de crédito conserva su reserva sobre el original: crear otra no es una
solución segura y tampoco debe liberar/reutilizar su numeración automáticamente.

Código: `services/sunat-service/src/application/notes-qa.service.ts` (`process`),
`notes-qa.repository.ts` (`claim`, `pending`, `reserve`),
`fiscal-batch-qa.service.ts` (`start`) y
`infrastructure/sunat/xsd-validation.service.ts` (`validate`).

Criterio cumplido con pruebas: distinguir indisponibilidad temporal de XML/contexto
inválido; recuperar la **misma** reserva con reintentos acotados y backoff durable.
No volver a enviar un POST cuyo resultado sea desconocido. Mantener los bloqueos
por integridad, revisión de certificado, autorización o perfil fiscal incorrectos.

Estado actual: error temporal explícito, máximo 3 intentos, backoff y misma
reserva. XML/contexto inválido sigue bloqueado. Los históricos ya `BLOCKED`
no se reactivan automáticamente ni liberan crédito/numeración.

### E2 B02 Expiración de lote basada en fecha de creación

El despachador marca `BUILDING` como `BLOCKED` cuando `createdAt` supera 60 segundos,
sin comprobar si sigue activo el claim de preparación. La revalidación secuencial
de hasta 50 miembros puede alargar ese paso. La transición posterior a `QUEUED`
no comprueba el número de filas afectadas, por lo que no recupera la carrera.

Se reprodujo el despachador real con un lote ficticio en memoria: `createdAt`
de 90 segundos y `claimedAt` vigente. Lo convirtió en `BLOCKED` y no lo encoló.
No se ejecutó una carga de 50 documentos reales ni se alteró un lote guardado.

Código: `services/sunat-service/src/application/fiscal-batch-qa.service.ts`
(`dispatch`, claim y transición al final de `start`).

Criterio cumplido con pruebas: lease/heartbeat de preparación con propietario y
transiciones compare-and-set verificadas; recuperar interrupciones reales sin
interrumpir trabajo activo. Cubrir preparación lenta, concurrencia y muerte de
worker. Conservar numeración/reservas, snapshots e incertidumbre de transporte.

Estado actual: recuperación basada en lease vencido, no en `createdAt`.
Un test de 50 miembros y 70 segundos de preparación simulada conserva el
trabajo activo; otro verifica que un worker cuyo claim fue reemplazado no pueda
publicar ni bloquear el trabajo del nuevo propietario.

### Pruebas de aceptación aisladas

```powershell
pnpm exec vitest run --config tests/etapa2-audit.config.mts
```

La configuración ahora selecciona `batch-recovery`, `notes-recovery`,
`local-preparation-policy`, `circuit-recovery` y `local-emission-workflow`.
Estas suites también forman parte de la regresión habitual. Se retiró únicamente
el archivo diagnóstico creado durante la auditoría, `stage2-blockers.audit.ts`,
reemplazado por estos criterios positivos. No inicia servicios ni usa Prisma/Redis
reales, PFX del usuario o red. Un resultado verde tampoco acredita SUNAT oficial.

## Implementación fiscal que todavía falta

Estos puntos no se resuelven sólo cargando datos o credenciales del cliente:

- Vertical normal 01/03: reserva idempotente y pipeline de firma/ZIP/XSD/
  SOAP/ticket/CDR/proyección implementados con puertos, pero el wiring real
  conserva el gate de activación cerrado. Falta piloto integrado aprobado y
  evidencia de confianza para CDR reales; no basta encender un flag.
- Notas 07/08: firma/XSD/PDF y transporte/CDR propios del emulador ya
  implementados. Transporte oficial y motivos adicionales pendientes.
  RC/RA: emulador local, sin RC modificación ni cierre fiscal.
- Reglas: perfil parcial oneroso IGV 18%, no automatización completa del conjunto
  publicado. Contado/crédito/cuotas de 01 están implementados; crédito 03,
  corrección de cuotas en notas, anticipos, descuentos, detracciones/ISC y otros
  perfiles siguen pendientes y se rechazan, no se descartan silenciosamente.
- Conciliación fiscal de resultado desconocido, confianza de CDR reales y cambios
  fiscales de ventas requieren integración/evidencia adicionales. Hay verificador
  criptográfico y contrato de estados finales con evidencia, no PKI homologada.
- GRE 09 es preparación QA de mercancía no regulada y motivo 04; no resuelve
  traslado real de combustible ni GRE 31. SMTP corporativo sólo tiene preparación;
  el correo comprobado es el capturador local, no entrega a clientes.

Fuentes en código: `application/document-issued.consumer.ts`,
`application/fiscal-readiness.service.ts`, `application/notes-qa.service.ts`,
`application/gre-qa.service.ts` y `packages/sunat-core/src/fiscal-rules.ts`.
El [Word de requerimientos](<C:/Users/maxmo/Downloads/Requerimiento a Mavric – Facturador.docx>)
también pide recibidos con detalle XML, ERP/Wayne y documentos adicionales.
No están acreditados por etapa 2 ni se deben presentar como ya implementados.
Se revisó su contenido en modo lectura; no se modificó el documento.

## Piloto Beta y pendientes de habilitación

RUC autorizado: **20615878481**, BETA únicamente. Evidencia existente:
`tmp/beta-pilot/20615878481-20261002/review.json`.
Una solicitud original, cero reenvíos durante esta revisión, código CDR **0**,
`ACCEPTED_WITH_OBSERVATIONS`, observación **4252** sobre `InvoiceTypeCode/listName`.
Se conservan XML firmado, ZIP y observación originales; no se reescribió el piloto.
Estructura/vínculo CDR verificados; confianza de firma CDR no verificada.

Esto demuestra recepción de **ese fixture técnico** por Beta, no homologación,
emisión automática desde la PWA, confianza PKI completa ni autorización de producción.
La autorización de una única factura ya se consumió. Otro envío, incluso Beta,
necesita nuevo alcance y aprobación. Ver [piloto y límites](PILOTO_BETA_DESARROLLO.md).

Cadena/revocación del certificado, datos y establecimientos del cliente, aceptación
por perfil, impresión física, TLS/PWA de intranet, restauración y corte histórico
siguen siendo gates futuros. No impidieron corregir los dos defectos locales.
La ausencia de OAuth GRE tampoco bloquea el desarrollo de 01/03/07/08.

## Orden para volver a evaluar el avance

1. E2 B01 y E2 B02 corregidos; conservar las nuevas pruebas de regresión.
2. Flujo QA integrado probado con dobles y desplegado; queda ensayo operativo
   de emisión/impresión desde una terminal, sin confundirlo con piloto oficial.
3. Evaluar y declarar explícitamente el alcance de cierre: QA local frente a
   circuito fiscal Beta; no convertir un guard desactivado en permiso de emisión.
4. Por autorización posterior, desarrollar la preparación de etapa 3 en
   paralelo, con criterios y límites escritos. La importación/corte real sigue
   requiriendo su gate y autorización separada. La fase 3 descrita en
   `MIGRACION_RESTOAPP_A_FACTUEZ.md` no autoriza por sí sola importar datos,
   ejecutar migradores o cambiar correlativos.

**Desarrollo de etapa 3 iniciado; importación/corte no iniciados.** Se preservaron microservicios, Kong, acceso intranet,
datos guardados y los bloqueos de producción. No faltan nuevas credenciales del
cliente para continuar implementación local. El certificado ya cargado no se
utilizó en esta reparación ni autoriza nuevos envíos Beta por sí solo.
