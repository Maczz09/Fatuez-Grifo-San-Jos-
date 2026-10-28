# FactuEz: Swagger público y conexión B2B

Revisión documental: 28/10/2026. **Contrato de referencia; runtime no verificado.**
Esta entrega no comprueba servicios desplegados, VPN, piloto remoto ni aceptación
SUNAT. Las verificaciones históricas de QA no acreditan disponibilidad actual.

## Acceso

- `/api-docs`: portada y guía completa, legible sin JavaScript.
- `/api-docs/swagger`: Swagger UI local de sólo lectura.
- `/api-docs/openapi.json`: contrato B2B público de referencia.
- `/api-docs/sunat.json`: 404; el catálogo público no entrega administración intranet.

Las rutas son relativas al origen de la PWA donde se publique la documentación.
La dirección de la API de datos debe proporcionarla TI. El servidor
`https://factuez.invalid` del contrato es un marcador deliberadamente no operativo.

Swagger no permite ejecutar, autenticar, persistir tokens ni configurar una URL
externa. Sólo obtiene su JSON local por GET, omitiendo credenciales y cabeceras.
Los recursos son locales, sin CDN ni validador remoto. No introducir secretos.

## Qué contrato se publica

La proyección pública comprende los 15 métodos del lector B2B, nueve operaciones
de suscripciones/entregas webhook y el token SERVICE: 25 operaciones declaradas.
**Declaradas en código no significa disponibles en un entorno.** Cada operación
incluye `x-runtime-enabled: false` y `x-runtime-status: NOT_PROBED_BY_DOCUMENTATION`.

La fuente `packages/contracts/src/b2b-public-openapi.ts` reutiliza los esquemas,
parámetros, scopes, cuerpos y respuestas de `b2b-read-openapi.ts` y
`b2b-webhook-openapi.ts`. El token se documenta según el controlador y servicio
B2B de Identity. No se publica el candidato completo, administración humana,
rutas internas, configuración fiscal ni credenciales/hosts de infraestructura.
Los contratos candidatos e históricos se conservan como fuentes independientes.

| Perfil | Identidad y alcance |
| --- | --- |
| Esta guía B2B | `/b2b/oauth/token`, `/b2b/v1/*`, audiencia `factuez-b2b-v1`, scopes `b2b:*`, `issuerId` numérico |
| Extracción privada histórica | `/integration/oauth/token`, `/integration/v1/*`, audiencia y scopes distintos, `issuerRuc` |
| Administración intranet | Sesión humana y permisos propios; fuera del catálogo público |

El contrato histórico privado sigue en
[integration/private-api.openapi.v1.json](integration/private-api.openapi.v1.json).
Su operación de red se trata en
[INTEGRACION_PRIVADA_WINDOWS_OPERACION.md](INTEGRACION_PRIVADA_WINDOWS_OPERACION.md).
No intercambiar tokens ni filtros entre esos perfiles.

## OAuth client credentials desde el backend

TI debe aprovisionar el origen privado HTTPS, acceso de red, CA y certificados
mTLS de transporte, cliente SERVICE, secreto, scopes y grants vigentes. El P12
fiscal, SOL, GRE y la sesión de caja no son credenciales de integración B2B.

Solicitar `POST /b2b/oauth/token` con HTTP Basic de `client_id:client_secret` y
`Content-Type: application/x-www-form-urlencoded`. El cuerpo contiene
**exactamente** `grant_type` y `scope`, con scopes únicos separados por un espacio:

```text
grant_type=client_credentials&scope=b2b%3Acontext%3Aread%20b2b%3Acatalog%3Aread%20b2b%3Adocuments%3Aread%20b2b%3Aartifacts%3Aread
```

Respuesta: `access_token`, `token_type: Bearer`, `expires_in: 300` y `scope`.
JWT RS256 de cinco minutos, sin refresh token. Guardar en el backend, nunca
repositorio, navegador, URL o logs; volver a obtenerlo cuando venza.

Cada consulta de datos lleva `Authorization: Bearer <ACCESS_TOKEN>` y puede
incluir `X-FactuEz-Actor-Kind: SERVICE`. Empezar con `/b2b/v1/me` **sin query**
y `/b2b/v1/capabilities?environment=BETA`. Capabilities no es una prueba de
conectividad del propietario ni aceptación tributaria. Este flujo no describe
el acceso USER delegado, que necesita su circuito independiente de identidad.

| Uso | Scopes mínimos |
| --- | --- |
| Me y capabilities | `b2b:context:read` |
| Catálogos | `b2b:catalog:read` |
| Documentos/detalle/estado | `b2b:documents:read` |
| Inventario y descarga | `b2b:documents:read` + `b2b:artifacts:read` |
| Consultar webhooks | `b2b:documents:read` + `b2b:webhooks:read` |
| Gestionar/verificar/rotar/replay | `b2b:documents:read` + `b2b:webhooks:manage` |

El envío exige también lectura de webhooks vigente. Nada se concede por abrir
Swagger. Los grants autorizan la tupla completa emisor/RUC/ambiente/sede/punto/
serie/tipo; no combinaciones de listas. El cliente y sus permisos se revalidan.

## Extraer XML/CDR existentes

Ejemplos con marcadores, relativos al origen autorizado por TI. `issuerId` es
el entero positivo del catálogo; los demás IDs del ejemplo son UUID.

```http
GET /b2b/v1/issuers?environment=BETA&limit=50
GET /b2b/v1/documents?issuerId=<ISSUER_ID>&environment=BETA&from=2026-10-01&to=2026-10-28&types=01,03&limit=50
GET /b2b/v1/documents/<DOCUMENT_UUID>?issuerId=<ISSUER_ID>&environment=BETA
GET /b2b/v1/documents/<DOCUMENT_UUID>/artifacts?issuerId=<ISSUER_ID>&environment=BETA
GET /b2b/v1/artifacts/<ARTIFACT_UUID>/content?issuerId=<ISSUER_ID>&environment=BETA
```

Este perfil cubre 01/03 BETA; 07/08/09/31 devuelven `SOURCE_NOT_SUPPORTED`.
No inferir soporte por operaciones de otros candidatos. Fechas inclusivas,
máximo 366 días; 50 filas por defecto, máximo 100. Seguir `page.nextCursor`
hasta `page.hasMore: false`, conservando filtros/tamaño. Corte de hasta 10.000
filas y 300 segundos; atender expiración y cobertura de la respuesta.

El detalle incluye información disponible de cliente, ítems, impuestos y
totales. Importes/cantidades son texto decimal; `null` no equivale a cero.
Descargar el XML completo para conservar la estructura UBL original.

El inventario de este perfil devuelve originales existentes `AVAILABLE`:
`UNSIGNED_XML`, `SIGNED_XML`, `SUBMISSION_ZIP`, `CDR_XML`, `CDR_ZIP`.
Elegir por clase y descargar con el ID del **archivo**, no una ruta del servidor.
Guardar los bytes sin reescribir y contrastar tamaño/SHA-256 del inventario y
`X-Content-SHA256`. No se prometen originales inexistentes ni CDR por documento.

Para `owner.kind: BATCH`, consultar `/b2b/v1/batches/{id}/artifacts` con emisor
y ambiente. El lote exige autorización sobre todos sus miembros; no se recorta
ni inventa un CDR individual de resumen. El PDF de
`/b2b/v1/documents/{id}/representations/{format}` (`a4`/`ticket`) es representación
local actual, separada del original. Un hash correcto no acredita firma,
confianza PKI ni aceptación SUNAT. La descarga lee lo conservado en FactuEz.

## Webhooks locales

Único evento de este perfil: `document.issued-locally.v1` de 01/03 locales BETA.
El catálogo de diseño más amplio no habilita eventos tributarios, archivos,
notas o guías. El contrato de callback existente está en
[b2b/asyncapi.webhooks.candidate.v1.json](b2b/asyncapi.webhooks.candidate.v1.json).

1. TI aprueba un `destinationId` HTTPS; no se acepta una URL libre.
2. Crear con `POST /b2b/v1/webhook-subscriptions?issuerId=<ISSUER_ID>&environment=BETA`,
   JSON `binding`, `label`, `destinationId`, `events: ["document.issued-locally.v1"]`.
   `binding` es el `Context` completo: `issuerId` entero, `issuerRuc` de 11 dígitos,
   `documentType: "01"` o `"03"`, UUID de `branchId`, `pointId`, `seriesId`,
   y `environment: "BETA"`. El secreto se muestra una vez al crear/rotar.
3. Verificar con `POST /b2b/v1/webhook-subscriptions/{id}/verify` y cuerpo `{}`.
   El receptor responde HTTP 200 con JSON exacto `{"challenge":"<NONCE_RECIBIDO>"}`.
4. Mutaciones llevan `Idempotency-Key` de 16–100 caracteres (`A-Z a-z 0-9 _ -`).
   Cambios/verificación/rotación/replay exigen `If-Match` con la revisión de la
   **suscripción**, también al repetir una entrega. 412: distinta; 428: ausente.

Verificar Standard Webhooks sobre bytes UTF-8 exactos antes de parsear JSON:
`webhook-id` = deliveryId, `webhook-timestamp` en segundos, `webhook-signature` v1.
HMAC-SHA256 sobre `id + "." + timestamp + "." + cuerpo_original`; tolerancia 300 s.
En rotación se mantienen ambas firmas durante cinco minutos.

El payload mínimo no contiene XML/CDR, cliente/ítems, enlaces públicos ni tokens.
Consultar recursos con autorización independiente. Persistir Inbox durable y
deduplicar deliveryId/eventId antes del 2xx, coordinando el efecto de negocio en
la transacción del consumidor. Entrega al menos una vez, sin orden global, hasta
ocho intentos por ronda. Un 2xx no significa aceptación SUNAT.

Consultar `/b2b/v1/webhook-deliveries` y `/{id}` con emisor/ambiente; listados
con `after`, `page.nextCursor`, `page.hasMore`. Replay por POST `/{id}/replay`,
cuerpo `{}`, clave e If-Match de suscripción: sólo DEAD_LETTER/CANCELLED,
máximo cinco replays; conserva eventId/deliveryId. El 202 sólo reprograma.
No hay backfill automático ni recuperación de secretos por GET/replay.

## Errores y verificación de esta revisión

OAuth devuelve `{error}`; las operaciones de datos usan su envoltura B2B con
código y `retryable`. Atender 401, 403/404 sin explorar IDs ajenos, 409/410,
412/428, 422, 429/503 según operación. Reintentos acotados, respetando
Retry-After cuando exista. Registrar correlación/resultado sin secretos.

Resultado de esta revisión: **87 pruebas aprobadas en cuatro archivos**; tipos
de contratos y web correctos. Render de portada y Swagger revisado en 1440 y
390 px: 25 operaciones, sin desbordamiento horizontal ni solicitudes ajenas
a los handlers documentales.

Las pruebas de esta entrega son locales y sintéticas. No usan credenciales,
SUNAT, callbacks del cliente ni red externa. No se construye Docker ni se
inicia el runtime B2B. Los comandos reproducibles son:

```text
pnpm exec tsc -p packages/contracts/tsconfig.json
pnpm exec tsc -p apps/web-pwa/tsconfig.json --noEmit --incremental false
pnpm exec vitest run tests/public-api-docs.spec.ts tests/swagger-documentation.spec.ts tests/b2b-read-contract.spec.ts tests/b2b-contract.spec.ts --maxWorkers=2
node tests/public-api-docs.browser.mjs --isolated-synthetic-only
```

El último comando sirve únicamente los handlers documentales en loopback y usa
un perfil Chrome temporal sin sesión del usuario. No es el runtime de negocio.
No se afirma piloto remoto, publicación ni disponibilidad operativa por superar
estas comprobaciones.
