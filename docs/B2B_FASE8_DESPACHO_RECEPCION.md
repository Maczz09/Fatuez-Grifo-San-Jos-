# B2B-08: ejecución local de tareas de recepción

Fecha: 25/10/2026. Incremento candidato; no desplegado en localhost:8091.

## Resultado y alcance

Las tareas creadas por la API pueden ejecutarse mediante un worker separado del
procesador anterior. La ejecución entregada admite exclusivamente `LOCAL_FIXTURE`,
`LOCAL_ONLY`, `BETA` y RUC ficticios. Está desactivada por defecto. No abre SIRE,
OAuth, IMAP, SMTP ni conexiones fiscales. No interpreta credenciales guardadas
como autorización para conectarse.

`SYNC_CREATE` conserva su respuesta compatible `QUEUED / NOT_DISPATCHED`:
describe la creación, no una ejecución ya terminada. Después de que el worker
privado la procese, `SYNC_READ` devuelve el estado y los contadores persistidos.
`runtimeEnabled=false` sigue describiendo la configuración de conectores reales;
una prueba local completada no activa esa configuración ni acredita SUNAT.

## Flujo y datos

1. La API guarda la tarea y su actor original, ámbito RUC/sede, revisión de
   conexión, revisiones de identidad y decisión independiente `SYNC_CREATE`.
   La pertenencia y la concesión se comprueban también mediante SQL candidato.
2. El dispatcher consulta tareas B2B pendientes y publica únicamente `{runId}`
   en la cola exclusiva `b2b-received-dispatch-v1`. La cola anterior no consume
   tareas nuevas con prefijo `b2b/`.
3. El ejecutor vuelve a consultar los metadatos en PostgreSQL. Comprueba la
   conexión y obtiene autorización vigente para el actor que creó la tarea.
   Necesita la concesión independiente `SYNC_EXECUTE`, sin herencia automática
   de lectura o creación. MAIL exige además `b2b:received:write` y su concesión
   independiente `IMPORT`.
4. MAIL procesa mensajes MIME ficticios mediante el parser real. Reutiliza el
   comando de importación con sus permisos, originales XML, ítems decimales y
   journal. No crea un usuario humano ni convierte USER en SERVICE.
5. SIRE procesa registros ficticios con el parser existente. Guarda observaciones
   completas y comparaciones por RUC y sede en `B2bReceivedDispatchObservation`.
   Si no hay XML, marca pendiente; no inventa XML, ítems, firma ni CDR.
   Estas observaciones tienen su propio almacenamiento candidato y no alimentan
   automáticamente las tablas ni pantallas del sincronizador anterior.
6. Una transacción del propietario confirma importaciones, observaciones,
   contadores, estado final y comprobante de ejecución. La comparación sólo
   consulta documentos del destinatario y sede autorizados. Coincidir en importes
   no acredita autenticidad, aceptación ni confianza fiscal.

El ensayo visita como máximo los tres periodos recientes, limitados por
`startPeriod` y por la fecha de creación de la tarea. Su alcance queda estable
en los reintentos. MAIL concilia únicamente las observaciones de esos periodos,
sin incorporar compras de otros meses. Una tarea sin periodos válidos queda bloqueada.

## Permisos, interrupciones y recuperación

El propietario debe inyectar `ReceptionDispatchAuthority`: devuelve una
credencial nueva del actor original y una aprobación ligada al hash del contexto,
con identificador y vencimiento máximo de cinco minutos. USER requiere comprobar
administrador general vigente, revisión actual y MFA. SERVICE mantiene sujeto y
administrador humanos nulos. No se almacenan Bearer ni handles de elevación en
PostgreSQL, Redis o los comprobantes de ejecución. Este incremento define el
puerto y lo ensaya con autoridad ficticia; no configura un proveedor real ni
prolonga automáticamente la autorización interactiva de una persona.

Las concesiones y la identidad se revalidan antes, durante y al cerrar la
transacción. Cambios de actor, ámbito, revisión o aprobación bloquean la tarea.
Modificar la configuración invalida las tareas anteriores. Los estados y
errores publicados pertenecen a un vocabulario cerrado.

El bloqueo transaccional por empresa coordina configuración y ejecución.
`RUNNING` es transitorio dentro de esa misma transacción: los lectores externos
observan la tarea pendiente o su resultado confirmado. Si el proceso cae, se
revierte el trabajo completo, incluido `RUNNING`, y sigue pendiente para otro
intento. No se utilizan leases vencibles que permitan dos escritores simultáneos.

Una entrega concurrente devuelve `BUSY`; PostgreSQL conserva la tarea pendiente.
BullMQ elimina sus entregas terminadas/fallidas para que el sondeo pueda volver
a publicarla. La protección contra duplicados reside en la transacción y el
journal, no en conservar un job de Redis para siempre. Los fallos transitorios
consumen hasta tres intentos persistidos; los conflictos de serialización se
reintentan sin confirmar efectos. Los errores técnicos no exponen secretos,
cuerpos de respuestas ni mensajes del controlador de base de datos.

`B2bReceivedDispatchAttempt` conserva intentos y autoridad como metadatos
inmutables. La BD comprueba estado, secuencia, contadores y concesiones vigentes
del comprobante final. Las tablas candidatas no se instalan al iniciar la app.

## Ensamblaje privado

`createB2bReceptionDispatchRuntime(dependencies, {enabled:true})` ensambla el
núcleo y BullMQ. Requiere puertos explícitos de base de Recepción, Identity,
concesiones de automatización/escritura, aprobación de ejecución y conexión Redis.
Sin aprobación independiente, rechaza el inicio antes de conectar Redis.
Importar el módulo o guardar la configuración no inicia un worker.

Se usa sólo la base propietaria de Recepción. No expone un endpoint público RUN,
no comparte bases de Identity/Billing y no agrega emisiones ni Outbox fiscal.
Las APIs públicas existentes conservan Kong/mTLS y sus contratos.

Para un ensayo nuevo debe instalarse, en orden, el esquema de Recepción y sus
candidatos read, commands, automation y dispatch. El helper de pruebas hace esto
únicamente en una base nueva etiquetada, sin red, sin puertos y con tmpfs.
El candidato automation incorpora columnas de revisión/autoridad; no es un
script de actualización para una base previamente instalada. Un despliegue
posterior necesita un cambio aditivo revisado y tratamiento de tareas antiguas;
no se rellenan decisiones o revisiones históricas inventándolas.

## Verificación reproducible

```powershell
pnpm test:b2b-received-dispatch
pnpm test:b2b-received-dispatch:db
pnpm test:b2b-received-dispatch:redis
node tests/b2b-received-automation.e2e.cjs --isolated-synthetic-only
pnpm --filter @factuez/received-documents-service typecheck
pnpm --filter @factuez/received-documents-service build
```

Los ensayos no reciben URL de BD existente, credenciales del cliente ni archivos
reales. Resultados del 25/10/2026:

| Verificación | Resultado |
| --- | --- |
| Admisión, composición y transporte con dobles explícitos | 64 pruebas aprobadas en dos archivos |
| Ejecutor con PostgreSQL nuevo | 41 pruebas aprobadas: 39 con SQL real y dos de desactivación sin acceso a BD |
| BullMQ contra Redis nuevo | Ensayo aprobado: recuperación tras BUSY, tres intentos, payload estricto, errores sin secretos y cierre limpio |
| Configuración y creación de tareas previas | 40 pruebas aprobadas, incluidas 29 sobre PostgreSQL nuevo |
| SDK → HTTPS/mTLS → propietario → PostgreSQL nuevo | Dos casos aprobados; se mantiene la compatibilidad de configuración, cola y consulta |
| Contratos e inventario | 37 pruebas aprobadas; sin nuevas rutas públicas ni activación |
| Tipos del monorepo | 29 tareas correctas en 22 paquetes |
| Compilación | Microservicio de Recepción compilado correctamente |
| Regresión general | 265 archivos aprobados; 11.441 pruebas aprobadas, cero fallos y una omisión condicional preexistente; 292,99 s |
| Revalidación posterior del ejecutor y contratos | 101 pruebas aprobadas en cinco archivos, más los 41 casos finales del runner PostgreSQL |

Los grupos se solapan y no se suman como total único. El informe del ejecutor
está en `output/qa/b2b-received-dispatch-db.json`. El informe general está en
`output/qa/b2b-phase8-reception-dispatch-regression-final.json`; el ensayo final
de PostgreSQL y las 101 pruebas afectadas se repitieron después de endurecer el
reintento del comando anidado y copiar la aprobación antes de comprobarla.
El informe general anterior se conserva en
`output/qa/b2b-phase8-reception-dispatch-regression.json`.
Las conexiones reales y las bases del QA existente no se utilizaron.
La omisión de `fiscal-batch.spec.ts` requiere `FACTUEZ_FISCAL_XSD_PYTHON` y no se
cuenta como aprobación. Los contenedores temporales de los ensayos se retiraron
después de comprobar sus etiquetas de propiedad.

El ensayo SQL detectó un conflicto de inferencia de tipo al reutilizar el
parámetro de estado en un `CASE`; se corrigió con conversiones explícitas. El
conflicto de serialización dentro de un comando importador ahora reinicia la
transacción completa sin consumir un intento ni confirmar trabajo parcial. El
ensayo Redis detectó que el túnel mediante BusyBox `nc` conservaba su entrada
abierta tras `QUIT`; se corrigió únicamente el transporte del ensayo. No se
relajaron TLS, permisos o aislamiento para superar las verificaciones.

## Siguiente límite de activación

El [incremento de integración](B2B_FASE8_CIERRE_INTEGRACION.md) ya implementa
un protocolo separado `LIVE_READ_ONLY`, su fuente SIRE/IMAP, aprobación de
despliegue y obtención de credenciales SERVICE mediante OAuth/mTLS e Identity
vigente. Utiliza la cola exclusiva `b2b-received-read-only-v1`. El ejecutor local
de este documento sólo consume `LOCAL_ONLY`; no se retiran sus guards.

La conexión real sigue deshabilitada hasta aportar configuración y lectores de
secretos autorizados, permisos por aplicación/RUC/sede, hosts aprobados, esquema
aditivo revisado y piloto privado. Cambiar el texto del perfil o guardar una
configuración no activa el ejecutor. Las pruebas utilizaron fuentes ficticias,
sin peticiones a SIRE/IMAP. Correo corporativo y reportes ampliados también están
implementados y ensayados en el incremento enlazado; sus activaciones y los
gates fiscales permanecen independientes.
