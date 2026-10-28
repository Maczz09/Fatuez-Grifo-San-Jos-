# B2B-09 — Arranque privado de exportaciones

26/10/2026. Implementado y probado localmente; sin despliegue ni datos reales.

`services/integration-export-service/src/b2b/main.ts` construye el motor B2B
existente con PostgreSQL dedicado `b2b_exports_beta`, su vault y adaptadores HTTP
privados concretos hacia Identity, Billing y SUNAT. La rama del main anterior se
selecciona exclusivamente con `B2B_EXPORTS_ENABLED=true`; por defecto conserva el
arranque legacy, cuyo flag independiente sigue siendo obligatorio.

La nueva función deshabilitada no lee archivos ni conecta. Habilitada, exige
`B2B_EXPORTS_CONFIG_ROOT`, metadatos BETA aprobados, UUID de despliegue/instancia,
orígenes HTTPS fijos, peers de recurso/operador separados y puertos internos
distintos. Archivos montados: `runtime.json`, `ca.pem`, `server.crt`, `server.key`,
`resource.crt`, `resource.key`, `export-vault.bin`, `database-password.bin` y
`database-ca.pem`. El JSON no incluye secretos; el lector rechaza rutas fuera
del root, enlaces, límites excedidos y permisos de escritura inseguros.

La conexión PostgreSQL verifica TLS y CA, limita el pool a cuatro conexiones y
usa timeouts. El arranque comprueba bases, tablas, columnas y la restricción única
del feed mediante SELECT; no crea esquema, roles, clientes ni grants. Una
configuración guardada no acredita permisos, disponibilidad o aceptación fiscal.

El listener mTLS instala los controladores existentes de exportación y la sonda
privada de estado con capacidades EXTRACTION/CHANGES. La sonda comprueba esquema;
no vuelve a leer claves para cada consulta. La clave del vault usa un campo
privado del runtime: JSON/enumeración/inspect no la exponen. El formato AES-GCM
existente y sus AAD se conservan.

El worker es optativo mediante `workerEnabled`. Cada tick serializa expiración
y empaquetado; su cierre espera el trabajo real y el journal. No hay SMTP, envíos
SUNAT, borrado de XML/CDR originales ni acceso a la cola de exportación legacy.
Las fases de mantenimiento cierran admisión, esperan worker/controladores y al
final cierran el pool. El control operador sobrevive en PARKED y no se publica
por Kong. SIGTERM/SIGINT reutiliza el run del mantenimiento coordinado.

## Alcance y verificación

El contrato de extracción actual admite 01/03; no amplía silenciosamente tipos,
formatos o fuentes. Los reportes de otras familias conservan su API propietaria.
Tampoco convierte el historial sintético en archivo real ni importa automáticamente
datos de la instalación existente.

El conjunto `b2b-export-runtime.spec.ts`, `b2b-extraction.spec.ts`,
`b2b-extraction-http.spec.ts` e `integration-export-store.spec.ts` aprobó
**110 pruebas en cuatro archivos**. Se usan Nest/HTTPS/mTLS reales en loopback y
clientes SQL simulados. Incluye cierres con trabajo pendiente, fallo de journal,
consulta privada, estacionamiento de las cuatro fases y custodia del vault.
No acredita una conexión PostgreSQL TLS real ni recuperación de toda la instalación.
El servicio compiló correctamente. El ensayo persistente requiere Docker
disponible y una base nueva aislada; no se sustituyó por una conexión a QA.
