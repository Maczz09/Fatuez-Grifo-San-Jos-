# B2B-09 — Host privado de recepción

26/10/2026. Código y pruebas locales; no activado en 8091 ni en el VPS.

El main optativo `services/received-documents-service/src/b2b/main.ts` construye
las clases ReceptionService y ReceptionAutomationService mediante DI, los stores
persistentes B2B existentes y el listener mTLS. No carga el AppModule legacy ni
inicia por guardar configuración un worker SIRE/IMAP, OAuth o un conector real.
La ejecución de lectura externa conserva sus flags, autoridades y permisos.

Se exige `B2B_RECEIVED_ENABLED=true` y `B2B_RECEIVED_CONFIG_ROOT`. El JSON montado
contiene `schemaVersion:factuez.b2b.received-runtime.v1`, `runtime`,
`identityOrigin`, `stepUp` y `database`. Esta última sección nombra host, port,
name terminado en `_beta`, user y passwordFile `.bin`. La CA está en
`database-ca.pem`; nunca en un parámetro HTTP. Prisma se construye con TLS 1.2,
verificación de certificado/hostname, cuatro conexiones y timeouts. No hereda
una DATABASE_URL para reemplazar el perfil de este nuevo host.

El estado privado incluye READ/COMMANDS/AUTOMATION y comprueba sus tablas mediante
proyecciones constantes sin filas ni DDL. Los cuatro hooks esperan operaciones,
producers y workers antes de cerrar almacenamiento. El worker legacy de recepción
también conserva la promesa del scheduler: espera tick y ack de cola antes de
cerrar Redis/Prisma; un timeout o cierre fallido no devuelve éxito.

## Dependencia de desarrollo todavía pendiente

`B2bReceivedStepUpHttp` es un cliente de un protocolo privado con TLS y pin de
certificado. Comprueba identidad/revisión, acción, alcance, hash de solicitud y
vencimiento de una autorización administrativa. **El servidor de ese protocolo
no está implementado en Identity en esta entrega.** Que TI configure una URL no
lo implementa. Debemos completar e integrar esa autoridad antes de declarar listo
el flujo de administración de recepción; no se pide al cliente programarla.

No se publica ese canal en Kong ni se acepta un booleano `approved` o rol ADMIN
desde el consumidor. Ante autoridad ausente o prueba inválida, se deniega.

## Evidencia y límites

Se verificaron runtime, host montado, scheduler/cierre y denegaciones mediante
los archivos `tests/b2b-received-runtime*.spec.ts`, incluidos en el conjunto
focalizado global de propietarios. Se usan clases de aplicación reales,
Nest/HTTPS/mTLS locales, SQL simulado y servidor step-up ficticio explícito.
No se probó una autoridad corporativa, PostgreSQL real, SIRE, IMAP, cliente final
ni el despliegue completo. Los fixtures no prueban que exista el servidor de
autorización pendiente ni permiten habilitarlo en un entorno real.
