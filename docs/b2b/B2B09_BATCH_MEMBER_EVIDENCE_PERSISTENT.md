# B2B09: contrato privado para Lagrange

Estado: candidato aislado; ningún main/runtime se modifica ni se monta automáticamente.

## SUNAT
`createPersistentBatchMemberEvidence({db, pool, owner, artifacts, certificates, trust, cdr})`
en `services/sunat-service/src/b2b/batch-member-evidence-assembly.ts`.
- `db`: Prisma SUNAT existente; reutiliza PrismaBetaDocumentAcceptanceRepository y PrismaBetaSummaryOwner.
- `pool`: contrato estructural PostgreSQL (`connect/query/release`), sin dependencia nueva.
- `owner`: productor privado OWNED que resuelve exclusivamente handles de versiones exactas. No DTO público, QA, latest ni banderas de confianza. El esquema legacy por sí solo NO implementa este puerto.
- `artifacts/certificates/trust/cdr`: lectores y verificadores existentes; sólo certificados públicos/política CRL fijada.
- Devuelve `evidence` (BatchMemberEvidence real), `producer.capture(ownerHandle, asOf)` privado y `repository` de lectura.
- `BatchMemberEvidenceModule.isolated(evidence, {billing: [fingerprint]}, now)` agrega sólo POST `/internal/b2b/batch-member-evidence`. Instalar en listener mTLS existente con requestCert y rejectUnauthorized; JSON estricto con límite 2048 bytes.
- Registro candidato en `batch-member-evidence-schema.candidate.sql`; NO ejecutar DDL ni declarar migración instalada.

## Billing
`new HttpBatchMemberEvidence({enabled:true, origin, sunatPeerSha256, tls:{ca,cert,key}, now})`
en `services/billing-service/src/b2b/batch-member-evidence-http.ts`, implementación de BatchMemberEvidencePort.
Ruta HTTPS fija, certificado SUNAT fijado además de CA/hostname, sólo handle opaco + asOf + nonce + digest.
Solicitud/respuesta frescas <=30s; echo/digest/tipos/límites comprobados. No ampliar allowlists compartidas.

## Límites que el montaje debe conservar
Los esquemas legacy no conservan versiones históricas ni catálogo financiero completo. El registro conserva versiones que el productor privado haya verificado, con metadatos de aceptación OWNED capturados y artefactos originales. Una versión no registrada o un artefacto histórico ausente se rechaza; no reconstruir desde latest.
Las notas 07/08 se rechazan con BATCH_EVIDENCE_CATALOGUE_HISTORY_MISSING: no existe todavía un productor de historia completa demostrable de créditos/reservas. No se inventa complete:true.
El montaje requiere suministrar el productor OWNED real; no sustituirlo con un stub, raw payload público o booleano. No afirmar cierre/activación operativa.
Pruebas locales: PostgreSQL fake explícito, loopback mTLS y fixtures criptográficas existentes. Sus políticas PKI de prueba se identifican expresamente; no equivalen a PKI oficial SUNAT.

