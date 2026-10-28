# Formatos de impresión y logos por RUC/sede

Fecha: 2026-10-06. Incremento exclusivamente local/BETA.

**Diseño limpio instalado:** renderer v4, logo proporcionado, datos del emisor
agrupados, tablas suaves y visor adaptable. Ver
[revisión de espacios y verificación](IMPRESION_DISENO_LIMPIO_QA.md).

**Revisión anterior (v3):** siete variantes A4 ajustadas a
los modelos originales (incluidas NC de factura y NC de boleta, GR y GT).
Geometría, fuentes, columnas y orden de bloques revisados; no se copian datos
fiscales ni aceptación de las muestras. Evidencia y diferencias deliberadas en
[formatos de referencia QA](FORMATOS_REFERENCIA_QA.md). Los resultados numéricos
de la sección Verificación inferior corresponden a incrementos anteriores.

## Uso

Entrar como administrador general y abrir **Administración → Formatos y logos**
(`/print-settings`). Elegir el RUC y el ámbito: base del emisor o una de sus
sedes activas. No se registran empresas ni se reasignan sedes desde este módulo.

1. Seleccionar **Personalizar este RUC/sede**.
2. Elegir San José, logo personalizado o sin logo. Subir PNG, JPEG o WebP;
   máximo 256 KiB, imagen estática entre 8 y 4096 px por lado, hasta 4 megapíxeles.
3. Ajustar ancho solicitado (20–60 mm), alineación, dirección de sede y nota
   comercial (hasta 160 caracteres de texto plano).
4. En **PDF de prueba**, elegir documento y papel; generar, descargar o imprimir
   el PDF real. Los cambios del borrador se pueden revisar antes de guardar.
5. Guardar y confirmar el RUC/sede. La revisión impide sobrescribir otro guardado.
   **Heredar del RUC/Restablecer** conserva los archivos y revisiones anteriores.

La sede sin configuración propia hereda del RUC; el RUC sin configuración propia
usa la plantilla predeterminada San José. Un cambio en un RUC nunca se aplica a
otro. El visor usa blobs privados temporales, cancelación y revocación; no guarda
logos personalizados ni PDF fiscales en la caché de la PWA.

## Plantillas

| Código | Documento | Representaciones |
| --- | --- | --- |
| 01 | Factura | A4 y ticket de 80 mm |
| 03 | Boleta | A4 y ticket de 80 mm |
| 07 | Nota de crédito | A4 y ticket; referencia y motivo |
| 08 | Nota de débito | A4 y ticket; referencia y motivo |
| 09 | Guía remitente | A4 y ticket; origen/destino y transporte |
| 31 | Guía transportista (GT) | **Sólo plantilla/vista previa local**, sin emisión |

Diseño basado en las muestras entregadas: logo del emisor, recuadro RUC/tipo/número
con **fondo blanco, borde gris fino y texto oscuro** tanto en A4 como en ticket,
datos de cliente/documento, tabla de ítems y totales; bloques de transporte en
guías. A4 repite la cabecera de tablas al paginar; ticket mantiene ancho de 80 mm.
FactuEz y Mavric aparecen juntos al pie, con «Desarrollado e implementado por
www.mavrictec.com». No se copian QR/hash, resoluciones, aceptación SUNAT ni datos
del cliente desde los PDF de referencia. Se mantiene el logo rojo existente como
predeterminado: cualquier logo diferente se carga desde este módulo.

Impresión mediante el diálogo del navegador/lector PDF y el controlador del
sistema operativo: no hay dependencia de Xprinter. La impresión física y el
soporte del tamaño de papel deben verificarse en cada equipo/driver.

## Conservación e integración

Billing congela `factuez.print-presentation.v1` en nuevas emisiones locales
autorizadas: RUC, sede, revisión, configuración y PNG normalizado con SHA256.
La presentación congelada se conserva como contexto histórico. Al consultar
se combina el snapshot fiscal original con el diseño/logo vigente, sin
reemplazar los datos fiscales ni las direcciones históricas.
Las GRE QA nuevas obtienen una presentación autorizada por lectura privada a
Billing y la congelan en su payload.

**Cambio de política, 2026-10-05:** las representaciones operativas se generan
bajo demanda con caché temporal privada. El nuevo perfil se aplica al volver a
abrir un PDF, incluso de documentos anteriores. Los archivos históricos no se
reescriben ni se borran. Ver [PDF bajo demanda](PDF_BAJO_DEMANDA.md).

Los metadatos visuales se validan y mantienen fuera del UBL: pruebas comparan los
bytes/SHA del Invoice, CreditNote y DespatchAdvice antes/después. Se mantienen los
rechazos de campos financieros fuera del perfil. QR/hash sólo aparecen cuando el
circuito QA entrega evidencia verificada de un emisor ficticio; el preview no
finge firma ni CDR oficial. Todas las muestras están marcadas sin validez tributaria.

## Persistencia, seguridad y respaldo

No se añadieron migraciones. La configuración vive en el volumen privado de
Billing `PRINT_BRANDING_ROOT=/data/print-branding`:

- `profiles/`: punteros actuales por RUC y UUID de sede.
- `versions/`: revisiones append-only con responsable, fecha y acción.
- `logos/`: PNG normalizados, máximo 128 KiB, direccionados por SHA256.
- `locks/`: bloqueo entre procesos para guardado con CAS de revisión.

Compose demo/QA monta `factuez_print_branding`; la configuración de despliegue
principal monta `print_branding_data`. No son directorios públicos de Next.js ni
volúmenes de certificados. TI debe incluir este volumen en el respaldo, además
de las BD y artefactos. Detener guardados durante un respaldo/restauración y
verificar perfiles/logos/versiones juntos. La falta/corrupción del almacenamiento
falla cerrada; no se cae silenciosamente al logo predeterminado.

Un cierre abrupto durante un guardado puede dejar un lock. El sistema no elimina
locks automáticamente: TI debe comprobar que no existe escritor activo, respaldar
el volumen y recuperar el bloqueo concreto antes de reintentar. Nunca borrar el
volumen o revisiones para «arreglar» un conflicto.

JWT revalidado en Identity, permiso `setup.manage`, rol ADMIN y alcance GLOBAL
para configurar/preview. La lectura interna de snapshot exige `document.view` y
la sede asignada cuando corresponda. Sólo empresas BETA activas en el catálogo.
Sin SVG, URLs, rutas de archivo, HTML, imágenes animadas ni campos adicionales.
Validación de MIME/contenido, límites de descompresión/píxeles, normalización y
verificación PNG/SHA antes de representar.

## API y arquitectura

Kong conserva su ruta de estaciones hacia Billing:

- `GET /api/v1/stations/print-settings/:companyId?branchId=<uuid>`: estado.
- `POST` misma ruta: configuración visual con `expectedRevision`.
- `POST /:companyId/preview`: PDF ficticio; no consume números ni escribe BD/Outbox.
- `GET /:companyId/snapshot`: presentación congelable, lectura autorizada entre servicios.

La PWA no conoce rutas de almacenamiento ni credenciales. Se conservan
microservicios, propietarios de BD, BullMQ y los bloqueos de transmisión existentes.

## Verificación

- Regresión completa: **2.965 pruebas / 86 suites PASS**, ninguna omitida;
  incluye 12 comprobaciones nuevas del recuadro blanco/gris para 01/03/07/08/09/31
  en A4 y ticket. TypeScript del renderer modificado PASS.
- **15 proyectos TypeScript PASS**, más compilación de los paquetes modificados.
- **17 PDF ficticios renderizados**: seis tipos × dos papeles, 100 ítems,
  80 cuotas, logo personalizado y sin logo; sin texto fuera de página.
- Guías simples A4 en una página; tablas largas paginadas y cabeceras repetidas.
- Pruebas de herencia, RUC/sede, CAS, archivos corruptos, MIME, permisos, preview
  sin persistencia y conservación exacta del PDF archivado.

Despliegue QA verificado el 2026-10-05 en `factuez-stage2-qa`, mediante Kong:
`http://localhost:8091/print-settings` y `http://192.168.100.5:8091/print-settings`.
Se compilaron y recrearon únicamente Billing, Sunat y PWA; once contenedores
saludables y los ocho restantes sin recrear. El acceso de intranet se conserva.
El volumen visual nuevo está montado e inicializado; sus subdirectorios privados
tienen permisos 700. Seed desactivado y ambos gates de transmisión/workflow Beta
cerrados. Sin migraciones ni modificaciones de ventas, series o credenciales.

Auditoría runtime: cinco comprobaciones del módulo PASS (pantalla disponible y
cuatro operaciones API rechazadas con 401 sin autenticación), además de seis
GET de acceso/recursos públicos PASS. La prueba visual de selección, preview y
guardado se realizó con una identidad y un emisor **ficticios**, en el fixture
aislado; no demuestra un guardado autenticado en la BD/volumen del QA activo.
No se usaron credenciales reales para esta verificación.

Para comprobar los cambios: entrar como administrador, abrir Formatos y logos y
generar un PDF de prueba del tipo deseado. Si la pestaña conserva recursos
anteriores, recargar con Ctrl+F5. Los archivos PDF archivados conservan sus bytes,
pero el visor operativo vuelve a generarlos con el diseño vigente al abrirlos,
según la [política bajo demanda](PDF_BAJO_DEMANDA.md).

Corrección del recuadro blanco/gris también desplegada el 2026-10-05: sólo Billing
y Sunat recreados, once contenedores saludables y nueve sin cambios. Auditoría
`tests/print-header.runtime.audit.cjs --read-only-qa` PASS en ambos servicios:
renderer instalado con fondo blanco/borde gris de 0,8 pt/texto oscuro, sin el
recuadro negro anterior y con gates cerrados. Cinco checks del módulo PASS.
Las 17 muestras ficticias nuevas están marcadas sin validez tributaria y no
tienen texto fuera de página; revisión visual de A4/ticket y los seis tipos.

No se habilita producción, GT oficial, SOAP/REST SUNAT, OAuth ni correo real.
**No cierra los gates fiscales de etapas 2/3**.
