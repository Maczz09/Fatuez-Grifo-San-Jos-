# Etapa 2: alcance de los perfiles y auditoría del paquete Beta

Esta auditoría verifica preparación local, firma XMLDSig y estructura XSD de
fixtures. No acredita identidad, autorización del emisor, validez fiscal,
aceptación SUNAT ni cobertura completa de reglas de negocio. Un resultado
correcto permite revisar este circuito técnico; no autoriza transmisión.

## Límite de ejecución

El único punto de entrada es:

```powershell
node tests/beta-fiscal-package.crypto.audit.cjs --local-fixtures
```

El script rechaza la ausencia del flag, flags adicionales y parámetros
de certificados, contraseñas, endpoints o datos externos antes de cargar el
pipeline. No usa Docker, bases de datos, migraciones, SMTP ni red. No carga
archivos de secretos ni configuración de producción. No modifica código
existente, no guarda claves, PKCS#12 ni XML y emite su evidencia por stdout.

El certificado de firma y su CA de prueba se generan en memoria. El leaf
tiene uso `digitalSignature` y el atributo de sujeto OID `2.5.4.97` con valor
`NTRPE-20615878481`; está firmado por la CA fixture, no por sí mismo. La CA sólo
existe para ejercitar el rechazo de certificados autofirmados del perfil Beta:
esta cadena privada de prueba no representa una CA reconocida. El RUC
`20615878481` es un dato de prueba con estructura válida, suministrado para
esta auditoría. No se consulta su registro ni se atribuye identidad o
titularidad a ese número. Nombres, clientes, referencias y aceptación del
original son fixtures, no documentos ni CDR reales.

## Frontera de integración

Los casos de notas F y lotes llaman a la preparación pura:

```ts
prepareBetaFiscalPackage(envelope, bytes, password)
// { xml, zip, fileName: string /* con .zip */,
//   reference, rootName, signed, method: 'sendBill' | 'sendSummary' }

type Envelope =
  | { kind: 'NOTE'; note: FiscalNoteSnapshot; context: FiscalNoteContext }
  | { kind: 'BATCH'; batch: FiscalBatchSnapshot; asOf: string };
```

Ubicación:
`services/sunat-service/src/infrastructure/crypto/beta-fiscal-package-pipeline.ts`.
Los snapshots y sus XML se construyen con los nuevos módulos puros
`packages/sunat-core/src/fiscal-note.ts` y `fiscal-batch.ts`, conforme a sus
firmas publicadas:

```ts
buildFiscalNoteSnapshot(context, input, identity)
validateFiscalNoteSnapshot(note, context)
buildFiscalNoteUbl(note, context)
buildFiscalBatchSnapshot(input, identity, asOf)
validateFiscalBatchSnapshot(batch, asOf)
buildFiscalBatchUbl(batch, asOf)
```

`FiscalNoteContext` contiene `original`, `acceptance`, `asOf` y
`creditHistory: { complete: true, entries }`. Las evidencias de aceptación
ligan el hash canónico del snapshot, emisor, tipo, número y fecha; el fixture
incluye un hash de CDR ficticio, sin bytes de un CDR verificado. Una marca
`complete: true` no prueba integridad del historial ni reserva atómica.

El nuevo validador puro
`services/sunat-service/src/infrastructure/sunat/beta-package-validator.ts`
recibe `validateBetaPackage(pkg, ruc, method)`, donde `pkg` contiene
`documentId`, `fileName` con extensión `.zip`, `zip` y `sha256`, y `method`
es `sendBill` o `sendSummary`. Se invoca esta función localmente, sin abrir un
adaptador de transporte ni hacer POST. No se adapta el perfil QA cambiando el RUC ni se rebajan
los controles Beta. La evidencia de aceptación utilizada por los builders
es expresamente ficticia; sólo prueba el contrato y los rechazos locales.

## Matriz técnica ejercitada

| Fixture | Comprobación local |
| --- | --- |
| 07-01 con original 01 / serie F | CreditNote, referencia al original y ZIP exacto |
| 08-02 con original 01 / serie F | DebitNote, referencia al original y ZIP exacto |
| 08-01 con original 01 / serie F | DebitNote, rama de importe de mora declarado por fixture |
| 07-07 con original 03 / serie B | UBL individual firmado/XSD e inclusión en RC con BillingReference 03 |
| 08 con original 03 / serie B | UBL individual firmado/XSD e inclusión en RC; muestras 01 y 02 |
| RC múltiple | Seis líneas: boleta alta/modificación/baja y tres notas B; firma SummaryDocuments y ZIP exacto |
| RA múltiple | Tres líneas: factura 01 y notas F 07/08, con evidencia fixture NOT_DELIVERED |
| Invoice 01 / serie F | Builder existente, firma fixture, XSD y validador puro sendBill |

Las notas B se empaquetan en `BATCH/RC`. El pipeline debe rechazar su uso en
un envelope `NOTE` destinado al circuito de envío de documento, con el
mensaje «Notas B requieren lote RC explícito», incluso cuando se entrega un
Buffer de clave vacío. El UBL B individual se firma con el firmador puro y
se valida por XSD como prueba separada de builder/crypto; el validador rechaza
ese paquete tanto para `sendBill` como para `sendSummary`. Su paquete de
envío permitido en esta prueba corresponde al RC. Los tres documentos F se preparan por
`NOTE/context`, con rutas locales esperadas `sendBill`; RC/RA se inspeccionan
como `sendSummary`.

La factura 01 adicional se prepara con `buildInvoiceUbl` y el firmador puro
existentes; no se inventa un envelope Invoice para el pipeline de notas y
lotes. El informe identifica estos cuatro casos auxiliares como
`BUILDER_FIXTURE_SIGNER_ONLY` y los cinco casos del pipeline como
`BETA_FISCAL_PIPELINE`.

La matriz no implica soporte de todos los motivos de nota, impuestos,
monedas, modalidades de pago, plazos, catálogos o estados posibles. Cada
caso debe informar su resultado efectivo. No se declara XSD ni firma
verificados cuando falta un módulo o una dependencia local.

## Evidencia de ejecución

- Firma verificada contra el certificado fixture externo, con una sola
  referencia autenticada a la raíz completa y algoritmos del perfil local.
- XML autenticado equivalente al XML producido por el builder puro;
  huella del certificado y digest coherentes con el resultado del pipeline.
- ZIP con una sola entrada XML, nombre esperado y bytes iguales al XML
  firmado, sin rutas adicionales.
- XSD de las cuatro raíces de notas/lotes y de Invoice contra el ZIP local fijado, con imports resueltos
  sólo desde sus schemas en memoria y sin recuperación por red.
- Rechazo de XML alterado, certificado ajeno, estructura XML peligrosa y
  XML estructuralmente incompleto; controles de entrada en el pipeline.
- Validador del paquete: rechazo de método opuesto, hash ZIP incorrecto,
  RUC distinto, ZIP con más de una entrada y contenido firmado alterado
  aun recalculando el hash del ZIP. Pipeline: certificado autofirmado,
  certificado de otro RUC, certificado vencido, ausencia de digitalSignature,
  contraseña incorrecta, envelope desconocido, nota B fuera de RC antes
  de la clave y ambiente PRODUCTION.

Un hash del XML o del ZIP identifica los bytes de esa ejecución. Las claves
aleatorias hacen que esos hashes cambien entre ejecuciones; no son valores
de referencia estables. Borrar un Buffer no garantiza borrado de todas las
copias en el heap de JavaScript; el proceso termina tras la auditoría.
El informe incluye `sourceSha256` de las fuentes efectivamente leídas y
transpiladas, para vincular el resultado a esa revisión del código. No
confundir esas huellas con las de los XML generados.

El script transpila las fuentes TypeScript en memoria y usa las dependencias
ya instaladas (`typescript`, `node-forge`, `xml-crypto`, `@xmldom/xmldom`,
`fflate` y dependencias del firmador). No escribe `dist` ni instala paquetes.
Esta ejecución no constituye un typecheck ni valida exports/empaquetado de
una compilación de producción. El resolver limita las fuentes a módulos
puros de core/contratos, crypto y helpers XML del validador; bloquea carga de
transportes, persistencia, procesos adicionales y acceso a red vía fetch.

La validación XSD usa Python con `lxml/libxml2` por stdin, en modo aislado,
sin shell y con timeout de 30 segundos. En este equipo utiliza el Python
incluido en el runtime de Codex; en otro equipo requiere un Python local con
`lxml` disponible. No se inicia el validador de servicio que extrae schemas
a disco ni se escribe ningún archivo temporal. El ZIP XSD y los XML viajan
por stdin y los imports se resuelven desde un mapa de schemas en memoria.

## XSD y fuentes

Se reutiliza el archivo local
`services/sunat-service/assets/sunat/xsd-20220228.zip`, cuyo SHA-256 fijado es
`5cac9d9353521340fbc15d23f465a4946b004535b9ff411541c87da01694dbd5`.
La procedencia registrada en `xsd-version.json` es el
[paquete XSD publicado por SUNAT](https://cpe.sunat.gob.pe/sites/default/files/inline-files/Archivos%20XSD%20%281%29.zip).
El script no descarga ni actualiza ese paquete. Se verifican schemas de
CreditNote/DebitNote 2.1 y SummaryDocuments/VoidedDocuments del paquete 2.0.
El caso de factura adicional utiliza Invoice 2.1 del mismo ZIP.
El nombre del directorio del paquete no acredita por sí solo una norma.

Este documento describe límites de pruebas e implementación, no establece
normas tributarias. Si el cierre incorpora una afirmación normativa, deberá
vincularla a una fuente primaria SUNAT y a su versión; el XSD no sustituye
esa revisión.

## Estado del cierre

Ejecución local del 2026-10-02 (Lima): `PASS`, exit code 0, nueve casos con
firma verificada y XSD correcto. Cinco pasan por `prepareBetaFiscalPackage`;
los cuatro auxiliares son tres UBL individuales de notas B y una factura 01.
Seis paquetes pasan por `validateBetaPackage` con su método esperado; los
tres paquetes B individuales se rechazan en ambos métodos por diseño.
También pasan los ocho grupos de rechazos del pipeline descritos arriba,
los negativos de firma/ZIP/ruta por caso y los negativos XSD/imports.

La guarda se verificó sin flag, con parámetro de certificado adicional y
con flag duplicado: exit code 2 y stdout vacío en los tres casos.
`node --check` confirma sintaxis del script. La ejecución no usó Docker, clave
real, base de datos, migraciones, SMTP, red ni transmisión fiscal y no guardó
material criptográfico. No se alteraron archivos existentes por esta tarea.

La auditoría no debe marcar como aprobada una prueba omitida ni declarar
«todas las reglas completas». Si falta el pipeline, los casos auxiliares
pueden ejecutarse, pero el informe es `INCOMPLETE`, enumera `pendingCases`
y termina con exit code 1. Cualquier fallo restante produce `FAIL` y exit
code 1. Sólo la ejecución completa puede producir `PASS`.

Permanecen fuera del alcance la confianza PKI/CRL/OCSP,
habilitación del RUC, idempotencia persistente, concurrencia, correlativos
en base de datos, transporte SOAP/REST, CDR/tickets, entrega al cliente,
SMTP, efectos contables y producción.
