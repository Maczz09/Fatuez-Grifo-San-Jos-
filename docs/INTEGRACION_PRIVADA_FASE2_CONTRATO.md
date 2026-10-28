# API privada de extracción — Fase 2: contrato y reglas de acceso

Fecha: **09/10/2026**, America/Lima.

## Resultado y límites

**Fase 2 terminada como diseño versionado y código puro verificable del contrato.**
Se definieron 17 operaciones, 37 esquemas OpenAPI, tipos TypeScript, filtros,
consulta por clave fiscal, política de permisos, exportaciones y sincronización.
No son endpoints activos. No existe todavía el microservicio de integración ni
se implementó autenticación M2M, almacenamiento de cortes o lectura fiscal remota.

Esta fase pertenece al nuevo proyecto de **extracción privada**, no cierra las
etapas fiscales/históricas 2 y 3 del proyecto original. Se conserva la cobertura
y los límites del [inventario de fase 1](INTEGRACION_PRIVADA_FASE1_INVENTARIO.md).
No se consultaron BD, archivos reales, certificados, secretos, SUNAT o correo.
No hay migraciones, despliegues, emisiones, reservas ni cambios de correlativo.

Entregables:

- [OpenAPI 3.1.1](integration/private-api.openapi.v1.json), documento importable
  en herramientas compatibles, generado desde una fuente TypeScript y probado
  contra ella. Todas las operaciones llevan `x-implemented: false`.
- [Ejemplos ficticios](integration/examples.v1.json), sin insertar registros.
- `packages/contracts/src/integration-extraction.ts`: tipos, validación estricta
  de entradas y evaluadores puros del contexto de permisos/cursor.
- `packages/contracts/src/integration-openapi.ts`: fuente serializable de la
  especificación; no inicializa servicios ni realiza operaciones de red.
- `tests/integration-extraction-contract.spec.ts`: 106 pruebas locales aprobadas.

Los módulos son opt-in: `@factuez/contracts/integration` e
`@factuez/contracts/integration-openapi`. La definición OpenAPI no se exporta
desde el índice general que consumen la PWA y los servicios existentes.
No se añadieron dependencias ni se alteraron contratos de emisión.

## Alcance del contrato v1

- Dominio exclusivo: comprobantes **emitidos** `ISSUED_BUSINESS`.
- Tipos: `01`, `03`, `07`, `08`, `09`, `31`; representar un tipo no habilita su
  fuente ni convierte una plantilla/fixture en emisión empresarial.
- Perfil único de desarrollo: **BETA**. `PRODUCTION`, QA/SYNTHETIC y documentos
  de proveedores no son alternativas admitidas por estos parsers/endpoints.
- El entorno histórico se resuelve desde su identidad fiscal congelada. No se
  convierte un original de producción o de entorno desconocido en BETA para
  hacerlo pasar por el contrato. Otro perfil requiere revisión y autorización.
- Un RUC explícito por consulta de documentos, lotes, archivos y exportación.
  Para varios RUC se realizan consultas/trabajos independientes.
- El host `https://factuez.invalid` es **sólo un ejemplo no operativo**. TI
  definirá DNS privado y HTTPS sobre VPN en la fase de conectividad.

`GET /capabilities` deberá informar la capacidad **real** y autorizada, no
deducirla de un enum. En el checkout inventariado: 01/03 tienen lectura interna;
07/08 requieren adaptadores de lectura y conservan productor bloqueado; 09 es
laboratorio; 31 es diagnóstico/plantilla. La API remota está sin implementar.
No se publica `READY` porque exista este archivo ni porque un tipo tenga PDF.

## Endpoints previstos

Todos los siguientes están **definidos, no desplegados**. Prefijo de datos:
`/integration/v1`; el endpoint de identidad tiene prefijo propio.

| Método / ruta | Contenido | Fase de implementación |
| --- | --- | --- |
| `POST /integration/oauth/token` | Token M2M de cliente confidencial | 3 |
| `GET /capabilities` | Tipos/fuentes disponibles y límites autorizados | 4 |
| `GET /issuers` | Emisores autorizados; incluye inactivos históricos | 4 |
| `GET /branches` | Sedes autorizadas del RUC | 4 |
| `GET /points` | Puntos y series autorizados; sin contadores | 4 |
| `GET /documents` | Listado por cursor con corte estable y cobertura | 5 |
| `GET /documents/lookup` | Detalle por RUC + ambiente + tipo + serie + número | 4 |
| `GET /documents/{documentId}` | Detalle congelado por tipo, estado y procedencia | 4 |
| `GET /documents/{documentId}/artifacts` | Inventario autorizado de originales/representaciones | 4 |
| `GET /batches/{batchId}` | Resumen/baja y sus miembros íntegramente autorizados | 4 |
| `GET /batches/{batchId}/artifacts` | Inventario autorizado del lote | 4 |
| `GET /artifacts/{artifactId}/content` | Bytes XML, ZIP o PDF, sin redirección pública | 4 |
| `POST /exports` | Crear trabajo temporal, idempotente, de extracción | 5 |
| `GET /exports/{exportId}` | Estado del trabajo del cliente creador | 5 |
| `GET /exports/{exportId}/manifest` | Archivos, hashes, cobertura y faltantes | 5 |
| `GET /exports/{exportId}/content` | Paquete ZIP temporal del trabajo | 5 |
| `GET /changes` | Cambios durables desde checkpoint autorizado | 6 |

La fase 4 puede entregar consultas individuales. El listado estable no se
declara operativo antes del corte consistente de fase 5. Los catálogos también
requieren paginación completa y permisos; no se reutilizan los límites 20/50
de las pantallas como si fueran todos los datos.

## Identidad y permisos

El diseño utiliza OAuth 2.0 `client_credentials` para sistemas confidenciales,
con acceso previo acordado y credenciales **propias de integración**; no SOL,
GRE, certificado del emisor ni contraseña de un administrador. Este flujo está
definido para clientes confidenciales en [RFC 6749, sección 4.4](https://www.rfc-editor.org/rfc/rfc6749.html#section-4.4).
Se implementará en fase 3; no existe actualmente por definirlo en OpenAPI.

El token se envía sólo mediante `Authorization: Bearer`, sobre HTTPS; nunca
en query, almacenamiento público, ejemplos reales o registros de auditoría.
El transporte de Bearer en cabecera y el uso de TLS siguen [RFC 6750](https://www.rfc-editor.org/rfc/rfc6750.html#section-2.1).
El contrato exige tokens de hasta 300 segundos, sin refresh token. El cliente
vuelve a autenticarse si vence; revocación y desactivación deben consultarse
en servidor sin esperar esos cinco minutos.

Perfil JWT previsto: emisor de identidad fijado por despliegue, audiencia
`factuez-integration-v1`, tipo explícito de access token y algoritmo asimétrico
permitido. Verificar firma, emisor, audiencia, tiempos y estado vigente del
cliente; no aceptar JWT de PWA ni uno cuyo algoritmo/clave elija el solicitante.
La separación de audiencia y validación de emisor se apoya en [RFC 8725](https://www.rfc-editor.org/rfc/rfc8725.html#section-3.8).

Scopes separados:

| Scope | Autoriza |
| --- | --- |
| `integration:catalog:read` | Capacidades/catálogos permitidos |
| `integration:documents:read` | Cabecera, cliente, ítems, estados y lotes autorizados |
| `integration:artifacts:read` | Archivos, además de permiso de documentos |
| `integration:exports:create` | Crear trabajo, además de lectura de documentos |
| `integration:exports:read` | Estado/manifiesto/paquete propio, además de documentos |
| `integration:changes:read` | Feed, además de documentos |

Exportar o consultar un trabajo con archivos también exige `artifacts:read`.
Un scope no sustituye la autorización de recursos. Cada grant es una **tupla**
RUC–ambiente–tipos–sedes–puntos–series: no combinar listas de diferentes grants
creando permisos cruzados. Las series se autorizan por ID estable, no por `F001`.
`ALL` es explícito; `IDS: []` no autoriza nada. Un ID histórico no resuelto se
deniega bajo un grant restringido. `ALL` nunca autoriza otro RUC ni ambiente.

Los grants se gestionarán y recargarán en servidor. No se aceptan desde query,
cabeceras arbitrarias o el cuerpo del consumidor. Los evaluadores puros de esta
fase **no verifican tokens ni autentican usuarios**; sólo prueban esas reglas.
La fuente debe comprobar también la asociación canónica RUC–sede–punto–serie.

`integration-service` no accederá directamente a BD/volúmenes fiscales ni
montará certificados. Billing/SUNAT mantendrán la propiedad y ofrecerán read
APIs internas nuevas con principal/delegación verificable de integración.
No reenviar este token a los guards actuales de sesión humana ni impersonar ADMIN.
Kong limitará la entrada de integración; permisos y pertenencia se validan
también dentro de los servicios propietarios. La VPN no sustituye autenticación.

## Filtros, identidad y contenido

Listado: RUC, `from` y `to` obligatorios; fechas calendario inclusivas en
America/Lima, periodo máximo de 366 días. La futura consulta traduce el rango
a un intervalo semiabierto que incluye todo el último día; no usa zona del host.
Filtros opcionales: tipos CSV únicos, sede, punto, serie, moneda y estado fiscal.
Los tipos se ordenan para canonicalizar filtros. Página predeterminada 100,
máximo 500. No se acepta `page`, tokens en query, campos desconocidos, arrays
en lugar de scalars, fechas inexistentes ni notación numérica ambigua.

Consulta exacta, sin fecha obligatoria:

```http
GET /integration/v1/documents/lookup?issuerRuc=00000000101&environment=BETA&type=01&series=FQ01&number=00000001
Authorization: Bearer <token de integración>
```

Ejemplo ficticio y no ejecutado. RUC/número se conservan como texto, incluidos
ceros iniciales y valores superiores a la precisión segura de JavaScript.
El adaptador deberá distinguir formato del número e identidad numérica sin
alterar el valor original retornado. Un número/serie solos no identifican RUC,
ambiente ni tipo. Conflictos de identidad/origen no se resuelven con un fallback.

El detalle discrimina venta/nota frente a guía. Incluye:

- Cabecera/identidad congelada, emisor, cliente y fechas, versión, observación
  temporal y hash del snapshot cuando esté realmente disponible.
- Ítems completos del perfil: código, descripción, unidad, cantidad, valores,
  precio con impuesto, descuentos/cargos, impuestos y totales exactos.
- Pago/cuotas y referencias NC/ND. Las notas requieren una referencia; ese
  requisito estructural no sustituye todas las reglas fiscales SUNAT.
- Guías: remitente, destinatario, transportista, origen/destino, motivo, fecha,
  peso/bultos, vehículos, conductores, bienes y referencias.
- Estado local, proyección fiscal, transporte, procedencia y verificación,
  sin confundir una proyección almacenada con aceptación oficial verificada.

Decimales siempre como texto. `null` significa **no disponible**, no cero ni
valor reconstruido del maestro actual. La proyección contiene campos del
perfil inventariado; extensiones XML no mapeadas requieren avisos explícitos,
no se descartan silenciosamente ni se promete reproducir todo UBL en JSON.
El XML original íntegro sigue siendo la fuente de detalle/estructura original.
Si la cabecera/ítems no pueden vincularse coherentemente, devolver conflicto
o `INCOMPLETE_BINDING`, no un comprobante inventado o reconstruido de un PDF.

## XML, CDR y PDF: reglas obligatorias

Artefactos distintos: `UNSIGNED_XML`, `SIGNED_XML`, `SUBMISSION_ZIP`, `CDR_XML`,
`CDR_ZIP`, `ORIGINAL_PDF`, `CURRENT_PDF_A4`, `CURRENT_PDF_TICKET`.
Buscar por clase exacta; nunca sustituir XML firmado por unsigned ni CDR
original por uno simulado. Los fixtures/QA están excluidos de este dominio.

Cada archivo tendrá ID opaco estable de su propietario/versión, nombre seguro,
clase, tamaño/hash si están disponibles, disponibilidad, procedencia y estado
de integridad/firma/confianza/identidad **separados**. No devolver `storageKey`,
paths, P12/PFX, payload de credenciales, tokens o logs internos completos.
Las relaciones de lote se resuelven tanto para RC singleton como para múltiples.

**CDR/ZIP de lote:** antes de listar sus metadatos, consultar el lote o descargar
sus bytes, resolver y autorizar todos los miembros/identidades/versiones.
Miembros incompletos, repetidos, de otro RUC/entorno o fuera del scope impiden
la entrega. Un artefacto copiado en `DocumentArtifact` sigue perteneciendo al
lote real. No repartirlo como si fuera un CDR individual.
Denegar sin revelar miembros ni metadatos no autorizados. Una representación
recortada, si alguna vez se diseña, no será un CDR original.

Cada descarga revalida cliente, grants, propietario, entorno e integridad,
incluso si hay caché. SHA-256 correcto no acredita confianza PKI ni aceptación
SUNAT. No hacer llamadas a SUNAT para servir estas consultas.
Verificar el objeto íntegro antes de enviar bytes; usar lectura/staging seguro
si la fuente no garantiza inmutabilidad, sin debilitar límites/rutas/symlinks.
La implementación deberá respetar el límite actual de 10 MiB por lectura fiscal
o ampliar mediante una estrategia acotada y revisada, no cargar archivos ilimitados.

Respuestas con `Cache-Control: private, no-store`; bytes con tipo, nombre seguro,
tamaño, `X-Content-SHA256` y `nosniff`. Sin enlaces públicos, tokens en URL,
redirecciones de descarga a terceros ni aceptación de rutas de filesystem.
El contrato inicial descarga el cuerpo completo, no ofrece Range/304 para
eludir reautorización o controles de integridad.

PDF original almacenado e inmutable es distinto del PDF de consulta actual.
PDF QA persistido **no se convierte en original fiscal** por estar en disco.
Los PDF actuales usan caché privada temporal por identidad/snapshot/hash,
renderer y revisión RUC/sede; guardan hechos históricos, cambian sólo diseño.
Un ID de representación identifica también su revisión. Si ésta cambia entre
inventario y descarga, responder conflicto y pedir nuevo inventario, no devolver
otros bytes bajo el mismo hash. Las exportaciones fijan la revisión del corte.
Ninguna actualización de formato altera XML, CDR, firma o hash originales.

## Corte estable, exportación y cambios

Un cursor no es offset ni `updatedAt`/máximo ID. Será opaco y autenticado,
con estado de servidor o cifrado autenticado, ligado a cliente, revisión de
grants, hash de scope, filtros normalizados, orden y corte. TTL de 15 minutos.
`assertIntegrationCursorContext` sólo compara contexto **después** de verificarlo;
no implementa cifrado/firma ni autoriza usar un objeto JSON del cliente.

El corte contendrá versiones estables de filas/estado y enlaces de archivos;
entre microservicios requiere una proyección/read model versionada con barrera
de consistencia o coordinación explícita de versiones. No afirmar una transacción
distribuida por ejecutar dos SELECT. Si no puede garantizarse el corte,
`CONSISTENT_READ_UNAVAILABLE` y no una página parcial presentada como íntegra.
Mantener orden total determinista y permitir recorrer cada documento una vez;
sin cambios de filtro/cliente/permisos entre páginas. La revocación deniega aun
cuando el corte/cursor siga vigente. Caducidad requiere reiniciar el corte.

`coverage` informa todos los tipos pedidos y disponibilidad de sus fuentes;
`complete` sólo true con todas las fuentes requeridas cubiertas. Una consulta
mixta puede aportar tipos disponibles con cobertura explícita, sin ocultar 09/31.
Una consulta exacta a un tipo no soportado responde `SOURCE_NOT_SUPPORTED`
después de comprobar autorización, no muestra un fixture como sustituto.

Exportación: JSONL + manifiesto JSON + originales opcionales en ZIP. No reserva
series ni usa Outbox de emisión. El trabajo pertenece al cliente creador; scope
de RUC equivalente de otro cliente no da acceso a su trabajo. Reautorizar estado,
manifiesto y paquete; permisos reducidos invalidan el trabajo/corte.

- `Idempotency-Key` obligatorio; ligarlo a cliente, grants/versión y hash del
  request normalizado. Misma clave y otro contenido: `IDEMPOTENCY_CONFLICT`.
- Declarar clases de archivo y política `FAIL`/`REPORT`. `FAIL` no produce un
  paquete declarado íntegro con originales pedidos ausentes. `REPORT` los lista
  explícitamente y deja `complete: false`; no equivale a conciliación aprobada.
- Un archivo compartido se deduplica por propietario/versión/hash, conservando
  asociaciones con los comprobantes autorizados. No hay descarga implícita de
  ZIP de envío cuando sólo se pide XML firmado, ni CDR creado por la exportación.
- Manifiesto versionado: filtros, corte, cobertura, cantidades, archivos/hash,
  propietarios/asociaciones, faltantes y expiración. Paths internos del ZIP
  limitados a `documents.jsonl` y `artifacts/<UUID>.<xml|zip|pdf>`; manifest.json
  se incluye como documento índice y su hash se publica en el trabajo, sin
  autorreferencia circular. Estos paths no son rutas del almacenamiento fiscal.
- TTL de 24 horas después de estar READY y máximo 2 GiB por paquete. Si se
  excede: `EXPORT_TOO_LARGE`, segmentación explícita por periodo/filtros y cortes
  controlados; nunca truncar. Cuotas concurrentes/rate limits por cliente se
  configurarán en servidor en fases 3/5/7 con límites de disco/CPU/memoria.
- Archivos temporales aislados/cifrados y limpieza de trabajos vencidos; nunca
  eliminar ni reemplazar los XML/CDR/PDF históricos de los servicios propietarios.

Sincronización de fase 6: un checkpoint del mismo corte figura en página/export
cuando el feed esté preparado; antes es null y se devuelve `CHANGE_FEED_NOT_READY`.
Feed durable con secuencia de commit consistente y eventos versionados, entrega
al menos una vez: consumidor deduplica `eventId` y aplica versión por documento.
No avanzar un checkpoint antes de procesar el lote. Un ID reservado antes de
commit, timestamp o aviso Socket.io no garantiza que no se pierdan eventos.
Cambios de grants o retención vencida obligan a nuevo corte, con error explícito.
IDs/checkpoints no revelan documentos ocultos ni incrementos globales de otros RUC.

## Errores y operación privada

Formato común: versión, `requestId`, código, mensaje seguro y `retryable`.
Sin stack trace, datos de cliente ajeno, SQL, rutas, logs SOAP o secretos.

| HTTP | Casos previstos |
| --- | --- |
| 400 | Entrada inválida/campos desconocidos, fechas o tipos ambiguos |
| 401 | Token ausente/inválido/vencido/cliente revocado; `WWW-Authenticate` |
| 403 | Falta de scope para la operación, sin describir recursos ocultos |
| 404 | ID/RUC inexistente o no autorizado, incluidos lotes/artefactos ocultos |
| 409 | Contexto/corte cambiado, identidad/evidencia inconsistente, idempotencia |
| 410 | Cursor/corte/exportación caducados; reinicio explícito |
| 422 | Tipo/fuente no soportado, binding incompleto o exportación demasiado grande |
| 429 | Cuota/rate limit; `Retry-After` |
| 503 | Fuente indisponible o lectura/feed consistente aún no preparados |

Archivo faltante: `ARTIFACT_UNAVAILABLE` con 404, o 409 si todavía está en
preparación y se admite reintento. Fallo de integridad: 409, sin servir cuerpo.
Un error HTTP del token endpoint usa los códigos OAuth del esquema `OAuthError`,
no inventa permisos o autentica en modo fallback si Identity está indisponible.

Auditar cliente, requestId, operación, resultado, versión de grants, corte y
IDs/hash/tamaño entregados, con retención y acceso restringidos. No registrar
tokens, secretos, cuerpos XML completos, nombres/direcciones de clientes o
filtros sensibles en proxies. No se habilita CORS público por tratarse de API ERP.
La futura entrada VPN/HTTPS expondrá sólo rutas de integración, no la PWA,
panel de administración, bases de datos, Redis ni configuración SUNAT.

## Gate y siguiente fase

Comprobado en esta entrega: estructura/referencias de OpenAPI, sincronización
con su fuente, parsers, tipos, ejemplos de los seis documentos, aislamiento por
tuplas, reautorización lógica de lote y contexto de cursor. Las pruebas de schema
usan un evaluador **limitado y sólo de tests**, no una certificación completa de
OpenAPI/JSON Schema ni una prueba de autenticación/HTTP/BD.

Verificación reproducible, sin Docker/BD/SUNAT:

Resultado final: **106 pruebas del contrato**, dentro de **163 pruebas / 4
suites aprobadas** al incluir regresión relacionada de permisos/multi-RUC;
**7 pruebas del inventario** también aprobadas y compilación TypeScript del
paquete de contratos exitosa. No hubo omisiones. No se ejecutó aquí toda la
regresión general ni una prueba de endpoints externos; no atribuir a esta fase
los conteos anteriores de recepción/facturación.

```powershell
pnpm test:integration-contract
pnpm --filter @factuez/contracts typecheck
node --test tests/integration-source-audit.test.mjs
```

La regresión relacionada se reproduce con:

```powershell
pnpm exec vitest run tests/integration-extraction-contract.spec.ts tests/stage1.spec.ts tests/multi-issuer.spec.ts tests/received-access.spec.ts --maxWorkers=2
```

La especificación usa [OpenAPI 3.1.1](https://spec.openapis.org/oas/v3.1.1.html)
para describir operaciones, esquemas y OAuth; describir una interfaz no confirma
que exista un servidor implementado. El snapshot JSON debe permanecer idéntico
a `integrationOpenApiV1()` y cambiar sólo mediante revisión/versionado del contrato.

**Siguiente: fase 3, identidad de integración y autorización M2M.** Crear cliente
técnico, grants/revocación/rotación/auditoría, token endpoint y guard propio;
ensayarlos sólo localmente con credenciales ficticias, sin reutilizar cuentas
humanas ni habilitar puertos remotos. Después: read adapters/artefactos (4), corte
y export worker (5), feed (6), conectividad privada (7) y piloto TI (8).

No se necesita que el cliente entregue claves ni nuevas muestras para seguir
programando. La activación real requerirá después la autorización y configuración
de TI, fuentes persistentes válidas y comprobación de sus permisos/archivos.
