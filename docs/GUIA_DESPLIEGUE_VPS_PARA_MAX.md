# Guía para instalar FactuEz en el VPS

**Para Max · Ubuntu Server 24.04 · actualización 28/10/2026**

## 1. Qué vas a instalar y qué debes tener

Instalarás el core que ya tiene Compose aprobado. La aprobación del Compose permite preparar esta instalación; no significa que todas las funciones fiscales del proyecto estén terminadas.

| Dato | Configuración de esta entrega |
| --- | --- |
| Procesos | 11 contenedores; 7 imágenes propias y 3 de infraestructura |
| Memoria máxima sumada | 7.700.000.000 bytes, menor al límite de 8 GB |
| Puerto publicado | Sólo 127.0.0.1:9000; no abrirlo a Internet |
| Base de datos | PostgreSQL 17, sin puerto publicado |
| Entrada de usuarios | Subdominio HTTPS mediante nginx que ya tiene el VPS |
| Datos de FactuEz | /srv/factuez/data |
| Datos de Docker/containerd | Almacenes propios fuera de /var, preparados antes de descargar imágenes |

**Disponibles en el core:** facturas 01 y boletas 03 dentro del perfil integrado; notas 07 motivo 01 y 08 motivo 02 sobre factura 01; PDF bajo demanda, XML/CDR originales, correo documental de esos perfiles y documentación nativa de 83 operaciones. Cada envío exige configuración, evidencia y autorización válidas por RUC.

**Todavía pendientes de desarrollo:** guías 09/31 productivas, RC múltiples/RA, otros motivos de notas/notas sobre boleta y publicación B2B productiva completa. Recepción externa automática tampoco se activa con este Compose. Puedes preparar el servidor; no entregar esas funciones como listas ni probar una venta real que dependa de ellas.

Antes de empezar, consigue:

- Acceso SSH y sudo autorizado; IP del VPS y usuario de acceso.
- Subdominio elegido, DNS y certificado HTTPS del nginx existente. No se incluyen nombres de dominio inventados como configuración real.
- Registro **privado** de imágenes para construir en tu PC y descargar en el VPS; acceso mediante el gestor de credenciales de Docker.
- El repositorio completo y actualizado en tu PC. El ZIP pequeño de revisión no incluye todo el código ni las imágenes.
- Tres archivos públicos de confianza fiscal revisados: raíces de emisores, CRL vigentes y certificado/cadena del firmante SUNAT del CDR. No son el P12 del cliente. Los hashes comprueban bytes; no acreditan por sí solos su autenticidad o vigencia.
- Archivo XSD oficial usado por esta versión, disponible en `services/sunat-service/assets/sunat/xsd-20220228.zip` del repositorio.
- Node 22 disponible para las comprobaciones en el VPS, Python 3 y OpenSSL. Si falta alguno, coordina su instalación autorizada o un runtime portable fuera de /var; la restricción del cliente permite instalar Docker, no instalar paquetes adicionales sin coordinarlo.

**No necesitas que el cliente te envíe por chat sus claves SOL, SMTP ni P12.** Las registrará en la aplicación después de instalarla.

## 2. Revisa primero el VPS; no cambies sus servicios actuales

Desde PowerShell de tu PC, reemplaza IP y usuario por los reales:

```powershell
ssh USUARIO_AUTORIZADO@IP_DEL_VPS
```

En la terminal **Ubuntu**:

```bash
uname -m
free -h
df -h / /var /srv
sudo ss -ltnp
sudo docker version
sudo docker compose version
sudo docker info --format '{{.DockerRootDir}}'
```

Resultado esperado: x86_64, memoria suficiente y 9000 libre. No uses los puertos ocupados 22, 80, 443, 5432, 8000, 8081 ni 8443 para un nuevo servicio. El 22 ya existente sigue siendo tu acceso SSH.

Si Docker no está instalado, sigue el método del repositorio apt de la documentación oficial de Docker para Ubuntu. Instala sólo Docker y sus componentes; **no ejecutes un apt upgrade general ni el script rápido de instalación**. Si hay paquetes Docker/containerd o aplicaciones existentes, no los desinstales ni reemplaces automáticamente.

### Punto importante: /var tiene poco espacio

Configurar los bind de FactuEz en /srv no cambia dónde Docker guarda las imágenes. Docker puede guardar parte de ellas en containerd, que tiene su propia ubicación. Ambos almacenes deben quedar fuera de /var antes de cualquier pull/build en el VPS.

Para una instalación NUEVA y sin contenedores previos, la configuración prevista es:

```json
{
  "data-root": "/srv/docker-data"
}
```

Y en la configuración efectiva de containerd, el `root` persistente se ubica, por ejemplo, en `/srv/containerd-data`. No sobrescribas el resto de su TOML ni cambies su `state` sólo por copiar este ejemplo.

**Si Docker/containerd ya ejecutan servicios del cliente y apuntan a /var, detén esta parte de la instalación.** Su traslado requiere respaldo y una ventana acordada con el responsable del VPS; no es un cambio exclusivo de FactuEz. No incluyo un reinicio global ni un movimiento automático de esas carpetas porque afectaría otras aplicaciones. No uses un cambio de backend como sustituto de migrar el almacén.

Puedes inspeccionar la configuración sin mover datos:

```bash
sudo docker info --format '{{.DockerRootDir}}'
sudo systemctl show containerd --property=MainPID --value
sudo containerd config dump | sed -n '1,14p'
```

El preflight posterior comprobará el proceso/configuración de containerd. Si el VPS usa una distribución de containerd diferente y no puede verificarla, hay que aclarar esa configuración con infraestructura, no quitar el control.

Fuentes oficiales: [instalación Docker en Ubuntu](https://docs.docker.com/engine/install/ubuntu/), [directorio del daemon](https://docs.docker.com/engine/daemon/), [almacén de containerd](https://docs.docker.com/engine/storage/containerd/).

## 3. Construye las imágenes en tu PC, no en el VPS compartido

En tu PC, abre PowerShell y entra al repositorio:

```powershell
Set-Location 'D:\Facturacion\FactuEz'
docker context show
docker info --format '{{.OSType}}'
```

Debes estar usando tu Docker Desktop local, con contenedores Linux; no un contexto SSH al VPS. Elige el registro privado real. Ejemplo de variables que **debes reemplazar**:

```powershell
$fxRepository = 'REGISTRO_PRIVADO/ORGANIZACION/factuez'
$fxVersion = '2026.10.28-rc1'
$fxNodeBase = 'node:22-bookworm-slim@sha256:4b150b48b4116e2a22f2c39cc27025fbf4f153e2078fd3b14d159fdb5c7279da'
$fxManifest = 'D:\Facturacion\FactuEz\output\install\build-cliente-rc1.json'
```

El repositorio debe estar en minúsculas. La base Node del ejemplo es la fijada en las compilaciones locales de esta entrega; si se aprueba una base nueva, reemplaza su digest y recompila/verifica las imágenes. No copies literalmente los marcadores anteriores. El archivo de salida debe ser nuevo.

Primero puedes revisar el plan, con otra salida nueva:

```powershell
node infra/deployment/core-production/build-release.mjs --plan $fxRepository $fxVersion $fxNodeBase 'D:\Facturacion\FactuEz\output\install\plan-cliente-rc1.json'
```

Luego construir las siete imágenes:

```powershell
node infra/deployment/core-production/build-release.mjs --build $fxRepository $fxVersion $fxNodeBase $fxManifest
if ($LASTEXITCODE -ne 0) { throw 'La construcción falló; no continuar.' }
```

Este constructor no publica imágenes ni levanta contenedores. La PWA se compila para el mismo origen y el perfil SSO del core; no uses como imagen de entrega la PWA QA compilada con ONPREM. Cambiar una variable pública de Next después no recompila el frontend.

Inicia sesión con `docker login` en el registro privado real, usando su entrada interactiva/gestor de credenciales; no pongas un token en el comando ni en la guía. Publica las siete imágenes que acabas de construir:

```powershell
$fxBuild = Get-Content -LiteralPath $fxManifest -Raw | ConvertFrom-Json
foreach ($fxImage in $fxBuild.images) {
    docker push $fxImage.image
    if ($LASTEXITCODE -ne 0) { throw 'Publicación fallida; detenerse.' }
}
```

Después de cada push, obtén sus RepoDigests:

```powershell
foreach ($fxImage in $fxBuild.images) {
    docker image inspect $fxImage.image --format '{{json .RepoDigests}}'
}
```

Guarda para cada servicio el valor `repositorio@sha256:...` que corresponda a **tu** repositorio publicado. Un `ImageID` local no equivale a un RepoDigest. También necesitas los digests aprobados de PostgreSQL 17, Redis 7.4 y Kong compatible con el declarativo. El ensayo local usó postgres:17-alpine, redis:7.4-alpine y kong:3.9.3; son referencias del ensayo, no una aprobación automática de versiones para tu servidor. Puedes consultar sus manifiestos desde tu PC sin descargar imágenes en /var del VPS:

```powershell
docker buildx imagetools inspect postgres:17-alpine
docker buildx imagetools inspect redis:7.4-alpine
docker buildx imagetools inspect kong:3.9.3
```

Tras revisar las versiones que se instalarán, usa el Digest del manifiesto correspondiente con su repositorio. No uses latest; no he inventado digests publicables de tus imágenes.

## 4. Sube y verifica el paquete

En tu PC tienes:

`D:\Facturacion\FactuEz\output\install\FactuEz_core_entrega_TI_20261028_v2.zip`

Y su archivo `.zip.sha256`. Ese paquete contiene el Compose, esquemas y verificadores; las imágenes viajan por el registro privado.

En PowerShell, sube ambos a una carpeta privada de tu usuario:

```powershell
scp 'D:\Facturacion\FactuEz\output\install\FactuEz_core_entrega_TI_20261028_v2.zip' USUARIO_AUTORIZADO@IP_DEL_VPS:~/
scp 'D:\Facturacion\FactuEz\output\install\FactuEz_core_entrega_TI_20261028_v2.zip.sha256' USUARIO_AUTORIZADO@IP_DEL_VPS:~/
```

En Ubuntu, desde esa carpeta:

```bash
sha256sum -c FactuEz_core_entrega_TI_20261028_v2.zip.sha256
```

Continúa sólo si dice OK. Prepara una instalación NUEVA bajo /srv; los siguientes ejemplos usan `/srv/factuez`. Si ya existe una instalación allí, no repitas la inicialización ni borres su contenido.

```bash
sudo -i
set -euo pipefail
umask 077
FACTUEZ_ROOT=/srv/factuez
FACTUEZ_RELEASE=/srv/factuez/release
```

Crea `/srv/factuez/release` y extrae ahí el ZIP con la herramienta ya disponible o Python 3, sustituyendo la ruta de subida por la ruta real. No asumas que el directorio home de root contiene el ZIP del usuario SSH:

```bash
install -d -m 0755 "$FACTUEZ_ROOT" "$FACTUEZ_RELEASE"
python3 -m zipfile -e /RUTA_REAL_DE_SUBIDA/FactuEz_core_entrega_TI_20261028_v2.zip "$FACTUEZ_RELEASE"
cd "$FACTUEZ_RELEASE"
# Si no existe node, prepara el runtime portable descrito justo debajo antes de seguir.
node verify-package.mjs
node infra/deployment/core-production/validate.mjs --test
```

Resultado esperado: PASS y 18 comprobaciones estáticas. No instalan bases ni contenedores.

### Si el VPS no tiene Node: runtime portable sin apt

Puedes descargar en tu PC el binario oficial de Node22 Linux/x64 y subirlo junto al paquete. No copies el ejecutable node.exe de Windows al VPS. Desde PowerShell, con una carpeta de descarga NUEVA que tú elijas:

```powershell
$fxNodeFolder = 'D:\Facturacion\FactuEz\output\install\node-runtime-vps'
New-Item -ItemType Directory -Path $fxNodeFolder -ErrorAction Stop | Out-Null
$fxNodeBaseUrl = 'https://nodejs.org/dist/latest-v22.x/'
Invoke-WebRequest ($fxNodeBaseUrl + 'SHASUMS256.txt') -OutFile "$fxNodeFolder\SHASUMS256.txt"
$fxNodeLines = @(Get-Content "$fxNodeFolder\SHASUMS256.txt" | Where-Object { $_ -match '^[a-f0-9]{64}  node-v22\.\d+\.\d+-linux-x64\.tar\.xz$' })
if ($fxNodeLines.Count -ne 1) { throw 'No se pudo identificar un único runtime oficial Linux x64.' }
$fxNodeHash, $fxNodeFile = $fxNodeLines[0] -split '  ', 2
Invoke-WebRequest ($fxNodeBaseUrl + $fxNodeFile) -OutFile "$fxNodeFolder\$fxNodeFile"
if ((Get-FileHash "$fxNodeFolder\$fxNodeFile" -Algorithm SHA256).Hash.ToLowerInvariant() -ne $fxNodeHash) { throw 'Hash de Node incorrecto.' }
scp "$fxNodeFolder\$fxNodeFile" USUARIO_AUTORIZADO@IP_DEL_VPS:~/
scp "$fxNodeFolder\SHASUMS256.txt" USUARIO_AUTORIZADO@IP_DEL_VPS:~/
```

En Ubuntu, confirma el mismo SHA-256 sobre el archivo subido. Usa el nombre EXACTO que descargaste al sustituir NODE_RUNTIME.tar.xz:

```bash
sha256sum /RUTA_REAL_DE_SUBIDA/NODE_RUNTIME.tar.xz
install -d -m 0755 /srv/factuez/tools/node
# La carpeta tools/node debe ser nueva y vacía; no reemplaza el Node de otros servicios.
tar -xJf /RUTA_REAL_DE_SUBIDA/NODE_RUNTIME.tar.xz --strip-components=1 -C /srv/factuez/tools/node
export PATH="/srv/factuez/tools/node/bin:$PATH"
node --version
```

Ese PATH sólo afecta tu terminal. Tras una nueva sesión vuelve a exportarlo si vas a usar los verificadores. Las aplicaciones usan Node dentro de sus imágenes, no dependen de este runtime del host. Descarga oficial: [Node.js v22](https://nodejs.org/dist/latest-v22.x/).

Después de disponer de Node, ejecuta las comprobaciones del ZIP de la sección 4 si aún no las ejecutaste.

## 5. Completa la configuración pública

Crea las carpetas. Los directorios de datos Node/Redis pertenecen al uid 1000; PostgreSQL se ajusta aparte en el siguiente paso:

```bash
install -d -m 0755 "$FACTUEZ_ROOT/config" "$FACTUEZ_ROOT/config/pki" "$FACTUEZ_ROOT/config/xsd"
install -d -m 0700 "$FACTUEZ_ROOT/secrets" "$FACTUEZ_ROOT/backups"
install -d -o 1000 -g 1000 -m 0700 \
  "$FACTUEZ_ROOT/data/redis" "$FACTUEZ_ROOT/data/artifacts" \
  "$FACTUEZ_ROOT/data/sunat-private" "$FACTUEZ_ROOT/data/print-branding" \
  "$FACTUEZ_ROOT/data/next-cache"
cp infra/deployment/core-production/core-public.template.json "$FACTUEZ_ROOT/config/core-public.json"
```

Edita `core-public.json` con el editor de archivos que ya uses. No contiene contraseñas. Completa todas las claves:

| Variable | Qué escribir |
| --- | --- |
| CORE_ROOT | /srv/factuez, si usaste esta guía |
| CORE_HTTPS_ORIGIN | https:// seguido del subdominio real, sin barra final |
| CORE_PG_ADMIN_USER | postgres, si sigues la inicialización de esta guía |
| CORE_INITIAL_ADMIN_USERNAME | Tu usuario inicial definitivo, sin cuenta demo |
| CORE_INITIAL_ADMIN_FULL_NAME | Tu nombre para el administrador |
| CORE_SMTP_APPROVED_HOSTS | Hostnames exactos separados por coma; por ejemplo smtp.gmail.com si se usará Gmail |
| CORE_*_IMAGE | Los diez repositorio@sha256 aprobados, uno por variable |
| CORE_ISSUER_ROOTS_SHA256 | Hash de issuer-roots.pem revisado |
| CORE_CRLS_SHA256 | Hash de crls.pem vigente y revisado |
| CORE_CDR_SIGNERS_SHA256 | Hash de cdr-signers.pem revisado |
| CORE_SUNAT_PRODUCTION_WSDL | Endpoint oficial aprobado compatible con este runtime |

La implementación actual fija el endpoint SOAP `https://e-factura.sunat.gob.pe/ol-ti-itcpfegem/billService`; confirma el servicio aplicable antes de activar al emisor. No uses la URL Beta como producción ni un servidor alternativo para evitar un rechazo.

Copia los archivos públicos revisados a:

```text
/srv/factuez/config/pki/issuer-roots.pem
/srv/factuez/config/pki/crls.pem
/srv/factuez/config/pki/cdr-signers.pem
/srv/factuez/config/xsd/xsd-20220228.zip
```

`issuer-roots.pem` contiene raíces CA aprobadas; `crls.pem`, listas de revocación PEM vigentes de las cadenas; `cdr-signers.pem`, primero el certificado del firmante de CDR y después sus intermedios. No crees archivos vacíos, autofirmados ni claves privadas para rellenar estas rutas. Su ausencia puede bloquear también el arranque por los mounts obligatorios y, en cualquier caso, bloquea la validación fiscal.

```bash
chmod 0644 "$FACTUEZ_ROOT/config/pki/"*.pem "$FACTUEZ_ROOT/config/xsd/xsd-20220228.zip"
sha256sum "$FACTUEZ_ROOT/config/pki/"*.pem "$FACTUEZ_ROOT/config/xsd/xsd-20220228.zip"
```

El ZIP XSD de esta revisión debe medir 609363 bytes y tener SHA-256 `5cac9d9353521340fbc15d23f465a4946b004535b9ff411541c87da01694dbd5`. No uses un ZIP con otro contenido bajo ese nombre.

Valida los valores públicos y crea el env de Compose, sin contraseñas:

```bash
node infra/deployment/core-production/validate.mjs --variables "$FACTUEZ_ROOT/config/core-public.json"
python3 - "$FACTUEZ_ROOT" <<'PY'
import json, os, pathlib, sys
root=pathlib.Path(sys.argv[1])
config=json.loads((root/'config/core-public.json').read_text())
lines=[]
for key,value in config.items():
    if not key.startswith('CORE_') or not isinstance(value,str) or any(c in value for c in "\n\r\x00'"):
        raise SystemExit('Valor público incompatible con el archivo env')
    lines.append(key+"='"+value+"'")
fd=os.open(root/'config/core.env',os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
with os.fdopen(fd,'w') as file: file.write('\n'.join(lines)+'\n')
PY
```

El script no sobrescribe un env existente. Las comillas simples evitan que Compose interprete un signo `$` como otra variable.

## 6. Crea las claves internas; el cliente aún no carga el P12

**Sólo primera instalación.** No regeneres estas claves al actualizar: perderías acceso a la configuración cifrada. No copies las claves del desarrollo.

Genera claves independientes y contraseñas de infraestructura en archivos nuevos:

```bash
python3 - "$FACTUEZ_ROOT" <<'PY'
import os, pathlib, secrets, sys
root=pathlib.Path(sys.argv[1])/'secrets'
names=['identity_db_password','billing_db_password','sunat_db_password',
       'mailer_db_password','received_db_password','redis_password',
       'internal_service_token','app_master_key','smtp_settings_key',
       'reception_settings_key','production_notes_owner_key']
for name in names:
    if (root/name).exists(): raise SystemExit('Ya hay claves; no inicializar otra vez')
for name in names:
    fd=os.open(root/name,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(fd,'w') as file: file.write(secrets.token_hex(32))
password=(root/'redis_password').read_text()
fd=os.open(root/'redis_acl',os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
with os.fdopen(fd,'w') as file: file.write('user default on >'+password+' ~* &* +@all\n')
PY
```

Crea las claves RSA de acceso de usuarios —distintas del certificado SUNAT—:

```bash
test ! -e "$FACTUEZ_ROOT/secrets/jwt_private_key"
test ! -e "$FACTUEZ_ROOT/secrets/jwt_public_key"
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out "$FACTUEZ_ROOT/secrets/jwt_private_key"
openssl pkey -in "$FACTUEZ_ROOT/secrets/jwt_private_key" -pubout -out "$FACTUEZ_ROOT/secrets/jwt_public_key"
```

Introduce tu contraseña inicial sin mostrarla ni guardarla en el historial del comando:

```bash
test ! -e "$FACTUEZ_ROOT/secrets/initial_admin_password"
# Usa una contraseña sin espacios iniciales/finales; el bootstrap aplica trim.
read -r -s -p 'Contraseña inicial de administrador (12 a 256 caracteres): ' FX_INITIAL_PASSWORD
printf '\n'
test "${#FX_INITIAL_PASSWORD}" -ge 12
test "${#FX_INITIAL_PASSWORD}" -le 256
printf '%s' "$FX_INITIAL_PASSWORD" > "$FACTUEZ_ROOT/secrets/initial_admin_password"
unset FX_INITIAL_PASSWORD
chown 1000:1000 "$FACTUEZ_ROOT/secrets/"*
chmod 0600 "$FACTUEZ_ROOT/secrets/"*
```

No ejecutes estos comandos con `set -x`, ni imprimas archivos privados. Conserva una copia cifrada y externa de las claves; no sirve respaldar sólo PostgreSQL.

## 7. Descarga las imágenes y prepara PostgreSQL nuevo

Define una función para usar SIEMPRE el Compose correcto y un nombre de proyecto aislado. No uses el compose raíz ni los de QA:

```bash
cd "$FACTUEZ_RELEASE"
dc() {
  docker compose -p factuez-cliente \
    --env-file "$FACTUEZ_ROOT/config/core.env" \
    -f "$FACTUEZ_RELEASE/infra/deployment/core-production/docker-compose.yml" "$@"
}
```

Inicia sesión en el registro privado desde el VPS, de forma interactiva. Descarga sólo las imágenes declaradas, por digest, después de verificar el almacenamiento:

```bash
dc config --quiet
dc pull --policy always
```

Esta descarga no arranca servicios. Si falla por acceso al registro, corrige el permiso; no sustituyas las imágenes por otras etiquetas.

Obtén la imagen y el usuario PostgreSQL reales:

```bash
FX_PG_IMAGE=$(python3 -c 'import json;print(json.load(open("/srv/factuez/config/core-public.json"))["CORE_POSTGRES_IMAGE"])')
FX_PG_UID=$(docker run --rm --network none --memory 67108864 --pids-limit 32 --entrypoint id "$FX_PG_IMAGE" -u postgres)
FX_PG_GID=$(docker run --rm --network none --memory 67108864 --pids-limit 32 --entrypoint id "$FX_PG_IMAGE" -g postgres)
install -d -o "$FX_PG_UID" -g "$FX_PG_GID" -m 0700 "$FACTUEZ_ROOT/data/postgres"
test ! -e "$FACTUEZ_ROOT/data/postgres/PG_VERSION"
```

El último control debe pasar. Si ya existe PG_VERSION, estás ante una instalación inicializada: no ejecutes initdb ni los SQL iniciales. No borres la carpeta para reintentar.

Crea un password de bootstrap privado, distinto de los cinco roles de servicio:

```bash
openssl rand -hex 32 > "$FACTUEZ_ROOT/secrets/bootstrap_pg_password"
chown "$FX_PG_UID:$FX_PG_GID" "$FACTUEZ_ROOT/secrets/bootstrap_pg_password"
chmod 0600 "$FACTUEZ_ROOT/secrets/bootstrap_pg_password"
docker run --rm --network none --memory 536870912 --pids-limit 128 \
  --user "$FX_PG_UID:$FX_PG_GID" \
  --mount "type=bind,src=$FACTUEZ_ROOT/data/postgres,dst=/var/lib/postgresql/data" \
  --mount "type=bind,src=$FACTUEZ_ROOT/secrets/bootstrap_pg_password,dst=/run/bootstrap_password,readonly" \
  --entrypoint initdb "$FX_PG_IMAGE" \
  -D /var/lib/postgresql/data -U postgres --pwfile=/run/bootstrap_password \
  --auth-local=scram-sha-256 --auth-host=scram-sha-256
```

Configura el acceso del cluster aislado. `peer` sólo permite al usuario postgres local administrar; las conexiones de aplicación exigen SCRAM y coinciden por base y rol. `samenet` se evalúa dentro del contenedor PostgreSQL, que sólo está en la red privada de DB:

```bash
cat > "$FACTUEZ_ROOT/config/pg_hba.conf" <<'HBA'
local all postgres peer
local all all scram-sha-256
host factuez_identity factuez_identity samenet scram-sha-256
host factuez_billing factuez_billing samenet scram-sha-256
host factuez_sunat factuez_sunat samenet scram-sha-256
host factuez_mailer factuez_mailer samenet scram-sha-256
host factuez_received factuez_received samenet scram-sha-256
HBA
chmod 0644 "$FACTUEZ_ROOT/config/pg_hba.conf"
dc up -d --no-deps --no-build --pull never --wait postgres
```

Antes de crear nada, comprueba que no hay roles/bases de FactuEz existentes:

```bash
dc exec -T postgres psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c \
  "SELECT rolname FROM pg_roles WHERE rolname LIKE 'factuez_%';"
dc exec -T postgres psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c \
  "SELECT datname FROM pg_database WHERE datname LIKE 'factuez_%';"
```

Ambas consultas deben devolver cero filas. Si no, detente y revisa el destino. Crea las cinco bases/roles; los passwords pasan por un pipe privado, no por argumentos ni archivos SQL de la entrega:

```bash
python3 - "$FACTUEZ_ROOT" <<'PY' | dc exec -T postgres psql -U postgres -d postgres -q -v ON_ERROR_STOP=1
import pathlib,re,sys
root=pathlib.Path(sys.argv[1])
for name in ['identity','billing','sunat','mailer','received']:
    password=(root/'secrets'/f'{name}_db_password').read_text().strip()
    if not re.fullmatch('[a-f0-9]{64}',password): raise SystemExit('Password de infraestructura inesperado')
    role='factuez_'+name
    print(f"CREATE ROLE {role} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD '{password}';")
    print(f'CREATE DATABASE {role} OWNER {role};')
    print(f'REVOKE ALL ON DATABASE {role} FROM PUBLIC;')
PY
```

No registres el contenido del pipe ni habilites trazas SQL de contraseñas. Este bloque sólo sirve para el cluster nuevo; no es una migración ni un restablecimiento de contraseñas existentes.

Aplica cada esquema como su rol propietario, dentro de una conexión local de bootstrap. `SET ROLE` hace que el guard del SQL compruebe al propietario correcto:

```bash
for FX_PAIR in identity:identity-service billing:billing-service sunat:sunat-service mailer:mailer-worker received:received-documents-service; do
  FX_DB="factuez_${FX_PAIR%%:*}"
  FX_SQL="$FACTUEZ_RELEASE/output/install/core-schema-20261028-v2/${FX_PAIR#*:}.sql"
  { printf 'SET ROLE %s; SET factuez.schema_target = '\''%s'\'';\n' "$FX_DB" "$FX_DB"; cat "$FX_SQL"; } |
    dc exec -T postgres psql -U postgres -d "$FX_DB" -v ON_ERROR_STOP=1
 done
```

Cada SQL se aplica una sola vez a una base vacía. No uses `db push`, semillas demo ni el viejo constraints.sql de Billing. Si algún comando falla, no arranques las apps: revisa ese error y la base parcial antes de seguir. No es necesario migrar datos del cliente para iniciar una instalación nueva.

## 8. Comprobación previa y arranque del core

El preflight verifica que 9000 siga libre; ejecutarlo ahora es correcto porque sólo PostgreSQL está iniciado:

```bash
cd "$FACTUEZ_RELEASE"
node infra/deployment/core-production/preflight.mjs --read-only "$FACTUEZ_ROOT/config/core-public.json"
```

Exige PASS. Comprueba recursos, disco Docker/containerd, archivos, secretos por metadatos y hashes públicos, imágenes y PG_VERSION. No comprueba contraseñas ni aceptación SUNAT. Si falta un requisito, corrígelo; no elimines el guard.

Arranca el resto:

```bash
dc up -d --no-build --pull never --wait
dc ps
docker stats --no-stream
ss -ltn | grep ':9000'
curl --fail --silent --show-error --output /dev/null http://127.0.0.1:9000/login
```

El puerto debe escuchar en 127.0.0.1:9000 y la página de login responder. PostgreSQL y Redis no deben publicar puertos. Los contenedores tienen restart unless-stopped y logs de 10m × 3; no añadas un compose override que quite límites.

Si falla un servicio, consulta sus últimas líneas localmente con `dc logs --tail 60 NOMBRE_SERVICIO`. No compartas logs completos ni fragmentos que contengan datos de clientes, claves o respuestas sensibles. Un contenedor healthy no prueba habilitación fiscal.

## 9. Conecta el subdominio HTTPS con nginx existente

El responsable del VPS debe agregar un vhost nuevo al nginx existente, con el dominio y certificado reales. No instales otro nginx en 80/443, no reemplaces sus otros vhosts ni reinicies Docker para esto. Ejemplo de bloque para adaptar a su configuración:

```nginx
server {
    listen 443 ssl;
    server_name SUBDOMINIO_REAL;
    ssl_certificate RUTA_CERTIFICADO_HTTPS_REAL;
    ssl_certificate_key RUTA_CLAVE_HTTPS_REAL;
    client_max_body_size 18m;
    location /socket.io/ {
        proxy_pass http://127.0.0.1:9000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 75s;
    }
    location / {
        proxy_pass http://127.0.0.1:9000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 75s;
    }
}
```

No metas cabeceras CORS permisivas ni elimines Origin: la sesión de navegador debe conservar su origen HTTPS. El límite del gateway para certificados sigue siendo el configurado por servicio, aunque el nginx admita cargas de recepción mayores.

```bash
nginx -t
systemctl reload nginx
```

Ejecuta la recarga sólo si la prueba es correcta. Abre el subdominio desde tu navegador y confirma que el certificado HTTPS es válido. `CORE_HTTPS_ORIGIN` debe coincidir exactamente con ese origen, sin barra final.

## 10. Primer ingreso y lo que configura el cliente

1. Entra en el subdominio y usa CORE_INITIAL_ADMIN_USERNAME con la contraseña que escribiste en initial_admin_password. No es demo.admin. Mantén estable ese username de bootstrap para no crear administradores extra al cambiarlo.
2. En **Usuarios y roles**, crea los accesos reales y asigna sedes, puntos y series. No compartas el administrador general entre operadores.
3. En **Sedes y maestros**, registra los RUC/razones sociales reales, sedes, establecimiento SUNAT de 4 dígitos, puntos y series. No copies datos ficticios ni reinicies correlativos con historial. La asignación histórica requiere su conciliación/corte propio.
4. En **Configuración SUNAT**, el responsable del cliente carga su P12/PFX, contraseña, usuario SOL secundario y datos GRE cuando corresponda. Configurar GRE no completa el desarrollo productivo de 09/31. Guardar no envía.
5. Revisa preparación fiscal: emisor/RUC del certificado, cadena/CRL, XSD y confianza CDR. Resuelve los bloqueos reales. No pongas otra CA o un certificado ficticio para conseguir una luz verde.
6. Autoriza por RUC sólo el perfil que usarán y que está integrado. La primera emisión real debe corresponder a una venta real autorizada; no envíes una factura ficticia para probar producción. La configuración Beta no se reutiliza como autorización de producción.
7. En **Correo corporativo**, configura el servidor aprobado y credenciales del remitente. Gmail necesita el mecanismo autorizado por Google, como contraseña de aplicación cuando la cuenta lo permita; no su contraseña normal copiada al sistema. Guardar, conexión, prueba y DOCUMENT son operaciones distintas. Esta entrega tiene diagnóstico SMTP deshabilitado en el Compose: no promete verificar autenticación al guardar ni lo actives editando flags sin revisar el flujo.
8. Autoriza DOCUMENT con la revisión vigente y confirma un destinatario antes de enviar. El perfil v2 incluye 07/08 integrados; permisos antiguos exigen nueva confirmación. HANDED_OFF no confirma que el destinatario haya recibido el correo.
9. En **Conexiones e integraciones → API del sistema**, abre la documentación nativa. La guía de consumo y ejemplo están en `docs/CONEXION_API_NATIVA_CORE.md` y `examples/native-api-client.ts` del repositorio/paquete. No entregues el P12/SOL a los consumidores. El catálogo B2B no implica que OAuth y todo el B2B productivo estén publicados en este core.

## 11. Respaldo, actualizaciones y qué no borrar

Antes de actualizar, conserva externamente y cifrados: los cinco dumps de DB, `data/artifacts`, `data/sunat-private`, branding, configuración y secretos. Redis requiere un respaldo consistente de su persistencia y revisión de pendientes; no copies sin más un AOF mientras cambia. Una copia sólo en el mismo disco no protege de perder el servidor. Ensaya la restauración en un destino nuevo, sin envíos y sin reemplazar la instalación original.

Si abriste una sesión SSH nueva, redefine FACTUEZ_ROOT, FACTUEZ_RELEASE, el PATH de Node portable si procede y la función dc de la sección 7 antes de ejecutar operaciones. No uses dc desde otro proyecto por accidente.

Para generar dumps individuales en el servidor, usa una carpeta NUEVA bajo backups y salida protegida; los comandos no contienen claves:

```bash
FX_BACKUP="$FACTUEZ_ROOT/backups/$(date -u +%Y%m%dT%H%M%SZ)"
install -d -m 0700 "$FX_BACKUP"
for FX_DB in factuez_identity factuez_billing factuez_sunat factuez_mailer factuez_received; do
  dc exec -T postgres pg_dump -U postgres -d "$FX_DB" -Fc > "$FX_BACKUP/$FX_DB.dump"
  test -s "$FX_BACKUP/$FX_DB.dump"
 done
```

Esos dumps por separado no garantizan un punto consistente entre microservicios ni constituyen el respaldo integral. Para un corte coordinado hay que drenar/pausar los procesos propios que escriben, conciliar trabajos y respaldar archivos/Redis/claves; no pausar aplicaciones ajenas ni activar envíos en una restauración.

Una actualización futura usa imágenes nuevas por digest y migraciones revisadas según esa versión. Los SQL de instalación inicial no sirven para actualizar una base usada. No regeneres claves, no borres volúmenes, no ejecutes `down -v`, limpiezas globales de Docker ni reinicios de otros servicios para arreglar FactuEz.

## 12. Si algo falla

| Problema | Qué revisar |
| --- | --- |
| Registry denied/pull falla | Login del VPS, privacidad y permisos del registro, digest exacto |
| Compose pide variables | core-public.json/core.env completos y el Compose correcto |
| Permission denied en secretos | Archivo regular sin enlaces, owner 1000 y 0600; no chmod 777 |
| PostgreSQL no inicia | PGDATA 17 inicializado, propietario real de la imagen y pg_hba válido |
| initdb/SQL dicen ya existente | No reinstales encima; revisar el destino y el estado parcial |
| Preflight bloquea containerd | Configuración/proceso real con infraestructura; no saltar el control |
| Login funciona en loopback pero no HTTPS | Origen canónico, Host/Origin, TLS y proxy nginx |
| WebSockets no conectan | Upgrade del proxy, mismo origen y reglas de red |
| Certificado guardado pero envío bloqueado | Readiness, RUC, cadena/CRL/CDR, perfil y autorización por revisión |
| SMTP bloqueado | Allowlist DNS, configuración válida, flags, autorización TEST/DOCUMENT y estado de la cola |
| API B2B 404 en el core | No está ensamblada/publicada productivamente en este Compose |

**Punto de parada:** si faltan imágenes publicadas o confianza fiscal pública revisada, no existe todavía una instalación productiva completa para arrancar con garantías. Son preparativos técnicos de la entrega/infraestructura; no se arreglan inventando datos de la empresa ni desactivando validadores.

## Lista final para ti

- Tengo acceso al VPS y sé qué servicios no debo tocar.
- Docker y containerd almacenan fuera de /var; no hice pull antes de verificarlo.
- Construí/publiqué las siete imágenes desde el código actualizado y guardé los digests.
- Verifiqué el ZIP y preparé una instalación nueva, con secretos propios.
- Revisé los archivos públicos PKI/CRL/CDR/XSD y sus hashes.
- Inicialicé el cluster/roles/bases y apliqué cada baseline una sola vez.
- El preflight pasa y los once contenedores están saludables.
- Sólo 9000 en loopback; HTTPS/nginx y WebSockets funcionan.
- El cliente registra sus credenciales en la aplicación; no me las envía por chat.
- Hice respaldo/restauración y un piloto real acordado antes de dar por concluida la puesta en marcha.
- No anuncié como terminadas las funciones que aún requieren desarrollo.


## Actualizaciones posteriores con aprobación

El circuito CI/CD del core se describe en [Guía CI/CD](GUIA_CICD_PRODUCCION.md). Incluye compilación/publicación en GitHub, aprobación local por paquete y actualización con comprobación de salud y recuperación de imágenes. Requiere instalación inicial y configuración de TI; no ejecuta migraciones automáticas ni habilita funciones pendientes.
