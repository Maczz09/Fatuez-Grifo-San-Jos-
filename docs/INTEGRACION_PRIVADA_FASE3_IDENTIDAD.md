# API privada de extracción — fase 3: identidad técnica

Fecha: 2026-10-09. **Implementación local verificada, activación deshabilitada.**
Esta es la fase 3 de la nueva API privada, no la etapa fiscal ni la migración del
historial. No cierra esos gates ni confirma aceptación de comprobantes por SUNAT.

## Resultado

Identity conserva la propiedad de las identidades y sus tablas. Se añadió un
programa opt-in separado del arranque de sesiones humanas: `dist/integration/main.js`.
El `AppModule`, la PWA, Kong y los contenedores existentes no se modificaron ni
desplegaron. No se creó otro monolito ni se concedió un rol ADMIN a un ERP.

- Clientes técnicos con UUID, etiqueta, scopes explícitos y grants por tupla
  RUC–BETA–tipo–sede–punto–ID de contador de serie. No se combinan permisos de
  diferentes tuplas ni se aceptan RUC ficticios `00...` en la configuración operativa.
- Secretos aleatorios de 256 bits, entregados **una sola vez** al crear/rotar.
  PostgreSQL guarda HMAC-SHA256 con pepper independiente, no el secreto ni claves SOL.
  Los listados nunca devuelven el hash o el secreto anterior. Conservar el pepper
  en respaldo protegido: cambiarlo implica reprovisionar/rotar los secretos.
- OAuth `client_credentials` con Basic y scopes obligatorios; sin refresh token,
  login de usuario, cookies, rol humano ni permisos de emisión.
- JWT RS256 `typ=at+jwt`, audiencia `factuez-integration-v1`, issuer HTTPS fijo,
  clave RSA propia de al menos 2048 bits y duración máxima de 300 segundos.
  `kid` local; no se aceptan claves/URLs introducidas en la cabecera del token.
- Verificación de firma **y consulta transaccional de estado/revisión/permisos
  actuales** por petición. Rotar, desactivar, reactivar o editar permisos incrementa
  revisión y rechaza los tokens anteriores en la siguiente comprobación.
  No basta con verificar JWKS ni esperar cinco minutos. No se puede retirar
  información que ya fue entregada antes de la revocación.
- Guard de integración explícito, sin reutilizar el guard de usuarios.
  Ruta sin política declarada: denegada. El guard autentica; la fase 4 deberá además
  resolver el propietario canónico del recurso y comprobar sus grants completos.
- Actualización con revisión esperada y bloqueo `FOR UPDATE`. Auditoría de
  creación/cambios/rotación, emisión de tokens y comprobaciones autenticadas dentro
  de la misma transacción. Si falla la auditoría, no se entrega secreto/token ni se
  confirma el cambio. No hay caché permisiva ni fallback si falla PostgreSQL.
- Cuotas PostgreSQL atómicas: 60 solicitudes de token/minuto por peer, 30/minuto
  por cliente válido y 300 comprobaciones/minuto por cliente. Una fila por clave,
  sin generar infinitos buckets por IDs desconocidos. HTTP 429 con `Retry-After`.
  Los valores son límites iniciales de servidor, no parámetros del consumidor.

La autenticación Basic de un cliente confidencial sigue el flujo de
[RFC 6749](https://www.rfc-editor.org/rfc/rfc6749.html#section-4.4). El perfil
de access token y la separación de audiencia/tipo siguen
[RFC 9068](https://www.rfc-editor.org/rfc/rfc9068.html). El transporte privado
añade autenticación TLS mutua, acorde con la recomendación de autenticación
asimétrica de clientes de [RFC 9700](https://www.rfc-editor.org/rfc/rfc9700.html).
Esto no constituye una certificación OAuth externa.

## Transporte y endpoints implementados

El programa separado sólo permite **127.0.0.1** en esta fase. Exige TLS >=1.2,
certificado cliente confiable para la CA configurada y fingerprint SHA256
autorizado por plano. No acepta `X-Forwarded-Proto`, `X-User-Id`, CORS público,
TLS desactivado ni puertos Internet. El certificado de transporte es **distinto**
del certificado fiscal SUNAT; no solicitar/importar P12 del emisor para este fin.

| Plano | Endpoint | Autorización adicional |
| --- | --- | --- |
| Token | `POST /integration/oauth/token` | peer TLS token + Basic client ID/secret |
| Recurso interno | `POST /internal/integration/introspect` | peer TLS recurso + Bearer técnico + `requiredScopes` JSON |
| Recurso interno | `GET /internal/integration/jwks` | peer TLS recurso; sólo clave pública |
| Administración interna | `GET /internal/integration/clients` | peer TLS admin + Bearer humano vigente |
| Administración interna | `POST /internal/integration/clients` | lo anterior + catálogo canónico para grants |
| Administración interna | `PATCH /internal/integration/clients/:id` | lo anterior + `expectedRevision` |
| Administración interna | `POST /internal/integration/clients/:id/rotate` | lo anterior + `expectedRevision` |

Todos los resultados y errores usan `private, no-store`; tokens/secretos no van
en URL. JSON administrativo limitado a 32 KiB; formulario OAuth a 2 KiB, sin
credenciales en el cuerpo. No se publican stacks, consultas SQL, respuestas de
SUNAT ni rutas. Las rutas internas **nunca** se deben exponer al ERP o Internet.

Administración comprueba firma, usuario/sesión activa y versión de autorización
actuales. Requiere ADMIN, alcance GLOBAL y `setup.manage`, `user.manage`,
`document.view`. Cliente técnico, gestor de sede y sesión revocada no administran.
El listado es de metadatos (máximo 1.000; exceso devuelve error, no trunca en silencio).

Auditoría contiene únicamente UUIDs de cliente/actor/petición, hash protegido del
peer, acción, resultado, revisión y fecha. No cuerpos XML, nombres del comprador,
tokens, secretos, certificados ni filtros del negocio. La retención/acceso y la
auditoría de archivos efectivamente entregados se completan en operación/fase 4.
Los rechazos previos al reconocimiento del cliente o al handshake no se presentan
como una auditoría exhaustiva de tráfico; esa capa corresponde a entrada/operación.

## Catálogo y alcance: límites explícitos

Al crear/cambiar grants o reactivar, el adaptador consulta por **HTTPS verificado**
el catálogo interno autorizado de Billing, usando el token humano vigente del
administrador y mTLS de servicio. Timeout de 5 segundos y respuesta máxima 2 MiB,
sin redirecciones ni destinos recibidos del request. Sólo empresas BUSINESS/BETA;
validación de pertenencia empresa–sede–punto–tipo de serie.

La PWA actual usa transporte interno HTTP: **no se desactiva TLS para acomodarla**.
El nuevo adaptador requiere que la entrada interna HTTPS sea configurada en el
despliegue privado posterior. No se llamó a Billing real en esta entrega.
Desactivar un cliente sigue siendo posible si Billing no está disponible.

El catálogo actual no prueba cobertura histórica ni emisión GT 31. Un grant `ALL`
no crea una fuente de documentos ni permite fabricar XML/CDR. Selecciones explícitas
ausentes del catálogo se deniegan; las fuentes históricas se resolverán en fase 4.
La validación administrativa no es una transacción distribuida con Billing: cada
lectura futura debe verificar el binding real y evitar asociaciones obsoletas.

## Persistencia y configuración preparada, no aplicada al QA

DDL independiente: `services/identity-service/prisma/integration-identity.sql`.
Tablas `IntegrationClient`, `IntegrationAudit`, `IntegrationRateBucket` dentro del
dominio Identity, sin FKs a Billing, sin Outbox ni cambios en correlativos.
El SQL incluye CHECK BETA y unicidad; el adaptador usa SQL estático parametrizado
a través de las transacciones de Prisma. El DDL **no es una migración desplegada**
ni se ejecuta automáticamente. Futura integración con el esquema/migración de
Identity requiere respaldo, ensayo y autorización del despliegue concreto.

Variables necesarias para el programa separado, sin valores de clientes:

- `INTEGRATION_IDENTITY_ENABLED=true`; ausente/false: sin lectura de claves,
  conexión BD/Redis o escucha. `INTEGRATION_ENVIRONMENT=BETA` obligatorio.
- `INTEGRATION_HOST=127.0.0.1`; `INTEGRATION_PORT` (default 3108, sólo loopback).
- `INTEGRATION_TOKEN_ISSUER`: URI HTTPS estable. `INTEGRATION_SIGNING_KEY_FILE`:
  PEM RSA nueva; se rechaza la misma clave pública usada por sesiones humanas.
- `INTEGRATION_PEPPER_FILE`: exactamente 32 bytes aleatorios, archivo protegido.
- `INTEGRATION_TLS_CERT_FILE`, `INTEGRATION_TLS_KEY_FILE`, `INTEGRATION_TLS_CA_FILE`:
  PKI de transporte propia. Clave TLS distinta de la clave que firma tokens.
- `INTEGRATION_TOKEN_PEERS`, `INTEGRATION_ADMIN_PEERS`, `INTEGRATION_RESOURCE_PEERS`:
  listas explícitas de fingerprints SHA256 en hex minúscula sin separadores.
  La CA confiable por sí sola no autoriza un peer.
- `INTEGRATION_BILLING_HTTPS_ORIGIN`, `INTEGRATION_BILLING_CA_FILE`,
  `INTEGRATION_BILLING_CLIENT_CERT_FILE`, `INTEGRATION_BILLING_CLIENT_KEY_FILE`:
  origen privado fijo y TLS validado hacia Billing.
- Configuración habitual de Identity: su propia BD, Redis de sesión y
  `JWT_PUBLIC_KEY_FILE` para verificar administración humana; no se usa la clave
  privada humana para emitir tokens técnicos.

No se guardan estos valores en Git ni se piden por chat. No se añadieron secretos
de ejemplo reutilizables. El arranque verifica columnas de las tablas con una
consulta `WHERE false`, sin leer sus filas; falta de configuración/tablas falla
cerrado, sin migrar ni crear un cliente de respaldo.

## Evidencia y gate de fase 3

- **95 pruebas nuevas**: 84 de núcleo/crypto/permisos/repositorio y 11 HTTP real
  Nest HTTPS/mTLS, con CA/secretos efímeros ficticios en memoria.
- **258 pruebas / 6 suites relacionadas PASS**, al incluir contrato, permisos
  existentes y aislamiento multi-RUC. **7 pruebas de inventario PASS**.
- **21 comprobaciones PostgreSQL 17 PASS**, base nueva, red Docker interna,
  dos contenedores desechables, sin puertos publicados ni datos/volúmenes QA.
  Incluyen persistencia tras reconexión, rotación concurrente, rechazo de secreto
  anterior, rollback de auditoría, revocación, reactivación, cuota atómica y CHECK BETA.
- TypeScript de Identity compilado; formato de cambios comprobado.

El ensayo final de persistencia usa el repository productivo con `PrismaService`
y su adaptador PostgreSQL reales, apuntando únicamente a la base ficticia nueva;
`pg` instala el DDL e inyecta fallos de test en esa base. No afirma despliegue de
Prisma/migraciones en una BD del cliente.
El ensayo HTTP usa Store transaccional ficticio: son dos pruebas complementarias,
no una prueba end-to-end del despliegue de clientes reales con VPN/Kong.
No se ejecutó toda la regresión general ni se transmitió SOAP/REST oficial.

Reproducción:

```powershell
pnpm test:integration-identity
pnpm test:integration-identity:db
pnpm --filter @factuez/identity-service typecheck
```

El runner DB requiere imágenes locales `postgres:17-alpine` y
`factuez-stage2-qa/identity-service:local`; reutiliza **sólo su software**, no
contenedores, configuración ni datos activos. Monta código/DDL específicos como
lectura y elimina únicamente recursos etiquetados del ensayo. No admite URL de BD,
RUC real o sustitución de destino. Los fallos iniciales del harness se corrigieron
(binding en red interna, nombre DNS demasiado largo e inyección de fallo sobre
auditoría existente); no se relajó TLS ni se reutilizó la base activa.

**Gate técnico local de identidad aprobado; activación real pendiente.** OpenAPI
de fase 2 sigue como contrato de la futura API desplegada: `x-implemented=false`
no se cambia por haber compilado un ejecutable opt-in. No hay endpoints de extracción
activos, interfaz de clientes técnicos en la PWA ni ruta nueva en Kong todavía.

**Siguiente: fase 4, adaptadores de lectura y XML/CDR**, resolviendo los servicios
propietarios con autorización M2M, bindings canónicos, cobertura honesta por tipo,
integridad de originales y autorización de todos los miembros de un CDR compartido.
No reenviar JWT técnico al guard humano ni generar un usuario ADMIN intermediario.
No se requieren nuevas claves del cliente para programar esa fase con fixtures.
VPN/Kong/HTTPS y piloto de TI permanecen en fases 7/8.
