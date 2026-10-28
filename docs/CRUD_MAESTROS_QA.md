# CRUD de emisores, sedes, puntos y series

Implementación local QA/Beta · 2026-10-05. No habilita emisión oficial ni cierra
las fases fiscales o de migración del historial.

## Uso

En **Sedes y maestros**, el administrador general puede crear, consultar,
editar, desactivar y reactivar emisores, sedes, puntos y series. Los formularios,
confirmaciones, pestañas, filtros y tablas utilizan los componentes shadcn
existentes. Seleccionar **Estado → Inactivos / Todos** permite restaurar registros.

- Emisor: razón social, nombre comercial, dirección fiscal, ubigeo, teléfono y
  correos de contacto. El RUC se establece al crear y luego es inmutable.
- Sede: código, nombre y dirección. Cambiar de emisor sólo está permitido si
  nunca se crearon puntos, incluidos puntos inactivos.
- Punto: código, nombre, dirección y pista opcional. Al crear se asignan dos
  series iniciales F/B; su empresa y sede no se pueden trasladar.
- Serie: crear por tipo 01/03/07/08/09, consultar siguiente correlativo y número
  de comprobantes, desactivar/reactivar y renombrar únicamente si no hay
  comprobantes y el siguiente correlativo sigue siendo 1.

Desactivar es la eliminación lógica del CRUD: no se borran filas, XML, CDR, PDF
ni credenciales. Un emisor/sede/punto inactivo bloquea nuevas emisiones de sus
dependencias. Reactivar el padre no reactiva hijos desactivados individualmente.
Los turnos abiertos deben cerrarse antes de desactivar su emisor, sede o punto.

## Seguridad y consistencia

Requiere JWT vigente, rol `ADMIN`, alcance `GLOBAL` y permiso `setup.manage` para
emisores/sedes/consulta administrativa; `series.manage` para puntos/series. Los
demás usuarios mantienen la consulta operativa dentro de su alcance, sin CRUD.
`STATION_MASTER_CRUD_ENABLED=true` se configura únicamente en el override QA
existente. Los emisores de producción se excluyen del catálogo y toda escritura
que alcance uno se rechaza. Guardar no autentica SOL ni acredita identidad/PKI.

El contrato `factuez.station-admin.v1` y las listas de campos admitidos no
permiten enviar claves, RUC modificado, propietarios, tipo modificado ni
`nextNumber`. No se puede editar, reiniciar, liberar ni reutilizar numeración.
Las series inactivas conservan su clave única `(companyId, documentType, series)`.
GT 31 no se agrega como una operación fiscal mediante este módulo.

Toda actualización exige `expectedRevision`; una revisión obsoleta devuelve
409. Escritura y auditoría son atómicas. Los locks de fila siguen el orden
empresa → sede → punto → serie y se coordinan con emisión/reservas de notas
mediante locks compartidos. El catálogo administrativo se lee con snapshot
`RepeatableRead`, sin certificados ni secretos. La consulta de comprobantes
anteriores no depende del estado activo de sus maestros.

Un timeout o error 5xx de guardado puede significar una respuesta incierta:
la interfaz no reenvía automáticamente. Exige recargar y comprobar el registro.
Cancelar un borrador modificado requiere confirmar su descarte. No se guarda
el borrador en almacenamiento del navegador.

## Cambio de esquema y despliegue

Sólo se añaden cuatro columnas mediante
`services/billing-service/prisma/admin-master-crud.sql`:
`CompanySettings.active` y `masterRevision` en Branch, EmissionPoint y
SeriesCounter. Valores iniciales `true`/`1`. Transacción con límites de lock de
5 segundos y statement de 15 segundos. No se ejecuta `db push`, no se aplican
tablas financieras candidatas, no se actualizan registros de documentos y no
se altera un contador.

Se conserva la versión anterior de Billing/PWA con la etiqueta
`pre-master-crud-20261005`. El rollback de runtime no requiere quitar columnas:
son aditivas y compatibles con las imágenes previas. El despliegue usa sólo
Billing y PWA del proyecto `factuez-stage2-qa`, `--no-deps --no-build --pull never`,
conservando Kong, intranet y volúmenes. No debe ejecutarse `compose up` general.

## Verificación

Resultado de este incremento: **3.051 pruebas / 88 suites PASS**, TypeScript
de contratos/Billing/PWA y build Docker de Billing/PWA PASS. Seis checks de
PostgreSQL aislado PASS; migración idempotente y locks verificados. El catálogo
administrativo anónimo responde 401 y la página/chunk nuevo responden 200.
Los permisos previamente existentes de la cuenta de Billing sobre las cuatro
columnas y la inserción de auditoría se comprobaron sin ampliar grants.

Desplegado en `localhost:8091/stations`, con acceso intranet conservado: sólo
Billing/PWA recreados, once contenedores saludables y nueve sin cambios.
Auditorías del recuadro blanco/gris y gates cerrados de Billing/Sunat PASS;
auditorías de Formatos y logos y Entrega del cliente PASS. Prueba visual
ficticia: edición de emisor/sede/punto, RUC de sólo lectura, descarte de borrador,
renombrado permitido/no permitido, creación de series/punto y desactivar/reactivar.
No se editaron registros empresariales existentes para probar el CRUD.

- Pruebas unitarias sintéticas del backend, permisos, campos protegidos, CAS,
  auditoría/rollback, series usadas, turnos y estados heredados.
- Pruebas del modelo de formularios, payloads y ausencia de campos fiscales
  protegidos; regresión de la pestaña Entrega del cliente y de formatos.
- `tests/station-admin-db.e2e.mjs --isolated-synthetic-only`: PostgreSQL nuevo,
  efímero en tmpfs, red interna y sin puertos publicados. Migra dos veces desde
  un esquema previo ficticio, verifica bytes de la fila del contador salvo la
  nueva revisión, relaciones Prisma reales, CAS, unicidad, desactivación,
  turnos y locks. No toca el QA activo. Sus recursos temporales se retiran.
- `tests/station-admin.runtime.audit.cjs --read-only-qa`: código/flags,
  cuatro columnas, página/chunk público nuevo y catálogo anónimo 401. No lee
  configuraciones privadas de emisores ni abre sesiones reales para probar.
- QA visual con identidad y datos ficticios en memoria; no se modifican datos
  empresariales de la instalación como parte de las pruebas.

SUNAT/producción, uso de certificados reales, importación de historial,
conciliación y corte permanecen fuera del alcance de este incremento.
