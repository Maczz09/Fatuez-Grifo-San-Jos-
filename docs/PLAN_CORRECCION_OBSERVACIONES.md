# Plan de corrección de observaciones de FactuEz

Fuente: documento proporcionado por el usuario, Observaciones del sistema.docx.
Fecha: 10/10/2026. Estado: correcciones compiladas y desplegadas en QA local;
permisos individuales preparados, pendientes de ampliación autorizada de Identity.

Se conservarán microservicios, Kong, originales fiscales, correlativos y alcance
por RUC/sede. Las pruebas usarán datos ficticios. No se habilitarán envíos a
SUNAT/SIRE, correo externo o producción mediante estas correcciones.

## Orden y criterios de aceptación

1. **Configuración fiscal y auditoría.** Reemplazar o quitar certificado, SOL y
   GRE mediante confirmación, revisión concurrente y auditoría sin secretos.
   Mostrar historial autorizado de cambios y ayudas para RUC, ambiente y revisión.
   Explicar cada requisito fiscal al hacer clic, con nombres comprensibles.
2. **Roles y acceso individual.** Editar las capacidades de los roles permitidos;
   otorgar acceso adicional por usuario sin ampliar su alcance de sede/punto/serie.
   Separar consulta, impresión, reportes y administración cuando el backend pueda
   garantizarlo. Evitar escalamiento y pérdida de acceso del administrador general.
3. **Productos.** Crear, editar y desactivar productos con validación y auditoría.
   Desactivar no borra ítems ni altera precios de comprobantes históricos.
4. **Restricción por sede.** El administrador de sede sólo consulta y administra
   su alcance autorizado. La cabecera no presenta opciones ajenas, y el servidor
   rechaza identificadores fuera de alcance aunque se manipule una petición.
5. **Correo.** Administrar servidor/remitente y reemplazar o quitar credenciales
   con auditoría y revisión concurrente. No devolver secretos ni habilitar SMTP
   externo por guardar una configuración.
6. **Interfaz y ambiente.** Retirar Entrega del cliente y notas internas de
   planificación de las pantallas operativas. Conservar advertencias necesarias
   de pruebas y seguridad, redactadas en lenguaje sencillo. No etiquetar una
   vista de credenciales Producción como Beta ni fingir emisión oficial activa.
7. **Paginación.** Incorporar controles reutilizables con filtros y estados vacíos;
   distinguir paginar resultados cargados de paginar el universo en el servidor.
8. **Verificación y entrega.** Pruebas de permisos, concurrencia, borrado seguro,
   aislamiento, interfaz y tipos; prueba aislada de persistencia si es viable;
   compilar y actualizar sólo servicios afectados del QA con --no-deps. No
   ejecutar migradores en BD existentes sin delimitar ese cambio por separado.

## Límites

El documento de observaciones describe necesidades de interfaz y administración;
no sustituye evidencia de confianza del certificado, habilitación SEE o aceptación
de SUNAT. La activación fiscal y el corte de historial conservan sus gates.
Quitar credenciales significa eliminar los valores activos de la configuración,
no revocar el certificado en su autoridad ni eliminar auditorías u originales.

## Evidencia de ejecución

### Correcciones entregadas

| Bloque | Resultado comprobado |
| --- | --- |
| Configuración SUNAT | Reemplazo y retiro confirmado de certificado/contraseña, SOL y GRE. Revisión concurrente, auditoría paginada por RUC/ambiente, sin devolver secretos. |
| Explicaciones fiscales | Ayuda al pasar el cursor y al hacer clic sobre RUC, ambiente y revisión; nombres comprensibles y explicación/acción para cada requisito. Certificado guardado no significa envío habilitado. |
| Roles | La pantalla muestra los permisos almacenados. El administrador general puede editar los otros roles; ADMIN está protegido. Cambiar una matriz invalida sesiones de las cuentas afectadas y registra auditoría. Reiniciar Identity no restablece los permisos editados. |
| Productos | Alta, edición y activación/desactivación del catálogo compartido, reservadas al administrador general con permiso de productos. Validación y control de revisión. No hay borrado físico ni reescritura de ítems históricos. |
| Alcance por sede | Se conserva la autorización del servidor. Una única sede asignada se selecciona automáticamente y el selector queda bloqueado; no se seleccionan sedes ajenas. Con varias sedes autorizadas se puede elegir entre ellas. |
| Correo | Sustitución de configuración y retiro confirmado del acceso SMTP, conservando revisión y auditoría. El retiro guarda una marca cifrada sin credenciales activas. El historial indica sustitución o retiro, sin afirmar que distingue ambos eventos en registros anteriores. |
| Interfaz | Se retiró la pestaña Entrega del cliente y notas de planificación identificadas. Se conservan las advertencias de pruebas, límites fiscales y seguridad; no se borró el código ni la evidencia interna de recepción del cliente. |
| Paginación | Usuarios, productos y panel de comparación: páginas sobre la lista cargada. Auditoría fiscal y SMTP: páginas de 10 filas desde servidor, con total y orden estable. Comprobantes conserva su paginación de servidor existente. |

### Permisos adicionales por usuario: preparados, no activados en la base

Se implementaron servicio, API y diálogo de permisos operativos adicionales.
Son aditivos a los roles: consultar/emitir/enviar documentos, consultar/exportar
reportes, consultar auditoría y abrir/cerrar turnos. No conceden administración
global ni amplían RUC, sedes, puntos o series. Se protege ADMIN y el acceso propio.
Cada cambio invalida sesiones y conserva auditoría y revisión de acceso.

La tabla propuesta está en
`services/identity-service/prisma/user-extra-permissions.sql`. **No se ejecutó en
la BD QA existente.** Se pidió confirmación específica para esa ampliación;
mientras no se aplique, la interfaz informa que falta preparación y no concede
permisos adicionales. No hay creación automática de tablas en el arranque.
Las pruebas de escritura de este bloque utilizan dobles de prueba, no una BD real.

La consulta de un PDF permite imprimirlo desde el navegador. No se añadió una
promesa de impedir impresión/copia después de conceder acceso al PDF: no existe
una restricción fiable de ese tipo en un navegador. Exportar reportes sí es una
facultad independiente. Un permiso de impresión específico requeriría definir
su alcance y contratos, sin confundirlo con control de la impresora física.

### Verificación local

- Regresión completa: **131 archivos; 5.226 pruebas aprobadas y 1 omitida**.
  La prueba omitida no se contabiliza como verificación ejecutada. Dos pruebas
  superaron inicialmente 5 segundos durante las compilaciones simultáneas;
  la repetición completa con 2 trabajadores y límite de 30 segundos pasó.
- Casos de estas observaciones: **34 pruebas aprobadas**, incluidas 3 pruebas
  adicionales de permisos individuales ejecutadas después de la regresión:
  escritura simulada/revocación, rechazo de revisión vencida y protección de ADMIN.
- Comprobación de tipos: **26 tareas aprobadas**, en los 19 paquetes del monorepo.
- Se compilaron imágenes de Identity, Billing, SUNAT, Mailer y Web. Los últimos
  ajustes de Identity/Billing se recompilaron sin red con lock y esquemas iguales.
- Despliegue limitado a esos 5 servicios con `--no-deps --no-build`, en el proyecto
  `factuez-stage2-qa`. No se ejecutaron migradores ni se recrearon PostgreSQL/Redis.
- **14 contenedores saludables** después de la actualización.
- `node tests/observations.runtime.audit.mjs --read-only-qa`: PASS. Comprobó código
  compilado, recursos públicos de cuatro pantallas, respuesta 401 sin sesión en
  las nuevas rutas y permanencia de los bloqueos de transporte Beta/workflow.
  No es una prueba de mutaciones con una sesión real ni de persistencia en la BD.

Aplicación disponible en **http://localhost:8091**. El overlay de esta versión
es `tests/compose.observations.qa.yml`, sobre los tres archivos de compose que
ya utilizaba QA. No ejecutar un `compose up` general ni un migrador para aplicarlo.

### Pendientes concretos y exclusiones

1. **Aplicación autorizada de la tabla de permisos individuales** en Identity,
   con respaldo, validación de propietario/permisos y prueba aislada de persistencia
   antes de aplicarla al QA existente. El código no evita esta condición.
2. **SMTP corporativo:** TI debe definir servidores permitidos y su configuración
   segura. La interfaz respeta la lista de hosts autorizados; no se quitó esa
   protección para dejar guardar destinos arbitrarios. No se comprobó entrega real.
3. **Activación fiscal oficial:** esta entrega permite administrar credenciales
   separadas de Beta/Producción, pero no conmuta la emisión a producción ni habilita
   un despacho oficial. Piloto autorizado, confianza del certificado, reglas y
   habilitación SEE conservan los pendientes de las fases fiscales existentes.

No se enviaron documentos a SUNAT/SIRE ni correos externos, no se modificaron
ventas/XML/CDR originales ni correlativos. No se declara cerrada la fase fiscal
por estas correcciones de administración e interfaz.
