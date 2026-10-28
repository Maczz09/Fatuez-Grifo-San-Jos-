# Representaciones PDF bajo demanda — desarrollo Beta

Actualizado: 2026-10-06. No habilita producción ni cambia los gates fiscales.

Renderer vigente v4: [cabecera, logo y visor limpios](IMPRESION_DISENO_LIMPIO_QA.md).
La nueva versión invalida las entradas v3; un visor Blob ya abierto requiere
cerrarse y abrirse nuevamente. Los snapshots y los archivos fiscales no cambian.

## Política

Al descargar, visualizar o imprimir se genera una representación con el renderer
instalado y el perfil visual vigente del RUC/sede. Ya no se descarga el PDF
permanente generado al emitir una venta. El consumidor nuevo conserva el XML
local, pero no crea PDF permanentes de consulta al recibir el evento.

Los datos fiscales se toman exclusivamente del snapshot inmutable: RUC/razón
social, direcciones originales, cliente, ítems, fechas, serie, correlativo,
importes, impuestos, referencias y condiciones de pago. Del perfil actual se
toman sólo diseño, logo y nota comercial. La dirección/nombre actuales de la
sede no sustituyen los que quedaron registrados al emitir. No se firman XML de
nuevo ni se consume numeración al consultar.

Las facturas/boletas locales 01/03, notas QA 07/08 y GRE QA 09 usan la misma
política para A4/ticket. GT 31 continúa siendo únicamente una vista previa de
plantilla; no hay emisión fiscal de GT ni historial oficial de GT habilitado.
Los PDF mantienen sus advertencias LOCAL/BETA/simulado. Un QR de laboratorio
no prueba aceptación por SUNAT.

## Caché privada y actualización

- Sólo memoria del proceso de `sunat-service`, sin archivos ni claves en Redis:
  no se introduce persistencia accidental por Redis AOF/RDB.
- TTL 120 segundos; máximo 32 MiB, 64 entradas, 8 MiB por entrada y cuatro
  renders simultáneos. Un resultado de hasta 12 MiB puede entregarse sin
  cachearse si supera el tamaño por entrada; errores/saturación no se cachean.
- La clave SHA256 incluye versión del renderer, RUC/sede, documento/snapshot,
  formato, perfil visual efectivo completo y evidencia de firma/estado QA.
- Se comprueba autorización, snapshot y evidencia **antes** de cada hit; el
  perfil vigente se consulta sin caché antes de calcular la clave.
- Un cambio de logo, herencia, revisión o configuración crea una clave distinta,
  sin tener que esperar el TTL. No se cachean fallos ni respuestas de acceso.
- Reiniciar/recrear el servicio vacía su caché; actualizar el renderer requiere
  compilar/desplegar el servicio nuevo, no sólo editar su fuente.
- HTTP y la PWA no guardan PDF privados en una caché pública. Un visor ya abierto
  tiene su Blob anterior: cerrarlo y volver a abrirlo obtiene el formato vigente.

La política es sobre la siguiente solicitud, no una modificación remota de un
PDF que el cliente ya descargó/guardó o imprimió. En el correo QA, cada nuevo
envío obtiene el PDF vigente al preparar su tarea; los adjuntos de tareas ya
admitidas se conservan para reproducir los mismos bytes en reintentos.

## Conservación y seguridad

No se borran ni sobrescriben PDF anteriores, XML firmados, ZIP, CDR, registros
de entrega o evidencias históricas. Si se necesita eliminar PDF antiguos por
espacio, requiere inventario/respaldo y autorización aparte. Su conservación
ya no obliga a mostrar el formato anterior en el visor operativo.

Los maestros desactivados siguen disponibles para lectura de formato histórico
autorizada; no se permite configurarlos, emitir ni previsualizar operaciones
nuevas. Producción se rechaza en este servicio de representación local.

SUNAT distingue el documento electrónico y su representación impresa. El
diseño bajo demanda no sustituye las obligaciones de conservación, contenido,
QR, entrega y validación fiscal. Es una decisión técnica derivada de los
[requisitos del SEE del Contribuyente](https://cpe.sunat.gob.pe/sistema_emision/see_contribuyente)
y del [requisito de QR de la representación impresa](https://www.sunat.gob.pe/legislacion/superin/2018/309-2018.pdf),
no una certificación/habilitación fiscal de FactuEz.

## Actualización de formatos, 2026-10-06

`factuez.pdf-renderer.v3` está instalado en Billing y Sunat del QA. La versión
forma parte de la clave de caché; los PDF solicitados nuevamente utilizan las
siete variantes A4 revisadas sin reutilizar renders v2. No hubo modificaciones
de archivos históricos ni del snapshot. La caché sigue siendo sólo de memoria,
privada y temporal. Cerrar y reabrir un visor obtiene la nueva representación.

Ver [verificación y diferencias de los modelos](FORMATOS_REFERENCIA_QA.md).
Los resultados siguientes son evidencia histórica del cambio de política v2.

## Verificación

Pruebas de caché, regeneración de una misma boleta tras cambio visual, preservación
de snapshot, aislamiento por RUC/sede/formato/evidencia, denegación de acceso y
rechazo de producción. Muestras exclusivamente ficticias en
`tmp/qa-demand-pdf-20261005`, sin certificados reales ni transmisión externa.
**3.190 pruebas / 95 suites PASS**. TypeScript Billing/Sunat/PWA PASS y builds
Docker de los tres servicios PASS. Se generaron 14 muestras ficticias;
revisión visual representativa de A4, ticket y GRE, además de pruebas del renderer.

Desplegado en `factuez-stage2-qa`, `localhost:8091` e intranet
`192.168.100.5:8091`. Sólo Billing/Sunat/PWA recreados: once contenedores
saludables y ocho con el mismo ID. Tres auditorías del flujo instalado, dos
auditorías del recuadro blanco/gris y auditoría administrativa PASS.
Login local/LAN 200; documentos, dashboard y catálogo anónimos 401.

El build limpio habitual falló por timeout de descarga de paquetes. Se usó
`tests/Dockerfile.qa-source-rebuild` sobre las imágenes QA anteriores, con
`--network=none`, comparación exacta del lock y esquema Prisma del servicio,
y recompilación de las fuentes actuales. No se instaló nada, generó/migró BD,
cambió TLS o abrió acceso. Se conservan imágenes de retorno
`:pre-demand-pdf-20261005`. El helper no sustituye el build limpio habitual.

No se hizo un guardado autenticado con credenciales reales en el QA activo:
la prueba de cambio de perfil y representación usa datos ficticios. Ninguna
consulta de visualización escribe XML/CDR, snapshots o correlativos.
