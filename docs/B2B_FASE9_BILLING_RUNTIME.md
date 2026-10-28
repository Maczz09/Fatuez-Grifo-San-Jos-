# B2B fase 9: runtime propietario de Billing

## Entrega y límites

`createBillingB2bRuntime(deps)` construye los propietarios concretos y el módulo dinámico privado de Billing. La construcción no escucha puertos, consulta bases, carga variables de entorno, arranca workers, instala esquemas ni activa transmisión fiscal. Las capacidades salen de los módulos efectivamente construidos; no se inyecta una lista arbitraria de capacidades.

Esta entrega **no monta el servicio principal**. No modifica `AppModule`, `main.ts`, publishers legados, paquetes raíz, SQL ni migraciones. El padre debe obtener las instancias reales del contenedor existente, suministrar dependencias y hooks auténticos, y montar el host privado explícitamente. La existencia de la fábrica no demuestra cobertura del proceso legado ni autorización de despliegue.

## Ensamblado concreto

| Capacidad | Propietario instalado |
| --- | --- |
| READ | `PrismaB2bContextRepository`, `PrismaB2bReadRepository`, `B2bBillingReads`, impresión existente y extracción con `PrismaBillingCapture`/`PrismaOwnerJournal` |
| DRAFTS | `B2bDrafts`, `PostgresB2bDraftStore`, `b2bDraftIssuer` sobre `IssueDocumentService.executeWithinTransaction`, perfil BETA y RUC permitidos explícitos |
| COMMERCIAL | `PostgresB2bCommercialStore` con el mismo issuer transaccional y conversión realmente configurada |
| CORRECTIONS | Una llamada nueva a `createBillingCorrectionProducer` por token/kind/binding de cada petición; autoridad privada de Identity, journal y evidencia del propietario fiscal existentes |
| GUIDES | Borradores, catálogo, establecimientos y bienes PostgreSQL; preparación catalogada estricta y productor numerado candidato 09 con autoridad privada real |
| CARRIER | `CarrierGuideOwner`, almacén PostgreSQL, autoridad 31 concreta y verificador criptográfico de referencia 09 obligatorio |
| BATCHES | `createBillingBatchOperations`, `PostgresBatchMemberOwner` y productor durable existente; puertos de evidencia, identidad y administrador obligatorios |
| BUSINESS | `B2bPhase8Business` con `PostgresBusinessStore`, pool explícito y permisos actuales del propietario |
| REPORTS | `B2bReports`, `PostgresReportsStore`, `PostgresBillingReportSources`, mapas explícitos y autoridades de lectura; metadatos de guías mediante `HttpReportsGuideMetadata` |
| PRIVILEGED_ADMIN | `B2bPhase8BillingAdmin`, `BillingPhase8AdminBindingOwner`, `StationAdminService` y `PrintBrandingService` existentes; autoridad humana y consulta humana viva obligatorias |

Se instalan además los catálogos de correcciones/guías, contexto, validación de bindings, callback privado de evidencia, preparación y lectura de emisión de guías, registro de establecimientos y un adaptador HTTP de bienes sobre su propietario real. Ningún puerto acepta un booleano sintético como evidencia fiscal. Guías candidatas B2B-07 conservan sus restricciones: numeración/XML local no implican firma, CDR oficial ni aceptación final.

Los reportes exigen mapas no vacíos de pares de corrección y guía, dentro del allowlist. Los mapas seleccionan fuentes candidatas; no crean permisos ni scopes. Un tipo no configurado falla en el propietario. El permiso de lectura de correcciones se suministra por su puerto específico; no se deriva de una autorización de escritura. CSV procede del motor existente; XLSX/PDF requieren renderers reales suministrados explícitamente y de otro modo mantienen el rechazo existente.

## Dependencias de desarrollo y configuración

La interfaz completa está en `runtime-dependencies.ts`. Son obligatorios:

- Instancias ya inicializadas de `PrismaService`, `IssueDocumentService`, `StationAdminService` y `PrintBrandingService`. El host conserva su inicialización y configuración originales, incluyendo el almacenamiento de impresión.
- Identidad e HTTP privados auténticos para Identity y fiscal; certificados, CA, fingerprints por rol y origen HTTPS explícito para metadatos. Los puertos criptográficos/admin encapsulan su vault y trust reales; la fábrica no descubre secretos, credenciales ni archivos de certificados.
- RUC BETA permitidos, `deploymentId` UUID v4 del despliegue e `instanceId` UUID v4 de la instancia.
- Pools tipados de Billing para Business, Reports y Batches. No hay fallback a memoria ni creación de un pool con valores implícitos. El pool de reportes debe acceder también a las tablas fuente de Billing.
- Permisos actuales de Business, autoridad de lectura de correcciones, pares exactos de reportes, verificador de XML/CDR de referencias 09, evidencia de miembros de lotes, identidad actual de miembros y administración de políticas de lotes.
- Autoridad humana de establecimientos, autoridad privilegiada con step-up y consulta actual de identidad humana. Las implementaciones deben consultar sus autoridades reales; pasar funciones permisivas incumple el contrato.
- Una instancia nueva y habilitada del **`B2bOwnerDrain` del padre**, en `ownerDrain`, y los cuatro hooks `legacyLifecycle`. El contrato estructural evita exigir que su archivo recién creado ya exista en `dist` al compilar Billing. No se implementa un drenador alternativo.

La fábrica rechaza dependencias ausentes, pools ausentes, mapas vacíos, peers inválidos, material TLS vacío, drenador deshabilitado/usado y configuración de mantenimiento omitida. El operador requiere identidad distinta de las identidades de llamadas B2B.

## Montaje explícito

Ejemplo para el código de integración del padre; no es configuración desplegada:

```ts
const ownerDrain = new B2bOwnerDrain({ enabled: true });
const runtime = createBillingB2bRuntime({
  ...explicitBillingDependencies,
  ownerDrain,
  legacyLifecycle: realLegacyBillingHooks,
});
const privateApp = await createBillingB2bRuntimeApplication(runtime);
await privateApp.listen(explicitBillingPrivatePort, explicitPrivateHost);
await runtime.listenOperator(explicitPrivateHost, explicitOperatorPort);
```

`createBillingB2bRuntimeApplication` está exportada por `runtime-http.ts`. Crea un host Nest dedicado con mTLS obligatorio, validación de peers y cabeceras, JSON limitado y filtros sanitizados. Instala `ownerDrain` **antes de `app.init()`**. No publica rutas B2B públicas. El registro de establecimientos conserva su propio lector de cuerpo sin procesar y su deadline; el parser general no consume esos cuerpos. Importar el módulo por sí solo, sin instalar el seguimiento del host, falla cerrado en el guard.

El padre debe cerrar explícitamente el listener operador al terminar su uso. Es independiente del listener de negocio y continúa disponible cuando STORAGE ya ha cerrado este último.

## Estado de runtime y almacenamiento

`POST /internal/b2b/runtime-status` usa el módulo compartido del padre y exige peer autorizado y objeto JSON vacío, sin bearer ni query. Declara únicamente los diez módulos de la tabla. El `deploymentId` se comparte con mantenimiento. El `bootId` se genera una sola vez por `B2bOwnerRuntimeStatus` y **ese mismo `status.bootId`** alimenta `B2bMaintenanceNode.instance.bootId`.

Cada inspección realiza sondas fijas `SELECT ... FROM ... WHERE false` dentro de transacciones de solo lectura, con timeout, sobre Prisma y los pools suministrados. Reports comprueba también las tablas fuente. Las sondas verifican disponibilidad de relaciones/columnas y acceso de lectura sin devolver datos; nunca crean tablas, alteran esquemas ni reparan automáticamente. Un error se sanitiza como indisponibilidad y las conexiones prestadas se liberan. Esto no verifica todos los índices, triggers, privilegios de escritura, grants actuales, existencia de datos, configuración de trust/vault ni salud de autoridades remotas. Al iniciar mantenimiento deja de anunciar disponibilidad.

## Mantenimiento y cobertura real del proceso

| Fase | Secuencia del runtime |
| --- | --- |
| ADMISSION | `pauseCommands()`; hook legado ADMISSION; exigir `drain('COMMANDS')` terminado |
| PRODUCERS | Hook legado que detiene y espera todos sus productores, publishers y planificadores |
| WORKERS | Hook legado que detiene y espera consumers/workers; exigir `drain('MUTATIONS')` terminado |
| STORAGE | `closeAdmission()`; exigir `drain('ALL')` terminado; cerrar host privado y store de Business; hook legado que cierra Prisma y todos los pools/recursos restantes |

Un drenaje que devuelve `DRAINING` o pendientes falla la fase. No se llama al cierre de almacenamiento en ese caso. Los hooks deben rechazar si quedan trabajos inciertos. La suscripción independiente del `B2bOwnerDrain` mantiene el controller y su SQL pendientes aunque el cliente aborte. Los pools suministrados pertenecen al host; `PostgresBusinessStore` se marca cerrado pero no cierra por su cuenta ese pool prestado.

### Integración revisada por el padre

El drenador compartido ya conserva los POST `/internal/b2b/read` y
`/internal/b2b/correction-evidence-authorize` durante la pausa de comandos. Se
añadió una prueba que permite exactamente esas lecturas y sigue rechazando sus
variantes de escritura. Las rutas multiplexadas no se convierten globalmente
en lecturas para eludir la pausa.

El host standalone añade DI concreta de Billing, cuatro pools limitados,
almacenamiento de impresión y cierre de publisher/consumer antes de Prisma.
La conexión de ese nuevo host exige `database-ca.pem`, TLS 1.2, verificación de
certificado/hostname, máximo cuatro conexiones por pool y timeouts. La URL
montada `billing-database.bin` no admite query que reemplace TLS y selecciona
una base `_beta`. Las otras credenciales TLS/Redis permanecen montadas en
archivos privados. No cambia el constructor legacy por defecto.

**El entrypoint sigue incompleto por desarrollo nuestro.**
`requireBuiltinBillingHostImplementations()` bloquea el arranque hasta completar
en el repositorio las autoridades de establecimientos/Business/lotes y humanas,
la evidencia firmada de miembros y el verificador XML/CDR de referencia 09.
TI debe configurar infraestructura e identidades; no debe programar esos puertos.
Se retiró el cargador de módulos externos como sustituto de esa implementación.
No se presenta el host probado con dobles como software desplegable completo.

## Verificación realizada

- `pnpm --filter @factuez/billing-service typecheck`: compilación sin emisión del servicio objetivo.
- `pnpm exec vitest run tests/b2b-billing-runtime.spec.ts --maxWorkers=1 --testTimeout=20000 --hookTimeout=30000`: 11 pruebas.
- HTTP/HTTPS reales sobre loopback con PKI desechable del fixture existente; autorización de lectura del fixture existente y propietarios PostgreSQL concretos ensamblados sobre transportes SQL sintéticos.
- Cobertura: construcción sin I/O; rechazo de dependencias/mapas ausentes; productor de corrección nuevo por solicitud; capacidades/metadatos/fallos sanitizados; catálogo/contexto reales; peers y certificado ausente; rutas instaladas y lector de establecimientos; fases ordenadas; aborto de cliente con SQL pendiente; drenaje incompleto que no cierra pools; almacenamiento esperando lecturas; listener operador y coincidencia de deployment/boot.

**No se ejecutó PostgreSQL persistente, SUNAT real, despliegue VPS, build global ni regresión global.** Los dobles SQL están identificados y las capacidades crypto/admin no configuradas rechazan. Las pruebas no demuestran persistencia, escritura fiscal, aceptación tributaria ni cobertura de workers legados reales.

## Archivos de esta entrega

- `services/billing-service/src/b2b/runtime.ts`
- `services/billing-service/src/b2b/runtime-dependencies.ts`
- `services/billing-service/src/b2b/runtime-http.ts`
- `services/billing-service/src/b2b/runtime-lifecycle.ts`
- `services/billing-service/src/b2b/runtime-storage.ts`
- `tests/b2b-billing-runtime.spec.ts`
- `docs/B2B_FASE9_BILLING_RUNTIME.md`
