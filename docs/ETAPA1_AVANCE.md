# Etapa 1 — Fundamentos multi-sede e interfaz

Implementación iniciada el 1 de octubre de 2026. Varios emisores RUC y múltiples sedes configurables.
La distribución 21+1 no se fija en código; ver [MULTI_RUC.md](MULTI_RUC.md).

Este incremento conserva los microservicios Identity, Billing y SUNAT y Kong.
No habilita transmisión fiscal ni cambia el ambiente de documentos existentes.

Las sedes se incorporan inicialmente al dominio de puntos de emisión en Billing.
La extracción de maestros a un microservicio propio queda para un incremento
posterior, con contratos versionados; no se comparte un Prisma Client.

Los roles de sistema se asignan mediante presets; su matriz se consulta, no se
modifica globalmente desde una sede. Los roles personalizados son un incremento
posterior. El alcance de cada cuenta aplica a todos sus roles asignados.

## Entregado en este incremento

- `packages/ui`: componentes oficiales shadcn (Radix), sidebar, tablas,
  selectores, formularios, diálogos, tabs y gráficos. Inter local, sin depender
  de Google Fonts. Logos WebP originales conservados, con ajuste visual CSS.
- `/login`, `/dashboard`, `/pos`, `/documents`, `/users`, `/roles` y `/stations`.
  Menú por permisos, selectores de emisor RUC y sede, tema claro/oscuro y POS separado del
  backoffice. Estados vacíos, errores, carga y confirmación de salida.
- Dashboard conectado a Billing: conteo, importe e IGV del día en PEN,
  agrupación por punto y estado. Fecha operativa en America/Lima. Consulta cada
  15 segundos, no WebSocket todavía. El importe incluye pruebas y pendientes,
  no representa caja cobrada ni venta fiscal aceptada.
- Consulta paginada (20 filas) por número/cliente, emisor RUC y sede. El filtro de acceso
  se aplica en el servidor, incluyendo punto y serie; conserva la consulta de
  documentos históricos aunque el punto esté inactivo.
- Alta de sedes y puntos con pares Fxxx/Bxxx únicos por el mismo emisor.
  No se trasladan puntos, reinician series ni alteran XML históricos.
- Alta de usuarios, activación/desactivación y asignación de presets, sedes,
  puntos y series. Contraseña inicial de mínimo 12 caracteres. Identity
  verifica la correspondencia de esos recursos mediante la API de Billing;
  no lee otra base de datos ni comparte un Prisma Client.
- Delegación local acotada: no puede conceder ADMIN, otro administrador de
  sede, recursos ajenos ni permisos que no tiene. Registro de cambios y
  de intentos de delegación rechazados. Sin auto-modificación de accesos.
- Tokens con `scope` explícito y `authVersion`. Alcance asignado vacío
  significa ningún recurso, nunca acceso global. Cambios de acceso revocan
  sesiones; Billing consulta vigencia en Identity antes de autorizar. Desactivar
  una cuenta no depende de que Billing esté disponible; reactivarla sí verifica
  nuevamente los recursos asignados.
- POS de prueba con factura/boleta, catálogo o ítems libres, cantidades/precios
  decimales en texto y cálculo en el backend. Clave idempotente por usuario.
  Solicitudes sin respuesta conservadas en `sessionStorage`, asociadas al
  usuario: se recuperan en la misma pestaña al recargar o volver a entrar.
  No cerrar la pestaña ni emitir otra operación por incertidumbre; fuera de
  ella se requiere revisar el registro con el administrador.
  Las unidades heredadas del catálogo se muestran sin reemplazarlas; su
  normalización y validación fiscal por perfil pertenece a P2.
- PWA: manifest, registro de service worker y pantalla sin conexión. Solo
  cachea assets estáticos; nunca API, JWT, documentos ni páginas autenticadas.
  No confirma emisión offline. La sesión JWT permanece en memoria. Para
  instalar desde terminales LAN se requiere HTTPS; localhost permite QA local.

## Compatibilidad y migración aditiva

No se modificaron las bases ni los contenedores de la instalación existente.
Las expansiones multi-RUC se probaron en PostgreSQL 17 aislado con datos QA. Respaldar Identity,
Billing y artefactos antes de migrar; comparar cantidades y correlativos antes
y después. No usar `docker compose down -v`, `migrate reset` ni
`db push --accept-data-loss`.

1. Billing: `services/billing-service/prisma/phase1-expand.sql` crea Branch,
   agrega `branchId`, asigna a CENTRAL solo puntos aún sin sede y agrega
   ConfigurationAudit. La columna queda nullable para la transición, pero la
   emisión deniega puntos sin sede. Documentos y correlativos no cambian.
2. Identity: `services/identity-service/prisma/migrations/20261001000000_branch_access/migration.sql`
   agrega authVersion, UserBranch y UserSeries en una transacción. Con historial
   Prisma correcto se aplica mediante migrate deploy de Identity. Si la base
   nació con db push, establecer su baseline antes de usar migrate deploy;
   no aplicar automáticamente migraciones iniciales sobre tablas existentes.
3. Aplicar las expansiones multi-RUC descritas en [MULTI_RUC.md](MULTI_RUC.md).
   No levantar imágenes nuevas sobre bases anteriores sin este paso.
4. Entrar como administrador general y asignar sede/puntos/series a las cuentas
   no ADMIN existentes. No inferir acceso global ni importar permisos desde
   datos del navegador. Los tokens antiguos sin scope se rechazan.
5. Reconstruir Identity, Billing y web juntos. El listado de documentos pasó
   de array a `{ page, pageSize, total, items }`; la nueva UI usa ese contrato.
   La terminal anterior permanece en el código como referencia, no en la ruta
   principal. Revisar cualquier consumidor externo del listado antes del corte.
6. Las claves nuevas de idempotencia incluyen el ID de usuario. Resolver
   solicitudes pendientes del cliente antiguo antes del cambio; no reutilizar
   una clave anterior ni generar una nueva emisión para resolver incertidumbre.

## Ejecutar el demo

Para una instalación nueva o ya actualizada (ver MULTI_RUC), desde
`D:\Facturacion\FactuEz`, con Docker Desktop operativo y los secretos de
demo ya preparados (no se modificaron ni se imprimieron):

```powershell
docker compose -f .\docker-compose.demo.yml up -d --build
pnpm test:stage1:e2e
```

Acceso por Kong: `http://localhost:8080`, cuenta `demo.admin` y su contraseña
existente en `.factuez-demo/secrets/initial_admin_password.txt`. No copiar esa
contraseña a logs o documentación. Los jobs db push son solo del demo.

La prueba E2E exige `demoData=true` y BETA. Crea dos sedes/puntos y usuarios
rotulados PRUEBA, emite localmente, comprueba aislamiento, deduplicación,
delegación y revocación. Desactiva las cuentas temporales al terminar y conserva
sedes/documentos para trazabilidad; no borra ni transmite a SUNAT.

Para validar sin una base conectada:

```powershell
pnpm install --frozen-lockfile
$env:DATABASE_URL = 'postgresql://validation:validation@127.0.0.1:5432/validation'
pnpm --filter "./services/*" db:generate
pnpm build
pnpm typecheck
pnpm test
pnpm test:stage1
pnpm --filter "./services/*" db:validate
```

La URL ficticia solo permite generar/validar esquemas; no sirve para migrar.
En Windows se usa build normal/next start porque standalone necesita privilegio
de symlinks. Docker/Linux conserva standalone sin cambiar protecciones del PC.

## Evidencia del 1 de octubre de 2026

- Compilación del monorepo y comprobación TypeScript: correctas.
- Tres esquemas Prisma: válidos; clientes regenerados.
- 41 tests automatizados: 12 de contratos/RBAC/scopes, 4 de impuestos/UBL
  y 25 de servicios P1/multi-RUC (dobles de prueba, no PostgreSQL real).
- Prueba adicional real en PostgreSQL 17: tres expansiones sobre fixture anterior,
  snapshots y correlativos preservados, FKs compuestas y rollback seguro.
  Contenedor temporal y datos ficticios eliminados sin tocar la instalación.
- Compose demo: validación sintáctica/configuración correcta, sin imprimir
  secretos. No se han reconstruido ni migrado los contenedores de la instalación existente.
- QA visual con fixture temporal en memoria, separado de la API real:
  administrador y cajero; dashboard, usuarios/diálogo, roles, sedes, POS y
  consulta; escritorio 1280 y tablet 768; sin desbordamiento global del body.
  Respuesta 503 simulada después de registro: logout/login recuperó la clave;
  reintento devolvió B001-1 y el listado siguió con un solo documento.
- Integración P1 con imágenes nuevas y bases PostgreSQL reales en un proyecto
  Docker separado `factuez-stage2-qa` (8091): login, sedes, series, emisión
  idempotente, delegación y revocación correctas a través de Kong. Se conservan
  documentos PRUEBA por trazabilidad; las cuentas temporales se desactivan.
  La instalación anterior 8080 y sus volúmenes siguen sin modificarse.
  Antes del corte se requiere respaldo y ensayo en copia completa del demo
  anterior, no solo una instalación nueva o el fixture de migración.

## Pendiente y criterio de salida

El primer incremento P1 está implementado, pero no declarar P1 validada para
despliegue de la instalación anterior hasta aplicar y verificar las migraciones
en una copia respaldada y probar en terminales reales. El E2E en una instalación
aislada nueva ya se superó; no equivale al ensayo de migración de datos históricos.

Siguen pendientes roles personalizados, edición de productos y otros maestros,
consulta autorizada de RUC/DNI, turnos/caja, copias/restauración verificadas,
firma/transmisión SUNAT, CDR, incidencias, PDF fiscales/QR/correo/WebSockets, recibidos/ERP
e integración Wayne. Se desarrollan según las siguientes etapas del plan; los
permisos visibles no significan que esos módulos estén habilitados.
