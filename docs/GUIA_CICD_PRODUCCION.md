# Actualizaciones de FactuEz con aprobación

Este circuito instala **actualizaciones del core que ya esté funcionando**. No instala por primera vez, no ejecuta migraciones y no completa las funciones fiscales/B2B que sigan pendientes. Tampoco activa RUC, certificados, correo o envíos SUNAT. La versión nueva puede procesar las colas ya autorizadas al arrancar: programar una ventana sin nuevas operaciones y comprobar que la versión anterior pueda leer los datos y mensajes nuevos.

## Qué queda automatizado

1. Pull requests a `main`: instalación con lockfile, generación offline de clientes Prisma, compilación de todo el monorepo, pruebas fiscales seleccionadas y pruebas del despliegue. No se utilizan credenciales del cliente.
2. Push a `main` o ejecución manual desde `main`, después de pasar las verificaciones: construcción Linux AMD64 y publicación de siete imágenes en GHCR. El worker de recepción reutiliza su imagen del API.
3. Se guarda un artefacto `factuez-release-<commit>` con `release.json`, Compose, Kong y sus SHA256. Las imágenes se identifican por digest, no por `latest`.
4. Si está habilitado CD: espera el entorno `production` y utiliza SSH con clave de comando restringido y host conocido. El VPS exige además una aprobación local por SHA256, respaldo revisado y compatibilidad de esquema/reversión.
5. Descarga imágenes antes de detener la aplicación. Detiene los ocho procesos de aplicación, arranca los nuevos y comprueba salud de los once contenedores y `/login`. Hay una interrupción breve; **no es despliegue sin caída**.
6. Si falla la actualización, intenta recuperar las imágenes anteriores y comprueba su salud. No revierte la base de datos ni garantiza recuperar una versión incompatible. Una recuperación fallida requiere intervención y queda registrada.

No se compila en el VPS ni se levanta una segunda copia simultánea. Se conserva el Compose aprobado: 7.700.000.000 bytes de RAM máxima, puerto 9000 en loopback, sin puertos PostgreSQL/Redis públicos. No se reinician PostgreSQL, Redis o Kong durante esta actualización, no se usa `down`, no se borran volúmenes ni se hace `prune`. Los cambios de Compose/Kong o de esquema bloquean el flujo hasta que TI revise y prepare la instalación correspondiente.

## 1. Configurar GitHub una vez

Subir los archivos del circuito junto con el código revisado. Este trabajo local no los ha subido ni ha ejecutado Actions.

- Proteger `main`: cambios por pull request revisado y el check `verify` obligatorio. Restringir quién cambia workflows y scripts de despliegue.
- En **Settings → Actions → General**, permitir las acciones necesarias y el uso de `GITHUB_TOKEN` para publicar los paquetes del propio repositorio. Conservar el alcance mínimo definido en el workflow.
- Variable de repositorio `FACTUEZ_NODE_BASE_IMAGE`: `node:22-bookworm-slim@sha256:<digest aprobado real>`. Obtener y revisar el digest de la imagen oficial; no utilizar el texto de ejemplo. Una variable ausente bloquea la publicación.
- Las siete imágenes se publican bajo `ghcr.io/<propietario>/<repositorio>/<servicio>`. El nombre se convierte a minúsculas, se eliminan separadores iniciales/finales y se normalizan separadores internos para que GHCR acepte el nombre. Para `Maczz09/Fatuez-Grifo-San-Jos-` el prefijo queda `ghcr.io/maczz09/fatuez-grifo-san-jos`. Revisar que no colisione con otra aplicación del propietario. Revisar la visibilidad/acceso de los paquetes en GHCR, especialmente si el repositorio es público. No introducir documentos, copias o certificados en el código/contexto Docker.
- Crear el entorno **production**. Configurar revisores obligatorios, impedir autoaprobación cuando corresponda y permitir sólo `main`. GitHub limita los revisores obligatorios según plan y visibilidad; si no están disponibles, la aprobación local del VPS sigue siendo obligatoria. No asumir que escribir `environment: production` configura un revisor automáticamente.
- Mantener `FACTUEZ_CD_ENABLED` ausente o `false` hasta terminar la instalación y el ensayo de recuperación.

El workflow se encuentra en `.github/workflows/factuez-delivery.yml`. Las acciones están fijadas a revisiones verificadas. Actualizarlas mediante un cambio revisado; no cambiar esos hashes automáticamente.

## 2. Preparar el VPS una vez

Esto lo realiza TI/Max por su conexión administrativa habitual, no el workflow. El core debe estar instalado y saludable con **el mismo nombre de proyecto Compose** que figure en la configuración. No usar este circuito para instalar encima del QA.

Requisitos: Ubuntu AMD64, Node.js 22 disponible como `/usr/bin/node`, Docker Engine/Compose y cliente OpenSSH; Docker y el almacenamiento de containerd deben estar fuera de `/var`, de acuerdo con la guía inicial. El script comprueba el data-root Docker bajo `/srv`; la revisión inicial de containerd sigue siendo necesaria. No hay `apt upgrade` ni instalación automática de software en el VPS.

Crear `/srv/factuez-delivery` y sus subdirectorios `core`, `approvals`, `releases` y `receipts`. Deben ser directorios reales, no enlaces, sin escritura de grupo/otros. Dar al usuario de entrega los permisos necesarios sobre `releases`, `receipts`, el lock y `current-images.env`. TI debe controlar el código, la configuración y las aprobaciones. El acceso al socket Docker es altamente privilegiado: usar una cuenta dedicada, sin sesiones interactivas con la clave de Actions.

Copiar y revisar estos archivos del código aprobado:

- `infra/deployment/cicd/deploy.mjs`, `release.mjs`, `approve.mjs` y `deploy-entry.sh` a `/srv/factuez-delivery/`.
- Compose y Kong **exactamente como están instalados**, juntos en `/srv/factuez-delivery/core/`. Si se cambia su ubicación respecto al despliegue inicial, comprobar el montaje `./kong.yml`. No modificar el contenedor Kong automáticamente en una actualización de app.
- `deployment.example.json` como `deployment.json`, sustituyendo todos los ejemplos por valores reales. `project` debe coincidir con el proyecto instalado. `registryPrefix` debe coincidir exactamente con las imágenes GHCR de ese repositorio.
- `core-public.env`: variables públicas CORE de la instalación, sin contraseñas; formato `CLAVE=valor`, sin `export`, comillas, sustituciones `$` ni claves repetidas. Mantener PKI, origen, secretos y rutas ya revisados.
- `current-images.env`: las siete variables de imagen del core **actualmente instaladas**, con sus digests reales. Obtenerlas de la instalación original; no copiar una versión nueva como si ya estuviera instalada. El script compara esta declaración con los contenedores reales antes de detener nada.

Registrar en `deployment.json` `schemaSha256`, `composeSha256` y `kongSha256` correspondientes al código/esquema y archivos realmente instalados. El primer manifiesto revisado aporta los hashes para una instalación nueva de ese mismo código. Para una instalación existente, contrastarlos con su entrega real; no copiar los hashes nuevos sólo para superar el bloqueo. El hash de esquema es conservador y abarca SQL/Prisma de los cinco propietarios.

Preparar acceso **sólo lectura de paquetes** a GHCR en la cuenta de entrega mediante `docker login ghcr.io --username <usuario> --password-stdin`. Usar un token de lectura autorizado y almacenarlo con permisos privados o un gestor de credenciales. No ponerlo en el repositorio, JSON público o argumentos de procesos.

Hacer ejecutable `deploy-entry.sh`. Crear una clave SSH dedicada y colocar su pública en el `authorized_keys` de la cuenta de entrega con:

```text
restrict,command="/srv/factuez-delivery/deploy-entry.sh" ssh-ed25519 CLAVE_PUBLICA_REAL
```

No reemplazar otras claves. Esta clave sólo ejecuta la entrada fija: el contenido del workflow no se ejecuta como shell remoto. Verificar la huella SSH del servidor por un canal de TI y guardar la entrada `known_hosts` verificada; no confiar en un `ssh-keyscan` sin contrastar su huella.

## 3. Configurar la conexión en GitHub

En el entorno `production`:

| Tipo | Nombre | Contenido |
| --- | --- | --- |
| Variable | `FACTUEZ_DEPLOY_HOST` | Host/IP del VPS sin protocolo, ruta ni puerto. Usa el SSH existente 22. |
| Variable | `FACTUEZ_DEPLOY_USER` | Cuenta dedicada de entrega. |
| Secreto | `FACTUEZ_DEPLOY_SSH_KEY` | Privada de la clave restringida. |
| Secreto | `FACTUEZ_DEPLOY_KNOWN_HOSTS` | Línea o líneas de host SSH con huella comprobada por TI. |

En variables de **repositorio**, poner `FACTUEZ_CD_ENABLED=true` sólo después de verificar el circuito. Esta variable se consulta antes de entrar al entorno, por eso no debe existir únicamente como variable de entorno.

Si el SSH del VPS no es accesible desde los runners GitHub, TI debe definir acceso por red privada/túnel o un runner de entrega aislado. No abrir PostgreSQL, Redis, puertos de aplicaciones ni quitar la comprobación del host. Este workflow usa runners alojados en GitHub y necesita conectividad SSH autorizada; no prepara una VPN por sí mismo.

## 4. Aprobar cada actualización

1. Esperar que terminen `verify` y `publish`. Descargar el artefacto de **esa ejecución** y contrastar SHA256/commit. La publicación en GHCR no despliega nada por sí sola.
2. Revisar qué cambia y confirmar que esquema, mensajes de cola y versión anterior siguen siendo compatibles. Si hay migraciones: parar aquí, ensayarlas/restaurarlas y aplicarlas por el procedimiento aprobado. El circuito nunca ejecuta SQL automáticamente. Actualizar la huella instalada sólo después de preparar y verificar el esquema real.
3. Hacer respaldo de las cinco bases y de los archivos/configuración necesarios, con protección de secretos, y verificar recuperación. Guardar un recibo local JSON de esa revisión bajo `/srv`, por ejemplo con los campos `backupVerified: true`, `restoreVerified: true` y `verifiedAt` ISO UTC. Ese recibo es una declaración de TI: **el script no hace el respaldo ni demuestra la restauración**.
4. Copiar sólo `release.json` a una ubicación local de revisión. Ejecutar por la sesión de TI:

```bash
node /srv/factuez-delivery/approve.mjs \
  /srv/factuez-delivery/deployment.json \
  /srv/factuez-delivery/revision/release.json \
  /srv/RESPALDO_REAL/recibo-restauracion.json \
  --schema-compatible --rollback-compatible --backup-restore-verified
```

La aprobación vale para el SHA256 exacto durante 90 minutos y requiere evidencia de respaldo revisada en las últimas 24 horas. No generar estos archivos desde GitHub ni conceder permiso a cualquier versión.

5. En GitHub, aprobar el job pendiente de `production` cuando el plan permita revisores. Si el job ya falló porque no existía aprobación local, después de prepararla ejecutar **Re-run failed jobs** en la misma ejecución. No cambiar el commit/artefacto.
6. Comprobar resultado y recibo en `receipts/<sha>.json`. Además de la salud automática, probar inicio de sesión, permisos, visualización y colas en la app con el equipo responsable. No crear ventas ficticias en producción.

Ante `SCHEMA_OR_COMPOSE_REQUIRES_TI_REVIEW`, revisar el cambio pendiente; no sustituir hashes para eludirlo. Ante `UPDATE_FAILED_PREVIOUS_IMAGES_RESTORED`, verificar la aplicación anterior y las colas. Ante `MANUAL_RECOVERY_REQUIRED`, mantener la ventana de mantenimiento e intervenir con TI: no repetir emisiones ni restaurar una base ciegamente.

Un mismo paquete intentado queda bloqueado para repetición automática. Si se requiere reintento, TI revisará los recibos y el estado parcial; no borrar lock/recibos sin investigar. No hay limpieza automática de imágenes/versiones porque podría eliminar la posibilidad de recuperación.

## Validación y límites de esta entrega

Las pruebas locales simulan publicación/despliegue, validan el manifiesto y fuerzan fallos de arranque, salud y recuperación. No se accedió al VPS, no se publicaron imágenes ni se configuraron secretos o entornos de GitHub. El primer ensayo real debe hacerse contra una instalación aislada antes de habilitar el cliente.

Los pendientes funcionales fiscales/B2B siguen su estado propio: automatizar una entrega no los convierte en funcionalidades concluidas. Este circuito es del Compose core; no añade un servicio B2B ni incorpora automáticamente overrides de recepción. Un cambio de arquitectura requiere ampliar y revisar el contrato y sus pruebas.

Referencias: [entornos y revisores GitHub](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments), [compilación de contenedores con GitHub Actions](https://docs.docker.com/build/ci/github-actions/).
