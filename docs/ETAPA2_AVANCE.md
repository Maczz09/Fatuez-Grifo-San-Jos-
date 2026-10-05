# P2 - Representaciones locales y descarga autorizada

Actualizado: 1 de octubre de 2026. Primer incremento de P2, no cierre fiscal de la etapa.

## Implementado

- Ticket PDF de 80 mm y PDF A4 para facturas (01) y boletas (03), desde el
  snapshot inmutable. No se consultan maestros actuales para reemplazar RUC,
  razón social, cliente, precios o importes históricos.
- Logo San José en cabecera. FactuEz y Mavric juntos encima del pie exacto:
  **Desarrollado e implementado por www.mavrictec.com**. Sin nombre personal ni
  frase de colaboración, incluyendo metadatos PDF.
  Los originales se conservan; San José se presenta con el mismo recorte visual
  utilizado en la PWA. La conversión WebP a PNG es sólo para compatibilidad PDF.
- Dashboard: San José y bloque de marcas en cabecera, visible al entrar:
  logos FactuEz/Mavric y **Desarrollado e implementado por www.mavrictec.com**.
  Sin frase de colaboración ni nombre personal. Se retira el antiguo
  bloque que sólo aparecía al final de la tabla. Componentes shadcn conservados.
- Sidebar: Mavric al costado de FactuEz en el pie, sin alterar el menú ni los
  permisos. El bloque se oculta al contraer a iconos, igual que el logo anterior.
- Acceso: ambos logos y créditos en el panel izquierdo; también disponibles en
  pantallas pequeñas debajo del formulario.
- Presentación inicial con San José y ambas marcas, una sola vez por
  carga completa (1,8 segundos), sin añadir esa pausa al navegar dentro de la app.
  El formulario queda `inert` durante esa presentación, sin cambiar JWT,
  autenticación, permisos ni envío de documentos. La espera de rutas Next.js
  reutiliza el mismo diseño. Animación compatible con movimiento reducido.
- `packages/pdf-renderer`: librería de representación, sin acceso a BD ni
  credenciales. Tipografía Inter estática incrustada, texto español, descripciones
  largas, importes decimales sin recálculo, saltos de página y encabezado repetido
  en tablas A4. Totales/advertencias/créditos se mantienen juntos al finalizar.
- SUNAT-service: el worker BullMQ prepara XML sin firmar y ambos PDF, conserva
  archivos privados con nombres ligados a SHA-256 y registra sus metadatos en
  su propia BD. Escrituras temporales/atómicas, límites de tamaño, protección
  de rutas y verificación de checksum antes de entregar.
- Billing: `GET /api/v1/documents/:documentId`, protegido por `document.view`,
  JWT vigente y alcance de sede, punto y UUID de serie. ID inexistente o ajeno
  devuelve 404 sin revelar el emisor.
- SUNAT-service: `GET /api/v1/fiscal-artifacts/:documentId/ticket|a4`, publicado
  por Kong. Revalida cada descarga mediante la API de Billing, que comprueba
  revocación en Identity. No comparte Prisma Clients ni consulta la BD de otro
  servicio. Bearer sólo en header, nunca en URL. Falla cerrado si Billing cae.
- Respuesta PDF `private, no-store`, `nosniff` y nombre con RUC/tipo/serie/número.
  Nunca publica rutas del disco, certificados, claves ni artefactos arbitrarios.
- `/documents/[id]`: detalle, totales, estado, descarga ticket/A4 y regreso al
  listado. Acceso desde el POS confirmado y desde el número de la tabla.
- Replay de evento no degrada documentos firmados/enviados/aceptados a BUILDING
  ni reemplaza el snapshot fiscal por un payload diferente.
- Descargas de PDF locales: se verifica primero checksum del archivo archivado
  y coincidencia completa del snapshot entre Billing/SUNAT-service. Se renderiza
  el pie actualizado para descargar/reimprimir, sin sobrescribir originales,
  cambiar correlativos ni reencolar emisiones. Documentos fiscales se bloquean.
- Configuración segura por RUC/ambiente: ver [CONFIGURACION_SUNAT.md](CONFIGURACION_SUNAT.md).
  Es el siguiente incremento P2; no habilita firma o transmisión.

## Límite fiscal explícito

Los PDF de este incremento dicen **DOCUMENTO LOCAL DE PRUEBA / SIN VALIDEZ
TRIBUTARIA / NO ACEPTADO POR SUNAT**. No fabrican firma, hash, QR normativo ni CDR.
Que el ambiente del emisor sea BETA o PRODUCTION no activa la transmisión.
La descarga de esta plantilla local se bloquea si el documento ya pasó a un
estado firmado/enviado/terminal; entonces requiere la futura representación fiscal.

La representación local no sustituye la emisión electrónica. El circuito fiscal
de boletas debe contemplar resúmenes y sus CDR, no asumir el transporte de una
factura individual: [SEE del contribuyente](https://cpe.sunat.gob.pe/sistema_emision/see_contribuyente)
y [boleta electrónica](https://cpe.sunat.gob.pe/tipos_de_comprobantes/boleta).

## Pruebas y puesta a disposición

```powershell
pnpm typecheck
pnpm test
pnpm test:stage1
pnpm test:stage2
pnpm qa:pdf
node tests/qa-pdf.mjs --local-only --long
```

`tests/verify-pdf.py` requiere pypdf/pdfplumber y comprueba los cuatro casos:
créditos, texto español, logos, ancho real, último ítem y texto dentro del papel.
Se revisan también las páginas renderizadas mediante Poppler. Los ejemplos
`output/pdf/boleta-*-PRUEBA.pdf` llevan RUC **00000000000**, exclusivamente ficticio;
no se registran en ninguna BD ni se transmiten.

Entorno integrado separado del demo existente:

```powershell
docker compose -p factuez-stage2-qa -f docker-compose.demo.yml -f tests/compose.stage2.qa.yml up -d --build --wait
$env:FACTUEZ_TEST_URL = 'http://127.0.0.1:8091'
pnpm test:stage1:e2e
pnpm test:stage2:e2e
```

Requiere los secretos de demo existentes, sin cambiarlos ni imprimirlos.
Publica Kong sólo en `127.0.0.1:8091`. Identity, Billing, SUNAT, Redis y PostgreSQL
permanecen en una red interna sin Internet; sólo Kong tiene la red de entrada.
Imágenes y volúmenes usan el proyecto **factuez-stage2-qa**, no factuez-demo.
No ejecutar estas pruebas contra una instalación productiva.

P1 E2E crea recursos rotulados PRUEBA y desactiva cuentas temporales al terminar;
conserva documentos por trazabilidad. P2 E2E verifica factura y boleta, misma
clave idempotente, detalle, rechazo sin sesión y PDFs por Kong. Comprueba el
retorno asíncrono PROCESSING en Billing (BUILDING interno en SUNAT-service),
con descripción de preparación local y transmisión fiscal deshabilitada.
Los documentos E2E se guardan únicamente en la BD aislada, no en el demo 8080.

### Evidencia del 1 de octubre de 2026

- TypeScript correcto en todo el monorepo; PWA compilada con Next.js en Docker.
- 81 pruebas automatizadas aprobadas: contratos/core 16, P1/multi-RUC 25, P2 17,
  configuración fiscal 18 y marcas/inicio 5. Estas últimas verifican SSR, logos, frase exacta,
  enlace seguro, variantes de tema y bloqueo `inert` del formulario inicial.
- P1 E2E aprobado sobre PostgreSQL/Redis/servicios reales del proyecto QA.
- P2 E2E aprobado para boleta y factura: idempotencia, acceso protegido, ticket
  y A4 por Kong, retorno PROCESSING local y transmisión deshabilitada.
- Ocho PDF revisados: cuatro fixtures (normal y 100 ítems) y cuatro descargados
  desde el Compose aislado. Medidas, tres logos (San José/FactuEz/Mavric), créditos sin nombre, importes,
  texto español y límites de página comprobados; revisión visual con Poppler.
  `tests/verify-pdf.py --e2e` también verifica los archivos descargados.
- Dashboard real de QA: acceso con la cuenta existente, San José en cabecera,
  Mavric y crédito de implementación visibles. No se modifican credenciales de acceso.
- QA visual de marcas actualizada en 8091: presentación inicial capturada,
  retirada automática y formulario utilizable; FactuEz/Mavric juntos en el
  acceso, sidebar y cabecera del dashboard. Frase de implementación visible
  sin bajar al pie; logos cargados y sin desbordamiento horizontal del documento.
  Sólo se reconstruyó/reinició web-pwa del proyecto QA, no se migraron bases.
- Incremento de configuración fiscal: web/SUNAT-service QA reconstruidos, Kong QA
  actualizado y expansión aditiva respaldada en SUNAT QA. E2E de configuración
  aprobado; cifrado verificado en BD sin volcar secretos, dos eventos de auditoría
  y cero envíos/CDR. No se modifica la configuración fiscal del RUC real.
- Reimpresión autenticada de una boleta QA anterior: pie actualizado sin nombre,
  originales conservados, snapshot y correlativo intactos; no se reencola emisión.
- Detalle real en PWA: RUC, ítems, base S/39.19, IGV S/7.06 y total S/46.25
  correctos. El click de descarga no mostró errores, pero el navegador integrado
  no entregó un evento de archivo guardado; no se considera validado ese paso.
  Los cuatro PDF sí se descargaron y verificaron por HTTP autenticado a través
  de Kong. Confirmar guardado/impresión en Chrome o Edge de la terminal.
- Demo anterior 8080 y QA 8091 saludables en proyectos/volúmenes separados.
  No se ha ensayado todavía el corte de los datos históricos del demo anterior.

## Pendiente antes del corte de la instalación anterior

1. Respaldo y ensayo completo de P1/multi-RUC sobre una copia del demo anterior.
2. Aplicar las expansiones SQL documentadas antes de reemplazar las imágenes de
   la instalación con datos. `db push` no es el procedimiento para migrarla.
3. Regeneración controlada de PDF locales históricos que sólo tienen XML.
   Reencolar una emisión nueva no es válido: no consumir nuevos correlativos ni
   reenviar comprobantes para generar una representación. Por ahora, si falta
   un artefacto, la descarga responde 409; los nuevos documentos sí lo generan.
4. Prueba física de impresión a tamaño real, sin ajustar, en la ticketera de pista.

## Laboratorio criptográfico local implementado

Validación aritmética de un perfil acotado 01/03, fecha Lima, XMLDSig verificada
con certificado externo y ZIP privado ya integrados en QA. Resultado independiente
del estado SUNAT, sólo para emisores/certificados ficticios. No habilita producción.
Ver [flujo, límites y pruebas](ETAPA2_FIRMA_LOCAL.md).

## Siguiente incremento P2

Se implementó el circuito SOAP/CDR **simulado** con BullMQ/PostgreSQL,
RC QA firmado, gate XSD oficial versionado antes del encolado/envío,
y PDF QR/hash de prueba. Uso y límites en
[ETAPA2_CIRCUITO_QA.md](ETAPA2_CIRCUITO_QA.md). No cierra la etapa fiscal.

La configuración segura y el laboratorio de firma/ZIP ya están implementados;
quedan validación de cadena/registro/RUC del certificado, UBL completo por perfil,
reglas SUNAT versionadas y extensión del gate XSD QA al circuito fiscal,
uso fiscal del circuito de firma/ZIP,
adaptadores y CDR, RC/RA, estados y reintentos
sin duplicar envíos, QR/hash auténticos y representación fiscal. Correo con
adjuntos oficiales y WebSockets siguen pendientes. Notas 07/08 y GRE 09 todavía
no tienen formulario ni representación operativa; reutilizarán cabecera/pie común
cuando se implemente su contenido específico. No activar producción sin piloto,
conciliación y validación normativa vigente.
