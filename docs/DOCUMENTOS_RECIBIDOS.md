# Documentos electrónicos recibidos de proveedores

Fecha: 07/10/2026. Recepción manual y automática implementadas; verificadas en QA local.
No cierra las fases fiscales 2/3 ni habilita producción.

## Uso en la aplicación

1. Entrar en `http://localhost:8091/received` con una cuenta autorizada.
2. Elegir la empresa **receptora** en el selector RUC. La vista Negocio no mezcla
   emisores ficticios de Laboratorios QA. Usuarios asignados deben elegir su sede.
3. Administración general puede importar XML o ZIP. El destinatario del XML debe
   coincidir con el RUC seleccionado; cambiar la cabecera del XML no es una solución.
4. Abrir **Ver detalle**: proveedor, receptor, fechas, moneda, ítems completos
   proyectados, cantidades, códigos, precios, descuentos/cargos, impuestos,
   cuotas, vencimientos, referencias y advertencias.
5. Descargar XML original, PDF original del proveedor y CDR adjunto; el PDF de
   lectura se genera a petición y no sustituye ningún original.
6. Exportar a Excel: hojas Cabeceras e Items. Los decimales se mantienen como texto
   exacto, sin convertirlos a números flotantes ni fórmulas provenientes del XML.
7. En **Recepción automática**, Administración global configura SIRE y/o IMAP
   por RUC. TI habilita por separado las lecturas externas. En QA sólo se ejecutan
   fixtures ficticias; no se consulta SUNAT ni un buzón real.
8. Marcar registro interno indicando la referencia contable/ERP. Esta operación
   queda auditada, no escribe en un ERP ni modifica el estado fiscal.

**No consultado** es el único estado SUNAT de esta vertical. `ResponseCode=0`,
una firma presente, un SHA-256 coincidente o un CDR adjunto NO acreditan por sí
solos aceptación, autenticidad, confianza PKI ni habilitación del emisor.

## Arquitectura y persistencia

PWA con componentes shadcn -> Kong `/api/v1/received-documents` ->
`received-documents-service` NestJS -> PostgreSQL propio de recepción.
Identity valida permisos vigentes y Billing proporciona el catálogo autorizado
en cada solicitud. No se comparten tablas de ventas ni se crea Outbox, correlativo,
emisión ni envío fiscal SOAP/REST. Un worker BullMQ independiente consulta SIRE
en modo de lectura y recibe adjuntos por IMAP cuando TI autoriza esos canales.
OAuth SIRE sólo se solicita dentro del conector autorizado; no se reutilizan
credenciales GRE ni se envían correos desde este módulo.

Originales en BYTEA con SHA-256, longitud y metadatos. XML, ítems, original y
auditoría se guardan en una transacción. Clave única: RUC receptor + RUC proveedor
+ tipo + serie + correlativo normalizado. Mismo documento/bytes/sede es idempotente;
distintos bytes o sede con la misma clave requieren conciliación y no sobrescriben.
Los adjuntos y las marcas administrativas también quedan auditados.

El PDF de lectura usa caché temporal de proceso (TTL 120 segundos, límites de
memoria y concurrencia). Cada acceso se reautoriza antes de consultar la caché;
su clave incluye ID, proyección y versión del renderer. Un cambio de plantilla
debe incrementar `received-reading-v1` en el controlador y desplegar la versión.
Los originales nunca se regeneran ni alteran al actualizar un formato.

## Formatos y límites

Lectura UBL Invoice 01/03, CreditNote 07, DebitNote 08, DespatchAdvice 09/31;
lectura de identidad/referencias de Perception 40 y Retention 20. Los dos últimos
no se convierten en líneas de venta. Campos no proyectados permanecen en el XML
original y se señalan en advertencias; no se afirma cobertura universal del UBL.
No se ejecuta validación XSD, verificación matemática/PKI ni consulta SUNAT aquí.

XML UTF-8, máximo 2 MiB; archivo subido máximo 4 MiB; 10 archivos y 12 MiB por
solicitud. ZIP plano, sin carpetas, anidados, enlaces ni cifrado; máximo 100 entradas,
16 MiB expandidos, ratio 200 y CRC/tamaños comprobados antes de persistir.
Se rechazan DTD, entidades, XInclude, referencias externas y documentos ambiguos.
PDF del proveedor: control de cabecera y tamaño, **no análisis antivirus ni
validación estructural completa del PDF**; se entrega como descarga, no HTML.
Para adjuntar CDR en ZIP, debe contener solamente un XML CDR. En importaciones
de pares, el nombre fiscal del adjunto debe asociarlo inequívocamente al XML.

Exportación acotada a 1.000 documentos/10.000 ítems. Adjuntos: máximo 20 por
documento, con bloqueo transaccional por fila. No hay borrado de originales.

## Permisos vigentes

Consulta: `report.view`; descargas y Excel: `report.export`; importaciones,
adjuntos y registro interno: `setup.manage`. Los permisos se comprueban en el
servidor, no sólo en botones. Usuarios asignados nunca leen documentos sin sede
o de otras sedes; una empresa que deja de estar en el catálogo no queda autorizada
por un ID o por una caché anterior. Actualmente sólo empresas BETA.

## Verificación efectuada

- 171 pruebas focalizadas del módulo aprobadas, incluyendo componentes SSR,
  archivos peligrosos, base64 de 4 MiB, namespaces, fechas, XML/ZIP/CDR,
  precisión de datos, filtros, alcance vacío, Excel sin fórmulas y PDF.
- Circuito HTTP + PostgreSQL: 36 comprobaciones aprobadas. Sólo documentos
  ficticios en la nueva `factuez_received_qa`, sin escrituras en Billing.
- Bandeja y detalle revisados visualmente con fixture ficticio independiente.
- PDF ficticio de 15 ítems renderizado y revisado en sus cinco páginas.
- PWA y microservicio compilados, contenedores saludables; Kong devuelve 401
  al intentar acceder a recepción sin autenticación.

La primera regresión general tuvo un timeout de 5 segundos en una prueba previa
de conciliación de 100 líneas. Esa prueba pasó aislada; la regresión con dos
workers/timeout 30 segundos pasó 3.670 pruebas en 105 suites, con una prueba
preexistente omitida. La regresión final, incluida la suite de repositorio, pasó
3.674 pruebas en 106 suites, con una prueba preexistente omitida.
Después se añadieron dos casos de retención/percepción, ambos aprobados.

## Despliegue QA reproducible

Combinar `docker-compose.demo.yml`, `tests/compose.stage2.qa.yml` y
`tests/compose.received.qa.yml`, siempre con `-p factuez-stage2-qa`.
El nuevo volumen `factuez_received_qa` es independiente de Billing/Identity/SUNAT.
Las migraciones de recepción manual y automatización se aplican exclusivamente
a esta base; nunca al esquema de Billing/Identity/SUNAT.

```powershell
docker compose -p factuez-stage2-qa -f docker-compose.demo.yml -f tests/compose.stage2.qa.yml -f tests/compose.received.qa.yml build received-documents-service web-pwa
docker compose -p factuez-stage2-qa -f docker-compose.demo.yml -f tests/compose.stage2.qa.yml -f tests/compose.received.qa.yml up -d --no-deps received-postgres
docker compose -p factuez-stage2-qa -f docker-compose.demo.yml -f tests/compose.stage2.qa.yml -f tests/compose.received.qa.yml run --rm --no-deps --entrypoint pnpm --workdir /workspace/services/received-documents-service received-documents-service prisma migrate deploy
docker compose -p factuez-stage2-qa -f docker-compose.demo.yml -f tests/compose.stage2.qa.yml -f tests/compose.received.qa.yml up -d --no-deps --no-build received-documents-service received-sync-worker web-pwa
```

La base nueva debe estar saludable antes de migrar. Servicios existentes deben
iniciarse explícitamente si están detenidos; no ejecutar `compose up` general,
`db push` ni migradores ajenos. Kong necesita recargar su configuración después
de cambiar rutas. La recepción no publica puertos directos ni expone su base.

## Pendientes del requerimiento, sin fingir cierre

Esta versión incluye **recepción manual, consulta, descarga, consultas SIRE de
lectura y recepción IMAP programada**, con reintentos, checkpoint transaccional,
conciliación y permisos por RUC/sede. La prueba real requiere configuración y
autorización de TI. No se ha validado todavía autenticación/conectividad real.
Faltan integración de estado SUNAT oficial, verificación de firma/PKI/CDR para
recepción y validación con formatos reales de todos los proveedores.
SIRE no proporciona los XML detallados por sí solo;
no se presupone una API universal de descarga ni se hace scraping con claves SOL.
La marca ERP no es integración contable automática.

La implantación del canal real requiere acordar su fuente, acceso y autorización
con TI; las claves se configurarán directamente, nunca por chat. Estos pendientes
no invalidan la bandeja manual entregada ni justifican alterar documentos originales.

Ver [preparación para TI](RECEPCION_AUTOMATICA_TI.md) y
[verificación de automatización](RECEPCION_AUTOMATICA_VERIFICACION.md).

UI UX Pro Max guió tablas semánticas, labels, estados y controles responsive.
Taste se instaló como pidió el usuario, pero su guía de landing no se aplicó a
esta pantalla administrativa; no se cambió la identidad visual de FactuEz.
