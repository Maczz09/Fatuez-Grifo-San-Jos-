# Arranque de FactuEz en intranet (QA)

Configuración preparada el 02/10/2026 para el QA existente `factuez-stage2-qa`.
No es un despliegue fiscal de producción. Conserva las bases, secretos y
documentos locales existentes; no ejecuta migraciones ni reinicializa series.

## Arranque del runtime ya inicializado

Desde `D:\Facturacion\FactuEz`, con Docker Desktop iniciado:

```powershell
$env:FACTUEZ_INTRANET_IP = '192.168.100.5'
docker compose -p factuez-stage2-qa -f docker-compose.demo.yml -f tests/compose.stage2.qa.yml -f tests/compose.intranet.qa.yml up -d --no-deps --no-build --pull never --wait --wait-timeout 180 postgres redis identity-service billing-service sunat-service sunat-emulator web-pwa kong mailer-worker realtime-service mailpit
```

La IPv4 debe corresponder a la interfaz LAN del servidor; comprobarla si cambia
la red/DHCP. El puerto se publica sólo en esa IPv4 y en loopback, no en todas
las interfaces. No ejecutar un `up` general: el compose base contiene migradores.
No usar `down -v`, `db push`, reset ni borrar volúmenes para arrancar el sistema.

- En el servidor: `http://localhost:8091/login`.
- Recargar conserva la sesión: [política de inactividad y avisos](SESION_WEB_QA.md).
- Desde la misma LAN: `http://192.168.100.5:8091/login`.
- WebSockets admiten explícitamente ambos orígenes y `127.0.0.1`.
- PostgreSQL, Redis, APIs internas, Mailpit y el emulador no publican puertos.
- La red de servicios permanece interna; no se habilita transmisión SUNAT ni
  correo corporativo. Los resultados del emulador no son CDR oficiales.

## Firewall y alcance

Si el firewall bloquea otros equipos, un administrador de Windows debe permitir
únicamente TCP 8091 hacia la IPv4 LAN, desde la subred autorizada. Para esta red
el alcance es `192.168.100.0/24`. No desactivar el firewall ni cambiar el perfil
de red para resolverlo; no abrir PostgreSQL, Redis, SMTP ni la administración Kong.
No crear redirecciones de puertos en el router ni publicar este QA en Internet.
Comprobar además el aislamiento de clientes Wi-Fi, VLAN y firewall Hyper-V/WSL.

Si hace falta, ejecutar **PowerShell como administrador** y crear esta regla
acotada (si ya existe una con este nombre, revisarla antes de repetir el comando):

```powershell
New-NetFirewallRule -Name 'FactuEz-QA-Intranet-8091' -DisplayName 'FactuEz QA - intranet TCP 8091' -Direction Inbound -Action Allow -Enabled True -Profile Any -Protocol TCP -LocalAddress '192.168.100.5' -LocalPort 8091 -RemoteAddress '192.168.100.0/24' -EdgeTraversalPolicy Block
```

La regla limita origen, destino y puerto aunque la interfaz Windows esté
clasificada como pública. No cambia ese perfil ni desactiva otras protecciones.

## Comprobación de este arranque

El 02/10/2026 se inició Docker Desktop y el runtime QA existente: once servicios
saludables, puertos Kong enlazados a loopback y a `192.168.100.5`, red de servicios
interna. `GET /login` respondió HTTP 200 por ambas direcciones desde el servidor;
`GET /sunat-health/health` también respondió 200. No se ejecutaron migraciones ni
se enviaron documentos. La creación de la regla de firewall fue denegada por
Windows por falta de privilegios de administrador; no se creó ni se desactivó
el firewall. Falta comprobar acceso desde una segunda PC.

## Seguridad y pruebas pendientes

Este acceso de desarrollo usa HTTP: no cifra credenciales ni sesiones en tránsito.
Usar sólo cuentas y datos de prueba en una LAN de confianza. La interfaz bloquea
la carga de secretos fiscales/SMTP desde HTTP remoto; no eludir esa protección.
La instalación PWA/service worker en otros equipos necesita HTTPS con certificado
confiable para ellos. No se ha configurado TLS ni autorización de producción.

La comprobación desde el propio servidor no demuestra conectividad desde otra
terminal: probar allí la URL, iniciar sesión, ver un documento y verificar tiempo
real. La impresión física depende del controlador y papel de esa terminal.

Para volver al acceso exclusivamente local, aplicar sólo los dos compose
originales y recrear `kong realtime-service` con `--no-deps --no-build --pull never`;
retirar después únicamente la regla de firewall específica de FactuEz, si existe.
