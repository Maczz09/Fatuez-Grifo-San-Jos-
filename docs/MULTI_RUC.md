# FactuEz — varios emisores RUC y múltiples sedes

Corrección confirmada por el usuario el 1 de octubre de 2026. Sustituye la
decisión anterior de una sola empresa emisora. El sistema sigue siendo privado,
on-premise, con microservicios y Kong; no incorpora tenants públicos, planes ni
suscripciones.

## Modelo configurable

- Registro de emisores: una fila de CompanySettings por RUC.
- Cada sede se asigna a un emisor mediante companyId obligatorio.
- Distribución prevista: 21 sedes bajo un RUC y una sede bajo otro. Es
  configuración, no una cantidad ni condición fija en el código.
- Pueden agregarse más emisores y sedes. El segundo RUC, su razón social,
  dirección fiscal y ubigeo deben ingresarse con datos reales; no se inventaron.
- El seed conserva únicamente GRIFO SAN JOSE S.R.L., RUC 20450819230.
  Los RUC sintéticos utilizados en tests no se incluyen en el demo instalado.

## Separación fiscal y permisos

SeriesCounter es único por emisor + tipo + serie. Document es único por emisor +
tipo + serie + número. Dos RUC pueden emitir F001-1 independientemente; para
identificar un comprobante debe incluirse siempre RUC y tipo, no solo su número.

Las claves foráneas compuestas de PostgreSQL impiden vincular puntos, series y
documentos con un emisor distinto del de la sede. Sus actualizaciones son
RESTRICT: no se propaga un cambio de RUC a documentos históricos.

Billing deriva el emisor del punto canónico en la base, no de un companyId/RUC
enviado por el cliente. Congela companyId, RUC, datos del emisor, sede y entorno
en el snapshot y el evento de emisión. SUNAT usa ese entorno y RUC, no la
variable global SUNAT_ENVIRONMENT. Un evento antiguo sin entorno requiere
revisión y reposición desde su snapshot; no se elige una credencial por defecto.

Identity conserva IDs externos sin leer la base de Billing. El campo series
de las asignaciones/claims contiene UUIDs de SeriesCounter, no etiquetas F001.
La autorización exige la intersección de sede, punto y serie. ADMIN es global
para esta instalación; los otros roles solo acceden a sus recursos asignados.

## Interfaz y API implementadas

- Selector shadcn de emisor RUC y selector dependiente de sede.
- Resumen y registro filtrados en el backend por companyId y branchId.
  «Todos los emisores» es un consolidado de los recursos autorizados.
- RUC emisor visible junto a sede y número del comprobante.
- Sedes y maestros: pestaña Emisores RUC, alta de emisores, elección de RUC
  al crear sede y cambio de asignación antes de crear puntos.
- POST /api/v1/stations/issuers: alta inicial BETA, RUC de 11 dígitos, razón
  social, dirección fiscal y ubigeo de 6 dígitos. No valida el padrón SUNAT.
- POST /api/v1/stations: exige companyId explícito.
- PATCH /api/v1/stations/:id/issuer: solo ADMIN, transacción, bloqueo de sede,
  auditoría y rechazo si existe cualquier punto, incluso inactivo.
- Crear puntos toma el mismo bloqueo. Las series nuevas son únicas dentro del
  RUC elegido, sin reiniciar ni reasignar las existentes.

## Historial y evolución fiscal

No se habilita la reasignación directa de una sede operativa a otro RUC. Una
transición fiscal real necesitará un flujo con vigencia, nuevas configuraciones
de emisión, cierre de pendientes y conservación de la vinculación histórica.
No reutilizar puntos/correlativos ni «editar el RUC» de documentos anteriores.

SunatCredentials está preparado por RUC + entorno; FiscalDocument y FiscalBatch
se identifican también por RUC. En P2 se configurarán por emisor certificados
y sus versiones, SOL, GRE OAuth, entorno, perfil de firma y artefactos.
La caché OAuth y las conexiones deberán particionarse por RUC/entorno/versión.
Los secretos no cruzan Kong, la PWA ni los eventos. Firma, transmisión, CDR,
PDF/QR y correo siguen sin estar habilitados; registrar un emisor no los activa.

## Actualización de instalaciones existentes

No se modificó el despliegue existente de localhost:8080. Sus contenedores
anteriores siguen ejecutándose. No levantar las imágenes nuevas contra bases
antiguas sin preparar previamente la actualización.

1. Resolver emisiones pendientes con sus claves originales, acordar ventana
   de corte y obtener respaldos restaurables de las tres bases y artefactos.
2. Ensayar todo en una copia; comparar documentos, snapshots y nextNumber
   antes y después. Detener escritores/consumidores durante el corte.
3. Aplicar primero las expansiones de P1 si aún faltan Branch, ConfigurationAudit,
   UserBranch, UserSeries y authVersion. No ejecutar una migración inicial sobre
   tablas existentes ni usar reset/down -v/accept-data-loss.
4. Aplicar, en su base exclusiva, cada archivo:
   - services/billing-service/prisma/multi-issuer-expand.sql
   - services/identity-service/prisma/multi-issuer-expand.sql
   - services/sunat-service/prisma/multi-issuer-expand.sql
5. Los scripts usan transacciones, conservan números y snapshots y abortan ante
   un emisor histórico no resoluble o credenciales de propietario ambiguo.
   No adivinan el segundo RUC ni copian certificados entre empresas.
6. Reasignar explícitamente series de usuarios no ADMIN desde la nueva UI.
   Las etiquetas antiguas se conservan para revisión pero no conceden acceso;
   sus sesiones se invalidan. Identity filtra etiquetas antiguas del token
   para que no lleguen a consultas UUID de PostgreSQL.
7. Reconstruir/regenerar y desplegar Identity, Billing, SUNAT y PWA como una
   versión compatible; validar Kong, colas, permisos y emisión de demo.
   El catálogo ahora devuelve companies, y las series incluyen id.
8. Registrar los emisores reales y sus sedes. No es necesario crear 22 sedes
   ficticias para activar el sistema.

Los scripts de expansión sirven para instalaciones nacidas con db push;
si existe historial Prisma, establecer su baseline y empaquetar la expansión
como migración de cada servicio antes del corte. El Compose de producción
continúa siendo un blueprint y no se presenta como despliegue certificado.

## Validación reproducible

pnpm build
pnpm typecheck
pnpm test
pnpm test:stage1
pnpm test:multi-ruc:db

Las suites de contratos/cálculo y servicios suman 41 tests. Las pruebas de
aplicación usan dobles, no sustituyen E2E. La prueba test:multi-ruc:db usa
PostgreSQL 17 real en un contenedor QA efímero, sin red ni volúmenes persistentes:
verifica las tres expansiones sobre un fixture representativo de estructura
anterior, preservación del snapshot/correlativo, números iguales entre RUC,
FKs compuestas, revocación de sesiones y rollback ante emisor no resoluble.
El contenedor y sus datos ficticios se eliminan al terminar.

La revisión de UI usa un fixture visual separado en memoria. No demuestra
envío SUNAT ni datos fiscales reales. El E2E completo PWA/Kong/servicios/colas
con las imágenes nuevas y la actualización sobre una copia integral de la
instalación siguen siendo el criterio de salida antes de desplegar.
