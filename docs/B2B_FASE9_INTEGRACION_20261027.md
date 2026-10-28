# B2B-09 — Integración revisada del 27/10/2026

Estado: integración local/BETA; fase abierta. No habilita producción fiscal,
migración de historial real ni despliegue en el VPS.

## Código integrado y comprobado

- **Identity:** relay administrativo mTLS para Billing/SUNAT/Mailer, con
  certificados separados por propietario, OIDC autenticado, permisos y revisiones
  actuales, validación de la tupla en Billing y auditoría durable antes del recibo.
  Los certificados de operador/recurso no adquieren autoridad administrativa.
- **Billing:** contrato de permisos compartido, servidor privado de autorización
  y sesiones revocables por solicitud para negocio, establecimientos/bienes y
  membresía de lotes. El runtime envuelve las rutas cuando se proporciona la
  composición concreta; fuera de esa sesión los puertos rechazan la operación.
  Clientes/productos se ensayaron con los propietarios reales y mTLS loopback;
  las transacciones de almacenamiento eran ficticias explícitas. SERVICE no
  recibe una política operativa por disponer de un scope. La MFA de otro usuario
  o revisión no puede autorizar una mutación del catálogo global.
- **Recepción:** servidor privado de preparación/verificación de aprobaciones y
  montaje optativo en Identity. USER automático está desactivado por defecto;
  el propietario calcula el digest semántico. Se verifica nuevamente cada uso,
  se acotan caché/dedupe a 32 entradas y 30 segundos y se conserva el camino
  manual. No se automatizan GRANT ni SERVICE. No se activó SIRE/correo externo.
- **Historial:** dependencia directa de service-access, host de lectura separado,
  concesiones persistentes independientes y PostgreSQL con TLS explícito. Se
  preservan nombres de bases, permisos y marcadores SYNTHETIC del runner previo.
  Ningún documento real se leyó ni importó para estas pruebas.
- **SUNAT:** entrypoint standalone con contexto Nest enumerado, sin AppModule,
  productores legacy ni Redis implícito. Montaje de PostgreSQL TLS, artefactos,
  vault, PKI/CRL públicos y claves de laboratorio por propósito. El certificado
  administrativo tiene su propio montaje `authorityTls`, separado del usado
  para introspección. La validación de referencia09 ejecuta XMLDSig/CDR/PKI
  reales sobre bytes de prueba y contrasta su registro propietario antes/después.
  El cierre recorre mantenimiento y conserva almacenamiento si el drain falla.
- **Correo:** runtime privado, lectura de configuración, dispatcher y captura
  local desarrollados; el worker usa Identity actual sin guardar un bearer de
  usuario. La autoridad privada limita los scopes admitidos por el host, verifica
  aplicación, enlace/usuario, permisos y sedes actuales y vuelve a comprobarlos
  después de la auditoría. Esto no sustituye el origen de adjuntos pendiente.
- **Archivos del respaldo:** nuevo SyntheticFilesOwner para FILES/ARTIFACTS,
  lectura real del sistema de archivos, identidad y metadatos estables, huellas,
  límites, rechazo de enlaces, contenido privado y raíces no autorizadas.
  Sólo raíces nuevas/copias ficticias marcadas; no escribe ni restaura archivos.

## Perfiles y custodia del host SUNAT

El nuevo host exige `environment=BETA`, `profile=SYNTHETIC`, base
`sunat_synthetic_*_beta` y claves con propósitos LOCAL_GUIDE_ARTIFACT o
LOCAL_SYNTHETIC_BATCH. Su namespace numérico de fixtures es `2000000xxxx` con
dígito verificador válido; **no afirma que esos números estén libres o inscritos**.
Las claves admitidas deben corresponder además a un certificado cuyo CN contenga
SYNTHETIC, pin público y hash del PKCS#12 exactos. Se excluyen los RUC del cliente
y de la empresa de software del usuario. Los guards históricos/recepción con
RUC ficticio `000...` no se modificaron. Se corrigió la composición nueva, que
inicialmente era incompatible con el validador fiscal de lotes existente.

PKCS#12 se lee sólo al adquirir una clave de laboratorio, con máximo 512 KiB;
el buffer se borra al liberar. El vault guarda la clave en un campo privado de
JavaScript y la borra al destruirse. JSON/inspect no la muestran. No se promete
borrado físico de strings ni de copias internas de librerías criptográficas.

Las pruebas del host usan workers criptográficos compilados y OpenSSL reales,
certificados/CRL efímeros, un servidor Identity de prueba por loopback y una
implementación PostgreSQL simulada explícita. Arrancar sin firmar no demuestra
que todas las reglas XSD ni los perfiles fiscales hayan sido homologados.

## Lotes: alcance exacto

El RPC nuevo acepta sólo un handle propietario y una fecha; devuelve evidencia
versionada enlazada a solicitud, XML, CDR y snapshot, con mTLS, pin y frescura.
Hay un repositorio de versiones inmutables y un productor privado candidato;
no se aplicó su SQL ni se montó como un importador público de snapshots.

El ledger persistente nuevo admite únicamente originales 01/03 cuando existe
una fuente propietaria exacta. Rechaza versiones ausentes y notas sin el
catálogo completo de créditos aceptados/reservados. El núcleo criptográfico
existente soporta más perfiles, pero eso no crea el productor histórico que
falta. Este bloque no cierra la capacidad integral de resúmenes/bajas del CLI.

## Pendientes que siguen siendo desarrollo nuestro

1. Ensamblaje completo de Billing: autoridad de políticas de lotes y productor
   propietario de versiones/historial de créditos; registrar la composición
   completa sin sustituir los guards por autorizaciones por defecto.
2. Origen concreto de adjuntos y recurso administrativo SMTP en el CLI Mailer.
   El factory con puertos inyectados está probado; el arranque sin esos recursos
   falla explícitamente. TI no debe implementar estos puertos de TypeScript.
3. Control de todos los procesos, cerco de escritores externos, observadores y
   respaldo PostgreSQL/Redis/restauración a destinos nuevos de toda la instalación.
   El lector de archivos ficticios no equivale a ese respaldo.
4. Ensayo distribuido de carga/recuperación, esquemas aditivos revisados,
   configuración e imágenes ejecutables. El Compose actual permanece bloqueado.

## Evidencia y límites de ejecución

- Compilación integrada: 13 tareas correctas; tipos globales: 29 correctas.
- `b2b-phase9-integrated-authority-history.json`: 190 pruebas correctas.
- `b2b-phase9-sunat-standalone-final.json`: 31 correctas.
- `b2b-phase9-batch-evidence-http.json`: 55 correctas. Firmas XML/CDR reales de
  fixtures; la política de confianza de ese conjunto se simula explícitamente.
  Los ensayos de PKI/CRL reales están en el conjunto de referencia09 y del host.
- `b2b-phase9-billing-permissions-final.json`: 116 correctas, incluidas las
  operaciones de clientes/productos contra el host Identity real por loopback.
- Los informes viven en `output/qa/`. Los focos se solapan: **no sumar sus cifras**.
  La regresión íntegra actual es `b2b-phase9-regression-20261027.json`:
  **325 archivos, 12.812 aprobadas, tres fallos y una omisión condicional XSD
  preexistente**, en 369,14 segundos. Los tres fallos corresponden a los runners
  nuevos-temporales de correo/PostgreSQL al no poder acceder a Docker; se
  mantuvieron como fallos, sin sustituirlos por una base existente.
- Docker Desktop Linux Engine no respondió. No se inició ni se sustituyó por
  una base existente. Los ensayos que dependan de él no cuentan como aprobados.
- Inventario de código actualizado: 30 funciones, 109 acciones planificadas,
  350 declaraciones y 21 pantallas. Las rutas públicas candidatas siguen siendo
  136; los RPC añadidos son privados y optativos.
- Revisión estática del VPS: modelo válido, sin violaciones, memoria total
  6.912.212.992 bytes y 8,2 CPU contando todos los perfiles. Estado BLOCKED,
  `activationAllowed=false`; no constituye un Compose ejecutable aprobado.

No hubo lectura de P12/credenciales reales, DDL, importación, borrado de historial,
reset de correlativos, correo externo, SOAP/REST SUNAT ni acceso al VPS. TI debe
revisar el Compose antes de cualquier arranque en su servidor.
