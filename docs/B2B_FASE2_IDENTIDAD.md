# B2B-02 — identidad de aplicaciones y contexto autorizado

Fecha: 20/10/2026. **Núcleo y adaptadores implementados; ensayo aislado correcto.
No desplegado en QA; SSO/enrollment/MFA real y piloto pendientes.**

## Resultado de esta entrega

- Clientes SERVICE con OAuth client_credentials, secreto aleatorio de 256 bits
  mostrado una sola vez y almacenamiento exclusivo del hash HMAC con pepper propio.
- JWT RS256 de cinco minutos, audiencia `factuez-b2b-v1`, sin refresh token.
  Constructor exige comprobar separación respecto a claves humana, extracción y TLS.
- Alta, consulta de metadatos, cambio de grants, desactivación y rotación, con
  revisión optimista y auditoría transaccional. Ante caída de BD/auditoría se deniega.
- Revocación/grants vigentes en cada introspección, no sólo verificación de firma.
  Rotación o reactivación no revive un JWT anterior. Fallos no devuelven secretos.
- Acceso delegado USER por introspección OIDC autenticada y vínculo explícito
  con usuario local; intersección con sus permisos y asignaciones vigentes.
- Contexto canónico consultado en Billing con autorización actual de Identity.
  RUC, sede, punto, serie y tipo se verifican como **una tupla**, no como listas
  independientes que permitan combinaciones ajenas.
- Transporte privado HTTPS/mTLS, límites de cuerpo/concurrencia, cuotas persistentes,
  URLs fijas, sin redirects ni desactivación de TLS. No se reenvían roles del request.
- Persistencia PostgreSQL preparada con tablas separadas de extracción y esquema
  **candidato, no aplicado**. No se añadieron migraciones de arranque automático.

Scopes activos de este núcleo: `b2b:context:read`, `b2b:catalog:read`.
Ese valor predeterminado no cambió. Los adaptadores posteriores de
[B2B-03](B2B_FASE3_LECTURA_Y_EXTRACCION.md) y
[borradores/emisión B2B-04](B2B_FASE4_BORRADORES.md) permiten políticas adicionales
explícitas en ensamblajes aislados; no amplían clientes ni grants del QA actual.
Emisión sigue sin concederse por defecto: el candidato B2B-04 admite su scope
explícito y exige document.issue vigente para USER. Administración de usuarios
y webhooks siguen fuera de estos grants.
Los tokens legacy no cambian.

## Rutas candidatas, no publicadas en el stack actual

| Propietario | Método y ruta | Control |
| --- | --- | --- |
| Identity | POST `/b2b/oauth/token` | Peer técnico mTLS + Basic del cliente SERVICE |
| Identity | POST `/internal/b2b/introspect` | Peer de recurso mTLS + token y scopes requeridos |
| Identity | GET `/internal/b2b/jwks` | Peer de recurso mTLS; sólo clave pública |
| Identity | POST `/internal/b2b/clients` | Peer admin + persona ADMIN activa + step-up |
| Identity | GET `/internal/b2b/clients/{id}` | Igual; metadatos sin hash/secreto |
| Identity | PATCH `/internal/b2b/clients/{id}` | Igual + expectedRevision |
| Identity | POST `/internal/b2b/clients/{id}/rotate` | Igual + expectedRevision; sólo SERVICE |
| Billing | POST `/internal/b2b/context` | Peer de consulta mTLS + introspección fresca + tupla canónica activa |
| Billing | POST `/internal/b2b/validate-bindings` | Peer registrador específico; valida jerarquía, no devuelve catálogo completo |

No publicar `/internal/*` en Kong ni dar el certificado registrador a un consumidor.
La validación de bindings se solicita desde Identity después del control de admin;
por sí sola no crea clientes ni concede permisos. Cada propietario vuelve a verificar
actividad y asociación al consultar el contexto. Las credenciales de la BD de Billing
no salen de Billing; la fachada futura no tendrá acceso a ellas.

## Archivos principales

- `packages/contracts/src/b2b-security.ts`: principal, scopes y tuplas verificables.
- `services/identity-service/src/b2b/`: dominio, signer, PostgreSQL, puente OIDC,
  lectura de permisos locales, autorización administrativa y ensamblado Nest aislado.
- `services/identity-service/b2b-schema.candidate.sql`: propuesta de tablas propias.
- `services/billing-service/src/b2b/`: contexto, repositorio Prisma y módulo privado.
- `packages/service-access/src/b2b.ts`: cliente HTTPS privado y validación de respuestas.
- `tests/b2b-identity*.ts`: fakes exclusivamente de prueba, pruebas de dominio y HTTPS.
- [Decisión OIDC/puente local](b2b/ADR-003-OIDC-Y-PUENTE-LOCAL.md).

`CompanySettings.id` es numérico en el código existente. Se corrigieron los
esquemas de contexto/emisor y la envoltura webhook que lo habían propuesto como
UUID. Los IDs de sede, punto, serie y documento siguen siendo UUID. Ninguna tabla,
identidad ni comprobante real fue modificado por esa corrección del contrato.

## Ensayo y límites

Las pruebas levantan dos listeners TLS efímeros **en loopback**, con CA/certificados
ficticios y repositorios de prueba. Recorren Identity → validación en Billing y
Billing → introspección fresca en Identity. No usan el stack `factuez-stage2-qa`,
certificados de empresa, SUNAT, SIRE, correos ni callbacks reales.

También se comprueba rechazo de tokens de extracción/PWA, scopes futuros, grants
ajenos, producción, claims alterados con firma válida, revocación, concurrencia,
vínculo USER obsoleto y ausencia de step-up. El SQL se verifica mediante puertos
simulados y revisión del selector; **no equivale a ensayo sobre PostgreSQL real**.

Resultados de esta revisión:

- **63 pruebas nuevas** de identidad/contexto/HTTPS aprobadas.
- **70 pruebas** del contrato/inventario B2B aprobadas.
- Regresión completa: **136 archivos, 5.388 pruebas aprobadas y 1 omitida**.
- Tipos del monorepo: **26 tareas correctas**, 19 paquetes.
- Auditoría actualizada: **161 rutas declaradas**, incluyendo nueve candidatas
  nuevas de identidad/contexto; no implica nueve rutas desplegadas en Kong.

```text
pnpm --filter @factuez/contracts build
pnpm --filter @factuez/service-access build
pnpm test:b2b-identity
pnpm test:b2b-contract
pnpm typecheck
pnpm exec vitest run --maxWorkers=2 --hookTimeout=30000
```

Los artefactos de diseño se actualizan mecánicamente, después de compilar contratos,
con `node migration/b2b-contract-snapshots.cjs --refresh-design-artifacts`. El comando
sólo escribe los tres JSON de referencia de `docs/b2b`; no activa la API.

## Pendiente para habilitación y cierre de piloto B2B-02

1. Ensayar las tablas candidatas y su recuperación en una BD nueva autorizada.
   Revisar mínimos permisos, retención de auditoría y limpieza de cuotas. No aplicar
   SQL sobre Identity actual sin respaldo y autorización de destino.
2. Desplegar/configurar proveedor OIDC y cliente de introspección privado, PKCE de
   la aplicación consumidora, redirects exactos, enlace explícito de cuentas y
   mecanismo auditado de enrollment/revisión de vínculos.
3. Integrar y ensayar el verificador MFA/step-up real. El puerto está cerrado cuando
   no se proporciona: **no hay segundo factor implementado en el login PWA actual**.
4. Configurar claves separadas, CA/peers, secretos, listeners y conectividad privada.
   Registrar clientes/grants reales mediante el plano administrativo, nunca por chat
   ni insertando cuentas desde fixtures. Ensayar denegaciones y revocación en destino.

El ensamblado candidato no está importado por los AppModule actuales ni por Kong.
No hay cambios visibles en el Swagger operativo; continúa describiendo lo desplegado
anteriormente. La fachada `b2b-api-service`, `/b2b/v1/me`, capabilities y consultas
externas se conectarán en B2B-03. Todavía no existe un endpoint B2B de emisión usable.

Se puede avanzar **B2B-03 en código y pruebas sintéticas**, conservando estos gates.
No declarar piloto/SSO real aprobado por haber pasado mocks ni iniciar producción.
