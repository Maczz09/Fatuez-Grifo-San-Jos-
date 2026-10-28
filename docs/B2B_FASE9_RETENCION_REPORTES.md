# B2B-09 — Retención de archivos de reportes

Fecha: 26/10/2026, Lima. Incremento técnico LOCAL/BETA. No desplegado en 8091.

## Resultado

Se implementó un adaptador privado de Billing para retirar únicamente los bytes
descargables de reportes CSV, Excel y PDF vencidos. Conserva la fila del trabajo,
su captura original, las claves de idempotencia, los hashes y el registro de la
operación. No borra XML, CDR, documentos fiscales, series, Outbox, recibidos ni
archivos del servidor. Tampoco establece una política legal de conservación.

El registro mantiene su estado `READY` y revisión 2, con una marca interna de
contenido retirado. Tras revalidar identidad, alcance y permisos actuales,
`createReport` con la misma clave, `readReport` y `downloadReport` responden
**410 / ARTIFACT_NOT_AVAILABLE**. Un usuario sin alcance sigue recibiendo el error
de autorización correspondiente, sin descubrir el vencimiento del recurso.
La misma clave no recaptura datos ni vuelve a generar un archivo diferente.
Crear otro reporte requiere una nueva solicitud y otra clave.

## Política y operación

`services/billing-service/src/b2b/phase8-reports/retention.ts` contiene
`B2bReportRetention`, `ReportRetentionPolicyPort` y `FixedReportRetentionPolicy`.
La composición es privada y explícita; no introduce endpoints, permisos B2B,
temporizadores, tareas de arranque ni descubrimiento de bases o emisores.

| Control | Regla |
| --- | --- |
| Activación | `enabled` debe ser exactamente `true`; por defecto está apagado. |
| Ejecución | Política `PLAN_ONLY` por defecto; `EXECUTE` requiere decisión explícita del operador. |
| Propietario/ambiente | Exclusivamente Billing, BETA, `REPORT_RENDERED_CONTENT_ONLY`. |
| Emisores | Lista explícita de 1–100 identificadores internos; sin valor «todos». |
| Antigüedad mínima | Configurada por el operador, entre 24 y 87.600 horas; no se asigna por defecto. |
| Lote | 1–100 filas y presupuesto de 24–256 MiB; se respetan ambos límites. |
| Compatibilidad | Debe declararse `REPORT_410_V1` después de desplegar lectores compatibles. |
| Política vigente | Revisión y SHA estables; vencimiento como máximo a cinco minutos, revalidado durante la transacción. |
| Plan | Metadatos y SHA, máximo 16 planes en memoria; vence en 60 segundos. Reloj de la base más límite monotónico. |

El rango de antigüedad es un límite técnico del adaptador, no una recomendación
de retención fiscal. La política aprobada debe definirse antes de activarlo.
No se obtiene autorización de un token B2B, de una cookie de la PWA ni de disponer
de un certificado. El adaptador recibe sólo el pool de Billing que le aporta la
composición local; no comparte tablas entre microservicios ni abre conexiones
por su cuenta.

1. `plan()` consulta metadatos de reportes `READY` y revisión 2, anteriores al
   corte y pertenecientes a los emisores configurados. Calcula el SHA de los
   bytes dentro de PostgreSQL y lo compara con los metadatos; no descarga el
   contenido al operador. Una inconsistencia detiene el proceso para revisión.
2. El operador revisa el resultado: cantidad, bytes, corte, vencimiento y hashes.
   La respuesta es una copia; modificarla no altera el plan interno.
3. `apply(planId)` exige política `EXECUTE`, configuración coincidente y plan
   vigente. Serializa operaciones de retención y bloquea las filas seleccionadas.
   Si otra operación cambió el lote, exige planificar otra vez.
4. En la misma transacción escribe la ejecución y sus evidencias, retira los
   bytes y fija las marcas. Revalida la política antes de confirmar. Un fallo o
   revocación revierte **todos** los cambios del lote.
5. Repetir una ejecución confirmada devuelve su comprobante técnico de auditoría,
   también después de reiniciar el proceso. No vuelve a borrar ni cambia el lote.
   Un identificador desconocido no permite inventar un plan.

Una descarga en curso conserva su transacción y contenido consistente; la
retención espera su bloqueo. Si excede el tiempo de espera, la operación falla
sin dejar una retirada parcial. `close()` detiene nuevas operaciones y espera
las iniciadas. Puede registrarse como `BILLING_REPORT_RETENTION` junto con
`BILLING_WEBHOOK_PUBLISHER` en el control local de mantenimiento. Esto no acredita
un cerco global de escritura ni autoriza un respaldo de producción.

## Esquema candidato y activación

`services/billing-service/b2b-report-retention.candidate.sql` es un candidato
transaccional **ensayado sólo sobre bases nuevas**, después del esquema candidato
de reportes. No lo ejecuta el adaptador ni el arranque de la aplicación.

El script reconoce la restricción base esperada antes de modificarla; una forma
distinta exige revisar el esquema. Añade la marca de retirada, una tabla de
ejecuciones y otra de auditoría. Los triggers conservan capturas y claves,
impiden borrar/truncar trabajos o modificar evidencias y verifican que filas,
bytes, hashes y auditoría se confirmen juntos. Una ejecución confirmada no admite
agregar evidencias en una transacción posterior.

Para una instalación existente deben revisarse previamente versión y esquema,
respaldo, escritores activos, consumidores y orden de despliegue. **Primero los
lectores compatibles con 410; después el esquema revisado y, por último, la
política privada.** Ningún componente antiguo debe intentar restaurar bytes o
regenerar un trabajo retirado. Este bloque no activó esa secuencia en el QA actual.

## Verificación

- Cinco pruebas unitarias nuevas: apagado por defecto, política acotada,
  autorización antes de 410, cierre con trabajo activo y expiración del plan.
- Dos pruebas nuevas de HTTP real con mTLS y SDK: incluyen el recorrido API B2B
  → RPC privado → Billing. Lectura, descarga y replay responden 410; el alcance
  revocado oculta el recurso y no hay recaptura. El filtro exclusivo de reportes
  preserva el vencimiento y el cliente del RPC lo normaliza a un código cerrado,
  sin propagar cuerpos o mensajes privados. Los demás filtros no se modifican.
- Nueve ensayos PostgreSQL nuevos: persistencia/reinicio, auditoría, rollback por
  revocación, carreras entre planes, protección SQL, exclusión por estado/edad/
  emisor, corrupción de contenido, presupuesto por bytes y bloqueo de descarga.
- Ensayo existente de recuperación ampliado: se destruye el origen y se restaura
  en otro clúster aislado. Se recuperan marcas, auditoría e idempotencia; el archivo
  vencido sigue devolviendo 410 y el replay de retención no duplica operaciones.
- Compilación: siete tareas correctas. Tipos globales: 29 tareas en 22 paquetes.
- Foco: 132 pruebas aprobadas en nueve archivos, sin fallos.
- Regresión general: 282 archivos, 11.908 pruebas aprobadas, cero fallos y una
  omisión condicional preexistente; duración 261,54 segundos. La omisión de XSD
  de `fiscal-batch.spec.ts` no se contabiliza como aprobada ni acredita validación
  fiscal oficial.

Informes: `output/qa/b2b-phase9-report-retention-focused.json`,
`output/qa/b2b-phase9-report-retention-db.json` y
`output/qa/b2b-phase9-recovery-db.json` y
`output/qa/b2b-phase9-retention-regression-final.json`. Los grupos se solapan; no
se suman como un total adicional. Los procesos terminaron correctamente y se
verificó que no quedan contenedores ni procesos propios de estos ensayos.

Pruebas específicas: `pnpm test:b2b-report-retention`.
Ensayo SQL: `pnpm test:b2b-report-retention:db`.
Los runners aislados no cargan el entorno de la aplicación: crean PostgreSQL
nuevo con imagen local, red deshabilitada, sin puertos publicados y almacenamiento
temporal. Comprueban la propiedad antes de retirar sus recursos.

## Pendientes del proyecto

B2B-09 continúa abierta para el inventario y cerco global de escritores,
retención de otros almacenes, respaldo integral, rotación de claves, observabilidad
distribuida, despliegue y piloto privado. Este bloque conserva las capturas y las
evidencias; no implementa eliminación completa de datos personales. Las fases
fiscales 2/3, la migración real y el corte conservan sus gates y aprobaciones.
