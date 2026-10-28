# B2B-06 — Productor empresarial y journal dinámico V2

Fecha: 21/10/2026. Entrega **candidata local**, separada de las fases fiscales
históricas 2/3. No desplegada en el stack QA ni autorizada para producción.

## Circuito implementado

Aplicación consumidora → fachada B2B → propietario Billing → verificación privada
SUNAT, con callback Billing/Identity. Cada propietario conserva su base y sus
archivos. El certificado de transporte mTLS no se confunde con el certificado
fiscal del emisor. Ninguna petición puede seleccionar una URL de destino.

El productor no acepta snapshots fiscales, números, actor, permisos, certificados,
contraseñas ni afirmaciones de aceptación del consumidor. Recibe el ID del original,
el par autorizado de series, el motivo/ajuste, fecha, referencia externa y clave
idempotente. Billing obtiene cabecera/cliente/ítems y correlativo de sus datos;
SUNAT verifica sus propios archivos mediante el puente privado ya implementado.

En UNA transacción Serializable se confirman o revierten juntos:

- Nota, ítems, impuestos y referencia al original.
- Incremento CAS del correlativo y comando Outbox propietario.
- Reserva de saldo, versión/hash del journal y actor auditado.
- Recibo de solicitud idempotente y referencia externa única.

El original permanece intacto. Un SERVICE conserva `createdByUserId=null`; no se
inventa un usuario humano. Las concesiones se vuelven a consultar antes y después
del trabajo transaccional. Una pérdida de respuesta se recupera repitiendo la
misma solicitud, no asignando un número nuevo ni cambiando de clave.

## API candidata

| Método y ruta | Función |
| --- | --- |
| `POST /b2b/v1/correction-notes` | Preparar y reservar F07/F08; devuelve 202 después del commit local |
| `GET /b2b/v1/correction-notes/{id}` | Leer la operación propia, detalle de nota, cliente, ítems y totales |
| `POST /b2b/v1/correction-notes/{id}/settle` | Incorporar al journal un resultado ya verificado por el propietario; NO transmitir |

La consulta recibe la tupla completa como parámetros: `issuerId`, `issuerRuc`,
`environment=BETA`, `branchId`, `pointId`, `seriesId`, `documentType=01`,
`noteSeriesId`, `noteType=07|08`. Las escrituras no aceptan parámetros de consulta.
`settle` recibe únicamente `{binding}`; el ID de operación está en la ruta.

Crear recibe `schemaVersion=factuez.b2b.correction-create.v1`, `binding`,
`originalDocumentId`, `idempotencyKey`, `externalReference`, `note`, `issueDate`.
Los motivos y líneas de `note` están descritos por `CorrectionAdjustment` en
[OpenAPI candidato](b2b/openapi.candidate.v1.json). Fecha con zona horaria explícita;
precios/cantidades/importes como cadenas decimales, nunca números flotantes.

Requiere Bearer B2B, transporte privado, permiso de documentos y concesión vigente
original–serie de nota. Crear/conciliar exigen `b2b:corrections:write`,
`b2b:documents:read` y `b2b:documents:issue`. Consultar exige además
`b2b:corrections:read`; en este perfil el propietario mantiene los requisitos de
escritura/emisión también para consultar. No se conceden scopes por defecto.

El recibo devuelve el número realmente reservado, emisor/cliente/ítems/referencia,
totales, estado del **journal candidato**, retenciones, neto, revisión y hashes.
No devuelve el comando privado, ruta de archivo, Bearer ni secretos.
Siempre conserva `candidateOnly=true`, `fiscalExecutionEnabled=false` y
`transmissionAuthorized=false`. Un resultado local no acredita emisión oficial.

## Reservas dinámicas sin reescribir V1

`FACTUEZ-BETA-CORRECTION-JOURNAL-v2` es un journal nuevo de eventos RESERVE/SETTLE.
La base depende sólo del original. Añadir una reserva después de una aceptación
no cambia las versiones anteriores ni sus hashes. V1 y el ensayo sintético
conservan TODOS sus bloqueos originales; no se promueven quitando guards.

La reserva consume capacidad por línea/cantidad/valor. Un débito no aumenta el
crédito disponible. Rechazo, falta de CDR o proyección retrasada NO liberan saldo.
El resultado aceptado/observado aplica una sola vez; el rechazado conserva la
retención sin efecto financiero. CDR recibidos fuera de orden no se ordenan
artificialmente ni se rechazan por tener fecha anterior al último evento de otra
operación: se comprueba la cronología de su propia operación y la evidencia.

Cada lectura reconstruye el journal y contrasta su cabeza, prefijos, snapshots,
columnas físicas, actores y comandos Outbox propios. Recibos/eventos son
append-only y la cabeza avanza con CAS. Reintentos por conflictos serializables
son acotados y repiten la transacción completa con reautorización; no sólo INSERT.

La comprobación física también incluye fecha, operación, identidad/nombre/dirección
del cliente y coherencia SERVICE/USER del creador. Para preparar créditos con igual
fecha, el orden se obtiene de las dependencias inmutables `creditHistoryIds`, no
del UUID. Dependencias ausentes, duplicadas, cíclicas o ambiguas bloquean; no se
reescriben snapshots históricos para forzar un orden.

La procedencia de una evidencia no se demuestra con `true` o un SHA: el ensamblaje
usa verificadores propietarios y el canal mTLS autenticado. Las pruebas de BD
inyectan sellos ficticios identificados como tales; no son pruebas de PKI SUNAT.
Las relecturas no prometen atomicidad distribuida entre tres servicios.

## Perfil habilitable y rechazos explícitos

Original 01, BETA, PEN, operación 0101, IGV18/contado, con los motivos existentes:
NC 01/06/07/05/09; ND 02 y mora 01 explícita/inafecta del perfil. Máximo 100 notas
y 200 eventos por original. No se inventan reglas para otras operaciones.

Se rechaza ANTES de consumir numeración:

- Producción, RUC fuera del perfil explícito, permisos revocados o par ajeno.
- Notas B sin su RC; RC/RA, sustituciones RC2 y guías pertenecen a B2B-07.
- Historial de otra serie no cubierto por el par; requiere composición de grants,
  no permisos implícitos. Esto incluye ND posterior a créditos de otra serie.
- Historia no conciliada, V1 previo, retenciones del ensayo sintético o lotes
  previos. No se adopta un saldo ni se toma un máximo como autorización.
- Proyección de crédito rechazado que requiera conciliación, sobreacreditación,
  mezclas no soportadas de devolución/descuento y perfiles fiscales no habilitados.

El registro/cancelación de solicitudes de baja permanece separado. Una baja NO
es DELETE, ni edición del original. Su ejecución en RA/RC es alcance B2B-07.
El lector/exportador genérico sigue declarando su cobertura 01/03; esta entrega
añade lectura del detalle por la ruta específica, no amplía silenciosamente los
tipos ni fabrica archivos/XML/CDR o webhooks fiscales que no existan.

## Ensamblaje y despliegue

`createBillingCorrectionProducer(...)` reúne preparación Prisma local,
autorización pareada, `CorrectionJournalRepository`, `VerifiedCorrectionJournal`
y puertos privados SUNAT. Es por petición: no comparte el Bearer entre clientes.
`BillingCorrectionProducerModule.isolated(...)` expone únicamente el propietario
privado fijo. La fachada usa `HttpB2bCorrectionOwner` y `B2bCorrectionModule`.

`createB2bDraftApplication(...)` admite el módulo de correcciones como argumento
OPCIONAL final. Si no se configura, no registra estas rutas ni anuncia su
capacidad local. `fiscalActivation` continúa false incluso configurándolo.
Los hosts privados requieren CA, certificado cliente/servidor, peers explícitos,
TLS verificado y parser JSON acotado. No registrar cuerpos o claves.

El DDL aditivo `b2b-correction-journal-v2.candidate.sql` se ensaya exclusivamente
en BD nueva aislada. No se aplicó en QA/cliente. No se cambió AppModule/main,
Kong, firewall, correlativos existentes, propietarios de series ni `publishedAt`.
La activación del despacho oficial, ampliación de perfiles, publicación de eventos
fiscales y despliegue requieren sus gates propios. No es una migración ejecutada.

## Verificación reproducible

- `pnpm test:b2b-phase6-journal`: reglas, productor, preparación y HTTPS/mTLS local.
- `pnpm test:b2b-phase6-journal:db`: compila dependencias y ensaya un PostgreSQL
  NUEVO etiquetado, sin red ni puertos, tmpfs y limpieza sólo de ese contenedor.
- `pnpm run typecheck` y regresión completa de Vitest, ejecutadas en serie.

Resultados finales: se registran en [verificación del 21/10](B2B_VERIFICACION_2026-10-21.md).
Regresión completa: 6.516 aprobadas, una omitida, cero fallos, en 177 archivos.
Tipos: 28 tareas correctas. Ensayo PostgreSQL V2: 42 grupos aprobados en BD nueva.
No confundir resultado de pruebas ficticias con aceptación fiscal oficial.
