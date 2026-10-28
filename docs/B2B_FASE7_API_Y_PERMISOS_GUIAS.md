# B2B-07 — API y permisos persistentes de emisión local de guías

23/10/2026. Séptimo bloque candidato. Amplía el
[productor atómico local](B2B_FASE7_PRODUCTOR_ATOMICO_GUIAS.md). No se publica
en el stack activo ni se habilitan producción, traslado o transmisión oficial.

Continuación posterior: [XML, firma, CDR, perfiles y lotes](B2B_FASE7_XML_FIRMA_CDR_PERFILES_LOTES.md).
Este documento conserva la evidencia del bloque API anterior. Estado y evidencia
de la ampliación final: [cierre técnico LOCAL/BETA](B2B_FASE7_CIERRE_TECNICO.md),
separado del despliegue y la autorización fiscal oficial.

## Dos endpoints candidatos

| Operación | Endpoint | Permisos adicionales |
| --- | --- | --- |
| Preparar una guía numerada localmente | `POST /b2b/v1/guide-drafts/{id}/issuance` | `b2b:documents:read`, `b2b:guides:issue` |
| Consultar el resultado persistido | `GET /b2b/v1/guide-drafts/{id}/issuances/{operationId}` | `b2b:documents:read`, `b2b:guides:read`, `b2b:guide-operations:read` |

POST exige Bearer, `X-FactuEz-Actor-Kind: SERVICE|USER`, `If-Match` fuerte e
`Idempotency-Key` estable. El cuerpo contiene sólo `binding`: el par completo
del borrador y la serie fiscal vinculada. No acepta números, actor, banderas de
activación o XML del consumidor. No admite query. El borrador debe estar READY
en la revisión solicitada. El resultado 200 es un **commit local**, no un CDR.

GET no lleva cuerpo. Requiere diez parámetros planos: `issuerId`, `issuerRuc`,
`environment=BETA`, `branchId`, `pointId`, `seriesId`, `documentType`,
`guideSeriesId`, `guideType` y `fiscalSeriesId`. El `documentType` del ancla sigue
siendo 01/03, no se amplía el principal de ventas para simular un permiso de guía.
La operación se limita además al cliente y actor autenticados; conocer un UUID
no concede acceso. No prepara contexto ni asigna otro número.

Ambas respuestas incluyen snapshot íntegro, ítems, serie/número, operación y
hashes de integridad. No exponen los hashes de la clave idempotente/petición,
el token, datos de certificados o la representación interna de la concesión.
`replayed` es booleano para POST y nulo en GET. Cache HTTP: `private, no-store`.
Se rechazan duplicados/alias de cabeceras, parámetros duplicados, campos extra,
JSON inválido y respuestas del propietario inconsistentes.

## Autorización que no se hereda

Identity conserva una concesión independiente, versionada y auditada para
`{draft: {anchor, guideSeriesId, guideType}, fiscalSeriesId}`. Son tres series
distintas y una sola combinación RUC–sede–punto. Ni WRITE del borrador ni el
permiso 01/03 del ancla permiten reservar números por sí solos.

Un administrador con verificación reforzada puede reemplazar el conjunto con
CAS de revisión del cliente y de la concesión; un conjunto vacío revoca. Cambiar
la revisión del cliente invalida la concesión anterior hasta matricularla otra
vez. No se actualizan ni se amplían permisos de clientes existentes. El nuevo
scope sólo se añade al vocabulario máximo: la política predeterminada continúa
siendo la anterior, sin emisión de guías.

Un consumidor de sólo lectura puede matricular la tupla con los tres scopes
de consulta completos, sin recibir `b2b:guides:issue`. Su matrícula se contrasta
como READ y no le permite solicitar ISSUE. Se verifica tanto en el núcleo de
autorización como en la persistencia SQL; no se exige otorgar un permiso de
escritura latente a un lector.

Para SERVICE se conserva identidad humana nula. Para USER se comprueban usuario
activo, revisión vigente y permisos `document.view`/`document.issue` según la
acción, además de las tres series en su alcance asignado. Las comprobaciones
se repiten en los límites de la operación; una revocación impide devolver datos.

El registro y validación de concesiones usan los RPC privados de Identity:

- `GET/POST /internal/b2b/clients/{id}/guide-issue-grants` para administración.
- `POST /internal/b2b/authorize-guide-issue` para Billing.

Sus huellas mTLS de administración y propietario deben ser explícitas y
distintas. El catálogo propietario de Billing confirma el vínculo por RPC,
sin acceso directo de Identity a su base. ISSUE exige maestros/vínculo activos;
la disponibilidad del correlativo se exige dentro de la transacción del
productor. Agotar el último número no revoca el permiso necesario para devolver
su recibo o reintentarlo sin duplicar. READ permite slots inactivos/agotados para historia, pero
conserva la identidad exacta del vínculo y la autorización vigente. Ninguna
respuesta de catálogo acredita reglas oficiales o autenticidad de XML/CDR.

## Separación entre servicios

La fachada B2B revalida el principal antes y después de llamar al propietario.
Billing verifica otra vez el permiso independiente y es el único que accede a
su agregado y contador. Identity es el único que modifica sus concesiones.
Los RPC usan rutas fijas y transporte HTTPS/mTLS con validación TLS; no hay
destino configurable por petición ni fallback a HTTP.

`createAuthorizedCandidateGuideIssueProducer` compone el productor con el
adaptador privado real de autorización. Construirlo no consulta datos, aplica
DDL, inicia workers o registra endpoints. Los módulos se montan sólo mediante
ensamblaje explícito; `main`, Kong y el Swagger de localhost no se cambian en
esta entrega. El contrato actualizado está en
[OpenAPI candidato](b2b/openapi.candidate.v1.json), no en el servicio activo.

La persistencia de permisos dispone de revisión inmutable, CAS de cabecera,
auditoría en la misma transacción y rechazo de callbacks que intenten ocultar
fallos. El DDL es candidato y se ensaya exclusivamente en bases NUEVAS ficticias.
No se aplican migraciones ni se instalan concesiones del cliente.

## Límite fiscal y siguiente trabajo

El perfil sigue siendo 09/privado/04, con catálogo y clasificación local
explícitos. `numberReserved=true` no implica firma o aceptación. Permanecen
`fiscalExecutionEnabled=false`, `transmissionAuthorized=false`,
`officialRulesValidated=false`, `officialCdrVerified=false` y
`authorizedForTransfer=false`.

Siguen pendientes la integración de consulta/UI del sistema, XML numerado
definitivo y firma/PKI/CDR, reglas oficiales versionadas, perfil 31 completo,
referencias y lotes, worker autorizado y piloto/despliegue específico. Esta
entrega no cierra la fase 7 ni convierte PDF/XML locales en originales SUNAT.

Evidencia de pruebas: [verificación de API y permisos](B2B_VERIFICACION_API_GUIAS_2026-10-23.md).
