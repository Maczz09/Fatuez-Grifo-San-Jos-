# API privada — Fase 6: sincronización incremental

Fecha: 09/10/2026. Proyecto de **extracción privada**, no cierre de las fases
fiscales o de migración histórica. Exclusivamente BETA, implementación opt-in.

## Entrega

`GET /integration/v1/changes?issuerRuc=…&checkpoint=…&limit=100` devuelve
eventos de documentos empresariales 01/03/07/08, un `nextCheckpoint`,
`hasMore` y `expiresAt`. Requiere HTTPS/mTLS, un cliente técnico OAuth vigente,
`integration:documents:read` y `integration:changes:read`, además de grants
canónicos RUC–sede–punto–serie–tipo. No acepta un token de sesión de la PWA.

Tipos: `DOCUMENT_CREATED`, `DOCUMENT_STATE_CHANGED`, `ARTIFACT_ADDED` y
`DOCUMENT_RECONCILED`. No descarga archivos automáticamente ni modifica ventas,
XML, CDR, credenciales, correlativos, propietarios o Outbox de emisión.
La descarga original sigue en los endpoints de documentos/artefactos de fase 4.
09/31 siguen **UNSUPPORTED** para esta fuente empresarial, no se reemplazan con
laboratorios ni con muestras offline. Los datos de proveedores/SIRE pertenecen
a otro dominio y no se mezclan aquí.

## Diario durable y corte inicial

Cada propietario mantiene su propio diario técnico BETA. Un `UPDATE` de la
fila de estado por RUC reserva el siguiente número dentro de la MISMA
transacción que el cambio del documento/artefacto/CDR. El bloqueo se conserva
hasta commit/rollback: otra transacción del mismo RUC no puede confirmar un
evento posterior mientras la anterior está abierta. Un rollback deshace tanto
el contador técnico como el evento. No se usa `nextval`, máximo `updatedAt`,
un correlativo fiscal ni Socket.io como prueba de orden.

Los números son internos y por RUC/propietario, no públicos. El diario almacena
sólo identificadores técnicos, tipo de evento, posición y fecha. No contiene
clientes, ítems, XML, rutas de almacenamiento, errores privados ni secretos.

El checkpoint entregado en un listado/exportación contiene un vector privado:

1. Se obtiene primero el límite inferior del diario SUNAT propietario.
2. La captura Billing lee su barrera y TODOS los documentos en la misma
   transacción `RepeatableRead READ ONLY`, incluso cuando hay varias páginas SQL.
3. Se conserva ese vector en el corte cifrado y en el checkpoint. Las páginas
   posteriores, estado del export y manifiesto devuelven el mismo checkpoint.

Esto **no es una transacción distribuida** entre Billing/SUNAT. La barrera SUNAT
conservadora puede repetir cambios ya incluidos en los archivos del export;
se acepta ese solapamiento para no omitir los posteriores. El estado Billing y
la revisión de cada archivo original tienen las garantías distintas descritas
en fase 5. El feed no demuestra aceptación fiscal ni PKI.

Sin el scope de cambios, el corte sigue devolviendo `changeCheckpoint=null`.
Con el feed configurado y dicho scope, una barrera Billing ausente no se
reemplaza por una lectura tardía: `CHANGE_FEED_NOT_READY`.
Los catálogos de emisores/sedes/puntos no son cortes documentales y no entregan
checkpoint de cambios.

## Permisos, reintentos y lotes

Cada consulta autentica de nuevo el cliente; el checkpoint está cifrado y ligado
a cliente, revisión, scopes, grants, ambiente BETA y filtros del corte. No permite
ampliar periodo, tipos o sedes pasando filtros adicionales a `/changes`.

Antes de responder se revalida el origen canónico y la huella del snapshot de
cada documento. Los eventos de lote exigen autorización de **todos** sus miembros,
incluso los que están fuera del periodo o tipos solicitados. No se entrega un
CDR compartido como si perteneciera sólo al comprobante seleccionado.
Los miembros pendientes de un lote se conservan cifrados para continuar por
páginas; no se avanza el evento de origen perdiendo sus miembros restantes.

Los eventos visibles tienen `eventId` estable, derivado del evento de origen y
documento. `sequence` es un ordinal visible de ESTA cadena de checkpoints;
no revela incrementos ni IDs ocultos de otro ámbito y no es una secuencia global
de commit entre microservicios. Se alternan las dos fuentes para evitar inanición.

`version` corresponde a la versión Billing observada al resolver la entrega,
no a una copia de cada transición histórica en el instante de commit SUNAT.
Una página no vacía se publica de manera durable, cifrada, con ganador atómico
por checkpoint/limit; repetirla conserva eventos, versiones y siguiente
checkpoint incluso después de reiniciar el proceso.
Una consulta vacía se audita sin reservar una página durable por cada sondeo;
su reintento puede ver cambios nuevos, siempre sin saltarlos.

No debe ignorarse `ARTIFACT_ADDED`/`DOCUMENT_RECONCILED` porque la versión Billing
sea igual: puede haberse añadido un XML/CDR o su vínculo sin cambiar dicha
proyección. El consumidor debe refrescar los recursos/artefactos autorizados
por cada evento aún no procesado. Un SHA/versión no acredita validez fiscal.

## Protocolo para el cliente

1. Descargar todas las páginas del corte, o verificar el export/manifiesto.
2. Guardar el `changeCheckpoint` del corte junto con los datos aplicados.
3. Pedir `/changes` con ese checkpoint y el MISMO RUC. Autenticar de nuevo cuando
   venza el access token; nunca guardar ese token en una cola de trabajos.
4. Por cada `eventId` no procesado, consultar detalle e inventario de originales.
   Deduplicar IDs en almacenamiento propio; los hashes de versión son opacos,
   no ordenar lexicográficamente ni comparar como números.
5. Confirmar eventos aplicados, IDs deduplicados y `nextCheckpoint` en UNA
   transacción del consumidor, con compare-and-set del checkpoint de entrada.
   Mantener un único escritor por cadena: otro proceso no puede confirmar una
   página si el checkpoint ya avanzó. Si falla, repetir el checkpoint anterior.
6. Mientras `hasMore=true`, continuar sin esperar. Con `false`, seguir sondeando
   periódicamente: significa alcanzado el límite observado, no que nunca habrá
   más cambios. Incluso una página vacía devuelve un checkpoint nuevo.

La entrega es **al menos una vez**, no exactamente una vez. La aplicación
contable del consumidor y su transacción son responsabilidad de su integración.
Un error nunca confirma un siguiente checkpoint. No se ofrece webhook público.

## Retención, integridad y recuperación

El checkpoint vence siete días después del corte inicial; sondear no amplía esa
fecha. Cada consulta comprueba ambas épocas y pisos de retención, también en
reintentos cacheados. `410 CURSOR_EXPIRED` obliga a un corte nuevo. Cambiar grants
o su revisión invalida el contexto. Fallos de identidad, fuente, integridad,
auditoría o almacenamiento no tienen fallback permisivo.

El almacén de entregas es técnico, independiente de datos fiscales, con AES-256-GCM,
AAD por cliente/contexto/registro y clave externa. Cuotas de prueba actuales:
500 eventos visibles por página, 500 eventos de origen escaneados por llamada,
2.000 miembros expandidos por lote, 4 MiB por entrega, 256 entregas activas,
32 MiB de ciphertext retenido. Son límites de servidor, no promesa de capacidad
de producción; se deben dimensionar y ensayar en fase 7/piloto. Excederlos produce
un error explícito, nunca truncamiento silencioso. Una consulta vacía no consume
una entrega. Reintentar un nuevo corte no borra ni libera las anteriores.

La limpieza sólo afecta ciphertext técnico vencido, con tandas de 100 y tombstones
retenidos siete días adicionales. La auditoría permanece; su política de archivo
y volumen se define con TI. La retención de diarios de propietarios NO se ejecuta
automáticamente: `trim` exige credencial técnica separada y valida un prefijo
contiguo, bajo bloqueo de estado, antes de eliminar eventos y mover el piso.
Nunca elimina bindings, originales o historia fiscal.

Tras restaurar/clonar un propietario, **no servir su época copiada**. TI debe
detener lectores/escritores, regenerar épocas y limpiar exclusivamente el diario
técnico en una operación autorizada, conservar bindings y obtener cortes nuevos.
Reiniciar un proceso sin restaurar la BD no requiere ese reinicio del diario.
La disponibilidad comprueba también las tablas y todos los triggers esperados
(tabla, función, timing y habilitación). Deshabilitarlos produce 503, no un
diario vacío aparentemente disponible. Tras bypass se exige época nueva y corte.

## Activación pendiente y protección de emisión

Todo permanece desactivado por defecto. No se cambiaron Compose, Kong, `.env`,
PWA, emisores, credenciales, correlativos ni la BD activa del QA.
Flags separados: `INTEGRATION_BILLING_CHANGES_ENABLED`,
`INTEGRATION_SUNAT_CHANGES_ENABLED`, `INTEGRATION_CHANGES_ENABLED`.
Billing exige también captura estable habilitada. La fachada utiliza el
propietario técnico de exportaciones ya previsto; no abre una conexión fiscal.

Los tres SQL son **blueprints**, no migraciones registradas ni DDL de arranque.
El ensayo sólo los aplica sobre PostgreSQL NUEVO con datos ficticios. Su futura
instalación en una copia autorizada requiere ventana sin escritores, respaldo,
roles mínimos, retención, inventario/épocas y autorización de TI. Las guardas
protegen identidad, snapshots emitidos y vínculos originales; no pueden
deshabilitarse para permitir correcciones contables. Las correcciones de
comprobantes siguen su circuito fiscal, no la API de extracción.

Los triggers incorporan bloqueo por RUC al flujo de persistencia del propietario:
antes de activar en una copia real se debe ensayar carga, latencia, orden de
bloqueos, errores de serialización/deadlock y reintentos del emisor. Este ensayo
no sustituye ese piloto ni autoriza modificación del emisor en producción.

## Verificación

214 pruebas nuevas / cuatro suites PASS: feed, HTTP/mTLS, diario y almacén.
Regresión completa: **4 873 PASS / 124 suites**, con una omisión condicional XSD
preexistente (FACTUEZ_FISCAL_XSD_PYTHON no configurado), ninguna omisión nueva.
Inventario: siete pruebas PASS. Contratos, paquete compartido, Billing, SUNAT,
fachada y exportador compilados.

**86 comprobaciones en PostgreSQL nuevo/ficticio PASS**: commit/rollback,
captura Prisma con barrera en el mismo MVCC, independencia por RUC, fuentes
excluidas, artefactos/lotes/CDR tardíos, permisos de instalación, retención,
restore/épocas y persistencia cifrada/idempotente. El runner corrigió su orden
de comprobación numérico (no lexicográfico) antes del PASS. Los recursos nuevos
etiquetados se retiraron; ninguna base ni contenedor existente fue modificado.

Reproducir únicamente con fixtures:

```powershell
pnpm test:integration-changes
pnpm test:integration-changes:db
pnpm exec vitest run --maxWorkers=2 --testTimeout=30000 --hookTimeout=30000
```

La concurrencia de trabajo del feed está limitada a dos incluso si el cliente
desconecta mientras el trabajo sigue. Las pruebas HTTP usan identidad M2M real
con repositorios ficticios y cinco listeners HTTPS temporales; no son prueba
de disponibilidad de emisores reales ni conectividad VPN.

Siguiente: **fase 7**, despliegue privado y endurecimiento de red/Kong/VPN,
dimensionamiento y procedimiento de activación. No publicar esta API a Internet
ni ejecutar operaciones oficiales para probar el feed.
