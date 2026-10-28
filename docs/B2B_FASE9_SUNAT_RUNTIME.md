# B2B-09 — Runtime propietario SUNAT y host opt-in

Fecha: 26/10/2026. Entrega de ensamblaje LOCAL/BETA. Fuente preparada para la
integración y regresión del padre; no representa cierre de la fase 09 ni un
servicio fiscal activado. No se ejecutó ninguna conexión real, migración, lectura
de certificados del cliente, P12 real, transmisión SUNAT ni Docker.

## Archivos exactos de este bloque

Nuevos:

- `services/sunat-service/src/b2b/runtime-types.ts`: contratos de dependencias DI, TLS y drain.
- `services/sunat-service/src/b2b/runtime-config.ts`: validación explícita BETA/identidad/peers/listeners.
- `services/sunat-service/src/b2b/runtime-schema.ts`: proyecciones SQL fijas de readiness.
- `services/sunat-service/src/b2b/runtime-validation.ts`: integración XSD sobre bytes y factories propietarias.
- `services/sunat-service/src/b2b/runtime.ts`: ensamblaje Nest/mTLS, módulos reales, status y mantenimiento.
- `services/sunat-service/src/b2b/main.ts`: host montado explícito y bloqueo de capacidades incompletas.
- `tests/b2b-sunat-runtime.spec.ts`: HTTP/mTLS real, datos sintéticos, XMLDSig y libxml reales.
- `tests/b2b-sunat-runtime-host.spec.ts`: bloqueo del host y ausencia de acceso cuando está deshabilitado.
- Este documento.

Modificado con autorización posterior:

- `services/sunat-service/src/main.ts`: rama `B2B_SUNAT_RUNTIME_ENABLED === 'true'`
  anterior a `NestFactory.create(AppModule)`, sin fallback a legacy en caso de error.

No se editan AppModule, package manifests, lock, publishers, helpers anteriores,
contratos/gate/status/mantenimiento del padre ni otros propietarios. No se crea
una implementación ficticia de autoridad para lograr que arranque el host.

Corrección independiente solicitada: el backup integral queda con **12 perfiles**;
REPORTING no es propietario separado. Los reportes pertenecen a Billing. Se
ajustaron `infra/b2b/deployment-backup/ports.ts`,
`tests/b2b-deployment-backup.spec.ts` y
`docs/B2B_FASE9_RESPALDO_INTEGRAL_ADAPTADOR.md`. La prueba exige tamaño 12 y ausencia
de REPORTING; no se amplían los guards SYNTHETIC ni el respaldo anterior.

## Qué está ensamblado concretamente

`createB2bSunatRuntime(config, deps)` está deshabilitado por defecto, no consulta
entorno/archivos, no crea Prisma y no escucha automáticamente. La DI existente
aporta sus recursos. `start()` vuelve a comprobar esquema, abre API mTLS y control
mTLS independiente; los peers de operación deben estar separados de los de negocio.

| Capacidad anunciada | Implementación real instalada |
| --- | --- |
| READ | B2bSunatReads + PrismaB2bSunatRead + HttpB2bBillingPort + PostgresB2bDownloadAudit + PrismaOwnerJournal SUNAT. |
| GUIDE_ARTIFACTS | createLocalPhase7GuideArtifactPipeline (09/31), PostgresGuideArtifactStore, LocalGuideKeySigner y GuideArtifactModule/API. |
| BATCH_ARTIFACTS | createLocalPhase7BatchArtifactPipeline, PrivateBatchArtifactOwner, PostgresBatchLocalArtifactStore, firmante local y BatchArtifactModule/API. |
| CORRECTION_EVIDENCE | createBetaCorrectionOwnerAssembly, repositorios Prisma de aceptación/resumen/outcome, BetaOwnerXmlTrust real y callback HttpCorrectionEvidenceAuthority hacia Billing. |
| PRIVILEGED_ADMIN | FiscalConfigurationService.createWithOwnerContext con capacidades exactas nuevas, B2bPhase8FiscalAdmin y HTTP propietario existente para FISCAL_READ/AUDIT/SAVE. |

Las cuatro últimas dependencias son opcionales solo en el factory de bajo nivel:
un módulo ausente no tiene ruta ni capacidad. El host montado exige las **cinco**
capacidades fiscales exactas de `b2b-runtime-status.ts`; READ aislado, duplicados
o capacidades inventadas bloquean el host completo. No existe TRANSMIT.

La administración conserva el handler, inyección y guards del controlador
existente; una subclase local aplica el filtro sanitizado del runtime sin mutar
la metadata global de ese controlador. Solo se devuelven códigos de error
públicos y estados de denegación acotados, no mensajes, SQL, rutas o secretos.

`POST /internal/b2b/runtime-status` se instala junto a los módulos reales. Su
`status.bootId` es exactamente `NodeMaintenance.instance.bootId`, nunca otro UUID.
El estado ASSEMBLED_AND_STORAGE_CHECKED prueba módulos instalados y columnas
accesibles; no acredita PKI, CRL, autorización humana, contenido fiscal ni
quiescencia de escritores no registrados. `fiscalActivation` permanece false.

## Readiness y validación fiscal

Readiness ejecuta exclusivamente SELECT de columnas fijas con WHERE false;
requiere array vacío. Cubre tablas Prisma de lectura, relaciones/artefactos,
auditoría de descarga, journal técnico y, según capacidades instaladas, las tablas
locales Guide/Batch, aceptación/outcomes y configuración/auditoría fiscal. No lee
filas ni secretos, aplica DDL, crea esquemas o concede permisos. Una columna
faltante devuelve indisponibilidad sanitizada. Los triggers/ACL y la integridad de
los datos siguen siendo responsabilidad de instalación y operaciones propietarias;
una proyección vacía no demuestra estas propiedades.

El runtime usa XsdValidationService.validate sobre los bytes exactos, comprobando
perfil, SHA del ZIP oficial fijado, SHA del XML y fecha de evidencia. No acepta
verified/approved/trusted como parámetros de configuración o HTTP.

- Antes del INSERT local de GuideLocalArtifact/BatchLocalArtifact se verifica XSD
  del XML firmado, dentro de la transacción propietaria. El wrapper conserva SQL,
  parámetros, aislamiento y reintentos de los stores existentes.
- Cada replay/descarga local vuelve a verificar XML y XSD y conserva la autorización
  y validación criptográfica del pipeline; lectura ausente no prepara ni firma.
- Las firmas de evidencias de corrección pasan primero por XSD y luego por los
  métodos auténticos de BetaOwnerXmlTrust; sus pruebas locales no se sustituyen por
  DTO ni se fabrican sellos WeakSet de aceptación.
- Los CDR siguen la verificación de firmas/PKI del puerto existente; XSD de guías
  o lotes no se presenta como verificación de un ApplicationResponse.

Las guías y lotes permanecen LOCAL_EMULATOR/candidate/local-only: la firma local
no concede traslado, aceptación oficial, confianza del certificado ni envío.
No se construye ni invoca ningún adaptador SOAP/REST de SUNAT. Las únicas llamadas
HTTP nuevas son RPC mTLS privados a Identity/Billing.

## Dependencias que debe aportar el padre

Recursos de App DI: PrismaService, ArtifactStore.read, CurrentPdfService,
SecretVault, CertificateInspectionService, CertificateTrustService,
CdrSignatureTrustService y XsdValidationService. El host exige clases concretas
de crypto/trust/XSD; no introduce un objeto de aprobación para sustituirlas.

Puertos explícitos del despliegue:

- B2bOwnerDrain real compartido.
- `lifecycle.stopProducers`, `stopWorkers`, `closeOtherOwnerListeners`: cierres
  reales de todos los recursos del owner, no recibos ni funciones de éxito vacías.
- LocalGuideKeys.withKey y BatchLocalKeyProvider.acquire, con propósito/RUC y
  disposición de material exclusivamente propietario. No se recibe P12 por HTTP.
- PrivilegedHumanAuthority, Phase8LiveHumanIdentity y Phase8AdminBindingOwner:
  autoridad/step-up humanos actuales y binding autorizado; no claims del body.
- TLS API/control y RPC privados, peers explícitos, RUCs permitidos y pins públicos
  del emisor fijados por ruta absoluta/hash/fingerprint.

B2bOwnerDrain se recibe por interfaz estructural compatible con el padre. No se
cargan fuentes del monorepo como fallback ni se compila service-access desde este
bloque. La prueba usa la implementación real del padre, no un gate local alterno.

## Cuatro fases y cierre real

La instalación del drain ocurre ANTES de app.init/listen.

1. ADMISSION: pauseCommands y esperar drain(COMMANDS). Los GET y POST de inspección/
   autorización clasificados READ por el gate del padre siguen disponibles.
2. PRODUCERS: esperar stopProducers.
3. WORKERS: esperar stopWorkers y drain(MUTATIONS).
4. STORAGE: closeAdmission, esperar drain(ALL), cerrar otros listeners del owner,
   app.close y finalmente prisma.$disconnect. Solo al terminar recibe STORAGE
   completo el B2bMaintenanceNode.

Un resultado DRAINING/pending distinto de cero es fallo, no shutdown exitoso.
Las promises de los hooks se conservan para idempotencia; un hook fallido no
permite saltar a STORAGE. El listener de mantenimiento permanece vivo/PARKED
cuando se cierra la API y el pool. Solo close explícito de proceso lo cierra.
El interceptor del padre mantiene la ejecución SQL aunque aborte el cliente;
ese aborto no libera el slot ni produce recibo de pausa.

El gate del padre clasifica los POST de operaciones fiscales privadas como
COMMAND; no se cambia aquí esa política ni se agrega una excepción encubierta
para mantenerlos abiertos durante ADMISSION. Si otros workers necesitan alguno
mientras drenan, el padre debe revisar su clasificación/orden explícitamente.

## Host y entrypoint: instalado en fuente, aún bloqueado para operación completa

`createB2bSunatRuntimeFromFiles(files, existingContext, ports, {enabled:true})` lee
solo `sunat-runtime.json` a través de B2bRuntimeFiles. Espera metadatos con
schemaVersion `factuez.b2b.sunat-mounted-runtime.v1`, config BETA, origins Identity/
Billing HTTPS sin credenciales/path/query, referencias TLS de nombre fijo,
allowedRucs guide/batch e issuerPublicPins. No busca .env, P12 ni configuración
predeterminada. Crea transportes privados y PinnedBetaIssuerPublicCertificates;
los demás recursos se resuelven del contexto existente, sin crear AppModule.

`bootstrapB2bSunatHost(input, context, ports)` exige contexto y todos los puertos
ANTES de abrir montajes o sockets, construye las cinco capacidades y llama start.
El entrypoint directo y la rama del main legacy no inventan esos argumentos:
con el flag true y sin la integración del padre terminan con
**B2B_SUNAT_COMPLETE_HOST_BINDINGS_REQUIRED**. No arrancan READ aislado ni retroceden
a legacy. Sin opt-in el main conserva su flujo anterior; importar b2b/main como
módulo no ejecuta bootstrap ni toca configuración.

**Gaps concretos pendientes:**

- Conectar el contexto DI real y SunatHostPorts en la composición del main. La
  rama escrita todavía llama sin esos bindings y por diseño permanece bloqueada.
- Implementar/conectar autoridad privilegiada, identidad humana viva y verificación
  de binding reales. El repositorio expone sus interfaces, sin un adaptador SUNAT
  completo que este host pueda seleccionar legítimamente por defecto.
- Conectar key providers y todos los cierres reales de productores, workers,
  listeners/colas/recursos del App DI. No se modifica ni se presume terminada la
  edición de publishers que está realizando el padre.
- Preparar montajes/pins/roots/CRLs fuera del código de aplicación. Las clases
  existentes CertificateTrustService/CdrSignatureTrustService consultan su política
  pública externa al ejecutarse; el host no la rellena, falsifica ni declara lista.
- El XSD existente ejecuta /usr/bin/xmllint: un despliegue necesita ese ejecutable y
  el ZIP fijado. La disponibilidad de esas piezas no se convierte en true por DI.
- No hay ensayo PostgreSQL, vault persistente ni Docker en este bloque. El daemon
  Docker Desktop Linux no está disponible; la prueba PostgreSQL del padre queda
  fuera de esta evidencia y no se contabiliza como ejecutada.

## Pruebas focalizadas reproducibles

```powershell
pnpm exec vitest run tests/b2b-sunat-runtime.spec.ts tests/b2b-sunat-runtime-host.spec.ts --maxWorkers=1 --hookTimeout=60000 --testTimeout=30000
pnpm --filter @factuez/sunat-service typecheck
```

25 casos (17 runtime + 8 host), dos archivos. Se prueban listener Nest HTTPS y TLS
mutuo reales, peers, rutas/capacidades instaladas, lectura/auditoría propietarias,
firmas XMLDSig y P12 generados en memoria, guías y lotes RC, replay sin otra firma,
XSD, revocación, autorización humana de fixture, fallos cerrados y las cuatro
fases con SQL todavía pendiente después de cortar el socket del cliente.

Para XSD en Windows el test conserva extracción y hash del ZIP oficial y cambia
solo el puerto de proceso privado del servicio por Python/lxml/libxml real,
sin red/entidades externas. No devuelve evidencia de éxito prefabricada. Requiere
`python` con lxml; falla si no está disponible. El puerto Windows de prueba no se
incorpora al runtime operativo.

Los repositorios Prisma/SQL, Identity/Billing, step-up y lifecycle usan datos y
puertos sintéticos en el ensayo; no prueban SSO, PostgreSQL, roots/CRL oficiales ni
cierre del despliegue real. La aceptación criptográfica de corrección no tiene
un happy-path PKI operativo ensayado aquí: la ruta y el ensamblaje son reales y
los estados sin evidencia se rechazan. No se afirma verificado un certificado
real ni una revocación sin la evidencia externa necesaria.

Resultado del cierre focal: 25/25 casos aprobados y typecheck SUNAT sin errores.
No se ejecuta build ni regresión global, migraciones o Docker. Las pruebas del
padre y su prueba PostgreSQL/vault no se atribuyen a estos resultados.
