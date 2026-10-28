# Fase 09 — propietario filesystem FILES / ARTIFACTS

Este bloque entrega `SyntheticFilesOwner`, una implementación real de `OwnerPort`
en `infra/b2b/deployment-backup/files-owner.ts`. Lee archivos del filesystem, no
buffers PGDMP/RDB de fixture. No cambia el adaptador, sus contratos ni los otros
propietarios. No incorpora restore, delete, creación de destinos, SQL ni migraciones.
No declara completo el respaldo integral ni autoriza su ejecución operativa.

## Activación y raíz explícita

El constructor no realiza I/O. Recibe exactamente `owner` (`FILES` o `ARTIFACTS`),
`root`, `rootId`, `deploymentId`, `profile`, `environment`, `datasetClass` y `purpose`.
Sólo admite `FACTUEZ_DEPLOYMENT_SYNTHETIC_V1`, `BETA`, `SYNTHETIC` y propósito
`NEW_SYNTHETIC` o `MARKED_SYNTHETIC_COPY`. Los dos identificadores deben ser UUID v4
minúsculos. La ruta debe ser absoluta, resuelta, local y sin separador final;
su último componente debe ser `factuez-deployment-backup-files-<rootId>`.
No descubre raíces ni acepta directorios de clientes, producción o raíces de disco.
También rechaza componentes de ruta sensibles y ubicaciones de sistema conocidas
(Windows/Program Files/ProgramData y proc/sys/dev/etc/boot en Linux).

El aprovisionador externo debe haber creado una raíz nueva o una **copia sintética
explícita**, con `root-profile.json` regular y sin enlaces. Su objeto tiene exactamente:

| Campo | Valor requerido |
| --- | --- |
| `schemaVersion` | `factuez.b2b.deployment-files-root.v1` |
| `owner`, `rootId`, `deploymentId`, `profile`, `environment`, `datasetClass`, `purpose` | Los mismos valores del constructor, sin `root` |
| `epoch` | Decimal positivo, máximo int64; época del escritor gestionada externamente |

El JSON del marker usa `canonical()` de `model.ts`, con un salto final opcional.
Se rechazan duplicados, campos adicionales y serializaciones ambiguas. El owner
no crea ni modifica ese marker. Haberlo escrito no prueba procedencia sintética,
antigüedad de la raíz, aprobación TI ni exclusión de escritores: esos controles
pertenecen al aprovisionador y al coordinador. No usar un marker para reclasificar
una raíz existente de clientes. La época no puede retroceder entre inventarios
exitosos de una misma instancia; el control persistente entre procesos sigue fuera
de este puerto.

## Qué lee y qué bloquea

Cada inventario recorre **todas** las entradas, incluidos directorios vacíos.
No filtra silenciosamente ocultos, nombres desconocidos, archivos grandes o tipos
especiales: rechaza el inventario completo. Las rutas internas usan exactamente
`portablePath()` del modelo (ASCII minúsculo, extensiones admitidas, límites de
longitud/profundidad, sin ADS, nombres reservados de Windows ni traversal).
Se reserva `backup-metadata/`; no puede existir en el origen.

Rechaza enlaces simbólicos/junctions en raíz, ancestros y descendientes; archivos
con más de un hardlink; identidades repetidas; cambios de dispositivo; sockets,
FIFO y otros tipos desconocidos. Compara `realpath`, dispositivo, inode/file ID,
modo, uid/gid, links, tamaño, mtime, ctime y birthtime disponibles. No incluye atime,
que puede cambiar por la propia lectura. Identidades o tiempos esenciales desconocidos
bloquean el proceso. No se alteran permisos ni tiempos del origen.

La lectura usa handles `O_RDONLY`, `O_NOFOLLOW`/`O_NONBLOCK` cuando la plataforma los
expone; comprueba lstat/fstat antes y después y detecta lecturas cortas o crecimiento.
Luego vuelve a recorrer el árbol y relee/hash todos los archivos tras consultar el
disco. Se comprueban también metadata y capacidad del filesystem al final.
`snapshot()` exige un `inventory()` exitoso anterior y compara el manifiesto completo:
no acepta archivos añadidos, quitados, renombrados, reemplazados o modificados, aunque
mantengan tamaño o restauren mtime. Un inventario fresco puede actualizar el estado;
no puede sustituir la identidad de la raíz en una instancia existente.

Se bloquean rutas de vault, contraseñas, claves, certificados, secretos y credenciales,
cabeceras PEM privadas/certificados, claves PuTTY/SSH, ASN.1/PFX opaco y campos de
credenciales en JSON/JSONL/NDJSON, XML y cabeceras CSV. No se exportan P12/PFX/PEM.
Los DAT sólo admiten UTF-8 con prefijo `FACTUEZ_SYNTHETIC_FILE_V1\n`; XML rechaza
DOCTYPE/ENTITY. PDF requiere cabecera PDF y se somete al filtro de material privado.
Esto es validación conservadora para datos sintéticos previamente controlados,
**no un detector universal de secretos**, un parser PDF completo ni un escáner de
contenido cifrado/esteganográfico. El aprovisionador debe excluir esos datos.

ZIP se verifica sin extraer nada: CRC32, tamaños, cobertura completa de cabeceras
locales/directorio central y contenido de cada miembro. Sólo single-disk STORE o
DEFLATE, sin ZIP64, cifrado, descriptores, extras, comentarios, directorios explícitos,
enlaces, archivos anidados, rutas no portables o miembros duplicados. Una variante
no admitida bloquea todo el archivo, no se omite. La expansión agregada de todos los
ZIP de un owner se limita a 32 MiB y 128 miembros, además de 4 MiB por miembro;
son límites adicionales al presupuesto de bytes del snapshot.

## Disco y plataformas

Se inventaría el dispositivo real que contiene la raíz; no se descubren otros discos
del host. Se prohíben otros discos o montajes dentro de esa raíz.

* Windows: requiere PowerShell `pwsh.exe` >= 7.2 y consultas de metadata `Get-Volume`
  y `Get-Item -Stream *`. Sólo volumen local Fixed, Healthy, NTFS/ReFS y UUID de
  volumen conocido. Un stream alternativo, volumen desconocido o comando no
  disponible bloquea el proceso. Los paths se pasan por JSON en stdin, nunca como
  código shell. No se escriben scripts ni se necesitan cambios de sistema.
* Linux: requiere `findmnt` con JSON/submounts y `statfs`. Sólo ext4, xfs, btrfs,
  tmpfs u overlay reconocidos; se rechazan submontajes incluso si comparten `dev`.
  Otros sistemas operativos o filesystems quedan bloqueados.

El manifiesto conserva identidad de volumen/dispositivo, formato, hashes de fuente
de montaje, tipo nativo, tamaño de bloque y número de bloques. No copia el espacio
libre ni bloques de otros archivos/discos. No es una imagen de disco ni conserva
ACL completas, xattrs, streams, sparse layout o permisos de restore; las formas
conocidas no admitidas se rechazan. La evidencia de ejecución de este bloque es
Windows/NTFS; la rama Linux necesita validación en su plataforma antes de uso.

## Snapshot y verificación

`payload` es `NONE` con cero bytes. `files` contiene bytes reales de **cada** archivo
del origen, incluido el marker, más `backup-metadata/filesystem.json`, que es
metadata derivada y explícita, no un archivo fingido del origen. Incluye árbol,
directorios vacíos, identidades/times, disco y hashes/tamaños. El esquema se calcula
del perfil, layout/modos/uid/gid y disco reales. Los checkpoints `RootProfile`,
`Filesystem`, `WriterEpoch` y `Manifest` tienen preimágenes concretas en ese manifiesto;
no se usan fingerprints constantes para simular readiness.

`verify(snapshot)` valida únicamente los bytes recibidos: cobertura exacta,
perfil/marker, árbol/identidades, contenido, límites, hash, esquema y checkpoints.
Puede ejecutarse con el origen desconectado y sin permisos de escritura; no hace
llamadas al filesystem ni a procesos. No compara con la raíz actual ni autentica
por sí solo el snapshot: hashes recalculables no sustituyen el codec autenticado,
catálogo independiente, custodia ni autorización del adaptador superior.
La metadata física está ligada al origen y a su ruta por hash. No define un
inventario equivalente para restaurar en otro inode/disco: ese diseño queda pendiente.

Límites de `model.ts`: 128 archivos, 4 MiB por archivo y 32 MiB en total, incluyendo
marker y manifiesto derivado. Como protección adicional, máximo 1024 nodos y
profundidad JSON 32. El presupuesto global de todos los owners lo comprueba el
adaptador superior; este owner no reserva capacidad para los demás. No comprime ni
rebaja límites para aceptar un árbol demasiado grande.

## Evidencia y pendientes

`tests/b2b-deployment-backup-files.spec.ts` usa carpetas nuevas bajo tmp, marker y
documentos sintéticos, ZIP de protocolo real y operaciones filesystem reales. Los
dobles sólo provocan errores/carreras o prohíben I/O en `verify`; no sustituyen los
bytes del snapshot por buffers de base de datos. La limpieza comprueba el realpath,
padre tmp inmediato y prefijo propio antes de eliminar recursivamente con una sola API
Node, también en Windows. Sólo las pruebas limpian sus propias carpetas; el owner
carece de operaciones de borrado.

Comandos focalizados, sin build global:

```text
node node_modules/vitest/vitest.mjs run tests/b2b-deployment-backup-files.spec.ts --config infra/b2b/deployment-backup/vitest.config.mts --configLoader native --cache=false
node node_modules/typescript/bin/tsc -p infra/b2b/deployment-backup/tsconfig.json
```

Pendientes externos: aprovisionamiento/procedencia y aprobación TI de raíces nuevas,
cerco real y persistente de todos los escritores, cableado de este owner en la
composición operativa y resolución de fingerprints de destino en un futuro restore.
No se ha conectado una BD, leído archivos de clientes, abierto secretos reales,
iniciado Docker ni probado un backup integral/despliegue.
