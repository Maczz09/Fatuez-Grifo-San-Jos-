# Configuración operativa de guías por empresa

La pantalla `/guide-settings` permite que el administrador declare rol, productos exactos y rutas de la empresa seleccionada en la cabecera. Guarda en Billing, no en el navegador. El enlace aparece en Administración con `setup.manage` y en `/guides`; el laboratorio local de guías se conserva.

Guardar no autoriza envíos a SUNAT, no concede permisos de emisión, no modifica ambientes, correlativos ni versiones fiscales del emisor. Combustible y otros productos fiscalizados conservan su clasificación declarada. Los perfiles fiscales existentes y `NON_REGULATED` conservan sus restricciones. La extensión de combustibles incorpora perfiles independientes de GRE ordinaria con SCOP; véase [alcance y configuración](guide-fuel-profile.md). No implementa ni habilita GRE-BF.

## Instalación existente (paso manual revisable)

Revisar el destino y el propietario de la base de **Billing** antes de ejecutar DDL. No ejecutar contra Identity ni SUNAT. El código no consulta ni modifica este esquema durante el arranque. Si falta la tabla o una columna, GET/PUT responden 503 con una instrucción de preparación segura.

El archivo aditivo es `services/billing-service/prisma/guide-operational-settings.sql`. A continuación se aplica `services/billing-service/prisma/guide-fuel-settings.sql`, que amplía el CHECK del JSON para aceptar la extensión opcional de combustibles sin cambiar filas ni revisiones. Crea una tabla y agrega restricciones de forma repetible. No modifica filas previas, no contiene semillas, no borra tablas y no reinicia revisiones del emisor. Si ya existe una tabla con este nombre, comparar primero columnas, FK y restricciones: `IF NOT EXISTS` no repara una definición incompatible.

Comando de referencia para el operador, sustituyendo exclusivamente los marcadores por el destino revisado y usando el mecanismo habitual de autenticación de PostgreSQL:

```text
psql -X --host <host-billing> --username <propietario-billing> --dbname <base-billing> --set ON_ERROR_STOP=1 --file services/billing-service/prisma/guide-operational-settings.sql
psql -X --host <host-billing> --username <propietario-billing> --dbname <base-billing> --set ON_ERROR_STOP=1 --file services/billing-service/prisma/guide-fuel-settings.sql
```

Cada script incluye transacción, `lock_timeout=5s` y `statement_timeout=30s`. Debe aplicarse antes de poner a disposición la pantalla. Recompilar/publicar Billing y PWA mediante el procedimiento habitual de instalación, sin activar flags de emisión. No es necesario regenerar Prisma por esta tabla para consumir el servicio: utiliza SQL parametrizado. El modelo Prisma también describe la tabla para instalaciones nuevas.

La FK referencia únicamente `CompanySettings` en Billing. `updatedBy` y `ConfigurationAudit.actorId` son UUID declarativos del usuario autenticado, sin FK a Identity. La auditoría y el documento se guardan en una misma transacción. El límite de petición compartido es 128 KiB UTF-8; la restricción de almacenamiento es 256 KiB para permitir la representación canónica de JSONB, además de comprobar rol, claves, forma y cantidades. La validación detallada compartida se ejecuta antes de cualquier escritura.

Para una **base nueva y vacía**, el exportador incorpora la tabla desde Prisma y sus restricciones desde el DDL anterior. No aplicar este bundle a una instalación existente ni modificar bundles históricos:

```text
node scripts/export-production-schemas.cjs <directorio-absoluto-nuevo-con-padre-existente>
```

El exportador es offline, produce su manifest con hashes y no contacta una base. El bundle conserva su comprobación de destino explícito `factuez.schema_target` y de base vacía/propietario.

## API

`GET` y `PUT /api/v1/stations/issuers/:companyId/guide-settings` usan `JwtPermissionGuard`, su comprobación de revocación con Identity y `setup.manage`. También requieren administrador nativo `ADMIN` con alcance `GLOBAL` y empresa existente activa. No dependen de `BILLING_PRODUCTION_ISSUANCE_ENABLED`, `SUNAT_PRODUCTION_WORKFLOW_ENABLED` ni del CRUD de maestros.

La versión del contrato es `factuez.guide-operational-settings.v1`. GET devuelve revisión 0 y `settings:null` cuando no existe configuración. PUT admite únicamente `{expectedRevision, settings:{role,products,routes}}`; requiere rol y al menos un producto y una ruta completos. RUC, empresa y actor se obtienen del contexto autenticado y de Billing; campos adicionales en cualquier nivel se rechazan.

Ambas respuestas exitosas GET/PUT incluyen `Cache-Control: private, no-store` para impedir que un navegador o proxy conserve configuraciones privadas o desactualizadas. El runner HTTP real verifica el header de ambos métodos.

Cada producto admite UUID único, nombre de 1–160 caracteres, tipo `FUEL | OTHER_REGULATED | GENERAL`, unidad `LTR | GLL | KGM | TNE | NIU` y código comercial opcional de hasta 80 caracteres. Cada ruta admite UUID único, nombre de 1–160 y origen/destino completos: dirección de hasta 300, UBIGEO de seis dígitos, departamento/provincia/distrito de hasta 100 y establecimiento SUNAT opcional de cuatro dígitos. Hay hasta 30 productos y 30 rutas; se rechazan nombres/códigos duplicados, controles, bidi, etiquetas, enums desconocidos y propiedades adicionales. Las direcciones y UBIGEO son declaraciones del cliente, sin afirmar validación de catálogo oficial. No hay campo fijo SCOP. La propiedad opcional `fuelProfile` versionada declara registro de hidrocarburos, familias de productos y régimen/modalidad/motivo/exigencia de SCOP por ruta. Las referencias deben corresponder exactamente a los productos FUEL y a todas las rutas configuradas.

La revisión es independiente de `CompanySettings.configVersion`. Creación concurrente y revisión antigua devuelven 409 sin sobreescribir. GET es estable y no audita ni escribe. El servidor deriva `configured`, `status:PROFILE_REVIEW_PENDING` y `fiscalTransmission:false`; el cliente no puede proponerlos. La UI conserva el borrador ante conflicto o respuesta incierta y exige consultar/revisar el estado antes de otro PUT; no reintenta automáticamente.

## Comprobaciones locales sintéticas

No usar instalaciones existentes, secretos, `.env`, certificados o cuentas reales. Se utilizó `pnpm@11.19.0` según `packageManager`, sin actualizar dependencias ni el lockfile. El runner PostgreSQL crea contenedor efímero con datos sintéticos, red interna sin puertos publicados y limpieza de sus propios recursos. Usa un rango aleatorio `10.252.x.0/28` porque los pools automáticos de Docker pueden estar agotados; ante solapamiento, Docker rechaza la creación sin modificar otras redes.

Preparación desde este checkout (PowerShell, URL exclusivamente sintética para generación offline):

```powershell
corepack pnpm install --frozen-lockfile --offline
$env:DATABASE_URL='postgresql://synthetic:synthetic@127.0.0.1:1/offline'
corepack pnpm --filter @factuez/billing-service db:generate
corepack pnpm --filter @factuez/sunat-service db:generate
corepack pnpm --filter @factuez/billing-service... build
corepack pnpm --filter @factuez/shadow-core... build
corepack pnpm --filter @factuez/contracts typecheck
corepack pnpm --filter @factuez/billing-service typecheck
corepack pnpm --filter @factuez/web-pwa typecheck
corepack pnpm exec vitest run tests/guide-operational-settings.spec.ts tests/station-admin.spec.ts tests/multi-issuer.spec.ts --maxWorkers=2
```

Crear `output/fuel-profile` y generar el bundle en el directorio **nuevo** `output/fuel-profile/new-install-schema` antes del runner DB; ese runner también comprueba la instalación del bundle Billing en otra base vacía dentro de su contenedor:

```text
node scripts/export-production-schemas.cjs <ruta-absoluta-del-checkout>/output/fuel-profile/new-install-schema
node tests/guide-operational-settings-db.e2e.mjs --isolated-synthetic-only
```

La suite HTTP usa Nest y PostgreSQL reales con Identity sintético local y claves efímeras. Verifica acceso, revocación, body falsificado, persistencia, CAS, concurrencia, rollback de auditoría, ausencia de cambios fiscales, 503 seguro y ambos caminos de instalación.

Playwright usa el Chrome local y la instalación 1.64.1 del preflight suministrado, sin copiar dependencias ni cambiar el lockfile. En una terminal iniciar exclusivamente el servidor de este checkout y, en otra, ejecutar la suite. El servidor se limita a `127.0.0.1:3117`, rechaza archivos `.env` de desarrollo sin abrirlos y usa entorno saneado; no reutilizar servidores ajenos ni iniciar un build mientras se ejecuta la UI:

```text
node tests/guide-settings-ui-server.mjs
node tests/guide-operational-settings-ui.e2e.mjs C:/Users/maxmo/orca/workspaces/FactuEz/codex-programador-preflight-20261102/package.json
```

Las pruebas de UI usan **API simulada**, cubren viewports 1440×900 y 390×844 y conservan capturas, traces, consola y metadatos de red en `output/guide-settings/ui`. No sustituyen la prueba DB/HTTP. Los datos son ficticios, sin secretos. Detener ese servidor de pruebas antes del build final de PWA.

Para conservar aparte la evidencia de la revisión de headers/texto, añadir `--review-followup` al comando de UI; escribe en `output/guide-settings/ui-review`. La pestaña Rutas aclara expresamente: «El SCOP, cuando corresponda, es un dato de cada operación y no se guarda como valor fijo en esta configuración». La pestaña Combustibles configura el perfil de GRE ordinaria con SCOP. Para verificarla en el navegador, usar `--fuel-profile`; la evidencia queda en `output/fuel-profile/ui`. El formulario de empresa no guarda SCOP por operación ni transmite documentos.

## Paso pendiente

El operador aún debe instalar este cambio en el servidor revisado. Después el integrador debe revisar el producto exacto y la ruta declarados, determinar el perfil GRE ordinario o GRE-BF que corresponda y conectar el flujo fiscal/servidor compatible. El formulario por sí solo no prueba elegibilidad tributaria, habilitación ni emisión productiva de combustible. No se ejecutó DDL, despliegue o prueba en instalaciones reales.
