# Continuidad de pantalla al volver a la pestaña

Fecha: 2026-10-06. Sólo desarrollo/QA; no hay cambios en Identity ni SUNAT.

## Causa y corrección

La renovación en segundo plano ya evitaba mostrar el splash inicial. Sin
embargo, comparaba el perfil con la respuesta anterior de transporte, no con
el usuario realmente renderizado. Desde la segunda renovación se sustituía
la referencia visual aun siendo iguales usuario, roles, permisos y alcance.
`useResource` limpiaba sus datos al cambiar esa referencia y el detalle del
comprobante desmontaba sus hijos, incluido el modal de impresión.

Ahora la actualización funcional de React compara con el perfil renderizado y
conserva su referencia cuando los datos de acceso no cambian. La sesión interna
conserva el token y vencimiento nuevos: las consultas no utilizan un token
vencido ni renuevan repetidamente por conservar la referencia visual.

La comprobación al volver permanece en segundo plano. No hay `location.reload`,
persistencia de JWT en almacenamiento del navegador ni actividad ficticia.
Se mantienen los 30 minutos de inactividad y los avisos a los 5 minutos y 30
segundos restantes. Un 401, logout o revocación de acceso sí invalida la sesión.
Cambios reales de usuario, nombre, roles, permisos o alcance reemplazan el perfil
y obligan a volver a consultar conforme al acceso vigente.

## Evidencia local

- Regresión final: 3.227 pruebas / 95 suites PASS, sin omisiones, con XSD offline.
  Compilación Next.js y verificación de tipos PASS. Auditoría de la imagen
  instalada PASS. Once servicios saludables, sólo Web recreado en este incremento;
  login local/LAN HTTP 200 y sesión sin autenticar HTTP 401.
- Regresión reproducida antes de corregir: el test de renovaciones sucesivas
  perdía la referencia visual; después de corregir pasa.
- Cinco retornos de visibilidad ejecutan el listener real del proveedor con
  HTTP simulado: referencia visual, borrador y pantalla conservados. Ocultar
  no envía peticiones y volver no prolonga el plazo como actividad.
- Cinco renovaciones consecutivas conservan emisor, sede y fuente del catálogo.
- Vencimiento fresco usado en solicitudes posteriores; Bearer renovado.
- Cambios de roles/permisos/alcance actualizados, 401 limpia el contexto y una
  interrupción temporal no borra el borrador.
- No se simula que el navegador nunca pueda descartar una pestaña por memoria
  o que navegar realmente a otra URL conserve cualquier modal. El alcance de
  esta corrección es volver a la pestaña/app sin cerrar, recargar manualmente
  o salir de su documento. No se afirma una prueba de descarte del navegador.

Despliegue limitado a Web QA con `--no-deps`, sin migraciones ni reinicios de
los otros servicios. Imagen `factuez-stage2-qa/web-pwa:session-continuity-20261006`;
el diseño limpio anterior queda disponible en `clean-layout-20261006`.
