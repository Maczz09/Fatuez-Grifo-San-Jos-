# Usuarios, roles y permisos

FactuEz es una instalación privada con varios emisores RUC y múltiples sedes. El
control de acceso reside exclusivamente en `identity-service`; los demás
microservicios consumen un access token RS256 y jamás aceptan la identidad o
permisos que envíe el navegador en headers propios.

## Roles iniciales

| Rol | Uso operativo | Capacidades principales |
|---|---|---|
| `ADMIN` | Administrador de la instalación | Todas, incluida configuración SUNAT, usuarios y auditoría. |
| `STATION_MANAGER` | Jefe de estación | Productos, series, emisión, contingencias, turnos y reportes. |
| `CASHIER` | Caja | Emitir, consultar y enviar comprobantes; abrir/cerrar turno. |
| `TRACK_OPERATOR` | Pista | Emitir y consultar comprobantes en los puntos de emisión asignados. |
| `AUDITOR` | Auditoría | Consulta de comprobantes, reportes y bitácora; sin emisión. |

Los permisos se materializan en las tablas `Role`, `Permission` y
`RolePermission`. Una cuenta puede tener varios roles mediante
`UserRoleAssignment`; no se guarda un único enum en `User`.

## Alcance por sede, punto y serie de emisor

`UserEmissionPoint` conserva UUID externos de `billing-service`, sin crear una
dependencia de base de datos entre servicios. Identity emite un `scope` explícito:

- GLOBAL: solo ADMIN de la instalación;
- ASSIGNED: intersección de branchIds, emissionPointIds y series;
- series contiene UUIDs de SeriesCounter, no etiquetas F001 compartidas entre RUC;
- alcance ausente/inválido se rechaza; arrays vacíos no conceden acceso global.

Billing deriva el RUC del punto en su propia base y comprueba vigencia de
la cuenta/authVersion en Identity. Ver [MULTI_RUC.md](MULTI_RUC.md).

Ese último caso es una denegación segura: crear una cuenta sin puntos no le da
acceso a toda la estación.

## Inicialización sin credenciales por defecto

Antes del primer inicio, el administrador del servidor crea el secreto local
`secrets/initial_admin_password.txt` (contraseña de 12 o más caracteres) y
declara, por ejemplo:

```env
FACTUEZ_INITIAL_ADMIN_USERNAME=admin.grifo
FACTUEZ_INITIAL_ADMIN_FULL_NAME=Administrador Grifo San Jose
```

Al iniciar, `identity-service` sincroniza el catálogo de permisos y crea la
cuenta inicial **sólo si ese usuario aún no existe**. Nunca restablece ni
sobrescribe cuentas existentes. Después del primer acceso, el secreto puede
retirarse del entorno de despliegue; debe permanecer protegido mientras exista.

## Endpoints internos publicados a través de Kong

- `POST /api/v1/auth/login`: devuelve un Bearer JWT de 15 minutos por defecto.
- `GET /api/v1/auth/me`: devuelve los claims del usuario autenticado.
- `GET /api/v1/roles`: requiere `role.manage`.
- `GET /api/v1/users`, `POST /api/v1/users` y `PATCH /api/v1/users/:id/access`:
  requieren `user.manage` y, para cambios de asignación, `role.manage`.

La PWA sólo conserva el access token en memoria y debe volver a autenticar al
operador cuando expire. El token se firma con la clave privada montada
únicamente en Identity; Billing recibe únicamente la clave pública montada como
secret. El refresh token se incorporará junto al cierre de sesión y la
revocación centralizada, no como credencial persistida en el navegador.

## Regla de evolución

Para agregar un permiso se modifican a la vez
`packages/contracts/src/authorization.ts`, el enum de Prisma de Identity y el
catálogo de `RbacBootstrapService`. Así el nombre incluido en el JWT y la
asignación persistida no pueden divergir silenciosamente.
