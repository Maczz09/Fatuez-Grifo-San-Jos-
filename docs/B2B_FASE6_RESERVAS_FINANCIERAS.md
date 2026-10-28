# B2B-06 — Reserva y retención financiera atómicas: ensayo local

Fecha: 20/10/2026. Estado: **composición implementada y probada con datos
sintéticos; no activación fiscal, ni cierre de B2B-06**.

## Qué se avanzó

Se agregó `reserveWithinTransaction()` al repositorio propietario de suplementos.
Revalida comando, actor, permisos, original, historial y serie, pero utiliza la
transacción suministrada por el propietario: no abre una transacción anidada.
La entrada existente `reserve()` y sus validaciones se conservan.

`SyntheticCorrectionReservations` coordina en UNA transacción Serializable:

1. Comprobar base de ensayo, autoridad del servidor y contexto autorizado.
2. Bloquear empresa/RUC y maestros; verificar el snapshot original y la integridad
   del historial de notas, comandos, retenciones y cabeza acumulada.
3. Reservar la nota con sus ítems, impuestos, referencia, contador y Outbox.
4. Insertar el recibo financiero inmutable y actualizar la cabeza con CAS.
5. Revalidar la autoridad antes del commit. Si algo falla, se revierte todo.

El recibo estable devuelve `HELD_LOCAL`, importe y revisión de reserva, con
`candidateOnly=true`, `fiscalAuthority=false`, `evidenceAuthenticityVerified=false`
y `transmissionAuthorized=false`. Una retención **no es** un efecto contable
aceptado, un libro tributario ni prueba de XML/CDR/firma/PKI.

## Controles concretos

- SERVICE conserva `createdByUserId=null` y procedencia tipada; USER conserva el
  subject entregado por la autoridad inyectada. En el ensayo esa identidad es
  ficticia: no se afirma una validación SSO real ni se inventa un humano SERVICE.
- La representación del actor no es un autenticador: no sustituye OAuth/OIDC,
  roles o grants. Los actores B2B exigen scope ASSIGNED y metadatos consistentes.
- La autoridad se obtiene por un puerto del servidor, no desde JSON público.
  Cambios de autoridad durante el comando abortan la transacción. El comando
  validado se copia y congela profundamente antes de entregarlo a otros puertos.
- Reintentar después de perder una respuesta recupera el mismo recibo. Un replay
  histórico no rebobina la cabeza ni consume otro número. Otro cliente/usuario
  no puede apropiarse de un recibo por conocer su operationId.
- Retenciones y cabeza se contrastan con Document y con el comando exacto propio
  de Outbox. Una nota previa sin retención requiere conciliación: no se adopta
  silenciosamente ni se reconstruye saldo usando máximos observados.
- Un ledger de versiones o historial de lotes previo exige conciliación explícita;
  no se toma su proyección local como permiso para volver a corregir/anular.
  También se detectan referencias históricas por tipo/serie/número sin target ID.
- Los créditos retenidos no exceden el original. Los débitos se registran por
  separado y no amplían ese techo. El validador existente mantiene los controles
  por ítem, cantidad, importe, referencia y motivos soportados.
- Una proyección local REJECTED no libera retenciones. Las diferencias de
  historial requieren conciliación/evidencia, no una devolución automática de saldo.
- El contador usa CAS: dos comandos preparados con el mismo número no pueden
  reservarlo ambos. Un conflicto falla sin renumerar ni modificar el comando.
- Reintentos de serialización acotados; los demás fallos revierten la transacción.
- SQL impide actualizar/borrar recibos y disminuir retenciones o reescribir la
  identidad/snapshot del original en la cabeza. No hay método de release ni reset.

## Límites que siguen vigentes

La composición está deliberadamente restringida a `b2b_corrections_synthetic` y a
un RUC de fixture `20000000001`, sin información comercial real. El runner crea
esa BD desde cero en PostgreSQL temporal, tmpfs, sin red ni puertos publicados.
No utiliza certificados, credenciales o CDR reales. Las afirmaciones de aceptación
de los fixtures son simuladas y nunca se convierten en confianza fiscal.

No se debe habilitar negocio cambiando ese nombre, RUC o retirando guards. La
composición real requerirá un resolvedor confiable y revisión de autorización.
El perfil ensayado es NOTE F 07/08, BETA/PEN/IGV18 según el validador existente;
notas B requieren RC y no se incorporaron a este productor. Tampoco RC/RA/09/31.

El scope del ensayo incluye explícitamente series del original y de NC/ND. Eso
**no significa** que el modelo Identity B2B ya conceda bindings 07/08: los bindings
operativos candidatos siguen en 01/03. No se ampliaron clientes ni grants.

`assertBillingSupplementActivation()` y
`assertFinancialLedgerCandidateActivation()` siguen cerrados antes de operar.
El nuevo coordinador no está en AppModule, controladores, cron, workers ni Kong.
No añadió endpoints: el contrato candidato continúa en 52 operaciones.

Las nuevas tablas `B2bCorrectionHoldHead` y `B2bCorrectionHold` son un diario de
retenciones candidato. No sustituyen el ledger de versiones/efectos financieros
aceptados existente. No se escribieron `FinancialLedgerEntry` ni recibos de
aceptación oficial a partir de banderas simuladas.

DDL: `services/billing-service/b2b-correction-holds-schema.candidate.sql`.
No es una migración aplicada; sólo se ensayó en bases nuevas. La instancia QA,
sus esquemas, ventas, contadores, credenciales y certificados no se tocaron.

## Verificación y siguiente bloque

- Veinticuatro pruebas unitarias de procedencia, entradas ejecutables/proxies, mutabilidad,
  cambio de autoridad, base incorrecta, reintentos y gates sin activar.
- Catorce grupos de ensayo PostgreSQL con Prisma y repositorio Billing reales: nota/retención
  conjunta, ocho replays, comandos distintos con número conflictivo, reinicio,
  fallos tras reserva/commit y revocación antes del commit, varios créditos
  parciales, débito sin ampliar crédito, proyección rechazada sin release,
  SERVICE/USER, historial alterado, triggers, maestros inactivos y operación huérfana.
- Se sembraron por separado una cabeza financiera BASE candidata y un lote
  ficticio rechazado para comprobar que no se adoptan como autorización de saldo.
  El coordinador no creó esos datos de fixture ni registró efectos aceptados.
- Outbox queda sin publicar y no se contacta SUNAT, SMTP o callbacks.
- `pnpm test:correction-reservations` y
  `pnpm test:correction-reservations:db` reproducen estos controles con fixtures.

La [autoridad explícita de series de corrección](B2B_FASE6_AUTORIZACION_SERIES_NOTAS.md)
ya dispone de implementación candidata y pruebas separadas. No se conectó para
activar este ensayo ni sustituir sus restricciones sintéticas.

La [continuación de composición](B2B_FASE6_COMPOSICION_Y_RESULTADOS.md) agrega
verificación propietaria por ports, reserva sintética verificada y commits de
resultados aceptados/rechazados con relectura y rollback. No conecta todavía el
puente privado entre microservicios ni la reserva dinámica empresarial.
La composición probada reduce el pendiente transaccional; no cierra el circuito
fiscal ni autoriza pasar por alto los gates de B2B-06 o de las etapas históricas 2/3.
