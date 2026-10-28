# B2B-08: panel conectado mediante SSO y BFF privado

Fecha: 24/10/2026. Implementación candidata LOCAL/BETA, sin despliegue en 8091.

El panel Integraciones ahora tiene un cliente de sesión y un backend específico
para el navegador (BFF). Permite iniciar una verificación administrativa,
consultar aplicaciones, crearlas, modificar sus concesiones y rotar secretos.
La página sigue exigiendo ADMIN global y los permisos de administración; el
servidor verifica esos permisos de nuevo. No basta con mostrar el botón.

## Flujo implementado

1. El operador pulsa **Iniciar sesión de administración**. El navegador solicita
   un flujo al BFF del mismo origen; nunca recibe credenciales de servidor.
2. El BFF crea `state`, `nonce` y PKCE S256, y conserva el verificador cifrado
   en Redis. El flujo dura dos minutos y se vincula a una cookie de ese navegador.
3. El proveedor OIDC realiza el inicio de sesión con MFA. El callback consume el
   flujo una sola vez y canjea el código por el canal HTTPS privado configurado.
4. Se verifica el ID token RS256 con claves públicas fijadas: emisor, audiencia,
   nonce, fechas y MFA. El acceso se comprueba también mediante introspección
   autenticada; se contrastan sujeto y perfil, sin seguir URLs de claves del token.
5. Identity exige un vínculo explícito entre emisor/sujeto OIDC y un usuario local
   activo, ADMIN global, con `setup.manage`, `user.manage` y `role.manage` vigentes.
   Las funciones recibidas del proveedor no sustituyen las funciones locales.
6. El BFF guarda el acceso cifrado en Redis y devuelve sólo una cookie opaca
   Secure/HttpOnly. La sesión dura como máximo cinco minutos, limitada además
   por la caducidad del acceso y la antigüedad de MFA. Las consultas no la prolongan.
7. Cada operación vuelve a comprobar el acceso y la sesión, y reutiliza el
   propietario de administración existente, con su control de revisiones,
   auditoría y revalidación dentro de las transacciones.

El secreto de una integración sólo aparece en una creación/rotación autorizada.
Las lecturas de metadatos no lo recuperan. El navegador mantiene CSRF únicamente
en memoria; no guarda Bearer, SOL, certificados ni tokens OIDC en almacenamiento.
El cierre o caducidad de la PWA también limpia el cliente administrativo y
solicita revocación de su sesión mediante una petición `keepalive` independiente.
La sesión administrativa no sustituye ni amplía la sesión normal de caja.
El cierre general de FactuEz también revoca la cookie desde cualquier pantalla,
incluso después de recargar sin abrir Integraciones. Esa petición sólo puede
cerrar la sesión de su propia cookie y exige Origin aprobado, metadata
`Sec-Fetch-Site: same-origin` e intención `X-FactuEz-Logout: workspace`.
Las operaciones administrativas conservan la exigencia de CSRF. Si la red no
está disponible, el cierre normal continúa y la sesión del servidor queda
limitada por su caducidad; no se anuncia una revocación remota confirmada.

## Endpoints internos del navegador

| Método y ruta | Resultado |
| --- | --- |
| GET `/bff/b2b-admin/session` | Estado y, si procede, CSRF/caducidad; sin tokens |
| POST `/bff/b2b-admin/session/start` | URL de autorización construida por el proveedor configurado |
| GET `/bff/b2b-admin/callback` | Canje único de código/estado y redirección fija a Integraciones |
| POST `/bff/b2b-admin/session/logout` | Revoca la sesión y limpia cookies |
| GET `/bff/b2b-admin/applications` | Lista paginada BETA |
| POST `/bff/b2b-admin/applications` | Alta explícita autorizada |
| GET `/bff/b2b-admin/applications/{id}` | Metadatos de una aplicación |
| PATCH `/bff/b2b-admin/applications/{id}` | Actualización con revisión esperada |
| POST `/bff/b2b-admin/applications/{id}/rotate-secret` | Rotación con revisión esperada |

Las rutas de aplicaciones conservan `environment=BETA` y, para listar,
`limit`/`after`. Todas exigen cookie y `X-FactuEz-CSRF`; no aceptan un Bearer
del navegador como sustituto. Las escrituras exigen además Origin autorizado.
El callback admite exclusivamente código y estado, y no elige destinos de
redirección desde la petición. Las rutas del BFF son internas: no aumentan las
136 operaciones de la API B2B de consumidores ni se anuncian como APIs fiscales.

Se rechazan cabeceras/parámetros/miembros JSON duplicados, rutas fuera de la
lista, cuerpos mayores de 128 KiB y respuestas mayores de 16 MiB. Hay límites
de concurrencia y cuotas Redis. Los fallos tienen códigos finitos sin mensajes
del proveedor, URLs internas, contraseñas o tokens. Cookies sin Domain, con
Path propio y SameSite=Lax para el retorno de navegación OIDC; CSRF protege las
operaciones. El listener del BFF exige un par mTLS registrado de Kong.

## Ensamblaje que queda listo para el piloto privado

No hay bootstrap automático, secretos predeterminados ni fallback en memoria.
Las dependencias se aportan explícitamente. Antes de activar en una instalación:

- TI configura un proveedor OIDC compatible, cliente confidencial y callback
  exacto `https://<origen-aprobado>/bff/b2b-admin/callback`; audiencia de acceso
  `factuez-b2b-admin`, scope `factuez.b2b.admin`, MFA y ACR permitidos. Los tokens
  administrativos tienen vida máxima de 300 segundos. Se necesita reloj sincronizado.
- TI entrega al proceso las CA, pares mTLS y claves públicas RS256 aprobadas.
  Los certificados HTTPS/mTLS son independientes del P12 tributario de SUNAT.
  No se obtienen claves de URLs incluidas en tokens ni se desactiva TLS.
- El BFF instancia `HttpsAdminOidcProvider` con emisor/endpoints HTTPS fijos,
  `webOrigin`, callback, cliente/secret y claves públicas fijadas. Los endpoints
  del proveedor deben pertenecer al mismo origen del emisor.
- Se instancia `RedisAdminBffStore` con Redis autorizado, clave AES-GCM de 32
  bytes dedicada y un identificador de despliegue. Los registros están ligados
  criptográficamente a su clave/destino y expiran por TTL. No reutilizar la clave
  del certificado fiscal como clave de sesión. Rotarla invalida estas sesiones.
- Identity instancia `OidcB2bAdministrator` con introspección HTTPS autenticada y
  `PostgresOidcAdminDirectory`. Su opción `enabled` es falsa por defecto. Se
  entrega esta autoridad al constructor existente `B2bIdentity`; no se añade ADMIN
  a aplicaciones SERVICE ni se concede ningún scope existente.
- El esquema candidato `services/identity-service/b2b-admin-oidc.candidate.sql`
  prepara `B2bAdminOidcLink`. No se ha aplicado. El enrolamiento autorizado debe
  registrar emisor, sujeto, cliente OIDC, UUID local y revisión de acceso, con
  aprobación/auditoría del operador. No enlazar por coincidencia de correo o
  nombre. Los vínculos nacen desactivados; cambiar permisos/revisión exige revisar
  su vínculo, sin actualizarlo automáticamente para recuperar privilegios.
- El BFF reutiliza `B2bIntegrationAdmin` y su `HttpB2bIntegrationAdminOwner` hacia
  Identity mediante `B2bPrivateHttp`. Identity debe registrar ese par en sus pares
  de administración; no se comparte la base entre servicios.
- Se crea `AdminSessionBff({origin,provider,store,facade,enabled:true})` y un
  listener con `createAdminBffServer`. Kong debe enrutar sólo `/bff/b2b-admin/`
  desde el mismo origen HTTPS de la PWA, preservar el Host aprobado y verificar
  CA/nombre del upstream con mTLS. No se cambiaron las rutas actuales de Kong.

No registrar query de callback, cookies, cabeceras Authorization ni cuerpos de
configuración en los registros del proxy. La UI de `localhost:8091` en HTTP no
activa este flujo; el piloto requiere el origen HTTPS privado aprobado. El
código funciona con el despliegue Windows/Docker previsto, sin exigir un nuevo
sistema operativo para esta funcionalidad.

## Verificación

```powershell
pnpm test:b2b-admin-sso
pnpm test:b2b-admin-sso:redis
pnpm typecheck
```

Pruebas específicas: 487 aprobadas en siete archivos; junto con los contratos,
524 aprobadas en diez archivos. El bloque HTTPS usa
certificados, proveedores y vínculos ficticios. Las pruebas de BFF ejercitan
el propietario Identity real con almacenamiento y autoridad de prueba; las del
proveedor verifican firmas RS256 y mTLS reales contra un servidor local. No
equivalen a una autenticación con el proveedor corporativo del cliente.

El ensayo adicional crea su propio Redis etiquetado, sin red ni puertos,
tmpfs y sin persistencia en disco. Comprueba cifrado, AAD, consumo único Lua,
caducidad, cuota y revocación, y elimina sólo ese contenedor. No usa Redis de QA.
Regresión completa final: **263 archivos aprobados, 11.377 pruebas aprobadas,
cero fallos y una omisión condicional preexistente**, en 245,94 segundos.
El caso omitido es el ensayo XSD de `fiscal-batch.spec.ts`, que requiere
`FACTUEZ_FISCAL_XSD_PYTHON`; no se contabiliza aprobado. Tipos globales:
29 tareas correctas en 22 paquetes. La compilación final de panel, Identity y BFF
completó sus ocho tareas; no constituye despliegue. El ensayo Redis adicional
aprobó y no dejó su contenedor temporal.

Informe completo: `output/qa/b2b-phase8-admin-sso-regression-final.json`.
El intento anterior detectó dos fallos del proveedor de sesión en pruebas sin
`window`; se corrigió la limpieza para SSR/pruebas y se cubrió además la
revocación desde cualquier pantalla o tras recargar, sin depender del panel.
No se retiraron controles de origen, CSRF de operaciones, MFA ni TLS.

## Estado de la fase

Este bloque completa el código del panel conectado y su acceso SSO candidato.
Falta configurar/enrolar y ensayar el proveedor real durante la habilitación
privada. Continúan pendientes el despacho de conectores, el perfil de correo
corporativo, el historial real y fuentes de reportes adicionales. No se declara
cerrada la paridad operativa de B2B-08 ni las fases fiscales originales.
