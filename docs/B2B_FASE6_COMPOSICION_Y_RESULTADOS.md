# B2B-06 — Composición de evidencia y resultados financieros

Fecha de trabajo: 21/10/2026. Estado: candidato local comprobado por bloques;
**no es cierre de B2B-06, despliegue ni autorización fiscal**.

## Implementado en esta continuación

- La evidencia individual 01/F07/F08 ahora abre también el ZIP de solicitud y
  exige que contenga exactamente el XML firmado archivado. Identificadores,
  tamaños, SHA-256, CRC y manifiesto deben coincidir; relee los tres archivos.
- Composición propietaria de RC para boletas y notas B: pertenencia y versión
  actual, XML firmado completo, ZIP de solicitud, CDR y confianza. Un RC3 no
  acredita un miembro activo; una versión pendiente/ambigua requiere conciliación.
  Lectura acotada a 200 lotes del RUC/BETA; superar el límite bloquea, no pagina
  silenciosamente una historia incompleta. No importa RC históricos arbitrarios.
- Resolvedor común de aceptación individual/RC y paquete de prerrequisitos de
  corrección: original y créditos declarados aceptados verificados por el
  propietario; una reserva no se transforma en aceptación. Contrasta versiones
  y rechaza afirmaciones de aceptación distintas para el mismo documento.
- Resultados propietarios de notas F y lotes RC/RA, tanto aceptados como
  rechazados. Vincula comando, operación, firma, solicitud y CDR exactos. Exige
  que el código/resultado archivado coincida con el CDR real; rechaza fechas
  futuras, artefactos duplicados y tamaños de manifiesto incoherentes.
- Firmas XMLDSig completas para NOTE/RC/RA con pins públicos del emisor y la
  política de confianza existente. Las pruebas usan claves efímeras y puertos
  de confianza ficticios explícitos; no acreditan PKI oficial de SUNAT.
- `createBetaCorrectionOwnerAssembly` reúne lectores y verificadores **dentro
  del propietario SUNAT**. No consulta secretos, firma documentos ni transmite.
- `VerifiedCorrectionTransaction` fija comando, actor y huellas de evidencia;
  revalida antes y después del trabajo dentro de la transacción Serializable.
- `VerifiedSyntheticCorrectionReservations` conecta ese límite con la reserva
  de nota, ítems, correlativo, Outbox y retención monotónica en una transacción.
  Conserva obligatoriamente la BD nueva `b2b_corrections_synthetic` y el RUC
  inventado `20000000001`. No promover este ensayo quitando esos controles.
- `VerifiedFinancialCommit` exige procedencia de la aceptación del original,
  prerrequisitos y resultado del comando; comprueba huellas antes/después y
  usa el repositorio financiero propietario sin transacciones anidadas.
- La persistencia financiera admite actor SERVICE auténtico con humano nulo.
  No se inventan usuarios. Sigue siendo un ledger candidato separado: no cambia
  originales, estados fiscales, correlativos ni Outbox.
- Se corrigió una colisión real de concurrencia sobre el recibo `planId`:
  reintento de la transacción completa, acotado a tres intentos y revalidando
  permisos/evidencia/recibo. No se reintenta un INSERT aislado ni se interpretan
  otras restricciones únicas como aceptación o replay.

## Evidencia de pruebas

`pnpm test:b2b-phase6-composition`: 256 comprobaciones incluidas en la regresión
final aprobada (251 en la primera ejecución focalizada; cinco controles añadidos
después y comprobados). La última repetición focalizada de aislamiento/evidencia/
commit/ensamblaje aprobó 95 pruebas en cuatro archivos.
Incluye firmas efímeras reales y fixtures de política criptográfica separados.

Regresión final: **168 archivos, 5.993 pruebas aprobadas, una omitida y cero
fallos**. Tipos: 28 tareas correctas en 21 paquetes. Billing y SUNAT recompilados
antes de la repetición final de los tres ensayos PostgreSQL.

`pnpm test:b2b-phase6-composition:db` recompila dependencias y ejecuta:

| Ensayo PostgreSQL nuevo | Grupos aprobados |
| --- | ---: |
| Reserva/retención con frontera de evidencia y autoridad | 16 |
| Efectos financieros, replay, concurrencia y rollback | 18 |
| Evidencia individual y paquete archivado | 8 |

Se ejecutaron los tres ensayos; el financiero falló inicialmente por la colisión
de recibo, se corrigió y se repitió con éxito. Las bases son nuevas, tmpfs,
etiquetadas, sin red ni puertos. Se retiraron únicamente sus contenedores propios.
Los proofs en PostgreSQL son fixtures sellados, **no PKI**. Las firmas efímeras
se verifican en otra prueba; no se suman garantías de ensayos distintos como si
fueran una prueba fiscal integral oficial.

## Pendientes concretos para cerrar B2B-06

1. El [puente privado Billing–SUNAT](B2B_FASE6_PUENTE_PRIVADO_EVIDENCIA.md) ya tiene
   implementación candidata y pruebas HTTPS/mTLS de consulta, con callback de
   autoridad y lector propio. Falta componerlo con el productor empresarial y
   ampliar explícitamente autoridad de lotes/historial de otras series.
   Los sellos WeakSet siguen locales: copiar un proof JSON no lo hace confiable.
   No se comparte Prisma ni se importa el motor SUNAT en Billing. No desplegado.
2. Reservas dinámicas posteriores al inicio del ledger. El perfil financiero V1
   conserva inmutable el conjunto inicial de reservas y la reserva sintética
   rechaza un ledger previo. Ambos límites están probados, no resueltos. Hace
   falta un protocolo versionado de journal/reserva/settlement, sin reescribir
   hashes/versiones antiguas ni liberar créditos por una proyección rechazada.
3. Materialización propietaria de versiones RC2 y procedencia persistente
   SERVICE para lotes: el modelo heredado exige usuario humano y esa ruta se
   rechaza. No crear un UUID humano ficticio ni retirar el bloqueo RC2.
4. Evidencia propietaria de no entrega para bajas, resolución auditada de
   respuestas ambiguas y ensayo vertical completo del productor/consumidor,
   recuperación, estados, artefactos y eventos. No reintentar POST ambiguos.
5. Tras completar lo anterior: revisión de despliegue, persistencia/grants,
   rutas privadas/Kong y piloto Beta de alcance explícito. No hay autorización
   de producción; las pruebas de este documento no autorizan envíos externos.

Son pendientes de implementación/integración, no una nueva solicitud de
documentos o claves al cliente. La documentación del componente individual
anterior queda complementada por este documento. Las etapas fiscales históricas
2/3 tienen gates independientes y tampoco se declaran cerradas aquí.

## Instancia activa

No hay nuevas rutas registradas en AppModule ni cambios de Kong, migraciones
aplicadas o despliegue en localhost:8091. Swagger activo no cambia por compilar
estas clases. El contrato público candidato conserva sus 52 operaciones; no se
publicó `notes-qa` como API empresarial ni se tocó `OutboxEvent.publishedAt`.
Sin SOAP/REST/OAuth oficial, correos reales, callbacks reales o datos del cliente.
