# Fases 2 y 3: implementación técnica y aceptación del cliente

Fecha: 07/10/2026. Desarrollo local/Beta; no producción.

## Responsabilidades acordadas

El cliente gestiona la copia/exportación completa del historial y su esquema,
periodos y archivos; confirma el mapa RUC–sede–establecimiento–punto–serie;
realiza la conciliación/aprobaciones con TI y Contabilidad y autoriza el corte
cuando corresponda. Estos entregables no son requisitos para seguir programando.

FactuEz desarrolla los lectores, verificadores, transporte, contratos y ensayos
ficticios conforme a los lineamientos publicados. **No se exige entregar nuevos
XML/CDR originales para completar código o ejecutar pruebas locales.** Sí se
necesitarán casos originales para contrastar posteriormente la compatibilidad
con el proveedor real; un fixture no se presenta como original del cliente.

No hay autorización nueva para envíos SOAP/REST oficiales, OAuth, firma con
certificado real, importación, alteración de correlativos o activación de producción.

## Incremento implementado

### Lectura fiscal offline 01/03/07/08

`packages/evidence-core/src/offline-sales-review.ts`, separado del runner SYNTHETIC:

- UBL 2.1/Customization 2.0: factura, boleta, NC de factura/boleta y ND.
- Cabecera, RUC emisor, cliente, direcciones, ítems/unidades/cantidades, precios,
  impuestos por esquema, descuentos/cargos declarados, totales, pagos/cuotas,
  notas y referencias/motivos. Decimales conservados sin punto flotante.
- Numeración histórica con ceros conservada; no se reconstruye el XML firmado.
- Firma XMLDSig y digest con los mismos controles acotados de 09/31. Resultado
  matemático separado de confianza PKI, autorización del firmante y aceptación.
- Revisión de sumas de líneas, impuestos/subtotales/esquemas y monto pagadero
  cuando existen los campos necesarios. Campos ausentes son `null` y se informa
  revisión incompleta; no se inventan identidades, direcciones o cifras fiscales.
- Elementos de negocio no mapeados se registran en un inventario acotado. **Proyección
  diagnóstica parcial**, no snapshot importable, XSD ni todas las reglas SUNAT.
  Los atributos UBL no están completamente mapeados; esa limitación se declara.
- CDR opcional: permite avanzar con un XML sin afirmar que está aceptado. Verifica
  vínculo RUC/referencia/tipo cuando hay CDR individual. Una respuesta RC/RA no
  se usa para aceptar individualmente una boleta/nota sin el binding del lote.

El lector existente `offline-review.ts` conserva el diagnóstico 09/31 y CDR.
No se reemplaza `SYNTHETIC`, no se eliminan guards ni se crea un emisor ficticio
en las bases activas para interpretar documentos reales.

### Entrada de archivos y privacidad

`migration/offline-sales-review-cli.cjs`:

```powershell
pnpm --filter @factuez/evidence-core... build
pnpm review:offline-sales --authorized-offline-review --manifest D:/COPIA_AUTORIZADA/alcance.json
```

Ejemplo esquemático, no autorización ni manifiesto real listo para ejecutar:

```json
{
  "schemaVersion": "factuez.offline-sales-files.v1",
  "scope": {
    "schemaVersion": "factuez.offline-review-scope.v1",
    "environment": "BETA",
    "purpose": "DIAGNOSTIC_ONLY",
    "issuerRucs": ["00000000001"],
    "fromDate": "2026-10-01",
    "toDate": "2026-10-31"
  },
  "documentFiles": [
    { "role": "DOCUMENT_XML", "path": "D:/COPIA_AUTORIZADA/documento.xml", "sha256": "HASH_SHA256_REAL_DE_ESOS_BYTES" },
    { "role": "CDR_XML", "path": "D:/COPIA_AUTORIZADA/cdr.xml", "sha256": "HASH_SHA256_REAL_DE_ESOS_BYTES" }
  ]
}
```

`CDR_XML` puede omitirse. Sólo archivos exactos con SHA256, rutas locales absolutas,
lectura estable por descriptor, XML de hasta 2 MiB y UTF8 estricto. Sin escanear
directorios, extraer ZIP, solicitar URLs/QR o acceder a credenciales/BD/red.
El manifiesto no sustituye la autorización del propietario de los archivos.

La salida se limita a metadatos: no nombres, documentos de clientes/conductores,
direcciones, placas, textos de ítems/notas, rutas privadas o bytes de certificados.
El código de salida 0 significa integridad/vínculo diagnóstico y controles locales
sin incidencias adicionales, nunca confianza fiscal. 2 indica incidencias o CDR
ausente; 1 significa entrada/alcance bloqueados. Los originales no se modifican.

### Preconciliación de fase 3

`reviewOfflineSalesInventory` es un contrato versionado en memoria, máximo
20 pares/16 MiB, con IDs del origen explícitos. Detecta duplicados por origen,
clave fiscal y XML contradictorios; conserva las filas, sin deduplicar en silencio.
Agrupa importes declarados por RUC, moneda, tipo y serie con sumas exactas.
NC/ND no se suman ni restan implícitamente de ventas; cada tipo queda separado.
Los grupos son totales brutos declarados, **no un libro de ingresos netos**.

No escribe historial, snapshots Document, Outbox ni checkpoints. El adaptador
persistente sintético existente no recibe estas proyecciones; el extractor y
contrato de una copia real se contrastarán contra su esquema autorizado.

### Transporte de notas y lotes: corrección del estado anterior

El código ya contiene `BoundedSoapAdapter`, `BetaSupplementService` y
`BetaDispatchPipeline`, con sendBill para notas F 07/08 y sendSummary/getStatus
para RC/RA. No corresponde marcarlos como inexistentes o sólo emulador.

Se añadieron pruebas específicas de contrato SOAP con fetch sustituido en memoria
y puertos aislados: recuperación de paquete PREPARED, mismo ticket, CAS/concurrencia,
repetición idempotente y respuestas perdidas/ambiguas sin reenvío automático.
No se añadió una fachada duplicada ni se modificó el wiring activo.

`assertOfficialFiscalActivation()` sigue bloqueando la activación a nivel de código.
La existencia de un adaptador Beta no demuestra piloto externo integrado,
homologación, confianza de CDR ni habilitación para emitir. Notas B corresponden
al perfil RC, no se habilita sendBill individual para ellas.

## Criterio de cierre sin trasladar el desarrollo al cliente

| Entregable | Responsable / criterio |
| --- | --- |
| Lectores y contratos offline de los tipos contemplados | Desarrollo: pruebas locales con fixtures y controles de seguridad |
| Transporte de notas/lotes preparado | Desarrollo: implementación y pruebas locales; no envío por guardar datos |
| Todas las reglas fiscales y perfiles de emisión reales | Desarrollo: cobertura aún parcial, no cerrar por XSD correcto |
| Piloto fiscal integrado Beta y confianza del CDR | Desarrollo con alcance/autorización concreta y evidencia verificable |
| Copia real, mapa y aprobación/conciliación/corte | Cliente/TI/Contabilidad, después del ensayo según corresponda |

La entrega de una GT no se ignora ni se solicita otra vez. El CDR de esa muestra
tiene la incidencia documentada de digest y requiere contrastarse con su original,
pero **esa incidencia no bloquea el desarrollo con fixtures**.

No se declara cerrada la fase fiscal oficial ni ejecutada la migración/corte real.
Todavía son trabajo técnico la cobertura adicional de reglas/perfiles, la activación
controlada y el piloto integrado; no se atribuyen al cliente ni se reemplazan por
datos o credenciales. El nuevo diagnóstico es CLI/librería, no pantalla instalada
en PWA. No hubo rebuild/reinicio de servicios para este incremento.

Fuentes de referencia: [SUNAT, manuales CPE/UBL, reglas y XSD](https://cpe.sunat.gob.pe/guias-y-manuales)
y [SUNAT, sistemas GRE](https://cpe.sunat.gob.pe/node/116). La implementación
parcial no se presenta como una conversión automática de todas sus reglas.

## Verificación del 07/10/2026

Regresión completa: **3.506 pruebas / 100 suites PASS, ninguna omitida**,
incluyendo el ensayo XSD offline seleccionado con Python/lxml. TypeScript de
`evidence-core` y `sunat-service` aprobado. Bloque focal de lectores/CLI y
transporte preparado: 331 pruebas / 6 suites PASS. `git diff --check` aprobado.

La auditoría `node tests/beta-fiscal-package.crypto.audit.cjs --local-fixtures`
aprobó 9 casos de firma/ZIP y XSD oficial fijado: 01, notas F/B, RC múltiple
alta/modificación/baja y RA múltiple. Claves/certificados efímeros en memoria;
cero red, BD, Docker, SMTP, certificado real o datos del cliente.
