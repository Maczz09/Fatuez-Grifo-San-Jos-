# B2B-09 — Revisión de infraestructura para VPS Ubuntu

Fecha: 26/10/2026, Lima. **Estado: BLOQUEADO PARA ACTIVACIÓN.**

Se entrega un Compose completo para revisar los 18 servicios y reservas, sus
recursos, puertos y montajes. No acredita un despliegue funcional: faltan los
bootstrap de propietarios, configuración de TI y evidencia del VPS. No se ha
conectado al servidor, iniciado Docker, descargado imágenes, construido paquetes,
instalado software ni ejecutado migraciones. El Compose original y el QA 8091 no
forman parte de esta entrega.

## Qué puede revisar el usuario

| Elemento | Resultado visible |
| --- | --- |
| Compose de revisión | `infra/b2b/ubuntu-vps/docker-compose.yml`, documento JSON válido como YAML, sin dependencia YAML nueva. |
| Recursos | 6.912.212.992 bytes = **6592 MiB**, contando simultáneamente todos los perfiles. Techo: **8.000.000.000 bytes decimales**; margen: 1.087.787.008 bytes. |
| CPU | Suma de límites 8,2 CPU, máximo de política 9; cada servicio limita como máximo 2. Host compartido: 10 CPU, 31 GB RAM. |
| Acceso web previsto | nginx HTTPS existente → `127.0.0.1:9000` → Kong, puerto interno 8000. |
| PostgreSQL | Sin publicación de host; override separado y optativo `127.0.0.1:9001:5432`. |
| Estado operativo | `BLOCKED`, `activationAllowed:false`, sin estado «VPS listo». |

Los límites de memoria y CPU son límites de contenedores, no una garantía sobre
el consumo completo de Docker/containerd, kernel, caché del host u otros sitios.
El ensayo de carga y la comprobación de límites efectivos del host siguen
pendientes. Hay una sola instancia por servicio: no se permiten réplicas, `scale`
ni `deploy` que multipliquen o contradigan este presupuesto.

## Presupuesto completo, incluidos perfiles opcionales

| Servicio | MiB | CPU | Perfil |
| --- | ---: | ---: | --- |
| postgres | 768 | 1 | base |
| redis | 256 | 0,5 | base |
| kong | 256 | 0,5 | base |
| web-pwa | 512 | 0,75 | base |
| identity-service | 384 | 0,5 | base |
| billing-service | 512 | 0,75 | base |
| sunat-service | 768 | 1 | base |
| mailer-worker | 320 | 0,5 | base |
| received-documents-service | 512 | 0,5 | base |
| received-sync-worker | 320 | 0,25 | base |
| realtime-service | 192 | 0,25 | base |
| history-service | 320 | 0,25 | b2b |
| b2b-api-service | 320 | 0,5 | b2b |
| webhook-service | 256 | 0,25 | b2b |
| integration-export-service | 320 | 0,25 | b2b |
| integration-service | 192 | 0,25 | b2b |
| operations | 128 | 0,1 | operations, **reserva de metadatos** |
| backup-tools | 256 | 0,1 | backup, **reserva de metadatos** |
| **Total** | **6592** | **8,2** | **todos a la vez** |

Cada servicio, incluidas las dos reservas, declara `mem_limit` como entero de
bytes, `memswap_limit` idéntico, `cpus`, `pids_limit`, `restart: unless-stopped`
y `logging.driver: json-file` con `max-size: 10m`, `max-file: "3"`.
No hay servicios de migración de una sola ejecución con otra política de restart.
Los 18 contenedores podrían producir aproximadamente 540 MB de logs rotados;
estos logs pertenecen al almacén Docker, que debe estar fuera del disco de `/var`.

## Bloqueo de activación e imágenes

El `entrypoint` de **cada** servicio apunta exclusivamente al archivo entregado
`review-blocked.sh`, montado como solo lectura. El archivo imprime el bloqueo y
termina con código 78. Ninguna variable desactiva este bloqueo. Si faltan el
archivo, su montaje o `/bin/sh` en una futura imagen, el arranque también falla.
Con `unless-stopped`, un intento manual de arrancar produciría reinicios fallidos;
no se incluye ni se debe ejecutar tal intento en esta revisión.

Todos los `x-runtime` declaran `status: BLOCKED`, `executableVerified:false` y
`proposedCommand:null`. No se ha aprobado ningún comando o punto de entrada de
aplicación. Además, `B2B_API_ENABLED` se fija en `false`. Los healthchecks están
expresamente deshabilitados: no se referencia
un `healthcheck.mjs` inexistente ni se presenta el bloqueo como servicio sano.

Cada imagen usa una variable requerida `B2B_<SERVICIO>_IMAGE`, sin fallback local,
tag mutable ni digest ficticio. Para una revisión resuelta se exige
`repositorio@sha256:<64 hex>`, arquitectura amd64 y procedencia aprobadas por TI.
`pull_policy: never` evita descargas implícitas. El validador distingue referencias
simbólicas obligatorias de un modelo con imágenes ya resueltas (`resolvedImages`).
No carga `.env`, no interpola el entorno y no revela valores privados.

Las referencias de imágenes de `operations` y `backup-tools` son **campos sin
resolver para reservar presupuesto**, no afirmaciones de que esos productos o
sus imágenes existan. No se deben sustituir por servidores simulados ni comandos
genéricos que aparenten dar operación o respaldo real.

La aprobación de TI se representa mediante una referencia obligatoria y las
variables de nombres/roles propietarios y origen HTTPS, sin credenciales ni RUC
embebidos. Una referencia de aprobación por sí sola no abre el bloqueo ni
completa las composiciones. Un futuro archivo ejecutable exige otra revisión;
no basta retirar el script de bloqueo.

## Disco: no consumir `/var`

El dato informado para `/var` es 2,8 GB libres; no fue medido en este trabajo.
No alcanza con mover las bases. Según la documentación de Docker, `data-root`
controla los datos del daemon; el almacén de imágenes de containerd en nuevas
instalaciones de Docker 29 o posterior tiene una raíz independiente. Véanse
[configuración del daemon](https://docs.docker.com/engine/daemon/) y
[almacén containerd](https://docs.docker.com/engine/storage/containerd/).

El preflight exige comprobar la raíz efectiva de Docker y **todos** los procesos
containerd detectados. Verifica rutas canónicas, `realpath`, existencia, tipo,
dispositivo, ruta de montaje y bytes disponibles, además del soporte efectivo del
daemon para límites de memoria, swap, CPU y procesos. Una ruta `/srv/...` que termina
bajo `/var`, o que comparte su dispositivo, bloquea la revisión. Esta política
es deliberadamente estricta: escribir fuera del nombre `/var` en el mismo disco
tampoco protege sus 2,8 GB. Tipos de disco desconocidos, metadatos ausentes,
almacenes de plugins/proxy containerd sin resolver o acceso insuficiente se
consideran **bloqueados**, nunca aprobados por omisión.

La recolección consulta `docker --host unix:///var/run/docker.sock info`, metadatos
de procesos, `containerd config dump`, los enlaces de descriptores persistentes
abiertos por cada containerd, `findmnt` y estadísticas del sistema de archivos.
El almacén configurado debe coincidir con la ruta física del descriptor de
metadatos Bolt activo; una configuración cambiada sin reiniciar el proceso no
se acredita como efectiva. Ese descriptor corresponde al
[plugin de metadatos de containerd](https://github.com/containerd/containerd/blob/main/plugins/metadata/plugin.go).
Un layout desconocido o la imposibilidad de consultar esos enlaces bloquea la
validación; no se abre ni se lee el contenido de la base tras el descriptor.
No monta el socket en contenedores ni ofrece control público. Rechaza
`DOCKER_HOST` y `DOCKER_CONTEXT`, usa exclusivamente el socket local de Ubuntu
y no puede conectar por SSH/TCP a un VPS. Es una herramienta para que TI ejecute
posteriormente **en el propio host**, no una conexión iniciada desde este trabajo.
El contenido de secretos, bases o certificados no se lee: sus rutas se revisan
solo mediante metadatos del sistema de archivos.

Reservas mínimas de revisión: 12 GB para Docker, 12 GB por raíz containerd,
16 GB para datos, 16 GB para respaldos y 1 GB para configuración. Se suman por
**dispositivo real**; si todo comparte un disco externo a `/var`, se requieren
al menos 57 GB disponibles. No son un cálculo de retención o capacidad comercial.
Las imágenes con sus capas comprimidas/descomprimidas, crecimiento de datos,
copias, temporales y margen operacional requieren dimensionamiento posterior.
No hay `build` en Compose: las imágenes deberán prepararse externamente, sin
cachés de construcción o descargas de esta aplicación en `/var`.

TI debe decidir manualmente cualquier cambio de Docker/containerd considerando
otros servicios del host. No hay instalador, reinicio de daemon, migración de
almacenes, borrado, `prune`, limpieza global ni modificación de configuración
global. La [guía oficial de Ubuntu](https://docs.docker.com/engine/install/ubuntu/)
sirve como referencia para una instalación futura aprobada; esta entrega no
ejecuta `apt`, actualizaciones generales, instalación de nginx o cambios de firewall.

## Montajes y configuración física prevista

Todas las fuentes de bind y secretos son absolutas bajo `/srv/factuez-vps/`.
Cada bind usa formato largo y `bind.create_host_path:false`. No hay volúmenes
Docker nombrados, rutas relativas, interpolaciones de directorios ni sockets.
Los destinos internos como `/var/lib/postgresql/data` son rutas **del contenedor**;
su fuente de host está fuera de `/var`. La imagen PostgreSQL pendiente debe ser
17 amd64 y respetar ese contrato de datos; cambiar de versión exige revisar el
montaje y procedimiento de actualización.

| Fuente de host prevista | Uso |
| --- | --- |
| `/srv/factuez-vps/data/postgres` | Un clúster; bases y roles separados por propietario, pendientes de aprovisionamiento aprobado. |
| `/srv/factuez-vps/data/redis` | Persistencia Redis; autenticación/ACL pendientes de composición. |
| `/srv/factuez-vps/data/artifacts` y `data/private` | Artefactos y almacenamiento fiscal privado. |
| `/srv/factuez-vps/data/print-branding` | Presentación de Billing. |
| `/srv/factuez-vps/backups` | Reserva de destino; no implica respaldo implementado. |
| `/srv/factuez-vps/config/review-blocked.sh` | Copia literal del bloqueo entregado, solo lectura en todos los servicios. |
| `/srv/factuez-vps/config/kong.review.json` | Configuración Kong de revisión entregada, solo lectura. |
| `/srv/factuez-vps/config/b2b-operations.json` | Política de admisión B2B, inicialmente PAUSED; ejemplo existente en `infra/b2b/b2b-operations.example.json`. |
| `/srv/factuez-vps/secrets/<nombre>` | Ficheros separados provisionados por TI; no incluidos ni abiertos. |

Los directorios y archivos deben existir previamente con propietario, permisos y
custodia aprobados por TI. El preflight no los crea. Se rechazan destinos de
montaje superpuestos, fuentes de escritura compartidas y alias físicos entre
almacenes de escritura. Los scripts no cambian permisos o propietarios.
El archivo de política de admisión no representa el inventario global de
escritores ni sustituye al coordinador de mantenimiento.

## Red y nginx existente

La política permite únicamente la publicación Kong `127.0.0.1:9000 → 8000` y,
al incorporar el único override permitido, PostgreSQL `127.0.0.1:9001 → 5432`.
No publica 80, 443, 5432, 8000, 8081, 8443 o 8091 en el host. El validador rechaza
cualquier otra publicación, incluso dentro de 9000–9099; también IP pública,
IPv6, UDP, rangos y colisiones. Los puertos internos no se confunden con los
puertos publicados. No hay modo de red host.

`nginx-existing-server.review.conf` es un fragmento para integrar manualmente
en el servidor HTTPS del subdominio aprobado. No crea un virtual host ni listeners,
elige certificados o modifica otros sitios. Falta validar el subdominio, DNS,
TLS, encabezados, websocket, cookies y configuración efectiva con TI.
El fragmento deniega `/internal/` y deja `/b2b/` indisponible.

Kong tiene el administrador y status listener desactivados. Su configuración
incluye únicamente rutas del núcleo web existente: Identity, Billing, SUNAT,
Recepción, Realtime y PWA. No incluye reporting, API B2B, historial, exportador
o mantenimiento. Las pantallas que dependían del reporting ausente conservan
una brecha funcional que este Compose no inventa ni resuelve.

Las facades B2B y el endpoint del operador requieren HTTPS/mTLS y peers propios;
no se degradan a HTTP por pasar detrás de nginx o Kong. El BFF/SSO del panel
también necesita su composición privada y revisión de origen/sesión. No hay
puerto del operador publicado. Estos accesos siguen pendientes.

## Integración verificada y brechas exactas

`runtime-inventory.review.json` relaciona los **14 servicios gestionados** por
`b2bManagedServices` con sus nombres Compose. PostgreSQL y Redis son infraestructura;
`operations` y `backup-tools` son reservas. No existe `services/reporting-service`:
no se crea imagen, proceso, base, dependencia, migración o ruta de ese servicio.
Los reportes B2B implementados pertenecen a los propietarios existentes.

| Pieza verificada en fuente | Pendiente para ejecución real |
| --- | --- |
| `services/b2b-api-service/src/runtime-assembly.ts`, `assembleB2bFacade` | Construye el grafo de facades HTTP para Identity, Billing, fiscal, webhooks, recepción, historial, exports y mailer; no es main ni bootstrap de los propietarios, listener o configuración desplegable. |
| Nuevo `services/b2b-api-service/src/main.ts`, `bootstrapB2bApi` | Incorporado por la integración paralela y revisado al cierre: requiere opt-in, configuración privada, PAUSED inicial y `verifyB2bOwnerGraph` para los ocho propietarios. Compone el grafo y su nodo de mantenimiento antes de escuchar. Esto no acredita los bootstrap de propietarios, imágenes, almacenamiento, PKI, hooks del resto de instancias ni ejecución del VPS; no se aprueba su comando en Compose. |
| `createB2bPhase9Application` | Factory de aplicación; requiere dependencias explícitas, política y composición. No se publica ni se inicia por este Compose. |
| Main actuales de Identity, Billing, SUNAT, Mailer y Recepción | Son arranques existentes; falta integrar los propietarios y contratos B2B, readiness de esquemas, grants, transporte, mantenimiento y configuración privada en sus procesos reales. |
| `received-documents-service/src/automation.worker.ts` | Worker existente de recepción; no acredita composición B2B LOCAL/READ_ONLY o inventario completo de escritores. |
| Historial y webhooks | Bibliotecas/factories y worker disponibles; no se encontraron `src/main.ts` ni un bootstrap completo aprobado en estos paquetes. |
| Main de integration y exportador | Existen, con opt-in, mTLS y bind a loopback **dentro del contenedor**. No son alcanzables automáticamente por otros contenedores; falta diseño del listener/peers. El exportador conserva restricción a `integration_exports_beta` y PostgreSQL TLS; no se falsea compatibilidad con el clúster pendiente de TI. |
| `B2bDeploymentMaintenance` y `B2bMaintenanceNode` | Coordinador y transporte operador separados existen. Faltan composición del proceso, hooks reales por instancia, inventario `instanceId/bootId`, peers/PKI y verificador externo de escritores offline. |
| `infra/b2b/recovery-bundle.mjs` | Cápsula SYNTHETIC/BETA de ensayo; no respalda toda la aplicación, Redis, roles, certificados o claves reales. Falta solución integral y restauración ensayada antes de activación. |

El coordinador global avanza **ADMISSION → PRODUCERS → WORKERS → STORAGE**.
Debe esperar cada fase para todas las instancias; el cierre local de un worker,
un healthcheck o un timeout no demuestran quiescencia global. El endpoint operador
HTTPS queda cerrado por defecto, separado de Kong y de clientes B2B. La reserva
`operations` no lo arranca. Ningún healthcheck, metadata del VPS o validación de
Compose sustituye las evidencias del coordinador y su verificador offline.

No se incluyen comandos de migración ni init SQL de candidatos. Antes de cualquier
activación deben revisarse DDL, versión, dependencias, grants mínimos por dueño,
custodia, respaldo y rollback. La presencia de archivos `candidate.sql` no prueba
que una base real tenga el esquema necesario. No se cargaron bases o secretos.

## Validación local y estados del CLI

Desde la raíz de FactuEz, estas operaciones solo revisan archivos y pruebas:

```powershell
node infra/b2b/ubuntu-vps/config-review.mjs
node infra/b2b/ubuntu-vps/config-review.mjs --model-only
node infra/b2b/ubuntu-vps/config-review.mjs --model-only --postgres-loopback
node node_modules/vitest/vitest.mjs run --config infra/b2b/ubuntu-vps/vitest.review.config.mjs --configLoader native
```

El primer comando sale con **2** y enumera referencias de imágenes, claves TI
y brechas; el estado sigue BLOCKED. `--model-only` sale con **0** solo si el
modelo de revisión satisface sus reglas, siempre con `activationAllowed:false`.
No lee variables reales ni ficheros privados. `--postgres-loopback` valida una
composición en memoria con el override acotado; no escribe el modelo ni publica
puertos. Las propiedades desconocidas, réplicas, builds, includes, volúmenes
nombrados y mecanismos alternos de arranque se rechazan.

`generate-review.mjs` reproduce exclusivamente los cuatro documentos de revisión
generados dentro de su propia carpeta. Se conserva el modelo completo en disco;
el usuario no necesita ejecutar el generador para revisarlo.

El preflight permite dos entradas, ninguna ejecutada contra este VPS:

```text
node infra/b2b/ubuntu-vps/preflight.mjs --collect-local
node infra/b2b/ubuntu-vps/preflight.mjs --metadata ruta/a/ensayo.metadata.json
```

La primera es para ejecución futura y manual de TI en Ubuntu, solo metadatos.
La segunda acepta un JSON explícito de metadatos, con antigüedad máxima de cinco
minutos. No genera evidencia automáticamente ni convierte un archivo aportado
en una atestación confiable del host: TI debe comprobar su procedencia. Exige
`version`, `capturedAt`, `platform`, `arch`, `os`, `daemon`, `limits`, `containerd`,
`varDeviceId` y las pruebas de cada ruta en `paths`; las pruebas unitarias
contienen un ejemplo sintético completo. No acepta metadatos incompletos.

Sin evidencia, ante cualquier dato desconocido o un fallo, sale con **2** y
`BLOCKED`. Metadatos válidos producen **0**,
`METADATA_CHECKS_PASSED_REVIEW_ONLY` y `activationAllowed:false`. No existe opción
`--activate`, descarga, construcción, instalación, conexión remota o arranque.
Tampoco se ofrece un comando de despliegue listo para copiar.

Las pruebas cubren suma de todos los perfiles y borde exacto de 8 GB decimales,
CPU/swap/logs, puertos e IPs, overrides contradictorios, réplicas y evasiones,
binds y rutas físicas, alias entre almacenes, disco real y reserva agregada,
raíces Docker/containerd separadas, CLI/config dump, datos desconocidos, JSON
duplicado, credenciales embebidas, flags simulados, inventario 14/18 y bloqueo
permanente. Son pruebas unitarias con metadatos sintéticos; no son una validación
de Docker Compose instalado, arranque, rendimiento, PKI, recuperación real o VPS.

Comprobación local: **141 pruebas aprobadas en tres archivos**, usando la
configuración aislada indicada. La validación estructural con el override de
PostgreSQL conserva 6.912.212.992 bytes y el estado de activación bloqueado.

## Condiciones pendientes de TI y desarrollo

1. Completar bootstrap y composición real de propietarios, rutas privadas y
   operador; comprobar esquemas, aislamiento y hooks de las cuatro fases.
2. Elegir imágenes amd64 con digests y contrato de runtime verificado. Mantener
   sin resolver las reservas mientras no exista su implementación real.
3. Verificar almacenamiento efectivo fuera del sistema de archivos de `/var`,
   capacidad, permisos, límites y coexistencia con otros servicios del host.
4. Aprobar bases/roles, secretos, TLS/mTLS, subdominio, BFF y plan de migraciones.
5. Ensayar respaldo integral, recuperación y mantenimiento global con evidencia.
6. Revisar un futuro artefacto ejecutable y autorizar explícitamente el despliegue.

Esta entrega deja la infraestructura **preparada para revisión**, con bloqueos
observables. El despliegue y el cierre funcional de B2B-09 siguen pendientes.
