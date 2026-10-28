# B2B-09 — Comprobación independiente del mantenimiento

26/10/2026. Implementación local; no ejecutada sobre QA, datos reales ni VPS.

El coordinador ordena las fases ADMISSION, PRODUCERS, WORKERS y STORAGE. Sus
recibos no bastan para dar un respaldo por válido: antes y después de capturar
datos se consulta una fuente independiente. `B2bRegisteredOfflineVerifier`
comprueba el inventario aprobado, todos los nodos privados, metadatos Docker,
sesiones PostgreSQL y clientes Redis. No mata procesos ni desconecta clientes.

## Qué comprueba

- Cada servicio mantiene el mismo instanceId/bootId, runId y hash del inventario;
  su listener operador mTLS informa PARKED, STORAGE terminado y cero pendientes.
- Los contenedores registrados están presentes y no cambiaron su hora de
  arranque ni contador de reinicios; no están pausados, reiniciando, muertos o
  marcados por falta de memoria. El listener de control sigue funcionando.
- Ningún contenedor omitido pertenece al mismo proyecto/despliegue ni monta
  para escritura una raíz protegida o sus padres/hijos. Se incluyen contenedores
  detenidos; una discrepancia requiere revisión, no exclusión automática.
- PostgreSQL ofrece visibilidad `pg_read_all_stats`, existen las bases de los
  ocho propietarios y no queda ninguna sesión cliente ajena al observador en
  ellas. Incluye sesiones idle; no se limita a consultas actualmente activas.
- Redis no tiene clientes, lectores bloqueados ni suscriptores aparte de su
  conexión de observación. No se ejecutan CLIENT KILL, FLUSH ni cambios de ACL.
- Dos lecturas estables de metadatos Docker rodean las comprobaciones. La
  observación tiene un límite de cuatro segundos; si no termina, falla cerrada.

`DockerB2bMetadataObserver` solicita únicamente IDs, estados, reinicios, etiquetas
y montajes; no obtiene variables, argumentos de proceso, logs o contenidos.
Resuelve las rutas físicas de los montajes para detectar aliases. El adaptador
local usa explícitamente el socket Docker del host Ubuntu; no conecta por SSH,
no monta el socket en la aplicación ni envía operaciones de administración.
El cliente operador TLS existente fija certificado y origen; Kong no publica
estas rutas de mantenimiento.

## Integración que todavía debe realizarse

El operador debe proporcionar un registro aprobado de IDs reales de contenedor,
horas y reinicios de referencia, etiquetas `factuez.deployment-id` y
`factuez.instance-id`, mapa completo de bases y raíces canónicas. Las conexiones
de observación son explícitas, con permisos de lectura y límites de tiempo;
este módulo no descubre claves ni configura roles. El Compose de revisión no
crea esos datos ni prueba su validez sobre un VPS.

La comprobación se limita al despliegue registrado. No acredita que un proceso
del host, un DBA u otro escritor externo con acceso al disco sea incapaz de
escribir. Por eso conserva `globalUnmanagedWritersVerified:false`. Tampoco
autoriza un respaldo: el adaptador exige aprobación independiente, custodia,
inventarios completos y comparación de archivos/secuencias/esquemas antes y
después. Un resultado sintético no autoriza una restauración sobre datos reales.

## Pruebas

`tests/b2b-offline-verifier.spec.ts` usa sólo metadatos y clientes ficticios. Hay
un ensayo con el coordinador y nodos de mantenimiento reales en memoria: un
cliente Redis nuevo al terminar la captura invalida su resultado. Se prueban
reinicios, montajes omitidos, visibilidad incompleta, bases ausentes y clientes
idle/bloqueados. No se ejecutó Docker ni SQL contra una instalación existente.

El conjunto reproducible de mantenimiento y arranques se ejecuta con
`pnpm test:b2b-owner-runtime`. No levanta el VPS ni cambia 8091.
