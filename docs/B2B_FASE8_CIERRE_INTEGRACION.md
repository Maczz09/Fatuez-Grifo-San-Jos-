# B2B-08 — Integración de recepción, correo y reportes

Fecha: 25/10/2026. Entrega de código LOCAL/BETA, sin despliegue en 8091.

## Resultado

Quedan implementados los tres bloques de integración pendientes de este
incremento: recepción SIRE/IMAP de sólo lectura, correo corporativo y reportes
ampliados en API/SDK/Swagger. Los adaptadores tienen ensamblaje concreto y
pruebas con propietarios reales y persistencia nueva aislada. No dependen de
inventar respuestas exitosas ni de retirar los controles del laboratorio.

Esto no declara paridad operativa total de todos los eventos B2B, migración del
historial real, aceptación SUNAT ni activación fiscal. Los emisores, concesiones,
secretos, esquemas y servicios del QA existente no fueron modificados.

## Recepción preparada

`createB2bServiceReceptionReadOnlyRuntime` ensambla el proveedor privado de
tokens OAuth/mTLS, comprobación de Identity vigente, aprobación de despliegue,
fuente SIRE/IMAP y cola BullMQ. Requiere dependencias explícitas del propietario
Recepción, su vault, lectores de secretos SERVICE, autoridades y Redis. No carga
`.env`, no instala tablas y no inicia trabajo al importar el módulo.

La identidad SERVICE conserva el cliente y revisión que crearon la tarea. No
convierte una sesión USER en autorización de servicio ni prolonga MFA de una
persona. Para ejecución USER desatendida haría falta un mecanismo explícito de
autorización vigente; no se inventa automáticamente.

Cada tarea necesita `SYNC_CREATE`, `SYNC_EXECUTE`, aprobación independiente
`LIVE_READ_ONLY`, configuración/hash/revisión coincidentes y ámbito exacto
RUC/sede. MAIL exige `IMPORT`; adjuntar CDR/PDF exige también `ATTACH`. Se
revalidan identidad y permisos antes y después de las lecturas y al confirmar.
El proveedor de tokens mantiene tokens breves sólo en memoria, con CA, hostname
y huella del servidor comprobados. No se guardan Bearer en BD o Redis.

La cola exclusiva es `b2b-received-read-only-v1`; sólo lleva `{runId}`. El
ejecutor local anterior sólo consume `LOCAL_ONLY`. Guardar configuración deja
`runtimeEnabled=false`; crear tarea devuelve `QUEUED / NOT_DISPATCHED`. Consultar
la tarea muestra el resultado persistido cuando el worker autorizado la procesa.
No existe endpoint público RUN.

SIRE consulta/exporta compras mediante rutas de lectura acotadas; no acepta ni
presenta libros. Sus registros permiten detectar y conciliar documentos. **SIRE
no se utiliza como si entregara todos los XML originales e ítems**: si el XML
no llegó al buzón, permanece `XML_PENDING`. IMAP utiliza EXAMINE/PEEK y no marca
mensajes leídos, mueve ni elimina correos. Importa XML íntegro y asocia CDR/PDF
originales por identidad documental; nunca fabrica esos archivos desde totales.

Las lecturas de red suceden fuera de la transacción SQL. Originales, ítems,
adjuntos, observaciones, incidencias, contadores y checkpoint se confirman juntos.
Revocación, cambios de configuración o fallos revierten el lote y no avanzan el
cursor. Hay hasta tres intentos transitorios; un replay confirmado no reimporta.

Los límites iniciales son deliberados: originales de hasta 64 KiB, lote total
de hasta 5 MiB, 50 documentos, 100 registros SIRE y 100 incidencias. MAIL lee
cinco mensajes por defecto, configurable entre uno y diez. Los periodos son
los tres recientes, acotados por `startPeriod` y la fecha de la tarea. Las
consultas demasiado amplias fallan con `NARROW_QUERY`; no se truncan documentos
silenciosamente. No es un importador masivo de todo el historial.

Esquemas candidatos nuevos: `b2b-received-read-only.candidate.sql` y las columnas
adicionales del candidato automation. Instalar sobre una base existente exige
una migración aditiva revisada, respaldo y tratamiento de tareas anteriores;
no ejecutar los candidatos de creación como actualización automática.

## Correo corporativo preparado

`createCorporateEmailDeliveries` compone el motor, fuentes de adjuntos,
configuración cifrada, permiso independiente y transporte Nodemailer. El perfil
predeterminado continúa siendo `NONE`. `LOCAL_CAPTURE` sigue separado.
`CORPORATE` requiere habilitación explícita y autorización actual de envío real;
poseer configuración SMTP o un scope de correo no basta.

`FixedCorporateEmailSendPermission` permite declarar concesiones exactas de
actor/revisión/RUC/sede/serie, destinatarios y vencimiento. Permitir cualquier
destinatario requiere `allowAnyRecipient=true` explícito. Revocar Identity o
reemplazar la concesión con una revisión nueva invalida la autorización previa.

Se exige TLS directo 465 o STARTTLS 587 con TLS 1.2 mínimo, CA y nombre de host
válidos. Se fija la dirección IPv4 resuelta para evitar una segunda resolución.
Un relay de intranet requiere el par exacto host/IP RFC1918 autorizado por TI;
no admite rangos, comodines, loopback, link-local ni direcciones de metadatos.
Una CA corporativa puede inyectarse expresamente sin desactivar validaciones.

El job registra `DISPATCHING` antes del envío, conserva Message-ID estable y
verifica los SHA de PDF/XML/CDR. `SMTP_ACCEPTED` significa que el relay aceptó
el mensaje; `deliveredToClient=false` evita afirmar entrega final. Una pérdida
de respuesta queda en `SMTP_OUTCOME_UNKNOWN` y no se reenvía automáticamente.
La consulta devuelve metadatos, no secretos, destinatarios ni bytes de adjuntos.

El esquema corporativo es independiente del de captura local. Se ensayó sólo
con SMTP ficticio, nunca con clientes o buzones reales.

## Reportes y contrato público

`BillingOwnerReportSources` y `PostgresBillingReportSources` leen exclusivamente
las fuentes propietarias de Billing. Se componen expresamente con autoridades
de lectura; no utilizan bases de otros microservicios.

| Tipos | Tratamiento |
| --- | --- |
| 01 / 03 | Compatibilidad con capturas anteriores. |
| 07 / 08 | Snapshot vigente y referencia emparejada; NC con efecto negativo y ND positivo. |
| 09 / 31 | Guías locales numeradas: cantidades/peso, sin moneda ni ingresos. |
| NV | Notas completadas/convertidas/canceladas válidas; separadas de ventas fiscales. |

`PostgresReportsCorrectionReadAuthority` aporta lectura NC/ND independiente de
emisión/escritura, con concesión emparejada, revisión CAS y auditoría inmutable.
Su enrolamiento es privado y requiere autoridad administrativa adicional.

CSV, XLSX y PDF representan los tipos configurados. XLSX y PDF requieren inyectar
los constructores ya instalados de ExcelJS/PDFKit. Los importes utilizan precisión
decimal exacta. Las cantidades no se suman entre unidades distintas. El neto
local sólo incluye 01/03/07/08 emitidos; no acredita aceptación SUNAT ni balance
contable. Cada trabajo conserva su captura y permisos, incluso si no hubo filas.

API, SDK y OpenAPI reconocen `BILLING_OWNER_SOURCES`, filtros, cobertura y efectos
firmados. `@factuez/contracts/b2b-report-view` valida ambos extremos, vincula
filtros a la solicitud y rechaza datos privados, importes alterados o supuesta
aceptación fiscal. El acceso B2B permanece separado de los contratos generales.
El SDK depende del paquete interno contracts; compilar/distribuir ambos juntos.
No se añadieron rutas ni se concedieron permisos a clientes existentes.

Se cubren las guías propietarias locales verificadas. Una guía gestionada por
otro microservicio requeriría su contrato acotado de captura y adaptador privado;
no se ofrece acceso directo a esa otra base ni una fuente inventada.

## Comprobación reproducible

Con las dependencias e imágenes de prueba ya instaladas, desde el monorepo:

```powershell
pnpm exec turbo run build --filter=@factuez/b2b-api-service... --filter=@factuez/b2b-sdk... --filter=@factuez/mailer-worker... --filter=@factuez/received-documents-service... --filter=@factuez/billing-service...
pnpm typecheck
pnpm test:b2b-phase8
pnpm test:b2b-received-read-only:db
pnpm test:b2b-received-dispatch:db
pnpm test:b2b-received-dispatch:redis
pnpm test:b2b-email-corporate:db
pnpm test:b2b-reports-sources:db
pnpm exec vitest run --maxWorkers=2 --testTimeout=30000 --hookTimeout=30000
```

Los ensayos de BD crean contenedores etiquetados nuevos, sin red, sin puertos y
con tmpfs. No aceptan una URL de base existente. Los datos, certificados, fuentes
remotas y SMTP son ficticios. Las evidencias quedan en `output/qa`; los grupos
enfocados se solapan con la regresión, por lo que no se suman como total único.

Comprobaciones específicas aprobadas:

| Verificación | Resultado |
| --- | --- |
| Tipos del monorepo | 29 tareas correctas en 22 paquetes. |
| Compilación de los propietarios modificados, API, SDK y dependencias | 10 tareas correctas. |
| Contratos e inventario, más SDK de reportes por HTTPS/mTLS | 87 pruebas aprobadas en cinco archivos tras corregir el acceso separado del validador. |
| Recepción READ_ONLY y concesiones NC/ND | 16 casos aprobados en PostgreSQL nuevo; Recepción y Billing usan bases separadas. Fuentes remotas ficticias. |
| Despacho local de recepción | 41 casos aprobados en PostgreSQL nuevo. |
| Cola BullMQ real | Un caso aprobado con Redis nuevo sin red/puertos: concurrencia, reintentos y limpieza. |
| Correo corporativo | Tres casos aprobados SDK → HTTPS/mTLS → propietario → PostgreSQL nuevo → SMTP ficticio. |
| Reportes ampliados | Un caso PostgreSQL nuevo aprobado: NC/ND/NV/09/31, replay y filtros/contexto/fechas. |
| Verificación enfocada de correo y SDK | 295 pruebas aprobadas en siete archivos; el conjunto general incluye estos casos. |
| Regresión general final | 275 archivos aprobados; 11.823 pruebas aprobadas, cero fallos y una omisión condicional preexistente; 259,18 segundos. |

El informe final es `output/qa/b2b-phase8-completion-regression-final.json`;
el proceso terminó con código cero. La omisión de `fiscal-batch.spec.ts` depende
de `FACTUEZ_FISCAL_XSD_PYTHON`; no se contabiliza como prueba aprobada ni como
validación fiscal. El primer pase con el fallo corregido se conserva en
`output/qa/b2b-phase8-completion-regression-attempt1.json`. Los ensayos terminados
no dejaron contenedores con sus etiquetas de propiedad.

El primer pase general encontró una exportación B2B en el barrel general de
contratos. Se corrigió creando el acceso explícito `b2b-report-view`, sin
relajar la prueba de aislamiento. El runner READ_ONLY también detectó una
excepción tardía de `nc` al cerrar el segundo pool SQL. El helper sólo reconoce
`ERR_STREAM_DESTROYED` durante el cierre ya iniciado del cliente; cualquier otro
error de pool falla el ensayo. No se suprimieron errores de negocio ni de red.
El ensayo posterior devolvió código cero además de aprobar sus 16 casos.

## Configuración y piloto pendientes

TI debe definir aplicaciones SERVICE, RUC/sedes, concesiones, hosts, secretos,
CA/certificados privados y proveedor SSO; desplegar los módulos tras respaldo y
migraciones aditivas revisadas; y ejecutar un piloto privado acotado. Los secretos
se registran en el sistema o almacén autorizado, nunca en el chat. Configurar no
equivale a autorizar producción o autenticación/aceptación fiscal.

El historial real sigue requiriendo copia offline autorizada, mapa de series y
conciliación/corte; sus guards sintéticos permanecen. Los productores de eventos
nuevos no se consideran implementados por aparecer en un catálogo. B2B-09 y los
gates fiscales originales conservan sus requisitos de operación y evidencia.

Continuación técnica: [control operativo B2B-09](B2B_FASE9_CONTROL_OPERATIVO.md),
con política BETA local, pausa, cuotas, métricas y drain del listener. Su entrega
no sustituye los requisitos de despliegue/piloto ni modifica los gates anteriores.
