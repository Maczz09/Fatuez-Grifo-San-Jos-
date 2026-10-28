# Verificación B2B-07 — Catálogos y bienes locales

Continuación posterior: [diario y recuperación de guías](B2B_VERIFICACION_DIARIO_GUIAS_2026-10-22.md).
Este archivo conserva los resultados del cuarto bloque.

22/10/2026. Alcance:
[cuarto bloque de B2B-07](B2B_FASE7_CATALOGOS_Y_BIENES.md).
Entrega candidata no desplegada; no acredita validez fiscal, PKI ni permisos
reales de TI. No se cierra B2B-07 por completar estas verificaciones locales.

## Pruebas específicas

235 pruebas aprobadas, cero fallos:

| Archivo | Aprobadas | Cobertura principal |
| --- | ---: | --- |
| `guide-catalogues.spec.ts` | 75 | Forma exacta, listas canónicas, hashes, procedencia declarada, límites y pertenencia de códigos |
| `b2b-guide-goods.spec.ts` | 99 | Núcleo real con persistencia/autoridad ficticias, clasificación explícita, permisos, CAS, obsolescencia y revalidación |
| `b2b-guide-goods-store.spec.ts` | 39 | SQL parametrizado, proyección acotada, revisiones, Serializable, errores absorbidos, reintentos y cuotas |
| `b2b-guide-goods-preparation.spec.ts` | 22 | Dos controles locales, autorización previa, compatibilidad y composición con propietarios reales de dominio |

Las pruebas detectaron un resultado de persistencia `[null]` que podía causar
un TypeError al inspeccionar IDs. Se añadió validación de la forma de cada fila;
ahora se rechaza como inconsistencia sin producir una preparación. Se repitió
la suite del bloque tras corregirlo.

Se verificó también el rechazo de LF final en identificadores/hashes/unidades,
entradas con accesores/proxies, datos no objeto y cuerpos superiores al límite.
Los hashes identifican contenido; no se equiparan a firma ni confianza normativa.

## Persistencia real aislada

22 grupos aprobados con el núcleo y adaptador compilados. El helper existente
creó su PostgreSQL NUEVO, etiquetado, `--rm`, tmpfs, sin red, sin puertos publicados
y sin descargar imágenes. Verifica su etiqueta antes de limpiar el contenedor.
No se consultó ni modificó ninguna base ya existente.

Comprobaciones: política/versión/auditoría atómicas, aislamiento de RUC y rechazo
de emisor inactivo/no BETA, clasificación explícita, ediciones del maestro,
revisión de emisor, CAS obsoleto, fallos de append/auditoría, autoridad cambiada,
reintento completo con reautorización, ganador único concurrente y bloqueos de
metadatos. Restricciones de forma, historial append-only, prohibición de truncado,
cuotas monotónicas y rechazo de cambios posteriores en la política.

El DDL sólo comprueba su estructura y relaciones; no calcula un SHA canónico
ni prueba identidad o clasificación oficial. El núcleo vuelve a validar el
contenido y sus hashes antes de utilizarlo. Una prueba específica diferencia
ambas capas y revierte la fila estructural deliberadamente no confiable.

Todos los demás datos de las tablas base permanecieron idénticos en el ensayo.
Sólo cambian el registro local, sus cuotas y los maestros ficticios explícitamente
editados/restaurados por las pruebas. No hubo números reservados, ventas,
Document/ítems, Outbox, lotes o comunicación con SUNAT.

## Compilación e inventario

Regresión general final: **195 archivos aprobados, 8.605 pruebas aprobadas,
una omisión condicional preexistente y cero fallos**, en 214,23 segundos.
Incluye las 235 nuevas y las 32 del adaptador de establecimientos que en la
verificación anterior habían sido ejecutadas aparte. No se suman artificialmente
resultados de corridas diferentes para este total.

Tipos globales: 28 tareas correctas en 21 paquetes. Compilación de sunat-core,
contratos y Billing aprobada; Billing recompilado después de la corrección final
y antes del ensayo persistente.

Inventario y artefactos candidatos regenerados desde fuente: 247 rutas
declaradas, 30 funciones, 109 acciones planificadas y 20 pantallas. El B2B público
conserva sus 63 operaciones candidatas y 38 GET. No se infiere publicación por
encontrar una clase o decorador. Este bloque no añade rutas HTTP ni scopes.

## Límites operativos

No se leyeron .env, credenciales, certificados/P12, tokens o datos fiscales del
cliente. No hubo SOAP/REST/OAuth oficiales, correo real, webhooks externos ni
modificaciones de main/AppModule/Kong/QA. No se ejecutó db push o migración de
bases existentes, no se tocaron dueños/contadores y no se relajaron TLS, permisos
ni bloqueos de producción. Toda autoridad/empresa/producto del ensayo es ficticio.

Comandos reproducibles: `pnpm test:b2b-guide-goods` y
`pnpm test:b2b-guide-goods:db`. El segundo usa únicamente
`--isolated-synthetic-only`, sin aceptar una URL o un export del cliente.
