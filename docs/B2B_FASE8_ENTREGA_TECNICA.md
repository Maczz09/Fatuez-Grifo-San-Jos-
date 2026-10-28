# B2B-08: integración técnica LOCAL/BETA

Actualizado: 25/10/2026. Entrega candidata, sin despliegue en 8091 ni cambios en sus bases.

Última verificación integrada: [recepción, correo corporativo y reportes
ampliados](B2B_FASE8_CIERRE_INTEGRACION.md). Regresión final: 275 archivos,
11.823 pruebas aprobadas, cero fallos y una omisión condicional preexistente.
Tipos globales y compilación aprobados. Las tablas de verificaciones anteriores
de este documento se conservan como antecedentes fechados.

## Alcance entregado

La fachada NestJS conserva los propietarios por microservicio. Cada módulo se
instala expresamente en `createB2bPhase8Application` o en la fábrica acumulada
`createB2bDraftApplication`; no hay acceso compartido a bases entre servicios.
El contrato Swagger candidato describe las operaciones. Declararlas en Swagger
no las publica en el stack existente ni concede permisos.

| Bloque | Implementación y límite comprobable |
| --- | --- |
| Aplicaciones B2B | Alta, lectura, revisión, revocación y rotación de secreto. Administrador humano vigente y elevación independiente; secreto sólo una vez. |
| Panel | Página conectada al BFF de sesión: SSO OIDC/MFA, revisión, confirmación y cierre. Tokens cifrados en servidor, CSRF en memoria y propietario con permisos vigentes. Requiere configurar/habilitar el proveedor y origen HTTPS privados; no está desplegado en 8091. |
| Clientes y productos | CRUD con revisión e idempotencia. Productos sobre `FuelProduct` existente; clientes en tablas candidatas. La política distingue catálogo compartido y acceso por ámbito. |
| Turnos y caja | Apertura, movimientos y cierre; importes decimales exactos, revisión, auditoría y un turno abierto por punto. Agregado candidato separado del POS: no se atribuyen cobros automáticos de ventas. |
| Compras recibidas | Listado, detalle por ítem, originales, importación XML, adjuntos CDR/PDF, asignación y registro. XML de hasta 64 KiB; adjuntar CDR admite XML original, no ZIP. Concesiones propias por destinatario/RUC/sede. |
| Conectores | Configuración cifrada, tareas idempotentes, ejecutor local y ejecutor separado `LIVE_READ_ONLY` con SIRE/IMAP, OAuth/mTLS de servicio y autorización vigente. Confirmación atómica de XML/ítems, adjuntos, observaciones, incidencias y cursor. Guardar sigue dejando `runtimeEnabled=false`; no inicia conexiones. Ver [integración preparada](B2B_FASE8_CIERRE_INTEGRACION.md). |
| Reportes | Dashboard y trabajos durables CSV/XLSX/PDF, captura estable y descargas verificadas. Fuentes propietarias 01/03/07/08/09/31/NV, autoridad independiente de lectura NC/ND y contrato compartido en API/SDK/Swagger. Guías sin ingresos; NV separado de ventas fiscales. XLSX/PDF requieren sus constructores explícitos. |
| Historial | Consulta y descarga del archivo sintético aislado con permisos originales, sólo lectura. No acepta historial real sustituyendo `SYNTHETIC` ni retirando guards. |
| Administración | Emisores, sedes, puntos, series, usuarios, roles, formatos, configuración fiscal y SMTP mediante sus servicios propietarios reales. USER con privilegios actuales, elevación y ámbito exacto; SERVICE nunca recibe ADMIN. |
| Correo | Solicitud y consulta de entrega, persistencia, worker, adjuntos comprobados, captura local y perfil CORPORATE con TLS y permiso independiente. Perfil predeterminado NONE. `SMTP_ACCEPTED` sólo acredita aceptación por el relay, no entrega al destinatario. Un resultado ambiguo no se reenvía automáticamente. |
| SDK | Cliente Node/TypeScript con mTLS para las 56 operaciones del bloque: recepción, negocio, reportes, administración, configuración, historial y correo. Tres clientes separados; no cubre por ello las 136 operaciones de todas las fases. |

Los permisos nuevos se añadieron al vocabulario con autorización del usuario.
Permanecen desactivados por defecto: no se concedieron a aplicaciones existentes.
Una concesión de lectura no habilita escritura, configuración o sincronización.

## Conexión y ensamblaje

El consumidor se conecta por HTTPS privado mediante Kong/VPN del despliegue
autorizado. Aporta un Bearer vigente, certificado cliente mTLS y ámbito. El
servidor vuelve a comprobar identidad y concesiones antes/después de cada acción.
No se utiliza la cookie de la PWA como token de una integración SERVICE.

Operaciones empresariales/administrativas utilizan el ámbito completo:
`issuerId`, `issuerRuc`, `environment=BETA`, `branchId`, `pointId`, `seriesId`,
`documentType`. Recepción utiliza `companyId`, `recipientRuc`, `branchId` y
`environment=BETA`. Los identificadores canónicos se consultan; una etiqueta de
serie no basta para determinar su propietario. Las operaciones con idempotencia
reciben `Idempotency-Key`; un timeout se concilia consultando el resultado antes
de crear una nueva solicitud. Los cambios con revisión rechazan versiones viejas.

En cada propietario se instala únicamente su módulo privado, con origen HTTPS
fijo, CA y huellas de pares permitidos:

- Identity: `B2bIdentityModule` / `createB2bIdentityApplication` para aplicaciones
  B2B, más `Phase8AdminOwnerModule` limitado a usuarios/roles.
- Billing: `B2bPhase8BusinessOwnerModule`, `B2bPhase8ReportsOwnerModule` y
  `Phase8AdminOwnerModule` limitado a maestros/formatos.
- Recepción: `B2bReceptionReadModule`, `B2bReceptionCommandModule` y
  `B2bReceptionAutomationOwnerModule`, con autoridad independiente de concesiones.
- Historial: `B2bHistoryOwnerModule`, sobre archivo nuevo sintético autorizado.
- Fiscal y SMTP: instancias separadas de `Phase8AdminOwnerModule`, limitadas a
  sus acciones; `Phase8AdminCapabilities` enlaza cada reemplazo con una decisión
  humana vigente del propietario.
- Correo: `createB2bEmailDeliveriesHandler` en modo OWNER_RPC, con almacenamiento,
  fuente de adjuntos y autoridad de ejecución explícitos. No se expone RUN por HTTP.

La fachada recibe adaptadores `Http...` a esos orígenes; el consumidor nunca
elige un destino privado ni envía claims administrativos en el cuerpo. Sin los
puertos/autoridades requeridos, el módulo no se instala o rechaza la operación.
La lista de acciones de cada propietario debe ser cerrada; no registrar todas
las acciones en todos los servicios.

Límites: JSON ordinario 128 KiB; reemplazos de certificado/logo/SMTP 1 MiB;
respuesta administrativa 2 MiB y PDF de previsualización hasta 1.500.000 bytes
antes de base64. Reportes descargables hasta 24 MiB; historial hasta 10 MiB.
Las descargas conservan MIME, longitud, SHA256, adjunto seguro y `no-store`.
Cambiar formato de PDF no reescribe XML, CDR ni hechos fiscales.

## Verificación reproducible

Desde la raíz del monorepo, con dependencias ya instaladas:

```powershell
pnpm typecheck
pnpm test:b2b-phase8
pnpm test:b2b-phase8:http-db
pnpm exec vitest run --maxWorkers=2 --testTimeout=30000 --hookTimeout=30000
```

Los runners PostgreSQL candidatos crean sus propias bases temporales en
contenedores etiquetados, sin red ni puertos y con almacenamiento tmpfs. No
admiten URL de base existente. No ejecutar DDL candidato sobre QA/producción.
Las pruebas usan XML, certificados, clientes y claves exclusivamente ficticios.
Resultado de la revisión integrada del 24/10/2026:

| Verificación | Resultado |
| --- | --- |
| Regresión completa final con panel/SSO | 263 archivos aprobados; 11.377 pruebas aprobadas, 0 fallos, 1 omitida condicional preexistente; 245,94 s |
| Tipos del monorepo | 29 tareas correctas en 22 paquetes |
| Compilación final de panel, Identity, BFF y dependencias | 8 tareas correctas; los demás servicios conservan su verificación previa |
| Inventario y contratos Swagger | 37 pruebas aprobadas; 338 rutas declaradas de servicios, 21 pantallas, 136 operaciones candidatas B2B (71 GET) |
| Administración privilegiada por HTTPS/mTLS | 35 pruebas aprobadas, incluido SDK público contra servicios propietarios reales con persistencia de prueba en memoria |
| Negocio/reportes/historial/aplicaciones por fábrica integrada | 8 pruebas aprobadas, incluido SDK de historial; dobles de almacenamiento/autoridad explícitos y motores reales |
| Recepción y automatización: HTTPS → propietario → PostgreSQL nuevo | 2 pruebas aprobadas: importación, replay, detalle/bytes originales, CAS, secretos write-only, tareas sin despacho y revocación |
| Negocio transaccional en PostgreSQL nuevo | 31 pruebas aprobadas |
| Reportes e historial sintético persistentes en PostgreSQL nuevo | 2 pruebas aprobadas |
| Automatización de recepción: unitarias y SQL aislado | 40 pruebas aprobadas, incluyendo 29 casos de integración |
| Correo: núcleo, HTTPS/mTLS, fábrica integrada y worker PostgreSQL nuevo | 37 pruebas aprobadas; exclusivamente captura local |
| Ampliación SDK, integración y contratos | 267 pruebas enfocadas aprobadas en 8 archivos; 31 operaciones adicionales verificadas |
| Panel/BFF/OIDC/MFA y sesiones | 487 pruebas específicas aprobadas; con contratos, 524 en diez archivos |
| Sesiones en Redis nuevo sin red ni puertos | Ensayo aprobado: cifrado, AAD, consumo único, TTL, cuotas y revocación |

Los grupos se solapan con la regresión general; no se suman como un total único.
La omisión condicional de `fiscal-batch.spec.ts` corresponde al ensayo XSD
NC/ND/RC/RA que requiere `FACTUEZ_FISCAL_XSD_PYTHON`; no se contabiliza aprobado.
El informe completo final está en
`output/qa/b2b-phase8-admin-sso-regression-final.json`. El informe previo al
panel/SSO se conserva en `output/qa/b2b-phase8-sdk-regression.json`; el previo
a la ampliación de 31 métodos, en `output/qa/b2b-phase8-regression-final.json`.

El primer intento de regresión detectó seis fallos por el reloj de dos fixtures:
creaban certificados con la fecha actual y comprobaban muestras del día anterior.
Se fijó sólo el reloj de esas pruebas para generar y verificar en el mismo
instante ficticio; los 15 casos criptográficos y la regresión posterior pasan.
No se relajaron controles de vigencia, identidad, firma, confianza o TLS.
También se corrigió la consulta de auditoría fiscal de la fachada, que intentaba
añadir la página a un objeto inmutable, y tres incompatibilidades del SDK con
SKU, importes acumulados y nombres de archivos válidos.

Los ensayos temporales finalizados no dejaron contenedores con sus etiquetas.
No se hicieron migraciones ni modificaciones en la base de QA.

## Pendientes reales y siguiente paso

Incremento del 25/10/2026: el [ejecutor local de recepción](B2B_FASE8_DESPACHO_RECEPCION.md)
tiene 64 pruebas unitarias, 41 casos de admisión/SQL y un ensayo BullMQ/Redis real
aislado aprobados. La regresión general llegó a 265 archivos y 11.441 pruebas
aprobadas, sin fallos y con una omisión condicional preexistente. El informe está
en `output/qa/b2b-phase8-reception-dispatch-regression-final.json`; el detalle
explica la revalidación posterior de las correcciones del propio ejecutor.

B2B-08 tiene estos bloques implementados en código candidato; **no se declara
paridad operativa completa**. El [BFF/SSO del panel](B2B_FASE8_PANEL_SSO.md) está
implementado y ensayado localmente; falta configurar y pilotar su proveedor real.
El [despacho local de recepción](B2B_FASE8_DESPACHO_RECEPCION.md) añade ejecución
por actor original, concesión independiente y recuperación. El
[incremento de integración](B2B_FASE8_CIERRE_INTEGRACION.md) incorpora el
ensamblaje SERVICE de SIRE/IMAP de sólo lectura, permiso de correo corporativo,
SMTP seguro, fuentes de reportes ampliadas y sus contratos públicos. Estos
bloques ya no requieren programar esos adaptadores; falta configurar, desplegar
y pilotar el acceso privado autorizado. Sigue pendiente el historial real.
Los productores de eventos nuevos deben integrarse y probarse;
añadir un nombre de evento al inventario no lo implementa.

El [SDK ampliado](B2B_FASE8_SDK_COMPLETO.md) cubre las 56 operaciones de este
bloque: negocio (12), reportes (4), comandos de recepción (4), aplicaciones (5),
administración privilegiada (22), automatización (4), historial (3) y correo (2).
Esta cobertura no equivale a todas las 136 operaciones candidatas de todas las
fases. El cliente operativo y los dos clientes administrativos mantienen
identidades y controles separados; no se concedieron permisos por ampliarlo.

B2B-09 debe ensamblar y ensayar el despliegue privado autorizado: identidades y
concesiones por aplicación, TLS/VPN/Kong, esquema aditivo por propietario,
respaldo/restauración, observabilidad, rotación/revocación y piloto consumidor.
El cliente configura sus secretos en la aplicación. No se ejecutaron llamadas
oficiales ni se activó producción. Las fases fiscales 2/3 y sus aprobaciones
conservan sus gates independientes; estos ensayos no acreditan aceptación SUNAT.
