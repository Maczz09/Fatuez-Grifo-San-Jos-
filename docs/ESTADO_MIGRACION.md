# Estado de migración

Actualizado: 2026-10-28

## Entrega operativa actual

El estado del 28/10/2026 se concentra en [emisión, notas, correo y conexiones](ENTREGA_CONEXIONES_Y_FACTURA01_20261028.md). Incluye actualización real del QA con respaldo, correo documental de notas, 83 operaciones documentadas y preparación del VPS aprobado; las anotaciones anteriores se conservan como historial y no acreditan activación productiva.

## Proyecto B2B de operaciones — avance actual

26/10/2026: [integración operativa y destino Ubuntu de B2B-09](B2B_FASE9_CIERRE_OPERATIVO_UBUNTU.md).
Añadidos coordinación por fases, control operador mTLS, comprobación independiente
de conexiones/contenedores, arranques privados de Identity, recepción, webhooks y
exportaciones, runtimes Billing/SUNAT, PostgreSQL TLS explícito, cierre completo de
schedulers/publishers y vault versionado de webhooks. Se conserva BETA y el stack
existente; no se ejecutaron migraciones, envíos fiscales ni despliegue VPS.

**B2B-09 continúa abierta.** Los entrypoints completos Billing/SUNAT, la autoridad
servidora step-up de recepción, los arranques de correo/historial y el respaldo
integral operativo siguen siendo trabajo de desarrollo nuestro, no documentos o
plugins que deba aportar el cliente. Se entrega un
[Compose de revisión del VPS](B2B_FASE9_VPS_UBUNTU.md) con límites agregados de
6.912.212.992 bytes, loopback y rutas fuera de `/var`; permanece bloqueado para
arranque hasta completar integración y revisión.

Compilación de propietarios: once tareas correctas; tipos globales: 29 tareas
correctas. Regresión ejecutada de 310 archivos: 12.420 aprobadas, cuatro fallos y
una omisión XSD preexistente. Tres fallos requieren Docker Desktop, actualmente
no disponible; el cuarto fue la auditoría de dos rutas privadas nuevas, corregida
y comprobada mediante un foco posterior de 83 pruebas aprobadas/cero fallos.
No se declara regresión íntegra verde ni piloto privado cerrado. Los informes y
los pendientes concretos están en el documento de integración enlazado.

26/10/2026: [rotación de la clave de acceso B2B-09](B2B_FASE9_ROTACION_CLAVES_IDENTITY.md)
implementada como opción privada de Identity. Firma nueva con clave activa,
verificación de tokens previos por hasta 300 segundos desde el cambio, JWKS
privado sin parámetros secretos y metadatos locales de rotación. Conserva
introspección, permisos y revocación vigente; no cambia certificados SUNAT.
Foco de 82 pruebas aprobado, incluidos dos ensayos HTTP/mTLS con reinicio
simulado y claves ficticias. Compilación y tipos globales correctos. No se
desplegó ni se rotaron claves reales; siguen coordinación de instancias y las
otras familias de claves y pendientes de B2B-09.
Validación final del incremento: 284 archivos, 11.924 pruebas aprobadas, cero
fallos y una omisión XSD preexistente. Se conservan los límites del ensayo;
la coordinación de réplicas, custodia y aprobación operativa no se infieren
del resultado de las pruebas.

26/10/2026: [retención de archivos de reportes B2B-09](B2B_FASE9_RETENCION_REPORTES.md)
implementada y probada en aislamiento. Planificación privada, política BETA
explícita por emisor, límites por edad/filas/bytes y retirada transaccional de
CSV/Excel/PDF con auditoría. Conserva capturas, claves e idempotencia; la API/SDK
responde 410 después de revalidar permisos y no regenera la misma solicitud.
Nueve ensayos PostgreSQL aprobados, foco de 132 pruebas y recuperación ampliada
correctos; compilación y tipos globales correctos. No se ejecutó el esquema ni
se activó limpieza en 8091. XML/CDR, comprobantes, series y Outbox permanecen fuera
de esta retención; B2B-09 continúa con sus otros pendientes.
Validación final: 282 archivos, 11.908 pruebas aprobadas, cero fallos y una
omisión condicional XSD preexistente. Ensayos retirados; sin recursos temporales
propios activos. Detalle y límites en el documento del incremento.

26/10/2026: [mantenimiento de workers B2B-09](B2B_FASE9_MANTENIMIENTO_WORKERS.md)
implementado: cierre completo de correo, webhooks y publicador de Billing, más
control local por propietario. Espera SMTP/Identity/Inbox y journal antes de
cerrar almacenamiento; los timeouts no fingen cierre. Redis y PostgreSQL nuevos
verifican recuperación sin reenvíos. No se desplegó ni se habilitó un cerco global
de escritura o autorización de respaldo real; B2B-09 conserva sus otros pendientes.
Regresión del bloque: 281 archivos, 11.901 pruebas aprobadas, cero fallos y una
omisión condicional preexistente. Quince pruebas nuevas, ensayos Redis/PostgreSQL,
tipos globales y compilación correctos; los recursos de ensayo se retiraron.

26/10/2026: [respaldo y recuperación B2B-09](B2B_FASE9_RESPALDO_RECUPERACION.md)
implementados y verificados en aislamiento: cápsula cifrada y restauración de perfiles
de reportes, recepción y correo. No constituye respaldo integral de FactuEz ni
habilita datos reales; el documento especifica los perfiles y límites del ensayo.
Se corrigió el search_path de las funciones candidatas de recepción y se preparó
un parche transaccional revisable, sin aplicarlo a instalaciones existentes.
Ensayo de recuperación aprobado y regresión de 279 archivos: 11.886 pruebas
aprobadas, cero fallos y una omisión condicional preexistente. Tipos globales
correctos y recursos temporales retirados. B2B-09 continúa abierta para sus otros
propietarios, retención, operación distribuida, despliegue y piloto privado.

25/10/2026 (Lima): primer bloque de [control operativo B2B-09](B2B_FASE9_CONTROL_OPERATIVO.md)
implementado: política BETA local de metadatos, pausa, cuotas, métricas privadas y
drain que espera el trabajo real incluso si el cliente se desconecta. Composición
separada con SDK/HTTPS y pruebas ficticias. No desplegado en 8091; B2B-09 no está
cerrada y el documento enumera los bloques técnicos y de piloto pendientes.
Verificación de este incremento: 119 casos enfocados aprobados y regresión final
de 278 archivos, 11.859 pruebas aprobadas, cero fallos y una omisión condicional
preexistente. Tipos globales y compilación aprobados. No modifica contratos de
rutas, concesiones, bases ni configuraciones del stack existente.

Incremento del 25/10/2026: [integración de recepción, correo y reportes de
B2B-08](B2B_FASE8_CIERRE_INTEGRACION.md). Implementados el ejecutor separado
SIRE/IMAP de sólo lectura, su ensamblaje SERVICE OAuth/mTLS y comprobación de
Identity vigente, permiso y transporte SMTP corporativo, reportes propietarios
01/03/07/08/09/31/NV y contratos API/SDK/Swagger. No se activaron conexiones,
permisos ni producción y no se desplegó este incremento en 8091. Los estados
históricos que siguen corresponden a entregas anteriores; el documento enlazado
registra el resultado integrado actual y los requisitos de configuración/piloto.
Regresión final del incremento: 275 archivos aprobados, 11.823 pruebas aprobadas,
cero fallos y una omisión condicional preexistente. Tipos globales: 29 tareas
correctas; compilación de los paquetes afectados y dependencias: 10 tareas
correctas. Ensayos PostgreSQL/Redis nuevos finalizados y retirados.

Actualización del bloque B2B-07: [entrega y verificación final](B2B_FASE7_CIERRE_TECNICO.md).
Implementados productores persistentes 09/31, autoridad Identity independiente,
referencia pública 09 autenticada, originales XML/firma/ZIP/CDR locales,
RC1/RC2/RC3/RA con SERVICE/USER, journal e historial PostgreSQL y APIs mTLS.
**B2B-07 cerrada técnicamente en LOCAL/BETA**: 9.910 pruebas aprobadas, una omisión
preexistente y cero fallos; tipos globales y ensayos PostgreSQL/criptográficos
aprobados. Despliegue/piloto y transmisión fiscal oficial son gates distintos y
no están activados. B2B-08 tiene una [entrega técnica integrada
LOCAL/BETA](B2B_FASE8_ENTREGA_TECNICA.md): administración delegada y panel,
clientes/productos, turnos/caja, recepción por API, conectores preparados,
reportes, historial sintético, configuración y correo de captura local.
Los permisos nuevos permanecen desactivados por defecto. La entrega especifica
pruebas, límites y pendientes reales de paridad/activación. No desplegado en 8091.
El [SDK de B2B-08](B2B_FASE8_SDK_COMPLETO.md) ya cubre sus 56 operaciones,
incluidos los 31 métodos de administración, conectores, historial y correo que
faltaban. Esto no cubre el resto de operaciones de otras fases ni activa servicios.
Regresión posterior a la ampliación: 256 archivos, 10.890 pruebas aprobadas,
cero fallos y una omisión condicional preexistente. Tipos globales correctos.
El [panel SSO/BFF](B2B_FASE8_PANEL_SSO.md) ya tiene cliente, sesión cifrada,
OAuth/OIDC con PKCE, autoridad humana vigente y pruebas locales. Su habilitación
requiere proveedor y enrolamiento privados; no se configuraron datos reales.
Regresión posterior al panel/SSO y cierre global: 263 archivos, 11.377 pruebas
aprobadas, cero fallos y una omisión condicional preexistente. Panel y servicios
compilados, tipos globales correctos y ensayo Redis nuevo aislado aprobado.
El [despacho de recepción](B2B_FASE8_DESPACHO_RECEPCION.md) incorpora un worker
candidato LOCAL_FIXTURE separado de la automatización anterior: actor original,
concesión independiente de ejecución, importación XML/ítems y resultados
transaccionales con recuperación. No activa el perfil real SIRE/IMAP ni se
despliega en 8091. Se verificaron 64 pruebas unitarias, 41 casos de admisión/SQL
y un ensayo BullMQ/Redis nuevo aislado. La regresión general pasó 265 archivos y
11.441 pruebas, con cero fallos y una omisión condicional preexistente. Las
correcciones finales del ejecutor se revalidaron con sus pruebas afectadas y SQL.
Sus evidencias y límites se registran en ese documento.
El [primer incremento de lectura y SDK](B2B_FASE8_RECEPCION_Y_SDK.md) conserva
sus resultados históricos; no es el estado completo actual. Las etapas fiscales
2/3 y sus aprobaciones mantienen sus gates independientes.

La API B2B integral es un proyecto separado de la extracción privada anterior y
de las etapas fiscales históricas. [Plan por fases](PLAN_B2B_OPERACIONES_Y_WEBHOOKS.md).

- B2B-01: contratos e inventario de fuente.
- B2B-02: identidad SERVICE/USER y adaptadores aislados; SSO/MFA y activación real
  pendientes. Política predeterminada sin ampliar los grants actuales.
- [B2B-03](B2B_FASE3_LECTURA_Y_EXTRACCION.md): lectura 01/03, archivos originales,
  PDF local vigente, cortes/exportaciones/feed B2B implementados y ensayados.
  Persistencia técnica probada en PostgreSQL NUEVO; propietarios de negocio
  ficticios. No habilitados en Kong/Swagger del stack actual.
- [B2B-04](B2B_FASE4_BORRADORES.md): implementación técnica candidata completada.
  Borradores y emisión atómica local 01/03 con actor SERVICE/USER, contador,
  Document/ítems, operación, idempotencia y Outbox en UNA transacción. Recuperación
  sin renumerar y diario de fan-out independiente; 11 comprobaciones PostgreSQL
  real NUEVO aprobadas. No desplegada ni habilitada para envío oficial.
- [B2B-05](B2B_FASE5_WEBHOOKS.md): circuito candidato de webhooks de emisión
  LOCAL 01/03 implementado/ensayado, con firma SDK, Inbox, fan-out, permisos,
  retries, dead-letter/replay y panel integrable. Siete comprobaciones aprobadas
  sobre tres BD nuevas. No desplegado; otros productores y fiscal oficial cerrados.
- [B2B-06](B2B_FASE6_NOTAS_COMERCIALES_Y_CORRECCIONES.md): notas de venta no fiscales,
  edición/cierre/cancelación y conversión local atómica a 01/03 implementadas y
  ensayadas; registro de solicitudes NC/ND/baja conservado como intención sin
  ejecución fiscal automática. [Productor empresarial y journal V2](B2B_FASE6_PRODUCTOR_Y_JOURNAL_V2.md):
  preparación propietaria, reservas dinámicas, recibos idempotentes y
  nota/ítems/correlativo/Outbox/journal en UNA transacción; consulta de detalle y
  conciliación de resultados mediante evidencia privada. Nuevas rutas candidatas
  `correction-notes`, sin publicar el laboratorio ni quitar guards de V1.
  Perfil individual F07/F08 sobre original 01/PEN/BETA; los demás perfiles fallan
  antes de numerar. **Implementación técnica candidata terminada para ese perfil;
  NO desplegada ni habilitada para transmisión oficial/producción.**
  Regresión final: 177 archivos, 6.516 aprobadas, una omitida, cero fallos;
  28 tareas de tipos correctas y 42 grupos PostgreSQL nuevos aprobados para el
  productor/journal. Las pruebas no equivalen a PKI o piloto fiscal del cliente.
  RC/RA, notas B, historial fuera del par, versiones de lotes y guías conservan su
  gate y alcance B2B-07; no se prometen como habilitados por terminar este perfil.
  [Ensayo sintético anterior](B2B_FASE6_RESERVAS_FINANCIERAS.md): conserva sus
  restricciones y no se transforma en productor retirándolas.
  [Autorización de series NC/ND](B2B_FASE6_AUTORIZACION_SERIES_NOTAS.md): concesión
  explícita y versionada del par original–serie de nota, autoridad privada,
  auditoría y revalidación SERVICE/USER implementadas y ensayadas aisladamente.
  No cambia grants existentes ni activa emisión fiscal. El ensamblaje V2 usa la
  autoridad pareada y el puente privado sin compartir bases entre propietarios.
  [Verificación 21/10](B2B_VERIFICACION_2026-10-21.md): regresión completa,
  permisos persistentes en dos BD ficticias y comunicación privada HTTPS/mTLS.
  [Evidencia propietaria individual](B2B_FASE6_EVIDENCIA_DOCUMENTO_PROPIETARIO.md):
  lector SUNAT, XML completo, firma del emisor y CDR compuestos para 01/F07/F08;
  no se modifica la activación fiscal.
  [Composición y resultados](B2B_FASE6_COMPOSICION_Y_RESULTADOS.md): evidencia
  RC/individual/ZIP, prerrequisitos y resultados aceptados/rechazados candidatos
  implementados; 256 comprobaciones del nuevo bloque y 42 grupos PostgreSQL
  aislados. Regresión final: 5.993 aprobadas, una omitida, cero fallos.
  [Puente privado de evidencia](B2B_FASE6_PUENTE_PRIVADO_EVIDENCIA.md): consulta
  HTTPS/mTLS, callback Billing/Identity y lector propio candidatos implementados,
  con 192 comprobaciones del nuevo bloque. Regresión más reciente: 6.185
  aprobadas, una omitida, cero fallos; 43 grupos PostgreSQL aislados y tipos
  correctos en esa verificación anterior. No desplegado. El productor V2 nuevo
  completa las reservas dinámicas y recuperación idempotente del perfil individual;
  no amplía la autoridad de lotes/historial de otras series ni ejecuta un corte.
- [B2B-07](B2B_FASE7_GUIAS_BORRADORES.md): primer bloque candidato implementado:
  borradores empresariales 09/31, permisos explícitos, CRUD versionado,
  idempotencia y persistencia/auditoría transaccionales. Siete rutas adicionales
  documentadas; sin numeración, originales, transmisión ni despliegue. Ensayo
  PostgreSQL nuevo: 30 grupos aprobados; no altera ventas/correlativos/Outbox.
  Regresión del primer bloque: 182 archivos, 7.191 aprobadas, una omitida, cero fallos;
  675 pruebas específicas nuevas y 28 tareas de tipos correctas.
  La fase continúa con productor fiscal de guías, archivos, lotes y recuperación;
  READY sólo congela un borrador, no autoriza traslado. Fases 8/9 pendientes.
  [Segundo bloque](B2B_FASE7_PREPARACION_UBL09.md): preflight de sólo lectura para
  READY 09/privado/04 y constructor UBL de preparación aislado, sin firma ni número
  reservado. Contrasta emisor/revisión/hash y mantiene cerrados los gates fiscales.
  895 pruebas nuevas, diez grupos PostgreSQL y XSD estructural aprobados.
  Regresión del segundo bloque: 187 archivos, 8.086 aprobadas, una omisión condicional
  preexistente, cero fallos; tipos correctos en 28 tareas de 21 paquetes.
  [Tercer bloque, 22/10](B2B_FASE7_MAPA_ESTABLECIMIENTOS.md): mapa local por
  emisor/sede, historial/CAS/auditoría y comprobación estricta de origen/destino
  en el preparador. Configuración administrativa, no registro verificado por
  SUNAT; no asigna números ni habilita traslado. Conserva los gates oficiales.
  284 pruebas propias aprobadas; 38 grupos PostgreSQL nuevos y 28 tareas de tipos
  correctas. Regresión general: 190 archivos, 8.338 aprobadas, una omisión anterior,
  cero fallos; las 32 pruebas nuevas del adaptador SQL se ejecutaron aparte tras
  la enumeración de esa corrida. [Verificación 22/10](B2B_VERIFICACION_2026-10-22.md).
  [Cuarto bloque, catálogos/bienes](B2B_FASE7_CATALOGOS_Y_BIENES.md): política
  local por RUC, referencia versionada, clasificación explícita y huellas del
  maestro compartido, historial/CAS/auditoría y ensamblaje estricto con el mapa.
  Bloquea bienes regulados/desconocidos, ítems libres y productos modificados;
  no deduce una clasificación legal ni acredita catálogo oficial vigente.
  235 pruebas específicas y 22 grupos PostgreSQL nuevos aprobados; sin despliegue,
  numeración, firma o transmisión. [Verificación del bloque](B2B_VERIFICACION_CATALOGOS_2026-10-22.md).
  Regresión general más reciente: **195 archivos, 8.605 aprobadas, una omisión
  condicional preexistente y cero fallos**; incluye todas las pruebas anteriores
  de establecimientos y las nuevas del catálogo/política de bienes.
  [Quinto bloque, diario de envíos](B2B_FASE7_DIARIO_ENVIO_GUIAS.md): intención
  persistente antes de despachar, estado incierto, conciliación y consulta de
  ticket; unicidad fiscal por RUC/tipo/número, historial append-only y rechazo
  de respuestas contradictorias. Coordinador exclusivo de emulador local: no
  conecta REST oficial ni declara verificado un CDR. 163 pruebas nuevas, 22 grupos
  PostgreSQL nuevos y tipos correctos en 28 tareas. Regresión más reciente: **198 archivos, 8.768 aprobadas,
  una omisión condicional preexistente y cero fallos**.
  [Verificación](B2B_VERIFICACION_DIARIO_GUIAS_2026-10-22.md).
  La descarga del XSL oficial enlazado devolvió 403; no se inventó su ejecución.
  [Sexto bloque, productor atómico local](B2B_FASE7_PRODUCTOR_ATOMICO_GUIAS.md):
  numeración explícitamente vinculada a una serie DESPATCH_ADVICE existente,
  cabecera/ítems/recibo/evento local en una transacción, permisos separados de
  WRITE del borrador y recuperación idempotente. Contexto de establecimientos,
  bienes y maestros comprobado dentro de la misma transacción. Agregado propio
  de guías; no inventa importes de venta ni publica eventos fiscales anteriores.
  Perfil candidato 09/privado/04, no desplegado ni habilitado para traslado.
  Verificado el 23/10: 187 pruebas específicas nuevas aprobadas, 22 grupos
  PostgreSQL nuevos aprobados y 28 tareas de tipos correctas. Regresión general
  más reciente: **202 archivos, 8.955 aprobadas, una omisión condicional
  preexistente y cero fallos**, en 211,79 segundos.
  [Verificación del productor](B2B_VERIFICACION_PRODUCTOR_GUIAS_2026-10-23.md).
  [Séptimo bloque, API y permisos](B2B_FASE7_API_Y_PERMISOS_GUIAS.md): concesión
  independiente persistente de emisión, CAS/auditoría y revocación por cliente,
  validación de USER/SERVICE y tres series, catálogo RPC propietario y dos rutas
  candidatas de emisión/consulta. No modifica grants existentes o defaults ni
  publica rutas en el stack activo. 532 pruebas específicas del circuito de guías
  aprobadas juntas; 25 grupos PostgreSQL del productor/lectura y diez grupos
  de concesiones en dos bases nuevas aprobados. Tipos correctos en 28 tareas
  de 21 paquetes. Regresión integral final: **212 archivos, 9.300 aprobadas,
  una omisión condicional preexistente y cero fallos**, en 183,49 segundos.
  [Verificación de API](B2B_VERIFICACION_API_GUIAS_2026-10-23.md).
  Siguen pendientes despliegue/piloto autorizado, integración de consulta/UI,
  reglas oficiales, XML numerado definitivo/firma,
  referencias/31 completo, PKI/CDR, lotes y conexión autorizada del diario.

[OpenAPI candidato de 65 operaciones](b2b/openapi.candidate.v1.json).
Es evidencia de código/pruebas, no un despliegue de los endpoints ni aceptación
SUNAT. No se cambiaron contadores, historial, firewall, Kong ni bases del cliente.

## Registro previo de avances

Nuevo proyecto: **API privada de extracción**,
[fase 1: inventario técnico](INTEGRACION_PRIVADA_FASE1_INVENTARIO.md).
27 fuentes / 96 referencias verificadas y 7 pruebas locales aprobadas, sólo
código: 01/03 con lectura interna; 07/08 con persistencia preparada y productor
bloqueado; 09 en laboratorio separado; 31 con lector offline/plantilla, no emisión
empresarial comprobada. XML/CDR requieren resolver originales y lotes con permisos.
No se consultó BD/archivos del cliente ni se creó/activó API remota.
Nuevo avance: [fase 2 del contrato privado](INTEGRACION_PRIVADA_FASE2_CONTRATO.md)
terminada como diseño y código puro: 17 operaciones / 37 esquemas OpenAPI,
tipos, filtros, consulta por clave fiscal, permisos de lotes, manifiesto de
exportación y contexto de cursor; 106 pruebas del contrato aprobadas. Sin
endpoints activos, autenticación M2M ni despliegue. Siguiente: fase 3 de identidad
de integración, no confundir estas fases con las etapas fiscales 2/3 históricas.
Verificación de esta entrega: 163 pruebas / 4 suites relacionadas y 7 del
inventario PASS, tipos compilados; no es la regresión general ni un piloto HTTP.

Nuevo avance: [fase 3 de identidad técnica privada](INTEGRACION_PRIVADA_FASE3_IDENTIDAD.md).
OAuth client_credentials, JWT/audiencia/clave independientes, clientes con scopes
y grants canónicos BETA, rotación/revocación por revisión, auditoría transaccional
y cuotas PostgreSQL. Ejecutable separado, HTTPS/mTLS obligatorio y loopback;
desactivado por defecto, sin modificar PWA/Kong/BD o contenedores QA existentes.
95 pruebas nuevas; 258 pruebas / 6 suites relacionadas PASS, 7 de inventario PASS
y 21 comprobaciones de persistencia en PostgreSQL nuevo/desechable PASS. No es
activación remota ni cierre fiscal. Siguiente: fase 4, lectura autorizada/XML/CDR;
despliegue/migraciones autorizadas y VPN/Kong/piloto permanecen posteriores.

Nuevo avance: [fase 4 de lectura privada y originales](INTEGRACION_PRIVADA_FASE4_LECTURA.md).
Microservicio de integración separado, lectura de snapshots empresariales BETA
01/03/07/08 mediante propietarios Billing/SUNAT, consulta por clave fiscal,
catálogos paginados, RC singleton/múltiples y RA, descarga íntegra XML/ZIP/CDR
con autorización de todos los miembros, revocación y auditoría fail-closed.
09/31 se declaran no soportados, sin usar laboratorios como fuentes empresariales.
117 pruebas nuevas; 375 / 9 suites relacionadas PASS, 7 del inventario PASS;
22 checks Prisma en dos PostgreSQL nuevos/ficticios PASS. Todo compilado.
Sin despliegue, DDL en bases existentes, cambios de ventas/contadores, envíos
SUNAT ni publicación remota. Siguiente: fase 5, corte/listado/exportaciones;
consistencia masiva y feed durable aún no preparados. No cierra fiscalidad
ni migración histórica; runtime y fuentes reales requieren ensayo/autorización.

Nuevo avance: [fase 5 de cortes/exportaciones privadas](INTEGRACION_PRIVADA_FASE5_CORTES_EXPORTACIONES.md).
Listado estable y detalle del mismo corte, captura Billing RepeatableRead READ ONLY,
servicio exportador independiente con BD técnica/cifrado AES-GCM, JSONL + manifiesto
y ZIP de originales, idempotencia transaccional, cola durable/leases, caducidad,
cuotas y reautorización íntegra de CDR compartidos. No conserva tokens para el worker.
Cobertura 01/03/07/08; 09/31 no soportados y checkpoints aún null. Perfil inicial
acotado: 10 000 documentos/16 MiB por captura, 64 MiB por ZIP, no el techo de 2 GiB.
298 pruebas nuevas y 616 / 11 suites de integración PASS; 7 de inventario PASS.
Regresión general: 4659 PASS / 120 suites, una omisión condicional preexistente
de XSD por no configurar FACTUEZ_FISCAL_XSD_PYTHON, ninguna omisión nueva.
30 checks en PostgreSQL nuevo/ficticio con 1 201 documentos PASS; resultados
en el documento de fase 5. Compilación verificada, runtime QA existente intacto.
No se activó API/Kong, ni DDL en BD existentes, producción, emisión o envío SUNAT.
Siguiente: fase 6 (feed/checkpoints); conexión VPN/Kong y piloto TI, fases 7/8.
No cierra fiscalidad ni migración histórica ni representa aceptación oficial.

Nuevo avance: [fase 6, feed/checkpoints privados](INTEGRACION_PRIVADA_FASE6_CAMBIOS.md).
Diarios transaccionales por RUC/propietario, barrera Billing en el mismo corte
MVCC y vector SUNAT conservador, eventos de originales/lotes/CDR, permisos
íntegros, replay cifrado durable y recuperación por época/piso. No usa Outbox
de emisión ni correlativos fiscales. 214 pruebas nuevas PASS; regresión 4 873
PASS / 124 suites, una omisión XSD preexistente; siete de inventario y 86 checks
en PostgreSQL nuevo/ficticio PASS. Todo compilado, sin instalar SQL en bases
existentes ni activar la API. Checkpoints dejan de ser null sólo al habilitar
explícitamente el feed y tener el scope correspondiente. 09/31 no soportados.
Siguiente: fase 7, entrada privada VPN/Kong; piloto y datos reales, fase 8.

Nuevo avance: [fase 7, entrada privada VPN/Kong/HTTPS](INTEGRACION_PRIVADA_FASE7_RED.md).
Renderer de red cerrado BETA, Kong separado con las 17 operaciones exactas,
mTLS de entrada y hacia propietarios, CA/CRL, cuotas/tamaño/conexiones y
preflight de sólo lectura preparados. 170 pruebas nuevas / dos suites PASS;
Kong real con servidores/credenciales ficticios: 122 checks y uno adicional
fuera del CIDR permitido PASS, limpieza de recursos nuevos PASS. Regresión
general 5 043 PASS / 126 suites, una omisión XSD preexistente, ninguna nueva.
Los 14 servicios QA siguen saludables y no se reiniciaron. Sin activación VPN,
firewall, clientes, DDL o API remota; producción y SUNAT no se utilizaron.
Perfil actual LINUX_HOST_LOOPBACK, dentro de Linux nativo o VM Linux: no cambia
el anfitrión Windows ni conecta automáticamente al loopback de Windows.
Instalador/perfil simplificado Windows aún no construido; requiere confirmar
la versión del cliente. 09/31 siguen no soportados por la extracción empresarial.
Siguiente: fase 8, piloto integrado autorizado, carga/recuperación y aprobación
TI. Esta preparación no cierra fiscalidad ni migración histórica.

Nuevo avance: [fase 8 iniciada, piloto local y Windows 10/11](INTEGRACION_PRIVADA_FASE8_PILOTO_WINDOWS.md).
Diagnóstico opt-in de metadatos Windows/WSL/Docker local, sin instalación,
reinicios, red remota o activación. Ensayo de cinco apps Nest HTTPS con claves
TLS ficticias independientes y repositorios exclusivamente en memoria:
OAuth HTTP, cuatro tipos, corte/detalles, XML/CDR original/RC, export/manifest,
idempotencia, lease, cifrado, replay, épocas, revocación y fallas fail-closed.
66 pruebas nuevas / dos suites PASS; regresión 5 109 PASS / 128 suites y una
omisión XSD preexistente. Requisitos iniciales de esta estación Windows 11 x64
PASS con piloto pendiente; no equivalen al servidor o datos del cliente.
Destino Windows 10/11 confirmado; falta perfil privado Desktop específico,
instalador/arranque y ensayo VPN/red, SQL/permisos y recuperación en copia
autorizada, carga y conciliación/aceptación TI. Windows 10 requiere revisar
soporte/edición antes de aprobarlo. No reutilizar LINUX_HOST_LOOPBACK en Desktop.
09/31 y PDF no expuestos conservan límites explícitos; sin producción o SUNAT.
Fase 8 sigue abierta: no es respaldo de BD real, piloto remoto ni cierre fiscal.

Nuevo incremento de fase 8: [operación Windows y recuperación aislada](INTEGRACION_PRIVADA_WINDOWS_OPERACION.md).
Candidato estricto BETA con relay TCP nativo, Kong en loopback, límites reales
de conexiones por IP y cuota HTTP agregada, sin confiar en headers; paquetes
nuevos y planes acotados de operación, no instalador o arranque automático.
72 pruebas nuevas y 242 relacionadas PASS, tipos estrictos PASS; 32 checks de
dump/restauración cifrada, inventario/original ficticio y permisos/triggers en
dos bases nuevas PASS. El ensayo inicial Docker Desktop no pasó: Kong running
con 502 interno hacia owner nativo y ECONNREFUSED desde Windows; conectividad
pendiente, no activación. No se cambiaron ajustes Desktop/firewall/VPN y se
limpiaron sólo recursos temporales etiquetados. Los 14 servicios QA healthy,
sin reiniciar. Restauración de diarios empresariales y recuperación/aceptación
en destino, fuentes 09/31 y PDF siguen pendientes; ningún cierre fiscal.
Regresión final: 5 181 PASS / 130 suites, una omisión XSD preexistente y siete
checks de fuentes PASS. Ensayo Desktop fallido documentado por separado; no
forma parte de esas pruebas aprobadas ni habilita el candidato Windows.

Corrección posterior autorizada — 10/10/2026: se confirmó host networking
desactivado en Docker Desktop 4.70.0 y se habilitó exclusivamente esa opción por
el contrato local de la propia aplicación. Desktop reinició automáticamente;
se recuperaron los mismos contenedores QA sin recreación ni migraciones.
**Dos ejecuciones con 15 checks E2E Desktop PASS cada una** (conectividad,
relay, rutas y negativos TLS/CRL),
limpieza de fixtures PASS, 14 servicios healthy y `/login` HTTP 200. Esta evidencia
posterior resuelve el fallo de loopback en esta estación; no valida VPN/IP real,
firewall, host del cliente o instalación/inicio automático. No se modificaron
producción, credenciales o gates fiscales ni se conectó a SUNAT/SIRE. Fase 8
continúa abierta por esos pendientes y por las fuentes/recuperación restantes.
Tipos estrictos, 242 pruebas relacionadas y siete checks de fuentes repetidos
PASS; la regresión general anterior no se repitió ni se infla con los E2E.

Nuevo incremento: [recepción automática](RECEPCION_AUTOMATICA_TI.md) sobre la
[bandeja de proveedores](DOCUMENTOS_RECIBIDOS.md). Configuración segura por RUC,
conector SIRE de lectura, buzón IMAP, worker BullMQ programado y conciliación con
XML/ítems completos, sin sobrescribir originales. Asignación administrativa de
sede y notificaciones Socket.io autorizadas. Microservicio/PostgreSQL propios,
detrás de Kong; QA localhost:8091 usa únicamente fixtures y bloquea conexiones
externas. No altera ventas, correlativos, emisión o gates de fases 2/3.
Ver [evidencia y límites](RECEPCION_AUTOMATICA_VERIFICACION.md): 4.043 pruebas
generales aprobadas y ensayos HTTP/BD/worker locales. La activación real requiere
accesos y autorización de TI; no se afirma validación oficial de SUNAT/IMAP.

## Fase actual

Nuevo incremento: [implementación técnica y entrega de fases 2/3](ETAPA2_3_CIERRE_TECNICO_Y_ENTREGA.md).
Diagnóstico offline 01/03/07/08 con firma/CDR, CLI de metadatos y preconciliación
exacta por RUC/moneda/tipo/serie; se conserva el lector 09/31 y el aislamiento
de los contratos SYNTHETIC. Sin importación, transmisión o alteración fiscal.
El cliente gestiona export/mapa/aprobaciones; no se exigen originales adicionales
para continuar desarrollo local. Sí quedan validación externa y trabajo técnico
de perfiles/reglas/activación: no se declara cierre fiscal ni corte histórico.
Corrección de estado: transporte Beta de notas F y RC/RA ya existe en código;
se reforzó su prueba local. No equivale a transporte oficial ensayado/habilitado.
Este incremento no se instala en la PWA ni modifica el runtime activo.
Verificación final: **3.506 pruebas / 100 suites PASS, ninguna omitida**;
TypeScript de evidence-core/Sunat aprobado y 9 casos firma/ZIP/XSD offline PASS.

### Evidencia anterior del 06/10 (no disponibilidad actual)

Incremento técnico local: [diagnóstico offline de guías/XML/CDR](ETAPA2_3_REVISION_OFFLINE_XML_CDR.md).
Lector versionado 09/31, verificación matemática histórica separada del perfil
SYNTHETIC y revisión previa de claves fiscales/origen en memoria. CLI con
manifiesto explícito RUC/periodo/archivos/SHA256 y salida privada de metadatos.
54 pruebas nuevas PASS y tipos aprobados; muestra autorizada reproduce guía
íntegra/CDR con digest incorrecto. No desplegado en UI/HTTP ni conectado a BD,
Outbox, emisión o SUNAT. Fases 2/3 siguen abiertas; ningún gate se modifica.
Regresión final de este incremento: 3.281 pruebas / 96 suites PASS, sin omisiones.
Comprobación de runtime al terminar aquel incremento: localhost:8091 no respondía; siete servicios
QA figuran detenidos previamente con exit 255. No se reiniciaron ni migraron.
Esa observación precede al levantamiento posterior solicitado; no describe
la disponibilidad actual. Este incremento no hace una comprobación del servidor.

Continuidad de pantalla: [renovación en segundo plano](SESION_CONTINUIDAD_QA.md).
Web conserva la referencia del perfil visual en renovaciones sucesivas para no
desmontar formularios/modales al volver a la pestaña. Token y vencimiento internos
se actualizan; revocación, permisos e inactividad siguen controlados por Identity.
Regresión final de continuidad: 3.227 pruebas / 95 suites PASS, sin omisiones.
Web instalado y saludable; los otros diez servicios no se recrean en este ajuste.

Incremento visual vigente: [diseño limpio de impresión](IMPRESION_DISENO_LIMPIO_QA.md),
renderer v4. Logo proporcional, cabecera agrupada, tablas suaves y visor
adaptable en Web. Se conservan las estructuras por tipo y los snapshots.
Once contenedores QA saludables; sólo Billing, Sunat y Web actualizados, los
otros ocho sin recrear. Regresión: 3.219 pruebas / 95 suites PASS, ninguna omitida.
No cambia el gate de fases 2/3/4 ni habilita operaciones oficiales.

### Evidencia del incremento anterior

Incremento visual instalado: [revisión detallada de los siete formatos A4 del
cliente](FORMATOS_REFERENCIA_QA.md), renderer v3 en Billing y Sunat. Cabeceras,
columnas, totales, variantes NC y bloques propios de GR/GT; datos y archivos
históricos preservados. Generación bajo demanda vigente, sin nuevos PDF
persistentes. Once contenedores QA saludables, sólo dos recreados, nueve con
el mismo ID. Producción, transmisión y workflow Beta siguen bloqueados.
Regresión final: 3.209 pruebas / 95 suites PASS, ninguna omitida, con XSD offline.
Compilación de contratos, renderer y ambos servicios PASS; 18 muestras locales
revisadas y 14 renders ficticios en las imágenes instaladas PASS.
No cierra fases 2/3 ni valida el binding semántico de migración para el PDF v3.

### Incremento anterior de datos y PDF bajo demanda

Nuevo incremento: [auditoría de datos y contextos](AUDITORIA_DATOS_PRESENTACION.md)
y [PDF bajo demanda](PDF_BAJO_DEMANDA.md). Negocio/QA separados explícitamente,
filtros SQL en totales/listados y selección de RUC obligatoria para GRE,
SUNAT/SMTP. PDF de consulta con renderer/perfil RUC-sede vigente y caché
privada temporal; snapshots, XML/CDR, hash y archivos históricos preservados.
Los nuevos eventos locales ya no persisten PDF de consulta.
**3.190 pruebas / 95 suites PASS**, tipos y build Billing/Sunat/PWA PASS.
Desplegado en `factuez-stage2-qa`: sólo esos tres servicios recreados, once
saludables y ocho sin cambios; local/intranet 200 y consultas anónimas 401.
Gates oficiales cerrados, sin migraciones, firmas reales o correos externos.
No cierra etapas 2/3 ni convierte las vistas de laboratorio en documentos oficiales.

### Incrementos anteriores (evidencia histórica)

CRUD de [emisores, sedes, puntos y series](CRUD_MAESTROS_QA.md) para administrador
general en QA/Beta: formularios shadcn, edición, desactivación/reactivación,
filtros de inactivos y correlativos de sólo lectura. RUC/propietarios y series
con historial protegidos; CAS, auditoría y locks transaccionales. Cuatro
columnas aditivas de estados/revisiones, sin `db push`, importación, cambio de
comprobantes o reinicio de numeración. Producción/transmisión siguen bloqueadas.
El desarrollo de este CRUD no cambia los gates pendientes de las fases 2/3.
**3.051 pruebas / 88 suites PASS**, build Billing/PWA PASS, seis checks de
PostgreSQL ficticio aislado PASS. Desplegado sólo en Billing y PWA del QA
`factuez-stage2-qa`: once contenedores saludables, nueve sin cambios, intranet
conservada y API administrativa anónima 401. Auditorías del CRUD, formatos y
entrega parcial PASS; prueba visual ficticia y gates oficiales cerrados.

Corrección visual solicitada: recuadro de RUC/tipo/número con fondo blanco, texto
oscuro y borde gris fino en 01/03/07/08/09/31, A4 y ticket. **2.965 pruebas/86
suites PASS**, TypeScript del renderer PASS y 17 muestras ficticias revisadas.
Desplegado sólo en Billing y Sunat del QA: once contenedores saludables, nueve
sin cambios, intranet conservada. Dos auditorías del renderer activo y cinco
checks del módulo PASS. PDF archivados intactos; sin producción, datos fiscales,
correlativos ni gates modificados. No cambia el estado fiscal de las fases 2/3.

Nuevo incremento de [formatos y logos por RUC/sede](FORMATOS_Y_LOGOS.md):
plantillas de boleta, factura, NC/ND y GR; GT 31 sólo vista previa local.
Módulo shadcn protegido, herencia RUC→sede, revisión CAS y volumen privado de
logos normalizados; presentación congelada para nuevos documentos. Los PDF
archivados conservan sus bytes. **2.953 pruebas/86 suites PASS**, 15 proyectos
TypeScript PASS y 17 muestras ficticias renderizadas sin texto fuera de página.
No modifica contador/serie, importa historial o habilita transmisión/producción.
Desplegado y verificado en `factuez-stage2-qa`, vía Kong en
`localhost:8091/print-settings` e intranet `192.168.100.5:8091`: sólo Billing,
Sunat y PWA recreados, once contenedores saludables y ocho sin cambios.
Cinco checks del módulo y seis GET de acceso/recursos públicos PASS; configuración
API protegida y gates oficiales cerrados. Prueba visual con identidad/emisor
ficticios en fixture aislado, no con credenciales reales del QA. Para revisar el
nuevo diseño sin emitir: Formatos y logos → PDF de prueba. Los PDF archivados no
se regeneran y pueden conservar su diseño anterior.

**Desarrollo de etapas 3 y 4 en paralelo; validación real y corte pendientes.**
Nuevo incremento de preparación de fases 2/3 con la
[entrega parcial del cliente](ETAPA2_3_ENTREGA_CLIENTE.md): tres RUC y 21 sedes
(17+3+1), contrato empresarial versionado y GET de sólo lectura protegido por
JWT/permisos, vista shadcn en Sedes y maestros y plantillas de mapa/alcance.
Los PDF y el Word no contienen XML/CDR originales ni un historial íntegro;
ubigeo numérico, establecimientos/puntos/series y autorizaciones siguen pendientes.
Diferencia de razón social marcada, sin inventar datos ni sobrescribir el emisor
inicial. Isotipo FactuEz en la pestaña, título conservado. No se importó historial,
crearon emisores/series, usaron claves reales, tocaron correlativos o habilitó
producción/transmisión. **Fase 2 fiscal no cerrada; fase 3 real sin corte.**
Verificación de este incremento: **2.783 pruebas/81 suites PASS, ninguna omitida;
15 proyectos TypeScript PASS; 6 checks GET de QA PASS**. Sólo Billing y PWA
recreados, once contenedores saludables y nueve sin cambios; cero RUC de la
entrega en los 46 chunks públicos auditados. BETA y gates oficiales cerrados.

Nuevo incremento local completado: [lectura/binding XML del perfil completo,
bytes PDF/QR, firmas/CDR ficticios y conciliación ampliada](ETAPA4_EVIDENCIA_COMPLETA_LOCAL.md).
Paquete puro `evidence-core` y runner CLI fijo BETA/SYNTHETIC, no API real o
cambio de los fixtures del panel. **314 pruebas nuevas/5 suites PASS;
2.684 pruebas/76 suites PASS, ninguna omitida; 21 tareas TypeScript PASS;
55 checks integrados PASS**, cuatro tipos y ocho representaciones, cero red.
A4 simple ajustado/revisado en una página; ticket y archivos archivados intactos.
No se desplegaron servicios, reiniciaron contenedores, aplicaron migraciones,
leyeron datos/certificados reales ni cambiaron correlativos. Verificación y
conciliación autorizadas con información real de San José siguen pendientes.

Se completó el [panel visual shadcn del modo sombra](ETAPA4_PANEL_VISUAL.md):
búsqueda/filtros, comparación por documento, XML y proyecciones declaradas,
anotaciones en memoria y exportaciones JSON/CSV. Vista móvil y claro/oscuro.
Exclusivamente cuatro fixtures integrados, sin datos reales, firma, envío,
persistencia de revisión o números fiscales. **2.370 pruebas/71 suites PASS,
ninguna omitida; 20 tareas TypeScript PASS**, incluidas 64 pruebas nuevas del panel.
El [primer comparador/CLI](ETAPA4_MODO_SOMBRA_LOCAL.md) conserva sus límites:
20 diferencias pendientes y cero efectos de emisión. No cierra etapas 2/3 reales;
captura real, binding/firmas/CDR/PKI sobre esa copia, PDF/QR del cliente,
conciliación aprobada y corte siguen pendientes. El nuevo laboratorio anterior
ya desarrolla esas herramientas con fixtures; no sustituyó la evidencia del panel.
Panel desplegado sólo en web-pwa del QA `factuez-stage2-qa`, a través de Kong en
`localhost:8091/shadow-lab`; once contenedores saludables y diez sin recrear.
Sin migraciones, envíos o cambios de producción. Prueba visual con identidad
ficticia aislada; no se abrió sesión con datos reales para validar la pantalla.

P1 multi-RUC/multi-sede implementado. P2 incluye representaciones PDF locales,
descargas autorizadas y configuración cifrada por RUC/ambiente; no se ha
habilitado emisión fiscal a SUNAT.

**Gate actual: etapa fiscal 2 no cerrada; importación/corte REAL de etapa 3 no iniciados.**
El usuario autorizó continuar **desarrollo de etapa 3 en paralelo**. Incremento anterior:
[consulta protegida y conciliación del historial](ETAPA3_CONSULTA_Y_CONCILIACION.md):
API NestJS de sólo lectura, JWT RS256/revalidación de identidad, rol lector,
totales exactos y comparación versionada. Exclusivamente BETA/SYNTHETIC;
API/Kong candidatos, sin despliegue o cambios en la intranet. Verificación de ese incremento:
**2.212 pruebas/66 suites PASS, ninguna omitida; 18 tareas TypeScript PASS;
24 checks E2E PASS**, incluida revocación tras leer archivos y consulta restaurada.
No datos reales, emisión, Outbox, contador o producción. Copia, mapa, confianza,
conciliación del cliente, integración activa y acta siguen pendientes.

Incremento anterior:
[historial persistente y restauración aislados](ETAPA3_PERSISTENCIA_Y_RESTAURACION.md):
contrato completo v1, repositorio Prisma separado, unique fiscal/origen,
checkpoint transaccional, archivo append-only y lectura interna por alcance.
Ensayo nuevo, sintético y temporal: 18 checks PostgreSQL PASS, 102 registros
restaurados y dos archivos verificados. Sin tablas/escrituras fiscales ni Outbox,
sin credenciales, datos reales, cambios de correlativos o envíos. No desplegado;
autenticación/API activa, copia/mapa/conciliación y acta siguen pendientes.
Regresión de ese incremento: **2.112 pruebas/63 suites PASS, ninguna omitida** con runtime
XSD offline; **18 tareas TypeScript PASS**. No se modificó Docker/intranet activos.

Primer incremento histórico:
[integridad de archivos y ensayo histórico por lotes](ETAPA3_BUNDLE_Y_ENSAYO.md):
SHA-256/tamaño de bundle ficticio, candidatos en memoria, reanudación y CLI local.
En ese primer incremento no había persistencia ni copias. Verificación histórica:
146 pruebas nuevas; regresión completa
1.993 pruebas/59 suites PASS sin omisiones con runtime XSD local, 15 tareas
TypeScript aprobadas y compilación aparte de migración. Ensayo ficticio: dos
archivos/294 bytes, dos candidatos, cero escrituras y revisión fiscal pendiente.
No hubo despliegue de servicios ni cambios de Docker/intranet en este incremento.
Nuevo [productor y laboratorio financiero](ETAPA2_PRODUCTOR_Y_CONCILIACION.md):
reserva interna y cola dedicada preparadas, guards cerrados; conciliación
versionada sólo en simulación, sin proyección persistida en Billing.
Ahora se prepara su [persistencia candidata](ETAPA2_PERSISTENCIA_CANDIDATA.md)
con contrato, repositorio y schema/blueprint; SQL sin aplicar y guard cerrado.
No hay escrituras financieras reales ni evidencia fiscal autenticada nueva.
Nuevo seguimiento de notas/lotes en el detalle y consumidor de evidencia con
Inbox e invalidaciones WebSocket; no proyección financiera. Ver
[seguimiento integrado](ETAPA2_SEGUIMIENTO_INTEGRADO.md).
Se preparó el [dry-run histórico de etapa 3](ETAPA3_PREPARACION_HISTORICOS.md)
sin leer RestoApp, importar registros ni cambiar correlativos.
Regresión del anterior incremento fiscal: 1.847 pruebas/56 suites y 15 tareas TypeScript aprobadas,
además de validación/generación Prisma sin conexión. Los contadores siguientes son históricos.
Despliegue del anterior incremento fiscal: sólo Billing/SUNAT, sin migraciones; once
contenedores saludables, 16 checks por Kong PASS y login local/LAN HTTP 200.

Los dos bloqueos
locales de recuperación XSD/preparación de lotes están corregidos y desplegados
en QA. Se integró un botón PWA de emisión/firma ficticia/SOAP interno/CDR simulado,
sin cambios fiscales en Billing. Regresión: 603 pruebas/31 suites y 15 tareas
TypeScript aprobadas. Ver [revisión](ETAPA2_REVISION_Y_GATE.md) y
[recuperación local](ETAPA2_RECUPERACION_LOCAL.md). No se necesitan nuevas
credenciales del cliente para continuar implementación local; la vertical oficial
continúa pendiente y la clave real no se utilizó en esta reparación.

Incremento posterior: [integración, pagos y notas](ETAPA2_INTEGRACION_Y_NOTAS.md).
Reserva/pipeline Beta 01/03 preparados con gate oficial cerrado; contado/crédito,
cuotas y PDF; transporte/CDR propio 07/08 simulado, avisos WebSocket y confianza
CDR fail-closed. Aquel incremento no cerró fiscalidad oficial ni inició etapa 3.

Circuito SOAP/CDR simulado añadido: tablas/red/flags aislados, RC QA firmado
y PDF QR/hash; gate XSD oficial versionado en el circuito QA, sin atribuir
validación retroactiva. Los laboratorios usan credenciales ficticias. Hubo un
piloto externo separado para 20615878481: una factura 01 Beta aceptada con
observación 4252, sin ventas/correlativos ni producción; no valida la vertical
automática ni cierra la habilitación. Ver [piloto](PILOTO_BETA_DESARROLLO.md) y
[ETAPA2_CIRCUITO_QA.md](ETAPA2_CIRCUITO_QA.md) para límites y bloqueos de cierre.

Completado:

- arquitectura de microservicios aprobada;
- Kong DB-less como único gateway publicado;
- separación de base, usuario, Prisma Schema y migraciones por servicio;
- contratos iniciales de integración SUNAT SOAP/REST y firma XML;
- infraestructura Docker Compose y persistencia on-premise;
- repositorio de destino creado en `D:\Facturacion\FactuEz`;
- módulo legado localizado en
  `D:\Restaurantes\la-barra-del-ceviche\apps\servicio-facturacion`;
- línea base verificada: 8 suites y 89 pruebas aprobadas;
- snapshot de referencia copiado sin generados ni artefactos compilados.
- contratos de eventos versionados y colas BullMQ implementados;
- emisión transaccional con correlativo, Idempotency-Key y Outbox;
- consumidor SUNAT con Inbox, UBL persistido y retorno asíncrono de estado;
- cálculo fiscal exacto y pruebas portadas.
- `identity-service` con usuarios, roles múltiples, permisos y asignación a
  puntos de emisión; JWT RS256 y JWKS interno;
- Billing protegido por permiso `document.issue`, sin confiar en `x-user-id`.
- Emisores RUC, sedes, puntos y series configurables; la distribución 21+1
  no se fija en código. Identidad y alcance verificados por cada servicio.
- PWA con componentes shadcn, dashboard, POS local, documentos, usuarios,
  roles y sedes. Logos San José/Mavric y créditos del desarrollador incorporados.
- Ticket de 80 mm y A4 locales de factura/boleta, con San José y FactuEz/Mavric,
  sin nombre personal ni frase de colaboración,
  desde snapshot inmutable; descarga por Kong con permiso y revocación.
- Configuración SUNAT por RUC/ambiente, sólo administrador global, certificados
  y credenciales cifrados AES-256-GCM, auditoría y revisión contra cambios concurrentes.

El estado detallado y los límites de cada incremento están en
[ETAPA1_AVANCE.md](ETAPA1_AVANCE.md), [MULTI_RUC.md](MULTI_RUC.md) y
[ETAPA2_AVANCE.md](ETAPA2_AVANCE.md) y [CONFIGURACION_SUNAT.md](CONFIGURACION_SUNAT.md).
La línea base de 89 pruebas anterior
corresponde al módulo legado, no a la suite actual de FactuEz.

El [incremento Beta posterior](ETAPA2_INCREMENTO_BETA.md) registra la base de
1.114 pruebas, 15 tareas TypeScript y el piloto separado FQ02-1: HTTP 200,
respuesta 0 sin observaciones, pero `CDR_UNVERIFIED`. No se reenvía ni acredita
aceptación fiscal. Los contadores de 603/89 anteriores son históricos.

## Inventario disponible

El análisis y el mapa de extracción están en
`docs/INVENTARIO_RESTOAPP_FACTURACION.md`. El snapshot de sólo lectura para la
migración está en:

```text
migration/legacy-reference/servicio-facturacion
```

RestoApp permanece sin cambios. No se harán envíos a SUNAT durante
descubrimiento, modo sombra ni conciliación.

## Primer corte vertical

Flujo local implementado para tipos 01 y 03:

```text
PWA -> Kong -> Billing -> Outbox/BullMQ -> SUNAT-service
    -> XML sin firmar + PDF de prueba -> evento -> estado local en Billing
```

Siguiente corte fiscal, pendiente y limitado inicialmente al piloto Beta:

```text
PWA -> Kong -> billing-service -> Outbox/BullMQ -> sunat-service
    -> firma/ZIP + transporte por perfil -> CDR -> evento -> WebSocket/PWA
```

Debe completar firma verificable, transporte de facturas y resúmenes de
boletas, CDR, QR/hash auténticos, contingencia fiscal y conciliación. Los PDF
actuales llevan advertencia de prueba y no sustituyen comprobantes fiscales.
La instalación anterior de localhost:8080 no se migra automáticamente: requiere
respaldo, ensayo sobre copia y corte controlado. QA usa un proyecto Docker y
volúmenes separados en localhost:8091.
