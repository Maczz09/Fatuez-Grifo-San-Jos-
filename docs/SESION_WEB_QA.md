# Sesión web: persistencia e inactividad

02/10/2026. Aplicado al QA `factuez-stage2-qa`, puerto 8091, conservando Kong,
microservicios, acceso intranet y los bloqueos fiscales BETA.

La PWA recupera la sesión al recargar mediante una cookie opaca HttpOnly y
SameSite=Strict. JWT sólo en memoria; ningún token ni clave en localStorage.
Redis conserva el hash del identificador y un TTL de 30 minutos. Identity
comprueba la sesión web también cuando se usa un Bearer todavía vigente.

- Actividad real de ratón/táctil/teclado/scroll renueva el plazo.
- A los 25 minutos sin actividad aparece el aviso de 5 minutos restantes.
- A los 29 minutos y 30 segundos cambia al aviso final de 30 segundos.
- A los 30 minutos se rechaza la sesión y vuelve al acceso.
- «Continuar trabajando» renueva 30 minutos; el diálogo no se oculta por Esc
  ni por clic fuera. Una operación fallida no prolonga el plazo.
- Recargar, polling, WebSockets y renovación de JWT NO son actividad.
- Las pestañas sincronizan el plazo y cierre sin compartir tokens. Al vencer,
  se consulta el plazo del servidor por si otra pestaña estuvo activa.

La recuperación de red muestra un botón de reintento: una caída momentánea no
borra la cookie. Si no puede confirmarse actividad al vencer, la UI cierra el
acceso. Un logout sin red no puede revocar inmediatamente la cookie del
servidor: queda limitada por su TTL; no se afirma revocación remota offline.

## Despliegue

Sólo Identity y Web se recrearon con los tres overlays de QA y `--no-deps`.
Para despliegues HTTPS configure `AUTH_BROWSER_ORIGINS` con orígenes exactos y
no habilite `LOCAL_BROWSER_SESSION_QA_ENABLED`: Secure es el valor predeterminado.
La excepción HTTP es explícita del demo/QA e intranet privada, no una habilitación
fiscal de producción. El API Bearer legado conserva su TTL para clientes técnicos.

## Evidencia

`tests/browser-session.spec.ts`: plazos exactos, desfase de relojes, CSRF,
cookies, caducidad, revocación y almacenamiento sin cookie cruda.
Regresión tras la sesión: 283 pruebas en 21 suites. Regresión final, incluyendo
identidad del certificado/CDR Beta: 296 pruebas en 22 suites; TypeScript 15 tareas aprobadas.

`tests/browser-session.e2e.cjs --isolated-only` se ejecutó dentro de Identity QA:
login, recuperación sin prolongar TTL, avisos de 5 min/30 s, continuación,
rechazo CSRF, revocación del Bearer y rechazo de sesión vencida aprobados.
Se creó/eliminó sólo el registro Redis propio del test; cero escrituras fiscales.

Verificación de navegador con `ui-fixture.mjs --visual-only`: aviso de 5 minutos,
continuación, dashboard autenticado después de recargar, aviso de 30 segundos y
cierre automático observados. Son datos ficticios; el E2E anterior valida el backend.
