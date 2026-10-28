# B2B-01 — inventario, contratos y controles de evolución

Fecha: 20/10/2026. **Implementación de contratos y auditoría de fuente.**
No se han creado ni habilitado los servicios B2B ni rutas `/b2b/v1` en Kong.
No se han modificado bases, cuentas, permisos, correlativos o el stack QA.

## Entregado

- Matriz versionada: **30 bloques funcionales, 98 acciones externas propuestas**,
  propietario, pantallas, evidencia, permisos humanos de referencia, scopes
  nuevos, estado de negocio, eventos, clasificación y fase de implementación.
- Auditoría local de **20 pantallas y 152 rutas HTTP declaradas**. Lee sólo
  fuentes, obtiene líneas/huellas SHA-256 y falla si aparece una pantalla o
  controlador sin clasificación. Incluye anotaciones de guard/permisos, no
  interpreta que sean autorización efectiva ni prueba registro/despliegue.
- **21 operaciones OpenAPI 3.1 de diseño** para el primer flujo: contexto,
  borradores 01/03, emisión, consultas, XML/CDR/PDF y seguimiento de comandos.
- Catálogo de **12 eventos externos** con esquemas cerrados, procedencia y
  requisitos de entrega/firma. No es un webhook ejecutable todavía.
- ADR de servicios/identidad y ADR de comandos/Outbox/webhooks, más pruebas
  automáticas de referencias, límites, compatibilidad y ausencia de activación.

La huella del código sirve para trazabilidad de esta revisión, **no** acredita
integridad fiscal ni aceptación de SUNAT. Nuevas rutas conocidas en un archivo
ya clasificado aparecen en el informe; sus permisos/casos de uso requieren
revisión humana. La auditoría no sustituye pruebas de autorización en ejecución.

## Archivos

| Elemento | Archivo |
| --- | --- |
| Matriz canónica | `packages/contracts/src/b2b-inventory.v1.json` |
| Tipos y vocabulario | `packages/contracts/src/b2b.ts` |
| Generador OpenAPI | `packages/contracts/src/b2b-openapi.ts` |
| OpenAPI de referencia, NO operativo | `docs/b2b/openapi.design.v1.json` |
| Catálogo y esquemas de eventos | `docs/b2b/webhooks.design.v1.json` |
| Auditoría reproducible | `migration/b2b-source-audit.mjs` |
| Evidencia de esta revisión | `docs/b2b/source-audit.v1.json` |
| Límites y autorización | [ADR-001](b2b/ADR-001-LIMITES-Y-AUTORIZACION.md) |
| Comandos y eventos | [ADR-002](b2b/ADR-002-COMANDOS-Y-EVENTOS.md) |

Los permisos humanos de la matriz son referencias agrupadas, **no** reglas AND/OR
implementadas ni grants B2B. Las comprobaciones reales siguen en cada propietario;
se especificarán por operación al construir los adaptadores.

## Clasificación encontrada

| Clasificación | Bloques | Interpretación |
| --- | ---: | --- |
| ADAPT | 17 | Existe código aprovechable, falta principal/contrato/adaptador B2B. No promete que cada acción de ese bloque ya esté implementada. |
| NEW | 6 | Borradores, operaciones, notas de venta, clientes, turnos/caja y webhooks requieren nuevos casos de uso. Modelos/permisos no bastan. |
| LAB_ONLY | 4 | NC/ND, RC/RA, guías y envío local de correo no se publican como operaciones empresariales completas. |
| INTERNAL_ONLY | 3 | Sesión PWA, Socket.io interno y laboratorios/expediente: no son funciones comerciales B2B. |

El primer contrato **no cubre las otras 77 acciones con DTO completos**. Siguen
en el inventario, asignadas a B2B-03/06/07/08 según el plan. No ofrecerlas a otro
servicio hasta implementar y verificar sus motores, permisos y controladores.
Las 152 rutas son declaraciones de fuente actuales, no 152 endpoints B2B.

## Primer corte especificado

01/03, BETA, IGV 18% gravado y contado, importes/cantidades como texto decimal,
máximo 100 ítems. No incorpora automáticamente descuentos, anticipos, otros
impuestos o crédito. Billing resolverá los IDs de contexto y validará identidad
del cliente, cantidades, fechas, totales y reglas semánticas. El esquema JSON
por sí solo no acredita validez tributaria.

Drafts usan ETag/If-Match, sin reservar número. Emisión usa idempotencia y
operación consultable; 202 no significa aceptación fiscal. Los originales se
descargan sólo si existen y están autorizados; el formato PDF actual no altera
XML/CDR ni el snapshot. No existe edición libre de un comprobante emitido.

## Verificación y reproducción

```text
pnpm audit:b2b
pnpm test:b2b-contract
pnpm --filter @factuez/contracts build
pnpm typecheck
pnpm test:regression
```

El CLI de auditoría sólo acepta `--source-only`. No lee `.env`, BD, certificados,
credenciales, logs o archivos del cliente; no importa aplicaciones ni llama a
SUNAT, SMTP, SIRE o callbacks. Los JSON de diseño se comparan con sus generadores
en las pruebas. No se añadieron dependencias ni se cambió el contrato readonly.

No se ha incorporado este contrato propuesto al Swagger operativo: podría dar
la impresión de que ya acepta llamadas. El Swagger anterior sigue describiendo
extracción y administración existentes, sin habilitar emisión B2B.

### Resultados de esta entrega

- Contratos y auditoría B2B: **70 pruebas aprobadas**.
- Regresión: **134 archivos, 5.325 pruebas aprobadas y 1 omitida**.
- Tipos del monorepo: **26 tareas correctas**, 19 paquetes revisados.
- Auditoría de extracción anterior: **7 pruebas aprobadas**.
- Compilación de `@factuez/contracts`: correcta.

La primera regresión, ejecutada durante la compilación paralela, agotó los
5 segundos de una prueba histórica de reanudación del CLI. Se repitió toda
la suite con `pnpm exec vitest run --maxWorkers=2`, sin compilación concurrente:
pasó completa. No se alteraron esa prueba, sus límites ni el comportamiento
del historial para ocultar el fallo de tiempo.

## Siguiente entrega: B2B-02

Identidad y grants técnicos/delegados, separación de audiencias, revocación y
adaptador privado de contexto. Probar denegaciones por RUC/sede/punto/serie,
usuario/aplicación y permisos caducados. Definir puente OIDC sin migrar cuentas
por sorpresa. Después: lectura/archivos B2B-03 y borradores/emisión B2B-04.

Nada de esta entrega cierra los gates fiscales anteriores ni autoriza pilotos
oficiales, producción, callbacks reales, migración histórica o corte de series.
