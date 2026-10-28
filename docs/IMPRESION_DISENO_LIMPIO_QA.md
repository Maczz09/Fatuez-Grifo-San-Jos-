# Impresión: diseño limpio y adaptable

Fecha: 2026-10-06. Alcance: desarrollo local/BETA, proyecto `factuez-stage2-qa`.

## Resultado

Renderer `factuez.pdf-renderer.v4`. Conserva las siete variantes de los modelos
entregados: factura, boleta, NC de factura, NC de boleta, ND, GR y GT. Este
incremento adapta deliberadamente los espacios; no promete identidad de píxeles
con los originales. No copia su RUC, clientes, resolución, aceptación o QR.

- Logo y datos del emisor agrupados en la columna izquierda. El logo mantiene
  su proporción, sin deformar ni recortar una imagen personalizada. El ancho
  configurado es un objetivo: se limita al espacio disponible y a una altura
  máxima de 52 puntos en A4 y 58 en ticket.
- Recuadro fiscal blanco, borde gris de 0,8 puntos y tipografía proporcionada.
  Su altura se calcula con el contenido; no se fuerza el enorme bloque anterior.
- La razón social no se duplica cuando coincide con el nombre comercial.
  Cabeceras muy largas vuelven a filas paginables: no se descartan direcciones
  ni textos por encajar en la cabecera.
- Tablas con bordes grises suaves, relleno de cabecera claro, margen interior
  de 3 puntos y texto centrado verticalmente. Cabecera mínima de 26 puntos;
  filas de ítems de al menos 18. Descripciones y códigos largos se envuelven.
- Visor shadcn/Radix con altura dinámica, márgenes exteriores, vista previa
  flexible y botones separados. Las indicaciones completas de papel e
  impresión están en una ayuda desplegable. Se reutiliza en Formatos y logos.
- El PDF se recupera con la sesión y se presenta con una URL Blob temporal.
  `FitH` sugiere ajustar al ancho; su interpretación depende del lector PDF.
  Se conservan validación del archivo, cancelación, límite de tamaño y limpieza
  de la URL al cerrar o perder la sesión.

## Datos e historial

RUC, cliente, ítems, importes, impuestos, fecha y numeración proceden del snapshot
inmutable. El diseño y logo actuales se aplican al consultar, con caché temporal
en memoria. La versión v4 forma parte de la clave y no reutiliza la caché v3.
Cerrar y volver a abrir un PDF ya abierto recupera la representación actual.
No se modifican XML, CDR, firmas, correlativos, maestros ni archivos históricos.

## Verificación

- 3.219 pruebas / 95 suites PASS, sin omisiones, con XSD offline.
- Compilación de contratos, renderer, Billing, Sunat y Next.js; tipos válidos.
- 18 PDF ficticios, 31 páginas; ningún carácter fuera del papel. Revisión
  visual de los siete A4, variantes con/sin logo y finales de documentos largos.
- Casos automatizados con logos cuadrados, verticales y panorámicos en A4 y
  ticket; dirección extensa sin truncamiento y nombres duplicados.
- Prueba del modal usando una boleta exclusivamente en memoria del simulador
  de interfaz, sin leer ni registrar ventas de la BD QA. Móvil de 390 × 844 y
  tableta de 768 × 1024; sin desbordamiento horizontal, ayuda desplegable y
  botones accesibles. El tamaño temporal del navegador se restaura al terminar.
- El navegador integrado de la herramienta no muestra su lector PDF nativo:
  esta prueba comprueba el contenedor, no la visualización interna del plugin.
  Los bytes PDF se renderizan y revisan por separado; no se afirma haber
  comprobado una impresión física ni todos los lectores o impresoras.
- Auditorías de los servicios instalados: 14 renders ficticios en memoria,
  generación bajo demanda, perfil protegido y bloqueos fiscales conservados.
- Once contenedores saludables. Actualizados únicamente Billing, Sunat y Web;
  los otros ocho mantienen sus IDs. Acceso local/LAN HTTP 200; las rutas API
  protegidas mantienen HTTP 401 sin sesión.

Muestras y capturas de revisión: `tmp/qa-print-formats-clean-20261006/` (no se
publican ni constituyen documentos fiscales). Imágenes instaladas:
`factuez-stage2-qa/{billing-service,sunat-service,web-pwa}:clean-layout-20261006`.
Se conserva el tag de reversión `pre-clean-layout-20261006` de cada servicio.
Despliegue limitado a esos servicios con `--no-deps`, sin migraciones.

## Límites

GT sigue siendo una representación de prueba, no un traslado autorizado.
Producción y transmisión/workflow Beta oficial siguen bloqueados. No se usa
ningún certificado real ni correo externo. La verificación semántica PDF del
comparador histórico no se adapta automáticamente a este diseño: conserva su
rechazo seguro hasta una revisión explícita. Este incremento no cierra las
fases fiscales o de migración 2/3/4.
