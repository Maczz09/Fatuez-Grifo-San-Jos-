# SDK Node B2B: bloque concreto de fase 8

La [guía actual del SDK](../../B2B_FASE8_SDK_COMPLETO.md) describe las 56 operaciones del bloque B2B-08 y los 31 métodos incorporados después. El texto siguiente conserva los ejemplos del primer incremento de 25 métodos. Los resultados y límites de ese incremento son históricos; la guía actual recoge la integración posterior.

## Configuración explícita

```ts
const client = new FactuEzB2bClient({
  origin: approvedHttpsOrigin, // solo origen: sin ruta, usuario, query o fragmento
  tls: {
    ca: approvedCaBuffer,
    cert: approvedClientCertificateBuffer,
    key: approvedClientKeyBuffer,
    serverCertificateSha256: approvedServerDerSha256,
  },
  bearer: async () => ({ token: await currentOperationalToken(), actorKind: 'USER' }),
});
```

`actorKind` debe ser explícitamente `SERVICE` o `USER`. Cada salto HTTP consulta de nuevo el proveedor. El cliente no obtiene tokens de la PWA, no decodifica JWT, no envía cookies ni inventa permisos. CA, certificado, clave y pin SHA256 del certificado **DER** del servidor son obligatorios para ambos clientes; la validación de hostname y CA continúa activa. Las opciones se validan y los buffers TLS se copian. No se leen archivos, variables de entorno ni almacenes del sistema.

Administración requiere otra instancia y otro proveedor:

```ts
const admin = new FactuEzB2bAdminClient({
  origin: approvedHttpsOrigin,
  tls: explicitlyApprovedTls,
  adminBearer: () => currentHumanStepUpProof(),
});
```

`adminBearer` devuelve `Promise<string>` con prueba humana vigente que verifica Identity. No acepta ni utiliza `bearer`, `actorKind`, sesiones PWA o credenciales SERVICE como sustitución. No existe cliente admin implícito dentro del cliente operativo.

Los ejemplos `.ts` exportan funciones para invocación explícita; no se ejecutan al importarlos, no leen certificados, no imprimen ni persisten secretos. Usan imports relativos al código de este repositorio. En un consumidor del paquete se sustituye el import por `@factuez/b2b-sdk`.

## Negocio: binding completo y cuerpos públicos

Todos los métodos business reciben `BusinessBinding` con exactamente siete campos: `issuerId` entero positivo hasta 2147483647, `issuerRuc` de once dígitos, `environment:'BETA'`, `branchId`, `pointId`, `seriesId` UUID y `documentType:'01'|'03'`. El SDK lo convierte a siete parámetros query planos, sin enviar `binding` en el cuerpo. Los listados admiten `limit:1..100` (defecto del propietario: 50), `after:UUID` y `q` de hasta 100 caracteres. No se recorren páginas automáticamente.

| Método SDK | Ruta relativa a `/b2b/v1` | Cuerpo JSON |
| --- | --- | --- |
| `listCustomers(binding, query?)` | GET `/customers` | ninguno |
| `readCustomer(binding, id)` | GET `/customers/:id` | ninguno |
| `createCustomer(binding, body, options)` | POST `/customers` | `CustomerBody` |
| `updateCustomer(binding, id, body, options)` | PATCH `/customers/:id` | `{body, expectedRevision}` |
| `listBusinessProducts(binding, query?)` | GET `/business-products` | ninguno |
| `createProduct(binding, body, options)` | POST `/products` | `ProductBody` |
| `updateProduct(binding, id, body, options)` | PATCH `/products/:id` | `{body, expectedRevision}` |
| `listShifts(binding, query?)` | GET `/shifts` | ninguno |
| `openShift(binding, body, options)` | POST `/shifts` | `{openingAmount,currency}` |
| `closeShift(binding, id, body, options)` | POST `/shifts/:id/close` | `{countedAmount,reason,expectedRevision}` |
| `createCashMovement(binding, id, body, options)` | POST `/shifts/:id/cash-movements` | `{direction,amount,reason,expectedRevision}` |
| `businessSummary(binding)` | GET `/business-summary` | ninguno |

`options` requiere `idempotencyKey` de 16..100 caracteres `[A-Za-z0-9_-]`, enviado en `Idempotency-Key`. Update, close y cash requieren además `expectedRevision:1..2147483646`. El SDK no genera claves ni revisiones. Cada operación distinta necesita una clave distinta; repetir explícitamente la misma solicitud con la misma clave permite recuperar el resultado original. El cliente no reintenta errores de red, conflictos ni respuestas 429/503.

`CustomerBody`: `{identityType,identityNumber,legalName,address,email,active}`. Tipos de identidad: `1|4|6|7|A`; dirección y correo pueden ser null. `ProductBody`: `{sku,description,category,unitCode,taxAffectationCode,defaultUnitPrice,active}`. Precio puede ser null o decimal textual de hasta seis decimales; caja usa texto de hasta dos decimales, conservando precisión. Los patches son parciales y no vacíos. El propietario normaliza texto y escala; el SDK verifica esos valores en la respuesta.

Productos consulta `/business-products`; no ocupa ni cambia el GET legado `/products`. La autorización global humana para mutaciones del catálogo se verifica en el propietario. Los scopes y el binding del cliente no sustituyen `product.manage` ni step-up. Los demás accesos SERVICE también requieren su política explícita vigente en el propietario.

Respuestas: `schemaVersion:'factuez.b2b.business.v1'`, `environment:'BETA'`, `binding`, `candidateOnly:true`, `fiscalAuthority:false`, `data`, `operationId`, `replayed`; los listados añaden `nextCursor`. Se verifican campos exactos, contexto, orden, IDs y revisiones esperadas. Un replay no permite aceptar el ID de otro recurso.

## Recepción: comandos acotados

Todos reciben `ReceivedScope` exacto `{environment:'BETA',companyId,recipientRuc,branchId}` y `options:{idempotencyKey}`. El controlador de recepción admite claves de 16..128 caracteres. Cada upload es `{fileName,contentBase64}` con base64 canónico y **1..65536 bytes decodificados**. No se acepta una ruta de disco como nombre ni claves desconocidas/reservadas.

| Método SDK | Ruta | Cuerpo público |
| --- | --- | --- |
| `receivedImportXML(scope, file, options)` | POST `/received-documents` | upload XML |
| `receivedAttach(scope, id, body, options)` | POST `/received-documents/:id/artifacts` | `{kind:'CDR'|'PROVIDER_PDF',file}` |
| `receivedAssign(scope, id, body, options)` | PATCH `/received-documents/:id/assignment` | `{targetBranchId,expectedXmlSha256}` |
| `receivedRegister(scope, id, body, options)` | PATCH `/received-documents/:id/registration` | `{registeredAt,erpReference,expectedErpReference}` |

CDR es XML; provider PDF usa `.pdf` y firma `%PDF-`. `registeredAt` es null o instante ISO UTC con milisegundos. Las referencias ERP son null o texto de 1..120 caracteres sin controles. El SDK no sustituye los CAS `expectedXmlSha256` y `expectedErpReference` por una revisión inventada. Asignación requiere sucursal distinta y autoridad vigente para origen/destino en el servidor.

Respuestas: `schemaVersion:'factuez.b2b.received-command.v1'`, `scope`, `action`, `result`. Se comprueba el ámbito original, acción, ID de documento conocido, sucursal destino, outcome y `fiscalAcceptance:'NOT_VERIFIED'`. Import devuelve un ID nuevo o duplicado; esta respuesta no incluye hash del XML. El SDK no afirma verificar criptográficamente la asociación de un ID recién importado al XML: esa asociación y el replay transaccional corresponden al propietario. Las lecturas/descargas anteriores mantienen íntegra su validación de detalle, manifiesto y SHA256.

## Reportes: consultas tipadas y archivos finitos

`ReportFilters` del SDK usa `issuerId:number`, `environment:'BETA'`, `from/to` (años 2000..2099, rango máximo 366 días), `types?:('01'|'03')[]` y UUID opcionales `branchId/pointId/seriesId`. El SDK convierte issuerId y types al formato textual exacto del controlador, también dentro del body de create. Solo existe fuente `BILLING_01_03` en estos métodos.

| Método SDK | Ruta | Solicitud |
| --- | --- | --- |
| `dashboard(filters)` | GET `/dashboard` | filtros planos en query |
| `createReport(filters, format, options)` | POST `/report-jobs?environment=BETA` | `{filters,format}` + `Idempotency-Key` |
| `readReport(id)` | GET `/report-jobs/:id?environment=BETA` | sin body |
| `downloadReport(id)` | GET `/report-jobs/:id/content?environment=BETA` | lectura previa y posterior de metadatos |

Formatos cerrados `CSV|XLSX|PDF`; habilitar un renderer corresponde a la composición del propietario. Un formato no configurado devuelve error remoto finito. Dashboard/read necesitan `b2b:reports:read` y `b2b:documents:read`; create/content requieren además `b2b:reports:export`.

Se verifica `factuez.b2b.reports.v1`, `environment`, `source`, flags y forma de dashboard/job; ID esperado, estado y revisión del job, conteos (hasta 10000), formato, tipo MIME, tamaño y `b2b-report-UUID.ext`. La descarga admite hasta **24 MiB**, compara bytes/Content-Length/SHA256/Content-Type/Content-Disposition con metadatos y vuelve a consultar el job después. No acepta URLs de descarga suministradas por el servidor. Son tres solicitudes con credenciales nuevas, sin reintentos ni polling. La respuesta de metadatos del job no incluye filtros ni binding: la autoridad sobre el contexto guardado sigue siendo del propietario; el SDK valida los IDs y compromisos de integridad que sí expone el contrato.

## Administración: entrega explícita de secretos

| Método SDK independiente | Ruta `/b2b/v1/admin/applications` | Resultado |
| --- | --- | --- |
| `listApplications({limit?,after?}?)` | GET base | `{items,nextAfter}` + procedencia |
| `readApplication(id)` | GET `/:id` | `{application}` + procedencia |
| `createApplication(body)` | POST base | `{application,clientSecret?}` + procedencia |
| `updateApplication(id, body)` | PATCH `/:id` | `{application}` + procedencia |
| `rotateApplicationSecret(id,{expectedRevision})` | POST `/:id/rotate-secret` | `{application,clientSecret}` + procedencia |

Cada query incluye `environment=BETA`; listado tiene límite 1..50, defecto 25. Procedencia exacta: `schemaVersion:'factuez.b2b.v1'`, `source:'SOURCE'`, `environment:'BETA'`, `candidateOnly:true`. Metadatos exactos: `{id,label,kind,enabled,revision,oidcClientId,scopes,bindings}`. Create acepta label, kind, scopes, bindings y oidcClientId solo para USER. Update exige expectedRevision y al menos un cambio entre label/enabled/scopes/bindings. Rotate exige expectedRevision. No se envía una clave de idempotencia inventada para estas rutas: el contrato admin no la contempla.

SERVICE create/rotate devuelven un secreto de 43 caracteres una sola vez. USER create no devuelve secreto y no admite rotate. Lecturas y updates rechazan respuestas que incluyan secretos. El SDK no guarda ni registra los secretos; solo los devuelve al llamador explícito. El llamador debe entregarlos inmediatamente a su gestor de secretos, sin imprimirlos ni persistir el resultado en almacenamiento de navegador. La lista tipada e inmutable `AdminScopes` es un techo de vocabulario: no activa scopes, no concede permisos y no modifica defaults de Identity.

## Transporte y validación

- Operaciones, verbos y rutas cerrados; los clientes públicos no exponen request/get/post/path/url genéricos.
- Request JSON máximo **128 KiB tras codificar UTF-8**; upload máximo 64 KiB; respuesta JSON máximo 16 MiB, reducible con `maxJsonBytes:1024..16777216`; archivo recibido hasta 10 MiB; reporte hasta 24 MiB.
- Timeout 100..120000 ms (defecto 30000) incluye proveedor de credencial y HTTP. Sin redirecciones, reintentos, cookies, compresión ni paginación automática.
- Entradas separadas del objeto del llamador antes de await; sin getters, proxies, símbolos, campos no enumerables, claves de prototipo, toJSON ni ciclos.
- JSON de respuesta con UTF-8 estricto, claves duplicadas/reservadas rechazadas y esquemas exactos. Errores estables `B2bSdkError` sin cuerpo remoto, URL, PII, token, causa ni secretos.
- No hay métodos para exportar P12, SOL, cifrados o credenciales fiscales.

## Verificación local focalizada

```powershell
pnpm --filter @factuez/b2b-sdk typecheck
pnpm exec vitest run tests/b2b-sdk-phase8-public.spec.ts tests/b2b-sdk-phase8-adversarial.spec.ts tests/b2b-sdk-received.spec.ts --maxWorkers=2 --hookTimeout=30000 --testTimeout=20000
```

Las pruebas usan HTTPS/mTLS real en loopback con certificados efímeros. Business, administración y reportes ejercitan los controladores públicos y sus propietarios reales con stores sintéticos existentes; CSV/XLSX/PDF usan los renderers reales ya instalados. Recepción ejercita controlador y fachada reales con un puerto de propietario que registra solicitudes; no constituye prueba PostgreSQL de comandos recibidos. No se usan QA, servicios externos, `.env`, certificados de clientes ni producción. Los casos adversarios incluyen ámbito/acción/ID/replay/revisión ajenos, claves desconocidas/reservadas, JSON duplicado, hashes/headers alterados, redirección, tiempos agotados y límites exactos 64 KiB, 128 KiB y 24 MiB.

## Resultado de la revalidacion de archivos guardados

- SDK: `pnpm --filter @factuez/b2b-sdk typecheck` sin errores, sin emitir `dist`.
- Cuatro ejemplos TypeScript: comprobacion estricta sin errores y sin emitir archivos.
- Tres suites focalizadas juntas: 121/121 casos pasan (19 publicos nuevos, 46 adversarios nuevos, 56 de lectura existente).
- Despues de limpiar el fixture admin y ajustar tipos de la prueba publica, sus 19/19 casos se ejecutaron otra vez y pasan. La suite de lectura existente no se edito.
- Los dos specs nuevos no tienen diagnosticos TypeScript propios usando ESNext y `allowJs` para el fixture `.mjs` existente. Esta comprobacion acotada no certifica diagnosticos de dependencias ni reemplaza el typecheck de integracion de main.
- Sin `console`, `debugger`, pruebas `.only`/`.skip` ni caracteres UTF-8 de reemplazo en los archivos del bloque. No se ejecuto la suite global.

## Responsabilidad de main y limites de esta entrega

Main conserva Swagger, wiring y pruebas de integracion. Este bloque toma los controladores y propietarios reales como contrato y no modifica esos archivos. Las observaciones documentales de una lectura anterior no se consideran defectos pendientes verificados del estado actual de main.

La prueba del limite request de 128 KiB ejercita el transporte comun con texto UTF-8 multibyte, separado de los limites mas estrechos de los DTO. La prueba exacta de 64 KiB verifica admision del SDK mediante un servidor sintetico; no acredita procesamiento UBL ni persistencia PostgreSQL de un archivo de ese tamano. La prueba de 24 MiB verifica descarga e integridad con bytes sinteticos; los casos CSV/XLSX/PDF reales usan los renderers existentes con capturas pequenas.

El incremento original descrito aquí no completaba B2B-08. Los métodos de historial, configuración/sincronización de recepción, maestros, formatos, configuración fiscal/SMTP y correo ya están incorporados en la ampliación. Emisión/borradores/guías/lotes de otras fases no forman parte de esta ampliación del SDK. El despliegue y la activación privada siguen siendo independientes.
