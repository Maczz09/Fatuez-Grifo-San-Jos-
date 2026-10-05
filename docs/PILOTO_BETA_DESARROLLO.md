# Desarrollo y preparación del piloto Beta

Actualizado: 02/10/2026. Alcance confirmado: **RUC 20615878481, sólo BETA**.
No se habilita producción ni se cambia la configuración de otros emisores.

Actualización 03/10/2026: se ejecutó un nuevo piloto acotado `FQ02-1`, autorizado
en la continuación de desarrollo, sin reutilizar `FQ01-1` ni correlativos Billing.
Certificado real con cadena/identidad/CRL comprobadas y XSD correcto. **Un POST
Beta, HTTP 200, código 0, sin observaciones**. CDR sin firma verificable:
**`CDR_UNVERIFIED`**, no aceptación fiscal. Estado antes/después sin cambios;
producción y envío automático continúan bloqueados. Evidencia y alcance en
[incremento Beta](ETAPA2_INCREMENTO_BETA.md). El presupuesto de este nuevo piloto
también está consumido: no autoriza otro envío ni un reintento.

**Resultado anterior:** piloto autorizado por el usuario realizado el
02/10/2026, una factura 01 `FQ01-1` de S/1.18. SUNAT **BETA** devolvió CDR con
código `0` y una observación `4252` en `cbc:InvoiceTypeCode/@listName`:
`ACCEPTED_WITH_OBSERVATIONS`. Hubo **un solo POST**, sin reenvío ni producción.
No equivale a comprobante fiscal válido ni a cierre de la etapa fiscal.

Las secciones siguientes de preparación describen las comprobaciones previas;
el uso posterior autorizado del certificado se detalla al final.

## Guardado detectado

La comprobación consultó únicamente metadatos del RUC confirmado y BETA:

- Emisor registrado en Billing, ambiente BETA.
- Credenciales SUNAT: revisión 1, actualizadas el `2026-10-02T20:27:50.110Z`.
- Certificado y contraseña presentes; SOL presente; GRE ausente.
- Vencimiento registrado: `2029-10-01T20:00:08Z`; no autofirmado.

En esa comprobación inicial no se consultaron valores cifrados, P12/PFX,
contraseñas ni tokens. Estos
metadatos **no acreditan** confianza de la cadena, identidad del certificado,
registro en SUNAT o autenticación SOL. No se usó la clave real para firmar.
La razón social, dirección y ubigeo no fueron inventados ni modificados.

## Refuerzo implementado y comprobado

El adaptador SOAP mantiene destinos fijos y rechaza cualquier ambiente distinto
de BETA o LOCAL_QA. BETA exige RUC estructuralmente válido y exclusivamente
el usuario público `MODDATOS`; el WSSE antepone el RUC al usuario. Para contraseña
sólo admite `MODDATOS` (apartado 2.3) o `moddatos` (ejemplos WSSE del mismo manual),
sin reintento automático entre variantes. Las claves SOL privadas guardadas no
se leen para estas pruebas.
Referencia: [Manual del programador SUNAT, sección 2.3](https://cpe.sunat.gob.pe/sites/default/files/inline-files/manual_programador%20%281%29.pdf).

La configuración se copia y congela: mutar el objeto del llamador no cambia
destino, RUC o autenticación. El permiso de transporte se comprueba de nuevo
antes de cada POST; revocarlo bloquea instancias ya construidas. No se siguen
redirecciones ni se reintenta un POST de resultado incierto automáticamente.

Pruebas nuevas:

- `tests/beta-pilot.spec.ts`: ambientes, autenticación pública, RUC, aislamiento
  del emulador, configuración inmutable y revocación de transporte.
- `tests/fiscal-readiness.spec.ts`: contexto RUC/BETA, revisión concurrente,
  borrado de buffers ficticios, errores redactados, huella/identidad/CRL y
  bloqueo de activación incluso cuando la confianza simulada pasa.

Se ejecutaron **269 pruebas en 20 suites**, todas aprobadas. TypeScript:
**15 tareas exitosas**, correspondientes a los once paquetes del monorepo.
Todas las nuevas llamadas HTTP fueron interceptadas con `fetch` simulado;
certificados y secretos de esos tests son dobles de prueba, no material real.
GRE pendiente no añade un bloqueo al desarrollo de 01/03/07/08.

## Qué sigue siendo local

El runtime `factuez-stage2-qa` conserva su red interna y el flag
`SUNAT_BETA_TRANSMISSION_ENABLED=false`; su ambiente fiscal es BETA.
Se conserva Kong y el acceso intranet de `docs/INTRANET_QA.md`.
No se iniciaron migradores ni se consumieron/reiniciaron correlativos reales.
No se ejecutaron E2E que creen o inspeccionen otros emisores en este seguimiento.

Se reconstruyó la imagen SUNAT y se actualizaron sólo `sunat-service` y
`sunat-emulator` con los tres overlays y `--no-deps --no-build --pull never`.
Comprobación posterior: once servicios saludables; login local e intranet y
salud SUNAT HTTP 200 desde el servidor; red interna `true`; adaptador compilado
con producción y transporte Beta externo bloqueados. La revisión 1 del RUC
confirmado y sus metadatos permanecen intactos. No se probó otra PC.

El seguimiento automático del guardado se detuvo al terminar esta continuación
local, según su condición de cierre; no continuará consultando credenciales.

Hasta esa continuación local no hubo solicitud SOAP/REST a SUNAT, OAuth GRE,
correo real ni baja oficial.
Las pruebas de transporte siguen siendo simuladas. Tampoco se habilitó el
despacho oficial por rutas de la aplicación: el guard de activación permanece
cerrado. Guardar un certificado no lo abre.

## Piloto externo autorizado y realizado

El usuario autorizó verificar localmente su certificado y usarlo en una única
factura 01 a SUNAT Beta, sin modificar ventas/correlativos y prohibiendo producción.

La lectura se limitó a las columnas requeridas de `SunatCredentials` con
`WHERE issuerRuc='20615878481' AND environment='BETA'`, en transacción read-only.
PFX y contraseña se descifraron dentro de un proceso temporal del contenedor;
los buffers se limpiaron al finalizar. No se exportaron claves ni archivos PFX,
no se leyeron SOL privadas/GRE ni se imprimieron secretos.

La pareja RSA de firma, vigencia, uso digitalSignature y huella guardada pasaron.
Se corrigió el lector para reconocer **NTRPE- + RUC exacto** exclusivamente en
`organizationIdentifier` (OID 2.5.4.97); nunca por CN ni substring.
La estructura del identificador está descrita en
[ETSI EN 319 412-1, §5.1.4 (borrador oficial V1.6.0)](https://www.etsi.org/deliver/etsi_EN/319400_319499/31941201/01.06.00_20/en_31941201v010600a.pdf).
No hay evidencia offline suficiente de raíces fijadas/cadena y CRL: confianza
y revocación siguen pendientes; no se convirtieron en un booleano «confiable».

Se creó un fixture fuera de Billing: `FQ01-1`, PEN 1.18 (base 1.00, IGV 0.18),
emisor/destinatario con el mismo RUC, razón social/dirección/ubigeo leídos de
lo guardado por el usuario. Descripción: prueba técnica, sin operación comercial.
`0000` representa la matriz únicamente en este fixture técnico. No se inventaron
datos fiscales de la empresa ni se registró una venta, serie o contador nuevo.

La firma XMLDSig se verificó contra el certificado externo y el XML previo;
Invoice 2.1 pasó el XSD versionado existente. ZIP con sólo ese XML, hashes de
los bytes enviados conservados. El generador del fixture no es el emisor de ventas.

Runner externo en el host: endpoint HTTPS Beta fijo, TLS verificado, sin
redirecciones, timeout/límites y credenciales públicas MODDATOS. No tuvo acceso
a DB, Redis, PFX ni SOL. Su permiso de transporte existió sólo en ese proceso:
**QA conserva la red interna y `SUNAT_BETA_TRANSMISSION_ENABLED=false`**.
La ruta de activación oficial de la aplicación permanece bloqueada.

HTTP 200, un ZIP CDR recibido. La primera lectura se detuvo por `dummy/`,
carpeta vacía incluida en el ZIP. Se corrigió el parser: sólo permite ese nombre
vacío opcional y exactamente un XML con nombre/RUC/referencia esperados;
rechaza rutas, otros archivos/directorios, duplicados y límites excedidos.
Se revisó **offline el ZIP original**, sin otro POST. No se eliminó el marcador
`submission.lock`, que bloquea reenvíos accidentales.

Resultado: código **0**, `ACCEPTED_WITH_OBSERVATIONS`, observación **4252**:
el atributo `InvoiceTypeCode/listName` del fixture no corresponde al esperado.
Se conserva la observación; no se cambió el XML firmado para ocultarla ni se
afirma una aceptación sin observaciones. Corregirla y repetir otro piloto requiere
nuevo alcance/autorización; el emisor general no añade ese atributo del fixture.
CDR: estructura y vínculo verificados; confianza criptográfica de su firma no
verificada. Referencia del servicio:
[Manual SUNAT, §2.3: Beta prueba estructuras, no exige certificado registrado](https://cpe.sunat.gob.pe/sites/default/files/inline-files/manual_programador%20%281%29.pdf).

Evidencia privada/local ignorada por Git:
`tmp/beta-pilot/20615878481-20261002/`: XML firmado, ZIP enviado,
`preparation.json`, `request.json`, `submission.lock`, ZIP/XML de CDR Beta,
`result.json` de la detención inicial, `review.json` de la revisión offline,
`state-after.json` de integridad. El resultado final del piloto está en `review.json`.
Comparación read-only antes/después: documentos, contadores y revisión/configuración
del RUC autorizado sin cambios. No se consultaron configuraciones de otros RUC.

Verificación final: **296 pruebas en 22 suites**, 15 tareas TypeScript aprobadas.
Las nuevas pruebas son ficticias: formatos NTRPE estrictos y la carpeta vacía
del CDR; no replican ni guardan la clave del usuario en el código.
Las notas/resúmenes ampliados, GRE y cobertura fiscal completa mantienen los
pendientes de `ETAPA2_PREPARACION_LOCAL.md`. No se habilitó emisión de producción.

Después del piloto se aplicó el lector CDR corregido sólo a SUNAT QA, con los
tres overlays y `--no-deps --no-build --pull never`. Once servicios saludables;
login localhost/LAN y salud SUNAT HTTP 200 desde el servidor. Red interna `true`,
transporte Beta externo `false`, guard real de activación oficial bloqueado.
La web/Identity actualizadas pasaron otra vez el E2E de sesión aislada.
