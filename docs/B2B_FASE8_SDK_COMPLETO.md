# B2B-08: cobertura del SDK Node/TypeScript

Fecha: 24/10/2026. Código candidato LOCAL/BETA. No desplegado en 8091.

Este incremento completa el cliente tipado de las **56 operaciones del bloque
B2B-08**: 25 ya disponibles y 31 añadidas. Conserva además los métodos previos
de consulta/descarga de documentos recibidos. No significa que el SDK cubra las
136 operaciones de todas las fases ni que se haya activado el despliegue.

## Clientes y credenciales

| Cliente | Uso | Identidad |
| --- | --- | --- |
| `FactuEzB2bClient` | Negocio, recepción, reportes, historial y correo | Bearer vigente SERVICE o USER según autorización del propietario. Configurar conectores exige USER y verificación adicional. |
| `FactuEzB2bAdminClient` | Aplicaciones B2B: alta, revisión y rotación de secreto | Proveedor separado `adminBearer`, con autoridad humana vigente; no reutiliza automáticamente el Bearer operativo. |
| `FactuEzB2bOwnerAdminClient` | Maestros, usuarios, roles, formatos y configuración fiscal/SMTP | Proveedor `bearer` que devuelve USER delegado. El transporte rechaza SERVICE antes de enviar; el propietario comprueba además roles y verificación adicional vigentes. |

Todos requieren origen HTTPS fijo, CA, certificado/clave cliente mTLS y huella
SHA256 del certificado DER del servidor. Se mantienen hostname, CA y TLS 1.2
como mínimo. Cada petición obtiene de nuevo su credencial; no utiliza cookies
de la PWA, almacenes del navegador, JWT decodificado ni variables implícitas.
No hay reintentos automáticos, redirecciones, paginación automática ni permisos
otorgados por construir un cliente. Las claves no aparecen en `JSON.stringify`
ni en la inspección de las instancias.

## Las 31 operaciones añadidas

Las rutas son relativas a `/b2b/v1`. Los métodos de administración reciben el
ámbito completo como primer argumento. Los IDs de emisor/sede/punto/serie se
derivan del ámbito; los usuarios y roles reciben su destino explícito.

| Cliente / método | Ruta |
| --- | --- |
| Owner / `readMasters` | GET `/admin/masters` |
| Owner / `createIssuer` | POST `/admin/issuers` |
| Owner / `updateIssuer` | PATCH `/admin/issuers/{id}` |
| Owner / `createBranch` | POST `/admin/branches` |
| Owner / `updateBranch` | PATCH `/admin/branches/{id}` |
| Owner / `createPoint` | POST `/admin/branches/{id}/points` |
| Owner / `updatePoint` | PATCH `/admin/points/{id}` |
| Owner / `createSeries` | POST `/admin/points/{id}/series` |
| Owner / `updateSeries` | PATCH `/admin/series/{id}` |
| Owner / `listUsers` | GET `/admin/users` |
| Owner / `createUser` | POST `/admin/users` |
| Owner / `updateUser` | PATCH `/admin/users/{id}/access` |
| Owner / `listRoles` | GET `/admin/roles` |
| Owner / `updateRole` | PATCH `/admin/roles/{id}` |
| Owner / `readPrintProfile` | GET `/admin/print-profiles/{id}` |
| Owner / `savePrintProfile` | PATCH `/admin/print-profiles/{id}` |
| Owner / `previewPrintProfile` | POST `/admin/print-profiles/{id}/preview` |
| Owner / `readFiscalConfiguration` | GET `/admin/fiscal-config/{id}/readiness` |
| Owner / `readFiscalAudit` | GET `/admin/fiscal-config/{id}/audit` |
| Owner / `saveFiscalConfiguration` | POST `/admin/fiscal-config/{id}/replacements` |
| Owner / `readSmtpConfiguration` | GET `/admin/mail-config/{id}` |
| Owner / `saveSmtpConfiguration` | POST `/admin/mail-config/{id}/replacements` |
| Operativo / `readReceptionConfiguration` | GET `/admin/received-connectors/{issuerId}` |
| Operativo / `saveReceptionConfiguration` | PATCH `/admin/received-connectors/{issuerId}` |
| Operativo / `createReceptionSync` | POST `/received-sync-jobs` |
| Operativo / `readReceptionSync` | GET `/received-sync-jobs/{id}` |
| Operativo / `listHistory` | GET `/history/documents` |
| Operativo / `readHistoricalDocument` | GET `/history/documents/{recordId}` |
| Operativo / `downloadHistoricalArtifact` | GET `/history/documents/{recordId}/artifacts/{kind}` |
| Operativo / `requestDocumentEmail` | POST `/documents/{id}/email-deliveries` |
| Operativo / `readEmailDelivery` | GET `/email-deliveries/{id}` |

El ámbito empresarial contiene `issuerId`, `issuerRuc`, `environment:'BETA'`,
`branchId`, `pointId`, `seriesId` y `documentType:'01'|'03'`. Recepción utiliza
`companyId`, `recipientRuc`, `branchId` y `environment:'BETA'`. Las operaciones de
correo crean su solicitud con el ámbito en el cuerpo; la consulta usa su ID sin
query. No introducir credenciales en parámetros de URL.

La prueba adicional de recepción se entrega mediante `options.stepUpHandle`;
viaja exclusivamente en `X-FactuEz-Step-Up`. La creación de tareas y correo usa
`options.idempotencyKey`, generado por el consumidor y enviado en cabecera.
Los métodos de actualización conservan `expectedRevision`; un conflicto no se
resuelve cambiando automáticamente esa revisión o repitiendo el comando.

## Integridad, límites y efectos

Se validan forma exacta, tipos, ID, ámbito, revisión e indicadores de cada
respuesta. El historial vuelve a comprobar su detalle antes y después de
descargar, además de nombre, MIME, tamaño, SHA256 y manifiesto de artefactos.
El SDK entrega bytes; no escribe archivos ni sigue URLs de almacenamiento.

Los cuerpos ordinarios siguen limitados a 128 KiB. Sólo los cuatro comandos
de formato/previsualización y reemplazo fiscal/SMTP admiten hasta 1 MiB.
Las respuestas nuevas tienen un máximo de 2 MiB; únicamente el base64 de la
previsualización PDF admite cadenas grandes en su ubicación esperada.
La previsualización devuelve bytes PDF comprobados, hasta 1.500.000 bytes.
Historial: hasta 10 MiB por descarga. El límite de reportes anterior permanece
en 24 MiB. Los errores no incluyen cuerpos remotos ni texto de credenciales.

Guardar una configuración no habilita emisión: `fiscalExecutionEnabled=false`.
Recepción mantiene `runtimeEnabled=false` al guardar y tareas `NOT_DISPATCHED`
al crearlas; la consulta muestra su resultado si un ejecutor privado autorizado
las procesa. El historial admite sólo el archivo sintético aislado. Correo
admite NONE, LOCAL_CAPTURE y CORPORATE; `deliveredToClient=false` se conserva
incluso con aceptación SMTP. No se llama SUNAT/SIRE/OAuth/IMAP ni
se envía correo real en estos ensayos. No se alteran concesiones existentes.

## Uso y verificación

Los [ejemplos](examples/b2b-phase8/remaining-operations.ts) exportan funciones:
importarlos no ejecuta peticiones ni carga secretos. En otra aplicación se
reemplaza el import relativo por `@factuez/b2b-sdk` y se aportan los accesos
privados autorizados. El Swagger candidato sigue siendo la referencia HTTP.

```powershell
pnpm exec turbo run build --filter=@factuez/b2b-sdk...
pnpm typecheck
pnpm exec vitest run tests/b2b-sdk-expanded-transport.spec.ts tests/b2b-sdk-owner-admin.spec.ts tests/b2b-sdk-operations-extra.spec.ts tests/b2b-phase8-admin-http.spec.ts tests/b2b-phase8-composition-http.spec.ts tests/b2b-extraction-contract.spec.ts tests/b2b-commercial-contract.spec.ts tests/b2b-source-audit.spec.ts --maxWorkers=2 --testTimeout=30000 --hookTimeout=30000
pnpm test:b2b-phase8:http-db
```

Resultados integrados del 24/10/2026:

| Verificación | Resultado |
| --- | --- |
| Paquete compilado | 22 métodos administrativos nuevos y 9 operativos nuevos exportados; sin despachador genérico público |
| Tipos del monorepo | 29 tareas correctas en 22 paquetes |
| Ejemplos copiables | Compilación TypeScript correcta; sin peticiones al importar |
| SDK, propietarios reales, seguridad y contratos | 267 pruebas aprobadas en 8 archivos |
| SDK de correo y worker PostgreSQL nuevo | 2 casos aprobados, exclusivamente captura local |
| SDK de recepción y automatización PostgreSQL nuevo | 2 casos aprobados, tareas sin despacho |
| Regresión completa | 256 archivos aprobados; 10.890 pruebas aprobadas, 0 fallos y 1 omisión condicional preexistente; 263,29 s |

Los grupos se solapan; no se suman sus cantidades. La prueba omitida de
`fiscal-batch.spec.ts` requiere `FACTUEZ_FISCAL_XSD_PYTHON` para el ensayo XSD
NC/ND/RC/RA; no se cuenta aprobada. El informe completo de esta ampliación está
en `output/qa/b2b-phase8-sdk-regression.json`. No se modificaron las bases de QA
ni quedaron contenedores temporales con las etiquetas de los ensayos terminados.

Este incremento no cierra la paridad operativa. El [BFF/SSO del panel](B2B_FASE8_PANEL_SSO.md)
ya está implementado como candidato local; falta configurar y pilotar su proveedor.
El [despacho local de conectores](B2B_FASE8_DESPACHO_RECEPCION.md) ya tiene
ejecutor candidato separado: `SYNC_READ` conserva su contrato y muestra el
resultado persistido después de procesar fixtures. Crear una tarea sigue
devolviendo `QUEUED / NOT_DISPATCHED`; el SDK no recibe permiso público RUN.
El [incremento de integración](B2B_FASE8_CIERRE_INTEGRACION.md) incorpora el
despacho SERVICE SIRE/IMAP preparado, correo CORPORATE y reportes
01/03/07/08/09/31/NV en el mismo SDK y API, sin añadir métodos genéricos ni
activar permisos. El SDK depende del paquete interno `@factuez/contracts` para
validar el contrato público; compilar con sus dependencias antes de distribuirlo.
El historial real, el despliegue/piloto privado de B2B-09 y los gates fiscales
originales conservan requisitos independientes.

Verificación integrada posterior del 25/10/2026: 275 archivos aprobados,
11.823 pruebas aprobadas, cero fallos y una omisión condicional preexistente.
La compilación y los tipos globales pasaron; el informe final y los límites
están en el documento de integración enlazado.
