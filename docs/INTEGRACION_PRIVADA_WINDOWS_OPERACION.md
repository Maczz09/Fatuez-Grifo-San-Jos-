# Entrada privada Windows y ensayo de recuperación

Fecha: 10/10/2026. Parte de la fase 8 de la **API privada de extracción**.
Estado: código y ensayos aislados entregados; **conectividad Desktop verificada
en esta estación después del ajuste autorizado**. La activación remota sigue
pendiente. No es instalación en el cliente ni cierre fiscal de etapas 2/3.

## Qué se preparó

- `infra/integration/windows-edge.mjs`: configuración estricta BETA y generación
  de un paquete nuevo; no sobrescribe carpetas ni sigue enlaces simbólicos.
- `windows-edge.example.json`: ejemplo, no direcciones o accesos aprobados.
- `windows-relay.mjs`: entrada TCP nativa Windows sobre la IP WireGuard exacta.
  Antes de escuchar comprueba host Windows, requisitos iniciales, interfaz
  WireGuard activa, dirección y DNS privado, y la regeneración exacta del paquete.
  Requiere invocación explícita con aprobación de TI, nunca arranca por importar.
- `windows-operation.mjs`: comprobación y **plan** de iniciar/detener únicamente
  `kong-private`. No ejecuta el plan, configura firewall ni instala tareas.
- `synthetic-recovery.mjs`: respaldo cifrado con inventario para ensayos nuevos
  SYNTHETIC exclusivamente; no es un importador de respaldos empresariales.

La entrada es TCP opaco: **no lee HTTP, claves, tokens, XML ni termina TLS**.
TLS/mTLS, certificados/CRL, rutas y OAuth permanecen en Kong y sus propietarios.
La IP real de la VPN sólo la ve la entrada nativa; allí se limitan conexiones
por IP, nuevas conexiones/minuto, tiempo de espera y duración máxima. El destino
es exclusivamente `127.0.0.1` y no hay reintento o fallback.

Kong mantiene las 17 operaciones exactas, upstreams HTTPS/mTLS en loopback,
verificación de nombres/CA, bloqueo ADMIN/status, tamaños y cuotas HTTP. Como
Kong verá una conexión local del relay, **la cuota HTTP es agregada**, no por IP
del ERP. No confía en `Forwarded`/`X-Forwarded-For`. Es una decisión conservadora,
no afirmar que NAT conserva el origen ni usar headers para eludir límites.

El Compose separado no publica puertos, conserva filesystem de sólo lectura,
capabilities eliminadas, recursos acotados, imagen Kong por digest revisado y
`restart: no`. Los propietarios deben estar preparados previamente; no los
habilita, migra bases ni se combina con la intranet. El plan usa el contexto
local Desktop, `--no-deps --no-build --pull never`, archivo de entorno vacío
explícito y sólo ese servicio; detenerlo no borra volúmenes.

Este perfil necesita **host networking de Docker Desktop prehabilitado y probado**.
No requiere que el cliente administre una VM Linux tradicional, pero Docker/WSL
sí utilizan virtualización. No se habilita esa opción automáticamente porque
aplicarla puede reiniciar Docker e interrumpir la intranet.
[Docker: host networking y sus límites](https://docs.docker.com/engine/network/drivers/host/),
[Docker: networking Desktop](https://docs.docker.com/desktop/features/networking/).

## Resultado real de red: fallo inicial y corrección autorizada

Se ensayó Kong 3.9.3 local, por image ID revisado, en un contenedor nuevo y
etiquetado. Sólo accedió a un directorio temporal nuevo con claves/certificados
ficticios, dos servidores HTTPS ficticios nativos y puertos de loopback temporales.
El runner no publicó una IP VPN/LAN, descargó imagen, modificó configuración
del host o tocó QA. El ajuste posterior del host se describe por separado.

**El ensayo inicial Desktop no pasó**: Kong quedó running, su listener dentro del
contenedor respondió (502 al no llegar al owner nativo), pero Windows obtuvo
`ECONNREFUSED` al listener Kong de loopback. No hubo errores de configuración
clasificados en el diagnóstico. Esto acredita un problema de conectividad
Desktop–host en esta estación, **no demuestra por sí solo** si la opción está
deshabilitada, una limitación de esta versión o una política del host. Los
indicadores de configuración consultados inicialmente no ofrecieron confirmación útil.

El usuario autorizó expresamente revisar/ajustar la red y el posible reinicio de
Docker. Se confirmó Docker Desktop **4.70.0**, motor Linux **29.4.0** y contexto
local `desktop-linux` sobre el named pipe esperado. La configuración agrupada
de la propia aplicación confirmó `vm.network.hostNetworkingEnabled: false` y
Enhanced Container Isolation desactivado/no bloqueado. No se desactivó una
protección para habilitar la red ni se modificaron políticas administradas.

Se actualizó exclusivamente `vm.network.hostNetworkingEnabled` a `true` mediante
el mismo contrato local que utiliza la interfaz de la versión instalada; no se
añadieron claves supuestas al JSON ni se utilizaron ajustes antiguos. La llamada
de actualización agotó su espera durante el **reinicio automático de Desktop**;
eso no se tomó como prueba de que el cambio hubiera fallado. La consulta posterior
confirmó el valor `true`, persistido también como `HostNetworkingEnabled`, y el
motor volvió a estar disponible. No hizo falta otro reinicio manual.

Se recuperaron sólo los contenedores QA que estaban activos antes de ese reinicio,
validando sus identificadores, nombres y etiqueta de proyecto: primero las tres
bases/caché y después los seis servicios detenidos. Los otros cinco arrancaron
automáticamente. No se recrearon contenedores, ejecutaron migradores o hicieron
cambios en volúmenes, credenciales, series o configuración fiscal. Los **mismos
14 contenedores** quedaron healthy y `/login` respondió **HTTP 200** tanto por
`localhost:8091` como por `127.0.0.1:8091`.

El E2E Desktop se repitió **dos veces**, con **15 comprobaciones PASS por ejecución**
y limpieza PASS en ambas:
conexión Windows–Kong–owners nativos, relay TCP opaco, seis rutas prohibidas,
rechazo sin certificado o con certificado revocado, y rechazo del upstream con
nombre TLS incorrecto antes de recuperar la conexión correcta. Todo con claves,
owners y datos ficticios en recursos nuevos. No se resolvió el fallo usando
`0.0.0.0`, relajando TLS, ampliando CIDR o confiando en headers.

`hostSettingsChanged: false` en la salida significa que **el runner** no modifica
el host; no niega el ajuste autorizado realizado antes. `vpnVerified: false`
permanece explícito: no se activó el relay real ni se verificaron VPN, firewall,
DNS remoto, grants reales o el host del cliente. Esos ensayos siguen pendientes
con TI; aprobar loopback local no equivale a autorizar acceso remoto.

El test TCP/TLS de unidad sí conserva el fingerprint del cliente y rechaza
clientes sin certificado; utiliza sockets loopback con un mapeo **sólo de test**.
No es evidencia de VPN, IP real remota, Kong Desktop o firewall del cliente.

Verificación de este incremento: **72 pruebas nuevas PASS**; se repitieron las
242 relacionadas y la revisión de tipos estrictos, ambas PASS. Regresión general
del incremento previo (no repetida por este ajuste del host): **5 181 PASS en
130 suites**, una omisión XSD condicional preexistente, ninguna omisión nueva.
Se repitieron los siete checks de inventario de fuentes, todos PASS. La regresión anterior conserva sus
cifras; los E2E de Desktop son evidencia separada, no PASS/skip sumados a ella.
El fallo inicial se mantiene documentado junto al ensayo posterior aprobado.
Los 14 servicios QA quedaron healthy después del reinicio autorizado, con los
mismos identificadores pero **uptime nuevo**, no continuidad ficticia de uptime.

## Respaldo/restauración: qué pasó y qué no

`tests/integration-recovery.e2e.mjs` obtuvo **32 comprobaciones PASS** en un
PostgreSQL nuevo, red interna nueva, dos bases nuevas y archivos en tmpfs; sin
puertos publicados o volúmenes existentes. Utilizó los esquemas técnicos reales
de exportación/feed y el cifrado `ExportVault`; la cabecera/historial y el control
de época fueron objetos de fixture, no las tablas empresariales de emisión.

Comprobado:

1. Dump PostgreSQL y original ficticio con inventario SHA-256, encapsulados con
   AES-256-GCM. Una clave, contexto o byte alterado impide abrirlo antes de crear
   el destino de restauración; el respaldo original permanece intacto.
2. `pg_restore` transaccional en una base nueva y vacía; filas, blobs cifrados,
   auditorías e inventario coinciden exactamente. No se restaura sobre el origen.
3. Rol lector de fixture y permisos reprovisionados tras el restore: SELECT de
   historial permitido, UPDATE/DELETE y lectura de exportaciones denegados.
   Trigger de inmutabilidad habilitado; también deniega modificación al owner.
   El dump usa `--no-owner --no-acl`: no fingir que restaura roles/grants solo.
4. Contenido/checkpoint cifrados se recuperan con la misma clave; una clave
   errónea no abre los datos. Archivo restaurado coincide en tamaño/bytes/hash.
5. Cambio transaccional de la época del **control de fixture** en el destino,
   sin tocar origen ni contadores. No se conecta ningún consumidor real.

Límites: no se restauraron los diarios de propietarios Billing/SUNAT completos,
roles empresariales/Identity/Redis, certificados reales, Windows ni servidor del
cliente. La rotación de épocas de TODOS los diarios propietarios y corte nuevo
sigue siendo un procedimiento separado obligatorio antes de servir una copia.
El gate permanece cerrado; conservar SHA no valida firma, PKI o CDR SUNAT.

Los recursos Docker y archivos temporales se limpiaron sólo después de verificar
sus nombres, etiquetas e identidad. La intranet y sus originales se conservaron.

## Uso para desarrollo/TI

Desde `D:\Facturacion\FactuEz`:

    pnpm test:integration-windows-edge
    pnpm test:integration-recovery:e2e
    pnpm test:integration-windows-desktop:e2e

El último comando debe fallar si Desktop no ofrece la conectividad requerida:
no es un skip ni se convierte un fallo de red en PASS. Todos los E2E son manuales
con guard SYNTHETIC, contexto local verificado y recursos nuevos etiquetados;
no forman parte del arranque normal del sistema.

Preparar un paquete, únicamente después de revisar el ejemplo y elegir una
carpeta nueva; no se ejecutó sobre una configuración o certificado del cliente:

    node infra/integration/windows-edge.mjs --config RUTA_CONFIG --out CARPETA_NUEVA
    node infra/integration/windows-operation.mjs --bundle CARPETA_NUEVA --check
    node infra/integration/windows-operation.mjs --bundle CARPETA_NUEVA --plan-start

El paquete incluye `OPERATOR.md`. La instalación/inicio autónomo después de
reiniciar o cerrar sesión **no está implementado ni ensayado**. No se configura
autologon, passwords guardadas, tareas con privilegios o WSL/Docker silenciosamente.
Windows 10 requiere revisión adicional de soporte y por ahora la comprobación
conservadora no lo aprueba automáticamente. Edición/licencias Windows/Desktop,
certificados/CRL/grants y aceptación siguen en TI, sin enviar claves por chat.

## Extracción restante

01/03/07/08 mantienen las capacidades preparadas; GR 09/GT 31 no tienen todavía
fuente empresarial de extracción completa. PDF tampoco se expone por esta API.
No se usa el laboratorio GRE ni el lector offline GT como historial empresarial,
ni se inventan UUID/asociaciones. Esos adaptadores y el PDF son trabajo técnico
pendiente separado de este incremento, no algo solucionado habilitando red.

La fase 8 sigue abierta: operación instalada, fuentes restantes, VPN/piloto
autorizado, recuperación completa y aceptación por TI. La conectividad Desktop
local ya pasó; debe repetirse en el equipo de destino, no darse por heredada.
