# API privada de extracción — Fase 1: inventario técnico

Fecha de revisión: **09/10/2026**, America/Lima.

## Resultado y alcance

Inventario de fuentes de **01, 03, 07, 08, 09 y 31**, revisado contra el código
actual. Se identificaron datos, propietarios, rutas, relaciones y límites.
No existe todavía `integration-service` ni `integration-export-worker` en este
checkout, ni un contrato remoto implementado `/integration/v1`.

**Cerrado: inventario técnico de código. No cerrado: disponibilidad de archivos
o datos reales, habilitación fiscal, migración histórica o acceso remoto.**

La comprobación no leyó bases de datos, volúmenes, documentos del cliente,
certificados, contraseñas ni `.env`. No realizó consultas SUNAT, cambios de
configuración, migraciones, despliegues, reservas, firma ni emisión.

El manifiesto [phase1-inventory.v1.json](integration/phase1-inventory.v1.json)
contiene 27 fuentes, 96 referencias verificables, los seis tipos y nueve pendientes.
El verificador produce líneas y SHA-256 de **código**, no de comprobantes reales.

## Matriz por tipo

| Tipo | Fuente de cabecera/ítems | XML/CDR y relación | Cobertura comprobada y límite |
| --- | --- | --- | --- |
| 01 Factura | Billing `Document.immutableSnapshot`, `DocumentItem`; SUNAT `FiscalDocument.immutablePayload` como copia fiscal | `DocumentArtifact`: XML firmado y CDR ZIP/XML si la preparación/transporte Beta los persistió; CDR individual | Consulta interna de listado/detalle y PDF de prueba. Firma/CDR son condicionales; no hay descarga genérica fiscal de XML/CDR. No se verificaron filas ni archivos existentes. |
| 03 Boleta | Las mismas fuentes de Billing y SUNAT | XML propio de boleta y XML/ZIP del RC son distintos. `FiscalBatch`, `BatchArtifact` y vínculo del envío; existe copia del CDR en el documento en el circuito Beta inicial | No llamar individual al CDR de resumen aunque esté registrado en `DocumentArtifact`. Resolver RC de un miembro y RC múltiples. |
| 07 NC | Repositorio de reserva Billing para `Document`/ítems; `FiscalNoteSnapshot` y `FiscalDocument` en SUNAT. Fuente QA aparte: `NotesQa.snapshot` | Preparación Beta de XML/ZIP y CDR por documento/lote existe en código. QA usa otros metadatos y puede tener CDR simulado | Productor Billing bloqueado antes de reservar/emitir. La existencia del código no prueba notas reales en BD. La extracción deberá leer notas ya persistidas sin activar el productor y separar QA. |
| 08 ND | Igual separación que NC; relación con documento original y motivos en snapshot de nota | Igual almacenamiento Beta/QA separado; pertenencia individual o a resumen según canal y documento referido | Productor bloqueado. No afirmar cobertura operativa completa por disponer de plantilla/transporte. |
| 09 GR remitente | Billing define `DESPATCH_ADVICE`/`DespatchAdviceDetails`, pero emisión HTTP sólo permite 01/03. GRE local usa `GreQaGuide.payload` en SUNAT | GRE QA guarda XML/ZIP en `xmlArtifact`/`zipArtifact`; no hay CDR oficial en ese laboratorio | Sólo laboratorio ficticio con RUC prefijo 00, origen/destino y snapshot propio. Un modelo de BD no demuestra una guía de negocio emitida. |
| 31 GT | Lector offline diagnóstico y `PrintableTransportGuide`; contrato fiscal general no incluye 31 ni enum Billing de transportista | XML/CDR de muestra pueden analizarse offline, sin registro de emisión. Plantilla local no crea XML/CDR ni identidad fiscal | Lector y representación local, **no circuito de emisión/persistencia de GT de negocio comprobado**. Recepción de una guía de proveedor no equivale a una GT emitida por FactuEz. |

Fuentes de evidencia exactas en el manifiesto, grupos `billing-*`, `beta-*`,
`fiscal-*`, `notes-qa`, `gre-qa`, `gt-reader` y `gt-renderer`.

## Propietarios y mapa de datos

| Información | Propietario/fuente | Regla de extracción |
| --- | --- | --- |
| RUC, empresa, sede, punto y serie | Billing: `CompanySettings`, `Branch`, `EmissionPoint`, `SeriesCounter` | Catálogo actual para autorización; snapshot para hechos históricos. Nunca inferir RUC/sede de un nombre o logo. |
| Cabecera, cliente, moneda, emisión | `Document`, `immutableSnapshot` y payload fiscal | Contrastar identidad y origen. `Customer`/maestros actuales no deben reemplazar el cliente/emisor de la emisión. |
| Ítems, impuestos, importes | `DocumentItem`, `DocumentTax`, snapshot y sus versiones por tipo | Mantener decimales/correlativos como texto exacto. Campos del esquema que el productor no pobló no son datos comerciales disponibles. No inventar descuentos/impuestos. |
| Referencias NC/ND | `DocumentReference`, `FiscalNoteSnapshot.reference`, `NotesQa.originalDocumentId` según fuente | Mantener tipo/serie/número, ID original, motivo y versión. No sustituir referencia QA por fiscal. |
| Traslado, origen, destino, transporte | `DespatchAdviceDetails`, snapshot GRE QA o diagnóstico offline | Contratos propios de guía; no convertirla en factura. Campos ausentes permanecen ausentes. |
| Estado de documento | Billing `status`, proyección `sunatStatus`, respuestas y SUNAT `FiscalDocument.status` | Separar estado local, fiscal, transporte y simulación. Un enum no verifica firma/CDR. |
| Resúmenes/bajas | Billing `DailySummary`/`DailySummaryItem`; SUNAT `FiscalBatch.immutablePayload`, envíos y `BatchArtifact` | Resolver todos los miembros y versiones. El RC inicial usa snapshot singleton; los suplementos usan `input.entries`. No ignorar el formato antiguo. |
| XML/CDR/ZIP | SUNAT `DocumentArtifact`, `BatchArtifact` y `CdrLog`; bytes en `ArtifactStore` | Identidad + propietario + entorno + tipo de artefacto + hash/tamaño. No exponer `storageKey`, rutas, errores/logs completos ni metadatos internos de envíos. |
| PDF actual | `CurrentPdfService` y `PdfPreviewCache` | Representación temporal LOCAL/BETA con diseño vigente, hechos congelados. No reemplaza original ni sirve aún como PDF fiscal universal. |
| Historial importado | `originSystem`/`originId` si hay registro Billing; `history-service` usa `HistoryRecord.snapshot` separado | El runner/read API existente está restringido a BETA/SYNTHETIC/QUARANTINED; no usarlo como historial empresarial ni quitar guards para habilitarlo. |
| Compras recibidas | `received-documents-service`: `ReceivedDocument`, proyección/ítems, `ReceivedArtifact.bytes` | Dominio receptor distinto. No incluir en ventas emitidas; sería un alcance de API separado si se solicita. |

Billing tiene unicidad por `(companyId, type, series, number)` y por origen
histórico. SUNAT tiene unicidad por `(issuerRuc, environment, documentType,
series, number)`. El entorno del snapshot histórico puede ser opcional: debe
resolverse explícitamente, **no sustituirse por el ambiente actual de la empresa**.

## Rutas existentes — internas, no contrato de integración

| Ruta | Resultado actual |
| --- | --- |
| `GET /api/v1/documents/catalog/issuance` | Catálogo autorizado, activo y BETA. No es catálogo histórico completo. |
| `GET /api/v1/documents` | Listado por páginas de 20 con sede/empresa/búsqueda/fuente. No tiene todavía contrato de exportación por cursor y rango/tipo/estado completo. |
| `GET /api/v1/documents/:documentId` | Snapshot inmutable, estado y contexto de impresión. No devuelve un inventario genérico de XML/CDR. |
| `GET /api/v1/fiscal-artifacts/:documentId/:format` | Sólo `ticket`/`a4`. Autoriza vía Billing y contrasta payload; limitada a BETA y estados `QUEUED`/`BUILDING`. No descarga XML/CDR ni es visor fiscal general. |
| `GET /api/v1/fiscal-evidence/:documentId` | Seguimiento de notas/lotes: metadatos, no originales. Límites de 100 notas/200 lotes y aviso de conciliación si se exceden; no exportación íntegra. Omite RC singleton en esa vista. |
| `GET /api/v1/notes-qa/:id/:format` | XML/ZIP/PDF y transporte/CDR **simulado**, separados y rotulados. No debe publicarse como descarga fiscal oficial. |
| `GET /api/v1/gre-qa/:id/artifacts/:format` | XML/ZIP/PDF GRE local, sin CDR oficial. Listado acotado a 50; no extracción completa. |
| `GET /api/v1/history/documents/...` | Read API componible de historial sintético, desactivada por defecto, sin listener automático. No ruta histórica empresarial habilitada en Kong. |
| `GET /api/v1/received-documents/:id/artifacts/:artifactId` | Originales de proveedor, dominio de compras. No sirve como sustituto de archivos emitidos. |

Las rutas de QA y las del Kong base no son idénticas: el overlay QA incluye
notas/guías/evidencia; el base no las declara todas. Declarar una ruta en Kong
tampoco demuestra que el upstream/controlador exista o esté operativo.
Esta revisión no reinició Kong ni comprobó red/runtime.

## Seguridad y archivos compartidos

La identidad actual está orientada a sesiones humanas: JWT/Identity, permisos
`document.view`, scopes GLOBAL/ASSIGNED por sede/punto/serie y revocación vigente.
Los laboratorios piden privilegios administrativos adicionales. No se identificó
un flujo `client_credentials` ni identidades de integración en las fuentes
Identity inspeccionadas. No reutilizar cuenta ADMIN o sesión PWA para un ERP.

`ArtifactStore.read` limita tamaño (10 MiB), valida directorio resuelto, enlaces,
longitud y SHA-256. Es infraestructura reutilizable **desde el servicio propietario**;
la integración no debe montar su volumen completo ni tener acceso a certificados.
El límite actual y la lectura en Buffer deberán revisarse para streaming/export
masivo sin relajar los controles de integridad.

**CDR de lote:** permitir leer un miembro no autoriza descargar el archivo de
todo el lote. Antes de entregar un original se autorizarán todos los miembros
incluidos. Si hay documentos fuera del scope, el original se bloquea; un extracto
informativo, si se diseña, se identifica como tal y nunca como CDR original.
La denegación no debe revelar la lista ni datos de miembros no autorizados.

La futura API distinguirá XML sin firma, XML firmado, ZIP de envío, XML/ZIP CDR,
origen de la evidencia (local/simulado/Beta/histórico) y confianza verificada.
No dará un XML sin firma cuando se solicita uno firmado sin informar la diferencia.
Un hash correcto no demuestra aceptación, firma ni confianza PKI.

## Pendientes concretos para las siguientes fases

1. **Fase 2:** contrato versionado por tipo/fuente, capacidades honestas y errores
   de disponibilidad, permisos insuficientes e inconsistencias.
2. **Fase 3:** identidad M2M, scopes propios y autorización interna. No reenviar
   tokens de integración a servicios que sólo aceptan usuario humano ni impersonar ADMIN.
3. **Fase 4:** read APIs en Billing/SUNAT para metadata y XML/CDR/lotes completos,
   con pertenencia y autorización del archivo compartido. Inventario genérico
   de archivos y reautorización por descarga, incluso en caché.
4. **Fase 4:** lectura de NC/ND persistidas, independiente del productor cerrado.
   Fuentes QA claramente excluidas por defecto de extracción empresarial.
5. **Fase 4:** definir fuente persistente empresarial 09/31 antes de declarar
   cobertura. No usar muestras diagnósticas como documentos emitidos.
6. **Fase 5:** paginación completa por cursor, corte consistente, worker y
   exportaciones temporales. No usar listado de 20/50 como descarga de todo.
7. **Fase 6:** feed durable con orden/checkpoint consistente. Los avisos live son
   best-effort y la Outbox existente no resuelve por sí sola el corte de exportación.
8. **Fase 7:** entrada exclusiva VPN/HTTPS; evitar exponer todas las rutas del
   Kong intranet, PostgreSQL, Redis, SUNAT/configuración y panel administrativo.
9. **Fase 8:** inventario y conciliación de datos/archivos reales autorizados,
   permisos efectivos y recuperación. No realizados en esta fase de código.

Estos pendientes no piden credenciales ni originales nuevos para diseñar el
contrato. El piloto real requiere autorización/accesos TI y disponibilidad de
los datos; no modifica los gates fiscales de las fases históricas 2/3.

## Verificación reproducible

Sin dependencias nuevas, sin Docker ni conexión a BD:

```powershell
node migration/integration-source-audit.mjs --source-only
node --test tests/integration-source-audit.test.mjs
```

Resultado: **27 archivos / 96 anchors verificados; 7 pruebas aprobadas**.
Los tests verifican seis tipos, scope sólo-código, rechazo de rutas de secretos,
referencias rotas, límite de tamaño y ubicación/hash/línea de los anchors.
No son ensayos de disponibilidad fiscal o conectividad externa; la regresión de
4.043 pruebas previa pertenece a recepción automática, no a esta nueva entrega.

No se cambiaron servicios, contratos de emisión, contadores, XML/CDR, datos ni
infraestructura. Sólo se añadieron documentación, manifiesto y verificador/tests.
El diseño posterior está en [fase 2: contrato](INTEGRACION_PRIVADA_FASE2_CONTRATO.md).
Es un avance de documentación/código puro, no una API remota desplegada.
