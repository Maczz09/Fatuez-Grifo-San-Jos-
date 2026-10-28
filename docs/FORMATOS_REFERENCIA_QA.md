# Revisión detallada de formatos San José

Fecha: 2026-10-06. Alcance: QA local/BETA, `factuez-stage2-qa`.

## Implementación instalada

Renderer `factuez.pdf-renderer.v3`, instalado en Billing y Sunat. El preview
administrativo y la consulta bajo demanda utilizan la misma versión. No se
modificaron XML, CDR, ventas, series, correlativos ni archivos archivados.

Se inspeccionaron las siete muestras originales entregadas por el cliente:

| Modelo | Plantilla A4 |
| --- | --- |
| 01 F179, factura | Tres parejas de datos; tabla de nueve columnas; desglose de operaciones; observaciones y seis filas adicionales |
| 03 B032, boleta con DNI | Estructura de venta; identidad del cliente determinada por el snapshot, no fijada como RUC |
| 07 F300, NC de factura | Documento referenciado, motivo/tipo de nota y seis filas adicionales |
| 07 B073, NC de boleta | Variante de boleta con placa y siete filas adicionales |
| 08 F300, ND | Diez columnas, incluyendo IGV y descuento; motivo y referencia |
| 09 T204, GR | Destinatario, partida/llegada, indicadores, bienes, vehículo/conductor y observaciones |
| 31 V250, GT | Remitente, MTC del emisor, indicadores de transporte y bloque propio del remitente; sólo preview local |

A4 de 595 × 842 puntos, margen de 20 puntos, Helvetica/Helvetica Bold de 7
puntos en el cuerpo y 16 en la cabecera. Se ajustaron anchos, rejilla completa,
orden de bloques y separación de cliente, productos, totales y observaciones.
Las cabeceras de tablas se repiten al paginar; códigos y descripciones largos
no se recortan. Los tickets mantienen 80 mm: son una adaptación, no una copia
geométrica de una página A4.

## Diferencias intencionales respecto de los originales

- Recuadro RUC/tipo/número blanco con texto oscuro y borde gris de 0,8 puntos,
  por solicitud expresa. No se restableció el fondo negro.
- Logo del perfil vigente por RUC/sede. El predeterminado sigue siendo el logo
  rojo disponible; un logo diferente se carga en **Formatos y logos**. No se
  reemplazó el logo de todos los emisores por el dibujo de una muestra.
- Datos fiscales y operativos proceden del snapshot histórico. Un cambio de
  diseño o logo no actualiza el cliente, la dirección histórica ni los importes.
- No se copian RUC, cliente, placa, aceptación SUNAT, resolución, firma, QR,
  hash o atribución Bizlinks desde las referencias.
- Los campos opcionales ausentes muestran un guion, no un dato inventado. Los
  totales registrados no se recalculan; los subtotales de presentación utilizan
  aritmética decimal entera sobre importes congelados, sin modificar el UBL.
- Advertencias LOCAL/BETA conservadas. El preview no acredita emisión fiscal;
  QR/hash sólo se usan con evidencia QA verificada y siguen siendo de prueba.
- FactuEz y Mavric juntos al pie, con el crédito solicitado. Sin colaboración
  ni nombre personal. La información complementaria aportada para las guías se
  conserva después de los bloques del modelo, aunque pueda requerir otra página.

## Verificación realizada

- Regresión final: **3.209 pruebas PASS / 95 suites, ninguna omitida**, con
  Python/lxml local configurado para incluir la comprobación XSD offline.
  La primera ejecución omitió una prueba por falta de esa ruta; se repitió
  tanto su suite (36 PASS) como toda la regresión. No hubo red SUNAT.
- Compilación TypeScript de contratos, renderer, Billing y Sunat PASS.
- 18 PDF ficticios generados, 30 páginas en total, sin caracteres fuera de
  página. Revisión visual de las siete variantes A4; muestras normales en una
  página, factura de 100 ítems en nueve, 80 cuotas en tres y GT de 100 ítems en tres.
- Auditoría de ambas imágenes instaladas: versión v3, geometría, bloques,
  ausencia de datos copiados y gates cerrados PASS. Siete representaciones A4
  ficticias generadas en memoria por servicio: 14 renders, una página cada uno.
- Auditorías instaladas de PDF bajo demanda/catálogos y recuadro blanco/gris
  PASS. Módulo de formatos disponible y cuatro operaciones anónimas denegadas
  con 401; no se guardó configuración ni se usaron claves reales.

El comparador semántico PDF de migración conserva su perfil anterior y sus
rechazos cerrados: este incremento de representación no acredita binding
semántico de PDFs v3 en fases 3/4 ni conciliación real. No se eliminaron guards
ni se sustituyó el perfil SYNTHETIC para permitir datos reales.

## Despliegue y uso

Se recuperó Docker y se iniciaron los contenedores QA existentes detenidos,
sin recrear sus volúmenes. Se recompilaron **sólo Billing y Sunat** con el helper
QA sobre sus dependencias instaladas, `--network=none`, lock y esquema idénticos.
Se desplegaron con `--no-deps --no-build --pull never`; no se ejecutó Compose
general, migradores, `db push`, importaciones ni cambios de permisos/TLS.

Imágenes: `:reference-formats-20261006`; retorno:
`:pre-reference-formats-20261006`. Once contenedores saludables; los nueve
servicios restantes conservan su ID. Login local/LAN 200; documentos, catálogo
de emisión, resumen y catálogo administrativo anónimos 401. Gates de transmisión
y workflow Beta permanecen cerrados; producción y correo real no se habilitaron.

Para probar sin emitir: **Administración → Formatos y logos → PDF de prueba**,
seleccionar tipo y papel. Para un comprobante previo, cerrar el visor PDF y
volver a abrirlo: se genera con la plantilla vigente y la caché privada temporal.
Un archivo descargado o impreso anteriormente no cambia retroactivamente.

Este incremento no cierra la fase 2 fiscal ni autoriza el corte de la fase 3.
