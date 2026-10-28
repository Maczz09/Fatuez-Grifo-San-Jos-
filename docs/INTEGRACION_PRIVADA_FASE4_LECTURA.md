# API privada de extracción · Fase 4: lectura y originales

Fecha: 2026-10-09. Esta fase corresponde al **proyecto nuevo de API de extracción**,
no al cierre fiscal SUNAT ni al corte del historial de las etapas antiguas.

## Entrega y límites

Implementados el microservicio NestJS `services/integration-service` y dos
ejecutables de lectura aislados, propietarios de sus datos, en Billing y SUNAT.
Los cuatro servicios se han ensayado por HTTPS/mTLS con Identity de fase 3,
clientes técnicos y certificados ficticios. Los adaptadores Prisma se han
comprobado con **dos PostgreSQL nuevos independientes**, sin datos del cliente.

El código de este incremento está implementado y probado localmente. **No está
desplegado ni activado en localhost:8091/3101, Kong o Internet.** Ninguna base
existente ha recibido DDL, migraciones, importaciones ni cambios de contadores.
No se han enviado documentos a SUNAT ni usado certificados o credenciales reales.

| Tipo | Fuente y cobertura de esta API |
| --- | --- |
| 01, 03 | Lectura individual de `Document` y snapshot empresarial BETA; XML/ZIP/CDR originales cuando existen y su binding es coherente |
| 07, 08 | Igual lectura para notas persistidas en `Document`; no se consulta `NotesQa` ni se activa su productor |
| RC, RA | Pertenencia completa contrastada con Billing, incluyendo RC singleton legado y lotes múltiples |
| 09 | `SOURCE_NOT_SUPPORTED`: el laboratorio GRE separado no se convierte en emisión empresarial |
| 31 | `SOURCE_NOT_SUPPORTED`: la muestra offline/plantilla GT no acredita una fuente de emisión persistente autorizable |

`READY` en capabilities expresa soporte de lectura del perfil persistido y los
grants del cliente, **no habilitación fiscal, presencia de todos los archivos ni
aceptación por SUNAT**. Fuentes ausentes/inconsistentes producen errores, nunca
datos de demostración como reemplazo. No se prometen originales para 09/31.

## Flujo desacoplado

```text
ERP → futura VPN/Kong HTTPS → integration-service
                              ├─ Identity: token M2M y grants vigentes
                              ├─ Billing/read: snapshot y tupla canónica
                              └─ SUNAT/read: originales y pertenencia completa
                                                ├─ Billing/read: autorización
                                                ├─ almacenamiento propietario RO
                                                └─ auditoría técnica de lectura
```

El microservicio de integración **no tiene Prisma, conexión directa a BD,
volúmenes de XML/PDF, Redis, acceso a certificados P12, claves SOL ni colas de
emisión**. Sólo accede a orígenes HTTPS privados fijados por configuración. No
acepta URLs o rutas de almacenamiento aportadas por el consumidor.

Todos los procesos de lectura están desactivados por defecto. Se ejecutan por
separado, sin el `AppModule` normal: no instancian workers, Outbox, semilleros,
renderizadores, firmantes, migradores o adaptadores oficiales SUNAT.

## Endpoints implementados en el ejecutable opt-in

Todas las operaciones son GET, bajo `/integration/v1`:

- `capabilities?issuerRuc=…`: cobertura, permisos y funciones todavía pendientes.
- `issuers`: RUC autorizados, con paginación de catálogo.
- `branches?issuerRuc=…`: sedes autorizadas, con paginación.
- `points?issuerRuc=…&branchId=…`: puntos y series visibles; nunca correlativos.
- `documents/lookup?issuerRuc=…&type=01&series=F001&number=…`: clave exacta.
- `documents/{id}?issuerRuc=…`: cabecera, cliente, ítems, impuestos, totales,
  pagos y referencia de nota, usando el snapshot congelado.
- `documents/{id}/artifacts?issuerRuc=…`: inventario autorizado de originales.
- `batches/{id}?issuerRuc=…`: todos los miembros del RC/RA, o denegación completa.
- `batches/{id}/artifacts?issuerRuc=…`: inventario del lote completo autorizado.
- `artifacts/{id}/content?issuerRuc=…`: descarga íntegra, sin redirección pública.

`environment`, si se especifica, sólo admite `BETA`. RUC sintéticos `00…`, datos
de proveedores recibidos, producción, parámetros desconocidos y queries
repetidas/arrays son rechazados. El Bearer se presenta únicamente en Authorization.
No se aceptan sesiones humanas, usuario SOL ni `X-User-Id`.

Permisos: `integration:catalog:read`, `integration:documents:read`; para originales,
también `integration:artifacts:read`. Cada servicio verifica el estado actual del
cliente en Identity. El emisor se autoriza antes de acceder al repositorio;
después se verifica la tupla RUC–sede–punto–serie–tipo sin combinar grants distintos.

### Catálogos frente a lectura masiva

Las páginas del catálogo usan una copia temporal acotada, cursor aleatorio de
256 bits y expiración de 15 minutos. El contexto incluye cliente, revisión,
scopes, grants, operación, filtros y tamaño de página. Cada petición vuelve a
autenticarse; los cambios de permisos invalidan el cursor. Reiniciar el proceso
invalida sus cortes; no hay fallback por offsets ni truncamiento silencioso.

Las consultas de un catálogo por RUC usan Repeatable Read en Billing. Capturar
varios RUC consecutivamente no acredita un corte transaccional global. El
detalle individual devuelve la versión observada, **no** un snapshot masivo.
`snapshotId` en detalle devuelve `CONSISTENT_READ_UNAVAILABLE` por ahora.
Los endpoints de listado de comprobantes y exportaciones corresponden a fase 5;
feed/checkpoint durable a fase 6. Por eso capabilities mantiene
`consistency: NOT_READY` y `changes: NOT_READY`.

## Exactitud y confidencialidad

- Cliente, descripción, cantidades, precios y totales proceden del snapshot,
  no de maestros modificables. Se conservan decimales como texto y números
  fiscales con BigInt, incluyendo ceros de su representación congelada.
- Se comprueba el binding canónico de empresa, sede, punto y serie. No se
  recategoriza un documento por el ambiente actual de la empresa.
- Un dato opcional no guardado se entrega como `null`; no se inventan ceros,
  contado, establecimiento, cuota o aceptación. El mapeo corresponde al perfil
  persistido; no es un parser de todos los perfiles UBL posibles. Se informa
  `SNAPSHOT_PROFILE_FIELDS_ONLY` en detalle.
- Una referencia de nota conserva tipo/número fiscal, pero no expone IDs privados
  del original, evidencia `originalAcceptance`, historial de créditos ni secretos.
- `state.fiscal: NOT_CHECKED`, `verifiedAt: null`; el estado registrado se puede
  mostrar en `transport`, con advertencia. Código 0 o un SHA correcto **no** prueban
  firma, identidad, cadena PKI, validación fiscal ni aceptación oficial.
- Metadata de inventario no asegura que se hayan leído los bytes: su integridad,
  firma y confianza permanecen `UNVERIFIED`. La descarga sí comprueba hash/tamaño,
  sin transformar los bytes ni afirmar confianza criptográfica.

## XML y CDR originales

Se soportan `UNSIGNED_XML`, `SIGNED_XML`, `SUBMISSION_ZIP`, `CDR_XML`, `CDR_ZIP`,
sin confundir sus clases. No se sustituye XML firmado por unsigned, CDR por una
respuesta simulada o un PDF original por el render actual. Los PDF no se exponen
en este incremento y el inventario lo advierte explícitamente.

Un CDR copiado a un `DocumentArtifact` puede corresponder a un lote. Se resuelve
el artefacto canónico de `BatchArtifact` y se contrastan las asociaciones de
`CdrLog`/`SunatSubmission`, leyendo sólo IDs de binding, nunca sus mensajes.
Un enlace ambiguo/incompleto falla cerrado. La autorización exige **todos** los
miembros, íntegros y sin duplicados, coincidentes con el resumen persistido en
Billing y con sus snapshots. El permiso del documento pulsado no basta. RC sólo
admite boletas/notas sobre boleta; RA, facturas/notas sobre factura.

Los bytes sólo los lee SUNAT/read, dentro de su raíz explícita y directorio
propietario. El lector es exclusivamente RO, no sigue escapes/symlinks y lee
hasta el tamaño declarado, máximo 10 MiB, comprobando longitud/SHA-256 antes de
responder. Una desaparición del archivo devuelve `ARTIFACT_UNAVAILABLE`; una
alteración devuelve `INTEGRITY_FAILED`, sin bytes parciales.

Tras cargar el archivo se verifican de nuevo cliente/revisión y pertenencia
completa. La API intermedia verifica de nuevo tamaño, checksum y estado del
cliente. Las respuestas llevan `Cache-Control: private, no-store`, `nosniff`,
nombre construido seguro, Content-Length y **X-Content-SHA256**, según contrato.

La auditoría técnica persiste cliente/revisión, RUC, ID de artefacto, hash y
tamaño. Si falla, no se entrega el archivo. `READ_VERIFIED` significa bytes
autorizados preparados para respuesta, **no confirmación de recepción del ERP**.
El blueprint `services/sunat-service/prisma/integration-read.sql` se ha aplicado
únicamente al PostgreSQL ficticio, nunca a la BD existente.

## Configuración futura, sin activar ahora

Entradas compiladas:

| Servicio | Ejecutable | Flag opt-in |
| --- | --- | --- |
| Billing propietario | `services/billing-service/dist/integration/main.js` | `INTEGRATION_BILLING_READ_ENABLED` |
| SUNAT propietario | `services/sunat-service/dist/integration/main.js` | `INTEGRATION_SUNAT_READ_ENABLED` |
| API desacoplada | `services/integration-service/dist/main.js` | `INTEGRATION_READ_ENABLED` |

En cada proceso: `INTEGRATION_READ_ENVIRONMENT=BETA`, host restringido a
`127.0.0.1`, puerto independiente >1023; `INTEGRATION_READ_PEERS` con fingerprints
SHA-256 de peers mTLS aprobados; `INTEGRATION_READ_TLS_{CERT,KEY,CA}_FILE` y
`INTEGRATION_READ_CLIENT_{CA,CERT,KEY}_FILE`; Identity en
`INTEGRATION_READ_IDENTITY_ORIGIN`. SUNAT y la API usan
`INTEGRATION_READ_BILLING_ORIGIN`; la API también
`INTEGRATION_READ_SUNAT_ORIGIN`. Sólo orígenes HTTPS fijos, sin usuario, ruta,
query o redirects. SUNAT requiere `ARTIFACTS_ROOT` absoluto/propietario.

Los propietarios necesitan usuarios PostgreSQL dedicados: SELECT sólo en sus
tablas de lectura y, en SUNAT, INSERT/SELECT en la auditoría técnica. No permisos
de modificación fiscal, credenciales, Outbox o reinicio de series. Esa asignación,
certificados de transporte, retención de auditoría y operación privada real se
ensayan antes de habilitar el acceso. La clave TLS no es un certificado fiscal.

No se editaron Compose, rutas Kong, firewall, VPN, `.env` o servicios activos.
El esquema OpenAPI de fase 2 conserva `x-implemented: false` como snapshot de
diseño/no despliegue; este documento registra la implementación local por fase.
La fase 7 integrará la entrada privada y las políticas de red, sin publicar las
rutas internas ni reutilizar certificados/permisos de la PWA.

## Verificación reproducible

```powershell
pnpm test:integration-read
pnpm test:integration-read:db
node --test tests/integration-source-audit.test.mjs
```

Resultados de esta entrega: **117 pruebas nuevas** de lectura/HTTPS/almacenamiento;
**375 pruebas / 9 suites relacionadas** PASS; **7 del inventario** PASS;
**22 comprobaciones Prisma/PostgreSQL**, 11 por propietario, PASS. Compilación
de contratos, service-access, Billing, SUNAT e integration-service aprobada.

Regresión general adicional: **4.361 pruebas aprobadas / 115 suites**, con **una
prueba condicional existente omitida** porque no está configurado
`FACTUEZ_FISCAL_XSD_PYTHON` (XSD de NC/ND/RC/RA, fuera de este incremento). Las
117 pruebas nuevas no tienen omisiones. Esta regresión no acredita aceptación
oficial ni sustituye los pilotos fiscales pendientes.

El ensayo PostgreSQL usa esquemas mínimos ficticios, dos BD independientes,
imágenes locales existentes, datos inventados, red interna sin puertos y discos
tmpfs. No contiene tablas de credenciales/Outbox ni la columna `nextNumber`.
Comprueba realmente los repositorios Prisma, aislamiento por RUC, bindings de
CDR compartido y auditoría fail-closed. No certifica el esquema completo del
cliente, su PKI ni la instalación activa. Sólo se eliminaron los contenedores/red
etiquetados del ensayo; su contenido ficticio era desechable.

El siguiente incremento es **fase 5: listado estable, corte y exportaciones**.
No requiere claves del cliente para avanzar con código y fixtures. La activación
con fuentes reales y el piloto TI siguen separados, igual que los gates fiscales
y la migración/corte del historial.
