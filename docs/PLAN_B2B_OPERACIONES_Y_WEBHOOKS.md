# FactuEz — Plan de API B2B integral y webhooks

Fecha: 20/10/2026. Estado: **B2B-01 implementada en contratos/auditoría de fuente;
B2B-02 con núcleo/adaptadores y pruebas aisladas implementados; activación,
enrollment/SSO/MFA real pendientes. B2B-03 con lectura/extracción 01/03 candidata
implementada y probada en aislamiento; B2B-04 completada como implementación
técnica candidata: borradores y emisión atómica local 01/03. B2B-05 con circuito
candidato implementado/ensayado para notificación de emisión local 01/03;
otros productores de eventos y activación pendientes. B2B-06 con notas de venta,
conversión local atómica y registro de intenciones de corrección candidatos;
productor candidato individual F07/F08 sobre 01/PEN/BETA implementado y ensayado,
sin despliegue ni transmisión oficial. B2B-07 con productores persistentes locales
09/31, originales XML/firma/CDR, autoridad independiente, RC1/2/3/RA y APIs
candidatas implementados y cierre técnico LOCAL/BETA verificado el 23/10/2026.
B2B-08 con bloques candidatos de administración, clientes/productos, caja,
recepción SIRE/IMAP preparada, reportes 01/03/07/08/09/31/NV, configuración,
historial sintético y correo local/corporativo;
[entrega, cobertura y límites](B2B_FASE8_ENTREGA_TECNICA.md).
El [incremento integrado del 25/10/2026](B2B_FASE8_CIERRE_INTEGRACION.md) detalla
los adaptadores, contratos públicos, ensayos y configuración/piloto pendientes.
Paridad operativa completa y activación B2B-09 mantienen los pendientes detallados.
API B2B y webhooks todavía no operativos en el stack actual**.
Destino: sistema privado on-premise de Estaciones San José, con varios RUC y sedes.

Detalle del avance: [lectura y extracción B2B-03](B2B_FASE3_LECTURA_Y_EXTRACCION.md)
y [borradores y emisión B2B-04](B2B_FASE4_BORRADORES.md).
[Entrega parcial B2B-06 y bloqueos fiscales](B2B_FASE6_NOTAS_COMERCIALES_Y_CORRECCIONES.md). La prueba de código
no equivale a rollout, aceptación fiscal ni cierre de las etapas históricas 2/3.
[Evidencia de verificación](B2B_VERIFICACION_2026-10-20.md): regresión, tipos,
recorridos HTTPS y ensayos PostgreSQL nuevos/aislados.
[Continuación B2B-06 del 21/10](B2B_FASE6_AUTORIZACION_SERIES_NOTAS.md): autorización
explícita de series NC/ND candidata, sin activar productor fiscal ni cambiar grants.
[Verificación del 21/10](B2B_VERIFICACION_2026-10-21.md): resultados de regresión,
revisión de tipos y ensayos persistentes aislados, con límites de cada entrega.
[Evidencia propietaria 01/F07/F08](B2B_FASE6_EVIDENCIA_DOCUMENTO_PROPIETARIO.md):
continuación candidata de sólo lectura, sin activar notas ni promover flags a confianza.
[Composición de evidencia y resultados B2B-06](B2B_FASE6_COMPOSICION_Y_RESULTADOS.md):
RC/paquete, prerrequisitos, reserva sintética verificada y efectos financieros
candidatos; pendientes empresariales de integración todavía explícitos.
[Puente privado Billing–SUNAT](B2B_FASE6_PUENTE_PRIVADO_EVIDENCIA.md): lectura de
evidencia autenticada y callback de autoridad candidatos, sin compartir bases ni
habilitar emisión. Conserva bloqueos de lotes/historial no cubiertos por el par.

Las fases B2B-01 a B2B-09 de este documento son un proyecto nuevo. No reemplazan
las fases fiscales 2/3 ni las ocho fases anteriores de extracción privada.
Este plan no publica rutas, crea clientes técnicos, instala proveedores de
identidad, modifica bases, activa SUNAT ni cambia correlativos.

Entrega y límites de la primera fase: [B2B-01](B2B_FASE1_ENTREGA.md).
Entrega y gates de identidad: [B2B-02](B2B_FASE2_IDENTIDAD.md).

## 1. Objetivo y alcance

Convertir FactuEz en una plataforma **API-first/headless**: otra aplicación
autorizada podrá construir su propia interfaz y ejecutar las funciones de
negocio de FactuEz mediante contratos HTTP y recibir resultados por webhooks.
La PWA seguirá disponible; no se duplica el motor de facturación ni se convierte
el sistema en un SaaS público o multi-tenant.

«Cualquier servicio» significa cualquier tecnología capaz de consumir HTTPS
y el mecanismo de autorización acordado, **no cualquier cliente anónimo**.
Cada integración necesita alta, permisos, límites y alcance propios.

Se interpreta «SDR» como **CDR, Constancia de Recepción**. Si designa otro
documento, se incorporará como recurso distinto, no como alias de CDR.

### Qué se encontró en el código

| Bloque | Situación actual | Trabajo B2B necesario |
| --- | --- | --- |
| Extracción | Contrato de 17 operaciones; lectores/exportador ensayados aisladamente; Swagger publicado | Reutilizar sin romper URLs, scopes ni guards; activar sólo mediante piloto autorizado |
| Factura/boleta | Comando interno de Billing con permisos humanos, idempotencia, correlativo transaccional y Outbox; perfil limitado de desarrollo | Principal de integración verificable, contrato de comandos, borradores y operación asíncrona |
| Edición | Hay enums DRAFT y snapshots; eso no acredita un flujo completo de edición de borradores | Implementar ese flujo y bloquear modificaciones de comprobantes emitidos |
| Notas de venta | No se identificó un módulo comercial independiente implementado | Nuevo agregado no fiscal y conversión controlada a comprobante |
| NC/ND, RC/RA | Existen contratos, preparación/seguimiento y laboratorios; persisten gates fiscales | Exponer comandos empresariales sólo cuando su motor y perfil estén realmente habilitados |
| GRE 09 / GT 31 | Laboratorio/plantilla/diagnóstico no equivalentes a emisión empresarial completa | Completar sus agregados, ciclo de vida, reglas, persistencia y lectura empresarial |
| Sedes/puntos/series/productos | Existen controladores y reglas internas | Contrato externo estable con autorización de recursos en sus propietarios |
| Usuarios y acceso | Login humano y permisos locales; OAuth técnico de extracción separado y sólo de lectura | SSO/delegación segura y permisos específicos de escritura B2B |
| Webhooks | No se identificó un servicio de suscripciones/entregas; hay Outbox y colas internas | Nuevo servicio durable, fan-out independiente, firmas y control de destinatarios |
| Preparación fiscal | La activación oficial continúa explícitamente bloqueada en código | Mantener ese gate; no sustituirlo por permisos de API o existencia del certificado |

La implementación actual `IssueDocumentService.execute` exige `userId` humano.
No se conectará el ERP a ese guard fingiendo que es ADMIN: se generalizará el
contexto del caso de uso y su autorización dentro de Billing.

## 2. Arquitectura propuesta

Recomiendo **dos servicios nuevos**, manteniendo los propietarios actuales:

```text
Aplicaciones externas autorizadas (ERP, portal, móvil, otro backend)
          │ HTTPS + VPN / identidad de transporte aprobada
          ▼
         Kong
          ├── /b2b/v1/* ──► b2b-api-service (NUEVO)
          │                   ├── Identity: identidad y permisos vigentes
          │                   ├── Billing: maestros, borradores y emisión
          │                   ├── SUNAT: preparación, transporte y archivos
          │                   ├── Received: documentos de proveedores / SIRE
          │                   ├── Mailer: solicitudes de correo
          │                   └── Lectura/exportador: consultas y lotes
          └── /integration/v1/*: extracción existente, compatible y sólo lectura

Cada propietario ──► Outbox transaccional + publicación durable independiente
                                         │
                                         ▼
                               webhook-service (NUEVO)
                                  ├── BD de suscripciones/entregas
                                  └── BullMQ/worker ──HTTPS──► callback del cliente
```

### Responsabilidades

**b2b-api-service:** fachada de contratos, validación de entrada, contexto de
cliente/usuario, correlación, orquestación acotada y recursos de operaciones.
No tendrá credenciales de las BD de Billing/SUNAT ni acceso a P12, SOL, Redis
de emisión o volúmenes fiscales. Accederá por interfaces internas protegidas.
Un registro propio de operaciones, si es necesario, no sustituirá el registro
idempotente ni la transacción de negocio del propietario.

La reutilización de lectores no significa reenviar un token B2B al guard legado:
un adaptador de autorización explícito traducirá únicamente capacidades de
lectura equivalentes y conservará identidad/alcance verificables. Si hace falta
delegación interna o token exchange, será de audiencia y duración acotadas,
sin suplantar ADMIN y sin ampliar los permisos del token de extracción existente.

**webhook-service:** suscripciones, destinos verificados, secretos de firma,
Inbox de eventos, entregas, intentos, reintentos, dead-letter y replay auditado.
API de gestión y dispatcher pueden ser dos procesos/contenedores del mismo
servicio y paquete. No comparte tablas con Billing ni modifica documentos.

**Identity:** mantiene autorización, roles, grants por RUC/sede y revocación.
Se integrará con un proveedor OIDC mantenido para SSO; recomendación inicial:
Keycloak on-premise, sujeto a ADR de instalación, respaldo, recursos y migración
de cuentas. No se reemplazarán identidades/contraseñas existentes por sorpresa.
[Capacidades OIDC de Keycloak](https://www.keycloak.org/securing-apps/oidc-layers).

**Kong:** punto de entrada privado, rutas explícitas, autenticación de transporte,
límites de peticiones/tamaño y correlación. No contiene reglas fiscales ni
reemplaza los permisos que verifican los servicios propietarios.

### Monorepo

```text
services/
  b2b-api-service/        # nuevo NestJS: controladores, aplicación, puertos/adaptadores
  webhook-service/        # nuevo NestJS + worker: suscripciones, Inbox, entrega
  identity-service/       # puente OIDC, RBAC/grants, revocación
  billing-service/        # dueño de comandos y transacciones de negocio
  sunat-service/          # dueño de firma/transporte/evidencia
  integration-service/    # lector existente, sin convertirlo en emisor
  integration-export-service/
  received-documents-service/
  mailer-worker/
packages/
  b2b-contracts/          # nuevos DTO, esquemas, errores y scopes externos
  webhook-contracts/      # nuevos eventos y esquema de firma/versionado
  sdk-typescript/         # cliente de referencia posterior, generado/versionado
```

Cada base pertenece a un servicio. Compartir un servidor PostgreSQL no autoriza
a consultar tablas de otro propietario. No habrá transacción distribuida
ficticia: cada efecto se confirma localmente y se coordina con operaciones,
Outbox, Inbox e idempotencia.

## 3. Identidad: aplicaciones y personas son casos distintos

### A. Backend/servicio que opera por sí mismo

OAuth `client_credentials`, cliente confidencial, tokens cortos y audiencia
específica de B2B. Clave privada/secretos en el backend del cliente, no en SPA.
Actúa como **SERVICE**, con permisos explícitos para las operaciones necesarias.
Una aplicación que sólo consulta no recibe permiso para emitir o administrar.

### B. Persona que inicia sesión en otra aplicación

OIDC Authorization Code + PKCE mediante redirección al proveedor de identidad.
La otra aplicación no recopila ni guarda la contraseña de FactuEz. Usar librerías
OIDC mantenidas; redirects exactos, state/nonce, validación del emisor y tokens.
Un BFF puede mantener tokens/refresh en servidor y sesión HttpOnly segura.
No usar flujo password/ROPC ni transportar sesiones PWA como credencial B2B.
[OAuth Security BCP, RFC 9700](https://www.rfc-editor.org/rfc/rfc9700.html).

Los endpoints OAuth/OIDC efectivos se descubren desde un issuer fijo y aprobado;
no se inventará una URL `/login` que reciba contraseñas de servicios externos.
La migración/puente a las cuentas locales tendrá su ADR y pruebas específicas.

### Autorización efectiva

Para acciones delegadas: **permisos del cliente ∩ permisos del usuario ∩
alcance de RUC/sede/punto/serie/tipo ∩ política y estado de negocio/fiscal**.
Para SERVICE se aplica su grant propio, sin atribuirle un usuario ficticio.

- Token nuevo con audiencia `factuez-b2b-v1`; el token actual
  `factuez-integration-v1` conserva sólo lectura y no gana escritura.
- Validación de issuer, audience, algoritmo/clave, expiración, cliente, usuario
  cuando corresponda y revisión vigente de permisos. No aceptar `userId`, rol,
  RUC o `X-User-*` del request como prueba de identidad.
- Contexto interno autenticado hasta cada propietario; no sólo un check en Kong.
- Seleccionar sede es elegir un recurso autorizado, no ampliar permisos.
  `/me` y `/capabilities` mostrarán el alcance real y perfiles disponibles.
- Auditar aplicación, actor humano si existe, RUC/sede, operación, entidad,
  requestId y commandId. Evitar XML completos, contraseñas o datos personales
  innecesarios en logs.
- Administración de roles, certificados y configuraciones críticas: permisos
  separados, alcance administrativo explícito y sesión humana con step-up/MFA.
  No entregar esa facultad a todos los clientes técnicos.

## 4. Reglas del contrato: editar no es reescribir un comprobante

**Borradores:** crear, editar con versión/ETag, validar, cancelar o eliminar según
política de auditoría. No reservan correlativo fiscal ni generan XML firmado.

**Emisión:** una acción explícita valida el perfil y reserva una sola identidad
en la transacción de Billing. Desde ese commit, cabecera, cliente, ítems,
importes, RUC, serie y número quedan congelados, incluso si SUNAT está pendiente.

**Comprobantes emitidos:** sin PATCH libre ni DELETE físico. Las correcciones
se expresan como NC/ND, solicitudes de baja u otro procedimiento aplicable al
tipo y estado; no como sobrescritura de XML/CDR. SUNAT contempla notas vinculadas
a facturas/boletas; los motivos, condiciones y plazos se validarán en el perfil
fiscal correspondiente, sin generalizar una regla para todos los documentos.
[SEE del contribuyente](https://cpe.sunat.gob.pe/sistema_emision/see_contribuyente).

Metadatos operativos ajenos al contenido fiscal, si pueden editarse, tendrán
su recurso y versión propios; nunca modificarán el snapshot original.

**Notas de venta:** se diseñarán como documentos comerciales internos claramente
rotulados NO FISCALES, con numeración independiente. Conversión a factura/boleta
mediante comando idempotente y vínculo trazable. Alcance inicial propuesto:
una conversión completa por nota; parciales requerirían otro perfil explícito.
No presentar una nota de venta como tipo SUNAT 03 ni reutilizar sus correlativos.

**Series:** el cliente selecciona un ID autorizado; Billing resuelve y valida
la asociación RUC–sede–punto–serie. No puede elegir el próximo número, resetear
contadores ni trasladar una serie histórica por una actualización genérica.

**Archivos:** XML firmado/CDR originales, ZIP de envío y PDF de consulta son
recursos diferentes. Hash, confianza, aceptación y procedencia son estados
separados. PDF bajo demanda puede cambiar de diseño, no de hechos fiscales.
No enviar un CDR de lote si no se autoriza a todos sus miembros.

## 5. Familias de endpoints propuestas

**Propuestas, no rutas disponibles todavía.** Prefijo nuevo `/b2b/v1`.
Las consultas equivalentes reutilizarán el caso de uso de lectura existente;
no se hará un proxy genérico de URLs internas aportadas por el consumidor.

| Familia | Operaciones propuestas |
| --- | --- |
| Identidad/contexto | `GET /me`, `/capabilities`, `/issuers`, `/branches`, `/points`, `/series` |
| Clientes/productos | `GET/POST /customers`, `GET/PATCH /customers/{id}`; productos equivalentes con desactivación auditada |
| Borradores | `POST /document-drafts`, `GET/PATCH /document-drafts/{id}`, `POST /document-drafts/{id}/validate`, `/issue`, `/cancel` |
| Comprobantes | `GET /documents`, `/documents/{id}`, `/documents/lookup`, `/documents/{id}/status` |
| Correcciones | `POST /credit-notes`, `/debit-notes`, `/void-requests`; estado y detalle de cada solicitud |
| Notas de venta | `POST/GET /sales-notes`, `GET/PATCH /sales-notes/{id}`, `POST /sales-notes/{id}/complete`, `/convert`, `/cancel` |
| Guías | `POST/GET /dispatch-guides` (09), `/carrier-guides` (31); borradores, validación y acciones explícitas de emisión/corrección por perfil |
| Resúmenes/bajas | `POST/GET /daily-summaries`, `/void-requests`; miembros, operación y evidencia |
| Archivos | `GET /documents/{id}/artifacts`, `/batches/{id}/artifacts`, `/artifacts/{id}/content`; representaciones actuales explícitas |
| Exportación/cambios | `/exports`, `/exports/{id}/manifest`, `/exports/{id}/content`, `/changes`, compatibles con cortes y permisos |
| Operaciones | `GET /operations/{id}` y consulta por referencia externa/idempotencia para recuperar respuestas perdidas |
| Correo | `POST /documents/{id}/email-deliveries`, consulta de entrega; aceptación SMTP no equivale a recepción final |
| Recepción | `GET /received-documents`, detalle por ítem y originales; solicitudes de sincronización SIRE/correo bajo autorización |
| Reportes | `POST /report-jobs`, `GET /report-jobs/{id}` y descarga privada temporal, con filtros y límites |
| Turnos/caja | Apertura/cierre, movimientos y consultas, después de inventariar su caso de uso real; no convertir un enum en funcionalidad |
| Formatos/logos | Consulta/edición autorizada por RUC/sede, previsualización y revisión de presentación |
| Administración | Recursos específicos de sedes/puntos/series/usuarios/roles, segregados por capacidad y sin cambios de dueño/contador implícitos |
| Configuración fiscal | Consulta de presencia/readiness/auditoría; carga/reemplazo/retiro por un plano administrativo privilegiado; jamás descarga de P12 o claves |
| Webhooks | `POST/GET /webhook-subscriptions`, `PATCH /webhook-subscriptions/{id}`, `/verify`, `/rotate-secret`; entregas y replay bajo permiso |

No se exponen SQL, Redis, workers, admin de Kong, secretos, rutas del disco,
reinicios de correlativos o endpoints de laboratorio como funciones comerciales.
Los procesos de diagnóstico/simulación conservan otro plano y otra autorización.

Para imprimir desde otra aplicación, la API entrega PDF/ticket y parámetros de
papel; el navegador/cliente imprime en sus dispositivos. No se promete controlar
cualquier impresora remota desde el servidor. Un agente local sería otro alcance.

### Convenciones obligatorias

- Contratos versionados, DTO de lista blanca y error estructurado con requestId.
- Decimales como texto, fechas de negocio explícitas y zona America/Lima.
- Contexto de RUC/ambiente explícito; no depender de la sede seleccionada en una
  pestaña distinta ni de una variable global del servidor.
- Escrituras con `Idempotency-Key`, hash del contenido normalizado y commandId
  estable. Misma clave y otro cuerpo: 409; misma clave/cuerpo: misma operación.
- El propietario de negocio conserva su deduplicación transaccional. Un timeout
  de la fachada no permite emitir otra vez si Billing ya confirmó el comando.
  Referencia externa única con namespace de origen y emisor para conciliación.
- PATCH con revisión/ETag; conflicto explícito, no «último que guarda gana».
- Paginación/cortes/expiración/cobertura explícitos; ningún límite silencioso.
- En emisión/transporte/correo/reportes: `202 + operationId` significa solicitado,
  no aceptado por SUNAT ni enviado al destinatario. Consultar o recibir evento.
- Separar estado de operación y estado fiscal. Estados de operación propuestos:
  RECEIVED, VALIDATING, COMMITTED, WAITING_EXTERNAL, SUCCEEDED, FAILED y
  UNKNOWN_REQUIRES_RECONCILIATION. SUCCEEDED describe el comando solicitado,
  no una aceptación fiscal implícita.
- Las colas no contienen tokens Bearer ni contraseñas. Conservar commandId y
  referencias de actor/cliente; revalidar autorización vigente al ejecutar un
  trabajo pendiente. Revocar no deshace hechos ya confirmados: éstos conservan
  su evidencia y auditoría, sin prometer atomicidad global entre servicios.
- Operación ambigua por pérdida de respuesta: conciliación por commandId antes
  de reintentar el efecto; no generar otro número ni prometer exactly-once global.
- OpenAPI por plano y AsyncAPI/esquemas para eventos. Diferenciar propuesto,
  implementado, probado, desplegado y habilitado; capabilities no se deduce de enums.

## 6. Webhooks: resultados confiables, no mensajes sueltos

### Flujo

1. Cambio de negocio + evento Outbox se guardan en una transacción del propietario.
2. Publicador independiente entrega el evento; webhook-service registra su Inbox
   y crea entregas autorizadas en su BD antes de confirmar recepción.
3. Worker BullMQ despacha una entrega por suscripción, con firma y límites.
4. El receptor verifica firma/fecha, deduplica y guarda durablemente antes de 2xx.
5. Fallos producen reintentos; agotados, pasan a dead-letter con replay auditado.

**No conectar este worker como consumidor de `sunat-submissions` ni de la cola
de actualización de estados:** competiría con consumidores existentes.
La publicación Outbox actual usa un `publishedAt` por evento. Para fan-out habrá
tracking transaccional por destino/canal o publicaciones independientes; no
marcar todo publicado después de entregar sólo a SUNAT o sólo al webhook.
Los eventos internos pueden contener snapshots completos: se transforman al
contrato mínimo externo, no se reenvían íntegros al callback.

### Eventos iniciales propuestos

- `document.created.v1`, `document.issued-locally.v1`.
- `document.tax-transport-updated.v1`, `document.tax-acceptance-verified.v1`.
- `document.tax-rejection-verified.v1`, `document.artifact-available.v1`.
- `credit-note.updated.v1`, `debit-note.updated.v1`, `guide.updated.v1`.
- `export.ready.v1`, `email.delivery-updated.v1`, `received-document.imported.v1`.

Un evento «acceptance-verified» sólo se produce con evidencia oficial verificada;
no se traduce automáticamente ACCEPTED del emulador o un código 0 almacenado.
Cada evento conserva ambiente y procedencia. La regeneración de un PDF en caché
no emitirá eventos ilimitados: se notifica la revisión de formato o un artefacto
estable cuando corresponda.

Payload mínimo, sin XML/PDF adjunto, nombres de clientes o secretos:

```json
{
  "schemaVersion": "factuez.b2b.event.v1",
  "id": "<EVENT_UUID>",
  "type": "document.artifact-available.v1",
  "occurredAt": "<INSTANTE_UTC>",
  "issuerRuc": "<RUC_AUTORIZADO>",
  "branchId": "<BRANCH_UUID>",
  "environment": "BETA",
  "documentId": "<DOCUMENT_UUID>",
  "resourceVersion": "<VERSION>",
  "data": { "artifactId": "<ARTIFACT_UUID>", "kind": "CDR_XML" }
}
```

Los marcadores no son datos reales ni un mensaje listo para enviar. El consumidor
usa su token vigente para recuperar el recurso; no recibe URLs públicas o tokens
en el webhook. Una notificación histórica no otorga permiso de descarga actual.

### Firma, entrega y recuperación

Adoptar Standard Webhooks: `webhook-id`, `webhook-timestamp`,
`webhook-signature`; firma de ID + timestamp + **bytes exactos** del cuerpo con
HMAC-SHA256, SDK/verificador mantenido y secreto independiente por suscripción.
Rotación con ventana acotada de claves; verificación de fecha y comparación
segura. Se propone tolerancia de 5 minutos, no una garantía universal del receptor.
[Especificación Standard Webhooks](https://github.com/standard-webhooks/standard-webhooks/blob/main/spec/standard-webhooks.md).

- eventId de negocio estable; deliveryId por suscripción estable entre reintentos;
  attemptId nuevo por intento. `webhook-id` identifica la entrega lógica.
- Entrega **al menos una vez**, sin garantizar orden global. Duplicados y eventos
  fuera de orden se manejan con Inbox/eventId y versión del recurso.
- Propuesta inicial: timeout de 10 s, máximo ocho intentos en 24 h, backoff
  exponencial con jitter y Retry-After acotado. Ajustar con pruebas/contrato.
- Cada reintento firma el cuerpo conservado con timestamp nuevo. Cambios de
  suscripción/destino/permisos se revalidan; no enviar eventos en cola a un RUC
  que ya no está autorizado. Replay no amplía audiencia ni contenido.
- BD como fuente durable de entregas. Caída/pérdida de Redis no debe perderlas.
- Si el receptor acepta el evento pero se pierde su 2xx, recibirá un duplicado:
  responder sin repetir efectos de negocio.
- Si un cliente no puede alojar un callback accesible, ofrece recuperación por
  `/changes` y consultas; un webhook necesita conectividad real hacia su receptor.
  El feed existente cubre su dominio de emitidos. Las entidades nuevas, como
  notas de venta o maestros, necesitan un feed/event journal B2B versionado;
  no se les asignan checkpoints de un contrato de extracción que no las contempla.

### Seguridad del destino

HTTPS obligatorio y destinos aprobados por TI. Preferir callbacks por VPN;
un callback externo explícitamente autorizado puede recibir salida HTTPS sin
publicar FactuEz a Internet. Allowlist de hostname, puerto y destino; rechazo de
userinfo, redirecciones, loopback, link-local y metadata. Resolver A/AAAA, validar
contra la política y fijar la conexión a la dirección aprobada con TLS/SNI
correctos; revalidar cambios de DNS y cubrir IPv4/IPv6/DNS rebinding.

Una IP privada sólo se admite por autorización concreta del callback VPN, no
por permitir toda la LAN. El worker tendrá egress limitado: registrar una URL
no debe permitir explorar BD, Redis, Identity u otros servicios internos.
Los challenges y pruebas de destino usan el mismo camino seguro que la entrega.
[OWASP Webhook Security](https://cheatsheetseries.owasp.org/cheatsheets/Webhook_Security_Cheat_Sheet.html).

## 7. Persistencia prevista

Se preparará el modelo y migraciones aditivas en su fase, no en este plan:

- **Identity:** ClientApplication, capacidades/grants versionados, vínculo OIDC,
  revocación/auditoría y políticas administrativas; reutilizar lo existente.
- **Billing:** DraftDocument y versiones, SalesNote y conversión, registro
  idempotente de comandos/referencias, actor tipado, Outbox por destino. No duplicar
  Document, SeriesCounter o su autoridad en la fachada.
- **B2B:** registro mínimo de operación/orquestación si aporta recuperación,
  con commandId/owner y resultado seguro, no una copia fiscal alternativa.
- **Webhook:** Subscription, EventInbox, Delivery, DeliveryAttempt, SigningKeyVersion
  cifrada, DestinationVerification, auditoría y dead-letter/replay.
- **SUNAT/Received/Mailer:** sus propios comandos, eventos, referencias y permisos;
  sin claves foráneas entre bases ni lectura cruzada de tablas.

Backups y protección de claves se diseñan junto a cada almacén. Definir retención
por clase; no caducar la deduplicación de un comando fiscal como si fuera una
caché prescindible. No purgar originales al limpiar operaciones/webhooks.

## 8. Fases y criterios para avanzar

### B2B-01 — Inventario de funciones y contrato

Entregables: matriz pantalla/acción → caso de uso → propietario → rol/scope →
estado → endpoint/evento; ADR de límites, vocabulario, rutas y versionado;
OpenAPI propuesto y catálogo de eventos. Inventariar turnos, caja, clientes,
notas de venta, reportes y administración sin asumir que ya existen.

Aceptación: cada función solicitada queda como reutilizable, requiere adaptar,
nueva o expresamente no exponible. Ningún endpoint futuro se anuncia operativo.
El alcance de la primera entrega vertical queda definido sin activar nada.

### B2B-02 — Identidad y autorización

Entregables: registro de aplicaciones, audiencias/scopes de comandos, grants y
actores SERVICE/USER; puente OIDC/PKCE y ADR del proveedor; revocación y auditoría.
Adaptadores internos que no aceptan tokens humanos por suplantación.

Aceptación: token lector no emite; cliente desactivado queda bloqueado; un usuario
no sale de sus sedes ni usa una aplicación con más permisos para elevar los suyos.
SSO se prueba sin entregar contraseñas al cliente externo. Migración de cuentas
real separada y reversible; no imponer un cambio de login al QA existente.

### B2B-03 — Catálogos, lectura y archivos

Entregables: `/me`, capabilities, emisores/sedes/puntos/series, clientes/productos
disponibles, detalle, XML/CDR/PDF y reutilización del lector/exportador/feed.
Permisos de campos, paginación y estado real por tipo/fuente.

Aceptación: otra app puede elegir una sede autorizada y consultar todos los
resultados del corte. Hash/tamaño de descarga correctos, archivos de lote
íntegramente autorizados y ninguna clave/ruta de disco en respuesta.

### B2B-04 — Borradores y emisión 01/03

Estado: implementación técnica candidata completada; ensayo SQL real en BD
NUEVA/sintética y recorridos HTTPS/mTLS. No rollout en el stack actual ni envío
oficial. [Detalle y evidencia](B2B_FASE4_BORRADORES.md).

Entregables: nuevo b2b-api-service, borradores versionados, validación,
idempotencia end-to-end, contexto de actor en Billing, operación asíncrona y
eventos de commit. El propietario mantiene la reserva de correlativo y Outbox.

Aceptación: una solicitud repetida/concurrente crea una sola operación/identidad;
si se pierde la respuesta se recupera sin volver a numerar. Un borrador no
consume correlativo; un documento emitido no admite edición fiscal libre.
Ensayo en BD/almacenamiento aislados con datos sintéticos y fiscal oficial bloqueado.

### B2B-05 — Webhooks de extremo a extremo

Avance: [circuito candidato y límites](B2B_FASE5_WEBHOOKS.md), con Inbox,
dispatcher, firma SDK, destino aprobado, permisos vigentes y pruebas PostgreSQL
nuevas. Sólo evento de emisión LOCAL 01/03; el catálogo de diseño completo no
equivale a productores activos ni a habilitación fiscal.

Entregables: webhook-service, Outbox fan-out sin consumidores competidores,
suscripciones/destinos/firmas, entrega durable, reintentos, dead-letter, replay,
panel de estado y receptor de referencia aislado. Contrato AsyncAPI/esquemas.

Aceptación: evento posterior al commit; firma/replay verificados; caída del
receptor/Redis/reinicio no pierde entregas; duplicados no repiten efectos;
revocación corta pendientes y destino malicioso no accede a la intranet.

**Primer hito utilizable:** otra aplicación inicia sesión o se autentica como
servicio, selecciona sede, crea un borrador, solicita emisión local, consulta
resultado, obtiene un webhook firmado y descarga los archivos que realmente
existan. Un CDR simulado nunca se presenta como oficial.

### B2B-06 — Notas de venta y correcciones

Avance técnico candidato: [productor empresarial y journal dinámico V2](B2B_FASE6_PRODUCTOR_Y_JOURNAL_V2.md).
NV/conversión e individual F07/F08 BETA implementados y ensayados; sin despliegue
ni activación fiscal. Perfiles fuera del par y notas B/RC/RA siguen bloqueados
antes de numerar y requieren su circuito de lotes B2B-07. Esto no cierra las
fases fiscales históricas 2/3 ni autoriza producción.

Entregables: nota de venta comercial independiente, conversión idempotente,
NC/ND empresariales y solicitudes de baja con referencias/estados/reglas.
No envolver el laboratorio como productor fiscal empresarial.

Aceptación: no doble conversión, no doble efecto contable por reintentos,
referencias e importes consistentes, correcciones auditadas y originales intactos.
Perfiles no habilitados se rechazan antes de consumir numeración o transmitir.

### B2B-07 — Guías y lotes

Actualización 23/10: [cierre técnico LOCAL/BETA y evidencia](B2B_FASE7_CIERRE_TECNICO.md).
Estado: **B2B-07 cerrada técnicamente**; 9.910 pruebas aprobadas, cero fallos y
ensayos PostgreSQL/criptográficos aislados satisfactorios. Sin activación fiscal.
El alcance implementado incluye propietario persistente 31, referencia pública09,
autoridad de tres series y lotes RC1/2/3/RA con SERVICE/USER, archivos originales
y composición HTTPS/mTLS opt-in. No se activó el stack ni la transmisión oficial.
La evidencia de los bloques anteriores se conserva a continuación como historial.

Avance 21/10: [primer bloque, borradores independientes 09/31](B2B_FASE7_GUIAS_BORRADORES.md)
implementado y ensayado con permisos explícitos, revisión e idempotencia.
No equivale a los entregables fiscales completos ni al cierre de esta fase.
[Segundo bloque, preparación local UBL 09 privado/04](B2B_FASE7_PREPARACION_UBL09.md):
preflight autorizado y sin efectos, con XML de ensayo estructural independiente;
no reserva número, firma, acepta catálogos ni autoriza traslado.
[Tercer bloque, mapa local de establecimientos](B2B_FASE7_MAPA_ESTABLECIMIENTOS.md),
22/10: registro versionado/auditado y guard estricto opcional, sin promover una
configuración local a registro o validación SUNAT.

Entregables: completar el ciclo empresarial 09/31, catálogos/transporte/actores,
persistencia, operaciones y archivos; RC/RA según tipo/estado. El contrato del
lector se amplía sólo cuando exista la fuente, no por quitar UNSUPPORTED.

Aceptación: guía completa y vinculada, lectura y archivos empresariales coherentes,
sin plantar XML o CDR del emulador como originales. Pruebas de lotes completos,
autorización de todos los miembros y recuperación de respuestas ambiguas.
La transmisión oficial requiere su gate propio, no queda autorizada por esta fase.

### B2B-08 — Resto funcional y administración delegada

Primer bloque técnico terminado el 24/10/2026: consulta de recibidos con detalle
XML y descarga de originales, permisos de recepción independientes y SDK de
lectura. [Evidencia y matriz de pendientes](B2B_FASE8_RECEPCION_Y_SDK.md).
Esto no cierra la fase completa ni activa rutas en el stack actual.

Entregables: recepción de proveedores con ítems/XML, SIRE/correo bajo permisos,
reportes, solicitudes de email, turnos/caja según inventario, formatos/logos,
gestión autorizada de clientes/productos y maestros/acceso. Panel para gestionar
aplicaciones y webhooks sin revelar secretos. SDK TypeScript y ejemplos HTTP
para consumidores de otras tecnologías.

Aceptación: matriz de paridad funcional completa con pruebas por caso y rol;
sin endpoints ficticios para funciones aún no implementadas. Administración
privilegiada exige su política; ningún client_credentials recibe ADMIN global
por pedirlo. Un proveedor recibido no se mezcla con ventas emitidas.

### B2B-09 — Seguridad, operación y piloto privado

Destino actualizado el 26/10/2026: Ubuntu Server 24.04 amd64 en VPS compartido.
Este destino sustituye el autoinicio Windows de esta entrega B2B-09. Límite
agregado de contenedores: 8.000.000.000 bytes; puertos sólo loopback 9000–9099;
Docker/containerd y datos fuera de `/var`. Se debe entregar y revisar el Compose
antes de levantar nada allí. [Paquete de revisión](B2B_FASE9_VPS_UBUNTU.md) y
[avance de integración](B2B_FASE9_CIERRE_OPERATIVO_UBUNTU.md).

Incremento 26/10/2026: [rotación optativa de la clave JWT de Identity](B2B_FASE9_ROTACION_CLAVES_IDENTITY.md),
con clave pública anterior por un máximo de cinco minutos, JWKS privado y
revocación vigente. Ensayada con claves ficticias y reinicio HTTP/mTLS; sin
despliegue ni rotación real. No sustituye la rotación de TLS, vault o respaldos.

Incremento 26/10/2026: [retención privada de archivos de reportes](B2B_FASE9_RETENCION_REPORTES.md),
implementada con auditoría, idempotencia conservada y respuesta 410 autorizada.
Ensayos nuevos aislados; no activada en instalaciones existentes. Continúan los
otros almacenes y controles operativos de esta fase.

Primer incremento del 25/10/2026 (Lima): [control operativo, política local y ensayo
del consumidor](B2B_FASE9_CONTROL_OPERATIVO.md). Implementa pausa/cuotas/drain y
métricas privadas; no equivale al cierre de esta fase ni al despliegue real.

Segundo incremento del 26/10/2026: [cápsula cifrada y restauración de perfiles
de reportes, recepción y correo](B2B_FASE9_RESPALDO_RECUPERACION.md), con bases
de origen/destino nuevas y corrección candidata de resolución SQL. Su alcance
es sintético y parcial; no se presenta como respaldo integral de la instalación.

Tercer incremento del 26/10/2026: [mantenimiento local de workers y recuperación](B2B_FASE9_MANTENIMIENTO_WORKERS.md).
El cierre espera el trabajo fuera de SQL y su journal. No añade rutas públicas,
grants ni autorización global de respaldo/corte.

Entregables: regresión/contratos, seguridad/SSRF y cargas, observabilidad,
respaldo/restauración, rotación de claves, límites, retención y apagado de una
integración; VPN/Kong/HTTPS, autoinicio Windows y runbook; cliente de referencia
que demuestre uso sin depender de la PWA. Migraciones y despliegue autorizados,
aditivos, por servicio y con reversión de configuración.

Aceptación: ensayo de principio a fin con app consumidora autorizada, conciliación
de documentos/archivos, corte de conectividad y recuperación sin dobles efectos,
revocación efectiva y rollback probado. Activar primero piloto privado Beta.
La activación fiscal oficial/producción necesita autorización y evidencia
independientes; este plan mantiene la restricción actual de no usar producción.

## 9. Pruebas transversales obligatorias

1. Contratos OpenAPI/AsyncAPI, rutas efectivas, compatibilidad y fixtures versionados.
2. Aislamiento por RUC/sede/punto/serie/tipo; grants no combinables; acceso por ID
   ajeno; audiencia/emisor incorrectos; tokens vencidos y clientes/usuarios revocados.
3. PKCE/state/nonce/redirects, sesión de usuario y step-up administrativo.
4. Dos clientes emitiendo sobre la misma serie, reintento simultáneo y cambio de
   configuración/permiso durante la operación. No duplicar ni reusar correlativos.
5. Caída después del commit pero antes del 202/publicación/ack; conciliación de
   operación y reconstrucción del despacho sin repetir la transacción de negocio.
6. Webhook con firma inválida, cuerpo alterado, fecha fuera de ventana, duplicado,
   reordenación, clave rotada, endpoint caído, permiso revocado y replay indebido.
7. SSRF: redirects, DNS rebinding, IPv4/IPv6, puertos, hosts y destinos internos.
8. Integridad y propiedad de XML/CDR/ZIP, RC/RA múltiples, faltantes, snapshots
   incoherentes y revisión de PDF cambiada; sin sustitución silenciosa.
9. Fallos de auditoría/Identity/DB/Redis: bloquear o recuperar de forma explícita,
   no entrar en modo permisivo. Logs y errores sin secretos.
10. Prueba de paridad: realizar el flujo desde una app consumidora, no desde
    controladores internos ni insertando filas manuales para simular funcionalidad.

## 10. Orden recomendado y límites de cierre

Orden: B2B-01 → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 09.
Contratos, pruebas y diseño del worker de eventos pueden prepararse en paralelo,
pero no adelantar emisión a identidad, ni callbacks a validación de destinos.
La primera entrega completa de valor es el hito al finalizar B2B-05; después se
extiende la cobertura, conservando compatibilidad y las capacidades reales.

Puedo programar contratos, servicios, adaptadores, pruebas sintéticas, panel,
SDK y despliegue candidato sin recibir nuevas claves de negocio. TI deberá
autorizar/configurar red de destino, identidades, callbacks, permisos, certificados
y piloto real por canales seguros. Contabilidad valida los efectos/procedimientos
fiscales y cualquier corte que corresponda. No bloquear diseño/programación por
esos datos, pero no dar por realizada su aprobación.

Finalizar B2B no significa por sí solo cerrar la homologación fiscal, migración
histórica o activación oficial pendientes. Las funcionalidades que dependan de
un motor fiscal incompleto requieren completarlo y verificarlo, no sólo añadir
un endpoint o un webhook.

Referencias de diseño adicionales:

- [AsyncAPI 3.0](https://www.asyncapi.com/docs/reference/specification/v3.0.0).
- [Swagger y extracción actual](SWAGGER_Y_CONEXION_PRIVADA.md).
- [Operación privada Windows](INTEGRACION_PRIVADA_WINDOWS_OPERACION.md).
- [Estado y gate fiscal](ETAPA2_REVISION_Y_GATE.md).
