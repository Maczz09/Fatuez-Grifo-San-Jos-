# B2B-09 — Driver concreto de archivos PostgreSQL SYNTHETIC

Fecha: 27/10/2026. Entrega alternativa acotada: **un driver de IO PostgreSQL concreto**.
No se declara terminado el respaldo/restauración integral ni la fase 09.

## Entregado y frontera exacta

- Implementación: infra/b2b/deployment-backup/pg-archive-io.ts.
- Pruebas: tests/b2b-deployment-backup-pg-io.spec.ts.
- Sin cambios en adapter.ts, model.ts, ports.ts, files-owner.ts, manifests,
  packages, services, Mailbox/runtime del padre ni Billing/SUNAT del otro agente.
- Sin TODO funcional rellenado con memoria, auth permisiva o inventarios constantes.

**SyntheticPostgresArchiveDriver.capture(context, proof)** contiene llamadas reales
a psql, pg_dump y pg_restore mediante execFileSync e inserciones exclusivas de archivos
con sincronización de archivos/directorios. Importación y construcción son inertes.
No está conectado a ningún main, CLI operativo ni servicio.

**No implementa OwnerPort ni RestoreTargetPort.** Su responsabilidad completa es
capturar e inspeccionar nativamente un archivo y conservar el intento en cuarentena.
No se puede enchufar al adaptador integral fingiendo inventory o verify.
No tiene operaciones de creación de bases, aplicación de SQL, restore, promoción,
limpieza o activación. El recibo sólo declara **CAPTURED_QUARANTINED**, con
ownerVerified:false, restored:false, backupAuthorized:false y
globalUnmanagedWritersVerified:false.

Esta cuarentena es retención de archivos de captura pendientes de revisión;
no demuestra aislamiento de un nuevo clúster de restauración.

## Admisión, procedencia y autenticación

El despliegue eventual requiere Linux y PostgreSQL 16; no se ejecutó en esta entrega.
Un actor independiente autorizado debe aprovisionar los siguientes prerrequisitos.
El driver nunca crea ni corrige markers:

1. Raíz absoluta/canónica llamada **factuez-pg-io-<rootId UUIDv4>**, propiedad del UID
   efectivo, sin permisos de grupo/otros. Ancestros sin enlaces ni escritura
   compartida; sólo se permite tmp compartido de root con sticky bit.
   Rechaza raíces sensibles, UNC, rutas relativas y nombres no vinculados al ID.
2. Archivo **synthetic-pg-root.json**, regular, privado, del mismo UID, sin symlink ni
   hardlink, hasta 8192 bytes. Se abre sin seguir enlaces y se compara identidad,
   tamaño y timestamps antes/después. JSON canónico con estos campos:

   | Campo | Valor |
   | --- | --- |
   | schemaVersion | factuez.b2b.synthetic-pg-archive-io.v1 |
   | rootId, deploymentId, databaseId | UUIDv4 explícitos |
   | profile | FACTUEZ_DEPLOYMENT_SYNTHETIC_V1 |
   | environment, datasetClass | BETA, SYNTHETIC |
   | purpose | NEW_SYNTHETIC o MARKED_SYNTHETIC_COPY |
   | database | fz_synthetic_ seguido de databaseId sin guiones |

   root es una opción local; no se guarda como texto en marker ni journal.
3. Base con ese nombre exacto bajo el socket Unix fijo
   **/run/factuez-synthetic-postgresql**, puerto **55439**.
   Sin URL, DNS, TCP, hosts alternativos ni rutas tomadas del respaldo.
4. En esa base, **factuez_backup.synthetic_profile** debe existir con una columna
   profile JSON/JSONB y exactamente una fila cuyo valor coincida con el marker local.
   La consulta escalar rechaza varias filas; cero filas produce null y falla.
   Se verifican current_database() y server_version_num de major 16.
   No se entrega ni ejecuta DDL de aprovisionamiento.
5. Usuario PostgreSQL fijo **factuez_synthetic_backup**, autenticación peer real y
   permisos de lectura suficientes. PGREQUIREPEER exige que el proceso servidor sea
   del usuario de SO **factuez_synthetic_postgres**. pg_hba.conf, mapeo peer y permisos
   se configuran externamente. No hay contraseña de prueba, bypass, cambio a trust
   ni lectura de secretos.
6. Puerto TI real authorize(BACKUP, context) y prueba viva aceptada por
   OfflineLeasePort.assertHeld del coordinador confiable del padre.
   Se revalidan lease e identidad antes/después de procesos y entre escrituras.
   Aquí no se implementa un autorizador que conceda éxito por defecto.

Los markers identifican un origen declarado sintético; no autentican procedencia
ni detectan universalmente datos de clientes. Autoridad TI, custodia, permisos del SO
y cerco de escritores son fronteras externas. No se admiten datasets de clientes
cambiando un literal; un perfil nuevo requiere diseño y revisión expresa.

## Procesos, argumentos y ambiente cerrados

Binarios absolutos, sin PATH ni argumentos proporcionados por el caller:

- /usr/lib/postgresql/16/bin/psql
- /usr/lib/postgresql/16/bin/pg_dump
- /usr/lib/postgresql/16/bin/pg_restore

Su instalación/integridad y seguridad del UID local son prerrequisitos externos.
No existe fallback de versión/ubicación.

La conexión incluye sólo socket/puerto/usuario/base calculada anteriores y
--no-password. psql usa --no-psqlrc, salida sin encabezados/alineación,
ON_ERROR_STOP=1 y SELECT fijo, sin interpolar identificadores/SQL.
pg_dump usa --format=custom --compress=0 --quote-all-identifiers
--lock-wait-timeout=5000. No filtra tablas/esquemas ni omite propietarios/ACL.

El ambiente reemplaza process.env: locale UTF8, UTC, HOME/cwd del intento,
PGPASSFILE=/dev/null, PGSERVICEFILE=/dev/null, PGSYSCONFDIR privado, conexión
máxima 5 s, nombre de aplicación y peer fijos. PGOPTIONS impone transacciones
de lectura, statement timeout 30 s, lock timeout 5 s y search_path=pg_catalog.
No hereda URLs PG, passwords, service, opciones, PATH, NODE_OPTIONS ni hooks
del cargador. Usa shell:false, stdin/stdout/stderr en pipe, 45 s por proceso y
SIGKILL ante timeout. No publica stdout/stderr ni Error del sistema:
al exterior sólo llega PG_IO_CAPTURE_FAILED.

Libpq documenta el control de archivos y autenticación por estas variables en
[Environment Variables de PostgreSQL 16](https://www.postgresql.org/docs/16/libpq-envars.html).

## Captura e inspección sin ejecutar SQL de restauración

Orden fijo:

1. Validar contexto BETA/SYNTHETIC, deploymentId, aprobación TI, lease y raíz.
2. Crear exclusivamente <root>/<backupId> con mkdir no recursivo.
   Si existe, rechazar: sin attach, replay, reanudación ni sobrescritura.
3. Sincronizar padre e insertar **000-quarantine.json** exclusivo con contexto.
4. Consultar marker/versiones de base y capturar custom en memoria.
5. Inspeccionar los mismos bytes por stdin con tres invocaciones pg_restore:
   --format=custom --list;
   --format=custom --schema-only --file=-;
   --format=custom --file=-.
6. Releer marker/versiones de base; revalidar lease e identidad local.
7. Insertar **archive.dump**, **toc.dat**, **schema.dat**, **001-captured.json**.
   El último contiene SHA de archivo, TOC, esquema y script completo extraído.
   Cada inserción usa O_EXCL, modo 0600, fsync del archivo y del directorio.
8. Revalidar guard y devolver copias del archivo/inspección y recibo limitado.

**Ninguna llamada pg_restore incluye --dbname, --host, --create, --clean,
--disable-triggers ni un destino.** Sin nombre de base, pg_restore emite un script,
sin aplicar comandos; véase [pg_restore 16](https://www.postgresql.org/docs/16/app-pgrestore.html).
El script completo sólo se consume/hashea en memoria y su Buffer se limpia al salir.
El dump y schema conservan contenido sin ejecutarlo.

El parser TOC acepta sintaxis textual CUSTOM generada por PG16, UTF8 estricto, IDs
únicos y rangos numéricos. Conserva literalmente definiciones, incluidos nombres
con espacios, ACL, POLICY, ROW SECURITY, FUNCTION, TRIGGER, SEQUENCE y TABLE DATA.
No convierte estos nombres en SQL ni infiere cobertura de las categorías.
La inspección nativa completa intenta leer también bloques de datos: la lista TOC
sola no detecta toda corrupción. La cabecera PGDMP es sólo rechazo temprano,
jamás prueba de validez.

Límites: dump 8 MiB, salida de proceso 32 MiB, TOC 16384 entradas, marker 8192 bytes.
No se amplía el perfil ni se trunca para lograr éxito. No se genera una cápsula
cifrada: los archivos inferiores son plaintext SYNTHETIC privados. No se atribuyen
a este dump sin procesar las garantías AES-GCM del codec superior.

## Journal retenido y reconciliación

No hay unlink, rm, DROP ni truncado. Ante fallo, conservar todo lo creado e intentar
insertar **999-failed.json** exclusivo, sin errores crudos, rutas ni secretos.
Si cambia identidad de raíz/directorio o no se puede probar propiedad, no escribir
en ese recurso: devolver fallo y requerir reconciliación externa.

Una falla de mkdir/sync/journal puede dejar sólo el directorio o archivos parciales.
**No se asegura una anotación durable cuando dispositivo/journal fallan.**
El directorio existente bloquea reutilizar backupId. Si coexisten 001-captured
y 999-failed, tratar el intento como fallido/incierto; 001 no implica aptitud de
restore. Una captura correcta también permanece en cuarentena.

Los checks dev/inode no son una API dirfd atómica contra un atacante privilegiado
o con el mismo UID. Se exige exclusividad de ese UID, ancestros confiables y cerco
externo del coordinador. Se interrumpe ante cambios detectados, sin prometer defensa
absoluta en un filesystem hostil. Fsync solicita persistencia al SO/dispositivo;
no garantiza por sí solo comportamiento de hardware remoto/averiado.

## Evidencia vs. puertos pendientes

| Obligación integral | Entregado | Pendiente, sin sustituto ficticio |
| --- | --- | --- |
| pg_dump real | Llamada concreta con parámetros cerrados | Ensayo autorizado en base nueva sintética; no ejecutado |
| DDL, ACL/RLS, triggers, funciones | Extracción nativa del esquema del archivo y TOC preservada | Inventario independiente de TODOS los objetos/ACL efectivos y comparación origen/archivo/destino |
| Roles/grants globales, extensiones, tablespaces | No se inventarían ni simulan | Definiciones seguras sin passwords, dependencias y política de restauración |
| Tablas/columnas/filas/objetos grandes | Custom sin filtros y consumo del script completo | Conteos/hashes lógicos independientes, cobertura semántica, clasificación de secretos y reread del destino |
| Secuencias | Archivo/TOC conservan lo emitido por herramientas nativas | Comparación exacta last_value/is_called independiente |
| Offsets/epochs/colas/audit heads SQL | Sin checkpoints inventados del TOC | Lectura de todos los estados propietarios, preservación UNKNOWN/idempotencia |
| Redis/RDB | Ningún driver añadido | RDB auténtico, CRC/formato, keyspace/tipos/TTL absolutos/colas/offsets y restore Redis NEW |
| Archivos originales | FILES/ARTIFACTS existente sin cambios | Composición de originales y equivalencia lógica en inodes/discos NEW |
| OwnerPort PG | Sin inventory/verify | Inventario nuevo en cada lectura y verificación semántica archivo ↔ estado lógico |
| RestoreTargetPort | Sin métodos de restore | Asignación exclusiva atómica de bases/Redis/raíces NEW; cuarentena desde creación; carga y comparación; sin overwrite |
| Config/custodia/catálogo/auditoría | Consume aprobación TI/lease existentes | Puertos operativos durables y autorización real de backup/restore |
| RestoreJournalPort | Journal sólo del intento de captura | Claim/context, tombstones y conciliación integral; este recibo nunca equivale a VERIFIED_ISOLATED |

pg_dump no respalda por sí solo las definiciones globales de roles. Véanse
[pg_dump 16](https://www.postgresql.org/docs/16/app-pgdump.html) y
[pg_dumpall 16](https://www.postgresql.org/docs/16/app-pg-dumpall.html).
No se invoca pg_dumpall contra un clúster que pueda contener roles ajenos.

## Verificación realizada

Desde la raíz, sin build global ni servicios:

~~~text
node node_modules/vitest/vitest.mjs run tests/b2b-deployment-backup.spec.ts tests/b2b-deployment-backup-pg-io.spec.ts --config infra/b2b/deployment-backup/vitest.config.mts --configLoader native --cache=false
node node_modules/typescript/bin/tsc -p infra/b2b/deployment-backup/tsconfig.json
~~~

Resultado: **162/162 casos**, dos archivos, código 0 (106 del núcleo en memoria y
56 nuevos de IO). TypeScript sin errores y sin emisión.

El spec nuevo intercepta **todos** los procesos y llamadas filesystem del driver.
El fixture TOC es texto de sintaxis nativa, no un dump producido en este trabajo.
El buffer PGDMP del mock sólo prueba la frontera de proceso:
**no es un archivo PostgreSQL válido ni se entrega a un binario real**.
Los casos comprueban parses válidos/inválidos, argumentos/env cerrados, rechazo
de auth/lease, identidad cambiada, corrupción, lectura completa, errores de proceso,
replay, exclusividad y retención del journal ante fallos.

No hay evidencia de persistencia de PostgreSQL/Redis ni fsync físico del nuevo
driver: las fronteras son dobles. No se ejecutaron pg_dump, psql, pg_restore, DDL,
RDB, conexiones reales, Docker, VPS ni QA, ni se leyeron datos de clientes/secretos.
No se reejecuta ni suma la suite FILES de filesystem real como evidencia de este
driver. B2B09 integral sigue pendiente en los puertos de la tabla.
