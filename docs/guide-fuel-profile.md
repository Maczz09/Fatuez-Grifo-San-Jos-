# Configuración y alcance del perfil de combustibles

## Uso por el cliente

En **Administración → Configuración de guías**, seleccione el emisor y complete:

1. **Emisor**: remitente, transportista o ambos.
2. **Productos**: nombre exacto del combustible, tipo Combustible y unidad. El perfil implementado admite LTR y GLL. El peso bruto se declara por separado en KGM/TNE; nunca se calcula a partir del volumen.
3. **Rutas**: partida, llegada, direcciones y UBIGEO. Para traslado interno privado, ambos establecimientos SUNAT deben estar declarados y ser diferentes.
4. **Combustibles**: pulse Preparar perfil, declare el registro de hidrocarburos y seleccione la familia de cada combustible. Para cada ruta, declare régimen, modalidad, motivo y si requiere SCOP.

Al cambiar el conjunto de productos o rutas, pulse **Actualizar productos y rutas del perfil**. No se pierde la selección de los identificadores que continúan existiendo. El servidor rechaza referencias huérfanas, incompletas o duplicadas. Los datos anteriores siguen siendo legibles sin esta extensión.

**Datos completos para revisión técnica** significa que las declaraciones cubren un perfil implementado. No significa clasificación legal verificada ni autorización de emisión. Cada cambio se guarda con revisión y auditoría; un conflicto exige revisar la versión guardada antes de reenviar.

## Casos implementados

| Perfil | Documento | Modalidad y motivo |
| --- | --- | --- |
| GRE09_FUEL_PRIVATE04_SCOP_V1 | Remitente 09 | Privado 02, traslado entre establecimientos 04 |
| GRE09_FUEL_PUBLIC01_SCOP_V1 | Remitente 09 | Público 01, venta 01 |
| GRE31_FUEL_PUBLIC_SINGLE09_V1 | Transportista 31 | Público, una GRE remitente electrónica aceptada, traslado total y flete pagado por remitente |

Los tres corresponden exclusivamente a **GRE ordinaria para combustible con SCOP**, carga sin mezcla con otros bienes y un SCOP por guía. Se mantienen los requisitos de identidad, emisor, sede, serie, destinatario, conductor, vehículo y fechas del perfil estructural correspondiente. No se habilitan importación/exportación, subcontratación, múltiples guías de referencia, cargas mixtas ni casos sin SCOP mediante estos perfiles.

La familia comercial por sí sola no determina si un traslado está sujeto al régimen de bienes fiscalizados. La clasificación depende del producto y del recorrido y debe revisarla el responsable del emisor. Una ruta marcada **GRE de bienes fiscalizados** queda explícitamente fuera del envío GRE ordinario. La emisión GRE-BF requiere su sistema específico de SUNAT; no se implementa ni simula una API GRE-BF en este cambio.

## SCOP de cada operación

El formulario de empresa guarda la exigencia de SCOP; **no guarda un SCOP fijo**. El productor autorizado que construye la operación debe aportar en `body`:

```json
{
  "fuel": {
    "schemaVersion": "factuez.fuel-guide.v1",
    "regime": "ORDINARY_GRE",
    "scopCode": "000123456789"
  }
}
```

Ejemplo exclusivamente sintético. Este bloque acompaña los demás campos obligatorios del cuerpo; no es por sí solo una solicitud de emisión. El código se conserva como texto, incluidos ceros iniciales, y admite de 1 a 20 caracteres ASCII alfanuméricos. Su validez de formato no consulta ni acredita autorización real de OSINERGMIN.

En la **09** se escribe `cac:AdditionalDocumentReference` con `cbc:ID`, `cbc:DocumentTypeCode` **81**, descripción SCOP y atributos de **catálogo 61**. No se usa el catálogo 12 de facturas. En la **31** no se agrega un documento 81: se vincula la 09 aceptada y se conserva SCOP en la proyección autenticada. Cambiar SCOP, bienes, peso, fechas, remitente, destinatario o ruta rompe ese vínculo y se rechaza. El PDF muestra SCOP y, en la 31, aclara que pertenece a la GRE remitente.

`regulatedGoods: false` permanece obligatorio en los cuerpos estructurales: este perfil excluye el circuito GRE-BF, aunque el combustible esté sujeto a otros controles. La extensión `fuel` identifica combustible y nunca permite convertir un bien fiscalizado en mercadería general.

## Instalación del almacenamiento

Antes de ejecutar la nueva versión, aplique en la base Billing revisada `services/billing-service/prisma/guide-operational-settings.sql` y después `services/billing-service/prisma/guide-fuel-settings.sql`. El segundo script amplía únicamente el CHECK del JSON para aceptar `fuelProfile`; conserva las filas, revisiones, FK y auditorías. Ambos son repetibles y no se ejecutan al arrancar la aplicación. El exportador de esquemas para instalación nueva incluye ambos. Instalar solo el código con la restricción anterior provoca que PostgreSQL rechace el guardado del perfil.

## Aprobación técnica del servidor

Las declaraciones del cliente no crean concesiones ni catálogos aprobados. El operador debe revisar producto/ruta y preparar el catálogo bajo el hash de la concesión:

- Bienes de combustible con `classification: "FUEL_SCOP"`, código, descripción y unidad exactos.
- Cada ruta cubierta con `fuelRegime: "ORDINARY_GRE"`, partida y llegada exactas.
- Vehículos y conductores revisados cuando correspondan.
- Concesión vigente que incluya expresamente el nuevo perfil, ligada al emisor, actor, sede, punto, serie, revisión de credenciales, certificado y hashes de reglas/XSD.

El catálogo anterior `NON_REGULATED` no autoriza un perfil de combustible. Añadir perfiles a la lista de capacidades no activa una concesión ni los flags productivos. Los módulos productivos necesitan su composición real en el servidor; que existan las clases o compile el proyecto no demuestra que la instalación del cliente las esté ejecutando. La pantalla de configuración sí se registra en el módulo Billing nativo.

El ciclo conserva firma XMLDSig, ZIP, SHA-256, OAuth, envío, ticket, consulta y autenticación de CDR/QR. No se modifica la confianza del certificado ni se omiten revocación o controles de CDR. La instalación debe verificar esos bloqueos separadamente. Este paquete no contiene certificados, contraseñas ni credenciales del cliente.

## Fuentes y comprobaciones

- [Portal técnico GRE de SUNAT](https://cpe.sunat.gob.pe/node/116).
- [Validaciones GRE publicadas al 06/11/2026](https://cpe.sunat.gob.pe/sites/default/files/2026-11/ValidacionesGREv20261106_publicacion_v1.0.xlsx), descargadas el 25/11/2026; SHA-256 `5e1aed6df969afafca284e1cda228d36336ebf1ac31ea84f877f8170f584ec01`. Hoja Catálogos, fila 283: 81, solo remitente. Hoja Guía-Remitente2_0, filas 45, 63–65 y 76: descripción, atributos de catálogo 61 y formato SCOP.
- [Anexos de la RS 123-2022](https://www.sunat.gob.pe/legislacion/superin/2022/anexo-123-2022.pdf).
- [Sistema de guía de bienes fiscalizados](https://cpe.sunat.gob.pe/tipos_de_comprobantes/guiadebienesfiscalizados).

Las pruebas nuevas usan certificados efímeros y XSD oficial fijado, PostgreSQL aislado y navegador con API simulada. Verifican firma e integridad, clasificación bajo catálogo, proyección 09/31, validación y persistencia. No equivalen a ejecutar todas las reglas XSL SUNAT ni a una aceptación real; no se hizo ningún envío oficial.
