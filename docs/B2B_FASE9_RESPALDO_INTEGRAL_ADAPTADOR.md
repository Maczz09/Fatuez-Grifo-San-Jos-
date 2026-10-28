# B2B-09 — Adaptador modular de respaldo integral: evidencia y fronteras

Fecha: 26/10/2026. Entrega técnica **sintética**, deshabilitada por defecto.
El flujo implementado captura, cifra, autentica, verifica y restaura paquetes de
TODOS los propietarios declarados en un destino nuevo aislado mediante puertos
explícitos. No constituye un respaldo operativo del cliente, autorización de TI,
cierre del piloto, homologación ni cierre completo de la fase 09.

## Archivos entregados y alcance

- `infra/b2b/deployment-backup/ports.ts`: propietarios fijos, inventarios y puertos.
- `infra/b2b/deployment-backup/model.ts`: normalización, límites, SHA y rutas lógicas.
- `infra/b2b/deployment-backup/codec.ts`: cápsula AES-256-GCM integral.
- `infra/b2b/deployment-backup/lease.ts`: puente al coordinador del padre.
- `infra/b2b/deployment-backup/adapter.ts`: casos de uso backup/restore y capabilities.
- `infra/b2b/deployment-backup/synthetic-runner.mjs`: runner de parámetros fijos.
- `infra/b2b/deployment-backup/vitest.config.mts`: pruebas independientes.
- `infra/b2b/deployment-backup/tsconfig.json`: comprobación de tipos sin emitir archivos.
- `tests/b2b-deployment-backup.spec.ts`: fixtures y pruebas de memoria.
- Este documento.

Se analizaron `infra/b2b/recovery-bundle.mjs`,
`tests/b2b-recovery.integration.ts` y su helper, sin modificarlos ni ampliar sus
guards SYNTHETIC. La cápsula anterior mantiene su perfil limitado a tres módulos;
no se convierte un respaldo parcial en integral cambiándole una etiqueta.
No se modifican mains, helpers, package manifests, coordinador del padre ni
los documentos de estado. No se ejecutan conexiones, Docker, dumps, restauraciones
o lecturas de secretos sobre el QA o instalaciones reales.

## Manifiesto fijo y cobertura requerida a cada propietario

`capabilities()` enumera 12 propietarios obligatorios. La omisión, sustitución,
repetición o perfil distinto impide el respaldo y la restauración.

| Propietario | Formato | Datos que debe cubrir su implementación propietaria |
| --- | --- | --- |
| IDENTITY | PG custom | Clientes, grants, roles/SSO, sesiones, revocaciones, versiones y auditoría. |
| BILLING | PG custom | Facturación completa, series, ledger/reservas, drafts, Outbox, idempotencia, reportes y retención. |
| SUNAT | PG custom | Configuración cifrada, documentos, guías, intentos, journals y relaciones de artefactos. |
| MAILER | PG custom | Configuración SMTP cifrada, trabajos, eventos y resultados ambiguos. |
| RECEIVED | PG custom | Recibidos, ítems, originales, permisos y journal de comandos. |
| HISTORY | PG custom | Historial, imports, manifiestos y referencias de archivo. |
| EXPORTS | PG custom | Cortes, exports, contenido, leases, cambios, checkpoints, replay y auditoría. |
| WEBHOOKS | PG custom | Suscripciones, secretos ya cifrados por su vault, entregas, intentos e idempotencia. |
| REDIS | RDB | Keyspace, contenido, colas, locks/epochs, expiración absoluta y política temporal. |
| CONFIG | Sin dump | Huellas de configuración y referencias de custodia, sin archivos de secretos. |
| ARTIFACTS | Archivos | XML/CDR/ZIP/PDF y metadatos de almacenamiento, sin extraer ZIP ni confiar firmas. |
| FILES | Archivos | Archivos de historial/exportación y metadatos persistentes fuera de las bases. |

La tabla especifica el contrato completo; **no declara implementados ni ensayados
los dumps PostgreSQL/RDB reales de esos doce propietarios**. Las implementaciones
operativas de sus puertos y el cableado de todos los mains siguen pendientes.
Las raíces físicas se deben asignar de manera disjunta a los propietarios; no
pueden descubrirse desde un pathname incluido en la cápsula.

Cada inventario independiente contiene propietario/perfil, SHA del esquema,
conteo y SHA del estado, tablas con columnas explícitas/conteos/SHA, secuencias
como decimales exactos con `isCalled`, checkpoints y archivos con tamaño/SHA.
La huella de esquema debe cubrir DDL completo, namespaces, ACL/RLS efectivos,
funciones, CHECK y triggers; también versiones/roles sin contraseñas. El puerto
no puede devolver el inventario guardado dentro de su propio snapshot como prueba
de que el origen o destino coincide. Debe releer el almacenamiento completo.

Los puertos futuros deben validar cobertura completa y política de cada dump,
conservar metadatos reconstruibles dentro del dump/archivos o en configuración
externa verificada, y fallar ante objetos no soportados en vez de omitirlos.
Una huella sola no permite reconstruir su preimagen. El núcleo no emite SQL ni
usa `SELECT *`; una implementación SQL necesita columnas explícitas, nombres
seguros y cobertura de todas las tablas/objetos propietarios, incluidos estados
vacíos, objetos grandes, auditorías y extensiones requeridas.

## Flujo de respaldo

1. Rechazar ejecución si `enabled` no es explícitamente `true`; aceptar únicamente
   contexto `BETA / SYNTHETIC`. El runner no admite URLs, rutas, destinos o claves.
2. Consultar el puerto independiente de autorización TI y registrar inicio.
   Reservar `backupId` por inserción atómica; incluso un intento fallido quema el ID.
   Solicitar una copia de clave a la custodia con versión permitida para SEAL.
3. Entrar mediante `CoordinatorOfflineLease` en
   `B2bDeploymentMaintenance.withOfflineSnapshot(async work)`. El padre comprueba
   evidencia offline fresca antes y después. Las cuatro fases siguen siendo
   ADMISSION → PRODUCERS → WORKERS → STORAGE para TODAS las instancias registradas.
   Este adaptador no cierra bases, no detiene workers ni sustituye el control
   privado mTLS que debe permanecer vivo con el almacenamiento aparcado.
4. Exigir prueba de lease viva, vinculada a deployment/run/revisión/inventario y
   al estado STORAGE/STOPPED_CLEAN de todos los participantes. Su identidad vive
   en WeakSet durante el callback: una copia JSON, un recibo local o una prueba
   ya terminada no sirven como capacidad. El puente presupone el coordinador
   confiable suministrado por el padre; no autentica objetos hostiles inyectados.
5. Leer TODOS los inventarios antes, leer configuración, verificar custodia,
   capturar cada snapshot y verificar semánticamente todos sus paquetes.
6. Releer TODOS los inventarios y configuración; comparar antes ↔ snapshot ↔
   después: estado/conteos/SHA, esquema, columnas, secuencias, checkpoints,
   archivos y configuración. Cada lectura es independiente de las otras.
7. Cifrar en memoria; la cápsula se publica en el catálogo solo después de
   que la comprobación offline posterior del padre termine correctamente.
   Un fallo revoca el intento mediante tombstone y no devuelve el paquete.

Los hashes detectan cambios visibles entre lecturas; no son una transacción
global entre bases ni prueban que jamás existió un escritor externo. Los puertos
deben incluir epochs monotónicos para detectar cambios revertidos entre lecturas.
`backupAuthorized:false` y `globalUnmanagedWritersVerified:false` permanecen siempre
falsos en estados, capabilities y recibos. No se deduce alcance global de un recibo
local. `TiAuthorizationPort` y `ExternalCustodyPort` solo definen fronteras: no hay
una implementación que conceda aprobación real ni etiquetas AUTHORIZED_COPY.

## Formato, custodia y límites

Magic `FZDBAK01`, versión `factuez.b2b.deployment-backup.v1`, nonce aleatorio de
12 bytes y tag de 16 bytes, AES-256-GCM. El AAD vincula versión de formato y contexto
completo: `deploymentId`, `runId`, `backupId`, `keyVersion`, entorno y clase de datos.
El cuerpo autenticado incluye manifiesto obligatorio, lease, configuración,
inventarios, formato/tamaño/SHA de cada payload y bytes de archivos base64.
Se exige serialización canónica y se rechazan claves JSON duplicadas, miembros
repetidos, base64 no canónico, archivos repetidos y sombreado archivo/directorio.
La cabecera PGDMP/REDIS por sí sola no acredita un dump válido: `OwnerPort.verify`
debe verificar el formato semántico y su correspondencia con el inventario.

Límites del perfil: 8 MiB por dump, 4 MiB por archivo, 32 MiB binarios totales,
48 MiB por cápsula, 128 archivos globales, 512 tablas/secuencias/checkpoints por
propietario y 256 columnas por tabla. Un despliegue que excede estos límites falla;
no se trunca ni queda marcado como respaldado. Catálogo con vigencia máxima de
24 horas; rechaza futuro, vencimiento, contexto/hash incorrectos y versiones
retiradas según la política externa de KeyPort. No hay selección automática de
otra clave o formato ante un error.

Rutas lógicas relativas, ASCII minúsculo, máximo 240 caracteres y ocho segmentos;
se rechazan rutas absolutas, traversal, escapes/porcentajes, backslash, ADS,
nombres reservados de Windows y extensiones no admitidas. El núcleo no abre ni
extrae estos nombres. El puerto de archivos debe además probar límites de raíz,
ausencia de symlink/hardlink/reparse, identidad del archivo y tamaño estable; la
validación de una cadena no demuestra estas propiedades del filesystem real.

La configuración solo permite seis clases de huellas y referencias opacas de
custodia versionada para backup, JWT, firma SUNAT, clave maestra, SMTP, recepción,
acceso DB/Redis, TLS y vaults Webhooks/Exports. Puede haber múltiples versiones o
referencias por propósito; deben cubrir todas las que aún cifran datos activos.
No se exportan claves privadas del vault, p12/pfx, contraseñas, tokens ni archivos
secrets/.env. Se rechazan campos extra, referencias con rutas y marcadores PEM
privados en los archivos. Esto no es un detector universal de secretos binarios:
la clasificación segura de tablas/archivos y el tratamiento de blobs cifrados son
obligaciones verificadas del propietario y de la custodia externa. Las huellas de
custodia son identificadores seguros; no hashes improvisados de contraseñas.
Las copias Buffer de claves y plaintext del codec se limpian al salir; JavaScript
no permite garantizar borrado de todas sus copias internas o strings.

## Restauración y fallos

1. Volver a consultar TI. Seleccionar contexto/hash/fechas desde catálogo confiable
   independiente de la cápsula; comprobar vigencia y versión de clave permitida
   para OPEN. Autenticar y validar TODOS los miembros, inventarios, límites y hashes.
2. Verificar custodia/configuración externa y semántica de TODOS los paquetes
   antes de crear un destino. Ni siquiera un último propietario inválido permite
   crear recursos, ejecutar DDL o escribir archivos de restauración.
3. Reclamar atómicamente `restoreId` vinculado al contexto. Un completado devuelve
   el mismo recibo, previa autorización y validación; no vuelve a escribir. Un ID
   pendiente, fallido o con contexto distinto se bloquea hasta conciliación manual.
4. Pedir exclusivamente `createNew`, sin argumento de destino existente. La fábrica
   debe crear en cuarentena durable desde el inicio, verificar aislamiento real y
   autocontener cualquier asignación parcial si falla antes de devolver identidad.
   Comparar su identidad con inspección independiente: deployment distinto al
   origen, creationId/restoreId exactos, doce recursos únicos/nuevos/vacíos.
5. Revalidar identidad/aislamiento y vacío de cada propietario pendiente antes de
   escribir. Los métodos del puerto deben hacer atómica la comprobación de identidad
   con cada mutación: la comprobación previa del núcleo no elimina un TOCTOU físico.
   Entregar copias de snapshots y configuración aprobada; no permitir que un puerto
   cambie el inventario esperado. Nunca usar clean, sobrescritura o desactivar guards.
6. Releer y comparar todo el destino después de cargar TODOS los propietarios;
   comparar configuración aplicada y volver a comprobar todo después de sellar el
   aislamiento. Solo entonces auditar y guardar recibo `VERIFIED_ISOLATED`.
7. Ante fallo, volver a verificar propiedad y hacer rollback/cuarentena de TODOS los
   recursos nuevos probados; no activar servicios parciales. Si cambió la identidad,
   no limpiar ni escribir el posible recurso ajeno: registrar QUARANTINE_REQUIRED
   para TI y mantener el aislamiento inicial. Lo mismo ante asignación incompleta
   o rollback fallido. Nunca se toca un destino existente suministrado por el usuario.

Catálogo, journal y auditoría son puertos de confianza, durables y atómicos, no
almacenamiento en memoria ofrecido para operación. `fail` debe invalidar incluso
un publish/complete cuyo resultado quedó incierto; no permitir replay de un recibo
que ya fue puesto en cuarentena. Un fallo de esos almacenes requiere conciliación
externa por restoreId/backupId antes de cualquier continuación. Los avisos de fallo
son best-effort si la propia auditoría está caída; no se afirma haber registrado
un evento cuando el puerto no pudo persistirlo. El destino nace aislado y no existe
ningún método de activación en esta API.

El adaptador copia bytes; no interpreta ni reprograma trabajos. Conserva claves de
idempotencia, auditorías y estados QUEUED/UNKNOWN. UNKNOWN requiere conciliación;
restaurar no provoca reenvío SMTP, webhook, SUNAT ni ejecución de colas. Tampoco se
recrean claves privadas ni se aceptan firmas/CDR oficiales basándose en el paquete.

## Verificación reproducible y límite de prueba

Desde la raíz del repositorio:

```powershell
node infra/b2b/deployment-backup/synthetic-runner.mjs --isolated-synthetic-only
pnpm exec tsc -p infra/b2b/deployment-backup/tsconfig.json
pnpm exec vitest run tests/b2b-deployment-backup.spec.ts tests/b2b-recovery-bundle.spec.ts tests/b2b-deployment-maintenance.spec.ts --maxWorkers=1
```

El spec contiene **106 casos**: recorrido de los doce propietarios, tablas de
fixture por dominio, filas/archivos, secuencias mayores que 2^53, estados ambiguos,
auditoría, snapshots independientes, Redis/keyspace/TTL, recuperación después de
destruir todos los datos del origen, lease del coordinador real en memoria,
rechazo de AAD/manifiestos/duplicados/rutas/miembros/tamaños/versiones, fallos de
custodia, destino nuevo, corrupción posterior, rollback, cuarentena y replay.

**Los buffers PGDMP+JSON y REDIS0011+JSON son formatos de fixture, no pg_dump ni
RDB reales.** Los puertos de TI, custodia, catálogo, almacenamiento, journal y
verificador offline son dobles de prueba. Se ejercita la implementación real del
coordinador del padre y del adaptador/codec, no un despliegue/mTLS real. No se
necesita Docker. La integración PostgreSQL anterior de tres perfiles se analizó,
pero no se ejecuta en esta entrega ni se atribuye al perfil integral.

La evidencia acredita el patrón ejecutable y sus límites. El cableado operativo
en los mains, los puertos de todos los propietarios, el cerco físico global,
roles/ACL/versiones operativos, custodia/rotación real y un ensayo integral con
motores/archivos reales nuevos y autorizados siguen pendientes. No se declara
piloto cerrado ni fase 09 completa.

### Resultado observado en esta entrega

| Ejecución | Resultado |
| --- | --- |
| Runner fijo `--isolated-synthetic-only` | 106/106 casos, un archivo, código 0; 2,92 s. |
| `tsc -p infra/b2b/deployment-backup/tsconfig.json` | Sin errores, código 0; sin emisión. |
| Foco de adaptador + cápsula anterior + coordinador del padre | 145/145 casos en tres archivos, código 0; 3,66 s. |

Los 106 casos están incluidos en los 145; no se suman como pruebas diferentes.
No se ejecutó el runner PostgreSQL/Docker ni la integración mTLS del padre en este
trabajo; sus resultados comunicados por el padre no se atribuyen a estas pruebas.

