# Verificación B2B-07 — Diario y recuperación de guías

22/10/2026. Quinto bloque candidato:
[alcance, estados y límites](B2B_FASE7_DIARIO_ENVIO_GUIAS.md).
No desplegado; no cierra B2B-07 ni acredita CDR, PKI o envío oficial.

## Pruebas específicas

163 pruebas aprobadas, cero fallos en la repetición integrada:

| Archivo | Aprobadas | Alcance |
| --- | ---: | --- |
| `guide-dispatch-journal.spec.ts` | 79 | Contrato exacto BETA/local, integridad, transiciones, hashes, datos inseguros y límite de 128 eventos |
| `guide-dispatch.spec.ts` | 50 | Coordinador real con dueño/transporte/persistencia ficticios; intención antes de enviar, duplicados, reinicio, timeouts y resultados tardíos |
| `guide-dispatch-store.spec.ts` | 34 | SQL parametrizado, aislamiento, CAS, cabeceras físicas, errores, serialización y callbacks que absorben fallos |

El primer ensayo conjunto detectó un problema del arnés: cargaba la clase de
error mediante `createRequire` y por imports transformados de Vitest, generando
instancias de módulos diferentes. Se unificó el import estático del mismo módulo;
se conservaron las comprobaciones de tipo y la lista finita de errores permitidos,
sin sustituirlas por aceptar cualquier objeto con un `code`. La repetición de
las tres suites aprobó todas sus pruebas.

La revisión reforzó la unicidad fiscal a RUC/tipo/número, sin incluir companyId:
cambiar un ID interno no puede habilitar un segundo stream para el mismo número.
Las consultas sí conservan siempre empresa, RUC y operación como alcance exacto.

## Persistencia real aislada

**22 grupos PostgreSQL aprobados.** Se usó el helper existente, sin modificarlo:
contenedor NUEVO, etiquetado, `--rm`, tmpfs, sin red ni puertos publicados, sin
descargar imágenes. Dentro de él el runner creó una base independiente fija,
`guide_dispatch_synthetic`, con sólo `GuideDispatchStream` y `GuideDispatchEvent`.
No tiene FK hacia maestros de Billing ni reutiliza una base del cliente.

Se comprobaron registro/append atómicos, idempotencia, identidad fiscal global
por RUC y documento, alcance triple, CAS concurrente, fallos absorbidos, enlace
diferido de cabecera/evento, orden/predecesor, prohibición de modificar/borrar/
truncar historial, BETA/local obligatorio, formas/hashes exactos y límite de
128 eventos. Los fallos revierten todos los cambios de su transacción.

Tres grupos usaron el coordinador y store REALES sobre esa base, con dueño y
emulador ficticios: otra conexión observó el intento ya comprometido antes de
`submit`; trabajos simultáneos realizaron un solo envío local; pérdida de
respuesta/reinicio/conciliación no repitió el envío; recibir un resultado dejó
la verificación oficial pendiente y todos los flags fiscales falsos.

No se desactivaron triggers, constraints, roles o aislamiento. La prueba de una
transición semántica inválida con hash válido ocurrió únicamente dentro de una
transacción deliberadamente revertida y fue rechazada por el reductor real. SQL
valida forma/integridad/enlaces; el motor añade la validación del flujo de negocio.
Los intentos de alterar físicamente registros fueron bloqueados por sus guards.

La base sintética inicial del helper conservó idénticas sus filas, esquema,
restricciones, índices, triggers y secuencias. El helper verificó la etiqueta
del contenedor propio antes de limpiarlo; el resultado PASS se emitió después
de cerrar conexiones y completar esa limpieza. No hubo migración existente.

## Tipos e inventario

Regresión completa: **198 archivos aprobados, 8.768 pruebas aprobadas,
una omisión condicional preexistente y cero fallos**, en 185,12 segundos.
Incluye las 163 nuevas pruebas de este bloque, sin sumar corridas separadas.

28 tareas de tipos aprobadas en 21 paquetes. sunat-core y SUNAT service compilados.
Inventario y artefactos candidatos regenerados desde fuente, sin publicación:
247 rutas declaradas, 30 funciones, 109 acciones planificadas y 20 pantallas.
Se mantienen 63 operaciones públicas candidatas y 38 GET; este bloque no añade
rutas HTTP, scopes o cambios de permisos B2B.

## Seguridad y límites

Manifiestos, documentos, dueños, tickets y respuestas íntegramente ficticios.
No se ejecutó el adaptador oficial ni se obtuvieron tokens o certificados.
No se alteraron main/AppModule, Kong, Swagger activo, stack QA o configuración
de emisores. No hay migraciones/db push ni cambios de series, ventas, Document,
Outbox o dueños en una base existente.

El resultado del emulador conserva `officialCdrVerified:false`,
`fiscalExecutionEnabled:false`, `transmissionAuthorized:false` y
`authorizedForTransfer:false`. Un manifiesto y un hash no prueban firma XML,
confianza del certificado o autenticidad del CDR. El port `findTicket` no afirma
que exista un endpoint SUNAT de búsqueda por hash; sólo ensaya el canal local.

Se consultó el portal GRE oficial y se intentó descargar su ZIP XSL mediante
HTTPS normal. La respuesta fue 403; no se incorporó el paquete ni se declaró
ejecutado, ni se eludieron controles. Este bloqueo no se presentó como una falta
de documentos o credenciales del cliente.

Reproducción: `pnpm test:b2b-guide-dispatch` y
`pnpm test:b2b-guide-dispatch:db`, siempre con el modo sintético fijo del runner.
