# Etapa 2 — persistencia financiera candidata

Incremento local: 03/10/2026. Instalación existente `factuez-stage2-qa`.

## Resultado y límites

Se implementaron el contrato interno, el repositorio transaccional candidato,
el modelo Prisma y un blueprint SQL para conservar versiones financieras
separadas del comprobante original. **El SQL no se ha aplicado al QA.**
El servicio está registrado sin controlador, consumidor ni tarea de arranque;
su guard siempre devuelve 503 antes de validar datos o consultar la BD.
Ninguna variable de entorno puede habilitarlo.

El resultado de este repositorio distingue `candidateOnly=true`,
`persistedCandidate=true`, `fiscalAuthority=false`,
`evidenceAuthenticityVerified=false` y `transmissionAuthorized=false`.
Guardar una proyección candidata no autentica un CDR ni cambia el estado fiscal
de una venta. El cálculo puro sigue declarando `simulationOnly=true` y
`persisted=false`; el laboratorio PWA continúa sin escrituras fiscales.

Se mantienen microservicios, Kong, aislamiento del QA y entorno BETA. No se
hicieron nuevos envíos SOAP/REST oficiales, OAuth, firmas con la clave real,
correo externo, migraciones, importaciones ni cambios de ventas/correlativos.
No se consultaron configuraciones SUNAT de ningún RUC. Los pilotos externos
anteriores no se reenvían ni se desbloquean; FQ02-1 continúa `CDR_UNVERIFIED`.

## Modelo propuesto en Billing

| Modelo | Función |
|---|---|
| `FinancialLedgerCommit` | Recibo inmutable de un plan exacto, hashes y resultado candidato |
| `FinancialLedgerStream` | Cabecera por original: alcance, secuencia, revisión e instantáneas separadas |
| `FinancialLedgerVersion` | Versiones inmutables, incluido original/revisión 0 y hash anterior |
| `FinancialLedgerEntry` | Evento por documento, operación, resultado y versión asociada |

Los vínculos compuestos preservan empresa y sede; el blueprint exige BETA,
perfil versionado y modo candidato. Las claves únicas distinguen evento y
operación **por documento**: un lote RC puede compartir un evento padre entre
varios miembros sin que la deduplicación descarte los demás.

El blueprint está fuera de `prisma/migrations`, en
`services/billing-service/prisma/blueprints/20261003_financial_ledger_candidate.sql`.
No se ejecuta en el build, arranque o despliegue. Además de las cuatro tablas,
propone un índice compuesto en Document y triggers que impiden reescribir o
eliminar recibos, versiones y entradas, o modificar el original/alcance de una
cabecera. **Son protecciones propuestas, no instaladas ni probadas en PostgreSQL.**

## Contrato y repositorio

- JSON acotado, copia separada y congelada, claves exactas, hashes calculados
  por servidor y un checkpoint por original; rechazo sin datos sensibles.
- Revisión dentro de la transacción de empresa/RUC/BETA, sede, punto, serie,
  permisos, instantánea original y notas propias. Cada efecto exige el comando
  exacto de Outbox de Billing; una declaración del caller no lo sustituye.
- Consulta acotada del historial propio completo de créditos, sin filtrar estados
  para liberar capacidad automáticamente. Un nuevo commit con historial incompleto
  se bloquea; el replay exacto de un recibo anterior no reevalúa créditos posteriores
  ni concede capacidad a partir de su resultado histórico.
- Transacción serializable, lock común con el productor por empresa/RUC,
  locks de documentos ordenados y compare-and-set de cabecera. Máximo tres
  intentos sólo ante conflicto de serialización; errores de almacenamiento
  sanitizados. El lote completo se confirma o falla conjuntamente.
- Reejecución exacta devuelve su recibo sin reescribir la cabecera. Revalida
  autorización, integridad, versiones e historial incluso al deduplicar.
- Append-only: no truncar ni cambiar prefijos, reservas iniciales o versiones;
  no actualizar Document, SeriesCounters, estados fiscales ni Outbox/Inbox.

Implementación:

- `services/billing-service/src/application/financial-ledger-plan.ts`
- `services/billing-service/src/application/financial-ledger-candidate.repository.ts`
- `services/billing-service/src/application/financial-ledger-candidate.service.ts`
- `services/billing-service/prisma/schema.prisma`

## Cobertura y límites deliberados

El perfil conserva los límites del reductor financiero: originales 01/03,
notas PEN/IGV 18% y motivos soportados; bajas de originales, no de notas.
Máximo 100 documentos/eventos/reservas por entrada acotada, sin truncamiento
silencioso. Las reservas iniciales quedan congeladas: agregar o liberar una
reserva posterior necesita un protocolo explícito, no reescribir revisión 0.

Rechazo o CDR no verificado sólo registra secuencia, sin efecto financiero ni
liberación automática de reservas. No se convierte una operación no verificada
en aceptada cambiando su replay/ID. Resultado desconocido y reconciliación
requieren un circuito específico. Tampoco se implementan perfiles fiscales
adicionales por asumir datos del cliente.

Falta un resolvedor server-side que autentique CDR/XML y enlace sus referencias,
miembros, versiones y estados de origen. El repositorio candidato no verifica
PKI; sus booleanos de evidencia no autorizan emisión ni contabilización fiscal.
RC2 sigue bloqueado en el productor normal y no queda habilitado por este cambio.

## Verificación local

Regresión integrada: **1.847 pruebas PASS en 56 suites, sin omisiones**.
TypeScript: **15 tareas PASS**. Validación Prisma y generación de cliente local
aprobadas con URL ficticia de build, sin conexión ni cambio de esquema.

Cobertura nueva: 84 pruebas del contrato, 45 del repositorio candidato y 33 del
schema/blueprint/guards; más dos casos del reductor para miembros de un mismo
evento padre. Incluye crédito, débito, bajas, varios miembros RC, replay,
integridad, alcance, rollback, cabecera antigua y guard previo a cualquier I/O.
Se prueba además el replay de una base después de un crédito: devuelve su
recibo inmutable, conserva la cabecera nueva y no permite omitir créditos en
un plan distinto ni eludir la reautorización.

```powershell
pnpm test:financial-persistence
pnpm exec vitest run --maxWorkers=2
pnpm typecheck
```

Las pruebas del repositorio usan dobles en memoria; las del SQL son comprobaciones
estáticas. **No acreditan DDL ejecutable, triggers instalados, locks ni concurrencia
real de PostgreSQL.** Las referencias técnicas para el posterior ensayo son
[aislamiento de PostgreSQL 17](https://www.postgresql.org/docs/17/transaction-iso.html)
y [funciones trigger de PostgreSQL 17](https://www.postgresql.org/docs/17/plpgsql-trigger.html).

## Despliegue y comprobación del QA

Imágenes Billing y SUNAT construidas correctamente. Se actualizaron sólo esos
dos servicios del proyecto existente, con los tres overlays y
`--no-deps --no-build --pull never`; no migradores, seed ni nuevas tablas.
La PWA y los demás servicios no se recrearon.

- Once contenedores saludables y red QA `internal=true`.
- Login HTTP 200 en `localhost:8091` y `192.168.100.5:8091`; laboratorio PWA
  HTTP 200. Son solicitudes desde el servidor, no un ensayo desde otra terminal.
- Auditoría por Kong: 16 comprobaciones PASS. Login demo normal, escenarios
  fijos sin escrituras fiscales, `no-store`, autorización y rechazo de entradas
  reales/producción; no se consultaron credenciales SUNAT.
- Imagen Billing: guard candidato y productor cerrados (503), comprobación con
  proxies sin acceso a datos, último arreglo de replay compilado, entorno BETA
  y `FACTUEZ_DEMO_SEED=false`.
- Imagen SUNAT: guard oficial cerrado (503), entorno BETA y flags de workflow/
  transmisión oficiales `false`. No firmas reales ni solicitudes oficiales.

El arranque saludable con el cliente Prisma generado no prueba la persistencia
propuesta: sus tablas no se instalaron y ningún endpoint/worker las utiliza.
Este despliegue no es un E2E de PostgreSQL ni un piloto fiscal.

## Próximo gate

Antes de una aplicación de esquema: revisión de DDL, autorización concreta,
respaldo/recuperación y ensayo transaccional con PostgreSQL aislado. Después:
resolvedor de evidencia confiable, protocolo de conciliación/reservas y piloto
integrado Beta con alcance autorizado. No basta ejecutar el SQL o encender flags.

**Etapa 2 fiscal oficial sigue abierta.** No hay importación/corte de etapa 3;
sólo su dry-run ya documentado. Para las pruebas locales anteriores no se
necesitan nuevas contraseñas ni certificados del cliente.
