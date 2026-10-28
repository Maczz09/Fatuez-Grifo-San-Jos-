# B2B-07 — Productor atómico local de guías

Iniciado el 22/10/2026; integrado y ensayado el 23/10/2026. Sexto bloque candidato.
**No desplegado. No es emisión oficial,
autorización de traslado ni cierre de la fase 7.**

## Qué resuelve

Una guía READY sólo congelaba el borrador. Este bloque añade un productor de
propiedad de Billing para reservar el número y guardar cabecera, detalle por
ítem, recibo idempotente y evento local pendiente en una sola transacción.
El perfil implementado es 09, motivo 04, transporte privado 02 y bienes
declarados localmente no regulados. Otros perfiles continúan bloqueados.

No se copian ceros o totales inventados a `Document`: las guías tienen un
agregado relacional propio, porque no son una venta con importes de IGV.
El snapshot conserva emisor, origen, destino, transporte e ítems íntegros.
Se valida el cuerpo con el preparador de perfil existente, pero esto **no
acredita ejecución del paquete completo de reglas oficiales**.

## Permisos y series

Se exige una autoridad privada con capacidad `BETA_GUIDE_ISSUE_LOCAL`, actor
SERVICE/USER auténtico y concesión exacta del ancla, la serie de borrador y
la serie fiscal. Un permiso WRITE del borrador no concede emisión. Un actor
SERVICE mantiene identidad humana nula; no se simula un administrador.
El proveedor real de esa autorización sigue pendiente de integración: las
autoridades ficticias están sólo en pruebas, nunca en el ensamblaje candidato.

La tabla candidata `B2bGuideIssueSeries` vincula explícitamente la serie de
planificación con un `SeriesCounter` DESPATCH_ADVICE existente del mismo
RUC/punto y etiqueta. No se crean vínculos automáticamente, no se infieren
desde el mayor número observado ni se reinician contadores. La lista de RUC
habilitados es explícita; vacía no permite ningún emisor.

Durante los ensayos se consumen únicamente contadores ficticios de una BD
nueva y desechable. La definición SQL es aditiva y candidata: no se aplica
a las bases de desarrollo existentes ni a la empresa por esta entrega.

## Atomicidad y recuperación

El contexto usa la misma transacción SQL que la numeración: emisor BETA,
sede/punto, ancla, vínculo explícito, contador, mapa de establecimientos y
política de bienes se contrastan con sus versiones/huellas y locks retenidos.
No se considera suficiente una lectura previa en otra transacción.

La clave idempotente se asocia a cliente, actor y hash de la petición. Un
reintento idéntico recupera el recibo sin asignar otro número. Otra petición
con la misma clave produce conflicto. Otra clave para el mismo borrador
tampoco permite numerarlo de nuevo. La identidad fiscal es única por
RUC/tipo/serie/número, no por una empresa interna que pudiera duplicarse.

Un error antes del commit revierte contador, cabecera, ítems, recibo y evento.
Si se pierde autorización después del commit, no se recicla el número: un
reintento con autorización vigente recupera el resultado persistido.
Los cambios posteriores del maestro no reescriben el snapshot histórico.

El borrador conserva su contrato READY; el nuevo resultado se consulta como
preparación local numerada. La protección SQL impide editar/cancelar un
borrador ya vinculado a una guía preparada. Cancelarlo fiscalmente requerirá
un flujo explícito independiente, no borrar o reutilizar su número.

## Integración deliberadamente pendiente

El evento `guide.issue.prepared.local.v1` vive en una tabla propia: **no** se
inserta en `OutboxEvent` ni lo consume el worker fiscal anterior. No arranca
workers ni se conecta al diario de envíos automáticamente. El sexto bloque no
incluyó rutas; la [continuación de API y permisos](B2B_FASE7_API_Y_PERMISOS_GUIAS.md)
añade sus adaptadores candidatos sin montarlos en el stack activo.
El ensamblaje `createCandidateGuideIssueProducer` exige todas sus dependencias
y no realiza operaciones al construirse.

El resultado conserva `candidateOnly=true`, `numberReserved=true`,
`fiscalExecutionEnabled=false`, `transmissionAuthorized=false`,
`officialRulesValidated=false`, `officialCdrVerified=false` y
`authorizedForTransfer=false`. Numerado no significa firmado ni aceptado.

La concesión privada persistente, API de emisión y consulta de resultado se
implementaron en el [séptimo bloque](B2B_FASE7_API_Y_PERMISOS_GUIAS.md), todavía
sin despliegue. Continúan pendientes la integración de consulta/UI, XML numerado definitivo y firma/PKI/CDR,
reglas oficiales versionadas, perfil 31 completo, referencias y lotes RC/RA,
worker autorizado y piloto específico. No se habilitan producción ni envíos
a SUNAT por guardar credenciales o aprobar estas pruebas.

Resultados reproducibles: [verificación del bloque](B2B_VERIFICACION_PRODUCTOR_GUIAS_2026-10-23.md).
