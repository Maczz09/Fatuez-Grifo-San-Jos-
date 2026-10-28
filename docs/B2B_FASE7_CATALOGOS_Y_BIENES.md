# B2B-07 — Referencias y clasificación local de bienes

22/10/2026. Cuarto bloque candidato, posterior al
[mapa de establecimientos](B2B_FASE7_MAPA_ESTABLECIMIENTOS.md).
**No desplegado. No cierra B2B-07 ni habilita SUNAT o traslados.**

Continuación posterior: [diario duradero de envío y recuperación](B2B_FASE7_DIARIO_ENVIO_GUIAS.md),
ensayado sólo con emulador local y sin acreditación de CDR oficial.

## Cambio implementado

El ensamblaje estricto del preparador 09/privado/04 deja de depender únicamente
de `regulatedGoods:false` declarado por la aplicación consumidora. Exige una
política vigente del RUC y productos identificados explícitamente en ella.

- Cada política contiene revisión del emisor, versión del catálogo de referencia,
  clasificaciones, fundamento, actor administrativo y hash de los metadatos del
  producto. Las revisiones anteriores y su auditoría no se sobrescriben.
- El catálogo local tiene unidades comerciales, unidades de peso y ubigeos
  habilitados, listas canónicas, URL de procedencia SUNAT y hashes. No hay listas
  de negocio ni clasificaciones predeterminadas; tampoco una descarga automática.
- El perfil acota cada referencia a 200 unidades, dos unidades de peso y 500
  ubigeos; no se presenta como el catálogo completo del país. Se aceptan hasta
  200 productos por política, 100 ítems por borrador y 128 KiB por entrada JSON
  al núcleo administrativo.
- La cantidad de productos del maestro no se modifica. `FuelProduct` sigue
  compartido: no se inventa una propiedad de RUC sobre ese modelo. La habilitación
  expresa para preparar guías pertenece a la política independiente de cada RUC.

Cada ítem debe coincidir exactamente con SKU, descripción y unidad del producto
actual. No se convierten unidades ni se interpretan textos libres como productos
aprobados. Producto faltante, inactivo, editado o no clasificado: operación
bloqueada. `REGULATED` y `UNKNOWN` también bloquean el perfil actual; una declaración
`false` en el borrador no puede anularlo.

No se deduce «no regulado» del nombre, categoría o código del producto. La
clasificación administrativa es una declaración local atribuible, **no una
determinación legal de IQBF/combustibles ni una licencia para transportarlos**.
Ese perfil regulado necesita reglas y autorizaciones específicas aún pendientes.

## Seguridad y concurrencia

La configuración se realiza mediante un núcleo administrativo interno con
autoridad humana GLOBAL, `setup.manage`, `series.manage` y verificación reforzada.
La autoridad la entrega un verificador propietario, nunca el JSON del consumidor.
No existe un administrador de respaldo ni se otorga este poder a un SERVICE.

Reemplazar requiere revisiones esperadas del registro y del emisor y huellas
exactas de los productos. Se revalida autoridad dentro de la transacción, también
después de las escrituras. Un cambio de permisos o fallo de auditoría revierte
la política. La cuota cuenta intentos fallidos sin guardar tokens o pares en claro.

El adaptador PostgreSQL usa Serializable, bloqueo del emisor, CAS, versión
append-only y auditoría atómica. Sólo reintenta conflictos de serialización
reconocidos; un fallo SQL absorbido por el callback no permite confirmar cambios.
El DDL aditivo es candidato: no se ejecuta al construir o iniciar servicios y
no modifica Prisma ni tablas fiscales existentes.

Retirar productos o vaciar la política crea otra revisión. Un maestro o emisor
editado se muestra obsoleto al administrador y necesita confirmación explícita;
no se actualizan huellas silenciosamente. Reutilizar la versión del catálogo
actual con contenido distinto se rechaza; una nueva referencia exige otra versión.
La identidad completa de una referencia es versión **y hash**, no sólo su etiqueta.

## Integración, sin publicación accidental

`createBillingGuideGoods` compone el registro con persistencia y autoridad
explícitas. `createBillingCataloguedGuidePreparation` exige ambos controles:
establecimientos y bienes. Si falta uno, no degrada al modo declarativo.

Se autoriza y lee el borrador antes de consultar políticas. El preparador vuelve
a comprobar borrador, emisor y vigencia de los dos registros antes de responder.
Estas comprobaciones son de preparación de sólo lectura, no una reserva atómica
para emitir. No crean una operación fiscal, un correlativo o un Outbox.

Las fábricas anteriores siguen disponibles por compatibilidad y no se presentan
como modo estricto. El contrato público v1 conserva todos sus gates y flags
cerrados: no se agrega una supuesta aprobación oficial o prueba fiscal al plan.
Un productor futuro debe construir su propio contexto fiscal verificado.

Este bloque no añade rutas HTTP, scopes ni cambios de grants, main/AppModule,
Kong, Swagger activo o interfaz de administración. La publicación administrativa
autorizada y el panel son parte de B2B-08; no debe conectarse el núcleo aceptando
actores o permisos declarados en el cuerpo.

## Qué no significa «catálogo versionado»

Una URL oficial declarada y un SHA correcto no verifican la descarga, la vigencia,
el contenido normativo ni la aceptación de SUNAT. El bundle está marcado
`LOCAL_REFERENCE_NOT_OFFICIAL`. El [portal GRE de SUNAT](https://cpe.sunat.gob.pe/node/116)
publica por separado reglas, XSL y XSD. Este bloque no descarga ni ejecuta el
paquete completo de reglas oficiales. No se aplica una actualización normativa
en caliente sin revisión y regresión.

## Verificación y siguiente trabajo

Pruebas sintéticas del catálogo, núcleo, adaptador y composición del preparador;
ensayo persistente exclusivamente en PostgreSQL NUEVO, etiquetado, sin red ni
puertos publicados y con almacenamiento temporal. Los resultados concretos se
registran en [verificación del bloque](B2B_VERIFICACION_CATALOGOS_2026-10-22.md).

Reproducción: `pnpm test:b2b-guide-goods` y `pnpm test:b2b-guide-goods:db`.
El segundo sólo acepta el modo sintético fijo; no recibe una URL de cliente.

Sigue pendiente B2B-07: paquete de reglas oficiales ejecutable/versionado y su
cobertura, productor fiscal de guías con reserva/journal atómicos, referencias,
perfil 31, firma/PKI y transporte/CDR; lotes RC/RA y recuperación de respuestas
ambiguas. Los datos y aprobaciones de despliegue del cliente permanecen separados.
