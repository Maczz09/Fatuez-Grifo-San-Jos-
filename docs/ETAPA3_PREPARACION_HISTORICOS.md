# Etapa 3 — Preparación de conciliación histórica

Fecha: 03/10/2026. Referencia de alcance:
[Fase 3 de la guía de migración](MIGRACION_RESTOAPP_A_FACTUEZ.md).

## Estado

Esta página describe la **preparación dry-run**, no la importación ni el corte. Se puede
revisar un export normalizado de desarrollo sin levantar Docker. No lee RestoApp,
PostgreSQL, Redis, credenciales, certificados, archivos XML/CDR/PDF ni la red.
No se ha extraído información real ni se han ejecutado migraciones.

La etapa 2 fiscal oficial sigue abierta. Por solicitud posterior del usuario,
comenzó el desarrollo de etapa 3 en paralelo, no su importación/corte real.
Nuevo [verificador de bytes y ensayo por lotes](ETAPA3_BUNDLE_Y_ENSAYO.md), con
CLI separada y fixtures ficticios. Las limitaciones de lectura de esta página
siguen describiendo la CLI de metadatos anterior, que no se amplió a I/O fiscal.
Ninguna de las dos herramientas elude el gate ni autoriza migrar al cliente.

Incremento posterior: [persistencia y restauración aisladas](ETAPA3_PERSISTENCIA_Y_RESTAURACION.md).
Contrato completo separado y repositorio propio ensayados con datos sintéticos
en PostgreSQL nuevo. Estas CLI siguen sin escribir a BD. No se ejecutó extracción,
importación/corte del cliente ni se verificó el mapa o la confianza fiscal reales.

Último incremento: [API protegida y conciliación exacta](ETAPA3_CONSULTA_Y_CONCILIACION.md)
preparadas y ensayadas sólo con autoridad HTTP ficticia y PostgreSQL sintético.
Sin despliegue en la PWA/Kong activos; no cambia los límites de estas CLI ni
habilita datos reales.

## Uso local con fixture ficticio

Desde `D:\Facturacion\FactuEz`:

```powershell
pnpm migration:preview:build
node migration/history-preview-cli.cjs --dry-run --development-only --input migration/fixtures/history-development.json
node migration/history-preview-cli.cjs --dry-run --development-only --input migration/fixtures/history-development.json --full-report
pnpm test:history-preview
```

El fixture usa identificadores inventados, dos boletas y ningún artefacto. Se
espera `REVIEW_REQUIRED` y código de salida **3** porque faltan metadatos CDR.
El hueco de número 2 es descriptivo: nunca se rellena ni reutiliza.

Ensayo ejecutado: dos filas, cero duplicados, base 3.00 + IGV 0.54 = 3.54,
un hueco interno y dos revisiones por CDR ausente. Suite histórica: 127 PASS.

La CLI imprime JSON a stdout, no escribe un archivo ni importa filas. Sólo
admite los flags anteriores y `--checkpoint archivo.json`; no existe `--apply`,
`--send`, creación de Outbox ni reserva de correlativos.

| Salida | Significado |
|---|---|
| 0 | Consistencia de los metadatos declarados; no aceptación fiscal |
| 1 | Argumentos, archivo o contrato inválidos |
| 2 | Duplicados, mapeos contradictorios o diferencias de conciliación |
| 3 | Revisión necesaria, por ejemplo CDR ausente |

## Contrato explícito del export

`schemaVersion=factuez.history-normalized.v1`, `environment=BETA`,
`originSystem=RESTOAPP`, `rows`. No admite defaults, claves extra, secretos,
objetos ejecutables, comandos ni contenido binario. JSON UTF-8 de hasta 16 MiB.

Cada fila contiene:

- `issuerRuc`, `companyId`, `type` (01/03/07/08), `series`, `number`,
  `issueDate` ISO con zona explícita, `currencyCode` PEN/USD, `originId`.
- `amounts`: nueve strings decimales exactos: `taxableAmount`, `exemptAmount`,
  `unaffectedAmount`, `freeAmount`, `discountTotal`, `igvAmount`, `iscAmount`,
  `otherTaxesAmount`, `payableAmount`.
- `tax`: `taxSchemeId`, `taxName`, `taxableAmount`, `taxAmount` por impuesto.
- `artifacts`: tipo, nombre original sin ruta, SHA-256 y tamaño declarado.
  La CLI nunca abre esos archivos. Declarar un CDR no verifica su firma.
- `ownIssuerMapping`: RUC, empresa, sede, punto, contador de serie, tipo y serie
  explícitos. Contrasta coherencia dentro del export, no existencia o permisos
  en la base. No asigna emisores por inferencia ni inventa datos del cliente.

Modelo TypeScript: [history-preview.ts](../migration/history-preview.ts).
Ejemplo: [fixture](../migration/fixtures/history-development.json).

## Conciliación y reanudación

Detecta identidad fiscal duplicada `(RUC, tipo, serie, número)` y origen
duplicado `(empresa, RESTOAPP, originId)`, separa monedas y RUC, contrasta mapeos,
concilia importe pagable e impuestos usando enteros exactos y resume huecos de
serie sin materializar millones de números.

Las bases son NETAS; el descuento es informativo, no se resta otra vez.
`freeAmount` no suma al pagable. Las notas tienen importes positivos y los
totales son la suma de filas exportadas, **no ventas netas contables**. Incluyen
duplicados para poder detectar la diferencia; no eliminan registros solos.

Plan determinista por SHA-256, lotes de validación de 500 filas. El checkpoint
contiene `inputSha256`, `planSha256`, `completedBatches`; sólo describe avance
de VALIDACIÓN. Cada llamada vuelve a revisar el export completo. Cambiar
metadatos, mapeo o artefactos invalida el checkpoint. No representa imports
confirmados ni commits de PostgreSQL.

Límites: 10.000 filas, 1.000 grupos por dimensión, ocho artefactos y dieciséis
impuestos por fila, 100 MiB por artefacto y 1 GiB agregado declarado, veinte
rangos de huecos y cien ejemplos diagnósticos. Los totales y conteos completos
se conservan aunque los ejemplos se acoten.

## Antes de una importación real

1. Cerrar o aceptar formalmente el gate de etapa 2 y definir el ensayo.
2. Usar respaldo/copia aislada del origen; aprobar explícitamente el export y
   el mapa empresa–RUC–sede–punto–serie. No usar el fixture como mapa real.
3. Verificar archivos contra los hashes declarados, XML/CDR y su confianza;
   resolver duplicados y discrepancias con el responsable contable.
4. Adaptar el candidato sintético a un contrato/extractor para copia autorizada,
   integrar autenticación/API y ensayarlo sobre esa copia, sin emisión, firma,
   correo ni Outbox. Repetir restauración y ausencia de duplicados con datos reales.
5. Aprobar conciliación y acta de corte antes de fijar el siguiente correlativo.
   El máximo observado del export no autoriza cambiar un contador.

Estos pasos reales no están ejecutados ni se atribuyen al dry-run. La base y los
correlativos actuales permanecen intactos; producción está fuera de alcance.
