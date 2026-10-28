# Fases 2/3 — diagnóstico offline de guías y CDR

Incremento del 06/10/2026. Desarrollo local/BETA; no habilitación fiscal.
Ampliación del 07/10 a factura/boleta/NC/ND y responsabilidades acordadas:
[implementación técnica y entrega](ETAPA2_3_CIERRE_TECNICO_Y_ENTREGA.md).
BETA describe el contexto del diagnóstico: no acredita ni reetiqueta el
ambiente original de los documentos recibidos.

## Código disponible

- `packages/evidence-core/src/offline-review.ts`: módulo puro y separado del
  índice SYNTHETIC. No importa BD, servicios, colas, SMTP o adaptadores SUNAT.
- `migration/offline-guide-review-cli.cjs`: lectura explícita de dos XML y
  emisión de un informe JSON de metadatos. No escanea directorios, extrae ZIP,
  accede a certificados privados ni escribe archivos originales.
- `tests/offline-guide-review.spec.ts`: pruebas exclusivamente ficticias,
  con claves efímeras y certificados públicos generados localmente.

### Diagnóstico de fase 2

Contrato `factuez.offline-guide-evidence.v1` para guías 09/31 UBL 2.1:
cabecera, emisor, destinatarios presentes, ítems, peso, indicadores, etapas,
registro MTC, conductores/licencias, vehículos, origen/destino y remitente.
Los datos personales de la proyección permanecen en memoria; la CLI no los
imprime. **Proyección diagnóstica parcial**, no snapshot íntegro importable:
falta el binding del origen, propiedad sede/punto/serie y los perfiles completos.

Contrato `factuez.offline-cdr-evidence.v1`: distingue el resultado **reportado**
por el texto del CDR de integridad matemática y autoridad fiscal. Vincula RUC
destinatario y número; el tipo ausente se informa como desconocido, no se inventa.
Los códigos de observación se conservan sin interpretar aceptación oficial.

Verificación XMLDSig sólo de lectura:

- Una firma en la extensión UBL, una referencia única al documento completo.
- RSA-SHA1/256/512 y digest SHA1/256/512 en perfiles acotados; SHA1 advertido
  como histórico, sin cambiar el perfil de nuevas emisiones.
- C14N 1.0 inclusiva/exclusiva, con/sin comentarios; este perfil acotado
  rechaza documentos que contengan comentarios o parámetros no soportados.
- Estados `MISSING`, `PROFILE_UNSUPPORTED`, `DIGEST_MISMATCH`,
  `SIGNATURE_MISMATCH`, `INTEGRITY_VERIFIED_UNTRUSTED`.
- `SignatureValue` correcta no sustituye digest correcto. El certificado
  embebido nunca se convierte en ancla de confianza o identidad autorizada.

DTD/entidades, PI ajenas a declaración XML, XInclude/referencias externas,
IDs duplicados, referencias a subárboles, firmas ambiguas, respuestas CDR
múltiples y límites excedidos se rechazan. No se hace recuperación o reparación.

### Revisión previa de fase 3

`reviewOfflineGuideInventory`: inventario **en memoria**, hasta 20 pares / 16 MiB,
que requiere IDs de origen suministrados por un export autorizado. Detecta:

- Origen duplicado (`originSystem`, `originRecordId`).
- Clave fiscal repetida (RUC, tipo, serie, número).
- XML distintos para una misma clave fiscal.
- CDR con integridad o binding incorrectos y tipo no declarado.

La comparación de numeración normaliza ceros a la izquierda sólo en la clave
de diagnóstico: nunca reescribe el XML firmado. No elimina duplicados,
inserta comprobantes, mueve series, inicia numeraciones o crea checkpoints.
Incluso cuando no encuentra diferencias, `canImportHistory=false`.

## Ejecución explícita y privacidad

El manifiesto no concede autorización. Antes de usarlo, el propietario/TI debe
autorizar los archivos reales, RUC y periodo concretos; sólo se leen esos archivos.
La autorización de la muestra de este chat no se extiende a otras carpetas,
exportaciones o emisores.

Formato `factuez.offline-guide-files.v1`:

```json
{
  "schemaVersion": "factuez.offline-guide-files.v1",
  "scope": {
    "schemaVersion": "factuez.offline-review-scope.v1",
    "environment": "BETA",
    "purpose": "DIAGNOSTIC_ONLY",
    "issuerRucs": ["00000000101"],
    "fromDate": "2026-10-01",
    "toDate": "2026-10-31"
  },
  "documentFiles": [
    {"role": "GUIDE_XML", "path": "D:/COPIA_AUTORIZADA/guia.xml", "sha256": "HASH_SHA256_REAL_DE_ESE_ARCHIVO"},
    {"role": "CDR_XML", "path": "D:/COPIA_AUTORIZADA/cdr.xml", "sha256": "HASH_SHA256_REAL_DE_ESE_ARCHIVO"}
  ]
}
```

Ejemplo esquemático, no ejecutable: RUC ficticio y hashes/raíces por definir.
No reemplazarlo con datos reales sin fijar antes el alcance autorizado.
El periodo debe incluir las fechas declaradas de ambos XML; no evalúa plazos
tributarios. Producción, campos extra y alcance implícito se rechazan.

```powershell
node node_modules/typescript/bin/tsc -p packages/evidence-core/tsconfig.json
node migration/offline-guide-review-cli.cjs --authorized-offline-review --manifest D:/COPIA_AUTORIZADA/alcance.json
```

Ambos archivos requieren rutas absolutas y SHA256 coincidente; lectura acotada
por descriptor con comprobación de estabilidad. La herramienta no consulta
URL/QR ni variables de credenciales. El JSON no muestra nombres/documentos de
clientes/conductores, placas, direcciones, textos de notas, QR, certificado DER
o claves. El informe sigue siendo privado por sus metadatos empresariales.

Salida: `0` integridad/vinculación diagnóstica aprobada **sin confianza oficial**;
`2` incidencia; `1` alcance/entrada bloqueados. Nunca significan cierre fiscal.

No está expuesto en una ruta HTTP/PWA; no se cambia el expediente v1 ya servido
por Billing. La UI, Kong y microservicios existentes no se recrean por este
incremento. No se debe conectar a emisión, Outbox o historial persistente.

## Comprobación de la muestra autorizada

El manifiesto privado en `tmp/client-evidence-review-20261006` fija exactamente
los dos XML autorizados previamente, un RUC y un día, con sus SHA256.
La nueva herramienta reproduce la revisión independiente anterior:

- Guía 31: `INTEGRITY_VERIFIED_UNTRUSTED`.
- CDR: `DIGEST_MISMATCH`, aunque `SignatureValue` es correcta.
- RUC/referencia coinciden; tipo CDR ausente, sin inventarlo.
- Texto reporta aceptación con observaciones 4186/4399/4412.
- `officialAcceptance`, `canEmit`, `canImportHistory`, `canChangeCounters`,
  `phase2Closed` y `phase3Closed` permanecen `false`.

No se copiaron XML reales a fixtures/código/carpeta pública. Originales intactos.
Ver informe privado `output/reviews/Revision_XML_CDR_GT_Fases_2_3_20261006.md`.

## Verificación

54 pruebas nuevas aprobadas: scopes, XML malicioso, perfiles históricos,
alteración de contenido/firma, binding de respuesta, duplicados/conflictos,
CLI/hash/privacidad, conservación del hash original con BOM UTF8 y bloqueos.
TypeScript del paquete aprobado. Regresión final: **3.281 pruebas / 96 suites
PASS, ninguna omitida**, incluyendo el caso de BOM; runtime XSD offline.

Comando de pruebas locales con dependencias existentes:

```powershell
node node_modules/typescript/bin/tsc -p packages/evidence-core/tsconfig.json
node node_modules/vitest/vitest.mjs run --maxWorkers=2 --testTimeout=30000 --hookTimeout=30000 tests/offline-guide-review.spec.ts
```

## Pendientes que este código no reemplaza

CDR original íntegro, XML/CDR de los otros tipos, confianza PKI/revocación y
autorización del firmante, mapa confirmado sede/punto/serie, circuito oficial
y piloto Beta, export completo autorizado y extractor contrastado, snapshots
íntegros, conciliación contable, respaldo/restauración y acta de corte.

El runner SYNTHETIC existente no acepta estos archivos y conserva sus guards.
Este diagnóstico no habilita usar una copia real en ese runner ni transforma
una muestra en autorización de importación o producción.

## Estado del runtime observado al terminar

La comprobación GET de `localhost:8091/login` no respondió. Docker informa
Web, Billing, SUNAT, Identity, Kong, PostgreSQL y Redis detenidos con código 255
y fecha de salida común 06/10/2026 14:46:04 UTC, anterior a este incremento.
Los cuatro servicios restantes estaban activos/saludables. Los cuatro estados
detallados consultados no reportan OOMKilled ni mensaje de error; no se atribuye
una causa ni se afirma que el servidor esté operativo. No se reiniciaron,
recrearon o migraron servicios para instalar esta herramienta independiente.
