# DOCUMENT 01/03: bloque congelado para integración

Estado: runtime completo de envío documental y componente exportado; no se instaló ni activó en la aplicación actual. Validación: 90 pruebas nuevas DOCUMENT; regresión combinada 276 pruebas en 18 archivos aprobadas; typecheck mailer-worker y web-pwa aprobados. Ensamblaje Nest real probado localmente, y Nodemailer envió cinco adjuntos a SMTP ficticio TLS/STARTTLS en loopback. Persistencia/DDL cubierta por pruebas de contrato y puertos SQL simulados: este DDL nuevo NO se ejecutó en PostgreSQL ni QA. No hubo SMTP externo, correos reales, build Docker, despliegue, SQLQA ni cambios a Billing/SUNAT/SIRE/B2B/page/provider/AppModule.

## Ensamblaje para Main

Importar CorporateDocumentModule desde src/corporate-document-module.ts en el módulo runtime del Mailer. Este módulo ya contiene controller, providers y lifecycle del worker; no necesita activar dispatcher B2B. No registrar además sus arrays si se importa el módulo completo.

Controller: CorporateDocumentController.
Providers específicos: CorporateDocumentStore, CorporateDocumentHealth, CorporateDocumentSource (factory), CorporateDocumentSmtp (factory), CorporateDocumentService (factory), CorporateDocumentWorker (factory).
Dependencias compartidas: PrismaService, SmtpConfigurationStore, SmtpConfigurationVault, PreparedCorporateSmtp, SmtpLiveDiagnostic (factory), SmtpConfigurationService (factory).

Se exportan CORPORATE_DOCUMENT_CONTROLLERS y CORPORATE_DOCUMENT_PROVIDERS si Main prefiere ensamblar manualmente. Los providers incluyen inject explícito y no dependen de descubrir interfaces como tokens DI. CorporateDocumentModule no modifica ni importa la activación TEST/B2B. Reutiliza sólo el snapshot SMTP autorizado, el vault y las opciones DNS/TLS estrictas.

PWA: importar FiscalDocumentMail de apps/web-pwa/features/workspace/corporate-document-mail.tsx. Props requeridos: companyId (number), ruc (string), documentId (UUID); disabled opcional. Ejemplo de JSX para el detalle autorizado:

<FiscalDocumentMail companyId={document.companyId} ruc={document.immutableSnapshot.issuer.identityNumber} documentId={document.id} />

El componente usa el Workspace existente, exige document.email + ADMIN GLOBAL, hace sólo consulta de estado al cargar, confirma DOCUMENT y destinatario por separado, admite A4/ticket, conserva Idempotency-Key sólo en memoria y permite actualizar estado manualmente. La clave de usuario/documento remonta el formulario al cambiar contexto. No se editó el detalle para insertarlo: Main lo importa.

## Flags y base

Defaults seguros de referencia, no aplicados:
SERVER_SMTP_ENABLED=false
SERVER_SMTP_DOCUMENTS_ENABLED=false

Ambos flags deben ser exactamente true para DOCUMENT. SMTP_CONNECTION_DIAGNOSTICS_ENABLED no concede permiso de envío y no es necesario para enviar. B2B sigue sin recibir autorización. TEST no se migra ni se amplía. MAILER_DATABASE_NAME mantiene la identidad explícita ya integrada y validada contra DB_NAME/DATABASE_URL/current_database(). Se reutiliza la clave montada existente; no hay nuevas claves por defecto.

SQL exacto nuevo: prisma/corporate-document-runtime.deploy.sql
SHA256: e4a945ab33ae3f8fcd2dde2abb80cb85bf9eaaa6264e3aee8ac25c665cca3d66

Instalador psql con ON_ERROR_STOP, exige variable expected_mailer_database con nombre exacto y válido; aborta si falta, difiere de current_database o falta CorporateSmtpConfiguration. Crea únicamente CorporateDocumentActivation, CorporateDocumentJob, CorporateDocumentAudit, sus índices/sequence y permisos al propietario de la base. El integrador debe verificar el rol runtime. Sin ALTER de tablas existentes, sin copiar grants TEST ni insertar activaciones. No se modificaron corporate-mail-runtime.candidate.sql ni corporate-mail-runtime.deploy.sql ya aplicados.

Después de instalar y habilitar el servidor, ADMIN GLOBAL debe autorizar DOCUMENT para cada RUC y revisión SMTP. Un cambio de configuración o credenciales invalida esa autorización por revisión + SHA256 del cifrado. Retirar autorización también se admite con flags desactivados. Activar nunca descarga archivos ni envía.

## API operativa bajo mail-settings existente en Kong

GET /api/v1/mail-settings/:companyId/documents/:documentId
Devuelve estado de envío DOCUMENT y últimos trabajos de ese comprobante. Reautoriza con Identity/Billing. No prepara PDF, no descarga originales, no escribe jobs ni abre SMTP.

POST /api/v1/mail-settings/:companyId/document-activation
Body exacto: { expectedRevision, expectedActivationRevision, enabled, confirmed: true }.
Autorización DOCUMENT por RUC y revisión con CAS, separada de las tablas y grants TEST.

POST /api/v1/mail-settings/:companyId/send-document
Body exacto: { expectedRevision, expectedActivationRevision, documentId, format: 'a4'|'ticket', recipient, confirmed: true }.
Cabecera Idempotency-Key UUID obligatoria. No admite URLs, adjuntos subidos, asunto, contenido, host o flags HTTP. Bearer siempre de la sesión actual.
Respuesta: ID de trabajo, estado, scope DOCUMENT, revisión SMTP/grant y deliveredToClient=false; sin destinatario, token, cifrado ni credenciales. Todas las respuestas no-store.

## Recorrido y garantías

1. ADMIN GLOBAL con document.email se resuelve en Identity. RUC/empresa en catálogo Billing y SMTP guardado. Se exige grant DOCUMENT exacto y worker disponible antes de descargar archivos.
2. GET Billing /api/v1/documents/:id con Bearer. Debe coincidir id, companyId, RUC, snapshot, entorno PRODUCTION, tipo 01/03, serie/número y estado ACCEPTED o ACCEPTED_WITH_OBSERVATIONS. No se usa fiscalTransmission=false del detalle como evidencia ni como bypass.
3. Se usan las rutas actuales del propietario fiscal:
   /api/v1/fiscal-artifacts/:id/:format
   /api/v1/fiscal-artifacts/:id/original/xml
   /api/v1/fiscal-artifacts/:id/original/submission-zip
   /api/v1/fiscal-artifacts/:id/original/cdr-xml
   /api/v1/fiscal-artifacts/:id/original/cdr-zip
   El servicio fiscal valida snapshot, propiedad, hashes archivados, firmas/PKI al preparar PDF y vínculo RC. Mailer no reimplementa ni desactiva esa política fiscal.
4. Se comprueban MIME, nombres exactos vinculados al emisor, tamaño, PDF, XML sin DTD/entidades, ZIP de una entrada sin rutas inseguras, coincidencia ZIP/XML de factura y ZIP/CDR. Para 03 se conserva el ZIP de resumen RC y su CDR original; el XML adjunto es el firmado individual. No se fabrica CDR de boleta ni se regenera/emite un original.
5. Se fija huella del snapshot/estado de Billing y de los cuatro originales; el PDF no queda congelado. Se vuelve a autorizar antes de encolar. PostgreSQL persiste trabajo con CAS e idempotencia, payload AES-GCM separado por AAD corporate-document:UUID/RUC/empresa. El payload contiene sólo destinatario/Bearer/contexto/huella, no adjuntos.
6. BullMQ mail-corporate-document-v1 recibe únicamente {id}, attempts=1, concurrency=2 por proceso. Dos preparaciones HTTP simultáneas como máximo; admisión persistente 6/minuto por sujeto y 3/minuto por RUC. DB outbox permite recuperar wakeups tras Redis caído.
7. Worker reclama una vez, reautoriza la sesión y documento con Bearer, RUC, configuración y grant. Descarga de nuevo los originales y genera/obtiene PDF actual. Si snapshot/estado/originales difieren de la solicitud, cancela; un cambio de presentación PDF es admitido para enviar la versión actual.
8. Reautoriza antes de transporte, después de preparación y antes de TLS. Host aprobado exacto, IP pública IPv4 fijada y lookup callback fijado; TLS 465/STARTTLS587 obligatorios, certificado validado y AUTH obligatorio, logs de protocolo desactivados. Sin IPs privadas/IPv6/URL de entrada ni sendMail del dispatcher B2B.
9. SENDING se persiste antes de llamar sendMail. SMTP 250 con un único destinatario aceptado conduce a HANDED_OFF; cualquier resultado ambiguo posterior queda UNKNOWN, sin reenvío automático ni afirmación de entrega. El frontend nunca llama entrega exitosa a una aceptación SMTP.

## Límites operativos reales

Cinco adjuntos, PDF máximo 10 MiB, cada original máximo 5 MiB y total máximo 25 MiB. Descargas con timeout individual 15s y cancelación del lote a 35s; comando UI espera hasta 60s. Sesión SMTP acotada a 15s. Payload de trabajo vence 2 minutos después de encolar: una sesión caducada/revocada o falta de tiempo impide enviar. Limpieza cada 2s mientras vive el servicio, incluso con flags false; al apagar servicio los cifrados vencidos se limpian en el siguiente arranque. Estados terminales eliminan payload inmediatamente.

El frontend no almacena tokens ni destinatarios en localStorage/sessionStorage. Redis y auditoría no guardan direcciones, errores de proveedor ni secretos. Destinatario/Bearer se cifran en PostgreSQL temporalmente para reautorizar el mismo humano. Auditoría conserva actor/RUC/revisiones/estado/ID del trabajo.

Se limita a 01/03 productivos aceptados, sin notas, guías, documentos rechazados/pendientes o Beta. Si falta cualquier original, PKI vigente requerida por el propietario fiscal, vínculo exacto de RC o PDF productivo, falla cerrado. No se ha probado contra datos ni proveedor de cliente reales. Redis y PostgreSQL para este bloque nuevo están simulados en las pruebas; instalar este SQL y validar el montaje QA corresponde a Main. No existe exactly-once entre SMTP y DB: tras fallo de confirmación puede haber entrega desconocida; UNKNOWN requiere revisión humana antes de solicitar otro trabajo.

## Pruebas y congelación

Tests nuevos: corporate-document-source, runtime, queue, tls, crypto, store, ui, assembly (90 casos). Regresión TEST/DNS/TLS/vault/UI incluida (276 casos). Ambos typechecks aprobados. Ensamblaje HTTP local y factory providers probado; flags false no abren Redis/SMTP. SQL revisado y probado como contrato sin aplicarlo.

Único cambio compartido requerido en este bloque: smtp-configuration.crypto.ts añade AAD estricto corporate-document:UUID, conservando configuración y corporate-test. Todo lo demás se entrega en corporate-document-* más este manifiesto y SQL separado. Bloque congelado para instalación/build/importación por Main.
