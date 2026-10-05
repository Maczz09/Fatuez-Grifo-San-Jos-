# Etapa 4 — Evidencia XML, PDF/QR, firma/CDR y conciliación local

Fecha: 04/10/2026. Incremento de desarrollo solicitado mientras se espera la
información del cliente. **Sólo BETA/SYNTHETIC; no cierra etapa fiscal 2,
migración real 3 ni corte.**

## Verificación de este incremento

- **314 pruebas nuevas / 5 suites PASS** (`pnpm test:evidence`).
- **2.684 pruebas / 76 suites PASS**, ninguna omitida, regresión completa con
  Python/XSD offline, después del ajuste A4.
- **21 tareas TypeScript / 15 paquetes PASS**. Lock validado offline con
  pnpm 11.19.0, sin scripts de instalación ni migradores.
- **55 comprobaciones integradas PASS**: 4 documentos, 8 representaciones,
  firma/cadena/CDR ficticios, QR/texto PDF, comparación positiva con sólo
  metadatos distintos, alteraciones y conciliación coincidente/con diferencias.
- Cero conexiones de red, emisiones fiscales, Outbox, cambios de contador,
  correos, impresiones físicas o datos reales. Sin despliegue/reinicio Docker.
- Dos muestras finales revisadas visualmente, A4 simple en una página y ticket
  80 mm con QR/hash y marcas, sin recortes u omisiones.

Evidencia de ejecución: `tmp/evidence-qa/run-iqkz69/Informe_evidencia_ficticia.json`.
Copias de las muestras en `output/pdf/Evidencia_Ficticia_80mm_20261004_iqkz69.pdf`
y `output/pdf/Evidencia_Ficticia_A4_20261004_iqkz69.pdf`.
Los directorios de artefactos no contienen claves privadas y están excluidos de Git.

## Ejecutar

Desde `D:\Facturacion\FactuEz`, con las dependencias del monorepo instaladas:

```powershell
pnpm test:evidence
pnpm qa:evidence
```

El segundo comando compila los paquetes, utiliza cuatro documentos ficticios
fijos (01/03/07/08), crea claves efímeras en memoria y escribe una carpeta nueva
`tmp/evidence-qa/run-*`. No recibe RUC, archivos, rutas de entrada o destino,
certificado, contraseña o flag para datos reales. Argumentos adicionales se
bloquean antes de cargar el laboratorio. Salida con `status=PASS` acredita sólo
que se cumplieron sus comprobaciones locales.

Se conservan dos muestras PDF de factura ficticia (80 mm/A4), XML firmados y CDR
**simulados**, inspecciones, informe integral JSON, conciliaciones coincidente
y con diferencias, CSV neutralizado y LEEME. Las demás representaciones se leen
en memoria. Cada ejecución conserva sus propios resultados, no sobrescribe los
anteriores y nunca guarda una clave privada. El runner bloquea conexiones Node
HTTP/HTTPS/TCP/TLS/fetch y comprueba cero intentos y ausencia de clientes fiscales
o BD cargados. No es un sandbox para ejecutar código externo.

Python con `pypdf` y Poppler son dependencias locales del lector PDF. Actualmente
se fijan al runtime de este equipo en `PDF_RUNTIME`: un caller no puede sustituir
el ejecutable. Fuera de este equipo se debe preparar y revisar un runtime
equivalente, no pasar un comando arbitrario ni relajar los controles. **No se
instalaron estos lectores en contenedores ni se desplegó un endpoint nuevo.**

## 1. Lectura y comparación XML

`packages/evidence-core/src/xml.ts` ofrece `readSyntheticBusinessXml`,
`bindSyntheticBusinessXml` y `compareSyntheticBusinessXml`:

- Raíces y namespaces Invoice 01/03, CreditNote 07 y DebitNote 08, UBL 2.1.
- Identificador, día/hora Lima cuando esté representada, moneda y operación.
- RUC, razón social, nombre comercial, dirección fiscal, ubigeo y establecimiento.
- Identidad, razón social y dirección del cliente. Correo no se infiere del XML.
- Todas las líneas del perfil: orden, código, descripción, unidad, cantidad,
  valor/precio, afectación, tasa, bases, IGV, ISC, otros impuestos y descuento.
- Subtotales tributarios por esquema, suma exacta líneas/cabecera, totales
  monetarios y nueve importes del snapshot, sin números flotantes o tolerancias.
- Contado/crédito/cuotas y referencia/motivo de notas, leyenda y observaciones.

Lectura por hijos directos y cardinalidad; prefijos XML y formas decimales
equivalentes no generan falsas diferencias. DTD, entidades, comentarios, PI,
wrapping de firma, IDs duplicados, monedas inconsistentes, importes negativos,
fechas inválidas o estructuras ambiguas se rechazan. Límites: XML 1 MiB,
15.000 elementos, profundidad 32 y 100 líneas. La conciliación admite XML de
100 líneas mayores a 16 KiB sin cambiar el guard del historial.

**“Completo” se refiere a la proyección de negocio versionada implementada, no
a todos los elementos opcionales de UBL ni a todas las reglas SUNAT.** Nuevos
agregados (anticipos, cargos, descuentos globales, detracciones, percepción,
redondeos, etc.) requieren un mapeo versionado y fallan como no soportados.
Propiedad interna/origen, email, placa y metadatos de evidencia se contrastan
en snapshots o se reportan como no representados: no se inventan en XML. Hora y
operación ausentes se identifican explícitamente. Catálogos/metadatos de atributos
no constituyen validación fiscal. Leer una firma presente no la verifica.

No se inserta en `Document`, ni hay contador, Outbox, servicio SUNAT o conexión
en este paquete puro. La validación XSD y el gate fiscal existentes se mantienen
separados: coincidencia semántica no equivale a un XML oficial aceptado.

## 2. Bytes PDF y QR leído de píxeles

`migration/evidence-pdf.cjs` recibe únicamente buffers; el helper Python lee
metadatos/texto por stdin y Poppler rasteriza cada página por stdin/stdout.
`jsQR` decodifica imágenes PNG reales, con búsqueda por ventanas y enmascarado
para detectar ocurrencias múltiples/duplicadas. Un límite alcanzado deja la
completitud como desconocida, no como un QR único confirmado.

Se comparan texto normalizado, tamaños en micrómetros, píxeles rasterizados y
payloads QR; SHA de bytes diferentes por metadatos no es por sí solo diferencia
de contenido. El QR se vincula a diez campos y digest autenticado de cada XML.
La moneda no está en este formato QR y se verifica aparte en XML/texto.

También se vinculan bloques completos de texto al renderizador local:
cabecera, cliente, ítems, base/IGV/total, moneda y hash visible. Los saltos de
línea del hash no cambian sus caracteres. No se aceptan búsquedas por simple
substring, importes con dígitos adicionales o bloques ambiguos.

Se rechazan PDF cifrados, JavaScript, adjuntos, acciones, formularios, contenido
activo, streams de objetos/xref, filtros y geometrías fuera del perfil antes
de rasterizar. Límites: 4 MiB, 10 páginas, 8 millones de píxeles por página,
32 millones totales, tiempo de subproceso y búsqueda QR acotados. Un PDF legítimo
fuera de este perfil exige revisión; no habilitarlo quitando guards.

No acredita toda la semántica de un PDF ajeno, visibilidad de cada glifo,
equivalencia universal, impresión física o compatibilidad de todos los drivers.
Se reutiliza el PDF actual 80 mm/A4, independiente de marca de impresora.
Las pruebas no enviaron documentos a una impresora.

La revisión visual corrigió el exceso de espaciado A4 del renderizador local:
las operaciones simples del ensayo caben completas en una página conservando
resumen, QR y créditos juntos. El ticket de 80 mm no cambia y no se reescriben
representaciones ya archivadas. Se compara también una variante con sólo el
metadato Producer diferente: bytes distintos, mismo texto/píxeles/QR.

## 3. Firmas, certificados y CDR

`packages/evidence-core/src/crypto.ts` verifica XMLDSig RSA/SHA-256 con referencia
única al documento completo y transforms fijados. El certificado público se
proporciona externamente; KeyInfo no decide la autoridad. Se consumen sólo
referencias autenticadas y se comparan mediante canonicalización con el XML
esperado, evitando validar una firma y luego leer otra estructura no firmada.
Patrón recomendado por la [documentación de xml-crypto](https://github.com/node-saml/xml-crypto).

Contrato PKI sintético deliberadamente estricto: sujetos marcados FICTICIO/QA,
RUC `00000000xxx`, RSA 2048–4096, CA directa y raíz fijada mediante SHA-256 de DER,
firmas de raíz y hoja, fechas, identidad OID, basicConstraints y keyUsage.
Certificados reales no entran por cambiar una etiqueta. No se toma como confiable
un certificado incrustado ni se aceptan algoritmos/transformaciones arbitrarios.

El CDR sólo se lee después de autenticar su referencia; vincula SenderParty con
certificado, ReceiverParty con RUC, referencia y, cuando se exige, tipo 01/03/07/08.
Mismo serie/número de factura y nota no permite intercambiar sus CDR. Si un caller
no exige el tipo, `documentTypeBindingVerified=false` permanece explícito.
Se informan código y observaciones con estados `SIMULATED_*`, jamás aceptación
oficial. Se prueban aceptado, observado y rechazado simulados.

La cadena ficticia **no verifica revocación**, ni raíces oficiales, inscripción
SUNAT o autorización fiscal: `revocationStatus=NOT_CHECKED`, `officialTrust=false`.
Los componentes PKI/CDR oficiales existentes no se activan ni se configuran aquí.
Un caso con firma válida no se convierte en un caso con confianza oficial.

## 4. Conciliación y evidencia de revisión

`reconcileSyntheticEvidence` utiliza el contrato histórico completo existente:
identidades únicas fiscal/origen y propiedad de mapas, selección por RUC,
moneda/tipo/serie, totales exactos, secuencias y referencias fuera de selección.
No agrupa PEN/USD ni mezcla notas positivas con ventas netas o asientos.

Además de los grupos, compara cada documento y vincula ambos XML a su snapshot.
Documentos/archivos ausentes, diferencias de cliente aunque coincidan totales,
duplicados e XML inválidos siguen visibles. Hasta 200 ejemplos, con conteos
completos e IDs ligados a los valores completos. El hash de entrada liga cada
snapshot y SHA de los XML, incluido su orden. CSV con protección frente a fórmulas.

Informes de lectura, no resoluciones contables: `accountingApproved=false`,
`reviewRequired=true`, `cutoverAuthorized=false`, `fiscalWrites=0`, `outboxWrites=0`,
`countersChanged=false`. No tocar máximos/correlativos ni dueño de una serie.

## Integración y siguiente límite

Es un **laboratorio de código/CLI** separado del primer panel `/shadow-lab`.
No se cambiaron sus cuatro fixtures declarados ni se mostró evidencia nueva
como si proviniera de datos privados. No hay nuevos endpoints, permisos,
tablas, rutas Kong, colas, migraciones o despliegues.

Para la verificación real todavía hacen falta autorización/copia offline del
cliente, mapa de empresa–RUC–sede–punto–serie, datos/configuración del emisor por
su responsable, evidencia pública de confianza y conciliación aprobada. No se
han leído datos reales. El adaptador real no se habilita reemplazando SYNTHETIC.
La información solicitada a TI/Administración/Contabilidad sigue pendiente para
mañana; este incremento no requiere que compartan secretos hoy.

Ver [estado de migración](ESTADO_MIGRACION.md),
[límites históricos del primer comparador](ETAPA4_MODO_SOMBRA_LOCAL.md) y
[panel visual](ETAPA4_PANEL_VISUAL.md).
