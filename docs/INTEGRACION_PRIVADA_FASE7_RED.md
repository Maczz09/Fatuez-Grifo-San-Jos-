# API privada — Fase 7: entrada VPN / Kong / HTTPS

Fecha: 09/10/2026. **Preparación técnica BETA, no conexión remota activada.**
Es la fase 7 del proyecto de extracción, no del cierre fiscal histórico.
No modifica el Kong intranet, panel, emisores, puertos QA, ventas o SUNAT.

## Decisión de despliegue

Se prepara un **Kong independiente**, DB-less y con un único listener HTTPS
en la IP de WireGuard. No se añade integración al Kong que sirve la PWA.

    ERP → WireGuard → IP VPN / DNS privado → Kong HTTPS + mTLS
      ├─ POST /integration/oauth/token → Identity M2M HTTPS/mTLS loopback
      └─ rutas exactas /integration/v1 → fachada HTTPS/mTLS loopback
           ├─ Identity: scopes/grants/revocación/auditoría
           ├─ Billing: snapshots, corte y diario
           ├─ SUNAT: XML/CDR/lotes originales y diario (sin envío)
           └─ Exportador: BD técnica cifrada y worker acotado

Cliente: certificado TLS propio de integración + ID/secreto OAuth
client_credentials; no SOL, firma SUNAT ni sesión de cajero. Bearer de máximo
300 segundos, sin refresh. VPN no sustituye scopes/grants o pertenencia de lotes.

### Windows y Windows Server sí pueden alojar FactuEz

No se exige reemplazar Windows por Linux. La restricción corresponde al
**entorno de ejecución de este perfil de entrada privada**, no al sistema
operativo del servidor físico ni a los equipos que utilizan la PWA.

| Entorno | Forma de alojamiento |
|---|---|
| Windows de escritorio compatible | FactuEz con Docker Desktop y contenedores Linux; no equivale a activar este perfil privado |
| Windows Server | VM Linux en Hyper-V para el entorno Docker/Linux y la entrada privada; Windows Server sigue siendo el anfitrión |
| Servidor Linux | Entorno Linux directamente, sin VM por este motivo |

Kong no ofrece una instalación nativa para Windows: su documentación indica
Docker. Docker Desktop no está soportado en Windows Server. Hyper-V sí admite
máquinas virtuales Linux sobre Windows Server. Estas opciones requieren revisar
versión, recursos, virtualización, red y permisos con TI antes de desplegar.

**Perfil preparado: Linux nativo o VM Linux, con WireGuard, Kong y procesos
privados en el mismo entorno Linux y con upstreams en loopback.** Kong usa
host network para llegar a ellos. En Windows Server, ese host es la VM Linux,
no Windows Server. El preflight se ejecuta dentro de la VM.

Este perfil no está preparado para Docker Desktop ni para comunicar un Kong
en Linux con servicios ligados al loopback de Windows: 127.0.0.1 allí apunta
a otro entorno. Tampoco conecta automáticamente los contenedores intranet
actuales. Una distribución entre Windows y Linux necesitaría otro perfil de
red y pruebas explícitas, manteniendo mTLS y aislamiento.
QA localhost:8091 y la instalación actual de Windows permanecen intactos.

El usuario confirmó **Windows 10/11** el 10/10/2026. La
[fase 8 de preparación Desktop/piloto](INTEGRACION_PRIVADA_FASE8_PILOTO_WINDOWS.md)
incorpora diagnóstico de requisitos; falta repetirlo en el host del cliente y
revisar su versión/edición. No se ha construido ni probado un instalador
Windows, arranque automático o panel de mantenimiento; este perfil no debe
presentarse como ese paquete terminado. Los operadores seguirán utilizando
el navegador, sin administrar contenedores, VPN del servidor ni certificados.

No se relajaron los guards BETA + loopback. Varios hosts/pods requieren otro
perfil explícito ensayado; no cambiar a 0.0.0.0 ni suprimir mTLS.
Host network comparte pila del host, no aislamiento de red Docker: TI debe
comprobar firewall y accesos. Se mantiene arquitectura por microservicios.

## Código

- infra/integration/private-edge.mjs: contrato de red cerrado y renderer de
  kong.json, kong.conf, compose.yml, firewall.nft, sin activarlos.
- infra/integration/private-edge.example.json: ejemplo ficticio sin secretos.
- infra/integration/private-edge-preflight.mjs: preflight opt-in de sólo lectura.

IP, DNS, interfaz, CIDR, puertos y cuotas configurables. Rechaza producción,
IP pública/comodín, CIDR más amplio que /24, subred no canónica, puertos
repetidos, campos desconocidos e inyección. Upstreams fijos en loopback;
no URLs elegidas por el cliente, datos comerciales o lectura de .env QA.

## Políticas

1. Sólo 17 operaciones del contrato: token POST; lectura GET de capacidades,
   catálogos, documentos, lotes, artefactos, exportaciones y cambios; POST de
   exportación técnica. Método/ruta exactos, UUID y hostname/SNI explícitos.
   Sin catch-all, CORS, PWA, /api, /internal, fiscal, ADMIN, introspect o JWKS.
2. mTLS obligatorio Nginx, CA privada de clientes y CRL vigente. No optional_no_ca,
   cabeceras de certificado como autoridad ni fallback. TI renueva CRL/recarga
   y revoca también cliente OAuth/peer VPN; cambiar un archivo no promete
   revocación instantánea de sesiones TLS establecidas/resumidas.
3. Kong presenta certificado propio a Identity/fachada; fingerprint permitido
   sólo en TOKEN peers y fachada, nunca ADMIN. Propietarios usan identidades
   distintas. Certificado externo no reenviado como autoridad en cabecera.
4. TLS 1.2/1.3, verificación obligatoria de CA/servidor upstream, global y por
   servicio. Cada servidor interno requiere SAN IP 127.0.0.1 y SAN DNS:
   identity.factuez.internal para Identity; read.factuez.internal para fachada.
   Upstreams nombrados fijan la identidad TLS/Host, con un único destino
   127.0.0.1:puerto: esos nombres no se resuelven como destinos de red.
   No HTTP, verificación falsa o curl inseguro.
5. CIDR validado por IP real, no X-Real-IP/Forwarded; proxies de confianza vacíos.
   Firewall candidato exige interfaz WireGuard y CIDR. Con NAT, cuota IP puede
   compartirse; IP no sustituye identidad OAuth ni permiso por empresa.
6. Cuotas configurables ruta/IP, policy local, fail-closed, body ≤16 KiB,
   conexiones concurrentes limitadas. Retry-After y metadatos de cuota permiten
   esperar antes de reintentar. El plugin de tamaño/longitud sólo se aplica
   a POST token/export; no exige cuerpo a las lecturas GET. Kong puede calcular
   Content-Length al almacenar un POST chunked pequeño: se admite dentro del
   límite, no se promete rechazar todo chunked. El límite Nginx también bloquea
   cuerpos excesivos antes del upstream. Apps conservan límites más estrictos:
   token 2 KiB, export 16 KiB y dos trabajos. No cuota permisiva en fallo.
7. Un nodo BETA: límites locales se reinician con Kong, no se suman entre nodos.
   HA/cuotas distribuidas/capacidad requieren ensayo. retries=0 evita repetir
   POST; timeout se consulta/reintenta con la misma clave de idempotencia.
8. Admin/GUI/debug/status/stream apagados. Sin BD Kong, Redis, Docker socket,
   volúmenes fiscales, dependencies Compose ni puertos generales. Usuario Kong,
   raíz read-only, sin capabilities, tmpfs acotado, imagen por digest/perfil.
   Un worker y caché Kong de 64 MiB; prefix y KONG_PREFIX coinciden en /tmp/kong.
   Estos límites son del ensayo BETA, no una garantía de capacidad productiva.
9. Sin logs HTTP access/error de Kong para no registrar URI/checkpoint/secrets.
   Auditoría obligatoria sigue en servicios; monitorizar procesos y métricas
   agregadas privadas. Logging distinto exige redacción y retención verificadas;
   no activar debug ni volcar requests/bodies o variables.

## Preparación TI

TI define host/IP/interfaz/CIDR/DNS y autoriza piloto BETA. WireGuard requiere
peers/keys individuales guardados en equipos, nunca por chat. No se deducen
VPN, firewall/NAT/DNS o certificados de una carpeta de documentos.

1. Completar copia del JSON con metadatos no secretos.
2. Generar en un directorio NUEVO; nunca sobrescribe uno existente:

    node infra/integration/private-edge.mjs --config /ruta/ti/edge.json --out /ruta/nueva/bundle

3. Proveer por canal seguro, en bundle/tls:

| Archivo | Uso |
|---|---|
| edge-cert.pem / edge-key.pem | servidor HTTPS: SAN DNS privado, EKU serverAuth |
| edge-server-ca.pem | CA pública confiada por ERP y preflight |
| edge-client-ca.pem | CA pública privada de clientes de integración |
| edge-client.crl.pem | CRL firmada y vigente de esa CA |
| upstream-ca.pem | CA pública de servidores internos y cliente Kong |
| kong-client-cert.pem / kong-client-key.pem | identidad Kong, EKU clientAuth |

Preflight admite **una raíz autofirmada y un leaf por archivo**, no intermediarios
ambiguos. No es PKI SUNAT/P12/PFX. Una cadena distinta exige extender y ensayar
perfil, no eliminar guards. Claves de servidor, cliente Kong, JWT M2M y firma
fiscal independientes. TLS no acredita RUC ni aceptación SUNAT.

Cuenta Kong sólo lee bundle. Renderer crea 0700/0600; TI adapta propietario/
grupo/ACL, sin lectura pública ni escritura ajena. Claves nunca en JSON,
Compose, repo o comandos. Bundle read-only también para operador: preflight
no protege una alteración posterior.

4. SQL/roles de fases 3–6 sólo en copia nueva/autorizada; ningún DDL de arranque.
   Activación de triggers/épocas, retención/carga/deadlocks requieren evidencia.

| Proceso separado | Ejecutable compilado | Acceso mínimo |
|---|---|---|
| Identity M2M | services/identity-service/dist/integration/main.js | BD propia de clientes/auditoría, claves M2M y catálogo privado |
| Billing lector | services/billing-service/dist/integration/main.js | SELECT propietario/diario, no DDL/emisión |
| SUNAT lector | services/sunat-service/dist/integration/main.js | SELECT propietario/diario, auditoría específica, originales read-only |
| Exportador | services/integration-export-service/dist/main.js | BD técnica integration_exports_beta y clave cifrado, no BD fiscal |
| Fachada | services/integration-service/dist/main.js | sólo HTTPS/mTLS; sin BD/archivos fiscales |
| Kong privado | Compose separado generado | sólo token/fachada; sin BD/firmas/originales |

SUNAT/Identity/exportador también INSERTan auditoría: SELECT en fuentes y permisos
específicos sólo en esa auditoría, no superusuario ni roles globales/owners.
Mantenimiento del diario usa credencial distinta del lector.

La administración humana de Identity revalida la sesión y su revocación contra
su Redis privado (REDIS_HOST/REDIS_PORT y secreto por REDIS_PASSWORD_FILE), además
de su BD y clave pública de sesión. Esa dependencia no se publica por Kong ni
se comparte con el ERP. No omitir la revalidación para provisionar clientes:
el canal ADMIN requiere su propio peer TLS y un administrador autorizado.
El intercambio OAuth técnico no utiliza una sesión de cajero.

Flags por proceso: INTEGRATION_IDENTITY_ENABLED; Billing: INTEGRATION_BILLING_READ_ENABLED,
INTEGRATION_BILLING_CAPTURE_ENABLED, INTEGRATION_BILLING_CHANGES_ENABLED; SUNAT:
INTEGRATION_SUNAT_READ_ENABLED, INTEGRATION_SUNAT_CHANGES_ENABLED; exportador:
INTEGRATION_EXPORT_ENABLED, INTEGRATION_CHANGES_ENABLED; fachada:
INTEGRATION_READ_ENABLED, INTEGRATION_EXPORT_FORWARD_ENABLED. BETA/loopback
obligatorios; cada puerto/origen/peer/key se configura separado según fases 3–6.
No arrancar AppModule/workers de emisión para dar lectura ni compartir .env de
producción. Ningún flag se cambió aquí.

5. Registrar fingerprint Kong en TOKEN de Identity y fachada, ADMIN sólo por
   canal interno distinto. Registrar clientes/grants por administración
   autorizada, sin cliente ADMIN autogenerado.
6. Establecer FACTUEZ_PRIVATE_KONG_IMAGE como kong:3.9.3@sha256:DIGEST-REVISADO
   y FACTUEZ_PRIVATE_EDGE_BUNDLE absoluto al directorio exacto. El preflight
   rechaza tag sin digest/latest u otro bundle. El digest debe ser el artefacto
   ensayado/revisado por TI; el formato no constituye un examen de vulnerabilidades.
   Kong 3.9.3 es la versión disponible para el ensayo aislado, no una afirmación
   de ser la última o adecuada para producción sin revisión de seguridad.
   Preflight sólo en host Linux autorizado:

    node infra/integration/private-edge-preflight.mjs --config /ruta/ti/edge.json --bundle /ruta/bundle --read-only

Comprueba WireGuard/IP, DNS exactamente a IP VPN, cuatro archivos renderer
sin alteración, TLS/key/purpose/trust, CRL firmada/vigente y handshake TLS en
dos upstreams loopback, con sus identidades DNS e IP SAN indicadas arriba.
Sin HTTP ni tokens. Certificados válidos >24 h, CRL >1 h.
ip/openssl con argumentos fijos, timeout, sin shell. No ejecutado con claves reales.

PRECHECK_PASSED_NOT_ACTIVATED no acredita peers/aprobaciones de aplicación,
firewall/VPN o permisos ERP: éstos requieren piloto fase 8. Ejecutar este
preflight directamente en Windows, un archivo alterado, DNS público, CRL
vencida o TLS inválido bloquea. Windows Server como anfitrión de una VM Linux
no es un bloqueo: el preflight debe ejecutarse dentro de esa VM.

7. Revisar firewall.nft contra reglas existentes: sólo IP/puerto nuevo, sin
   flush ruleset, NAT, tocar puertos actuales o permitir toda intranet. Revisar
   egress Kong al loopback designado; no publicar PostgreSQL/Redis/SUNAT.
   Cliente WireGuard: AllowedIPs=IP-VPN-servidor/32, no default route/toda LAN;
   peers con direcciones VPN /32 individuales.
8. Tras aprobación, FACTUEZ_PRIVATE_KONG_IMAGE por digest revisado y
   FACTUEZ_PRIVATE_EDGE_BUNDLE absoluto. Perfil private-edge-beta, ningún
   dependency. No Compose general ni mezclar con QA. Instalar sólo gateway.

## Piloto y recuperación

Antes de acceso remoto: peer permitido/no permitido; certificado ausente/
desconocido/revocado; token vencido/revocado; grants parciales; Host/SNI erróneo;
PWA/interno/ADMIN inaccesibles; cuotas; export/checkpoint/XML/CDR íntegros;
caída de upstream y auditoría. Kong local con fixtures no prueba VPN real.

Incidente: revocar cliente/peer VPN y parar **sólo Kong privado**, sin afectar
intranet/emisión. No borrar historial/diarios/key de cifrado para recuperar
disponibilidad. Restore propietario rota épocas/corte nuevo; exportador conserva
clave/contexto/TTL según fase 6. Sin producción/bypass 09/31.

**Siguiente: fase 8**, piloto/conciliación autorizada, carga, retención,
recuperación y aprobación TI. Fase 7 prepara candidatos/controles, no finge
conexión remota ni cierre fiscal.

## Verificación

Verificado el 09/10/2026:

- 170 pruebas locales / dos suites PASS: renderer, 17 rutas del contrato,
  configuración cerrada, exclusión de producción, permisos de archivos y
  preflight con dependencias simuladas. No se ejecutó el preflight contra VPN
  o certificados reales.
- Kong 3.9.3 real en red/volumen/contenedores nuevos, internos y desechables:
  122 comprobaciones PASS, más una comprobación de certificado válido fuera
  del CIDR permitido PASS. Limpieza de recursos propios PASS.
- Regresión general: 5 043 pruebas PASS / 126 suites, una omisión condicional
  XSD preexistente por no configurar FACTUEZ_FISCAL_XSD_PYTHON; ninguna omisión
  nueva. Sintaxis de los cuatro scripts Node aprobada.
- Las 17 operaciones positivas llegan al propietario ficticio correcto por
  mTLS. Para cada una se rechazan prefijos y sufijos ajenos; también PWA,
  ADMIN, rutas internas, métodos/UUID incorrectos y Host/SNI incorrectos.
- Certificado ausente, CA ajena o revocación se rechazan. Cabeceras de IP,
  rol o certificado no conceden confianza. No hay listener general o Admin.
- Cuerpos excesivos declarados y chunked no alcanzan el upstream; un chunked
  pequeño conserva su tamaño. Certificados de upstream ajenos o con identidad
  incorrecta fallan, y la restauración del certificado permitido recupera la
  ruta. Las cuatro cuotas bloquean exceso y proporcionan Retry-After.

El ensayo usa únicamente claves efímeras y servidores HTTPS ficticios; no
valida permisos/datos del ERP, una VPN real o un piloto integrado de los seis
procesos. Su vigencia corta de certificados/CRL no reemplaza los mínimos del
preflight TI. No se reutilizan contenedores/configuración/claves del Kong
intranet, no se publican puertos ni se instala SQL o firewall.

Comprobación final de metadatos del QA: 14 servicios saludables, con 12 horas
de ejecución; los tres contenedores históricos de migración permanecen detenidos
con exit 0, no se ejecutan. Sin contenedores, redes o volúmenes temporales
residuales de fase 7. Esta lectura de salud no acredita un piloto ERP ni un
despliegue de los procesos de integración.

Reproducción local del ensayo (requiere las imágenes locales y dependencias
indicadas en el runner; nunca descarga imágenes ni reutiliza el QA):

    pnpm exec vitest run tests/integration-edge.spec.ts tests/integration-edge-preflight.spec.ts --maxWorkers=2
    node tests/integration-edge.e2e.cjs --isolated-synthetic-only

No existe un comando de activación automática: preparar archivos y aprobar
pruebas no concede permiso para publicar la API o configurar la VPN del cliente.

Referencias primarias:
[directivas Nginx en Kong](https://docs.konghq.com/gateway/latest/reference/nginx-directives/),
[rutas](https://developer.konghq.com/gateway/routing/traditional/),
[TLS Kong](https://docs.konghq.com/gateway/latest/reference/configuration/),
[mTLS/CRL Nginx](https://nginx.org/en/docs/http/ngx_http_ssl_module.html),
[límites locales](https://developer.konghq.com/plugins/rate-limiting/),
[instalación de Kong y Windows](https://developer.konghq.com/gateway/install/),
[Docker Desktop y Windows Server](https://docs.docker.com/desktop/troubleshoot-and-support/faqs/windowsfaqs/),
[Linux en Hyper-V de Windows Server](https://learn.microsoft.com/en-us/windows-server/virtualization/hyper-v/Supported-Linux-and-FreeBSD-virtual-machines-for-Hyper-V-on-Windows).
