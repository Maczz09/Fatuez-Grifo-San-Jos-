# ADR B2B-003 — OIDC externo y vínculo con Identity local

Fecha: 20/10/2026. Decisión de arquitectura aceptada para el código candidato.
No instala un proveedor, migra cuentas ni habilita acceso remoto.

## Decisión

Usar un proveedor OIDC mantenido; referencia de despliegue: **Keycloak on-premise**.
No implementar un servidor propio de Authorization Code, contraseñas o refresh.
La aplicación consumidora realizará Authorization Code + PKCE S256 con su SDK
OIDC; no enviará contraseñas humanas al endpoint técnico de FactuEz. Redirects
exactos, state/nonce y protección del callback corresponden a esa integración.
No se ha construido aquí una aplicación consumidora ni su callback de login.

Identity recibe el access token USER mediante un backchannel privado autorizado
y lo consulta en el endpoint de introspección fijo del proveedor. La conexión
usa HTTPS autenticado, CA verificada y credencial confidencial en servidor.
No descubre URLs a partir de claims ni considera válido un JWT sólo por decodificarlo.
No acepta ID tokens, refresh tokens o tokens de la sesión PWA como sustitutos.

Perfil configurado: audiencia `factuez-b2b-v1`, access token Bearer activo,
issuer fijo, client_id registrado y vida máxima de 300 segundos. Los scopes
OIDC `openid/profile/email` no conceden permisos de negocio. En esta fase sólo
se admiten `b2b:context:read` y `b2b:catalog:read`; los demás siguen bloqueados.

## Vínculo explícito, sin migrar contraseñas

Tabla candidata `B2bUserLink`: issuer + subject + oidcClientId → usuario local,
cliente B2B y revisiones autorizadas. No enlazar por email, nombre o username.
Un vínculo ausente, deshabilitado o con revisión obsoleta deniega acceso.
El alta real del vínculo exige procedimiento administrativo verificado y auditado;
no existe un endpoint público de autoenlace. Su UI/enrollment y prueba con el
proveedor desplegado quedan pendientes de la integración de identidad.

En cada petición se consultan proveedor, vínculo, acceso local y cliente actual.
Los permisos y asignaciones del usuario se leen de Identity, no de roles incluidos
en un token externo. El acceso efectivo intersecta scopes del token, cliente,
permisos humanos y tuplas exactas RUC–sede–punto–serie–tipo. Ser ADMIN no amplía
las tuplas concedidas a la aplicación.

Cambiar la revisión del cliente o authVersion local invalida el vínculo anterior;
antes de rehabilitarlo hay que revisar su asignación. No se promete revocación
distribuida atómica: se verifica de nuevo en la siguiente petición y, posteriormente,
antes de efectos encolados. Aquí sólo se ejecutan consultas de contexto.

## Administración privilegiada

La administración de clientes requiere peer mTLS administrativo, sesión humana
local activa ADMIN global con permisos y un `VerifiedStepUp` confiable. La sesión
de contraseña por sí sola **no es segundo factor**. Si no hay verificador de
step-up integrado, se deniega; no hay excepción de desarrollo para cuentas reales.

La conexión real de este verificador al flujo MFA/BFF y el enrollment auditado
no están desplegados ni acreditados por los mocks. Esto no se presentará como
SSO/MFA terminado para uso del cliente.

## Referencias primarias

- [OAuth Security BCP, RFC 9700](https://www.rfc-editor.org/rfc/rfc9700.html).
- [Perfil JWT de access tokens, RFC 9068](https://www.rfc-editor.org/rfc/rfc9068.html).
- [Endpoints OIDC e introspección de Keycloak](https://www.keycloak.org/securing-apps/oidc-layers).
