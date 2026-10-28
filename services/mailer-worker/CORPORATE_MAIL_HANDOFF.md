# Bloque congelado para integración

Validación final: 186 pruebas en 10 archivos; typecheck de @factuez/mailer-worker y @factuez/web-pwa aprobados. No se ejecutó build de Docker, despliegue, SQL sobre QA actual, SMTP externo ni correo real. Antes del cierre se ensayó el DDL candidato y las transacciones en PostgreSQL NUEVO tmpfs, sin red ni puertos publicados; ensayo aprobado y contenedor retirado. No se ejecutó una prueba end-to-end contra Redis real: las pruebas de integración del worker usan BullMQ simulado. SMTP efectivo se probó con Nodemailer y TLS/STARTTLS ficticios en loopback.

## Configuración segura inicial

SERVER_SMTP_ENABLED=false
SMTP_CONNECTION_DIAGNOSTICS_ENABLED=false
B2B_MAILER_ENABLED=false

MAILER_DATABASE_NAME es obligatorio y explícito para este deployment. Ejemplo QA: factuez_mailer_qa. En producción use el nombre real de la base PROPIA de Mailer. Si DB_NAME está presente debe coincidir exactamente; si DATABASE_URL está presente su ruta debe coincidir. Sin identidad, con nombres distintos o con parámetros options en DATABASE_URL, la conexión falla cerrada. No hay fallback implícito a QA. Mantener los secretos de conexión, la clave SMTP y SMTP_APPROVED_HOSTS en la integración existente; no incluirlos en artefactos ni logs.

El envío requiere SERVER_SMTP_ENABLED=true, tablas preparadas, cola/worker disponibles y autorización humana por RUC vinculada a revisión y huella exactas de la configuración. El flag no concede autorización. Guardar, cargar la pantalla y activar no ejecutan pruebas ni SMTP. Los diagnósticos siguen sujetos a su flag independiente.

## DDL exacto mínimo

Prerrequisito: CorporateSmtpConfiguration y CorporateSmtpConfigurationAudit existentes del bloque de configuración SMTP. No se modifican tablas actuales.

QA: prisma/corporate-mail-runtime.candidate.sql. Guard fijo current_database() = factuez_mailer_qa, antes de DDL.
SHA256: 930b7be5214f443d20072eb5bcac140edbee0a4888c36a0e7685ee459e534439

Deployment explícito: prisma/corporate-mail-runtime.deploy.sql. Instalador psql separado, requiere variable expected_mailer_database; omisión o mismatch aborta antes de DDL. El cuerpo DDL coincide exactamente con el candidato QA y está cubierto por prueba de igualdad. No fue ejecutado en deployment. No instala la configuración SMTP previa ni cambia configuración runtime.
SHA256: ddb5fe4506ea32325fe0af6f81d3ab012dd831f9af092511b8408b76b652a6bc

Ambos crean únicamente CorporateSmtpActivation, CorporateMailTestJob, CorporateMailAudit e índices/sequence de auditoría. Sin ALTER de tablas existentes, inserciones de grants, cambio de flags ni autorización de envío. Permisos para el propietario de la base; el integrador debe comprobar que coincide con el rol runtime. Ningún instalador se invoca automáticamente.

## API y estados

GET /api/v1/mail-settings/:companyId/corporate: estado y últimos trabajos/eventos sin destinatarios ni secretos.
POST /api/v1/mail-settings/:companyId/activation: expectedRevision, expectedActivationRevision, enabled, confirmed=true. ADMIN GLOBAL document.email con Identity/Billing actuales; CAS en DB.
POST /api/v1/mail-settings/:companyId/send-test: expectedRevision, expectedActivationRevision, recipient único, confirmed=true; cabecera Idempotency-Key UUID. UI exige destinatario escrito y confirmación separada. No acepta asunto, contenido ni adjuntos HTTP.

BullMQ mail-corporate-test-v1 lleva sólo {id}. PostgreSQL conserva el outbox; claim y transiciones CAS impiden repetir envío por redelivery. Worker concurrency=2 por proceso. Límites persistentes 6/minuto por sujeto, 3/minuto por RUC. Payload cifrado contiene destinatario y Bearer de corta duración para reautorizar la misma sesión en Identity y Billing; AAD vinculado al ID y RUC. Autorización del trabajo vence a los 2 minutos; limpieza se ejecuta cada 2 segundos mientras vive el servicio, incluso con envío desactivado, y elimina payload en estados terminales. Si el servicio está apagado, la limpieza ocurre al volver a arrancar. No se guardan destinatarios en Redis/auditoría/respuestas ni excepciones SMTP en logs.

Revalidación antes del transporte, después de preparación y antes de TLS, con revisión/huella/grant vigentes. Host exacto aprobado, DNS IPv4 público validado/fijado y callback lookup fijado; sin fallback privado/IPv6. Certificado TLS obligatorio, 465 TLS o 587 STARTTLS; plazo SMTP 15 segundos. Conexión corporativa no depende del flag de diagnóstico.

QUEUED -> PREPARING -> SENDING -> HANDED_OFF o UNKNOWN. FAILED/CANCELLED antes del límite ambiguo. Después de SENDING un error puede haber entregado el mensaje y queda UNKNOWN, sin reenvío automático. HANDED_OFF significa aceptación SMTP; deliveredToClient permanece false. Cambios de configuración invalidan el grant anterior. No hay exactly-once entre SMTP y DB; un fallo de confirmación se conserva como incertidumbre.

## Gap documental real: no integrado

Este bloque autoriza y envía SOLAMENTE correo de prueba sin adjuntos. Estado activo: CORPORATE_SMTP_ACTIVE_TEST_ONLY; readyToSendTest preciso, readyToSend=false para comprobantes, documentEmailAvailable=false y b2bAuthorized=false. Nunca presentar este resultado como envío de comprobantes/API completo.

La ruta PWA existente de comprobante permanece en mail-qa/LocalMail (Mailpit y documentos ficticios), con adjuntos del circuito QA. No se encontró un puerto PWA MailDocument/fiscalValidatedAttachments ya conectado a este módulo. El origen de adjuntos corporativos B2B existente es otra composición y no se activó.

Para enviar comprobantes reales desde PWA falta un comando documentId/format/recipient idempotente, autorización viva del documento contra Billing con el Bearer, obtención autorizada del PDF actual y XML/CDR originales del servicio fiscal, validación de integridad/propiedad/RUC/estado fiscal, snapshot/revisión del documento y adjuntos, recuperación de esos artefactos en worker, grant específico para envío documental, y cambio de la acción PWA del detalle del comprobante. No se hicieron modificaciones a Billing, SUNAT/SIRE ni al dispatcher B2B. Se congela el alcance aquí por indicación del usuario.

## Archivos de runtime y UI

src/corporate-mail.{controller,health,policy,service,store,transport,worker}.ts; src/mailer-database-identity.ts; SMTP configuration module/service/store/crypto; prisma.service.ts y helper smtp-live-diagnostic.ts. Registro sólo en SmtpConfigurationModule; no cambio de main/AppModule para este bloque. UI: apps/web-pwa/features/workspace/corporate-mail.tsx y smtp-settings.tsx. Sin cambios de package/lock/Docker ni migraciones aplicadas por este bloque.

## Pruebas focalizadas finales

pnpm exec vitest run tests/corporate-mail-database-identity.spec.ts tests/corporate-mail-ui.spec.ts tests/corporate-mail-runtime.spec.ts tests/corporate-mail-queue.spec.ts tests/corporate-mail-crypto.spec.ts tests/corporate-mail-tls.spec.ts tests/smtp-configuration.spec.ts tests/smtp-live-diagnostic.spec.ts tests/smtp-live-protocol.spec.ts tests/smtp-settings-ui.spec.ts --maxWorkers=2
pnpm --filter @factuez/mailer-worker typecheck
pnpm --filter @factuez/web-pwa typecheck

Ensayo PostgreSQL opcional separado, NO ejecutarlo sobre entorno actual: tests/corporate-mail-runtime-db.config.mts utiliza únicamente la fixture que crea y retira su propio contenedor. Mantiene nombre QA sintético fijo y no usa DATABASE_URL ni conexiones actuales.
