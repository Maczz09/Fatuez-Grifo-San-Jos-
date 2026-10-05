# Etapa 2 - Preparación para pruebas locales

Actualizado: 02/10/2026. URL: **http://localhost:8091**.

La versión conserva microservicios NestJS, bases propias, PWA con shadcn y
Kong. Está preparada para desarrollar y probar sin información del cliente.
**No está terminada la etapa fiscal oficial ni la cobertura de todas las reglas
SUNAT.** Hay pendientes de implementación, además de datos/credenciales/piloto.
No bastará cargar un certificado o cambiar una variable para emitir legalmente.

Revisión de salida actual: [bloqueos y decisión de avance](ETAPA2_REVISION_Y_GATE.md).
Los bloqueos locales XSD/preparación de lotes están corregidos y desplegados:
[recuperación y flujo QA desde la PWA](ETAPA2_RECUPERACION_LOCAL.md).
Etapa fiscal 2 no cerrada ni etapa 3 iniciada: sigue pendiente la vertical oficial.

Nuevo incremento: [pagos, integración preparada y notas con CDR propio](ETAPA2_INTEGRACION_Y_NOTAS.md).
Pipeline 01/03 implementado con gate oficial cerrado, contado/crédito/cuotas,
CDR firmado fail-closed y transporte de notas sólo al emulador. No es habilitación fiscal.

Seguimiento del emisor de desarrollo: [Piloto Beta](PILOTO_BETA_DESARROLLO.md).
Alcance actual: RUC 20615878481, sólo BETA. Hubo una factura técnica externa
aceptada con observación 4252, firmada con autorización específica; no es una
venta ni el circuito automático de la PWA. El runtime QA conserva transporte
oficial deshabilitado. Regresión actual: 603 pruebas en 31 suites y 15 tareas
TypeScript aprobadas. Los 235 tests citados más abajo son evidencia histórica.

## Alcance que se puede probar

| Módulo | Disponible localmente | Límite explícito |
|---|---|---|
| Comprobantes | Lista, Ver detalles, snapshot, ítems/importes, descargas | No aceptación fiscal ni modificación de históricos |
| Factura 01 / boleta 03 | Firma XML, ZIP, XSD, SOAP interno y CDR simulado | Perfil oneroso IGV 18%; no SUNAT real |
| Resúmenes y bajas | RC alta/baja múltiple y RA; selección, motivos, ticket, XSD | 1-50 documentos ficticios, mismo RUC/fecha Lima/PEN; no RC modificación |
| Notas 07 / 08 | Referencia, firma/XSD, PDF, transporte SOAP interno y CDR propio | Motivos 07: 01/06/07; motivo 08: 02; resultado simulado, no fiscal |
| Pago 01 | Contado/crédito, saldo y cuotas en snapshot/XML/PDF | Boleta a crédito y notas de corrección de cuotas bloqueadas |
| GRE 09 | Origen/destino, transportista/conductor, peso, ítems, firma/XSD/PDF | Motivo 04, mismo RUC, catálogo ubigeo QA acotado, mercancía no regulada; no autoriza traslado |
| Impresión | Botones ticket 80 mm / A4 con sesión y PDF privado | Cualquier marca con driver/papel compatible; prueba física pendiente |
| Correo | Worker, paquetes verificables, Mailpit y dos adjuntos | Sólo dominio .invalid; capturado no significa entregado |
| Correo corporativo | Pantalla, configuración cifrada por RUC, revisión y auditoría | Diagnóstico sin red; envío/verify corporativo deshabilitado |
| Tiempo real | Microservicio Socket.io por Kong, revalidación de acceso y REST respaldo | Best-effort, sin datos de cliente/importes en eventos |
| Reglas y PKI | Informe de preparación por RUC/ambiente, bloqueos visibles | Cobertura parcial; confianza, registro y piloto reales pendientes |

Los laboratorios QA de esta tabla usan únicamente certificados/credenciales
ficticios; no se confunden con el piloto externo separado descrito arriba.
Los identificadores `00` + nueve dígitos son ficticios: XML requiere
once dígitos, aunque el usuario no haya proporcionado un RUC. Sedes/emisores son
configurables, no existe un límite fijo de 21+1 ni un RUC compartido obligatorio.

## Pantallas

- **Comprobantes emitidos**: número/cliente, RUC, sede, fecha Lima, importe,
  estado y **Ver detalles**. En la ficha están representaciones, laboratorio,
  resultado simulado, correo local, conexión y líneas/totales.
- **Resúmenes y bajas** (`/batches`): tipo RC/RA, escenario, selección paginada,
  motivos/declaración RA y lista con resultado/ticket/XML/ZIP/CDR simulado.
- **Notas de crédito/débito** (`/notes`): elegir original, luego tipo, motivo,
  sustento y líneas del ajuste. Sólo original con CDR individual aceptado del
  emulador. Una reserva de crédito por original, incluso bloqueada; sin reciclaje
  ni liberación automática de saldo. Débito representa el importe adicional,
  no un nuevo precio total. Máximo 20 notas por referencia.
- **Guías de remisión** (`/guides`): formulario de traslado de prueba, lista,
  archivos y simulación READY/REJECTED/UNCERTAIN. READY no equivale a aceptación.
  El QR de GRE es técnico QA, no el formato normativo oficial.
- **Correo corporativo** (`/mail-settings`): preparación por emisor, sin
  passwords devueltos por GET y sin contactar un servidor SMTP.
- **Configuración SUNAT** (`/sunat-settings`): certificado/SOL/OAuth protegidos
  y panel **Preparación fiscal**. Muestra reglas, cadena, revocación y pendientes.
- **Terminal de pista** (`/pos`): botón **Emitir y ejecutar circuito QA**, sólo
  ADMIN GLOBAL/emisor ficticio BETA. Firma ficticia, SOAP interno y CDR simulado;
  no habilita la vertical fiscal oficial ni usa el certificado real cargado.

Los nuevos laboratorios requieren ADMIN GLOBAL y permisos vigentes; no amplían
atribuciones del cajero. APIs verifican Identity y alcance en Billing. UI no es
la frontera de autorización. Descargas tampoco usan enlaces públicos ni JWT en URL.

## Microservicios y garantías

PWA -> Kong -> API del servicio propietario. Billing conserva ventas/snapshots;
SUNAT guarda pruebas criptográficas, notas, guías y lotes; Mailer conserva su
configuración/cola/paquetes; Realtime sólo revalida APIs y publica avisos.
No se añadieron lecturas Prisma entre bases ajenas ni lógica en el gateway.

Lotes: firma exacta, XSD antes del envío, ZIP de una entrada idéntica al XML,
claim atómico y registro durable en PostgreSQL. BullMQ es ejecución, no fuente
de verdad. Un POST no confirmado termina UNKNOWN, reserva conservada, sin
reenvío ciego. El mismo ticket se consulta con backoff acotado. CDR simulado
vinculado al lote no convierte sus ventas en aceptadas/anuladas oficialmente.
Los registros históricos con contexto/certificado inconsistente no bloquean el
listado de lotes vigentes; se contabilizan como unavailableCount, conservados en BD.

Notas: UBL CreditNote/DebitNote reales de prueba, no Invoice renombrado.
La firma se verifica contra certificado externo y raíz original. Firma/XSD no
acreditan validez fiscal. Cambio de revisión bloquea descarga; nunca resuelve
rechazos creando otro correlativo fiscal automáticamente.

GRE: DespatchAdvice firmado y validado, no factura disfrazada. API REST oficial
OAuth preparada como adaptador separado, **no registrada en las rutas QA**.
URLs fijas, límites, timeout, TLS y no reintento automático de POST incierto.
Ruta QA se deshabilita si se intenta combinarla con flags de transmisión externa.
Mercancías reguladas/combustibles reales necesitan reglas y datos adicionales;
marcar la casilla de prueba no autoriza transportarlas.

Los PDF de todos estos perfiles conservan San José arriba y FactuEz/Mavric
juntos, con `Desarrollado e implementado por www.mavrictec.com`; sin nombre
personal ni texto de colaboración. Ticket 80 mm y A4; no ESC/POS directo, no
impresión silenciosa ni plantilla nativa 58 mm. QR/hash coinciden con XML local.

## Reglas fiscales y confianza: preparado no significa completo

Fuente oficial archivada sin alterar:
`services/sunat-service/assets/sunat/reglas-20260826.xlsx`, 855113 bytes,
SHA-256 `cb5e871cfe3b81abea7faf25b156e5d35b21e8c4837979350919926612da73b6`.
El archivo **no se ha convertido íntegramente en reglas ejecutables**.

Perfil `FACTUEZ-01-03-IGV18-20260826-v2`: cantidades/importes decimales
consistentes, calendario/reloj, identidad, moneda/operación, unidades admitidas,
identificación de boleta sobre el umbral de perfil e IGV 18%. Exoneración,
inafectación, gratuito/exportación, ISC, percepción, detracción, crédito/cuotas
y otros casos no automatizados fallan cerrados; no se omiten impuestos para
aparentar éxito. `coverageComplete=false` y `transmissionAuthorized=false`.

XSD: ZIP oficial 28/02/2022 fijado por SHA-256, validación libxml sin red;
Invoice/CreditNote/DebitNote/DespatchAdvice 2.1 y Summary/Voided 2.0.
Evidencia ligada al XML concreto. No se inventa evidencia en registros antiguos.

PKI: inspector de par PKCS#12 y huella; RUC exacto en atributo de identidad,
cadena offline estricta hasta CA explícitas fijadas por SHA-256 y CRL
firmada/vigente. Autofirmado del emisor no confiable, CRL ausente bloquea
activación. Sólo materiales públicos en archivos temporales; no PFX/clave.
No descarga AIA/OCSP ni usa indiscriminadamente raíces del sistema.

Materiales futuros de despliegue, no secretos a enviar por chat:

```text
SUNAT_TRUST_STORE_FILE     ruta absoluta PEM de CA aprobadas, montaje readonly
SUNAT_TRUST_STORE_SHA256   SHA-256 exacto del PEM
SUNAT_CRL_BUNDLE_FILE      ruta absoluta PEM de CRL verificables/vigentes
SUNAT_CRL_BUNDLE_SHA256    SHA-256 exacto del bundle
SUNAT_OPENSSL_PATH        ejecutable absoluto (Docker: /usr/bin/openssl)
```

El diagnóstico no autentica SOL, consulta padrones ni prueba registro SEE o
certificado en SUNAT. `readyForOfficialBeta`, `readyForProduction` y
`activationImplemented` permanecen false; la activación oficial falla cerrada.

SMTP: AES-256-GCM, AAD por RUC/revisión/versión y keyfile de despliegue.
`SMTP_APPROVED_HOSTS` es allowlist administrada por infraestructura, vacía en QA.
Fuera de QA se exige keyfile dedicado con 32 bytes hex y permisos privados;
`SMTP_QA_USE_APP_KEY=true` sólo admite reutilizar la clave montada de la demo
en el entorno QA explícito. No reutilizar esta excepción para producción.
TLS obligatorio, sin URLs/credenciales en hostname, sin TLS inseguro, controles
CRLF, concurrencia por revisión y secretos reemplazables/auditados por RUC.
Diagnóstico no construye conexiones; transporte corporativo rechaza verify/send
incluso si se intenta habilitar por configuración. Falta integrar entrega oficial.

## Despliegue QA existente: actualización segura

Proyecto **factuez-stage2-qa**, puerto 8091, once servicios y red interna.
La demo 8080, RestoApp y otros proyectos Docker quedan fuera de esta actualización.
No ejecutar un `compose up` general sobre bases existentes: el compose base
incluye migradores. No usar `db push`, reset, `down -v` ni recrear volúmenes.

Respaldos previos de este incremento:
`.factuez-demo/backups/stage2-preparation-20261002/sunat.dump` y `mailer.dump`.
Se comprobó el TOC con pg_restore; **no se ha ensayado una restauración completa**.
Proteger los dumps: contienen configuración cifrada y datos locales de prueba.

Expansiones aplicadas sólo en bases QA verificadas, sin alterar/borrar ventas:

```text
SUNAT / factuez_sunat:
  prisma/fiscal-batch-qa-expand.sql
  prisma/notes-qa-expand.sql (guard de autorización QA explícito)
  prisma/gre-qa-expand.sql
Mailer / factuez_mailer_qa:
  prisma/smtp-configuration.qa.sql
```

Ya están instaladas. No repetirlas a ciegas. En otra instalación, primero
respaldo/ensayo de restauración, comprobar BD/rol/tablas y revisar SQL aditivo.
No reemplazan una estrategia de migración de producción.

Para actualizar imágenes locales **en este QA ya inicializado**:

```powershell
$env:FACTUEZ_INTRANET_IP = '192.168.100.5'
docker build -f docker/Dockerfile.service --build-arg SERVICE_NAME=@factuez/sunat-service --build-arg SERVICE_PATH=services/sunat-service -t factuez-stage2-qa/sunat-service:local .
docker compose -p factuez-stage2-qa -f docker-compose.demo.yml -f tests/compose.stage2.qa.yml -f tests/compose.intranet.qa.yml build web-pwa mailer-worker realtime-service
docker compose -p factuez-stage2-qa -f docker-compose.demo.yml -f tests/compose.stage2.qa.yml -f tests/compose.intranet.qa.yml up -d --no-deps --no-build --pull never --wait --wait-timeout 180 sunat-service sunat-emulator web-pwa mailer-worker realtime-service
```

La IP indicada es la comprobada en este servidor; si cambia, revisar la guía
`INTRANET_QA.md` antes de recrear servicios. Conservar el tercer overlay evita
perder los orígenes WebSocket de la LAN al actualizar Realtime.

Esperar disponibilidad del gateway antes de iniciar una prueba. Sólo runtime;
no iniciar migrate-identity/migrate-billing/migrate-sunat. La nueva contraseña
inicial y claves se leen de archivos de secretos; no se imprimen en logs.

## Comprobaciones reproducibles

```powershell
pnpm typecheck
pnpm exec vitest run tests packages/sunat-core/src packages/contracts/src
pnpm test:stage2:prepared:e2e
pnpm test:print-mail-live:e2e
```

La batería local pasó **235 pruebas en 18 suites** y TypeScript de los once
paquetes. La PWA compila con las pantallas nuevas. E2E de correo local/Socket.io
aprobado: dos adjuntos, concurrencia sin duplicar, revocación y aislamiento de sede.
El E2E ampliado terminó con código 0 sobre las imágenes finales. El recorrido
nuevo comprueba lotes concurrentes, respuesta perdida, XML/ZIP/firma
independiente, XSD, notas/guías, diagnóstico y configuración real intacta.
No utiliza RUC/certificados/SOL reales ni SMTP externo.

Se descargaron y revisaron los seis PDF de notas 07/08 y guía en ticket/A4:
contenido propio, logos, ausencia de créditos personales/colaboración, medidas,
texto dentro del papel y QR decodificado independientemente con hash exacto.
Las operaciones cortas ocupan una página A4. Poppler renderizado y revisión
visual completados; no se deduce compatibilidad física de esa comprobación.
Auditoría final: once servicios QA saludables, red interna true, cero
SunatSubmission/CdrLog oficiales y ninguna cuenta qa.live activa.
Auditoría independiente del capturador tras usar el fixture nuevo: una captura,
dos adjuntos y ambos SHA-256 idénticos al manifiesto privado del worker.

La evidencia técnica de los E2E está en `tmp/stage2-prepared/proof.json` y
`tmp/print-mail-live/proof.json`, sin passwords/JWT. Son fixtures de QA, no CPE.
Ejecutar primero el E2E preparado: crea un certificado ficticio nuevo y el test
de correo reutiliza una factura aceptada localmente de ese mismo recorrido,
sin depender del vencimiento del certificado de una prueba histórica.
Se conservan registros para trazabilidad; los tests de correo desactivan sus
cuentas temporales. No ejecutar estos scripts en producción ni cambiar su URL.

Revisión independiente de PDF (Python empaquetado con pypdf/pdfplumber y,
opcionalmente, el decodificador zxing-cpp instalado previamente sólo en temporales):

```powershell
python tests/verify-prepared-pdf.py --decode-qr
pdftoppm -png tmp/pdfs/stage2-prepared/nota-07-a4.pdf tmp/pdfs/stage2-prepared/nota-07-a4
```

No se ha probado impresión física. La política del navegador integrado bloqueó
la apertura blob en una verificación anterior; no se eludió. El operador deberá
probar manualmente el PDF en su navegador/visor, papel y controlador reales.

## Lo que queda para emisión real (no bloquea desarrollar en QA)

1. Matriz completa de reglas/casos aplicables al grifo y perfiles tributarios,
   notas/motivos/ajustes acumulados, RC modificación/plazos, transporte/CDR de
   notas y restricciones de combustibles/GRE. Implementar y probar lo faltante.
2. Datos aprobados por emisor: RUC/razón/dirección/ubigeo, vínculo de sedes,
   establecimientos SUNAT, series y correlativos de corte. Sin inferirlos de QA.
3. PKCS#12 y datos reales del cliente, material de confianza/revocación y registro
   SEE/SOL. El emisor de software ya aportó certificado y completó un único piloto
   técnico 01 Beta; no cubre los demás perfiles ni sustituye al grifo. Otro envío
   requiere nueva autorización. Carga por mecanismo seguro local, nunca por chat.
4. Integrar despacho oficial, firma/confianza CDR, conciliación e idempotencia
   fiscal y proyección de estados. Piloto oficial con evidencia por cada perfil.
5. Servidor SMTP aprobado/TLS y delivery con adjuntos oficiales; prueba de red,
   credenciales/rotación, destinatarios, rebotes y entrega sin duplicados.
6. Backups/restauración, corte histórico, TLS de intranet/PWA, pruebas físicas de
   impresión, rendimiento multi-sede, operación de contingencia y aceptación.

Referencias primarias: [guías/reglas/XSD SUNAT](https://cpe.sunat.gob.pe/guias-y-manuales),
[reglas publicadas 26/08/2026](https://cpe.sunat.gob.pe/sites/default/files/2026-08/Reglas%20de%20validaci%C3%B3n%20-%20actualizado%20al%2026.08.2026.xlsx),
[SEE del contribuyente](https://cpe.sunat.gob.pe/sistema_emision/see_contribuyente).
