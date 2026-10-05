# Etapa 2: incremento de desarrollo Beta — 03/10/2026

Este registro complementa, no elimina, el historial de
[revisión y gate](ETAPA2_REVISION_Y_GATE.md).

## Alcance y decisión

Sólo desarrollo y QA. RUC del piloto: **20615878481**, BETA. No se habilita
producción, ni se toca la configuración de otros emisores. Se preservan
microservicios, Kong, red QA interna, ventas y correlativos existentes.

**El incremento de código no equivale a cierre fiscal oficial de etapa 2.**
El guard de activación sigue cerrado deliberadamente. No se inicia etapa 3 ni
se importan históricos, ejecutan migraciones o habilitan envíos automáticos.

## Implementación incorporada

| Área | Implementación | Límite relevante |
|---|---|---|
| Notas 07/08 | Snapshots Beta, referencia y aceptación verificables, historial de crédito, generación XML y transporte `sendBill` para series F | Motivos soportados explícitos; las notas B sólo van en RC; no habilita emisión desde caja |
| Resúmenes y bajas | Construcción RC de alta/modificación/baja y RA, paquetes firmados, `sendSummary`, ticket y lectura de CDR | La proyección por miembro/versión y el circuito público integrado requieren completar su wiring |
| Persistencia de transporte | Reserva serializable por RUC/BETA, idempotencia, claims, leases, intentos acotados y artefactos inmutables | Las pruebas de repositorio son con dobles transaccionales, no E2E PostgreSQL |
| Evidencia RC | Comprobación del miembro, versión, XML enviado, ZIP/CDR, hashes, fecha y firma mediante verificador confiable; cerco transaccional contra versiones posteriores | Una bandera del cliente o código CDR 0 no sustituyen la confianza criptográfica |
| Boleta 03 normal | RC inicial con snapshot completo de lote, vínculo del envío, archivo separado y fechas de aceptación coherentes | RC legado sin esa evidencia se detiene para conciliación; no se reescribe ni reenvía |
| Reglas de venta | Aritmética decimal exacta, gravado 10/exonerado 20/inafecto 30, PEN/USD y descuentos explícitos; anticipos como cálculo y detracción informativa | No es cobertura fiscal completa; anticipos/SPOT/ISC y otros perfiles no quedan habilitados por una previsualización |
| Laboratorio fiscal | Página `/fiscal-lab`, componentes shadcn y endpoint protegido `/api/v1/fiscal-rules/preview` | Sólo cálculo, sin documentos, firmas, reservas o transmisión |
| Frontera web/servidor | Importación del validador de pagos desde una entrada segura para navegador | La criptografía Node permanece exclusivamente en servidor |

Motivos de este perfil de notas: NC 01/06, 07, 05/09 y ND 02/01 moratorio.
Las notas sobre originales a crédito/cuotas, los perfiles mixtos no definidos y
los motivos restantes se rechazan expresamente. Las notas de mora requieren
sustento e importe explícitos; no se inventan tasas, días o reglas del negocio.

No se libera saldo por un crédito rechazado sin su estado persistido, ni se
aumenta la capacidad de devolución usando notas de débito. Un resultado de
POST desconocido queda detenido: no se vuelve a transmitir automáticamente.

## Comprobaciones de código

- Regresión final: **1.114 PASS en 40 suites, sin omisiones**. Se corrigió la
  variable local del validador Python/lxml y se repitió la suite completa.
- TypeScript: **15 tareas PASS** en once paquetes.
- Auditoría criptográfica independiente: **9 casos PASS**, XMLDSig y XSD sobre
  certificados ficticios generados en memoria; sin claves reales, BD o red.
- Repositorio de suplementos: 93 casos nuevos, incluidos rollback, claims,
  versiones RC, inmutabilidad y límites. No acredita comportamiento de
  concurrencia de PostgreSQL real ni aceptación SUNAT.
- Build local del servicio SUNAT y build Docker de la PWA: PASS.

## Piloto técnico separado

Existe preparación específica para una única factura técnica `FQ02-1`, PEN
1.18, sin operación comercial. Los scripts se niegan a reutilizar una reserva
o un POST ya consumido. Se conserva intacto el piloto anterior `FQ01-1`.

La firma real sólo se permite dentro del QA con el alcance acordado. Del
contenedor salen exclusivamente XML/ZIP y evidencia pública, nunca P12/PFX,
contraseñas o claves. El transporte tiene presupuesto de **un solo POST Beta**,
TLS verificado, sin redirecciones, sin reenvío y sin credenciales SOL privadas.
La comparación SQL antes/después es read-only y está filtrada por RUC/BETA.

Resultado ejecutado el 03/10/2026:

- Certificado guardado: cadena, identidad del RUC y revocación offline comprobadas
  con archivos públicos fijados por hash y CRL vigente. Pins exclusivamente del
  proceso piloto; no se altera la política de confianza del runtime.
- XML firmado con el certificado real y validado por XSD; se volvió a verificar
  el paquete archivado offline antes de transmitirlo.
- **Un POST a SUNAT Beta**, HTTP 200, código de respuesta **0**, **cero
  observaciones**. Corrige en este XML nuevo la observación `4252` del piloto
  anterior; éste permanece intacto y nunca se reenvió.
- Estado final **`CDR_UNVERIFIED`**, no aceptación fiscal. El CDR recibido contiene
  una firma de 21 bytes y no acredita un certificado X.509 verificable. La
  inspección offline no verificó matemáticamente esa firma ni derivó confianza
  del `KeyInfo` recibido. No se instala como pin un certificado de la respuesta.
- Antes/después: documentos Billing y SUNAT **0/0** para este RUC/BETA,
  hash de correlativos y revisión/configuración iguales. **Cero escrituras
  fiscales, cero solicitudes de producción y cero reenvíos**.
- El presupuesto queda consumido y el `submission.lock` permanente impide
  transmitir otra vez. No ejecutar PREPARE/SEND para repetir esta prueba.

Evidencia pública local: `tmp/beta-integrated-pilot/20615878481-20261002-FQ02-1/`.
Incluye XML/ZIP, preparación, journal de fases, petición, CDR y comparación de
estado. No incluye claves privadas, P12/PFX, contraseñas SOL o certificado secreto.

## Despliegue y comprobación del QA

Se construyeron las imágenes SUNAT y PWA y se actualizaron únicamente esos dos
servicios del proyecto `factuez-stage2-qa`, con los tres overlays y
`--no-deps --no-build --pull never`. Kong se recargó para publicar el laboratorio;
se corrigió además `/sunat-health` para apuntar al endpoint `/health`, no a `/`.
No se ejecutaron migradores ni se reiniciaron PostgreSQL o Redis.

El laboratorio se comprobó vía Kong con el administrador demo: sin sesión 401,
sesión demo correcta, cálculo autenticado exacto 90.00 + 16.20 = 106.20 con
`private, no-store`, y rechazo 400 al solicitar ambiente PRODUCTION. Esa prueba
genera la sesión normal de Identity, pero no consulta configuraciones de
emisores, firma documentos ni produce cambios fiscales.

Comprobación final desde el servidor: login localhost/LAN y `/sunat-health`
HTTP 200; once contenedores saludables; red Docker QA `internal=true`.
`SUNAT_ENVIRONMENT=BETA`, transmisión y workflow oficiales `false`; el guard
compilado `assertOfficialFiscalActivation()` rechaza la activación.
Acceso: [FactuEz QA](http://localhost:8091/login) y
[laboratorio fiscal](http://localhost:8091/fiscal-lab), con sesión de administrador.

Comandos de comprobación (no retransmiten el piloto):

```powershell
$env:FACTUEZ_FISCAL_XSD_PYTHON='C:\Users\maxmo\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
pnpm exec vitest run --maxWorkers=2
pnpm typecheck
node tests/beta-fiscal-package.crypto.audit.cjs --local-fixtures
node tests/fiscal-lab.runtime.audit.mjs --existing-qa-only
node tests/beta-integrated-pilot.cdr-review.cjs --offline-only
```

La evidencia temporal del piloto y la PKI pública se excluyen expresamente de Git
y del contexto de build Docker. Los scripts de envío no forman parte de los
comandos de regresión ni se ejecutan por un worker periódico.

## Qué sigue siendo un bloqueo real de cierre fiscal

1. Confianza e identidad del firmante de CDR oficiales, no sólo su estructura
   o respuesta 0. Un CDR no acreditado termina en `CDR_UNVERIFIED`.
2. Productores/proyecciones de notas y lotes integrados con Billing/PWA,
   conciliación de miembros/versiones y evidencia persistida de no entrega en
   bajas. El evento de suplemento es de evidencia: no cambia todos los miembros
   a aceptados/anulados por recibir un CDR global.
3. Cobertura e integración de los perfiles fiscales adicionales: el laboratorio
   no habilita una operación fiscal que el flujo de emisión todavía rechaza.
4. Ensayos operativos posteriores de impresión física, TLS/PWA intranet,
   restauración y corte histórico. GRE de combustible y entrega SMTP real
   permanecen fuera de lo acreditado por este QA.

No hacen falta nuevas claves del cliente para continuar el código local. Estos
pendientes no se resuelven encendiendo flags ni declarando todos los tests verdes
como homologación. El [servicio Beta de SUNAT](https://cpe.sunat.gob.pe/noticias/servicio-beta-para-realizar-pruebas-ubl-21)
sirve para pruebas de estructura XML; no acredita todas las reglas de negocio
ni autorización de emisión en producción.
