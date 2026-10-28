# B2B09 Billing/SUNAT — contrato de integración 27/10/2026

Estado temprano: implementación en curso; NO cierre integral ni activación fiscal.

## Contrato con el integrador

- CLI Billing: `bootstrapBillingB2b` carga configuración local fija y `startBillingB2bHost` construye los adaptadores builtin; no cargador externo.
- Permisos: misma instancia de `BillingHostPermissions`/`BillingBatchCurrentIdentity` en los puertos y wrappers de runtime. No usar los cores sin envolver.
- Administración de políticas: `BillingBatchPolicyAdministration.policyAdmin.authorizeStepUp(handle, policySha256, asOf)` sólo dentro de `withPolicy(token, policy, work)`. El handle opaco es temporal, no es un bearer ni un recibo JSON. Identity verifica OIDC/MFA actual mediante sus RPC existentes; Billing exige las dos pruebas setup.manage y series.manage, principal/revisión GLOBAL idénticos y boundary exacto configurado. Ambas pruebas ligan el payload íntegro de política (incluye active=false y expectedRevision). No se modifican maestros/series ni se crean grants por scope.
- Evidencia de miembros: `HttpBatchMemberEvidence.verifySignedVersion(ownerHandle, asOf)` conserva pin SUNAT, mTLS, nonce, digest y frescura. Fuente exacta del ledger persistente; nunca latest ni importación pública.
- Límite real: originales 01/03 registrados y verificables. No se fabrica historia 07/08 ni complete:true. Falta el productor OWNED que capture versiones inmutables, artefactos y cambios aceptados/reservados con cierre sobre todos los escritores.
- No se necesita nuevo endpoint Identity para las dos pruebas administrativas actuales. Si se quiere una acción administrativa específica BATCH_POLICY con auditoría semántica dedicada, el propietario Identity debe añadirla explícitamente; no se renombra ni se amplía una allowlist compartida desde Billing.

## Lectura para Mailer (sin cambios en Mailer/shared)

El integrador mantiene SERVICE B2Breader con scopes de documentos/artefactos y fresh queued actor. Billing read y source SUNAT PDF se limitan a 01/03 y queued-only según contrato del padre. La clausura SharedCDR owner BATCH debe resolver Billing read batch → todos los items.documentId → lookup de contextos autorizado por los bindings del actor, para cada miembro. Una autorización al lote no sustituye esos controles. No se implementa ni se certifica esa clausura desde esta entrega.

## Bloqueo concreto de historial

FiscalDocument contiene un solo immutablePayload y DocumentArtifact tiene unique(documentId,kind). PrismaBetaSummaryOwner selecciona estado actual; eso no prueba versiones históricas. CorrectionJournalRepository reconcilia su perfil V2 candidato, rechaza otros ledgers/batches/legacy y no constituye catálogo general 01/03/07/08. Instalar tablas vacías o consultar el último registro no corrige esa carencia. Se requiere integrar captura atómica en todos los productores y resultados propietarios y reconciliar escritores externos antes de admitir notas completas.

## Restricciones

Sin cambios Mailer/shared/Identity. Sin bases reales, QA8091, DDL aplicado, P12 real, SUNAT, correo ni producción. SQL sólo candidato. Pruebas ficticias/loopback y sus límites se anexarán al terminar.
