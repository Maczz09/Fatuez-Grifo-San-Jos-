# B2B-09 — Respaldo cifrado y recuperación aislada

Fecha: 26/10/2026, Lima. Incremento técnico LOCAL/BETA. No se consultaron ni
modificaron bases, archivos o certificados del QA existente ni del cliente.

## Alcance exacto

Se implementó una cápsula cifrada de ensayo y un runner que crea PostgreSQL de
origen y destino nuevos, separados, sin red, sin puertos publicados y con tmpfs
para datos y originales. Cada clúster tiene tres bases propietarias separadas:

| Propietario | Perfil ensayado |
| --- | --- |
| Billing | Trabajos de reportes B2B, captura, contenido y claves de replay. |
| Recepción | Esquema de recibidos, XML, ítems, adjuntos, permisos y journal de comandos. |
| Mailer | Trabajos y eventos corporativos, incluyendo aceptación SMTP y resultado desconocido. |

Incremento de [retención de reportes](B2B_FASE9_RETENCION_REPORTES.md): el ensayo
Billing incluye ahora un reporte vencido, su marca, ejecución y auditoría. El
dump inventaría todas sus tablas y restricciones; tras restaurar se comprueba 410,
replay sin duplicados y protección de la auditoría. También conserva un reporte
vigente descargable. No amplía este perfil a toda la facturación ni a datos reales.

Los estados se crean mediante los motores reales y sus repositorios PostgreSQL,
con clientes, documentos, claves y transportes exclusivamente ficticios. Los
originales XML/CDR usados en el ensayo son muestras sintéticas; no se presentan
como firmas confiables ni como CDR oficiales.

**No es todavía un respaldo completo de FactuEz ni un restaurador de respaldos
reales de San José.** El perfil Billing cubre reportes, no toda la facturación,
series, ledger o Outbox. No se ensayan aquí Identity/SSO, SUNAT, webhooks, exportador,
historial real, Redis, certificados ni custodia de claves. Sus procedimientos
deben completarse y coordinarse antes de un respaldo operativo integral.

## Formato de respaldo

`infra/b2b/recovery-bundle.mjs` aporta funciones puras en memoria:

- `sealB2bSyntheticRecovery`: valida perfiles, inventario, límites y originales;
  cifra mediante AES-256-GCM con nonce nuevo y autenticación de contexto.
- `openB2bSyntheticRecovery`: autentica y valida todos los miembros antes de que
  el llamador abra un destino. Requiere runId, backupId, versión de clave y conjunto
  exacto de propietarios esperados por un canal confiable.
- `b2bRecoveryInventorySha`: resume el inventario validado y ordenado.

El contexto se liga al cifrado; cambiar runId, backupId, versión de clave,
propietarios, etiqueta, nonce o contenido invalida la apertura. Los originales
contienen SHA256 verificado, MIME y nombre portátil. No se admiten rutas absolutas,
traversal, nombres repetidos ni certificados .p12/.pfx como originales. La cápsula
no carga entorno, lee archivos, conecta servicios ni elige destinos.

Límites: hasta tres perfiles, 16 MiB por dump, 10 MiB por original, 32 originales
por propietario, 32 MiB de datos binarios totales y 48 MiB de cápsula. El inventario
es acotado y conserva números de secuencia como texto, sin pérdida de precisión.
La implementación admite exclusivamente `SYNTHETIC / BETA`; cambiar una etiqueta
a `AUTHORIZED_COPY` o `PRODUCTION` no habilita datos reales.

La clave de cifrado se aporta aparte y no se incorpora a la cápsula. En el ensayo
es efímera y se descarta; no se genera un respaldo permanente del cliente. Un
despliegue real necesitará catálogo confiable de respaldos y custodia/recuperación
de claves independientes. Tener el archivo cifrado sin esos elementos no basta.

## Ensayo de recuperación

1. Crear únicamente el origen nuevo, verificar imagen local, identificador,
   etiquetas, ausencia de red/puertos/montajes del host y límites de recursos.
2. Crear los estados mediante los motores de reportes, recepción y correo.
   Todos terminan sus transacciones; no hay listeners ni workers externos.
3. Capturar cada base mediante `pg_dump` custom, conservando ACL, y registrar
   inventario de filas, SHA, estructura, restricciones, funciones, triggers,
   permisos efectivos y valores/estado de secuencias. Comprobar que el origen
   no cambió durante el dump. No es una transacción global entre bases.
4. Cifrar los dumps y originales. Rechazar paquetes alterados, clave incorrecta
   o conjunto incompleto antes de crear el destino.
5. Destruir el origen temporal. Sólo entonces crear el destino independiente.
6. Restaurar con `pg_restore --single-transaction --exit-on-error --no-owner` en
   bases vacías nuevas; restaurar originales en almacenamiento temporal separado.
   Nunca usar `--clean`, reemplazar una base existente ni desactivar triggers.
7. Comparar inventarios, reconstruir los propietarios desde el destino y probar
   lectura/replay sin recapturar ni duplicar. Un correo UNKNOWN sigue requiriendo
   conciliación; restaurarlo no provoca un reenvío automático.
8. Comprobar que la revocación actual y los permisos de lectura siguen vigentes,
   que los journals continúan inmutables y que una restricción eliminada se
   detecta como alteración. Retirar sólo recursos cuya propiedad se verificó.

Los roles de lectura ficticios se aprovisionan expresamente en ambos clústeres.
`pg_dump` de una base no respalda roles globales ni sus claves: el ensayo no
atribuye a la restauración la creación de usuarios corporativos. El destino queda
aislado durante toda la validación; no se inicia ningún servicio sobre una
restauración parcial. Un fallo destruye el destino temporal, no activa lo cargado.

## Correcciones encontradas por el ensayo

La restauración encontró funciones de recepción que dependían del search_path
de la sesión. Con el contexto restringido de `pg_restore`, el CHECK de concesiones
no podía resolver `factuez_received_write_canonical`. Se fijó dentro de las
funciones candidatas `search_path = pg_catalog, public, pg_temp`. Los objetos
temporales quedan al final para no sustituir tablas propietarias en validaciones.
No se retiraron permisos, CHECK, triggers ni auditorías.

El cambio está en los candidatos read/commands para instalaciones nuevas. **No se
ejecutó sobre QA ni existe migración automática de instalaciones existentes**;
su actualización requiere DDL aditivo revisado y respaldo previo del propietario.
Se preparó el [parche transaccional](../infra/b2b/received-recovery-search-path.patch.sql):
comprueba las 15 funciones y su propietario antes de cambiar la primera, limita
esperas y falla si falta el conjunto completo. No crea funciones ni concede
permisos. Antes de aplicarlo se deben conservar los valores previos de
`pg_proc.proconfig`; no corresponde revertir con RESET sin conocerlos.

También se corrigió el comparador del ensayo: PostgreSQL puede representar un
ACL por defecto como NULL o como lista explícita, y reescribir conversiones de
arrays equivalentes al restaurar un CHECK. Se comparan ACL efectivas y los
predicados completos reparsados por PostgreSQL en vistas TEMP; no se borran partes
del predicado para hacer coincidir cadenas. La prueba de eliminación de una
restricción exige que cambie el hash del esquema.

## Ejecución y límites de operación

```powershell
pnpm test:b2b-recovery
pnpm test:b2b-recovery:db
```

El runner requiere Windows con el contexto Docker Desktop local comprobado y la
imagen `postgres:17-alpine` instalada; utiliza su image ID local y `--pull never`.
No acepta URLs de BD, contenedores existentes, volúmenes, rutas de respaldos,
RUC, claves o archivos del cliente. Si el host no cumple los requisitos, falla;
no abre una conexión alternativa ni cambia Docker, firewall o la intranet.

### Resultado verificado

| Comprobación | Resultado |
| --- | --- |
| Cápsula cifrada, contexto, alteraciones y límites | 27 pruebas nuevas aprobadas. |
| Foco de recuperación/recepción/contratos | 396 pruebas aprobadas en cinco archivos; incluye las 27 anteriores. |
| Comandos de recepción con las funciones corregidas | Runner aislado: 54 casos aprobados. |
| Conector READ_ONLY y concesiones | Runner PostgreSQL nuevo: 16 casos aprobados. |
| pg_dump/pg_restore y reconstrucción de propietarios | Un ensayo completo aprobado; dos clústeres sucesivos y seis bases nuevas, en 105,30 segundos. Incluye parche idempotente y rechazo de esquema/propietario incorrecto. |
| Regresión general | 279 archivos aprobados, 11.886 pruebas aprobadas, cero fallos y una omisión condicional preexistente; 274,40 segundos. |
| Tipos del monorepo | 29 tareas correctas en 22 paquetes. |

Informes: `output/qa/b2b-phase9-recovery-db.json`,
`output/qa/b2b-phase9-recovery-focused.json` y
`output/qa/b2b-phase9-recovery-regression-final.json`. Los procesos finalizaron
con código cero y no quedaron contenedores con las etiquetas de los ensayos.
Los grupos se solapan; no se suman como total único. La omisión condicional de
`fiscal-batch.spec.ts` depende de `FACTUEZ_FISCAL_XSD_PYTHON`; no se contabiliza
como aprobada ni como evidencia de homologación fiscal.

No se cambió ningún servicio en 8091, ejecutó DDL sobre una base existente ni se
restauraron respaldos del cliente. El parche sólo se ejecutó en las bases nuevas
del ensayo; permanece preparado para una actualización autorizada posterior.

La restauración real requiere coordinar la pausa de todos los propietarios y
workers, incluidos sus estados ambiguos; el drain del listener de B2B-09 por sí
solo no acredita esa pausa. También faltan un plan integral de versiones y DDL,
roles/ACL operativos, claves/certificados, catálogo, retención y comprobaciones de
epochs/checkpoints. Un respaldo aislado de tres perfiles no autoriza corte,
activación fiscal o sustitución del historial real.

Continuación técnica: [cierre y recuperación de workers por propietario](B2B_FASE9_MANTENIMIENTO_WORKERS.md).
Corrige la espera de SMTP y webhooks y aporta estados de mantenimiento local;
el cerco de escritura global de una instalación real sigue pendiente.
