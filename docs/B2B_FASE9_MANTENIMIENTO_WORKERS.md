# B2B-09 — Cierre y recuperación de procesos B2B

Fecha: 26/10/2026, Lima. Incremento LOCAL/BETA; no desplegado en 8091.

## Resultado y alcance

Se corrigió el cierre de los motores B2B de correo, webhooks y publicación de
eventos de Billing. El cierre detiene nuevas operaciones y espera el trabajo
iniciado, incluido el que transcurre fuera de una transacción SQL. No cancela
envíos en curso, reinicia intentos ni elimina filas o trabajos pendientes.

El nuevo `B2bWorkerMaintenance` permite registrar y detener componentes de **un
propietario y un proceso**, con un resultado observable y timeout de espera.
No comparte bases ni instancias entre microservicios. No instala endpoints de
mantenimiento, señales, timers, conexiones o tareas programadas al importarlo.

| Propietario | Componentes admitidos |
| --- | --- |
| Billing | `BILLING_WEBHOOK_PUBLISHER`, `BILLING_REPORT_RETENTION` |
| Recepción | `RECEPTION_LOCAL`, `RECEPTION_READ_ONLY` |
| Mailer | `MAILER_DELIVERIES` |
| Webhooks | `WEBHOOK_DELIVERIES` |

El conjunto esperado debe coincidir exactamente con los componentes registrados.
No se aceptan grupos vacíos, duplicados, arrays incompletos ni componentes de
otro propietario. El control está deshabilitado por defecto y no inicia workers.
El inventario lo aporta la composición privada; no descubre recursos ocultos,
otros procesos o réplicas de la instalación.

Incremento posterior: la [retención de reportes](B2B_FASE9_RETENCION_REPORTES.md)
se registra sólo si está compuesta en ese proceso de Billing. Su `close()` bloquea
nuevos planes/aplicaciones y espera las transacciones iniciadas, sin cerrar el
pool compartido ni convertir el mantenimiento local en autorización global.

## Correcciones implementadas

**Correo.** Antes, cerrar el store podía terminar mientras SMTP estaba esperando
respuesta: no había transacción SQL activa, pero aún faltaba escribir el resultado
del envío. El motor ahora cuenta operaciones completas de API y ejecución,
cierra admisión, espera Identity/artefactos/SMTP/journal y después cierra su store.
`SMTP_ACCEPTED` o `UNKNOWN` quedan registrados antes del cierre normal. Los errores
de cierre se publican con códigos cerrados, sin incluir excepciones privadas.

**Webhooks.** El cierre ahora espera el polling iniciado, las entregas activas de
BullMQ y los wakeups pendientes, antes de cerrar la cola. Se interrumpe la admisión
y el resto del lote de polling; una entrega iniciada conserva tiempo para acabar
su journal. Una instancia cerrada no vuelve a arrancar mediante `start()`.

**Publicador de Billing.** `close()` impide nuevos `flush()` y espera tanto la
confirmación del Inbox como la escritura final de su lease. No modifica el Outbox
fiscal anterior. Un error pendiente no se convierte en confirmación de cierre.

**Recepción.** Se reutiliza el cierre propietario existente: detiene polling y
enqueue, espera los adds y el worker y después cierra sus conexiones. El ensayo
con BullMQ real comprueba que la promesa del propietario termina antes del estado
de cierre. Las colas LOCAL y READ_ONLY mantienen sus perfiles separados.

## Uso por el operador del servicio

El módulo se importa por el acceso interno
`@factuez/service-access/dist/b2b-worker-maintenance`. Cada servicio registra
únicamente los componentes que posee; nunca recibe la cookie de la PWA o un
token B2B para ejecutar este control local.

```typescript
const maintenance = new B2bWorkerMaintenance({
  enabled: true,
  owner: 'MAILER',
  expected: ['MAILER_DELIVERIES'],
  components: [{ id: 'MAILER_DELIVERIES', worker: emailEngine }],
});

maintenance.stop();
const status = await maintenance.wait(30_000);
// STOPPING: continuar esperando; no terminar el proceso ni cancelar el envío.
// FAILED: registrar la incidencia y conciliar; no asumir cierre correcto.
// QUIESCED_LOCAL: terminaron los close() de los componentes registrados.
```

`stop()` se inicia una sola vez y cada `close()` se invoca una sola vez. Fallar un
componente no impide intentar el cierre de los demás. `wait()` admite hasta 60
segundos por llamada; su timeout no cancela operaciones ni fuerza sockets o
transacciones. Una llamada a `wait()` por sí sola no detiene nada.

Los estados son `REGISTERED`, `STOPPING`, `QUIESCED_LOCAL` y `FAILED`, o `DISABLED`
cuando el control no está habilitado. El snapshot es una copia de metadatos con
owner, maintenanceId y estados por componente. No contiene tokens, contraseñas,
destinatarios, cuerpos de eventos, XML o errores del controlador de BD.

Todos los snapshots mantienen explícitamente:

```text
localProcessOnly = true
globalWriteFenceVerified = false
backupAuthorized = false
durablePendingWork = NOT_INSPECTED
```

## Secuencia de mantenimiento y recuperación

1. Detener admisión del listener B2B con su control operativo y esperar sus
   solicitudes activas. Coordinar las otras entradas propietarias autorizadas.
2. En cada propietario, detener sus componentes registrados y esperar el estado.
   No dar por detenido un servicio sólo porque expiró un timeout.
3. Revisar operaciones desconocidas y trabajo durable pendiente. Una cola puede
   contener filas pendientes aunque sus workers estén correctamente detenidos.
4. Sólo un procedimiento global que cubra entradas, propietarios, réplicas y
   escritores podrá autorizar un respaldo/corte real. Este control no lo hace.
5. Tras mantenimiento, construir instancias nuevas con sus stores y permisos
   vigentes; consultar el journal antes de repetir una solicitud ambigua.

No hay método público de resume ni habilitación automática. `UNKNOWN` de correo
no se reenvía al reconstruir el motor. El polling de webhooks recupera el trabajo
persistido y mantiene la deduplicación; un wakeup Redis no acredita una entrega.
La pérdida abrupta de un proceso sigue requiriendo recuperación por journal y
conciliación de ambigüedades, aunque el cierre normal esté corregido.

## Verificación reproducible

```powershell
pnpm test:b2b-worker-maintenance
pnpm test:b2b-worker-maintenance:redis
pnpm test:b2b-worker-maintenance:db
```

Las pruebas unitarias suspenden SMTP, Identity e Inbox para verificar el orden
del cierre y sus errores. Redis/BullMQ real comprueba recepción y webhooks con
un contenedor nuevo sin red, puertos ni almacenamiento persistente. PostgreSQL
nuevo verifica SMTP ficticio mientras no hay transacción activa, cierre del
store después del journal y reconstrucción sin reenvío de aceptados/desconocidos.
El runner anterior de webhooks mantiene sus bases Billing/Inbox/consumidor
separadas y vuelve a verificar commit, pérdida de ack, deduplicación y revocación.

Resultados finales:

| Verificación | Resultado |
| --- | --- |
| Mantenimiento y ciclos de vida | 15 pruebas nuevas aprobadas. |
| Foco de correo, webhooks, contratos y colas | 209 pruebas aprobadas en ocho archivos; incluye las 15 anteriores. |
| PostgreSQL nuevo: cierre durante SMTP | Un caso aprobado que verifica aceptación, pérdida de respuesta y reconstrucción sin reenvío. |
| Redis/BullMQ nuevo: mantenimiento | Dos casos aprobados para webhooks y recepción. |
| Redis/BullMQ anterior | Un caso aprobado: reintentos, recuperación, payload y limpieza. |
| Publicación/Inbox/consumidor en PostgreSQL nuevo | Siete comprobaciones aprobadas; sin cambios al Outbox fiscal o sus correlativos. |
| Tipos del monorepo | 29 tareas correctas en 22 paquetes. |
| Compilación | Siete tareas correctas de los propietarios y dependencias. |
| Regresión general | 281 archivos aprobados, 11.901 pruebas aprobadas, cero fallos y una omisión condicional preexistente; 273,74 segundos. |

Informes principales: `output/qa/b2b-phase9-workers-regression-final.json`,
`output/qa/b2b-phase9-workers-focused.json` y
`output/qa/b2b-phase9-worker-shutdown-db.json`. Las verificaciones Redis y el
circuito PostgreSQL de webhooks conservan sus logs en `output/qa`. Todos los
procesos terminaron con código cero y se retiraron los contenedores de ensayo.
Los grupos se solapan y no se suman como un total adicional. La omisión de
`fiscal-batch.spec.ts` depende de `FACTUEZ_FISCAL_XSD_PYTHON`; no se contabiliza
como aprobada ni acredita homologación fiscal.

## Pendientes de B2B-09

No se modificó el stack actual, se enviaron correos reales ni hubo conexiones
oficiales. No se añadieron permisos o rutas B2B. Esta entrega no controla los
workers fiscales, otros procesos legacy o réplicas que no estén registrados.

La retención de bytes de reportes se completó en el incremento enlazado. Siguen
el inventario y cerco global de escritores, retención de los otros almacenes,
respaldo integral, observabilidad distribuida, rotación de claves,
paquete de despliegue/autoinicio Windows y piloto privado autorizado. Los gates
fiscales, migración real y aprobación de corte conservan sus requisitos.
