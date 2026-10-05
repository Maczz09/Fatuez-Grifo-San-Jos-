# Etapa 4 — Primer incremento del modo sombra local

Fecha: 03/10/2026. **Desarrollo de etapas 3 y 4 en paralelo**, autorizado por el
usuario. Etapa 2 fiscal oficial abierta; etapa 3 real, corte y producción no
habilitados. Este incremento es un laboratorio offline con fixtures ficticios,
no un ensayo con ventas del cliente ni un emisor alternativo.

Actualización 04/10/2026: se implementó el [panel visual shadcn](ETAPA4_PANEL_VISUAL.md).
Las menciones de «sin PWA/despliegue» más abajo describen sólo este primer incremento
del 03/10, no el estado posterior del panel. Los límites fiscales siguen vigentes.

Incremento posterior del 04/10: [lector XML de negocio, PDF/QR desde bytes,
firma/CDR ficticios y conciliación ampliada](ETAPA4_EVIDENCIA_COMPLETA_LOCAL.md).
Se añadió un laboratorio CLI separado; las limitaciones declaradas abajo siguen
describiendo este comparador v1 y sus fixtures del panel, no las capacidades del
nuevo paquete. No se habilitaron datos reales ni gates fiscales.

## Implementado

- Paquete puro `packages/shadow-core`, separado de servicios fiscales y bases.
- Contratos versionados de caso, lote, proyección impresa e informe.
- Comparación campo a campo del snapshot completo de negocio, importes exactos,
  cabecera, cliente, ítems, impuestos, pago y referencias de notas 01/03/07/08.
- Diagnóstico estructural XML por namespace/nombre, orden de elementos/texto y
  atributos. Sólo excluye el bloque XMLDSig ubicado en la extensión UBL esperada.
- Comparación de proyecciones **declaradas** de impresión 80 mm/A4: páginas,
  dimensiones, texto y campos QR; consistencia de cabecera XML/QR con el snapshot.
- Anotaciones versionadas de clasificación, vinculadas al hash del caso y al ID
  de cada diferencia, sin aprobar o resolver automáticamente ninguna incidencia.
- CLI con cuatro casos integrados y pruebas de aislamiento/entradas inválidas.

Sin nuevos endpoints, workers, rutas Kong, tablas, migraciones, roles o cambios
en la PWA/intranet. No importa `Document`, reserva números, crea Outbox, firma,
consulta Identity/SUNAT, solicita OAuth o envía correo.

## Contratos y aislamiento

`factuez.shadow-case.v1`: `caseId`, `environment=BETA`, `datasetClass=SYNTHETIC`,
`mode=SHADOW`, `legacy`, `factuez`. Cada lado recibe `snapshot`, `xml` nullable y
`prints`, usando el [contrato completo del historial](ETAPA3_PERSISTENCIA_Y_RESTAURACION.md).
Es una proyección canónica sintética compartida, no un export directo de Billing
o del legado; el adaptador de captura real todavía no está implementado.

Los snapshots se validan, normalizan y separan de los objetos del caller. Sólo
admiten RUC ficticios `00000000xxx`. Los lados deben conservar empresa e identidad
de origen; no se emparejan ventas diferentes por similitud de número/importe.
Se rechazan campos desconocidos, callbacks, proxies y getters, sin ejecutarlos.

`factuez.shadow-run.v1`: `runId`, mismo perfil, entre 1 y 50 casos. Rechaza casos,
orígenes e identidades fiscales duplicados en cualquiera de los lados. El orden
del informe es determinista por `caseId`; el hash de entrada también liga el
orden recibido, no afirma ser un hash de equivalencia semántica.

`assertShadowOperation()` rechaza siempre cualquier operación solicitada,
incluidos envío, firma con clave real, importación, reserva y producción. No hay
un flag para activar esas acciones ni puertos de transporte/BD en este paquete.
Sus únicas dependencias son `history-core` y el parser XML ya cacheado; no importa
clientes fiscales, certificados, colas, filesystem, red o configuración `.env`.

Informes profundamente congelados y con:

```text
transmission=false, persisted=false, fiscalWrites=0, outboxWrites=0
countersChanged=false, fiscalAuthority=false, cutoverAuthorized=false
signatureVerified=false, cdrAuthenticityVerified=false, pdfBytesVerified=false
accountingApproved=false, productionBlocked=true, reviewRequired=true
```

## Qué se compara y qué no se acredita

### Snapshot de negocio

Se comparan propiedad canónica, RUC, tipo/serie/número, fecha, moneda, operación,
emisor, cliente, ítems ordenados, cantidades/precios, afectación e impuestos,
nueve importes, contado/crédito/cuotas, referencia/motivo, placa y textos.
La fecha del snapshot se normaliza al mismo instante UTC; la fecha fiscal XML/QR
se contrasta por separado en `America/Lima`, no con la zona del equipo.
No se calcula con `Number` el dinero, ni se usa tolerancia para ocultar centavos.

Evidencia declarada y hashes de artefactos no se comparan como datos de venta;
permanecen ligados en el hash completo. Las notas mantienen importes positivos,
no se convierten en ventas netas ni asientos contables. No valida por sí solo
todas las reglas fiscales o la multiplicación cantidad/precio.

### XML

Parsing estricto: sin DTD/entidades externas, CDATA, comentarios, instrucciones
ajenas a la declaración XML, caracteres ilegales, múltiples raíces o recuperación
de errores. Se acotan longitud a 16.000 caracteres/64.000 bytes, 2.000 elementos
y profundidad 32; IDs duplicados se rechazan incluso dentro de firma omitida.
Raíz/namespace según tipo y cabeceras únicas son obligatorios.

Se conservan ID fiscal, fechas, horas y atributos de negocio: **no se eliminan
todos los IDs/timestamps como si fueran variables irrelevantes**. Se omiten
declaraciones de prefijo, pero se conservan los namespaces efectivos. Atributos
se ordenan; sólo se ignora indentación entre elementos. Cambios de texto fiscal
o elementos desconocidos siguen siendo significativos.

Esto **NO es C14N, equivalencia XML semántica universal, validación XSD ni firma
XMLDSig**. Puede reportar diferencias legítimas de representación; valores QName
en atributos y decimales textuales no se normalizan por un esquema. La vinculación
con snapshot comprueba ID/fecha/moneda/tipo; emisor, cliente, ítems e importes del
XML aún necesitan un extractor/binding completo. El `DigestValue` es declarado,
no recalculado ni autenticado. No se solicita/usa una clave o certificado real.

### Impresión y QR

`factuez.shadow-print.v1` exige `provenance=SYNTHETIC_DECLARED`, formato único,
dimensiones enteras en micrómetros, texto no vacío, campos QR, hash PDF declarado
y digest nullable. Se comparan ambos formatos y los campos QR con cada snapshot.
Si existe digest XML, el impreso debe declarar el mismo de su propio lado;
digests distintos entre lados no prueban un error de negocio.

**No se leen, crean, parsean o renderizan bytes PDF ni se decodifican imágenes QR
en este incremento**. SHA y dimensiones declarados no prueban integridad o
contenido real. Los fixtures XML no son UBL completos validados y su firma es
sólo una estructura ficticia. Igualdad de proyecciones no acredita impresión
física, compatibilidad de un driver/ticketera ni aceptación SUNAT.

## Clasificación y revisión

Informe `factuez.shadow-report.v1`: conteos completos, hasta 200 ejemplos,
identificadores de diferencia ligados a caso/campo/valores, SHA de entrada y
snapshots, diagnóstico XML y cobertura/pendientes explícitos. Para errores de
vinculación de un lado (`snapshotBinding`, `digestBinding`, `digestEvidence`),
los valores de las columnas izquierda/derecha son esperado y observado de ese
lado, no dos sistemas diferentes; el path conserva su procedencia.
Valores de ejemplo
se acotan a 250 caracteres; su hash liga el valor completo, no el fragmento.

Clasificación inicial: `CORRECTION_REQUIRED`, `COSMETIC` o `DATA_MISSING`.
Sólo observaciones y nombre comercial presentes se sugieren
cosméticos; los campos fiscales no se degradan por similitud.
Ausencia de XML/formatos en ambos lados sigue siendo evidencia faltante, no match.
Estados: `MATCH_WITH_UNVERIFIED_EVIDENCE`, `DIFFERENCES_FOUND`, `INCOMPLETE`.

`annotateShadowReview()` exige `factuez.shadow-review.v1` con perfil, caso/hash,
reviewer UUID declarado y decisiones por diferencia. Añade la cuarta categoría
`LEGACY_BUG_PENDING_APPROVAL`; rechaza duplicados, hashes obsoletos y diferencias
desconocidas. Conserva categoría original, propuesta y motivo. **El UUID no es
identidad autenticada**: son anotaciones sintéticas, no aprobación del cliente.
Incluso si se anotan todas, `unresolvedDifferenceCount` no disminuye y el informe
original no cambia. Incidencias truncadas no desaparecen por no mostrarse.

## Verificación ejecutada

- **94 pruebas nuevas / tres suites PASS**, incluidas en la regresión completa.
- **2.306 pruebas / 69 suites PASS, ninguna omitida**, con runtime XSD offline,
  repetidas tras el último ajuste conservador de clasificación de importe en letras.
- **19 tareas TypeScript PASS / 14 paquetes**, dieciocho resultados de caché y
  comprobación del paquete nuevo. Build de shadow-core y history-core PASS.
- Instalación offline con `--ignore-scripts`: cero descargas, sin scripts.
- Ensayo CLI: cuatro casos, una coincidencia comparativa, 20 diferencias
  (16 de corrección, tres ausencias y una cosmética). Resultado `REVIEW_REQUIRED`.
- Cero datos/certificados reales, bases activas, red fiscal, correos, contadores,
  Outbox o escrituras de aplicación. Sin cambios de Docker/Kong/intranet.

Las 24 comprobaciones PostgreSQL/HTTP de etapa 3 pertenecen al incremento
anterior; no se presentan como un nuevo E2E de despliegue de fase 4.

## Ejecutar sólo fixtures integrados

Desde `D:\Facturacion\FactuEz`:

```powershell
pnpm test:shadow
pnpm qa:shadow
# Informe completo:
node migration/shadow-qa-cli.cjs --isolated-synthetic-only --full-report
```

La CLI **devuelve código Node 3 intencionalmente** para revisión pendiente,
incluso con coincidencia; no indica aprobación ni fallo de infraestructura.
Argumentos inválidos devuelven 2 con error sanitizado. `pnpm`/PowerShell pueden
mostrar un estado no exitoso por ese código. No admite `--input`, BD, URLs,
stdin, certificados ni opciones para enviar o activar producción. No guarda
informe/estado en disco; sólo stdout/stderr.

## Siguiente incremento, sin dar por cerrada la fase

Panel shadcn del laboratorio y exportación del reporte implementados en el
[incremento visual del 04/10](ETAPA4_PANEL_VISUAL.md). Puede continuar sin el cliente
el extractor/binding XML más completo usando fixtures. También siguen
pendientes pantalla, fechas/búsqueda y exportaciones del historial de etapa 3.
No se declaran implementados ni desplegados aquí.

El modo sombra con ventas reales requiere alcance y acceso autorizados, copia
estable y mapa confirmado, adaptadores auditados, aislamiento de salida,
comparación de bytes/XML/PDF/QR reales y revisión con TI/Contabilidad. No quitar
guards ni sustituir `SYNTHETIC` para ensayarlo. El corte exige su aprobación
posterior; este laboratorio no otorga esa autorización ni cierra fase 2 o 3.

Código: [comparación y anotación](../packages/shadow-core/src/index.ts),
[XML estructural](../packages/shadow-core/src/xml.ts),
[CLI](../migration/shadow-qa-cli.cjs),
[fixtures integrados](../migration/fixtures/shadow-development.cjs),
[pruebas](../tests/shadow-core.spec.ts).
