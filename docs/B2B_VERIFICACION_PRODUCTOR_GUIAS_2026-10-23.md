# Verificación del productor atómico local de guías — 23/10/2026

Sexto bloque B2B-07. [Alcance y límites](B2B_FASE7_PRODUCTOR_ATOMICO_GUIAS.md).
Código candidato no desplegado. No hubo envíos a SUNAT, OAuth, firma con
certificado real, cambios fiscales de producción ni acceso a bases del cliente.

## Código integrado

- Contratos de solicitud, autoridad, contexto y transacción separados del WRITE
  de borradores: `guide-issue-model.ts`.
- Productor propietario: `BillingGuideIssueProducer`, idempotencia y validación
  del recibo/snapshot completo, perfil local 09/privado/04.
- Contexto transaccional: `PostgresGuideIssueContext`, con los validadores reales
  de establecimientos y bienes, usando adaptadores de sólo validación en la
  misma transacción SQL. Locks de registros antes de locks de maestros.
- Adaptador `PostgresGuideIssueStore`, CAS de contador, agregado de guías propio,
  ítems ordenados, recibo y evento local dedicado.
- DDL candidato aditivo con unicidad fiscal, integridad diferida del agregado,
  protección contra alteraciones/borrados/truncado y congelación del borrador
  vinculado. No se aplicó a ninguna base existente.
- Ensamblaje explícito `createCandidateGuideIssueProducer`. No registra módulos,
  rutas, workers o transportes y no consulta la base al construirse.

## Pruebas específicas

**187 pruebas aprobadas, cuatro archivos, cero fallos**, ejecutados juntos:

- `guide-issue-producer.spec.ts`: 62.
- `guide-issue-context.spec.ts`: 91.
- `guide-issue-store.spec.ts`: 31.
- `guide-issue-assembly.spec.ts`: 3.

Incluyen actores SERVICE/USER sin identidades humanas fabricadas, permisos
exactos para las tres series, capacidades distintas de WRITE, RUC explícitamente
habilitado, cuerpos/versiones/hashes y perfiles inválidos, guardas locales
genuinas, permisos revocados, reinicio/reintento, conflictos de idempotencia,
historia inmutable y transacciones que no pueden ocultar errores SQL.

## PostgreSQL real aislado

`tests/b2b-guide-issue-db.e2e.cjs --isolated-synthetic-only`: **22 grupos
aprobados**. El helper existente creó una BD NUEVA, vacía, en un contenedor
etiquetado, temporal y sin red ni puertos publicados. Los datos y permisos
son ficticios. No acepta destinos, RUC, documentos, credenciales ni URL del
cliente. Se usaron los productores, contexto, registros y adaptadores compilados
reales; sólo la autoridad de identidad y los fallos inyectados son dobles.

Se comprobó:

1. Aplicación de DDL sólo sobre la base nueva y creación de maestros ficticios.
2. Registro de establecimientos y bienes con los núcleos reales, más vínculo
   explícito de cada serie de planificación con su contador DESPATCH_ADVICE.
3. Commit indivisible de número, cabecera, detalle, recibo y evento local.
4. Recuperación después de reinicio sin otro número ni otro evento.
5. Conflicto por reutilizar una clave en otro borrador y bloqueo de segunda
   numeración del mismo borrador con otra clave.
6. Solicitudes simultáneas: una reserva por clave; números distintos y contiguos
   para dos borradores diferentes.
7. Procedencia USER/SERVICE auténtica dentro del contrato de pruebas.
8. Fallo tras actualizar contador o tras insertar el evento: reversión completa.
9. Revocación antes del commit: reversión; después del commit: no se entrega
   respuesta sin permiso y el número queda reservado para recuperación posterior.
10. Vínculo inactivo o producto modificado: bloqueo de nuevas reservas sin
    reescribir la historia preparada antes del cambio.
11. Último correlativo ficticio reservado una vez; al agotarse no se reinicia.
12. Inmutabilidad física y bloqueo de cancelación del borrador ya preparado.
13. Rechazo de cabecera incompleta al commit y de ítems adicionales al comprobar
    las restricciones diferidas, siempre en transacciones revertidas.
14. RUC no habilitado sin consulta de un borrador ajeno y rollback incluso si un
    callback intenta ocultar un error SQL.
15. Todas las tablas ajenas y el contador del ancla permanecieron iguales. El
    `Document` de ventas y `OutboxEvent` fiscal permanecieron vacíos.

No se deshabilitaron triggers, constraints, roles o aislamiento. Un primer
intento del runner se interrumpió por manejo anticipado de una promesa de prueba;
se corrigió el runner y se repitió completo en otra BD nueva. Se verificaron
etiqueta exacta/nombre/aislamiento para limpiar su contenedor temporal. La corrida
aprobada completó además la limpieza normal del helper. No quedaron contenedores
de este ensayo ni se eliminaron datos del cliente.

## Tipos e inventario

**28 tareas correctas en 21 paquetes**; compilados contracts, service-access,
sunat-core y billing-service. Inventario de fuente verificado: 247 rutas
declaradas, 30 funciones, 109 acciones planificadas y 20 pantallas, sin activación.
Este bloque no añade rutas HTTP o scopes públicos; el Swagger en ejecución y
Kong no cambiaron. No se hicieron migraciones, db push, despliegues o reinicios.

Regresión completa: **202 archivos aprobados, 8.955 pruebas aprobadas, una
omisión condicional preexistente y cero fallos**, en 211,79 segundos.
Incluye las 187 pruebas nuevas del bloque, sin sumarlas nuevamente al total.

## Lo que este resultado no demuestra

Numeración local no equivale a XML firmado, regla oficial completa, certificado
confiable, CDR auténtico o permiso para trasladar. Todas las respuestas conservan
los bloqueos oficiales. La concesión privada persistente de emisión, consulta/UI,
XML numerado definitivo, firma/PKI/CDR, perfil 31, lotes y piloto autorizado
siguen pendientes. La fase B2B-07 continúa abierta, sin producción.

Reproducir: `pnpm test:b2b-guide-issue` y `pnpm test:b2b-guide-issue:db`.
El segundo compila dependencias y fuerza el modo sintético aislado del runner.
