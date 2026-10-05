# Etapa 3 — Historial persistente y restauración aislados

Fecha: 03/10/2026. Estado: **adaptador candidato implementado y ensayado con
datos sintéticos; migración real y corte NO autorizados ni ejecutados**.
La etapa 2 fiscal oficial continúa abierta. Producción permanece fuera de alcance.

Incremento posterior: [consulta protegida y conciliación](ETAPA3_CONSULTA_Y_CONCILIACION.md).
API de sólo lectura preparada, JWT RS256/revalidación y modo lector ensayados
exclusivamente con autoridad ficticia y PostgreSQL nuevos. Verificación actual:
2.212 pruebas/66 suites, 18 tareas TypeScript y 24 checks E2E PASS. Sin despliegue
ni datos reales. Los conteos y límites de abajo describen el incremento anterior.

## Alcance ejecutado

Se atendió la continuación solicitada con un entorno nuevo y descartable:

- PostgreSQL 17 de imagen ya disponible, sin descarga, sin volúmenes existentes;
  datos exclusivamente en `tmpfs` y dos bases nuevas de nombre aleatorio.
- Red Docker propia `--internal`, **sin puertos publicados**. El proceso de
  pruebas usa un stream `docker exec` hacia el loopback del nuevo contenedor.
  No se relajaron TLS, firewall, permisos ni aislamiento de servicios activos.
- Roles y contraseñas transitorios generados para ese clúster, nunca de `.env`.
- Directorios temporales exclusivos de origen/archivo/restauración, con marker
  de ensayo. Sólo comprobantes ficticios y dos XML explícitamente no oficiales.
- Sin conexiones a Billing, SUNAT, RestoApp, Redis, SMTP o APIs externas;
  sin certificados, P12/PFX, SOL, OAuth ni lecturas de otros emisores.

Los recursos propios se identificaron por ID, nombre y etiquetas antes de
retirarlos. Se eliminaron únicamente esos contenedores/red/directorios y sus
fixtures temporales. No se borraron datos del usuario ni se reinició la intranet.
El respaldo de ensayo también era temporal; no es un respaldo del cliente.

## Componentes separados

| Componente | Responsabilidad | Límite |
|---|---|---|
| `packages/history-core` | Contrato completo, normalización, identidades, hashes y plan de 50 filas | Sin I/O, firma o emisión |
| `services/history-service` | Repositorio Prisma propio, autorización interna y archivo append-only | Candidato; API añadida en incremento posterior, sin despliegue |
| `tests/history-archive-db.e2e.mjs` | Provisionar y ensayar exclusivamente el entorno sintético nuevo | No admite conexión arbitraria ni copia real |
| CLI de metadatos anterior | Diagnóstico y ensayo en memoria de 500 filas | No escribe con este adaptador |

No se integró este almacén en el proceso de Billing, sus tablas, su Prisma ni
su Outbox. Se conserva la arquitectura de microservicios y Kong. No hay nuevas
rutas Kong, controlador HTTP, worker o panel PWA de históricos desplegados.
El schema nuevo NO es una migración aplicada a los servicios activos.

Código: [contrato](../packages/history-core/src/index.ts),
[repositorio](../services/history-service/src/repository.ts),
[servicio interno](../services/history-service/src/service.ts),
[archivos](../services/history-service/src/artifact-store.ts),
[schema](../services/history-service/prisma/schema.prisma),
[guardas SQL de QA](../services/history-service/prisma/history-qa-guards.sql).

## Contrato completo versionado

Export: `schemaVersion=factuez.history-full.v1`, `environment=BETA`,
`datasetClass=SYNTHETIC`, `exportId`, `originSystem=RESTOAPP`, `mappings`,
`documents`. Sólo admite el namespace de RUC ficticio `00000000xxx`.
**Un RUC real, producción o un dataset distinto de SYNTHETIC se rechazan**.
No existe un flag que habilite copias reales.

Cada documento usa `factuez.history-document.v1` y conserva:

- Propiedad explícita: empresa, RUC, sede, punto, ID del contador de serie,
  tipo y serie; IDs de mapeo, documento de origen y `originId`.
- Cabecera: número, fecha/hora con zona, moneda, tipo de operación, placa,
  observaciones e importe en letras, con `null` explícito cuando corresponda.
- Emisor: RUC, razón social, nombre comercial, dirección, ubigeo y código de
  establecimiento. Cliente: documento, identidad, razón/nombre, dirección y correo.
- Ítems completos del perfil v1: orden, código, descripción, unidad, cantidad,
  valor unitario, precio con impuesto, afectación, tasa IGV y nueve importes.
- Importes de cabecera e impuestos, contado o crédito/cuotas y referencia/motivo
  de las notas. Cantidades/precios hasta seis decimales; importes exactos a dos.
- Evidencia declarada del origen y manifiesto de XML/ZIP/CDR/PDF con nombre
  original, tamaño y SHA-256. `authenticity=NOT_VERIFIED` es obligatorio.

No admite campos desconocidos ni ejecutables. Normaliza, separa del objeto
original y congela profundamente el snapshot antes de calcular los hashes.
El contrato diagnóstico `factuez.history-normalized.v1` no se amplió ni se
presenta como equivalente: carece de cliente/ítems y no permite esta persistencia.

Se comprueban calendario/zona, referencias 07/08, sumas de ítems/cabecera,
pagable, impuestos y cuotas con enteros exactos. Las bases son netas: no se
descuenta dos veces; operaciones gratuitas no suman al pagable. Las notas
conservan importes positivos, no ventas netas contables.

**No valida todas las reglas SUNAT, multiplicación/precio fiscal, XSD, firma,
PKI, revocación, relación certificado–RUC, ni autenticidad del CDR**. El perfil
v1 es de desarrollo y debe contrastarse con una copia completa del origen antes
de mapear datos reales. No hay un extractor real ejecutado ni conversión automática
de estos candidatos a `Document`.

Límites: 2.000 documentos, 100 ítems por documento, 1.000 mapeos, 50 filas/lote,
16 MiB de JSON, ocho artefactos por documento, 16 MiB por artefacto y 128 MiB
agregados declarados. Campos obligatorios/nullable se definen en el tipo exportado
`HistoricalDocumentSnapshotV1`; ejemplos sintéticos en
[fixtures de pruebas](../tests/helpers/history-full-fixtures.cjs).

## Persistencia, identidad y checkpoint

Siete tablas exclusivamente históricas: `HistorySandbox`, `HistoryIssuer`,
`HistoryOwnerMapping`, `HistoryImportJob`, `HistoryBatchReceipt`, `HistoryRecord`
y `HistoryRecordImportLink`. No existe `Document`, `SeriesCounter` u Outbox.

Identidades únicas PostgreSQL:

- Fiscal: `(issuerRuc, documentTypeCode, series, number)`.
- Origen: `(companyId, originSystem, originId)`.

Sólo se deduplica si ambas identidades señalan el mismo registro y coinciden
el snapshot completo, sus hashes y el manifiesto. Una discrepancia bloquea el
lote; nunca sobrescribe, fusiona ni decide cuál es el comprobante correcto.

Cada operación atesta el nombre de BD, rol de conexión y marker sintético. El
mapeo debe existir en la proyección **propia de QA**, con los mismos ocho campos
y hash; declararlo en el export no basta. Esa proyección usa fixtures aprobados
para el ensayo, **no acredita el mapa real del cliente ni su existencia en Billing**.

Registros, recibos, vínculos, mapeos y marker son inmutables por triggers y
permisos. El job sólo permite avanzar exactamente un lote y empieza en cero.
El rol importador sólo inserta historial y actualiza la columna del checkpoint;
el lector no importa, actualiza, borra ni provisiona mapeos.

Transacción `Serializable`: locks ordenados por RUC/job, validación de mapeo y
prefijo completo, deduplicación/inserción, recibo, vínculos y avance CAS se
confirman juntos. Hasta tres intentos ante conflicto de serialización; los
errores del driver se convierten en códigos sin URL, contraseñas o filas.

El job liga `exportId`, SHA del export/plan/mapeos, cantidad de filas y tamaño
del lote. Al reanudar se recalculan todos los recibos/vínculos del prefijo y
se verifica cada snapshot persistido: una bandera `completed` no acredita avance.
Cambiar datos con el mismo `exportId` bloquea. Repetir un lote exacto no añade filas.

## Archivo separado y lectura autorizada

Origen derivado: `<source>/<RUC>/<tipo>/<serie>/<número>/<clase>/<nombre>`.
Destino: `<archive>/<snapshotSHA>/<clase>/<nombre>`. Las raíces sólo admiten
directorios del ensayo con marker. No se aceptan rutas arbitrarias, nombres de
secretos, symlinks/junctions o hardlinks; se verifica tamaño, hash e identidad
de descriptor/ruta antes y después de leer.

La copia usa creación exclusiva, sin sobrescribir ni borrar. Se hace antes del
commit SQL; **no hay una transacción distribuida entre disco y PostgreSQL**.
Si el commit falla pueden quedar archivos en cuarentena sin referencia. Un
reintento verifica los bytes; una limpieza futura necesitará inventario y alcance
autorizado. El ensayo respaldó sólo archivos referenciados, no esos huérfanos.

El checkpoint acredita persistencia de registros, no disponibilidad futura de
los archivos. Las descargas vuelven a comprobar bytes/hash. Los controles no
sustituyen una copia offline estable frente a cambios por procesos privilegiados.
No se interpreta XML/PDF ni se descomprime ZIP.

`HistoryIdentityPort` debe recibir autorización del servicio de identidad
confiable, **no claims enviados por el navegador ni `x-user-id`**. Importar exige
ADMIN/global y `history.import`; leer exige `history.view`, con sede, punto y
UUID de serie asignados, combinados en la consulta del servidor. Se reautoriza
después de copiar/leer archivos. En este primer incremento el test usa un
proveedor de identidad ficticio: **no es una prueba de JWT/JWKS/Kong real**.
El incremento posterior incorpora API y verificación RS256 con autoridad HTTP
ficticia; traduce el permiso existente `document.view` a lectura interna, sin
registrar nuevos permisos ni desplegar en Identity/Kong activos.

Todos los candidatos y descargas conservan `QUARANTINED`, `candidateOnly=true`,
`fiscalAuthority=false`, `cdrAuthenticityVerified=false`, `transmission=false`
y `countersChanged=false`, incluso si el origen declara aceptación.
El corte/cambio de contador o propietario se rechaza siempre.

## Verificación ejecutada

- **119 pruebas nuevas / cuatro suites PASS**, contrato, acceso, archivos e
  integridad del prefijo. Incluidas en la regresión.
- **2.112 pruebas / 63 suites PASS, ninguna omitida**. Runtime Python/lxml local
  configurado para incluir el XSD offline ya disponible, sin descarga/red fiscal.
- **18 tareas TypeScript / 13 paquetes PASS**. Primera comprobación sin caché;
  tras el endurecimiento del límite JSON se repitieron tres tareas modificadas
  y se reutilizaron quince resultados de paquetes sin cambios.
- Schema Prisma validado y cliente generado sin conectar a las bases activas.
- **18 comprobaciones PostgreSQL PASS**, ejecución completa con salida 0:
  102 snapshots ficticios, dos RUC ficticios, lote principal 50/50/1;
  deduplicación entre exports y concurrencia sobre el mismo lote;
  rollback inducido en el vínculo 75, prefijo intacto y posterior reanudación;
  orden, bindings, markers, mapeo y lectura cruzada bloqueados;
  uniques fiscales/origen reales, triggers y rol lector comprobados;
  checkpoints iniciales falsos y snapshot vacío rechazados en PostgreSQL;
  respaldo `pg_dump` custom, restauración en BD nueva y dos archivos restaurados;
  relectura autorizada, bytes/hash y bloqueo de modificación tras restaurar.
- Total ficticio verificado: PEN 12.036,00; no es conciliación contable del cliente.
  Cero tablas/escrituras fiscales, Outbox, cambios de contador o transmisión.

Hash del respaldo temporal de la ejecución de 18 checks:
`635d09915e92c68e17d35d231d343c2e5478776c7b536be8fb74be0039da86cf`.
El hash cambia entre ensayos por las fechas/IDs de QA. No se compara con un
backup del cliente ni se conserva ese respaldo temporal como evidencia fiscal.

## Repetir sólo el ensayo sintético

Desde `D:\Facturacion\FactuEz`:

```powershell
pnpm test:history-persistence
pnpm qa:history:persistence
pnpm typecheck
```

La segunda orden requiere Docker autorizado e imagen `postgres:17-alpine`
ya local. El runner sólo acepta `--isolated-synthetic-only`, crea recursos propios
y limpia exclusivamente sus fixtures al terminar. No usa Compose general, no
lee `.env`, no admite URL de BD ni flag para conservar/importar una copia real.
No ejecutar los SQL de QA contra otras bases.

## Pendientes reales, sin fingir cierre

1. TI debe autorizar y entregar una **copia offline íntegra**, esquema/export y
   archivos, junto con el mapa confirmado empresa–RUC–sede–punto–serie.
   Definir RUC, periodo, filas, raíces, destinos aislados, permisos y tratamiento
   de datos antes de leer esa copia. Este runner no acepta información real.
2. Contrastar el perfil completo con el origen y preparar el extractor/contrato
   de copia autorizada. La API/identidad candidata ya tiene ensayo sintético;
   su integración activa y uso sobre una copia real requieren alcance aprobado,
   no reemplazar `SYNTHETIC` ni eliminar guards.
3. Verificar XML/CDR, firma, confianza y estados; conciliar por RUC/moneda/serie
   con Administración/Contabilidad. Diferencias requieren resolución documentada.
   SHA correcto no significa documento aceptado por SUNAT.
4. Repetir respaldo/restauración y permisos sobre la copia autorizada con
   inventario estable, evidencia e incidencias, no usar este ensayo como sustituto.
5. Aprobar conciliación y [acta de corte pendiente](ETAPA3_ACTA_CORTE_BORRADOR.md)
   antes de tocar contador o propietario. No tomar el máximo observado como
   permiso para iniciar numeración. No existe aprobación ni corte ejecutado.

Para la preparación sintética realizada no se solicitaron claves del cliente.
Para esos siguientes pasos sí se requieren copia, mapa y aprobaciones; las
credenciales/certificados no deben compartirse por el chat.
