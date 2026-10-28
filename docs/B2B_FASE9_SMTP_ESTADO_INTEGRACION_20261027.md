# B2B: estado de integración SMTP corporativo y permisos

Estado al 27/10/2026: **envío corporativo bloqueado; integración incompleta**. No hay proveedor SMTP confirmado. La intención de activarlo no constituye una concesión de envío ni permite inventar actores, destinatarios, credenciales o infraestructura.

El host incorporado ya compone la fuente propietaria de documentos y, cuando se solicita explícitamente `smtpAdministration`, el recurso de administración SMTP preparado. Este último usa capacidad administrativa vigente, revalidación de la jerarquía en Billing, configuración cifrada y auditoría; su estado sigue siendo `EXTERNAL_SMTP_DISABLED`. Billing dispone de una composición de permisos con autoridad Identity y sesiones revocables. Estas capacidades no son autorización para enviar correo.

El perfil `CORPORATE` exige un `corporateOwner` con permiso actual de envío, lectura de configuración y bóveda. El host incorporado no construye ese recurso y el arranque lo rechaza antes de acceder a almacenamiento. El almacén y la bóveda preparados no implementan directamente el contrato de lectura de Corporate: su API y asociación criptográfica son distintas. No conectar la bóveda legacy de QA ni conceder permisos predeterminados para evitar este bloqueo.

Para completar la integración se necesita un adaptador propietario de solo lectura para el almacén y bóveda preparados, con ciclo de vida seguro, así como una fuente real, explícita y revocable de concesiones para actor, emisor, documento y destinatario. También se necesitan pruebas aisladas de composición y revocación, y revisión del esquema y sus privilegios en una base nueva dedicada. Un proveedor real requiere además host aprobado, TLS verificable, credenciales custodiadas y autorización expresa para remitente y destinatarios. La disponibilidad de esos elementos debe verificarse antes de cualquier activación.

Verificación de esta revisión: pruebas de SMTP preparado, montaje, fuente del host, runtime, política y transporte corporativos y permisos de Billing, con datos sintéticos y dependencias simuladas o mTLS local. No se consultaron bases existentes, ni se contactó SMTP externo, ni se enviaron correos reales o solicitudes SUNAT. Las pruebas de protocolo simulado no demuestran que los esquemas SQL candidatos estén instalados correctamente ni que un proveedor acepte mensajes.


## Preparación de Gmail para QA local

Se aprobó únicamente `smtp.gmail.com` en la lista del mailer del proyecto local
`factuez-stage2-qa` mediante `tests/compose.gmail-qa.yml`. El servicio fue
recreado sin dependencias ni migraciones y respondió healthy. Esto solo permite
preparar la configuración: el envío externo permanece deshabilitado y la clave
QA no es custodia apropiada para credenciales reales. No se debe ingresar la
contraseña de aplicación real en ese entorno.

Se agregó un adaptador aislado para leer configuración cifrada por RUC con la
bóveda del host. No está conectado a la autoridad de envío ni al arranque. El
foco de adaptador, host, runtime y SMTP loopback aprobó **46 pruebas**
(`output/qa/correo-gmail-preparacion-20261027.json`); tipos de web y mailer
aprobados. La pantalla de orientación Gmail está en código, no en la imagen QA
actual. No se contactó Gmail ni se envió correo externo.
