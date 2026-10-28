# API privada — Fase 8: piloto y preparación Windows 10/11

Fecha: 10/10/2026. Estado: **iniciada; ensayo local ficticio verificado, sin
activación remota ni aprobación de datos reales**. Es la fase 8 de la API de
extracción, no el cierre de las fases fiscales 2/3.

## Objetivo y decisión Windows

El usuario confirmó Windows 10/11 como destino. Se orienta la instalación
sencilla a **Docker Desktop con WSL2**, sin una VM Linux que el cliente tenga
que administrar manualmente. WSL2 utiliza virtualización administrada por
Windows: no significa ausencia de virtualización. Docker Desktop no exige
instalar una distribución Ubuntu para ejecutar sus contenedores.
[Documentación oficial de Docker/WSL2](https://docs.docker.com/desktop/features/wsl/).

TI configura una vez; los operadores utilizan el navegador. Un estado de
salud o un script de diagnóstico no sustituye instalador, soporte del SO,
arranque, respaldo o validación de red.

Windows 10 Home/Pro terminó su soporte ordinario el 14/10/2025. No se presume
ESU, soporte de otra edición ni compatibilidad vigente de Docker a partir de
un número de build. Windows 11 también requiere revisar su edición y ciclo
de soporte. TI revisará además las condiciones de licencia de Docker Desktop.
[Ciclo de Windows 10](https://learn.microsoft.com/en-us/lifecycle/products/windows-10-home-and-pro),
[requisitos/licencia de Docker Desktop](https://docs.docker.com/desktop/setup/install/windows-install/).

### La configuración de fase 7 no se copia sin cambios

El perfil de [fase 7](INTEGRACION_PRIVADA_FASE7_RED.md) sigue siendo
LINUX_HOST_LOOPBACK. Su listener exige una IP WireGuard visible en ese mismo
entorno. Docker Desktop host networking opera a nivel TCP/UDP y no permite
ligar un proceso dentro del contenedor directamente a las interfaces/IP del
host Windows. Tener WSL y un motor Linux no comprueba ese requisito.
[Limitaciones de host networking](https://docs.docker.com/engine/network/drivers/host/).

Nuevo candidato implementado: TCP nativo Windows sobre VPN, Kong en loopback
Desktop y propietarios con sus guards existentes. Ver
[operación Windows y resultado de ensayos](INTEGRACION_PRIVADA_WINDOWS_OPERACION.md).
Su ensayo Desktop inicial falló; **15 checks posteriores PASS** después del
ajuste de red y reinicio autorizados en esta estación. No se considera listo
para activar remotamente. Pendiente de validación: host de destino, VPN y
firewall. TI debe demostrar dónde se termina VPN/TLS, qué IP de
origen ve cada frontera y cómo se aplican los límites sin confiar en headers.
No se genera un Compose supuestamente compatible añadiendo 0.0.0.0, desactivando
mTLS, ampliando CIDR o apuntando propietarios a servicios Windows por accidente.
No se modificaron Docker Desktop, WSL, interfaces, firewall o portproxy.

Windows 11 tiene opciones de red WSL distintas a Windows 10, que deben probarse
por separado; no se configura networkingMode=mirrored ni se abren reglas
Hyper-V automáticamente. Tampoco se instala WireGuard o se generan peers reales.
[Red WSL](https://learn.microsoft.com/en-us/windows/wsl/networking).

## Código entregado en este incremento

- infra/integration/windows-readiness.mjs: comprobación opt-in de sólo lectura.
- tests/integration-windows-readiness.spec.ts: 43 casos del diagnóstico.
- tests/integration-pilot.fixture.ts: laboratorio de cinco apps Nest HTTPS.
- tests/integration-pilot.spec.ts: 23 casos de aceptación integrada ficticia.
- tests/tsconfig.integration-pilot.json: revisión sin emisión, strict heredado
  del proyecto y alias coherentes con Vitest; no relaja los tsconfig de servicios.
- Scripts del proyecto: check:integration-windows y test:integration-pilot.

El diagnóstico necesita Node del proyecto y lee únicamente build/tipo de
Windows, arquitectura, RAM/CPU/virtualización, versión WSL y respuesta del
motor Linux local. Sólo admite el endpoint named-pipe de desktop-linux y fuerza
ese contexto en la consulta del motor: no usa un DOCKER_HOST arbitrario ni
contacta un Docker remoto. Tiene límites de tiempo/tamaño y errores redactados.
No lista nombres de equipos/usuarios/distribuciones, claves, volúmenes o datos
de negocio. No instala, actualiza, arranca o reinicia servicios.

HOST_CHECKS_PASSED_PILOT_PENDING significa únicamente que pasaron requisitos
medibles iniciales. **No acredita** backend WSL2 seleccionado, edición/ciclo
de soporte, licencias, capacidad de producción, VPN, certificados reales,
firewall, permisos ERP o arranque autónomo. Windows Server y ARM no se declaran
soportados por este perfil x64; Windows 10 mantiene revisión de soporte pendiente.

## Ensayo integrado realizado

Cinco apps de los módulos reales de Identity, Billing lector, SUNAT lector,
exportador y fachada, con puertos HTTPS independientes exclusivamente en
127.0.0.1. Cada servidor y cada rol de transporte usa una clave TLS ficticia
distinta; certificados obligatorios y allowlists por frontera. OAuth se
obtiene por HTTP, no se inserta un bearer de prueba en los guards humanos.

El harness aloja esas apps en un proceso de pruebas; **no es un despliegue de
cinco procesos productivos**, un piloto con Kong+VPN ni una conversión a monolito.
Los repositorios son dobles en memoria usados sólo en tests, no fallbacks del
runtime. No se conectan PostgreSQL/Redis del QA, ni se leen XML/CDR del cliente.
El chequeo humano real con sesión Redis sigue pendiente en el piloto autorizado.

Cobertura verificada:

1. Token M2M de 300 segundos, sin refresh, y ámbitos/peers efectivos.
2. Corte completo 01/03/07/08: cuatro documentos, paginación sin repetición,
   detalles por ítem y decimales conservados como texto. Conciliación exacta
   por tipo con bigint; no se netean NC/ND como si hubiera aprobación contable.
3. XML/CDR íntegros, SHA-256/tamaño, no-store y sin rutas físicas. La boleta
   resuelve el CDR al RC propietario, no inventa un CDR individual.
4. Exportación JSONL con cuatro detalles y ocho originales, manifest.json,
   checksum del manifiesto y del ZIP, asociaciones y cobertura completa.
5. Reinicio HTTP del exportador, idempotencia sin duplicar trabajo, lease
   ficticio vencido y recuperación con la misma clave de cifrado.
6. Una clave errónea bloquea la lectura sin sobrescribir el ciphertext;
   recuperar la clave correcta devuelve los mismos bytes. Payload de staging
   alterado falla la autenticación y nunca se publica READY.
7. Replay exacto de cambios tras reiniciar; cambio de época de cualquiera de
   los dos propietarios exige corte nuevo (410), no reiniciar correlativos.
8. Carga acotada: 24 documentos, hasta dos lectores concurrentes, claves
   fiscales únicas y fuentes sin cambios. No es dimensionamiento ni SLA.
9. Revocación/expiración del token, RUC ajeno, producción, certificado ajeno,
   acceso a owners/ADMIN y mutaciones de ventas denegados.
10. Auditoría caída u owner detenido devuelven error sin originales; al
    recuperarse vuelve la lectura, sin sustituciones o bypass.

### Semántica de captura y reintentos

El worker sólo empaqueta hechos y originales **ya capturados/verificados y
cifrados**. No recibe un bearer ni vuelve a abrir una sesión del propietario.
Un original corrupto antes de capturar bloquea el trabajo; una corrupción
posterior no cambia los bytes válidos congelados del corte. La descarga directa
actual sí detecta esa corrupción y la rechaza. El ensayo distingue ambos casos.
Mantener SHA correcto no acredita firma, PKI o aceptación por SUNAT: las muestras
se identifican como SYNTHETIC y esos estados permanecen UNVERIFIED/NOT_CHECKED.

Un reinicio puede cortar un keep-alive y producir 503 retryable. El consumidor
reintenta explícitamente con **la misma** Idempotency-Key o checkpoint; nunca
un retry automático de Kong para POST, una clave nueva indiscriminada o un
checkpoint avanzado tras un fallo. El ensayo permite una interrupción de
transporte y exige éxito al reintento, no acepta errores permanentes como PASS.

La recuperación comprobada conserva los repositorios ficticios en memoria
durante el reinicio de la app exportadora. No es respaldo/restauración de BD
ni recuperación después de reiniciar Windows. Las pruebas PostgreSQL de
fases 3–6 son evidencia separada, no un piloto real de esta fase.

## Verificación reproducible

En D:\Facturacion\FactuEz, para TI/desarrollo:

    pnpm check:integration-windows
    pnpm test:integration-pilot

Evidencia de este incremento: **66 pruebas nuevas / dos suites PASS**.
El diagnóstico ejecutado en esta estación de desarrollo identificó Windows 11
build 26200 x64, WSL 2.5.7.0 y motor Linux Docker 29.4.0; requisitos iniciales
PASS con piloto pendiente. No representa el servidor del cliente ni incluye
lectura de su información comercial.

Regresión general: **5 109 pruebas PASS / 128 suites**, una omisión XSD
condicional preexistente, ninguna omisión nueva. Tipos estrictos del laboratorio,
sintaxis del diagnóstico y siete checks de inventario de fuentes PASS. Los
14 servicios QA estaban saludables al terminar ese primer ensayo, sin reiniciar o recrear. No se habían cambiado
los gates oficiales, puertos de la intranet, imágenes desplegadas o SQL.

## Gate real y próximos incrementos de fase 8

| Bloque | Estado / responsable |
|---|---|
| Requisitos Windows medibles y laboratorio de lectura | Preparados y comprobados aquí; repetir en el host autorizado de TI |
| Perfil privado Desktop, aislamiento e IP real | Loopback Windows–Kong comprobado aquí tras ajuste autorizado (15 checks PASS); sin activación remota; destino/VPN/IP real pendientes |
| Instalación, inicio después de reinicio y mantenimiento sencillo | Pendientes; no se promete servicio automático de Docker Desktop sin comprobarlo |
| VPN, DNS privado, firewall, TLS/CRL, clientes/grants | Definición/aprobación de TI y ensayo positivo/negativo; claves fuera del chat |
| Datos/copia y conciliación por RUC/moneda/tipo/serie | Alcance autorizado y revisión de TI/Contabilidad, no lectura automática del QA |
| SQL/roles/triggers y recuperación de BD/archivos/claves | Ensayo técnico en dos BD nuevas PASS; diarios/roles empresariales completos y copia autorizada pendientes |
| Retención, carga, caída de Windows/Docker y operación | Ensayo en destino, incidencias y aceptación de responsables |
| GR 09 / GT 31 y representaciones no expuestas | Fuentes empresariales/PDF pendientes; capacidades siguen UNSUPPORTED |

Antes del piloto real: acordar RUC, periodo, host, filas máximas, rutas de
archivos, destino separado, usuario lector, permisos, tratamiento/retención,
responsables y recuperación. No se toma una autorización antigua de muestras
como permiso para conectar un ERP o leer todo el historial.

Ante fallo: revocar cliente/peer y detener sólo la entrada de integración
autorizada; no parar emisión/intranet, borrar originales o regenerar contadores.
Un restore que cambia la época invalida checkpoints y requiere corte nuevo.

**Fase 8 continúa abierta.** No se activó VPN/API remota, no se instaló un
paquete en el cliente y no se enviaron comprobantes, OAuth SUNAT/SIRE o correos.
Tampoco se aprobó conciliación/corte de las fases fiscales históricas.

## Incremento Windows y recuperación aislada — 10/10/2026

Se añadieron renderer estricto, relay TCP opaco nativo, comprobación/planes de
operación y respaldo cifrado sólo SYNTHETIC. 72 pruebas nuevas (52 Windows y
20 del sobre de respaldo); tipos estrictos y 242 pruebas relacionadas PASS.
32 checks de dump/restauración en dos bases PostgreSQL nuevas/ficticias PASS.
El ensayo inicial Desktop no pasó: Windows rechazó loopback al Kong nuevo y éste no
llegó al owner nativo; se conservó el bloqueo y se limpiaron sólo los recursos
de test. No se cambiaron ajustes de Docker/WSL/Windows. No confundir este ensayo
de BD técnica con restauración completa de diarios, credenciales o historia real.
Al terminar ese incremento inicial los 14 servicios QA seguían healthy, sin
reiniciar; hubo un reinicio autorizado posterior descrito abajo. Los próximos pasos y
límites están en [operación Windows](INTEGRACION_PRIVADA_WINDOWS_OPERACION.md).
Regresión final de este incremento: 5 181 PASS / 130 suites y una omisión XSD
condicional preexistente; siete checks de fuentes PASS. Ese E2E inicial fallido
se informa por separado, no como prueba aprobada u omisión de la regresión.

### Corrección posterior autorizada de la red Desktop — 10/10/2026

Se confirmó la opción de host networking desactivada mediante el contrato local
de la propia versión instalada y se habilitó únicamente esa opción, con permiso
expreso del usuario. Desktop se reinició automáticamente; los contenedores QA
previamente activos se recuperaron sin recreación ni migraciones. Los mismos
14 quedaron healthy; acceso `/login` HTTP 200 por localhost y 127.0.0.1.

El E2E aislado posterior se repitió dos veces con **15 checks PASS por ejecución**: conectividad bidireccional,
relay opaco, rutas bloqueadas, certificados ausentes/revocados y nombre TLS
incorrecto del owner rechazados. Limpieza de recursos ficticios PASS. No se
cambiaron firewall, VPN, TLS/CRL, credenciales o gates fiscales ni se conectó a
SUNAT/SIRE. No es un piloto remoto, reinicio de Windows o aceptación del cliente.
La conectividad local queda verificada; el resto del gate permanece pendiente.
Se repitieron también tipos estrictos, 242 pruebas relacionadas y siete checks
de fuentes, todos PASS; no se suman los E2E a la cifra de regresión anterior.
