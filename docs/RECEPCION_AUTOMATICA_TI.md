# Recepción automática: integración y preparación TI

## Puesta en marcha por TI

1. Confirmar las empresas receptoras y sus RUC en el catálogo. Esta configuración
   es independiente de certificados, emisión y credenciales GRE.
2. En SOL, el responsable autorizado del RUC gestiona **Credenciales de API SUNAT**
   para **MIGE RCE y RVIE - SIRE**, según el manual oficial enlazado abajo. Obtiene
   Client ID y Client Secret del servicio SIRE y habilita un usuario SOL con los
   permisos correspondientes. FactuEz solicita el usuario **sin prefijo RUC** y
   la contraseña SOL; el conector arma el nombre de autenticación. No introducir
   credenciales en el repositorio, documentos, terminal ni chat.
3. En **Documentos recibidos → Recepción automática**, seleccionar el RUC,
   modo de lectura, activar SIRE, completar periodo inicial y esas credenciales.
   Guardar permite preparar la configuración, pero no autoriza conexiones externas.
4. Para los ítems completos, crear un buzón corporativo dedicado y pedir a los
   proveedores que envíen allí el **XML original** y, si disponen, PDF/CDR adjuntos.
   Registrar hostname exacto, puerto 993, carpeta, usuario y contraseña de buzón
   o de aplicación. Este conector implementa IMAP con contraseña; un proveedor
   que sólo admita OAuth2/Graph requiere otro adaptador y no se debe debilitar su
   política de autenticación. No se siguen enlaces ni se hace scraping de portales.
5. Provisionar la base propia y los secretos independientes del despliegue on-premise.
   La clave de recepción es de 32 bytes codificados en hexadecimal, guardada en
   archivo protegido y respaldada con control de acceso; perderla impide descifrar
   las credenciales. Los permisos del archivo montado deben ser restrictivos
   (0600 en Linux). Usar HTTPS de intranet para introducir secretos.
6. Revisar `infra/received/docker-compose.read-only.example.yml` junto con
   `docker-compose.yml`, **nunca sobre el proyecto QA**. TI autoriza explícitamente
   `RECEIVED_LIVE_READ_ALLOWED=true` en API y worker, limita los hosts IMAP y permite
   salida TLS sólo hacia SUNAT y su buzón. Mantener los gates de emisión intactos.
   Aplicar sólo la migración de la base propia de recepción, con respaldo y sin
   `db push`, y desplegar los servicios explícitos con `--no-deps`.
7. Probar un periodo y un correo autorizado, revisar ejecuciones, XML pendientes
   e incidentes. Activar programación (15 minutos por defecto) después de comprobar
   autenticación y resultados. No aceptar propuestas ni presentar libros desde
   este módulo: esas operaciones no están implementadas ni autorizadas.

La ventana automática revisita los últimos tres meses, limitada por el periodo
inicial. **No es una descarga histórica ilimitada ni una notificación instantánea
universal de SUNAT**. El tiempo de aparición depende de la disponibilidad de la
propuesta SIRE, de la entrega del XML por el proveedor y del intervalo configurado.
Correo y SIRE se relacionan por identidad fiscal y comparan fecha, moneda e
importe; coincidencia no acredita firma, confianza PKI ni aceptación fiscal.

Referencia de contratos y accesos:
[Manual oficial SIRE Compras v28](https://cpe.sunat.gob.pe/sites/default/files/inline-files/Manual%20de%20servicios%20Web%20Api%20-%20SIRE_Compras%20v28_0.pdf),
exportar propuesta (5.34), consultar ticket (5.31) y descargar archivo (5.32).
El adaptador sólo permite esas consultas y OAuth; no permite aceptar/presentar.

Resultados locales: [verificación](RECEPCION_AUTOMATICA_VERIFICACION.md).

El módulo recibido incluye `ReceivedAutomationPanel({ selection, onDirtyChange })`, exportado desde `apps/web-pwa/features/workspace/received-automation.tsx`. `ReceivedList` lo monta bajo `WorkspaceProvider`, con la selección validada por `receivedSelection` y un callback estable que agrega cambios pendientes de importación y automatización.

La UI usa los contratos de `@factuez/contracts`, componentes shadcn existentes y `useResource`/`api` del provider. No hay endpoint binario en esta API: los enlaces de documentos relacionados reutilizan `/received/:id`, cuyo detalle ya usa `apiBlob` para sus descargas. El panel no crea descargas ni una API alternativa de archivos.

## Acceso y aislamiento

- Configuración, credenciales, sincronización, ejecuciones e incidentes: exclusivamente `ADMIN`, scope `GLOBAL`, permiso `setup.manage`. Puede configurar cualquier RUC seleccionado explícitamente. Además, `config.canManage` autoriza las acciones.
- Descubrimientos: requieren `report.view`. `ASSIGNED` selecciona una sede autorizada; solicita siempre `companyId` y `branchId`. No consulta ni ve configuración, ejecuciones o incidentes globales.
- El backend entrega a `ASSIGNED` exclusivamente descubrimientos `MATCHED` cuyo documento corresponde a la sede autorizada actual. No se exponen los pendientes o conflictos del RUC completo. La UI también rechaza respuestas no relacionadas para este scope; la comprobación de sede del documento se realiza en el servidor, porque discovery no contiene sede.
- La identidad del panel incluye empresa, RUC, sede, fuente del catálogo, usuario, roles, permisos y scope. Cualquier cambio desmonta el contexto anterior, cancela peticiones y elimina sus campos y secretos de memoria. Configuración y descubrimientos se verifican contra empresa y RUC. Ejecuciones e incidentes no incluyen empresa en su contrato: el servidor los aísla mediante `companyId` y autorización, y la UI descarta completados del contexto anterior.

## API del módulo

| Operación | Ruta / cuerpo |
| --- | --- |
| Leer configuración segura | `GET /api/v1/received-documents/automation/config?companyId=ID` |
| Guardar | `PATCH` a la misma ruta con `{expectedRevision, settings, credentials?}` |
| Leer ejecuciones | `GET /api/v1/received-documents/automation/runs?companyId=ID` → `{items: ReceivedSyncRun[]}` |
| Encolar consulta | `POST /api/v1/received-documents/automation/sync` con `{companyId, source: 'MAIL' \| 'SIRE' \| 'ALL'}` → `{queued}` |
| Descubrimientos | `GET /api/v1/received-documents/automation/discoveries?companyId=ID[&branchId=ID]` → `{items: ReceivedSireDiscovery[]}` |
| Incidentes SIRE | `GET /api/v1/received-documents/automation/incidents?companyId=ID` → `{items: {id, period, ordinal, code, observedAt}[]}` |

`settings` contiene `enabled`, `mode`, `intervalMinutes`, `mailbox` y `sire`, según `packages/contracts/src/received-automation.ts`. Intervalo: entero entre **5 y 1440 minutos**, por defecto **15** en el backend. IMAP usa puerto **993** con TLS. `startPeriod` usa **AAAAMM**, mes válido y no posterior al periodo actual. Cada sincronización SIRE consulta los últimos tres periodos sin retroceder más allá de `startPeriod`; el backend decide la ventana efectiva y aplica los mismos límites.

La configuración retornada contiene exclusivamente estado seguro: revisión, settings, RUC, marcas booleanas de existencia de credenciales, autorización de lectura, aprobación del host, permiso de gestión, estado y aviso. Nunca devuelve contraseñas ni client secret. Los tres campos de contraseña comienzan vacíos; cada valor vacío se omite en el PATCH y conserva el secreto anterior. Los valores ingresados sólo viven en memoria y en el cuerpo de esa petición, sin almacenamiento del navegador. Tras una respuesta exitosa de guardado se vacían. No se imprimen credenciales ni errores del servidor que pudieran reflejarlas.

El borrador conserva su `expectedRevision` original. Una revisión nueva detectada en segundo plano no reemplaza campos. Ante discrepancia o HTTP 409, se conserva el borrador y se solicita usar **Cargar configuración actual**, acción explícita que descarta campos y secretos locales. No se sobrescribe automáticamente una configuración concurrente.

## Preparación TI y gates definitivos

| Variable del backend | Preparación / alcance |
| --- | --- |
| `RECEIVED_SETTINGS_KEY_FILE` | Ruta al archivo de clave de cifrado de settings/credenciales. TI monta y protege la clave en los procesos que la requieren. Nunca se envía al navegador ni se guarda en el repositorio. |
| `RECEIVED_LIVE_READ_ALLOWED` | Por defecto `false`. Gate del servidor para lecturas reales; se habilita sólo con autorización separada de TI. Guardar settings o elegir LIVE_READ_ONLY no cambia este flag. |
| `RECEIVED_IMAP_APPROVED_HOSTS` | Lista de hasta 16 hostnames exactos aprobados por TI para IMAP, separados por comas, sin URLs, IP ni comodines. El servidor recorta espacios y normaliza a minúsculas; todos los hosts deben pasar su validación. |
| `RECEIVED_LOCAL_FIXTURE_ENABLED` | `true` únicamente en QA con RUC ficticios de prefijo `00`. El backend impide fixtures en otros RUC. |

TI aprueba el hostname IMAP exacto, proporciona la clave mediante archivo protegido y autoriza por separado el gate de lectura real. El módulo usa el microservicio de recepción y un worker BullMQ separado, con configuración, almacenamiento, cola y ejecución aislados por RUC. El checkpoint UID del buzón vive en el backend/worker y avanza junto con las importaciones realizadas, con lectura IMAP sin modificar mensajes. El navegador no programa jobs, almacena checkpoints ni realiza conexiones IMAP/SIRE.

La UI muestra `liveReadAllowed`, `mailHostApproved`, `state` y `notice` del servidor. La aprobación del host corresponde al valor **guardado**, no al hostname todavía editado en el formulario. Mientras hay campos pendientes, la consulta manual queda bloqueada. La preparación LIVE_READ_ONLY se puede guardar con `liveReadAllowed=false`, pero sus botones de lectura quedan bloqueados y se informa **Esperando TI**. No hay botón para saltarse el gate.

**LIVE_READ_ONLY no es SOAP beta.** Se refiere a consultas reales de compras, con lectura real desactivada durante QA hasta autorización separada de TI. No debe deducirse autorización para estas conexiones a partir de permisos o habilitaciones de emisión en SOAP beta. Esta entrega se prueba con datos ficticios, pruebas unitarias y circuito HTTP/PostgreSQL/BullMQ local; no realiza acciones externas ni conexiones reales con SUNAT.

## Correo, XML y alcance fiscal

IMAP es recepción de correos y adjuntos; SMTP es envío y tiene configuración separada. Guardar este panel no prueba servidores ni envía correos. El backend aplica host aprobado y los gates antes de leer fuentes externas.

SIRE puede informar metadatos de compras sin entregar el XML completo. `PENDING` significa **XML pendiente**; se requiere recibir o adjuntar el XML del proveedor por el flujo existente. `CONFLICT` requiere revisión. Sólo `MATCHED` con `documentId` permite **Ver documento**; pending/conflict no enlazan documentos, aunque una respuesta incluya un ID. Los importes o nombres ausentes se muestran como no informados, sin inventar datos ni filas de ejemplo. Un listado vacío declara que no hay ítems informados.

Este flujo no emite comprobantes, no acepta propuestas, no presenta RCE, no registra aceptación fiscal y no altera el circuito de emisión. Los contadores describen detección, importación, duplicados, rechazos, XML pendientes, coincidencias y conflictos retornados por el backend.

## Incidentes SIRE

Los registros SIRE no conciliables aparecen en **Incidentes SIRE de este RUC**, exclusivamente para administración global autorizada. La vista muestra identificador, periodo, ordinal, código y fecha de observación. Los códigos se presentan tal como los devuelve el servidor, escapados por React, sin inventar un comprobante ni enlazar un documento. Un listado vacío declara que no hay registros no conciliables informados; los incidentes no acreditan aceptación fiscal.

La respuesta pública contiene sólo `{items}` y los cinco campos de metadatos de cada incidente. La UI valida el array completo, sus tipos, periodos, ordinales enteros no negativos, fechas de observación e identificadores únicos. Rechaza toda la respuesta ante campos adicionales, incluidos `rawRecord`, contenido de registros o credenciales, sin imprimir el cuerpo rechazado ni errores que lo reflejen. El scope queda fijado por empresa seleccionada, permisos y cancelación; ASSIGNED no solicita este endpoint.

## Actualización y validación

La primera lectura usa `useResource` sin su sondeo de 15 segundos. El panel mantiene instantáneas y consulta en segundo plano cada **20 segundos**. El sondeo no solapa sus solicitudes, espera a que termine la carga inicial y omite ticks con la página oculta. Los fallos de actualización conservan la última instantánea válida y se muestran discretamente. Configuración con error de lectura bloquea las acciones hasta recuperar un estado seguro.

No se instala un refresco en foco, no se reemplaza el formulario durante los polls y no se abre un modal de configuración. Los eventos de actualización del provider también conservan el borrador. Las peticiones de fondo y mutaciones se cancelan al desmontar o cambiar scope; completados tardíos no publican datos ni mensajes. Los incidentes usan la misma actualización quieta de 20 segundos: ante errores conservan los últimos metadatos válidos y muestran un aviso genérico.

`ReceivedList` es el único dueño de `setDirty` en la bandeja. Agrega `importDirty` (archivos seleccionados u operación de importación/exportación) y `automationDirty` (borrador o mutación del panel). El callback estable `onDirtyChange` atraviesa Panel, Scope y Manager. El panel no escribe `setDirty`; sólo publica su estado propio y lo limpia al desmontarse. Terminar una importación no limpia un borrador de automatización, y guardar automatización no limpia archivos seleccionados. El agregado se publica sin un cleanup entre cambios de estado; el dueño limpia `setDirty` únicamente al desmontar la bandeja.

Pruebas locales: `pnpm exec vitest run tests/received-automation-ui.spec.ts --maxWorkers=2`. Cubren helpers, guard de recursos por permisos/sede, gates, revisión, secretos vacíos, campos shadcn accesibles, renders vacíos, enlaces sólo MATCHED, rechazo de respuestas ajenas, metadatos de incidentes sin registros completos, escape HTML, sondeo de 20 segundos, cancelación tardía y agregado de cambios pendientes. Estas pruebas de UI no realizan conexiones externas.
