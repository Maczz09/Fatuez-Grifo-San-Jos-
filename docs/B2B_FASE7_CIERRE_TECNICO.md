# B2B-07 — Cierre técnico de guías y lotes

Fecha: 23/10/2026. Alcance exclusivo: código candidato LOCAL/BETA.

Estado: **CERRADA EN SU ALCANCE TÉCNICO LOCAL/BETA**. Implementación y ensayos
terminados. Este cierre no activa servicios ni acredita aceptación fiscal oficial.

## Qué se completa

- Guía remitente 09 privada/04: numeración atómica, snapshot íntegro, permisos
  independientes y originales firmados recuperables sin volver a numerar.
- Guía transportista 31: contrato propio completo, productor PostgreSQL,
  numeración V, catálogo versionado de vehículo/TUC, conductor, MTC y bienes,
  referencia pública 09 verificada y fijada por versión. La 09 privada no se
  convierte en referencia pública cambiando una etiqueta.
- Identity reconoce explícitamente 09 y 31 con mapas separados y tres series
  concedidas. El adaptador conserva actor SERVICE/USER y revisiones; no inventa
  un usuario humano para SERVICE ni hereda ISSUE desde WRITE de borradores.
- XML completo reconstruido del snapshot propietario, XMLDSig, ZIP y hashes;
  verificación criptográfica de firma de emisor y de CDR. Certificados y CDR de
  los ensayos son efímeros/ficticios, nunca certificados oficiales acreditados.
- Originales append-only en el servicio fiscal: `GuideLocalArtifact`,
  `GuideLocalCdr`, `BatchLocalArtifact`, `BatchLocalCdr`. XML/ZIP/CDR no se
  regeneran para aparentar un original; el PDF bajo demanda sigue siendo una
  representación distinta. No se guardan P12 ni contraseñas en estas tablas.
- Lotes RC condiciones 1/2/3 y RA con propietario PostgreSQL dedicado, versiones
  firmadas, originales de notas, historial de créditos y grants completos. RC2 y
  SERVICE ya tienen productor persistente propio; no se fuerza el repositorio
  heredado limitado a USER a admitir capacidades que no soporta.
- Solicitud original, hash, comando, identidad, journal y outbox local deshabilitado
  se conservan en la misma transacción. `recover` obtiene el resultado con permiso
  READ; no reserva otra identidad ni repite el productor. UNKNOWN no autoriza envío.
- APIs públicas candidatas y RPC privados fijos con mTLS, Bearer, límites,
  validación cerrada y comprobaciones actuales antes/después. No se devuelve la
  referencia privada ni el recibo interno de autorización al consumidor.
- Montaje explícito `createB2bPhase7Application`, sin entrypoint automático,
  variables de entorno implícitas, migradores, listeners ni consumidores activos.
  Las capacidades sólo anuncian los módulos realmente proporcionados al montaje.

## Superficie candidata

Prefijo común `/b2b/v1`. Todas las operaciones exigen Bearer y el actor explícito
`X-FactuEz-Actor-Kind: SERVICE | USER`, además de transporte privado mTLS.

| Recurso | Operaciones |
| --- | --- |
| Emisión local 09 | `POST /guide-drafts/{id}/issuance`; `GET /guide-drafts/{id}/issuances/{operationId}` |
| Contrato completo 31 | `POST /carrier-guide-drafts/{id}/ready`; `POST /carrier-guide-drafts/{id}/issuance`; `GET /carrier-guide-drafts/{id}/issuances/{operationId}` |
| Originales 09/31 | `POST` y `GET /guide-drafts/{id}/issuances/{operationId}/artifacts`; `GET .../artifacts/{artifact}` |
| Lotes RC/RA | `POST /batches/prepare`; `POST /batches/recover` |
| Originales de lote | `POST` y `GET /batches/{id}/local-artifacts`; `GET .../local-artifacts/{artifact}` |

`artifact`: `xml`, `zip`, `cdr-xml`, `cdr-zip`. Un CDR ausente devuelve 404; no se
fabrica ni se sustituye por el de otro documento. Los archivos de ensayo llevan
`X-FactuEz-Source: LOCAL_EMULATOR` y no se anuncian como aceptación oficial.

Emisión 09/31: `If-Match` y `Idempotency-Key` obligatorios. La tupla consta de
ancla 01/03, serie de planificación 09/31 y serie fiscal independiente. Las
etiquetas F001/T001/V001 no sustituyen los identificadores ni el RUC.

Para consultar una operación/archivo de guía se transmiten los diez campos
planos de la tupla; no se acepta JSON arbitrario dentro de la query.
Para archivos de lote: `environment`, `issuerRuc`, `companyId`, `branchId` y el
batchId de la ruta. POST recibe `{scope}` con ese mismo batchId.

Lotes reciben sólo identificadores, versiones y hashes de miembros, fechas y
clave idempotente; no snapshots, XML, CDR, `asOf`, usuarios o banderas de aprobación.
El servidor fija el instante y reconstruye todos los miembros/dependencias.

Permisos de lotes: preparar requiere `b2b:batches:write`; recuperar requiere
`b2b:batches:read`; leer originales requiere además `b2b:artifacts:read`.
Son límites de vocabulario, no grants automáticos: se mantienen permisos locales
independientes por sujeto y por cada tupla fiscal y dependencia histórica.

El lector genérico de documentos 01/03 no se amplió eliminando su guard. La
consulta de 31 y sus archivos usa el recurso dedicado. Swagger candidato:
[OpenAPI completo](b2b/openapi.candidate.v1.json); las rutas tienen
`x-runtime-enabled=false`. El Swagger del stack ya abierto no se actualizó
mediante un despliegue implícito.

## Fronteras de seguridad conservadas

La autoridad local de lotes usa locks y revisiones transaccionales en Billing.
Las comprobaciones repetidas de Identity son observaciones remotas actuales,
**no una transacción distribuida ni una garantía de revocación atómica entre BD**.
Un fallo o cambio detectado bloquea/revierte o exige recuperación explícita.

El RPC de archivos de lote conserva esquema, permiso, sujeto, alcance, hashes y
banderas cerradas. Se verifica la respuesta privada completa antes de proyectar
el comando al pipeline; no se eliminan comprobaciones para acomodar otro contrato.
Un acceso revocado no puede recuperar bytes antiguos de la caché.

`certificateTrusted`, `officialCdrVerified`, `fiscalExecutionEnabled`,
`transmissionAuthorized` y `authorizedForTransfer` permanecen falsos donde aplican.
Un CDR RC/RA local tampoco concede aceptación fiscal a sus miembros. Un resultado
XSD correcto no acredita confianza PKI, reglas oficiales completas ni aceptación.

## Verificación reproducible

```powershell
pnpm typecheck
pnpm exec vitest run --maxWorkers=2 --testTimeout=30000 --hookTimeout=30000
pnpm --filter @factuez/contracts --filter @factuez/service-access --filter @factuez/sunat-core --filter @factuez/identity-service --filter @factuez/billing-service --filter @factuez/sunat-service --filter @factuez/b2b-api-service build
node tests/guide-artifact-db.e2e.cjs --isolated-synthetic-only
node tests/carrier-guide-owner-db.e2e.cjs --isolated-synthetic-only
node tests/b2b-guide-issue-authority-db.e2e.cjs --isolated-synthetic-only
node tests/b2b-batch-member-db.e2e.cjs --isolated-synthetic-only
node tests/b2b-batch-operations-db.e2e.cjs --isolated-synthetic-only
node tests/b2b-carrier-guide-http-db.e2e.cjs --isolated-synthetic-only
node tests/batch-local-artifacts-db.e2e.cjs --isolated-synthetic-only
node tests/phase7-crypto-db.e2e.cjs --isolated-synthetic-only
node tests/numbered-carrier-profiles-signed-xsd.e2e.cjs --isolated-synthetic-only
```

Los runners crean PostgreSQL nuevos etiquetados, tmpfs, `--network none`, sin
puertos ni descarga de imagen. Instalan DDL candidato sólo allí y comprueban la
propiedad antes de retirar sus contenedores. Nunca usan `.env` ni una URL de BD
real para estos ensayos. El test integrado de criptografía/BD tiene configuración
separada obligatoria: no se contabiliza como pasado por omitirlo en la regresión.

Ensayos aislados aprobados sobre el código integrado:

| Comprobación | Resultado |
| --- | --- |
| Originales 09: PostgreSQL, concurrencia, CDR y rollback | 10 grupos aprobados |
| Propietario persistente31, referencia, correlativo y revocación | 14 grupos aprobados |
| Identity: grants independientes y dos BD propietarias aisladas | 10 grupos aprobados |
| Versiones/políticas/journal de lotes RC1/2/3/RA | 14 grupos aprobados |
| App consumidora HTTPS → propietario de lotes PostgreSQL | Ensayo aprobado |
| App consumidora HTTPS → propietario31 PostgreSQL | Ensayo aprobado |
| Archivos RC/RA, criptografía y PostgreSQL | 33 pruebas aprobadas |
| RC2 firmado/verificado → carga privada por ID → original persistido; GT31 con referencia firmada09/CDR | 2 pruebas integradas aprobadas |
| Perfiles09/31 y XSD local fijado por SHA | 76 pruebas aprobadas |
| Montaje, rutas, Swagger y descargas privadas | 109 pruebas focalizadas aprobadas |

Resultados definitivos sobre el código estabilizado:

- Compilación de contratos/transporte y de Identity, Billing, SUNAT y API B2B:
  correcta, sin despliegue.
- Verificación global de tipos: **28 tareas satisfactorias en 21 paquetes**.
- Regresión completa: **231 archivos aprobados; 9.910 pruebas aprobadas**, una
  omisión condicional preexistente, **cero fallos**, 222,58 segundos.
- Permisos humanos reforzados: un USER con sólo `document.view` no obtiene
  `b2b:batches:write` ni `b2b:guides:issue`; se exige `document.issue` actual.
  Las pruebas comprueban concesión, denegación y retirada sin volver a entrar.
- Auditoría de fuente: **270 rutas declaradas; 76 operaciones B2B candidatas,
  44 GET**; 30 bloques funcionales inventariados. No infiere despliegue.
- No quedaron contenedores temporales de PostgreSQL de estos ensayos.

## Qué no es este cierre

No es un despliegue en `localhost:8091`, ni autorización de envío a SUNAT, ni cierre
de las etapas fiscales históricas 2/3, ni aprobación del cliente o de Contabilidad.
No modifica ventas existentes, contadores de QA, propietario de series ni datos
de otros emisores. No se usaron certificados privados reales, OAuth, SMTP real,
SOAP/REST oficiales ni producción.

El siguiente bloque del plan B2B es **B2B-08: paridad funcional y administración
delegada**. El despliegue/migraciones autorizadas, VPN/Kong, enrolamiento real,
SSO/MFA, operación y piloto privado corresponden a **B2B-09**. La habilitación
fiscal oficial conserva su aprobación y evidencias independientes.
