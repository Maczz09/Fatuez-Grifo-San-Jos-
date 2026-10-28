# B2B-09 — Aprobación automática USER de Received (BETA privada)

## Comportamiento y opt-in

La fachada existente conserva `automaticReceivedApprovals: false` cuando el campo no está en `runtime.json`. El validador sólo permite booleanos dentro de la configuración BETA aprobada existente. Al habilitarlo explícitamente, una operación USER sin `stepUpHandle` recibe internamente el marcador `oidc-stepup.` seguido del access token OIDC original. Los handles manuales se conservan; los marcadores suministrados por el llamador se rechazan. SERVICE nunca recibe un marcador y nunca puede autorizarse como USER.

No se añade ninguna ruta pública, SDK ni modificación al inventario de operaciones. Los archivos reales de la fachada en este repositorio están bajo `services/b2b-api-service/src/`.

## Digest y autoridad

El propietario Received sigue normalizando la operación y calculando `vault.fingerprint(hash({action, scope, payload: semantic}))`, excluyendo el handle. La fachada y el cliente no conocen ni calculan el HMAC de vault. Sólo cuando el propietario ya tiene ese digest, `B2bReceivedStepUpHttp` prepara AUTOMATION mediante el servidor Identity existente:

- POST fijo `/internal/b2b/received-stepup/prepare`, con el OIDC original en Authorization Bearer, purpose AUTOMATION, action, tupla exacta environment/companyId/recipientRuc/branchId y requestSha256 del propietario.
- POST de verificación existente con handle, digest, actor, scope y action. Se valida la prueba exacta, incluido `requestBindingSha256 = hash(body)`, usuario, authRevision, autoridad GLOBAL_ADMIN, permiso setup.manage y vigencia.

La caché sólo evita repetir la preparación. **Cada authorize hace una verificación nueva por HTTP**. El servidor Identity real vuelve a consultar IdP, enlace, usuario, aplicación, revisiones, scopes, MFA y tupla; nunca se sustituye por un permiso por defecto. El propietario conserva sus controles y concesiones persistentes independientes. Las comprobaciones posteriores a la auditoría y previas al commit siguen denegando revocaciones. GRANT nunca usa preparación automática: TI debe preparar y aprobar la política completa con su revisión esperada.

## Montaje explícito y separación TLS

En la fachada, agregar opcionalmente `automaticReceivedApprovals: true` a los metadatos existentes. En Received, agregar opcionalmente `stepUp.prepareEndpoint` con la URL HTTPS fija del prepare de Identity. Debe compartir exactamente origen con `stepUp.endpoint`, no tener query, fragmento ni credenciales y usar el path fijo de preparación. El endpoint verify legado conserva su compatibilidad.

El montaje de Received requiere, sólo si se configura prepareEndpoint, estos archivos adicionales:

- `stepup-prepare-ca.pem`
- `stepup-prepare.crt`
- `stepup-prepare.key`

Verify conserva `stepup-ca.pem`, `stepup.crt` y `stepup.key`. Ambos clientes deben tener certificados diferentes y estar autorizados en los peers prepare/verify separados del servidor Identity. El CA y el pin SHA-256 del servidor se comprueban antes de enviar el token; no hay redirects ni TLS inseguro. No se infieren roles a partir del certificado o de datos entrantes. Sin prepareEndpoint no se leen archivos prepare; sin flag en la fachada no se activa el flujo automático. El arranque no prepara aprobaciones ni hace llamadas al IdP.

## Caché y cierre

La clave de caché incorpora SHA-256 del token, clientId/clientRevision, subjectId/userAuthRevision, scope, action y digest. Hay como máximo 32 entradas incluyendo preparaciones pendientes. Solicitudes simultáneas exactas comparten la preparación y verifican por separado. Al llenarse la caché se deniegan entradas nuevas hasta caducidad o eliminación; no se amplía el límite. La vigencia máxima es 30 segundos desde el comienzo local de la preparación y se reduce según las respuestas prepare/verify. Se eliminan entradas vencidas, errores y entradas inconsistentes al retroceder el reloj. Un fallo de verificación nunca reutiliza una autorización previa.

Token, claves TLS, caché y handles permanecen en campos privados `#`; JSON e inspect del cliente muestran PRIVATE. No hay almacenamiento de tokens/handles ni logs de estos valores en este bloque. El handle del protocolo contiene el token y sólo se conserva transitoriamente en memoria privada. El servidor durable persiste hashes y metadatos según el protocolo existente. JavaScript no permite prometer borrado físico de strings del heap.

Received main dispone la caché en `closeListeners`, después de `drain('ALL')` y antes de cerrar la aplicación/pool. La misma función participa en STORAGE del mantenimiento del propietario. En fallo de arranque anterior a crear runtime se dispone inmediatamente; un drain fallido nunca fuerza el cierre detrás de trabajo pendiente.

## Verificación realizada

Pruebas propias:

- `tests/b2b-received-automatic-approvals.spec.ts`: 19 pruebas, con fachada HTTP, owner Received, servidor approvals e Identity reales en Nest/mTLS loopback; IdP y Billing sintéticos, PostgreSQL explícitamente simulado. Comprueba digest HMAC calculado por owner, aprobación única con múltiples revalidaciones, default deshabilitado, handles manuales, separación de claves de caché, límite 32, caducidad, dedupe y recuperación tras error de auditoría, pin y peers, exclusión de SERVICE/GRANT y revocación antes/durante la última verificación con rollback del audit del propietario.
- `tests/b2b-received-automatic-runtime.spec.ts`: 4 pruebas sobre lectura opcional de archivos, endpoint fijo/origen, certificados separados antes de Prisma y disposición sólo tras ALL drain y antes del cierre del pool.

Regresión focalizada adicional: `b2b-received-runtime-host`, `b2b-received-approval`, `b2b-runtime-bootstrap`, `b2b-received-automation`, `b2b-received-http` y `b2b-received-runtime`. Typechecks sin emisión: `pnpm --filter @factuez/received-documents-service typecheck` y `pnpm --filter @factuez/b2b-api-service typecheck`.

## Archivos de este bloque

Producción: Received `src/b2b/runtime-authority.ts`, `runtime-files.ts`, `main.ts`; fachada `src/received-automation.ts`, `runtime-config.ts`, `runtime-assembly.ts`, `main.ts`. Dos tests propios y este documento. Sin cambios a Identity, shared, sourceaudit, paquetes, AppModule, SDK ni rutas públicas.

## Límites y gates externos

El padre integra/mantiene el montaje opcional `receivedApprovals`, esquema y readiness de Identity. Para activar en despliegue hacen falta ese servidor preparado, esquema durable ya instalado, IdP MFA/configuración vigente, usuario GLOBAL ADMIN con setup.manage, enlace y aplicación USER activos con scopes/bindings correctos, concesiones Received persistentes y certificados/peers separados. Este bloque no inscribe usuarios, aplicaciones ni grants, no ejecuta DDL/migraciones y no rebaja permisos.

Las pruebas no demuestran transacciones PostgreSQL reales ni conectividad desplegada: usan fake PG explícito y certificados sintéticos. No se usó Docker, DB real, QA ni credenciales reales; no se activó SIRE/SMTP/SUNAT ni despliegue. No se ejecutó build global ni se generó dist. La configuración de endpoints/archivos y el opt-in deben montarse de manera coordinada en el despliegue privado.
