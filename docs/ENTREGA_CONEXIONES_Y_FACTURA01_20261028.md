# FactuEz: entrega integrada del 28/10/2026

## Estado comprobado

Entorno de trabajo: QA existente `factuez-stage2-qa`, entrada `http://localhost:8091`.
SUNAT, Mailer y PWA se actualizan a `prepared-v4-20261028`; Billing conserva `prepared-v3-20261028` e Identity `prepared-v2-20261028`. Esta entrega conserva los envíos fiscales y SMTP externos
apagados en QA; no constituye un despliegue ni una aceptación de SUNAT.

### Emisión y archivos

- Factura 01 y boleta 03 en soles, operación 0101, contado, IGV 18 %, con perfil explícito por RUC.
- La autorización antigua v1 sigue admitiendo exclusivamente 01. Añadir 03 exige una nueva elección y confirmación del administrador.
- Billing verifica establecimiento por sede y admisión fiscal antes de numerar; no reinicia correlativos ni inventa códigos 0000.
- XML individual firmado e inmutable. Factura: SOAP sendBill. Boleta: RC propio firmado, sendSummary y consulta del ticket.
- La boleta conserva su XML y ZIP individual; el lote conserva el RC y ZIP enviado. El CDR corresponde al resumen RC, con vínculo exacto al miembro, snapshot y originales.
- Una respuesta perdida queda UNKNOWN y requiere conciliación; no genera un reenvío automático de la venta.
- CDR: relación con el envío, firma, cadena y revocación. Estados finales de Producción requieren evidencia de Producción; los emuladores no pueden acreditarla.
- PDF A4/ticket generado bajo demanda con diseño/logo vigente. Antes de cada caché se comprueban permisos, snapshot, archivos y evidencia.
- QR y digest proceden del XML individual firmado. El PDF de boleta identifica el CDR del resumen.
- Archivo público del certificado firmante separado de su clave privada. No se archiva P12, contraseña ni clave privada en las representaciones.
- XML/CDR/ZIP originales se descargan como originales; nunca se regeneran ni se cambian con el diseño del PDF.
- La lectura histórica reconstruye el RC con su fecha estable; no cambia el reloj de validación PKI/CRL. Un certificado/CRL vencido puede bloquear una nueva representación fiscal hasta disponer de evidencia adecuada. La descarga de originales permanece separada.

### Pantallas y documentación

- `Conexiones e integraciones`: entrada visible desde la PWA para Swagger, administración y configuración por emisor.
- Swagger B2B: `/api-docs`, `/api-docs/swagger`, `/api-docs/openapi.json`. El contrato no acredita por sí solo listeners operativos.
- API nativa y administrativa: `/api-reference`, obtenida con sesión actual desde `/api/v1/setup/sunat/reference`. No contiene secretos ni transporta el token al iframe. El visor no ejecuta peticiones ni persiste autorizaciones.
- Administración nativa OnPrem: contraseña actual, sesión administrativa de dos minutos, CSRF, origen HTTPS y revocación de sesión/RBAC. Se conserva el perfil OIDC/SSO independiente.
- Este perfil OnPrem actual gestiona aplicaciones SERVICE/BETA/de lectura. Su infraestructura y catálogo privados deben estar disponibles; el servidor informa cuando no están configurados. No se presentan conexiones ficticias como activas.
- Kong reconoce `/api/v1/b2b-admin`; cada operación conserva su guard de Identity.

### Correo

- Configuración por RUC cifrada con clave dedicada; contraseña sólo de escritura.
- Diagnóstico de conexión separado de guardar: hostname aprobado, DNS público fijado y TLS obligatorio 465/587.
- Activación explícita por revisión y prueba confirmada, con idempotencia, cola durable y revalidación antes de SMTP.
- HANDED_OFF significa que el servidor SMTP recibió el mensaje, no que llegó al destinatario. UNKNOWN no se reintenta automáticamente.
- La identidad de base Mailer se configura mediante `MAILER_DATABASE_NAME`; no depende del nombre QA. El valor debe coincidir con DB_NAME y la conexión.
- El bloque de prueba sólo envía un mensaje sin adjuntos. El bloque DOCUMENT ya está ensamblado en la PWA y Mailer para comprobantes 01/03/07/08 propios aceptados dentro de los perfiles integrados: PDF actual, XML firmado, ZIP de envío y CDR XML/ZIP originales. Requiere autorización separada por RUC/revisión; autorizar pruebas no concede DOCUMENT. La consulta no prepara ni envía adjuntos. El worker revalida sesión, permiso, estado, revisión y originales antes de SMTP. No se ha conectado el correo B2B productivo a esta autorización.

### Notas productivas 07/08

- Perfil completo y acotado: NC 07, motivo 01 anulación total; ND 08, motivo 02 incremento unitario con IGV. Original: factura 01 propia aceptada, PEN/0101/IGV18 al contado. Otros motivos y notas sobre boletas se rechazan explícitamente.
- La PWA muestra la preparación desde la factura original y una autorización independiente en Configuración SUNAT. Incluye serie del punto, motivo y vista previa decimal; el servidor obtiene cliente, cantidades, impuestos, original e historial.
- Transacción Serializable con bloqueo por RUC, reserva fiscal, correlativo y Outbox propios. Dos anulaciones simultáneas no pueden sobreacreditar el original. No se reutilizan números ni se libera capacidad automáticamente por rechazo o UNKNOWN.
- Admisión y eventos de emisión/estado autentican el propietario mediante una clave dedicada de servicio, separada de SOL, P12 y JWT humanos. Los consumidores no pueden aportar un historial ficticio con sólo su Bearer.
- SUNAT usa el paquete firmado inmutable, XSD, confianza pública del firmante y CDR exacto. POST incierto queda UNKNOWN sin reenvío automático. Estados recibidos se proyectan sobre el snapshot propietario y notifican cambios en vivo después del commit.
- PDF A4/ticket y originales comparten las rutas protegidas de documentos. La descarga histórica comprueba bytes/firma matemática/vínculo sin afirmar confianza actual; el PDF mantiene validación PKI/CRL actual antes de cada caché.
- La instalación requiere `PRODUCTION_NOTES_OWNER_KEY_FILE` en Billing/SUNAT, archivo privado dedicado de 64 hex, modo Linux 0600, sin enlaces. El QA conserva los flags de notas apagados y no firma con certificados reales.

## Actualización local con respaldo

Se instalaron ampliaciones aditivas previamente ensayadas en PostgreSQL nuevo,
efémero, sin red ni puertos publicados. No se ejecutaron db push, seeds,
reinstalación, borrado ni cambios a propietarios/contadores fiscales.

- Document.createdByActor nullable y createdByUserId nullable para procedencia SERVICE real.
- Branch.establishmentCode nullable, sin rellenarlo con datos inventados.
- FiscalDispatchAuthorization/FiscalDispatchAudit y ampliación idempotente del CHECK de perfiles 01/03; sin habilitar autorizaciones existentes.
- B2bClient/B2bAudit/B2bRateBucket nuevos en Identity, sin crear clientes ni usuarios.
- CorporateSmtpActivation/CorporateMailTestJob/CorporateMailAudit nuevos en Mailer, sin cambiar configuración guardada ni activar correo.
- Notas: ProductionNotesReservation/Outbox/Inbox en Billing; ProductionNotesGrant/GrantAudit/Dispatch/StatusOutbox en SUNAT.
- Correo documental: CorporateDocumentActivation/Job/Audit. No se copiaron autorizaciones de TEST a DOCUMENT.

Respaldos protegidos dentro del volumen PostgreSQL:

- Billing/SUNAT: `/var/lib/postgresql/data/factuez-upgrade-backups/c8561814-05e4-4859-b61c-88ccebbaa7d8`.
- Identity/Mailer: `/var/lib/postgresql/data/factuez-upgrade-backups/ba5aaf88-c597-4ff9-af21-77e1bb42a48d`.

Los hashes de los registros previos confirmaron que documentos, correlativos,
usuarios y configuración SMTP se conservaron. Notas/correo documental: `/var/lib/postgresql/data/factuez-upgrade-backups/2a5957f7-d02d-4416-aa58-99d2c8c4e54e`. Los respaldos anteriores también se conservan. Se verificó el inventario de cada pg_dump; estos respaldos en el
mismo volumen no sustituyen un respaldo externo del servidor.

Instaladores: `scripts/upgrade-qa-production-compat.cjs` y
`scripts/upgrade-qa-connections-mail.cjs`, más `scripts/upgrade-qa-production-notes-mail.cjs`. Están restringidos al proyecto y
Docker Desktop locales; no sirven para apuntar al VPS.

## Verificación

- Cinco servicios: comprobación de tipos aprobada.
- 348 pruebas conjuntas del circuito de producción, admisión, archivos originales y referencia privada.
- 226 pruebas de PDF/certificado público, una omitida por capacidad de enlaces simbólicos de Windows.
- 34 pruebas de administración OnPrem y 130 de correo/diagnóstico/interfaz.
- Ensayo adicional de concurrencia, rollback, idempotencia, expiración y auditoría SMTP en PostgreSQL nuevo aprobado.
- Instalación SMTP para una base nueva con nombre distinto de QA ensayada; un destino sin confirmación explícita es rechazado.
- Dobles de transporte y certificados efímeros: ninguna prueba constituye envío o aceptación oficial.

El informe HTTP de la versión instalada se obtiene con
`node scripts/verify-prepared-runtime-qa.cjs`: sólo metadatos de contenedores,
salud y rechazos sin sesión. No lee credenciales ni contenido fiscal.

## Límites pendientes de cierre integral

No se declara terminado todo Producción. Permanecen los lotes RC múltiples/RA productivos, guías 09/31 productivas, motivos adicionales de notas, notas sobre boleta y publicación B2B productiva completa de operaciones. Los perfiles 01/03 y 07-01/08-02 y el correo documental 01/03/07/08 ya están ensamblados y compilados. Los bloques nuevos deben
integrarse y verificarse individualmente; no se habilitan cambiando flags sin
su composición real.

El cliente configura sus datos, establecimiento, series, certificado y accesos
por la plataforma. La infraestructura requiere HTTPS, XSD/validador, raíces/CRL,
confianza pública CDR, configuración privada B2B y clave SMTP. No se necesitan
claves por el chat. Estas tareas técnicas no se resuelven pidiendo más PDF/XML
al cliente.

VPS: se mantiene la revisión previa de Compose por TI, máximo 8 GB totales,
puertos loopback 9000–9099, datos Docker/containerd fuera de /var y logs acotados.
No se inició ni modificó el VPS. El Compose de revisión bloqueado no debe
confundirse con una instalación ejecutable ya validada.


## Evidencia final y paquete para TI

- Cinco servicios de la versión instalada: saludables. 18 comprobaciones HTTP correctas, incluidas denegaciones sin sesión de notas, XML, correo y conexiones. Evidencia: `output/qa/prepared-v3-runtime-20261028.json`.
- Swagger nativo y administrativo instalado: 83 operaciones en 69 rutas, incluidas sesión, emisión/consulta, maestros, usuarios/roles, formatos, recepción, administración fiscal, notas y correo. Catálogo B2B separado: 25 operaciones de referencia; no implica publicación productiva del fullgraph.
- Pruebas adicionales: 102 de correo documental/UI de notas; ensayo real de correo DOCUMENT en PostgreSQL nuevo; 11 verificaciones transaccionales de notas en PostgreSQL nuevo. Foco de notas/artefactos/UI: 213 aprobadas y dos omisiones por enlaces de Windows; después se verificó el ajuste de consulta durante SENDING con el foco de artefactos. Regresión focal de originales/admisión/estado/sesión: 249 aprobadas.
- No se efectuaron envíos SOAP/REST oficiales, correos reales, OAuth SUNAT, rotaciones de claves del cliente ni acceso al VPS.
- Compose core para revisión previa de TI: `infra/deployment/core-production/docker-compose.yml`, con guía y gateway real. Once procesos, 7.700.000.000 bytes de límites agregados y 8,5 CPU. Únicamente Kong se publica en 127.0.0.1:9000; PostgreSQL/Redis no publican puertos. Los datos se montan bajo /srv; Docker y containerd requieren su propio almacén fuera de /var.
- El core ejecutable es independiente del Compose B2B histórico bloqueado. No habilita el fullgraph B2B ni cambia el QA. El archivo se entrega para revisión; no se arrancó en el servidor del cliente.
- Esquemas iniciales: `output/install/core-schema-20261028-v2`, cinco SQL y manifiesto SHA-256. Ensayados contra bases nuevas y vacías con 15/25/25/12/11 tablas, cero filas y rechazo de destino sin confirmar, propietario incorrecto y reinstalación. No usar el paquete anterior marcado SUPERSEDED ni estos SQL como migradores de una base existente.
- Generación offline: `scripts/export-production-schemas.cjs`. Instrucciones en el README del bundle. No requiere entregar datos del negocio al desarrollador. TI configura el primer administrador y la infraestructura; empresas/sedes/series/certificados/SMTP se registran por la plataforma.

- Kong core: 18 comprobaciones estáticas y aceptación del declarativo por el parser real del contenedor QA; siete upstreams y doce rutas. Se corrigió la sintaxis de expresiones y se añadió regresión para no publicar prefijos internos por error. No se recargó el gateway del QA durante esta validación.

## Finalización posterior a la aprobación del Compose

El usuario confirmó la aprobación del Compose en este chat. No se vuelve a pedir esa aprobación para continuar el código. Se corrigió el UID de Redis a 1000:1000 para leer los mismos secretos 0600 que los servicios Node; no cambian puertos, redes ni presupuestos. Ensayo con Redis nuevo, tmpfs y network none aprobado. La instalación del VPS todavía necesita dirección/acceso autorizado o ejecución por TI; no se simula acceso al servidor.

- Correo de notas 07/08 integrado con PDF actual, XML y ZIP individual y CDR exactos. El perfil de autorización DOCUMENT v2 exige confirmación nueva: un grant anterior 01/03 no gana notas automáticamente. La configuración SMTP cifrada no se cambia.
- Health Mailer distingue transportes reales y readiness NOT_PROBED; no presenta Mailpit como transporte de producción ni promete entrega por SMTP.
- Swagger ampliado contrastado contra los controladores/DTO actuales: 50 operaciones nativas más 33 fiscales/administrativas, total 83. Se retiró la admisión interna del contrato publicado; no se cambió su endpoint privado para Billing.
- La PWA identifica el acceso como **API del sistema** y su visor como **API de FactuEz**. OAuth B2B conserva su contrato separado y no hereda autorizaciones humanas.
- Cliente nativo de ejemplo y guía: `examples/native-api-client.ts` y `docs/CONEXION_API_NATIVA_CORE.md`. Login Bearer, catálogo, emisión idempotente y originales; ningún reintento POST automático ni fallback a otra API/RUC/ambiente.
- Chequeo del VPS de sólo lectura: `infra/deployment/core-production/preflight.mjs`. Valida recursos/cgroups, disco de Docker/containerd fuera de /var, puerto 9000, mounts, secretos por metadatos, PKI/XSD por hash e imágenes locales por digest. No lee contenidos secretos, no conecta SUNAT/SMTP ni arranca contenedores.
- Constructor de siete imágenes Linux/amd64 fuera del VPS: `build-release.mjs`; base Node 22 por digest, versión explícita y PWA al mismo origen. No publica imágenes ni confundeID local con RepoDigest.
- Verificación adicional: 215 pruebas de correo/UI/perfil/liveness; ensayo en PostgreSQL nuevo con rechazo de grant legacy y renovación explícita; 51 pruebas deSwagger; 42 de preparación/plan de release; 9 del cliente API. Ninguna acredita un piloto fiscal oficial.

El desarrollo pendiente de lotes/guías/perfiles y B2B productivo completo sigue siendo nuestro trabajo técnico. No se atribuye a la falta de datos del cliente. El paquete de entrega actualizado se identifica con sufijo v2 y sus propios hashes; no sobrescribe el anterior.
