# Inventario del módulo de facturación de RestoApp

Fecha de inventario: 2026-09-11

## Fuente localizada

El código fuente real está en:

```text
D:\Restaurantes\la-barra-del-ceviche\apps\servicio-facturacion
```

Es una carpeta hermana distinta de `D:\Restaurantes\La barra del ceviche`.
La primera usa guiones y minúsculas; la segunda contiene el blueprint creado
para FactuEz.

Estado de Git al inspeccionarlo: rama `main`, árbol de trabajo limpio. No se
modificó RestoApp.

## Línea base verificada

Comando ejecutado:

```text
npm exec --offline nx -- test servicio-facturacion --runInBand --skip-nx-cache
```

Resultado: 8 suites y 89 pruebas aprobadas. Jest mostró una advertencia de
configuración porque `ts-jest` procesa `libs/contracts/dist/index.js`; no es un
fallo funcional, pero no debe heredarse al nuevo monorepo.

## Capacidades existentes

- NestJS 11 y Prisma/PostgreSQL.
- Boleta, factura, nota de crédito y nota de débito.
- Builders UBL 2.1 y pruebas unitarias.
- XMLDSig desde certificado PKCS#12.
- Cliente SOAP `sendBill`, `sendSummary` y `getStatus` con WSDL local.
- Credenciales SOL y certificado cifrados con AES-256-GCM.
- Correlativos atómicos mediante `UPDATE ... RETURNING`.
- Recepción idempotente de `cuenta.cerrada` por RabbitMQ.
- Outbox para publicar `comprobante.emitido`.
- Pantallas React existentes para configuración, emisión e impresión.

## Acoplamientos que no pasan a FactuEz

| RestoApp | Destino FactuEz |
|---|---|
| `CuentaCerradaPayload`, `cuentaId`, `mesaId`, `meseroId` | Comando fiscal independiente y adaptador temporal de migración |
| RabbitMQ `facturacion_queue` | Redis/BullMQ con cola propia por consumidor |
| Hasta dos empresas por `slot` y RUC por sede | Un emisor fijo: GRIFO SAN JOSE S.R.L., RUC 20450819230 |
| Series/correlativos como columnas de `Empresa` | `SeriesCounter` por tipo, serie y punto de emisión |
| Servicio único con negocio, firma y transporte | `billing-service` y `sunat-service` separados |
| Cron que consulta pendientes cada 30 segundos | Jobs BullMQ idempotentes, locks, backoff y reintentos persistidos |
| JWT/RBAC compartido desde librerías de RestoApp | `identity-service` y contratos propios de FactuEz |
| PWA React/Vite del restaurante | Next.js App Router PWA para pista/caja/administración |

## Reutilización por destino

### `packages/sunat-core`

Tomar como referencia `igv.ts`, `ubl.builder.ts`, `catalogos-notas.ts` y sus
pruebas. Antes de reutilizarlos:

- reemplazar `number` por `Decimal`/representación decimal exacta;
- eliminar IGV y afectación tributaria fijos;
- soportar unidades `GLL`, `LTR`, `NIU` y demás catálogos requeridos;
- cubrir operaciones gravadas, exoneradas, inafectas, gratuitas e ISC;
- validar cada documento contra XSD/Schematron y golden files oficiales.

### `sunat-service`

Tomar como referencia `certificado.ts`, `firma.ts`, `sunat-soap.client.ts` y los
WSDL locales. La versión nueva debe separar puertos/adaptadores, añadir GRE REST
OAuth 2.0, parsear el CDR y clasificar aceptado, observado y rechazado.

### `billing-service`

Conservar las invariantes de idempotencia y asignación atómica. La creación del
documento, reserva del correlativo, snapshot inmutable y evento Outbox deben
ocurrir en una sola transacción. El XML no se construye ni firma aquí.

### `apps/web-pwa`

Las pantallas y tickets actuales sirven como referencia visual y de flujo. No
se copiarán sus clientes HTTP ni tipos duplicados; la PWA nueva consumirá los
contratos versionados de `packages/contracts` a través de Kong.

## Brechas fiscales y operativas

- No existe Guía de Remisión Electrónica Remitente tipo 09.
- No hay PDF A4 ni paquete de entrega persistido con XML/CDR.
- El CDR se guarda como base64 y no se modelan código, notas ni hash por
  intento.
- La mera presencia de `applicationResponse` se interpreta como aceptación;
  se debe descomprimir y analizar el CDR antes de decidir el estado.
- Tras cinco errores el comprobante queda sin un estado terminal explícito ni
  política durable de reintento.
- No hay WebSockets de estado, mailer desacoplado ni reporting fiscal propio.
- El XML usa `NIU`, afectación `10` e IGV 18% de forma fija, insuficiente para
  combustibles, lubricantes y servicios libres.
- El correlativo se consume antes de la transacción que persiste el documento;
  una falla posterior puede dejar un hueco que debe declararse.
- Las credenciales cifradas dependen de una clave de aplicación. Se detectó una
  clave incluida directamente en un Compose de desarrollo; no se copiará y
  deberá rotarse antes de usar datos reales.
- Producción usa una imagen con etiqueta flotante `latest`; FactuEz utilizará
  tags inmutables/digests y despliegues controlados.

## Primer corte vertical

1. Portar las pruebas puras de IGV/UBL como tests de caracterización.
2. Definir `IssueDocumentCommand.v1` sin conceptos de restaurante.
3. Implementar la transacción documento + correlativo + Outbox en
   `billing-service`.
4. Consumir el evento en `sunat-service`, generar/firma/validar y almacenar
   artefactos.
5. Enviar una factura y una boleta de prueba al entorno Beta, parseando CDR.
6. Publicar el estado y mostrarlo en la PWA mediante Socket.io.

El corte productivo permanece deshabilitado hasta completar conciliación,
homologación, restauración de backups y prueba de rollback.
