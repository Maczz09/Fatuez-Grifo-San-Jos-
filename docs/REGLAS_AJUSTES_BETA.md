# Ajustes de venta BETA

Consulta de fuentes: 2026-10-02. Implementación nueva y optativa; no cambia contratos,
calculador histórico, generador histórico, reglas fiscales existentes ni registros.
Los nuevos módulos se importan directamente o mediante el barrel que registra el caller.

## Contrato y límites del cálculo

`calculateSaleAdjustments(input: SaleAdjustmentsInput): SaleAdjustmentsResult` lanza
`SaleAdjustmentError { code, path }` en el primer error. `validateSaleAdjustments(unknown)`
devuelve `{ valid: true, result }` o `{ valid: false, issues }`, sin resultado parcial.
No mutan sus entradas. Todos los importes/factores son cadenas; la aritmética usa los
helpers `bigint` existentes de `tax.ts`, sin cambiar ese archivo ni convertir dinero a Number.

- Ambiente obligatorio `BETA`; monedas `PEN`/`USD`, sin conversión. `EUR` se rechaza.
- Afectaciones onerosas `10` con IGV explícito `18`, `20`/`30` con tasa explícita cero.
  Es un límite del pipeline solicitado, no una determinación de la tasa legal de cada negocio.
- Dinero: n(12,2), máximo `999999999999.99`; cantidad/precio: 12 enteros y hasta 6 decimales.
  Cantidad/precio positivos, línea redondeada a más de cero. Hasta 500 líneas y 99 anticipos.
- Factores de descuento: mayor que cero y hasta uno, máximo 5 decimales. `0.10` es 10%.
  Porcentajes de detracción: mayor que cero y hasta 100, máximo 5 decimales, obligatorios.
  Son límites numéricos; no son tasas de ISC/SPOT predeterminadas o autorizadas.
- Redondeo half-up por operación monetaria. Rechaza descuentos redondeados a cero,
  valores negativos, desbordamientos y conflictos que aumentarían IGV al descontar.
  No agrega centavos correctivos para forzar una conciliación.
- Objetos planos y arrays densos, campos exactos, sin coerción, exponentes, espacios,
  signos, ceros iniciales, propiedades desconocidas ni `undefined` explícito.
  ISC, IVAP, ICBPER, gratuitos, exportación, retenciones, percepciones y cargos no están soportados.

Orden: descuento de línea `00` sobre base; línea `01` sobre su importe con IGV;
global `02` sólo sobre la base `10` restante; global `03` sobre el total comercial
restante; anticipos por su afectación; detracción informativa. Los descuentos de base
recalculan IGV; `01`/`03` conservan base e IGV. Se permite como máximo uno por motivo,
en ese orden, sin repetir descuentos de línea como globales. En una venta sólo `20`/`30`,
`02` falla; `03` reduce el pago pero conserva las bases. `00` por línea permite reducir
la base exonerada o inafecta.

Cada anticipo requiere tipo `01`/`03`, serie electrónica F/B de cuatro caracteres,
número de 1..8 dígitos, RUC sintáctico de once dígitos, fecha calendario no futura,
moneda coincidente, afectación y base/IGV separados. No verifica existencia, titularidad,
checksum, saldo persistente ni aceptación del comprobante. Una referencia se usa una vez;
documentos de anticipo mixtos o fraccionamientos duplicados deben resolverse fuera de este perfil.
Su IGV debe conciliar exactamente con base y tasa; no supera la base de su grupo ni
el saldo comercial tras descuentos. Códigos relacionados: factura `02`, boleta `03`;
deducción por base gravada `04`, exonerada `05`, inafecta `06`.

`result.lines` contiene sólo ajustes de línea. `result.totals` contiene bases/IGV después
de globales y anticipos. `totalBeforeAdvances` es el total comercial tras descuentos;
`prepaidAmount` es la suma de base+IGV anticipados; `payableAmount` es su diferencia.
`nonTaxDiscountAmount` sólo suma `01`/`03`. Las deducciones `00`/`02`/anticipos ya se
aplicaron a las bases. Invariante exacta:

```text
taxableAmount + exoneratedAmount + inaffectedAmount + igvAmount
  - nonTaxDiscountAmount = payableAmount
totalBeforeAdvances - prepaidAmount = payableAmount
```

La detracción exige `mode: INFORMATIONAL`, operación general `1001`, código de bienes/
servicios de la lista conservadora en el módulo, porcentaje, base igual al total antes
de anticipos y redondeo explícito `CENT`/`SOL`. Sólo PEN. No supone umbral de S/700,
tipo de actividad, régimen, cuenta bancaria, tipo de cambio ni porcentaje aplicable.
`SOL` redondea directamente a soles, sin doble redondeo. No reduce base, IGV ni pago.
La configuración es responsabilidad del caller; el cálculo no acredita aplicación legal
del SPOT. Operaciones especializadas `1002`/`1003`/`1004` y sus códigos están excluidas.

## Conexión con FiscalDocumentSnapshot y preview

Construir el input explícito desde los campos cantidad/precio/afectación/tasa, con
`id = String(lineNumber)` y fecha de emisión en Lima. No pasar el snapshot completo al
validador: su whitelist rechaza datos ajenos al contrato de cálculo.

Para una proyección en Billing/PWA, copiar el snapshot; conservar identidad, descripción,
unidad, cantidades, precios originales y numeración. Aplicar `lineExtensionAmount`,
`igvAmount` y `totalAmount` de cada resultado a la línea ligada por ID. En los tres campos
existentes de `snapshot.totals` poner `taxableAmount` (sólo 10), `igvAmount` y `payableAmount`.
El contrato existente no tiene bases 20/30 ni ajustes: conservar además `{ input, result }`
en el perfil/DTO de preview del caller; no ocultar esas bases dentro de `taxableAmount` ni
hacer casts para aparentar que el contrato histórico soporta un documento mixto.
No pasar esa proyección al generador UBL histórico o a emisión existente.

```ts
const calculation = calculateSaleAdjustments(input);
// base es el snapshot SIN ajustes, compatible con input.
const xml = buildAdjustedInvoiceUbl(base, { input, result: calculation });
```

`buildAdjustedInvoiceUbl(base: FiscalDocumentSnapshot,
calculation: SaleAdjustmentsInput | AdjustedInvoiceCalculation): string` es puro, BETA/
operación `0101`, Invoice `01`/`03`, PEN/USD, sin firma digital. Verifica cabecera,
vínculo de líneas y aritmética original; recalcula y compara cualquier resultado recibido.
Admite ausencia de forma de pago o `CONTADO` explícito; crédito falla. Produce descuentos
`AllowanceCharge` por línea/globales y subtotales separados según esta tabla:

| Afectación | Tributo | Nombre | Tipo | Categoría |
| --- | --- | --- | --- | --- |
| 10 | 1000 | IGV | VAT | S |
| 20 | 9997 | EXO | VAT | E |
| 30 | 9998 | INA | FRE | O |

Limitación deliberada: **el generador Invoice rechaza anticipos**. El cálculo y los códigos
de referencia están completos; no se inventa la relación actual de `AllowanceCharge` 04/05/06,
`PrepaidPayment`, `PrepaidAmount` y totales. El lineamiento de 2015 es de UBL 2.0 y no basta
para certificar esa conciliación en UBL 2.1 actual. No produce referencias parciales engañosas.
La detracción sigue siendo informativa en el resultado, no se serializa como operación SPOT.
El XML cuenta con pruebas locales de contenido y conciliación; no se afirma validación
XSD/XSL actual ni aceptación por SUNAT. Para este perfil, unidades XML conservadoras:
NIU/LTR/KGM/MTR/HUR/ZZ; identificación de cliente RUC, DNI o sin documento en boleta.

Nuevo controlador `POST /api/v1/fiscal-rules/preview`, protegido por `ConfigurationGuard`,
retorna `profile`, `source`, `localOnly: true`, `transmissionAuthorized: false`, `calculation`.
No tiene dependencias de DB, configuración, certificados, secretos ni emisión. La guardia
existente mantiene su verificación de sesión en Identity; no cambia el cálculo puro.
Errores 400 contienen mensaje público fijo, código y campo del esquema, sin texto privado.
El caller debe registrar el controlador en AppModule y los exports, y realizar el routing
habitual del gateway si fuera necesario. Ninguno se modifica aquí.

La página nueva `/fiscal-lab` usa `useWorkspace().api` y la sesión existente, no inventa
tokens ni credenciales. Una línea, 10/20/30, PEN/USD, porcentaje global 02 convertido a
factor con bigint; no hace POST de emisión. Requiere los mismos permisos de administración.

## Fuentes primarias SUNAT

1. [Portal vigente de guías y manuales](https://cpe.sunat.gob.pe/guias-y-manuales): consultado
   2026-10-02; anuncia validaciones al 26.08.2026. El enlace descargable no pudo recuperarse
   (herramienta web: error; consulta directa: Cloudflare). **No se afirma haber verificado
   las filas del XLSX actual**, ni se toman catálogos de terceros como fuente.
2. [RS 244-2019, anexo](https://www.sunat.gob.pe/legislacion/superin/2019/anexo-244-2019.pdf):
   Anexo II, catálogo 05 y 12, y catálogo 53 en página PDF 10 (índice 9): códigos 00..06
   utilizados arriba. Es norma publicada que sigue disponible en la fuente primaria;
   no se presenta como una publicación de 2026. Sus nombres EXO/INA prevalecen sobre las
   denominaciones largas de ejemplos antiguos.
3. [RS 318-2017, Anexo V](https://www.sunat.gob.pe/legislacion/superin/2017/anexosV-318-2017.pdf):
   catálogo 07, página PDF 4: 10/20/30 onerosos; catálogo 05, página PDF 3: S/E/O.
   Catálogos 02/03 remiten a ISO 4217 y UN/ECE; la implementación sólo soporta el subconjunto
   de monedas/unidades documentado, no pretende cubrir sus catálogos completos.
4. [RS 114-2019, Anexo VII](https://www.sunat.gob.pe/legislacion/superin/2019/anexoVII-114-2019.pdf):
   factura, páginas PDF 3..6: campos de línea, descuentos y anticipos; páginas 8..9:
   campos de detracción. Montos n(12,2), factores/porcentajes n(3,5), catálogos 05/07/12/53/54.
   Estas ubicaciones permiten identificar metadatos; no sustituyen las validaciones actuales.
5. [Guía factura UBL 2.1 vigente en el portal](https://cpe.sunat.gob.pe/sites/default/files/inline-files/guia%2Bxml%2Bfactura%2Bversion%202-1%2B1%2B0%20%282%29_0%20%282%29.pdf):
   páginas 46..48 para EXONERADO/INAFECTO y categorías E/O; 56 para total por pagar;
   60 para estructura de descuentos. La tabla antigua de motivos de descuento se
   reemplaza por el catálogo 53 de la RS 244-2019, no se codifica desde el ejemplo antiguo.
6. [Reglamento IGV, artículo 5 numeral 13](https://www.sunat.gob.pe/legislacion/igv/regla/cap4.htm):
   condiciones para excluir descuentos de base. El caller debe sostener esas condiciones
   comerciales; el módulo sólo verifica la representación y la aritmética.
7. [Apéndices SPOT consultados actualmente](https://orientacion.sunat.gob.pe/apendices-del-sistema-de-detracciones):
   Anexo IV, lista de bienes/servicios; Anexo III y actualización por RS 071-2018.
   Identifica códigos admitidos en modo informativo. No se copian tasas al módulo ni se
   interpreta el código de producto como prueba de afectación o de cumplimiento legal.
8. [Lineamiento anticipos de mayo 2015](https://contenido.app.sunat.gob.pe/insc/ComprobantesDePago%2BElectronicos/Anticipos_lineamiento_mayo_2015.pdf):
   explica deducciones y referencias para la versión antigua. Se consultó como contraste;
   no se usa para aproximar Invoice UBL 2.1 con anticipos.

Pruebas locales: `node node_modules/vitest/vitest.mjs run tests/sale-adjustments.spec.ts tests/fiscal-rules-preview.spec.ts --no-file-parallelism`.
Sin certificados del usuario, DB, Docker, SMTP, migraciones, secretos ni llamadas de emisión.
