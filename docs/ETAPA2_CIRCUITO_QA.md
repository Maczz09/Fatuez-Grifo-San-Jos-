# Etapa 2 — Circuito SOAP/CDR de prueba integrado

Actualizado: 2 de octubre de 2026. **Incremento implementado y probado localmente;
la etapa fiscal NO está cerrada ni habilitada para producción.**

El estado ampliado actual está en [Preparación local de etapa 2](ETAPA2_PREPARACION_LOCAL.md).
Revisión de salida: [criterio de cierre y etapa 3 no iniciada](ETAPA2_REVISION_Y_GATE.md).
Incremento actual: [pagos, integración preparada y CDR propios de notas](ETAPA2_INTEGRACION_Y_NOTAS.md).
Bloqueos locales corregidos y nuevo botón en terminal:
[recuperación y emisión QA desde la PWA](ETAPA2_RECUPERACION_LOCAL.md).
Piloto autorizado posterior: una factura 01 aceptada **con observación en BETA**,
sin ventas/correlativos ni producción: [evidencia y límites](PILOTO_BETA_DESARROLLO.md).
Sesión persistente al recargar y plazo de inactividad:
[sesión web QA](SESION_WEB_QA.md).
Ya hay pantallas y flujos QA de lotes RC múltiples/bajas RA, notas 07/08,
guías 09, preparación SMTP y diagnóstico de reglas/PKI. Las secciones de
evidencia del circuito individual que siguen documentan el incremento anterior;
no deben interpretarse como cobertura fiscal completa ni como habilitación oficial.

## Disponible

Detalle de un documento ficticio (RUC `00` + nueve dígitos): bloque shadcn
para ADMIN GLOBAL. Verifica sesión en Identity y acceso/snapshot en Billing.
No usa credenciales reales, ni siquiera para transporte simulado.

```text
PWA -> Kong -> SUNAT-service -> firma/artefactos privados
    -> registro persistente QUEUED -> BullMQ -> emulador SOAP interno
    -> factura sendBill: CDR simulado
    -> boleta: RC 2.0 firmado -> sendSummary -> ticket -> getStatus
    -> CDR simulado + resultado independiente -> consulta PWA
```

- XMLDSig RSA-SHA256/SHA256 local, referencia completa verificada contra
  certificado externo y snapshot. Resumen firmado en worker limitado.
- Gate XSD obligatorio en el circuito QA: Invoice 2.1 (01/03) y RC 2.0,
  paquete oficial fijado por SHA-256 y conservado intacto en
  `services/sunat-service/assets/sunat/xsd-20220228.zip` con manifiesto.
  Se valida antes de encolar y se repite sobre los bytes archivados antes del
  POST al emulador; ZIP de una única entrada, idéntica al XML validado.
  Evidencia ligada a ambos SHA-256 en `FiscalCircuitQa.xsdEvidence`.
  Registros anteriores permanecen NULL; no se atribuye validación retroactiva.
  El laboratorio criptográfico separado sigue sin atribuirse este gate.
- Validador libxml/xmllint en proceso sin shell: stdin, máximo 128 MB,
  cinco segundos, dos procesos y salida acotada/redactada. Sin catálogo ni
  imports externos; rechazo de DTD, entidades, xml:base, XInclude y schemas
  aportados por el comprobante. La única excepción es el DTD **interno exacto**
  del XSD W3C incluido en el ZIP fijado, sin PUBLIC/SYSTEM: no aplica al XML
  de ventas. La validación estructural no valida reglas fiscales ni PKI.
  Preflight fallido = BLOCKED/no enviado; respuesta perdida tras intentar
  el envío = UNKNOWN/no reenvío.
- RC QA: una boleta, PEN, IGV 18%, alta (1), sin percepción ni ISC. Contador
  exclusivo por RUC/día; no consume otra venta. **No equivale al cierre diario
  multi-boleta ni a una baja RA.** Replays concurrentes pueden dejar huecos en
  este contador QA; nunca generan otro correlativo de venta.
- SOAP 1.1 / WS-Security: ZIP base64, timeout total, tamaño máximo, namespaces,
  sin redirecciones ni WSDL/endpoints arbitrarios. Producción bloqueada.
  Endpoint Beta oficial preparado pero NO integrado en una ruta fiscal de
  emisión; un flag no completa homologación, PKI ni validación normativa.
- CDR: ZIP de un XML esperado (y sólo `dummy/` vacío opcional de SUNAT Beta),
  límite expandido, sin rutas relativas,
  XML sin DTD/entidades, referencia y RUC coincidentes, ambigüedad rechazada.
  Código 0 con notas = observado; no cero = rechazado. `getStatus=98` espera;
  `99` con CDR de rechazo NO dispara reenvío. El parser valida estructura/vínculo,
  **no confianza de firma SUNAT**.
- Tablas independientes `FiscalCircuitQa`/`FiscalQaCounter`. No crea
  `SunatSubmission` ni `CdrLog` oficiales, ni cambia aceptación fiscal en Billing.
  API: `transport=LOCAL_SIMULATION`, `officialCdr=false`, `fiscalTransmission=false`.
- Claim atómico: sólo un worker envía. POST repetido devuelve el mismo registro;
  otro escenario requiere otro documento ficticio. ZIP archivado, no reconstruido
  en reintentos. Crash después de enviar = UNKNOWN, sin reenvío automático.
- Con ticket se consulta el MISMO ticket, backoff acotado y 20 consultas máximo.
  Consulta fallida no vuelve a `sendSummary`. Ticket perdido sin respuesta
  impide reenvío automático. `POLL_LIMIT`/`UNKNOWN` requieren revisión.
- Descargas autenticadas de XML, ZIP de solicitud y CDR **simulado**, checksum
  previo, sin publicar rutas ni secretos. Cambio de credenciales bloquea descargas.
- Ticket 80 mm/A4 de prueba: QR técnico y digest **real del XML firmado de la
  boleta/factura**, no del resumen. Advertencias de no validez/CDR no oficial;
  San José, FactuEz/Mavric juntos y frase exacta de implementación sin nombre personal.
- En el incremento inicial, la PWA sólo consultaba cada cinco segundos.
  Ahora incorpora Socket.io y conserva consultas de respaldo, según el bloque siguiente.

## Incremento: impresión, correo capturado y Socket.io

Decisión del usuario: **todo en desarrollo, sin RUC/credenciales reales**,
impresión independiente de marca y correo local primero. No habilita Beta oficial ni producción.
Los XML conservan identificadores ficticios de once dígitos porque no pueden
construirse con un campo RUC vacío. Los datos/configuración del RUC real no se cambian.

- Botones shadcn **Imprimir ticket 80 mm** e **Imprimir A4** en el circuito firmado
  de prueba. Las representaciones sin firma se identifican expresamente como tales.
  Recuperan el PDF con Bearer en memoria, verifican tipo/magic/tamaño y usan URL blob
  privada temporal, liberada al cerrar/cambiar sesión. No imprimen el dashboard.
  Diálogo de vista previa; si el navegador no incorpora visor, salida al visor PDF
  o al archivo descargado. Confirmación manual del operador; ningún envío silencioso.
  Impresoras de cualquier marca, por USB/red/compartidas, disponibles mediante el
  controlador del sistema y su diálogo de impresión. PDF A4 para láser/tinta/multifunción;
  ticket 80 mm para térmicas que admitan ese ancho. No se requiere una marca/modelo
  específico. Escala 100 % y papel compatible; otro ancho requiere ajuste del visor
  y comprobar legibilidad/QR. No hay render nativo de 58 mm ni protocolo ESC/POS directo.
  **Impresión física pendiente de comprobar con los equipos que usen las sedes.**
- Microservicio NestJS `services/mailer-worker`, propia base **factuez_mailer_qa**,
  propia cola BullMQ y volumen privado de paquetes con SHA-256. Sólo ADMIN GLOBAL,
  permiso document.email y documentos ficticios BETA con CDR simulado aceptado/observado.
  Consulta Identity/Billing/SUNAT por APIs; no comparte Prisma con otros servicios.
- Mailpit `v1.31.3` dentro de la red QA interna, sin puertos publicados ni relay;
  SMTP fijado a `mailpit:1025`, sin configuración para destinatarios reales.
  Únicamente correos `usuario@dominio.invalid`; rechaza CRLF, múltiples destinatarios
  y dominios externos. No contiene claves SMTP corporativas.
- Adjuntos: ticket PDF de prueba y ZIP con el XML firmado de la venta y el CDR
  **simulado** del envío (para boleta, corresponde al RC). Aviso explícito de no validez.
  Idempotencia por documento/destinatario/formato, claim atómico y contador persistente.
  Antes de admitir la tarea se revalidan identidad/acceso; la autorización admitida
  queda auditada por actor, no por un JWT guardado. Tokens nunca van a BD ni Redis.
  Integridad fallida = FAILED/no SMTP. Sólo fallo inequívoco de conexión tiene hasta
  tres intentos; respuesta SMTP perdida/crash = UNKNOWN y revisión, no reenvío ciego.
  CAPTURED_LOCAL significa recepción por Mailpit, **no entrega a un cliente**.
- Microservicio NestJS `services/realtime-service`, sin acceso a bases ajenas,
  Socket.io/WebSocket por **Kong /socket.io**. Sesión por handshake auth, nunca URL.
  Origins locales permitidos, mensaje acotado, hasta 100 conexiones y auditoría
  periódica de sesión/revocación. Cada aviso vuelve a consultar Identity y el
  documento autorizado en Billing antes de emitirse; no acepta salas o RUC del cliente.
  Avisos sólo llevan eventId/documentId, sin importes, cliente ni secretos.
- Cola de notificaciones separada de las colas fiscales: no hay consumidores
  compitiendo con Billing por la proyección. Publicación best-effort acotada a 2.5 s;
  PostgreSQL es la fuente de verdad. La PWA vuelve a consultar por REST al reconectar
  y por eventos, conservando polling de respaldo. No promete entrega exactamente una vez
  ni sustituye el outbox fiscal por WebSockets.
- Configuración Kong **exclusiva QA** `infra/kong/kong.stage2.qa.yml`;
  el archivo compartido de la demo 8080 no se cambia. No se publican SMTP, PostgreSQL,
  Redis ni SUNAT-service. Los nuevos servicios sólo están en el override de pruebas.
  TTL DNS QA de cinco segundos para recambios de contenedores y telemetría de Kong
  desactivada. Durante la verificación se recuperó una conexión upstream obsoleta
  reiniciando sólo Kong QA; no se reinició 8080.
- Inicialización aditiva sólo en la base NUEVA de correo mediante
  `services/mailer-worker/prisma/local-qa-init.sql` (rechaza otro nombre de BD).
  No se ejecutó db push ni migradores sobre las bases existentes.

Comandos de comprobación:

```powershell
pnpm test:print-mail-live
pnpm test:print-mail-live:e2e
pnpm qa:mail:capture
```

Dos pases E2E aprobados (el segundo sobre la imagen final del worker): PDF autenticado, correo capturado con dos adjuntos,
replays concurrentes con mismo ID, rechazo de destinatario real/inyección,
Socket.io por Kong para ADMIN y cajero autorizado, sede ajena sin avisos,
cuenta revocada desconectada y ambas cuentas temporales desactivadas al terminar.
Auditoría separada de Mailpit: una captura para el destinatario de prueba y ambos
SHA-256 idénticos al manifiesto archivado. Pruebas locales actuales: 26 adicionales
para impresión/recipientes/sesión/fallos SMTP y 151 previas (177 en total);
no equivalen a homologación fiscal.

Evidencia: `tmp/print-mail-live/proof.json` y `capture-audit.json`, sin secretos.
El navegador integrado mostró el módulo y captura; no soporta el visor PDF incrustado,
por lo que se incorporó la salida al visor. Durante la verificación automática,
su política bloqueó la apertura del blob PDF. No se intentó otro método de impresión
ni otro navegador para sortearlo. La interfaz no confirma apertura/impresión y
la prueba física queda a cargo del operador en Chrome/Edge con su ticketera.
**No atribuirle impresión física verificada.**

Comprobación final: once contenedores QA saludables, cero SunatSubmission/CDR
oficiales, ninguna cuenta qa.live activa y demo 8080 saludable/sin reinicios.
Las dos capturas y fixtures se conservaron para trazabilidad; no se purgó información.

### Incremento del 02/10: RC múltiples y bajas locales

Disponible en `/batches`: selección de 1 a 50 documentos ficticios del mismo
RUC/fecha Lima/PEN; RC alta (1), RC baja (3) y RA de facturas declaradas no
entregadas, con motivo por documento. Firma de las raíces SummaryDocuments y
VoidedDocuments, gate XSD, pertenencia única por acción, contador QA separado,
idempotencia y ticket persistente. Puede agrupar puntos del mismo emisor.
No mezcla RUC/fechas, no repite el envío al perder la respuesta y no cambia ventas.
Una boleta reservada en un alta múltiple no admite un segundo circuito individual.
El RC individual anterior sigue existiendo; RC modificación (2) y el cierre
diario fiscal oficial continúan pendientes. Detalles y alcance en el documento nuevo.

Reglas completas: inventariar y versionar las reglas publicadas por SUNAT
**26.08.2026**, fijar fuente/SHA-256 y matriz de cobertura por perfil. La validación
actual sigue siendo el subconjunto oneroso IGV 18%; fuera del perfil debe fallar
cerrado. No presentar el XSD o los escenarios del emulador como reglas completas.
Certificado confiable/Beta oficial siguen fuera de este piloto local, por elección
del usuario; no solicitar secretos por chat ni usar identificadores reales en QA.

## QA, no migración de producción

Sólo `factuez-stage2-qa`, `127.0.0.1:8091`, BD/volúmenes propios. Emulador
sin puerto publicado ni secretos, red Docker interna sin Internet. Se activa
sólo en `tests/compose.stage2.qa.yml`. Demo anterior 8080 intacto.

Respaldo previo `backups/qa-sunat-before-circuit-20261001.dump`;
`pg_restore --list` confirmó lectura, no prueba completa de restauración.
SQL aditivo `services/sunat-service/prisma/fiscal-circuit-qa-expand.sql`;
no `db push` sobre datos existentes.

Antes de añadir la evidencia XSD se respaldó nuevamente en
`backups/qa-sunat-before-xsd-20261001.dump` (77407 bytes), con TOC legible.
Expansión adicional `services/sunat-service/prisma/fiscal-xsd-qa-expand.sql`.
No es un ensayo de restauración ni habilita transmisión real.

```powershell
pnpm typecheck
pnpm test:circuit-qa
pnpm test:xsd
pnpm test:circuit-qa:e2e
```

E2E fija 8091, exige `--isolated-only` y capacidades demo. RUC/cliente/PKCS#12 y
cuenta temporal ficticios; desactiva la cuenta al terminar, conserva documentos
y evidencia. Ocho escenarios: aceptación/observación/rechazo, respuesta perdida,
CDR ajeno, resumen aceptado, consulta fallida recuperable y resumen rechazado.

## Evidencia de esta entrega

- TypeScript de todo el monorepo correcto; imágenes PWA/SUNAT construidas.
- 151 pruebas automatizadas aprobadas: contratos/core 16, P1 25, PDF P2 17,
  configuración 18, marcas 5, firma local 25, transporte/CDR 31 y XSD 14.
- Auditoría offline independiente con lxml: factura, boleta y RC firmados
  correctos contra los schemas oficiales; rechazo de namespace falso,
  DTD/entidades e importaciones externas HTTP/fuera del paquete.
- E2E de ocho escenarios aprobado por Kong con PostgreSQL/Redis/worker reales.
  Primeros dos pases: 16 registros QA y exactamente 16 envíos al emulador;
  ningún reenvío extra por respuesta perdida/replay. Primer pase: escenarios
  correctos, limpieza de cuenta falló por ruta; se desactivó la cuenta y se
  corrigió el test. Segundo pase terminó con código 0 y cuenta desactivada.
- Tercer pase, sobre las imágenes con gate XSD, aprobado con código 0:
  ocho escenarios adicionales, todos `xsdValidated=true` y reglas fiscales false.
  Evidencia persistida en ocho registros nuevos; los 16 anteriores siguen NULL.
  Tras recrear el emulador para la nueva versión su contador es exactamente ocho;
  ningún POST adicional por replay/respuesta perdida. Total BD: 24 casos QA.
- Las tres cuentas temporales están inactivas. Documentos QA conservados por trazabilidad.
- Cero `SunatSubmission`/`CdrLog` oficiales. Documentos fiscales siguen BUILDING;
  Billing los muestra como procesados localmente, nunca aceptados por SUNAT.
- PDF ticket/A4: logos, crédito, importes, medidas y límites comprobados;
  renderizados con Poppler y revisados visualmente. QR decodificado con zxing-cpp
  independiente: diez campos y digest del XML verificado coinciden exactamente.
- Detalle real PWA: RC, ticket local, resultado simulado y botones de descarga.
  Descarga de ticket guardada por el navegador, igual SHA-256 que el E2E.
- Ocho contenedores QA saludables, red interna comprobada. Demo 8080 intacto.
- libxml real del contenedor aprobó Invoice/boleta/RC archivados y rechazó
  factura sin ID, DTD, xml:base remoto y RC incompleto. No fue sólo un mock.
- Nuevo nombre de descarga incorpora RUC para evitar ambigüedad multi-emisor;
  ticket guardado por la PWA con SHA-256 idéntico al E2E. Pantalla real muestra
  XSD estructural verificado y advierte que no hay aceptación oficial.

El verificador PDF se ejecuta con el Python empaquetado, pypdf/pdfplumber.
Para lectura independiente de QR: `pip install --target tmp/circuit-qa/python
zxing-cpp==2.3.0`, luego `python tests/verify-circuit-pdf.py --decode-qr`.
La librería queda sólo en temporales QA, no en los contenedores ni en producción.

Auditoría independiente de sólo lectura (requiere paquete oficial extraído y lxml):

```powershell
pnpm qa:xsd:download
python tests/validate-official-xsd.py --bundle "tmp/sunat-schema/ubl21-browser/Archivos XSD" --archive "services/sunat-service/assets/sunat/xsd-20220228.zip"
```

La descarga lee los documentos ficticios del último `proof.json`, exige QA 8091
y no crea ventas/envíos. Informe `tmp/circuit-qa/schema/xsd-report.json` separado
de los flags/evidencia runtime. El gate del servicio no depende de Python.

## Trabajo pendiente de cierre fiscal

1. UBL completo por perfil y reglas actuales. La descarga
   directa devolvió bloqueo Cloudflare; el navegador pudo obtener el ZIP por
   el enlace oficial, sin sortear controles. Archivo de 609363 bytes, SHA-256
   `5cac9d9353521340fbc15d23f465a4946b004535b9ff411541c87da01694dbd5`,
   incorporado sin cambios y ya integrado en el gate XSD del circuito QA.
   Quedan reglas SUNAT vigentes y perfiles fuera de la venta onerosa PEN/IGV 18%.
   XSD correcto no homologa ni vuelve fiscal al circuito simulado.
2. Verificar cadena, revocación, identidad/RUC y registro del certificado en SOL.
   Certificados autofirmados QA no sirven para emisión fiscal.
3. Integrar el circuito normal con Beta autorizado, CDR oficial/confianza,
   conciliación de resultado desconocido y proyección fiscal. Posteriormente
   se hizo una única llamada técnica 01 a Beta en un runner separado, aceptada
   con observación 4252; no hubo producción. Ver `PILOTO_BETA_DESARROLLO.md`.
4. RC/RA oficiales y reglas/plazos completos, modificación RC (2), elegibilidad
   oficial y proyección fiscal. RC múltiples y bajas ya funcionan sólo en QA.
5. Correo **corporativo** con adjuntos oficiales sigue pendiente; capturador local
   y Socket.io por Kong ya implementados en QA como se detalla arriba. Notas 07/08
   tienen firma/XSD/PDF local, pero todavía no transporte/CDR propio; GRE 09
   tiene preparación firmada/XSD/PDF y simulación local, no emisión oficial.
6. Piloto, plazos de envío, restauración, corte histórico e impresión física.

Fuentes primarias:
- [SEE del contribuyente](https://cpe.sunat.gob.pe/sistema_emision/see_contribuyente).
- [Guías, XSD y reglas vigentes](https://cpe.sunat.gob.pe/guias-y-manuales).
- [Manual SOAP](https://cpe.sunat.gob.pe/sites/default/files/inline-files/manual_programador%20%281%29.pdf).
- [RC 2.0](https://cpe.sunat.gob.pe/sites/default/files/inline-files/GUIA_Resumen_de_Boletas_11-01-2018%20%282%29_2_0%20%281%29_0.pdf).

**Cierre:** no declarar etapa 2 fiscal terminada sin superar los controles y
disponer de evidencia oficial. El emulador no homologa documentos.
