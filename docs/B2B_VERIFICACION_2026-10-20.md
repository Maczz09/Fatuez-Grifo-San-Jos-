# Verificación del avance B2B

Fecha: 20/10/2026. Alcance: código candidato LOCAL/BETA y datos ficticios.
No despliegue en QA ni producción; sin SOAP/REST/OAuth oficiales, correo real,
lectura de certificados/secretos del cliente o cambios en sus correlativos.

## Resultados ejecutados

| Verificación | Resultado |
| --- | --- |
| Regresión Vitest general final, 2 workers | 158 archivos aprobados; 5 636 pruebas aprobadas; 1 omitida |
| Pruebas focalizadas B2B-06 + auditoría/extracción | 84 pruebas aprobadas / 5 archivos |
| Pruebas específicas B2B-05 con controles finales | 50 pruebas aprobadas / 7 archivos |
| Tipos de todo el monorepo | 28 tareas correctas, 21 paquetes en alcance |
| Compilación de contratos, transporte, Billing, Identity, SUNAT, fachada B2B, exportador y webhooks | Correcta |
| PostgreSQL nuevo para borradores | 7 comprobaciones aprobadas |
| PostgreSQL fiscal nuevo para emisión B2B-04 | 11 comprobaciones aprobadas con Prisma y motor Billing reales |
| PostgreSQL técnico nuevo para cortes/exportación/feed B2B | 5 comprobaciones aprobadas |
| PostgreSQL Billing + webhooks + receptor, bases nuevas separadas | 7 comprobaciones aprobadas |
| PostgreSQL nuevo comercial + conversión con motor Billing/Prisma | 11 grupos de comprobaciones aprobados |
| Continuación B2B-06: reserva + retención financiera en BD sintética nueva | 14 grupos aprobados; Prisma y repositorio de suplementos reales |
| Reserva/actores/repositorios/gates y auditoría, pruebas focalizadas | 190 pruebas aprobadas / 5 archivos |
| Auditoría AST de fuente | 30 capacidades, 109 acciones planificadas, 221 rutas declaradas, 20 pantallas |
| Rutas externas candidatas implementadas | 52; publicación runtime=false |
| git diff --check | Sin errores; avisos de normalización LF/CRLF del checkout Windows |

Las pruebas HTTP abrieron listeners HTTPS/mTLS efímeros de loopback:
Identity/fachada/Billing/SUNAT/exportador/webhooks/receptor. Los propietarios y documentos de
negocio de esos recorridos eran ficticios. Los ensayos SQL utilizaron PostgreSQL
real, pero sólo bases NUEVAS en tmpfs, sin red ni puertos publicados, creadas con
etiquetas únicas y retiradas al terminar. No quedaron esos contenedores temporales.

No se afirma un piloto con negocio real ni un recorrido íntegro contra TODAS las
bases fiscales: los ensayos PostgreSQL cubren borradores, la base técnica de
extracción y, adicionalmente, la transacción REAL de emisión de Billing sobre un
esquema NUEVO y datos sintéticos. Los recorridos HTTPS usan puertos de negocio
ficticios; el ensayo fiscal PostgreSQL reutiliza el motor/Prisma reales, sin red.
Los XML de prueba conservan sus bytes pero no acreditan XMLDSig/PKI o CDR oficial.

El ensayo B2B-04 comprobó incremento único bajo ocho solicitudes simultáneas,
SERVICE sin humano inventado, USER con subject real, factura/boleta, dos borradores
en la misma serie, rollback completo tras escritura fiscal/fallo de commit o
revocación detectada antes de confirmar, reinicio y recuperación sin renumerar.
Producción, emisor inactivo y serie agotada fueron rechazados. Outbox fiscal y
diario B2bCommitEvent quedaron separados y sin envío; no se crearon PDF/XML/CDR
físicos de nuevas ventas. Los contenedores temporales fueron retirados.

B2B-05 añade el recorrido HTTPS de gestión/publicación/autorización y un receptor
ficticio que verifica con el SDK Standard Webhooks. En SQL se ensayaron TRES bases
separadas NUEVAS (Billing/webhooks/receptor): no publicar antes de commit, pérdida
de ACK, deduplicación, rollback, recuperación de lease/reinicio, polling sin Redis,
revocación y separación de la cola fiscal. El receptor conserva el payload mínimo
además del hash antes de ACK. No se ensayó una caída de un Redis real ni se envió
a callbacks del cliente. El panel shadcn se comprobó por tipos/render SSR/contrato;
no está montado en el menú PWA ni se afirma prueba visual de un despliegue.

B2B-06 incorpora notas de venta con numeración comercial separada, revisión,
cierre/cancelación, conversión atómica al motor 01/03 y registro de solicitudes
de corrección bloqueadas para ejecución fiscal. El ensayo real PostgreSQL verificó
concurrencia, recuperación, rollback tras emisión/commit/revocación, referencia
única, originales intactos, actor SERVICE/USER y rechazo de producción/serie agotada.
Se corrigió y comprobó el mapeo real de Prisma pg `P2010/UniqueConstraintViolation`
a conflicto 409. No hubo escrituras en el ledger financiero ni envío alguno.
La evaluación `/correction-requests/{id}/readiness` detecta moneda, importes y
referencias locales inconsistentes; limita y deduplica el historial sin liberar
importe por estados rechazados. Ensayada también por referencias históricas sin
target ID. Siempre bloqueada, sin reserva ni prueba PKI/CDR, y con
`historyCompleteness=NOT_VERIFIED` / `spendableBalance=false`.

La [continuación financiera](B2B_FASE6_RESERVAS_FINANCIERAS.md) agrega una
composición restringida a BD/RUC de fixture: nota/ítems/impuestos/referencia,
contador, Outbox, retención y recibo se confirman o revierten juntos. Se probó
SERVICE sin humano ficticio, USER, ocho replays, comandos distintos con mismo
número, fallos tras reserva/commit/revocación, varios créditos, débito sin ampliar
capacidad, proyección rechazada sin release, triggers y datos huérfanos. También
se detectan referencias antiguas sin target ID y se rechaza adoptar un ledger o
lote previo sin conciliación. No sustituye evidencia/ledger de efectos aceptados;
los gates públicos siguen cerrados y no añadió rutas a las 52 candidatas.

## Estado y siguiente dependencia

- [B2B-03: lectura/extracción](B2B_FASE3_LECTURA_Y_EXTRACCION.md): código preparado
  y pruebas locales correctas para 01/03, originales, PDF local, exportación/feed.
  Rollout privado, roles/esquemas/TLS/clientes y piloto real siguen pendientes.
- [B2B-04: borradores y emisión](B2B_FASE4_BORRADORES.md): implementación técnica
  candidata completada. Actor SERVICE/USER, Document/ítems/correlativo/operación/
  idempotencia/Outbox en UNA transacción; resultado ambiguo recuperable sin renumerar.
  Emisión 01/03 local BETA limitada, scope explícito y revisión validada obligatorios.
- [B2B-05](B2B_FASE5_WEBHOOKS.md): circuito candidato de emisión LOCAL 01/03,
  Inbox/fan-out, firma SDK, permisos vigentes, destino seguro, reintentos,
  dead-letter/replay y panel integrable implementados/ensayados.
  Otros productores del catálogo y el rollout siguen pendientes; no se publican
  eventos de aceptación tributaria sin evidencia verificada del propietario.
- [B2B-06](B2B_FASE6_NOTAS_COMERCIALES_Y_CORRECCIONES.md): parte comercial candidata
  implementada y ensayada. Falta la integración de evidencia/ledger y el productor
  empresarial fiscal de NC/ND/bajas; no se cierra la fase ni se salta a B2B-07.
  Ningún cierre técnico autoriza por sí solo rollout, credenciales o producción.

Contratos: [candidato de 52 operaciones](b2b/openapi.candidate.v1.json),
[subconjunto de lectura](b2b/openapi.read.candidate.v1.json),
[subconjunto con borradores](b2b/openapi.drafts.candidate.v1.json).
El contrato de diseño inicial permanece separado y no implica rutas disponibles.

No se modificaron Kong, Compose, firewall, permisos efectivos/grants, esquemas o
contenedores de la instancia QA como parte de este avance B2B. Por eso estas
rutas nuevas NO aparecen aún en el Swagger de localhost:8091: se verificaron en
ensamblajes aislados, no sustituyendo el sistema activo.
