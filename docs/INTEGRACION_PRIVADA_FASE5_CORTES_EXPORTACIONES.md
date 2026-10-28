# API privada — Fase 5: cortes y exportaciones temporales

Fecha: 09/10/2026. Proyecto de **extracción privada**, no las fases fiscales/históricas originales.

## Entrega y límites

Implementación opt-in, separada de la emisión y de la PWA. Exclusivamente
`BETA / ISSUED_BUSINESS`, con fixtures para todos los ensayos de esta entrega.
No se activaron endpoints en Kong, servicios o puertos del QA existente; no se
leyeron BD, certificados o archivos del cliente. No hubo migraciones en bases
existentes, importaciones, cambios de numeración ni comunicaciones con SUNAT.

Fuentes operativas de lectura: snapshots persistentes de Billing para
01/03/07/08. 09/31 continúan `UNSUPPORTED`: sus laboratorios/plantillas no son
comprobantes empresariales y no se usan como reemplazo. Tampoco se agrega el
historial de un proveedor ni la bandeja de compras al dominio de emitidos.

### Componentes

| Componente | Responsabilidad |
| --- | --- |
| `integration-service` | Fachada HTTPS/mTLS, sin conexión a BD o volúmenes fiscales |
| Billing, lector separado | Captura `RepeatableRead READ ONLY`, sólo campos congelados y pertenencia canónica |
| SUNAT, lector separado | Inventario y bytes originales, autorización íntegra de lotes y checksum |
| `integration-export-service` | BD técnica propia, cortes cifrados, trabajos idempotentes y ZIP temporal |
| Identity | Token M2M de hasta 300 s, estado y grants vigentes en cada operación |

El servicio exportador es otro microservicio del monorepo. No lee directamente
la BD o filesystem de Billing/SUNAT. Su cola durable es **técnica, PostgreSQL**,
con leases y `FOR UPDATE SKIP LOCKED`; no usa el Outbox/BullMQ de emisión.
Esto permite confirmar reserva, idempotencia y preparación en su propietario
sin un dual-write PostgreSQL–Redis. No supone una transacción entre servicios.

## Listado y corte

`GET /integration/v1/documents` exige RUC, fechas inclusivas de Lima, máximo
366 días; página de 100 por defecto, hasta 500. Billing traduce fechas al
intervalo semiabierto local y recorre internamente por `issueDate + id`, dentro
de una única transacción de lectura. Los grants completos se aplican en SQL
antes de límites; no se combinan tuplas independientes.

Se congelan los documentos completos: cabecera/cliente, ítems, importes y
proyección de estado. Se excluyen borradores. Las páginas devuelven filas y el
detalle íntegro se consulta con:

```http
GET /integration/v1/documents/{id}?issuerRuc={ruc}&snapshotId={snapshotId}
Authorization: Bearer <token M2M>
```

Cursor opaco con AES-256-GCM, contexto de filtros, página y registro de servidor.
El corte cifrado persiste en la BD técnica; no depende de memoria del proceso.
TTL: 15 minutos. Cliente distinto, contexto/permisos cambiados, expiración o
identidad canónica modificada impiden la entrega. Se permite renovar el token
manteniendo scopes/grants/revisión idénticos. Un cambio de estado posterior no
reescribe la versión congelada. Se revalida el hash del snapshot original y
la pertenencia actual antes de entregar incluso una página de caché.

La aceptación oficial **no se infiere** del estado proyectado de Billing.
`fiscal=NOT_CHECKED`, con estado de transporte separado. Filtrar por otros
estados fiscales verificados devuelve `CONSISTENT_READ_UNAVAILABLE` mientras
no exista esa fuente verificada; no se filtra una aceptación ficticia.

`coverage.complete` se refiere a los tipos solicitados y disponibles. Una
consulta que incluya 09/31 puede mostrar ventas disponibles, pero no es completa.
`changeCheckpoint=null`; el feed durable corresponde a fase 6.

## Exportación

Operaciones públicas nuevas, a través de la fachada:

- `POST /integration/v1/exports`, con `Idempotency-Key` de 16–128 caracteres
  seguros y body del contrato v1. Devuelve 202 y trabajo, no paquete terminado.
- `GET /integration/v1/exports/{id}?issuerRuc=...`: estado del cliente creador.
- `GET /integration/v1/exports/{id}/manifest?issuerRuc=...`: índice verificado.
- `GET /integration/v1/exports/{id}/content?issuerRuc=...`: ZIP íntegro autorizado.

La creación reserva el trabajo e identifica al cliente, revisión/contexto y
hash del request. Captura los hechos y originales con el token todavía vigente;
el empaquetado posterior es asíncrono. **No guarda Bearer/SOL/credenciales ni los
entrega al worker**. Si la captura se interrumpe antes de quedar QUEUED, no se
reanuda consultando propietarios sin autorización: vence o queda FAILED. Un
retry idéntico devuelve el mismo trabajo; cambiar request/contexto con la misma
clave produce conflicto. Para una nueva captura fallida se requiere otra clave.

El worker recupera sólo trabajos ya capturados/cifrados. Un lease vencido puede
ser reclamado por otro proceso; la publicación READY comprueba lease y vigencia
original con reloj de BD, para que un worker antiguo no publique después del
vencimiento. Se recupera el empaquetado, no una supuesta sesión de usuario.

Contenido:

- `documents.jsonl`: un detalle congelado por línea, decimales como texto.
- `manifest.json`: versión, filtros/corte, cobertura, asociaciones y faltantes.
- `artifacts/{UUID}.xml` o `.zip`: originales pedidos, sin rutas fiscales.

El manifiesto contiene SHA-256 y tamaño de cada archivo; su propio hash se
publica en el trabajo, sin autorreferencia circular. El ZIP tiene otro checksum
de respuesta. Las representaciones PDF no expuestas por el propietario se
reportan como no soportadas: no se sustituye un PDF fiscal por uno QA.

`FAIL` impide producir un paquete declarado completo cuando faltan fuentes o
archivos pedidos. `REPORT` conserva lo disponible, registra los faltantes y
deja `complete=false`. Un fallo de integridad, binding, permisos o indisponibilidad
de infraestructura detiene la operación; no se rebaja a un faltante inocuo.

CDR compartido: autorización de **todos** los miembros, aun fuera del periodo
exportado; deduplicación por artefacto propietario/versionado, y asociaciones
completas en el manifiesto. Los miembros adicionales autorizados no se agregan
como ventas del periodo ni elevan su `documentCount`. Si alguno no es autorizado
o no se resuelve íntegramente, no se entrega el CDR original ni el ZIP de caché.

### Qué significa la consistencia entre propietarios

El `snapshotAt` es el corte transaccional de **Billing**. La evidencia de SUNAT
se observa después; se vincula al mismo snapshot original, se verifica su hash
y se vuelve a observar su inventario/versiones antes de encolar. Los bytes y
asociaciones capturados quedan congelados en el paquete. El estado proyectado
no se reemplaza por el estado posterior del lector SUNAT.

Esto es una captura coordinada/versionada, **no una foto fiscal distribuida al
mismo instante ni una transacción global**. Las consultas individuales de
artefactos sin snapshot siguen siendo inventario actual. Cambios incoherentes
durante la captura o en la pertenencia antes de descargar se rechazan; no se
presentan como originales equivalentes. La confianza PKI, firma y aceptación
SUNAT conservan su estado explícito no verificado de fase 4.

## Retención, seguridad y cuotas

Snapshots, staging y ZIP se almacenan como ciphertext autenticado en una **BD
técnica nueva**, con clave dedicada externa. No hay staging plaintext en disco,
paths del solicitante, volumen fiscal montado ni clave de firma del emisor.
Expiración de READY: 24 horas; limpieza elimina solamente sus copias cifradas.
Los tombstones de idempotencia se retienen 48 horas adicionales. Los registros
de auditoría, sin XML, clientes/direcciones, filtros o tokens, tienen retención
operativa separada a definir con TI. Borrar un temporal no borra un original.

Cada lectura reautoriza Identity y los propietarios. Un cliente equivalente
no accede al trabajo de otro cliente. Token vencido/revocado, permisos cambiados,
auditoría o fuente indisponible: fail-closed. TLS validado, mTLS y peers
permitidos; no CORS público, redirecciones, Range/304 ni fallback a sesión humana.
Respuestas privadas/no-store, nombres seguros, nosniff y checksum en descarga.

Perfil inicial **acotado**, menor que el techo contractual de 2 GiB:

- Máximo 10 000 documentos y 16 MiB por captura de Billing, sin truncamiento.
  Se cuenta también el JSON sin comprimir en PostgreSQL antes de transportarlo.
- Máximo 10 MiB por original y **64 MiB por ZIP**. Para más, segmentar fechas
  o filtros en trabajos explícitos; nunca fingir una exportación completa.
- Hasta 2 exportaciones y 8 cortes activos por cliente; 64 registros activos,
  256 MiB de ciphertext total y 100 000 asociaciones de miembros/archivos.
- Concurrencia de captura/fachada/exportador: 2 al habilitar fase 5; worker
  serial por proceso. Captura hasta 5 minutos, lease de 60 segundos.

Transportes internos tienen plazos absolutos además de inactividad: 20 s para
captura/reautorización Billing, hasta 240 s para la creación coordinada y 5 s
para otras lecturas. No son timeouts elegidos por el consumidor. Si el token
vence o un plazo no alcanza, falla la captura; no se guarda el token para retomarla.

Estas cuotas se validan en servidor y se documentan como perfil inicial; no se
promete soportar ZIP de 2 GiB en memoria. Cuotas y reserva se serializan en el
propietario mediante lock transaccional; la entrega no depende de una caché local.

## Preparación de despliegue — no ejecutada

`services/integration-export-service/sql/integration-export.sql` es un
blueprint revisable. **No se ejecuta al arrancar** ni sobre BD existentes. TI
debe autorizar una BD `integration_exports_beta` separada, usuario limitado a
sus tablas técnicas, respaldo de su clave de cifrado y PostgreSQL con TLS válido.
El gateway nunca recibe esas credenciales ni el volumen/clave de cifrado.

Todos los ejecutables están desactivados por defecto y limitados a loopback:

- Billing: `INTEGRATION_BILLING_READ_ENABLED` y, aparte,
  `INTEGRATION_BILLING_CAPTURE_ENABLED`; entrypoint `dist/integration/main.js`.
- Exportador: `INTEGRATION_EXPORT_ENABLED`; entrypoint `dist/main.js`.
- Fachada: `INTEGRATION_READ_ENABLED` y `INTEGRATION_EXPORT_FORWARD_ENABLED`,
  más `INTEGRATION_READ_EXPORT_ORIGIN`; entrypoint `dist/main.js`.

TLS/mTLS/Identity y orígenes Billing/SUNAT usan el perfil de fase 4.
El exportador además exige `INTEGRATION_EXPORT_KEY_FILE` (32 bytes),
`INTEGRATION_EXPORT_DB_HOST`, `INTEGRATION_EXPORT_DB_NAME`,
`INTEGRATION_EXPORT_DB_USER`, `INTEGRATION_EXPORT_DB_PASSWORD_FILE` y
`INTEGRATION_EXPORT_DB_CA_FILE`. Sin configuración/schema: no arranca ni cae
a memoria. No se imprimen secretos ni se toma configuración de contenedores QA.

Kong, VPN, DNS privado y reglas de exposición siguen siendo **fase 7**;
ensayo con datos/autorizaciones reales, **fase 8**. El OpenAPI de fase 2 conserva
`x-implemented:false` como diseño no desplegado; este archivo registra el código
local disponible y sus límites, sin afirmar endpoints ya publicados.

## Verificación reproducible

```powershell
pnpm test:integration-export
pnpm test:integration-export:db
node --test tests/integration-source-audit.test.mjs
pnpm test:regression
```

El ensayo PostgreSQL crea una BD vacía/desechable, red interna sin puertos y
1 201 comprobantes ficticios. No monta el repo completo ni env/volúmenes reales.
Comprueba cortes frente a cambios concurrentes, keyset, autorización, persistencia,
idempotencia concurrente, leases/CAS, cifrado, manifiesto/ZIP y auditoría requerida.
Sólo elimina sus recursos con nombres exactos y etiquetas propias verificados.

Resultados de la entrega:

- **298 pruebas nuevas**: 95 de captura, 41 de cortes/exportación, 14 HTTP/mTLS,
  61 de interoperabilidad/seguridad ZIP y 87 del store/SQL. Ninguna omitida.
- **616 / 11 suites** de las fases 2–5 de integración aprobadas; **7 pruebas**
  de inventario de fase 1 aprobadas.
- **30 comprobaciones** PostgreSQL aprobadas sobre la BD nueva con 1 201
  documentos ficticios; incluye cambios entre páginas, guard de expiración y
  rechazo de JSON sobredimensionado antes de cargarlo.
- **4 659 pruebas / 120 suites** de regresión general aprobadas. Una omisión
  condicional preexistente en `fiscal-batch.spec.ts`, por no configurar
  `FACTUEZ_FISCAL_XSD_PYTHON`; no se cuenta como validación XSD ejecutada.
- Contratos, acceso compartido, Billing, fachada y exportador compilados.
  Los 14 contenedores QA existentes continuaron saludables; todos los recursos
  PostgreSQL/runner/red del ensayo se eliminaron por su etiqueta verificada.

No confundir tests unitarios con PostgreSQL, un piloto externo o aceptación SUNAT.

**Siguiente: fase 6, feed durable/checkpoints.** La entrega local de fase 5 no
habilita producción, no valida todos los perfiles fiscales ni autoriza el corte
del historial. No se requiere que envíes claves por el chat para continuar código.
