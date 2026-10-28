# B2B-09 — Runtime propietario de History, exclusivamente QA sintético

Se entrega fuente de un host concreto, con entrada estándar `src/main.ts` y
entrada directa `src/b2b/main.ts`. Ensambla Prisma/PostgreSQL, repositorio,
almacenamiento, permisos persistidos, Identity HTTP, Nest/mTLS, status y nodo de
mantenimiento. El código permanece apagado por defecto.

**No es un host de archivo real ni una entrega lista para VPS.** Mantiene BETA,
SYNTHETIC, bases/roles/markers y raíces QA originales. No se ejecutaron Docker,
PostgreSQL real, DDL, grants, migraciones, importaciones, cambios de contadores,
firmas, transmisiones ni builds globales.

## Composición concreta

| Componente | Implementación |
| --- | --- |
| Base | `PrismaClient` generado de History + `PrismaPg`; pool real propiedad del adaptador. |
| Opciones PG | `b2bPostgresOptions` compartido; CA/contraseña montadas, TLS verificado, máximo 4 conexiones. |
| Archivo | `HistoryArchiveRepository(..., 'READ_ONLY')` + `HistoryArtifactStore`, sin modificar sus guards. |
| Permiso independiente | `PostgresB2bHistoryArchivePermission`, que solo lee actores y enrolamientos persistidos. |
| Negocio | `SyntheticB2bHistoryArchive` y `B2bHistoryReads`, usando el `HistoricalArchiveService` existente. |
| Identidad | `B2bIdentityHttp` sobre `B2bPrivateHttp` HTTPS/mTLS. Cada lectura revalida Identity varias veces. |
| HTTP | `B2bHistoryOwnerModule` real: LIST, DETAIL, CONTENT en `/internal/b2b/history-read`. |
| Readiness | `B2bOwnerRuntimeStatusModule`, únicamente capacidad READ. No verifica permisos de un cliente al arrancar. |
| Cierre | `B2bOwnerDrain` instalado antes de init/listen y `B2bMaintenanceNode` separado, con el mismo `status.bootId`. |

No se suministran callbacks `allowAll`, actores GLOBAL, permisos deducidos de
scopes o identidades humanas fabricadas a partir del clientId de SERVICE.
El actor procede exclusivamente de su fila independiente en PostgreSQL. Para
USER debe coincidir además con el subjectId actual. Todo actor queda limitado a
ASSIGNED, una sede/punto/serie exactos y únicamente `history.view`.

## Guards originales que permanecen obligatorios

- Base: `^factuez_history_qa_[a-f0-9]{10}(_restore)?$`.
- Rol conectado: **history_reader_qa**. Ni `history_import_qa` ni un superusuario
  sirven para este runtime lector.
- Marker de base: id 1, markerId aprobado, `factuez.history-storage.v1`, BETA y
  SYNTHETIC.
- RUC de cada binding: `^00000000[0-9]{3}$`.
- Carpetas hermanas bajo `factuez-history-persist-qa-<alfanumérico>`: `source` y
  `archive` o `archive-restore`.
- Cada carpeta debe existir y contener su `.history-qa-marker.json` original con
  profile `factuez-history-storage-qa-v1` y el mismo markerId. No se crean markers.
- Se conservan las comprobaciones originales de snapshots, claves, tamaños,
  hashes, cuarentena e integridad de los bytes de artefactos.

El runtime añade readiness de los markers existentes, sin crear carpetas,
staging, copias, reparaciones o archivos. Rechaza rutas físicas redirigidas,
junctions/symlinks y markers con hardlinks. `HistoryArtifactStore.read` conserva
sus comprobaciones completas al servir contenido.

## PostgreSQL explícito y montado

La rama B2B no usa `DATABASE_URL`, `DB_*`, valores por defecto de conexión o una
URL cuya query pueda anular TLS. Las opciones vienen de metadata validada y dos
archivos fijos: `database-ca.pem` y `database-password.bin`. La CA debe ser válida
y vigente; ausencia de metadata, CA o contraseña falla **antes de construir o
conectar Prisma**.

Se usan `ssl.rejectUnauthorized:true`, TLS mínimo 1.2, `max:4`, conexión limitada
a 3000 ms, `statement_timeout:10000` e inactividad de 30000 ms. Prisma usa schema
public y el pool recibe `search_path=public` explícito. `$disconnect()` dispone
el pool del adaptador, después de drenar solicitudes y cerrar Nest.

El helper compartido `mountedB2bPostgres` exige nombres terminados en `_beta`;
esa convención es incompatible con el guard histórico QA. Por eso se reutiliza
**b2bPostgresOptions**, su verificador de TLS y límites, conservando el nombre QA
original. No se renombra la base ni se relajan los guards para adaptar History.

Readiness consulta únicamente metadata de conexión/marker y proyecciones
literales `SELECT ... WHERE false` de las tablas existentes y las dos tablas
candidatas. Comprueba nombres/columnas y permisos SELECT; no acredita constraints,
contenido íntegro de toda la base, recuperación, carga o permisos efectivos de
escritura. El repositorio revalida base, rol y marker también en cada transacción
de lectura.

## Enrolamiento independiente persistente

`runtime-enrollment.ts` contiene el lector PG y la cadena
`b2bHistoryEnrollmentCandidateSql`. Es **DDL candidato sin ejecutar**, dentro del
scope permitido; no se incorpora a las migraciones o schema Prisma originales.

| Tabla candidata | Responsabilidad |
| --- | --- |
| B2bHistoryArchiveActor | Actor ASSIGNED persistido, revisión y estado activo. |
| B2bHistoryArchiveGrant | Binding completo y hash, client/kind/subject, revisión de cliente y autorización humana, actor/revisión, enrolamiento/revisión y perfil BETA/SYNTHETIC. |

Las filas nuevas quedan inactivas por defecto. El candidato conserva la base QA,
concede solamente SELECT al rol lector y exige avance de revisión en UPDATE.
No crea roles, usuarios, actores o grants de negocio. El bootstrap nunca ejecuta
esa cadena ni inserta filas. Si faltan las tablas, readiness falla cerrado. Con
tablas vacías, las solicitudes no obtienen acceso automáticamente.

Cada autorización lee nuevamente actor y grant mediante un JOIN parametrizado y
vuelve a comprobar la atestación de la base. Vincula clientId, kind, subjectId,
clientRevision, userAuthRevision, binding completo/hash, actorId, actorRevision y
revisión actual del actor. Devuelve una revisión compuesta grant:actor; el archivo
original detecta cualquier cambio de decisión o Identity durante la operación.
La pérdida de scopes, revocación, cambio de actor, permiso extra o perfil real
bloquea la entrega. No existe escritura de políticas desde el HTTP lector.

**Pendiente de desarrollo:** administración autenticada del enrolamiento,
autorización independiente del administrador y auditoría de sus mutaciones.
No hay un endpoint de alta/aprobación implementado por esta entrega. Esa brecha
no se resuelve aportando claves TI o configurando un callback permisivo. El DDL
candidato necesita revisión y ensayo PostgreSQL antes de cualquier aplicación.

## Entradas y configuración

`bootstrapB2bHistory(env)` devuelve null salvo que `B2B_HISTORY_ENABLED` sea
exactamente `true`. En ese caso exige `B2B_HISTORY_CONFIG_ROOT` absoluto y un
`runtime.json` validado. El main estándar invoca esta función solo cuando se
ejecuta directamente, por lo que el contrato futuro es `dist/main.js`; también
existe `dist/b2b/main.js`. Importarlos no arranca la aplicación.

Metadata requerida:

| Campo | Regla |
| --- | --- |
| schemaVersion | factuez.b2b.history-runtime.v1 |
| enabled / approvedForSyntheticQa | Ambos true solo para un ensayo QA aprobado. |
| environment / datasetClass | BETA / SYNTHETIC, sin otros perfiles. |
| deploymentId / instanceId / markerId | UUID; markerId coincide con los markers ya provisionados. |
| api / control | Objetos host/port explícitos; superficies distintas. Puerto 0 admitido para pruebas locales. |
| peers | Arrays resource y operator de fingerprints distintos; sin intersección. |
| identityOrigin | Origen HTTPS fijo, sin credenciales, query o rutas. |
| database | host, port, name QA original, user history_reader_qa y passwordFile database-password.bin. |
| storage | sourceRoot y archiveRoot absolutos dentro del layout QA original. |
| maxConcurrent | Opcional: 1–64, por defecto 16. |

Archivos montados fijos:

- `runtime.json`.
- `api-ca.pem`, `api.crt`, `api.key`.
- `operator-ca.pem`, `operator.crt`, `operator.key`.
- `identity-ca.pem`, `identity.crt`, `identity.key`.
- `database-ca.pem`, `database-password.bin`.

Se usa `B2bRuntimeFiles`, con verificaciones de archivos regulares, límites,
symlinks/hardlinks y permisos. No se descubre ni se abre `.env`. No se publican
puertos de host, rutas nginx/Kong o controles Docker desde este código.

**Cableado de paquete pendiente del padre:** History no declara ni tiene enlazado
`@factuez/service-access` en este checkout. Este bloque utiliza sus imports
canónicos, sin editar package.json, lockfile o el paquete compartido. Se debe
resolver esa dependencia antes de construir/ejecutar el servicio normalmente.
Los aliases de las comprobaciones locales descritas abajo no sustituyen ese
cableado de distribución. El código del entrypoint es concreto; no se presenta
una imagen ejecutable o un host completamente integrado como resultado probado.

## Mantenimiento por fases

1. ADMISSION: pausa comandos y espera COMMANDS. El RPC histórico POST queda
   cerrado a nuevas solicitudes; status y consultas readonly de Identity siguen
   disponibles en sus superficies correspondientes mientras drena trabajo.
2. PRODUCERS: este proceso es solo lector; no construye productores, importadores,
   schedulers o colas que requieran detenerse.
3. WORKERS: espera MUTATIONS; no existe worker propio de History.
4. STORAGE: cierra toda admisión, espera ALL y los readiness checks en curso,
   cierra Nest y después Prisma/pool. El listener del operador puede quedar PARKED.

Un cliente desconectado conserva el slot y no cancela el SQL pendiente. No se
fuerza la terminación para cumplir un timeout. SIGTERM/SIGINT reutilizan el run de
mantenimiento si existe. El cierre local no certifica escritores offline de
otros propietarios ni autoriza un respaldo global.

## Validación y límites de la entrega

Las pruebas nuevas usan Nest y mTLS reales en loopback, PKI efímera, bytes/markers
QA creados por fixtures y el protocolo de consultas de Prisma sustituido. Pasan
por los repositorios, almacenamiento y motores originales, el lector de grants,
el cliente Identity HTTP y el nodo de mantenimiento reales. No usan una
respuesta de Identity aprobada indiscriminadamente: se verifican peer, ruta,
token, kind y scopes; se ensayan revocación y cambios de revisión.

Cubren LIST/DETAIL/CONTENT y hash de artefactos; actor/grant independientes;
GLOBAL/import/otros perfiles rechazados; USER actual; base, rol y marker;
tablas opcionales ausentes; montajes/CA antes de conexión; TLS sin override
ambiental; abort del cliente durante SQL y cierre por fases con bootId único.

El typecheck dirigido resuelve temporalmente los imports compartidos a su fuente
para comprobar este bloque sin build global. Las pruebas usan el mismo alias en
memoria. Comando reproducible desde la raíz, sin escribir configuración:

Resultado al cierre: **57 pruebas nuevas aprobadas**. Incluyendo los dos archivos
originales de guards (`history-archive-repository` y `history-archive-storage`),
**104 pruebas aprobadas en cuatro archivos**. Typecheck dirigido de **ocho fuentes**,
sin emisión, con **cero diagnósticos**. No se modificaron los tests originales.

```javascript
// Ejecutar con node --input-type=module; no construir servicios.
import {startVitest} from 'vitest/node';
import {resolve} from 'node:path';
const ctx = await startVitest('test', [
  'tests/b2b-history-runtime.spec.ts',
  'tests/b2b-history-runtime-host.spec.ts',
], {run:true,maxWorkers:2,cache:false,configLoader:'native'}, {
  resolve:{alias:[{
    find:/^@factuez\/service-access\/dist\/(.+)$/,
    replacement:resolve('packages/service-access/src')+'/$1.ts',
  }]},
});
if (!ctx) process.exitCode=1;
else {
  process.exitCode=ctx.state.getFiles().some(f=>f.result?.state==='fail')?1:0;
  await ctx.close();
}
```

No se ha verificado un handshake PostgreSQL real ni aplicado el candidato:
Docker Linux no está disponible y no se intentó crearlo o iniciarlo. Quedan
pendientes el paquete enlazado, revisión/ensayo del candidato, administración y
auditoría del enrolamiento, provisión del sandbox original, montajes/PKI, ensayo
PostgreSQL TLS y validación del despliegue integrado. No se habilita un perfil
de historial real al resolver esos puntos: esa ampliación seguiría fuera de este
contrato BETA/SYNTHETIC.
