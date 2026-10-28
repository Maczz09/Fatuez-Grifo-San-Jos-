# B2B-09 — Integración operativa y destino Ubuntu

## Evidencia de versiones firmadas: avance del 27/10/2026

Se añadió un enlace candidato generación-historial que recibe una versión y
binding independientes, verifica XML y ZIP con el verificador histórico antes y
después de insertar y exige ZIP individual para 03. El ensayo con PostgreSQL
sin red aprobó **2 pruebas** 01/03 y relectura con otra conexión; la regresión
de panel, generación e historial aprobó **24 pruebas**
(`output/qa/factuez-ti-history-20261027.json`). Aún no está conectado al flujo
operativo: no sustituye una autoridad de versiones ni una publicación atómica
con recuperación, y no acredita catálogo completo o aceptación SUNAT.

El panel de TI muestra el estado SMTP consultado para el RUC seleccionado y
un enlace a su configuración, sujeto al permiso correspondiente. El estado no
acredita conexión ni envío. Esta mejora no está desplegada.

El arranque de un envío Beta preparado ahora vuelve a validar el ZIP individual
03 contra su XML y el XSD, conservando el ZIP RC como paquete de transporte.
Manifiestos anteriores sin este archivo siguen siendo legibles. El conjunto de
recuperación, preparación y empaquetado aprobó **8 pruebas** con dependencias
simuladas (`output/qa/b2b-individual-recovery-20261027.json`); typecheck SUNAT
aprobó. Esta comprobación no constituye una prueba de caída de proceso ni una
publicación atómica del historial.

Continuación: la preparación Beta de nuevas boletas genera el ZIP individual
del XML firmado y lo conserva por separado en `individualXmlZip` del manifiesto.
El ZIP de transporte sigue siendo el resumen RC; los documentos anteriores no
se reescriben. En el límite de firma y persistencia simulados aprobaron **36
pruebas** (`output/qa/b2b-individual-package-storage-20261027.json`) y el
typecheck SUNAT. El nuevo ZIP aún no está ligado al almacén histórico ni se
ha probado recuperación tras una interrupción entre archivos y transacción.

Se agregó un comparador candidato del diario V2 frente a un escaneo físico y
versiones de notas; la regresión de catálogo aprobó **33 pruebas**
(`output/qa/b2b-credit-catalogue-synthetic-20261027.json`) y typecheck Billing.
El escaneo es una interfaz simulada: la cobertura exhaustiva y el cerco común
siguen sin probarse; no habilita notas ni una declaración de completitud.

Continuación del bloque 1: el almacén PostgreSQL candidato para versiones exactas
se probó con concurrencia y protección contra mutación. Un ensayo adicional
con PostgreSQL nuevo sin red, XML firmado con claves efímeras y archivos físicos
verificó 01/03, lectura por handle y rechazo por alteración (3 pruebas). El
verificador de boleta enlaza en un ensayo aislado el XML individual, resumen
RC y CDR ficticio verificando sus huellas y miembro. La regresión combinada
aprobó **119 pruebas** (`output/qa/b2b-block1-integrated-20261027.json`); los
tipos de Billing y SUNAT aprobaron. Las políticas PKI/CRL son simuladas.

El almacén y los verificadores son candidatos no conectados al runtime; el
esquema no se aplicó a la instalación. Faltan la escritura autorizada en el
límite de firma y su publicación recuperable, permisos de almacenamiento, fuente
exhaustiva de créditos y cerco transaccional entre propietarios. Las pruebas
no demuestran procedencia ni aceptación oficial; el bloque no está cerrado.

Continuación: se añadió un verificador candidato que distingue el XML individual
03 del ZIP y XML del resumen RC. Una prueba aislada con archivos físicos,
claves efímeras y CDR ficticio comprobó que la huella del ZIP y el XML del RC
coinciden con la evidencia de aceptación, y que un CDR alterado se rechaza sin
hacer fallar la verificación separada del paquete. Aprobó **9 pruebas** junto a
los casos adversos (`output/qa/b2b-boleta-rc-cdr-physical-20261027.json`).
La regresión combinada anterior de firma, CDR, notas y RC aprobó **108 pruebas**
(`output/qa/b2b-block1-evidence-cdr-rc-20261027.json`).

El verificador de RC aún no está conectado al runtime: necesita fuente
propietaria durable y lectura consistente del snapshot, el resumen y el catálogo.
Los CDR, certificados y confianza del ensayo son ficticios; no se verificó
aceptación oficial ni se habilitaron notas o producción.

Nuevo avance del bloque 1: contrato candidato de versión histórica 01/03,
lector de archivos físicos y comparación independiente del diario de créditos
con inventario. El contrato distingue el ZIP individual del documento del ZIP
RC enviado. La comparación devuelve `NOT_PROVEN`: no convierte la coincidencia
en prueba de completitud. Ninguno de estos componentes está conectado al
runtime como fuente propietaria real.

La regresión combinada aprobó **100 pruebas**
(`output/qa/b2b-block1-evidence-cdr-20261027.json`); tipos de Billing y SUNAT
aprobados. Incluye XML y CDR firmados con claves efímeras en archivos físicos
para factura y notas 07/08, y resúmenes ficticios para boletas/notas; rechaza
CDR modificado. Los emisores, autoridades y confianza PKI/CRL son simulados;
los ZIP individuales de boleta son ficticios y no representan envíos oficiales.

Para cerrar el bloque aún es preciso un productor propietario durable en el
límite de firma, una autoridad de catálogo exhaustiva y cerco transaccional,
y reconciliar el ZIP individual de boleta con el resumen RC realmente enviado.
No se habilitaron notas, envío oficial ni producción con estos ensayos.

Ensayo adicional: se conectó el lector físico al verificador XML en una prueba
local con factura y boleta ficticias, y se confirmó el rechazo cuando el archivo
firmado se altera. El foco aprobó **55 pruebas**
(`output/qa/b2b-history-physical-xml-20261027.json`); la confianza PKI está
simulada y no hay CDR ni aceptación SUNAT. La boleta del ensayo usa un ZIP
individual ficticio. La emisión Beta existente envía un ZIP de resumen RC y el
verificador de miembro espera un ZIP con XML individual: falta resolver ese
contrato de manera explícita, sin llamar al ZIP individual «paquete enviado» ni
alterar documentos históricos. Esta prueba no conecta la fuente al runtime.

Se preparó un lector interno independiente para artefactos históricos del
almacén de contenido: verifica documento, ruta, tamaño y SHA-256 al leer. No
está conectado al runtime ni demuestra procedencia, inmutabilidad histórica,
firma o aceptación. La raíz y sus directorios superiores deben estar protegidos
frente a sustituciones concurrentes. El lector y la preparación fiscal aprobaron
**40 pruebas** con archivos y dependencias sintéticas
(`output/qa/b2b-issuance-history-20261027.json`); typecheck SUNAT aprobó.

La preparación Beta de facturas y boletas rechaza reemplazar un manifiesto
preparado o reutilizar un artefacto existente con distinta ruta, tamaño, tipo
MIME o huella; el mismo control aplica a los archivos del resumen RC. El foco
con repositorios y datos simulados aprobó **35 pruebas**
(`output/qa/b2b-issuance-immutable-20261027.json`) y pasó typecheck SUNAT.
La transacción real es proporcionada por Prisma; el foco no prueba una base
real ni implementa el historial propietario de versiones firmado.

En el archivo de emisión Beta se corrigió un ZIP ambiguo: se cuentan las
entradas antes de descomprimir y se exige una sola entrada con nombre, tamaño y
contenido esperados. El foco de archivo y evidencia aprobó **15 pruebas**
(`output/qa/b2b-archive-ledger-20261027.json`); typecheck SUNAT aprobó. La
prueba del ZIP usa datos sintéticos y no acredita aceptación por SUNAT.

Continuación del esquema candidato: se corrigieron restricciones que PostgreSQL
podía aceptar con valores nulos en el contenido JSON. Se añadió un trigger contra
TRUNCATE, además de los existentes para UPDATE y DELETE. En una base temporal
nueva y sin red se verificó el rechazo de contenido incompleto y de las tres
operaciones, para capturas ficticias 01 y 03; también pasaron las pruebas de
captura concurrente y verificación exacta. El esquema no se ha instalado en la
aplicación. Los triggers no protegen contra un administrador capaz de alterarlos;
se mantienen pendientes roles separados y revisión de la migración.

Continuación: la captura normaliza el orden de los artefactos antes de comparar
la fila fiscal, evitando rechazos cuando PostgreSQL devuelve los mismos archivos
en distinto orden. Se verificaron factura 01 y boleta 03 ficticias con dos
capturas concurrentes y una repetición por documento en PostgreSQL temporal
sin red: ambas conservaron una sola evidencia. El conjunto de captura, firma y
consulta exacta aprobó **68 pruebas** (`output/qa/b2b-evidence-capture-order-20261027.json`)
y pasó typecheck SUNAT. La política de confianza sigue simulada y estas pruebas
no constituyen validación ni aceptación oficial.

La revisión de procedencia identifica el bloque que falta antes de conectar una
fuente auténtica: [fuente propietaria de originales](B2B_FASE9_FUENTE_ORIGINALES_FRONTERA_20261027.md).
La fila fiscal actual no demuestra por sí sola un historial inmutable ni la
completitud del catálogo de créditos; no se relajan las guardas de notas.

Se incorporó una búsqueda interna por identificador, versión y huella del
snapshot; no elige automáticamente la última versión. La verificación de firma
vuelve a comprobar la misma referencia antes de devolver el resultado. Una
versión inexistente, cambiada o ambigua se rechaza. Esta función no publica
un endpoint nuevo ni acredita por sí sola aceptación SUNAT.

Se ensayó la captura de una factura 01 ficticia con firma XML real en una base
PostgreSQL nueva, temporal y sin red: la repetición conserva un solo registro,
se verificó la versión exacta y se rechazaron cambios de propietario, versión o
huella. Las políticas de confianza y revocación, el propietario y los datos son
simulados; no se consultó SUNAT ni se usaron certificados del cliente. El foco
adicional de captura, búsqueda, firma y transporte privado aprobó **67 pruebas**
(`output/qa/b2b-evidence-exact-capture-20261027.json`); el typecheck del
servicio SUNAT también aprobó.

La captura conectada a la fuente fiscal real aún no está ensamblada. La
verificación de notas 07/08 permanece bloqueada mientras falte la procedencia
confiable y el historial completo de créditos; estas pruebas no cierran B2B-09
ni habilitan envíos oficiales o producción.

## Consulta privada del historial

Billing incorpora `POST /internal/b2b/batch-credit-history` para los servicios
internos autorizados. Exige mTLS, bearer, permisos vigentes y la revisión/hash
exactos del diario; devuelve la cobertura reconciliada sin afirmar firma, CDR ni
completitud fiscal. El controlador no se publica en Kong ni en la API pública y
no cambia el estado de emisión. La prueba HTTPS de límites y la auditoría de
contratos y rutas aprobaron **82 pruebas** (`output/qa/b2b-credit-history-audit-20261027.json`).
El inventario clasifica 353 declaraciones, sin inferir activación o despliegue.
Tras compilar Billing y sus dependencias se repitió el foco integrado de
contratos, permisos, interfaz, versiones y verificación XML/CDR: **156 pruebas
aprobadas** (`output/qa/b2b-evidence-integrated-final-20261027.json`).

La prueba de interfaz añadida previamente no se había ejecutado porque usaba una
extensión fuera de la configuración de Vitest. Se corrigió la inclusión y el foco
de interfaz y sesión aprobó **26 pruebas**, incluidas cinco del panel de TI
(`output/qa/b2b-ti-overview-executed-20261027.json`).

## Ensayos aislados con PostgreSQL disponible

En una comprobación posterior del 27/10/2026, Docker respondió y se ejecutaron
los ensayos en contenedores PostgreSQL nuevos, etiquetados, sin red ni puertos
publicados y con datos temporales. El helper comprobó su identidad antes de
eliminarlos. No se usó la base QA existente.

- El circuito BETA de lotes aprobó el recorrido RC1, RC2, RC3 y RA con
  persistencia, recuperación y revocación. La búsqueda de versiones exactas se
  probó sobre PostgreSQL: rechazó un hash inexistente y dos versiones del mismo
  snapshot correspondientes a momentos distintos. La verificación fiscal de
  admisión de este ensayo es un doble sintético, no una prueba PKI.
- Los tres archivos de correo que antes fallaron al no estar disponible Docker
  aprobaron **40 pruebas** con bases nuevas y datos ficticios. Informe:
  `output/qa/b2b-email-db-20261027.json`.
- El núcleo y transporte privado de evidencia aprobaron **55 pruebas** con
  firmas XML/CDR y certificados efímeros. La política offline de confianza de
  este conjunto es simulada; no acredita la cadena del cliente ni SUNAT.
  Informe: `output/qa/b2b-signed-evidence-20261027.json`.

Los resultados actualizan la situación histórica de Docker descrita más abajo.
No equivalen a una prueba integral combinada del productor, la evidencia real de
notas y el historial completo. El proveedor de captura de evidencia de notas,
la recuperación integral y el piloto privado permanecen pendientes.

## Historial y versiones: integración interna

Billing ensambla el puente privado con su lector autorizado de historial y con
el propietario PostgreSQL de versiones. La búsqueda exige documento y hash
exactos, verifica el registro persistido y rechaza la ambigüedad cuando hay
más de una versión con el mismo snapshot; no elige la última ni interpreta el
hash como una aceptación. El puente repite la conciliación y revalidación de
permisos. Está disponible sólo como ruta interna y no está conectado al productor fiscal completo.
La fuente SUNAT sigue rechazando notas sin catálogo completo y evidencia de
firma/CDR. El conjunto del runtime, host y consultas aprobó **40 pruebas** con
datos sintéticos (`output/qa/b2b-history-runtime-20261027.json`); compilación
de Billing y dependencias: cinco tareas correctas. SQL y PostgreSQL se simulan
en este foco: falta el ensayo con una base aislada y evidencia completa.

## Preparación de TI desde la plataforma

Se añadió una vista en Integraciones que reúne los accesos a empresas y sedes,
configuración SUNAT, recepción SIRE/IMAP y correo; el resumen fiscal consulta
sólo metadatos BETA del RUC seleccionado y no supone que guardar valide el
acceso. La guía es [Configuración de TI](CONFIGURACION_TI_EN_FACTUEZ.md).

Se incorporaron además un puente privado para asociar el historial de notas a
versiones exactas y una fixture de Redis con restauración en memoria. El puente
está ensamblado internamente, sin ruta pública ni acreditación de firmas/CDR; la fixture no es RDB real.
No se declara cerrado el respaldo ni el circuito de notas por estas piezas.

## Diario de notas: verificación adicional

Se incorporó una prueba positiva del lector BETA contra la implementación real
de `CorrectionJournalRepository`, con una factura ficticia, diario vacío y
PostgreSQL simulado. El lector verifica el evento de emisión, los datos físicos,
el alcance autorizado y la versión del diario; repite la conciliación antes de
responder. La respuesta conserva `signedVersionCoverage: NOT_PROVIDED` y
`acceptanceProof: NOT_PROVIDED`. El conjunto de diario, autoridad, evidencia y
host Billing aprobó **138 pruebas**; tipos de Billing correctos. Informe:
`output/qa/b2b-phase9-journal-positive-20261027.json`.

El caso positivo no cubre todavía notas reservadas/aceptadas ni integra el lector
con la fuente de versiones firmadas. La fase sigue abierta y las condiciones de
cierre y despliegue que se detallan debajo siguen vigentes.

Revisión posterior de muestras y pruebas de aislamiento del historial de notas:
[muestras y verificación](B2B_FASE9_MUESTRAS_Y_VERIFICACION_20261027.md).

## Continuación: integración de correo y respaldo (27/10/2026)

El runtime de correo incluye un perfil BETA CORPORATE explícito y un dispatcher
que selecciona la tabla separada por perfil. Exige recurso propietario de
credenciales y permiso actual, hosts aprobados y esquema de auditoría comprobado;
si faltan, rechaza el arranque. El foco de runtime, cola y SMTP TLS loopback
aprobó **104 pruebas** (`output/qa/correo-runtime-beta-20261027.json`) y
mailer pasó typecheck. El host aún no aporta los recursos corporativos y el
esquema no se ha instalado; por ello no está activado ni operativo en la app.
El contenedor QA levantado usa la imagen anterior y no contiene este cambio.

Se preparó un ensamblaje de correo corporativo que recibe un origen explícito
de adjuntos, conservando permisos y comprobaciones TLS. Una prueba conectó el
flujo a un servidor SMTP TLS **solo localhost**, con credenciales, destinatario,
certificados y PDF/XML/CDR ficticios: autenticación y aceptación SMTP local
correctas. El conjunto asociado aprobó **106 pruebas**
(`output/qa/correo-integracion-local-20261027.json`). La prueba redirige el
transporte a un puerto efímero local y usa una autoridad de pruebas; no acredita
DNS, credenciales ni entrega del servidor corporativo. El ensamblaje aún no se
conecta al runtime; el perfil de arranque admite NONE y LOCAL_CAPTURE, no
CORPORATE. Falta integrar configuración, políticas de envío y procesos en el
runtime con pruebas aisladas y piloto autorizado. No se activa envío real.

Se ensambló el arranque BETA del correo con un origen privado de adjuntos y un
recurso SMTP preparado. El origen usa permisos actuales de Identity y del actor,
consulta Billing y SUNAT mediante servicios privados, verifica la integridad de
los archivos y revisa todos los integrantes antes de incluir un CDR compartido.
Los documentos faltantes siguen pendientes; no se crean originales ficticios.
La configuración SMTP está cifrada y auditada, pero no se ha probado ni activado
el envío corporativo. El origen conectado cubre actualmente factura y boleta:
el PDF disponible corresponde al perfil local de preparación; no demuestra la
entrega de PDF fiscal para comprobantes aceptados ni cubre notas y guías.

El control de respaldo vincula ahora cada autorización activa al identificador
del respaldo y a la versión de la clave, además de la ejecución de mantenimiento.
Existe un driver PostgreSQL para datos sintéticos y archivos en cuarentena; su
prueba usa procesos simulados. La restauración integral, inventarios completos y
la integración Redis siguen pendientes. El borrador de lectura del historial de
créditos compila, pero no se presenta como una fuente completa integrada de
versiones firmadas ni como cierre de los lotes.

Verificación local: **220 pruebas aprobadas** de correo y respaldo y **123** de
Billing y lotes, en dos conjuntos que pueden solaparse. Compilación de Billing,
Mailer y sus dependencias: **6 tareas correctas**; tipos de ambos servicios
correctos. Informes: `output/qa/b2b-phase9-closure-focus-20261027-final.json` y
`output/qa/b2b-phase9-billing-focus-20261027.json`. Son pruebas con datos
ficticios; no sustituyen una base real aislada, un ensayo integral ni el piloto.

El Compose de revisión sigue validando 6.912.212.992 bytes para todos los
perfiles y mantiene bloqueado el arranque. **B2B-09 sigue abierta:** faltan el
circuito completo de evidencia de notas/lotes, la recuperación integral y el
ensayo de extremo a extremo con conectividad y revocación, además de imágenes y
configuración operativas para la revisión previa de TI. No se ha accedido al VPS.

Actualización: 27/10/2026, Lima. Trabajo en integración; no equivale a cierre ni despliegue.

El destino confirmado sustituye el perfil Windows por Ubuntu Server 24.04 LTS
amd64. El VPS ya aloja producción. FactuEz no debe usar los puertos host 22, 80,
443, 5432, 8000, 8081 ni 8443. Los publicados se limitan a 127.0.0.1:9000–9099;
PostgreSQL no publica puerto por defecto. Nginx existente termina HTTPS del
subdominio. La configuración se entrega para revisión antes de cualquier arranque.

## Requisitos vinculantes del paquete

- Máximo agregado de 8.000.000.000 bytes en límites de contenedores, contando
  todos los perfiles; límites de swap y CPU explícitos. No construir imágenes
  en ese VPS durante el despliegue: entregar imágenes revisadas y fijadas.
- `restart: unless-stopped`, logs `max-size: 10m`, `max-file: 3` por servicio.
- Datos, imágenes, capas y snapshots fuera de `/var`. Validar espacio y rutas
  reales; un volumen externo no basta si Docker/containerd guarda capas en `/var`.
- Ningún `apt upgrade`, cambio de daemon, firewall, nginx, migración o arranque
  automático en el servidor. TI revisa el Compose y la instalación específica.
- Exclusivamente BETA. No habilitar producción fiscal por configurar Node en
  modo de ejecución optimizado ni por disponer de un certificado.

## Bloques en integración

| Bloque | Implementación / verificación actual |
| --- | --- |
| Inventario y coordinación | `b2b-deployment-maintenance.ts`: inventario explícito, generación de proceso y fases globales ADMISSION → PRODUCERS → WORKERS → STORAGE. |
| Control por propietario | `b2b-maintenance-node.ts`: listener mTLS separado, identidad de operador, fases idempotentes, sin ruta Kong; continúa disponible al cerrar listeners de negocio. |
| Vida completa de HTTP | `b2b-owner-drain.ts`: conserva la suscripción del controlador hasta terminar, aunque el cliente se desconecte; no asume cancelación de guards inciertos. |
| Publishers legacy | Billing/SUNAT esperan la aceptación de cola y escritura de journal antes del cierre; ticks concurrentes se serializan y el cierre se reutiliza. |
| Fachada B2B | `runtime-assembly.ts` y `main.ts`: adaptadores HTTP concretos de todos los propietarios, archivos montados explícitos, comprobación privada de preparación, arranque inicial pausado. |
| Identity | Host standalone con Prisma, autoridades OIDC reales, relay administrativo por propietario, permisos actuales de Billing y revalidación de actores de correo. Nuevos módulos optativos; no concede permisos por defecto. |
| Billing | Adaptadores de permisos/establecimientos y sesiones por solicitud integrados en el runtime. Sigue pendiente el ensamblaje completo del CLI, la autoridad de políticas de lotes y su historial propietario completo. Son pendientes de desarrollo nuestros. |
| SUNAT | Nuevo host standalone SYNTHETIC probado con DI real, PostgreSQL explícito, workers criptográficos reales y certificados efímeros. Cinco capacidades, validación privada de referencia09, certificado administrativo separado y cierre por mantenimiento. Sin emisión ni aceptación oficial. |
| Recepción | Servidor durable de step-up y flujo USER automático optativo implementados y probados por mTLS. Digest calculado por el propietario, handles manuales preservados, sin automatizar GRANT/SERVICE ni activar conectores. |
| Historial | Arranque separado de lectura, esquema y concesiones independientes, almacén y marcadores QA originales conservados. SYNTHETIC; no habilita lectura de la copia real del cliente. |
| Correo | Runtime, dispatcher y captura local probados; revalidación privada actual de actores implementada. El CLI completo aún necesita el origen concreto de adjuntos y el recurso SMTP de administración, sin sustituirlos por puertos permisivos. |
| Webhooks/exportaciones | Arranques B2B explícitos con PostgreSQL TLS, motores existentes, sonda privada y mantenimiento. Workers optativos; sin envío a destinos reales. |
| Comprobación independiente | `b2b-offline-verifier.ts`: nodos mTLS, inventario Docker estable, todas las conexiones PostgreSQL/Redis y escritores omitidos por montajes. Adaptadores de lectura concretos; falta conectarlos y probarlos en el host autorizado. |
| Respaldo | Adaptador de manifiesto y nuevo propietario de archivos/artefactos con lectura física, hashes e inventario estable en raíces ficticias. Faltan PostgreSQL/RDB, destino nuevo de restauración y ensayo integral. No ampliar el runner sintético a datos reales. |
| Vault de webhooks | Recifrado versionado sin cambiar secretos HMAC, revisiones ni journals; integrar y verificar el arranque y el corte. |
| VPS | Compose y comprobaciones para revisión; el artefacto debe seguir bloqueado mientras falte cableado, custodia, imágenes, configuración y aprobación. |

El control de mantenimiento no puede declarar aprobado un respaldo global sólo
porque una promesa local terminó. El adaptador operativo debe verificar procesos
registrados, instancias no declaradas, conexiones de aplicación, ausencia de
paradas forzadas e inventarios de datos/archivos/secuencias antes y después.
No se borran datos ni se cierran conexiones a la fuerza para obtener un recibo.

## Evidencia parcial

- Coordinación y control real mTLS: 17 pruebas aprobadas en dos archivos.
- Drain de propietario y publishers legacy: 10 pruebas aprobadas en dos archivos.
- Configuración montada y preparación de propietarios por mTLS: cinco pruebas
  aprobadas. El ensayo de enlaces usa hardlinks por las restricciones actuales
  de Windows; no sustituye comprobar permisos y symlinks sobre Ubuntu.

Continuación: conjunto de ocho archivos de mantenimiento y arranques, 54 pruebas
aprobadas (antes del caso adicional de timeout del observador). Incluye correo
QA esperando el tick/ack de cola, consultas internas de evidencia durante el
drenaje y webhook por HTTPS/mTLS con pool SQL simulado. El observador y sus
límites se detallan en [verificación offline](B2B_FASE9_VERIFICACION_OFFLINE.md).
La prueba nueva de vault persistente quedó sin ejecutar por Docker Desktop
no disponible: falló antes de crear la base temporal. No se inició Docker ni se
modificaron los servicios de QA para ocultar ese bloqueo.

El conjunto finalizado de propietarios aprobó 156 pruebas en doce archivos,
incluidas las comprobaciones TLS explícitas, hosts, runtime y criptografía
ficticia. Exportaciones aprobó además su foco de 110 pruebas; los conjuntos se
solapan y no se suman como total. Compilación de seis servicios y dependencias:
once tareas correctas. Tipos globales finales: 29 tareas correctas.

## Inicio de la fase 1: construcción local

Continuación: el Dockerfile web compiló y generó 22 rutas en Docker Desktop
local con `--output type=cacheonly`; incluye `/ti-guide`. No se exportó ni
arrancó una imagen web. El modelo de Compose de revisión aprobó 141 pruebas.

Dos ensayos separados con datos ficticios y contenedores efímeros sin red ni
puertos comprobaron PostgreSQL 17 `pg_dump`/`pg_restore` (11 comprobaciones;
`B2B_FASE1_PG_RESPALDO_RESTAURACION_AISLADA.md`) y Redis RDB `SAVE`/carga
(`tests/redis-synthetic-rdb-restore.cjs --isolated-synthetic-only`). Ambos
usaron Docker Desktop local y solo contenedores de prueba. No prueban respaldo
integral de FactuEz, consistencia conjunta, datos/colas reales, custodia o el
VPS. Estos ensayos no autorizan ni realizan la puesta en marcha.


La imagen genérica ahora genera Prisma solo si el servicio tiene ese script y
compila sus dependencias reales; se probó el conjunto de dependencias de historial
y se construyó localmente una imagen B2B amd64. Su bootstrap sin activación se
probó en un contenedor sin red. El Dockerfile candidato Ubuntu de la fachada
también completó ambas etapas usando `--output type=cacheonly`; no se arrancó
ese candidato ni se publicó. La imagen genérica ocupa aproximadamente 2,29 GB:
no constituye imagen mínima ni aprobada para el VPS. Detalles y pruebas del
lanzador: `infra/b2b/ubuntu-package-phase1/README.md`.

El ensayo sintético de empaquetado restaura archivos ficticios y rechaza rutas
e integridad inválidas; no restaura PostgreSQL ni Redis y no prueba respaldo
completo. Compose de revisión y bloqueo permanecen intactos.

## Pendientes concretos de desarrollo antes de un paquete ejecutable

1. Completar el ensamblaje de Billing, su autoridad de políticas de lotes y la
   producción de versiones/historial de créditos completos. El ledger nuevo
   rechaza explícitamente notas sin ese historial; no basta un hash correcto.
2. Completar el origen de adjuntos y recurso SMTP del arranque de correo. Los
   hosts de SUNAT, recepción e historial ya tienen implementación aislada;
   no se piden al cliente plugins ni sustitutos para nuestro desarrollo.
3. Cubrir todos los procesos del inventario con control de mantenimiento real,
   conectar los observadores independientes y el cerco de la instalación.
4. Completar puertos persistentes de respaldo/restauración integral: el modelo
   sintético de doce propietarios aún no es pg_dump/RDB de toda la instalación.
5. Integrar monitor, carga y recuperación distribuidos; preparar esquemas
   aditivos, imágenes y configuración ejecutable revisable. El Compose actual
   valida el presupuesto y las condiciones del VPS, pero bloquea el arranque.

Después se podrá ensayar con Docker disponible y presentar el paquete ejecutable
para revisión de TI antes de iniciar el VPS. El piloto privado y la activación
fiscal oficial siguen siendo aprobaciones distintas. Nada de esta continuación
sube datos a producción.

Estos conjuntos no constituyen todavía una regresión final ni un ensayo del VPS.
Se registrará aquí el resultado integrado después de revisar las entregas y
completar los arranques propietarios. No se ha conectado este trabajo al VPS ni
se ha ejecutado `compose up` en el servidor del cliente.

## Verificación previa (26/10/2026)

- Compilación: once tareas correctas de los seis servicios modificados y sus
  dependencias. Tipos finales del monorepo: 29 tareas correctas.
- Propietarios/hosts/TLS: 156 pruebas aprobadas en doce archivos. Verificación
  adicional de exportaciones: 110 aprobadas en cuatro archivos; son conjuntos
  solapados, no un total acumulable.
- Regresión íntegra ejecutada: **310 archivos, 12.420 pruebas aprobadas,
  cuatro fallos y una omisión condicional XSD preexistente**, 272,62 segundos.
  Informe: `output/qa/b2b-phase9-ubuntu-regression-final.json`.
- Tres fallos fueron de los ensayos existentes de correo/PostgreSQL al crear
  su contenedor ficticio: Docker Desktop Linux Engine no estaba disponible.
  No se omitieron ni se presentaron como aprobados. Tampoco se inició Docker
  ni se sustituyeron por conexiones a una base existente.
- El cuarto fallo detectó dos rutas privadas de bienes de guías sin clasificar.
  Se añadieron al feature propietario `issuers-admin` y se regeneró la evidencia
  de auditoría. No se relajó el auditor ni se publicaron rutas adicionales.
  Inventario actual: 30 funciones, 109 acciones planificadas, 340 declaraciones
  de ruta y 21 pantallas; conserva 136 rutas públicas candidatas y no infiere
  despliegue a partir del código.
- Verificación posterior de auditoría/contratos/arranque/exportaciones/TLS:
  **83 pruebas aprobadas en cinco archivos, cero fallos**. Informe:
  `output/qa/b2b-phase9-ubuntu-audit-correction.json`. Este foco confirma la
  corrección; no convierte los tres ensayos Docker pendientes en aprobados.

El Compose de revisión pasó el validador estático: 18 servicios contando todos
los perfiles, 6.912.212.992 bytes de memoria y 8,2 CPU, sin violaciones del modelo.
Continúa `BLOCKED`, con imágenes/configuración por resolver y arranques bloqueados.
No es todavía un Compose ejecutable de la instalación. El archivo que TI puede
revisar antes de cualquier arranque está en
`infra/b2b/ubuntu-vps/docker-compose.yml`; la publicación PostgreSQL opcional
permanece en un override separado.

## Continuación del 27/10/2026

Compilación integrada: 13 tareas correctas; tipos globales: 29 tareas correctas.
El host SUNAT aprobó 31 pruebas, incluidas las nuevas de arranque con workers
criptográficos reales y PostgreSQL simulado. El transporte privado de evidencia
de lotes y su núcleo aprobaron 55 pruebas. Los conjuntos de permisos, recepción,
historial y archivos están detallados en
[integración y límites actuales](B2B_FASE9_INTEGRACION_20261027.md).

Docker Desktop Linux Engine no está disponible; su comprobación de lectura falló
antes de cualquier creación de contenedor. No se inició Docker ni se conectaron
estas pruebas a QA8091 o a bases reales. La regresión completa actual terminó en
369,14 segundos: **325 archivos, 12.812 pruebas aprobadas, tres fallos y una
omisión condicional XSD preexistente**. Los tres fallos son de los runners de
correo/PostgreSQL al intentar crear sus contenedores temporales con Docker no
disponible. No se omitieron ni se presentan como aprobados. Informe íntegro:
`output/qa/b2b-phase9-regression-20261027.json`.

La auditoría actual cubre 30 funciones, 109 acciones planificadas, 350
declaraciones de ruta y 21 pantallas. Conserva las 136 rutas públicas candidatas;
las rutas nuevas son privadas y no se infiere despliegue de su declaración.
El Compose de revisión pasó su validador sin errores: 6.912.212.992 bytes sumando
todos los perfiles, 8,2 CPU y activación bloqueada.

**B2B-09 permanece abierta.** El Compose entregado sigue siendo de revisión y
bloquea el arranque. No hubo despliegue, migraciones, envíos a SUNAT ni cambios de
correlativos, y no se ha aprobado el piloto privado del VPS.
