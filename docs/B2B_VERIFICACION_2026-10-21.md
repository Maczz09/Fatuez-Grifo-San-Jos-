# Verificación B2B — 21/10/2026

## Alcance

Continuación B2B-06 y dos bloques B2B-07: borradores 09/31 y preparación local
UBL 09 privado/04, sin habilitación fiscal.
Código candidato aislado, sin activar transmisión fiscal ni modificar el stack QA.
No es cierre de las fases fiscales históricas 2/3 ni habilitación oficial.

## Verificación actual — B2B-07, preparación local UBL 09

[Implementación, límites y fuentes](B2B_FASE7_PREPARACION_UBL09.md).
No es el productor fiscal completo ni añade cobertura de emisión 31 o lotes.

| Comprobación | Resultado |
| --- | --- |
| Perfil, propietario, wire y HTTPS/mTLS | 892 aprobadas en cuatro archivos |
| Contrato de preparación | Tres aprobadas adicionales |
| PostgreSQL real NUEVO | Diez grupos aprobados; cero fallos |
| XML de preparación con XSD oficial fijado | Válido estructuralmente; cinco controles negativos correctos |
| Tipos del monorepo | 28 tareas correctas en 21 paquetes |
| Inventario de fuente | 245 rutas declaradas; 63 operaciones públicas candidatas, 38 GET |
| Regresión general final | 187 archivos; 8.086 aprobadas, una omitida, cero fallos |

Las 895 pruebas nuevas del bloque (892 más tres del contrato) están incluidas en
esa regresión. La omisión XSD condicional anterior se mantiene; no se añadió una
omisión nueva. El ensayo estructural específico de esta guía se ejecutó realmente
y aprobó, no se contó como SKIP.

El XSD se ejecutó con lxml, dependencias sólo del ZIP local cuyo SHA-256 está
fijado y sin red. El ensayo positivo usa un número propuesto ficticio no reservado;
los negativos comprueban ID ausente, orden incorrecto, DTD/entidades e importaciones
HTTP o fuera del paquete. La carpeta temporal propia fue eliminada. El primer
fallo encontró ExtensionContent vacío; el XML sin firma ya no incluye esa extensión.
No se insertó una firma falsa para pasar el esquema.

La comparación adversarial del wire halló siete casos de IDs/fechas que el core
no podía producir y se rechazaron mediante validación canónica y mínimo temporal
coherente con Lima. Los hashes recalculados no sustituyen validación ni procedencia.

El ensayo PostgreSQL emplea los lectores reales de borrador y emisor, con autoridad
ficticia explícita. Comprueba repetición/reinicio, estados, ETags, revocación y
cambio transaccional de razón social/configVersion. Compara todas las tablas;
cambios deliberados se revierten antes de comparar. Preparar no crea operaciones,
escrituras fiscales, numeración ni Outbox. El contenedor nuevo propio se eliminó.

HTTP prueba propietario/fachada en HTTPS/mTLS loopback, revisiones, límites,
permisos, falsificación de respuesta y módulos/capacidad presentes/ausentes.
Su propietario es un double: no se presenta como piloto integrado de SUNAT.
La fachada utiliza un contrato wire independiente, no importa el motor fiscal
ni comparte la base Billing.

La revisión de anexos y del portal técnico registra referencias normativas;
las reglas completas XLSX/XSL de septiembre/octubre de 2026 NO se importaron
ni ejecutaron. El mapa fiscal de establecimientos, clasificación/catálogos,
reserva, firma/PKI, XSD firmado y transporte/CDR siguen explícitamente bloqueados.
No se accedió a secretos, bases existentes o configuraciones del cliente, no se
desplegó en QA/Kong y no hubo SOAP, OAuth ni otros envíos oficiales o reales.

## Verificación anterior — B2B-07, borradores de guías

[Implementación, API y límites de este primer bloque](B2B_FASE7_GUIAS_BORRADORES.md).
La fase 7 completa permanece en curso: no hay emisión/archivos de guías ni RC/RA
empresariales activados por esta entrega.

| Comprobación | Resultado |
| --- | --- |
| Modelo, autoridad, agregado, adaptadores y HTTPS | 675 aprobadas en cinco archivos |
| PostgreSQL real NUEVO | 30 grupos aprobados; cero fallos |
| Tipos del monorepo, repetidos tras corrección | 28 tareas correctas en 21 paquetes |
| Contratos e inventario regenerados | 243 rutas declaradas; 62 operaciones públicas candidatas, 38 GET |
| Regresión completa | 182 archivos; 7.191 aprobadas, una omitida, cero fallos |

La omisión XSD condicional existente no es nueva. Los resultados de las entregas
anteriores se conservan debajo como registro histórico, no son el conteo actual.

La revisión encontró un caso P2 de recibos persistidos inconsistentes: el replay
validaba cuerpo/hash, pero no todos los metadatos de respuesta. Se corrigió y se
añadieron once casos que alteran esquema, estado, revisión, fechas, acción y actor.
También se repitió el caso en PostgreSQL con alteraciones transaccionales revertidas.
Replay y consulta de operación fallan sin reparar ni reescribir el historial.

El ensayo persistente comprueba 09/31, CAS, replay tras reinicio, concurrencia,
aislamiento por cliente/usuario/punto, revocación y cambios de catálogo después
de escribir, rollback, triggers, paginación y corrupción. Document, SeriesCounter,
Outbox y DailySummary permanecen idénticos a la captura previa del fixture.
BD nueva etiquetada/tmpfs, sin red/puertos; el contenedor propio fue eliminado.
No se leyó ni migró ninguna base existente.

HTTP comprende dos aplicaciones Nest con HTTPS/mTLS real loopback y la fábrica
candidata con guías presentes/ausentes. Los propietarios de negocio son doubles;
la autorización del ensayo PostgreSQL es ficticia explícita. La suite de autoridad
sí incluye la autenticación real del núcleo Identity y usuarios delegados, pero
estos ensayos separados no constituyen un piloto fiscal integrado.

No se desplegó el candidato, publicaron rutas en Kong/Swagger activo, crearon
registros en QA, compartieron bases entre servicios, alteraron correlativos o
solicitaron certificados/credenciales. No hubo tráfico SUNAT, OAuth, correos ni
webhooks externos. READY conserva `authorizedForTransfer:false` y referencias
`NOT_VERIFIED`; no sustituye PKI, catálogos oficiales ni aprobación de traslado.

## Verificación anterior — productor empresarial y journal dinámico V2

[Implementación, API, perfiles y límites](B2B_FASE6_PRODUCTOR_Y_JOURNAL_V2.md).

| Comprobación | Resultado |
| --- | --- |
| Nuevo bloque de reglas/productor/preparación/HTTPS | 326 aprobadas en cuatro archivos |
| Contrato exacto del nuevo productor | Cinco aprobadas adicionales |
| Journal PostgreSQL real NUEVO | 42 grupos aprobados; sin fallos |
| Tipos del monorepo | 28 tareas correctas en 21 paquetes |
| Contratos e inventario | 231 rutas declaradas; 55 operaciones públicas candidatas |
| Regresión completa final | 177 archivos; 6.516 aprobadas, una omitida, cero fallos |

Los 42 grupos persistentes comprueban reservas después de liquidación, efecto
único, concurrencia de solicitud/operación, recibos tras reinicio, NC y ND por
fachada empresarial, revocación y cambio de evidencia después de escribir,
rollback de nota/correlativo/Outbox/journal, integridad de importes físicos,
append-only, rechazo sin liberar saldo y conservación del original. BD nueva
etiquetada, tmpfs, sin red/puertos; limpieza sólo del contenedor propio.

La revisión final detectó y corrigió tres casos: contraste físico incompleto,
incoherencia del vínculo humano del creador y orden por UUID con fechas iguales.
Las regresiones adicionales comprueban 12 alteraciones físicas entre original y
nota (fecha, operación y datos del cliente), inyección de un humano en SERVICE y
tres NC de cantidad 0,5 con fecha idéntica y UUID descendentes. Sus dependencias
se reconstruyen sin reescribir snapshots. Tras los cambios se repitieron tipos
y TODA la suite: 6.516 aprobadas, una omitida, cero fallos. Se confirmó que no
quedaran contenedores temporales con la etiqueta del ensayo.

El HTTP nuevo incluye dos aplicaciones Nest con HTTPS/mTLS real loopback y la
fábrica candidata con módulo explícito. Los permisos/datos/efectos son fixtures;
los ensayos persistentes usan evidencia ficticia sellada, no CDR oficial ni PKI
del cliente. Las verificaciones criptográficas y del puente propietario de los
bloques anteriores permanecen separadas: no se declara un piloto oficial integral.

Se añadió un productor empresarial NUEVO, sin retirar los guards del laboratorio,
V1, retenciones sintéticas, TLS o producción. No se aplicó DDL en QA/cliente ni se
leyeron sus credenciales, desplegaron rutas, reiniciaron servicios, cambiaron
series/correlativos existentes o enviaron documentos/correos reales.

## Verificación anterior — puente privado de evidencia B2B-06


[Implementación, integración y límites](B2B_FASE6_PUENTE_PRIVADO_EVIDENCIA.md).

| Comprobación | Resultado |
| --- | --- |
| Regresión completa final | 172 archivos; 6.185 aprobadas, una omitida, cero fallos |
| Nuevo bloque del puente | 192 aprobadas en cuatro archivos |
| HTTPS/mTLS bidireccional local | 24 aprobadas, incluidas en el bloque anterior |
| Tipos del monorepo | 28 tareas correctas en 21 paquetes |
| Reserva con frontera de evidencia/autoridad | 16 grupos PostgreSQL aprobados |
| Commit financiero y lector/alcance propietario | 19 grupos PostgreSQL aprobados |
| Evidencia individual y ZIP de solicitud | Ocho grupos PostgreSQL aprobados |
| Inventario regenerado | 227 rutas declaradas; 52 operaciones públicas candidatas, sin activación |

Dos rutas nuevas exclusivamente privadas, con callback de autorización y ports
Billing ensamblados sin importar el motor SUNAT ni compartir Prisma. El lector de
comandos se ensayó con Prisma real en la BD nueva y sin efectos sobre originales,
ledger, correlativos u Outbox. Se repitieron los tres ensayos persistentes después
de compilar; sus 43 grupos aprobaron y se retiraron los recursos desechables propios.

HTTP usa CA/certificados efímeros y TLS real loopback. Autoridad/catálogo y política
criptográfica son fixtures explícitos: no es SSO o PKI oficial. El ensayo PostgreSQL
no conecta Identity ni SUNAT oficiales. La suite completa también conserva la
cobertura anterior de autoridad pareada, identidad y grants. No se combinan estos
ensayos separados para afirmar un piloto fiscal de punta a punta.

No se consultaron datos/credenciales del cliente, desplegaron módulos, modificaron
Kong/Swagger activo o enviaron documentos/correos/callbacks reales. Las cuotas,
TLS, aislamiento, gates fiscales y permisos predeterminados no se relajaron.

Siguiente: reservas dinámicas y productor empresarial; autoridad de lotes/historial
cruzado, materialización de versiones, bajas y recuperación auditada continúan
pendientes. El puente para un par de series está implementado como candidato;
B2B-06 sigue parcial, sin salto a B2B-07.

## Verificación anterior — composición y resultados B2B-06

[Detalle de implementación y límites](B2B_FASE6_COMPOSICION_Y_RESULTADOS.md).

| Comprobación | Resultado |
| --- | --- |
| Regresión completa final | 168 archivos; 5.993 aprobadas, una omitida, cero fallos |
| Nuevo bloque de composición | 256 comprobaciones incluidas en la regresión final |
| Repetición focalizada final de límites y ensamblaje | 95 aprobadas en cuatro archivos |
| Reserva sintética con evidencia/autoridad | 16 grupos PostgreSQL aprobados |
| Commit financiero propietario candidato | 18 grupos PostgreSQL aprobados |
| Evidencia individual y ZIP de solicitud | 8 grupos PostgreSQL aprobados |
| Tipos del monorepo | 28 tareas correctas en 21 paquetes |
| Contratos/inventario regenerados | 225 rutas declaradas, 52 operaciones públicas candidatas; sin activación |

Se corrigió una colisión concurrente real del recibo financiero `planId`, mediante
reintento acotado de la transacción completa y revalidación. El ensayo persistente
se repitió después de compilar. También se añadió vinculación explícita entre
la evidencia sellada y el documento exacto; una prueba válida de otro documento
se rechaza.

La primera regresión detectó una aserción de fuente que confundía un import
exclusivamente de tipos con activación. Se ajustó para admitir sólo referencias
borradas por TypeScript en el ensamblaje aislado, manteniendo prohibidos los
constructores/registros de ejecución y comprobando los AppModule. La repetición
completa posterior pasó; no se retiraron gates fiscales.

Los 42 grupos persistentes usan bases nuevas etiquetadas, tmpfs y sin red/puertos;
se retiraron sus contenedores y se comprobó que no quedaran recursos propios.
Proofs criptográficos de PostgreSQL: fixtures, no PKI oficial. Firmas efímeras
reales: pruebas separadas con política de confianza controlada. No se afirma
un circuito oficial integral ni un despliegue B2B.

Pendientes de código: puente privado autenticado entre propietarios, reservas
dinámicas posteriores al ledger, versiones RC2/procedencia SERVICE de lotes,
productor empresarial y recuperación/conciliación auditada de resultados ambiguos.
No se cierra B2B-06 ni se cambia el gate de las fases fiscales históricas 2/3.

## Verificación anterior — evidencia propietaria individual

| Comprobación | Resultado |
| --- | --- |
| Regresión completa | 163 archivos; 5.753 pruebas aprobadas, 1 omitida; 0 fallos |
| Pruebas nuevas de evidencia | 72 aprobadas; contratos, XMLDSig y lector propietario |
| Repetición final con regresión RC e inventario | 220 aprobadas en 5 archivos |
| Persistencia en PostgreSQL nuevo aislado | 8 grupos aprobados; sin leer QA |
| Tipos del monorepo | 28 tareas correctas en 21 paquetes |
| Superficie de API | Conserva 225 rutas declaradas y 52 operaciones públicas candidatas; runtime deshabilitado |

Los ocho grupos persistentes comprueban ensamblaje de sólo lectura, reinicio,
rechazo de intentos ambiguos, vínculo CDR-log/operación/artefacto, ausencia de XML,
cambio de versión durante la comprobación, fecha/RUC y ausencia de efectos.
Se repitieron después de compilar los últimos controles defensivos.

En las pruebas XMLDSig se generan claves/certificados efímeros y se verifican
firmas reales; la política de cadena/CRL es un puerto de prueba. En PostgreSQL
los puertos criptográficos son fixtures: ese ensayo no acredita PKI ni CDR oficial.
No se equiparan estas garantías ni se presenta un estado persistido como firma.

El contenedor temporal propio, tmpfs, sin red ni puertos, fue retirado. No quedaron
recursos de ese ensayo. No se cambiaron ventas, esquemas, credenciales, permisos
o contadores del cliente; no hubo emisión, correo o transporte oficial.

## Resultados anteriores — autorización de series

| Comprobación | Resultado |
| --- | --- |
| Regresión Vitest completa | 160 archivos; 5.681 pruebas aprobadas, 1 omitida; 0 fallos |
| Revisión de tipos del monorepo | 28 tareas correctas en 21 paquetes |
| Pruebas nuevas de autoridad y HTTPS/mTLS | 45 aprobadas |
| Repetición final de autoridad, HTTPS/mTLS e inventario | 69 aprobadas en 3 archivos |
| Persistencia de permisos en PostgreSQL real | 10 grupos aprobados; dos bases nuevas de propietarios separados |
| Inventario actualizado de fuente | 30 capacidades, 109 acciones planificadas, 225 rutas declaradas, 20 pantallas |
| API pública candidata | Conserva 52 operaciones; no se añadieron endpoints públicos de emisión de notas |

La revisión de fuente y los contratos se regeneraron y verificaron después de
incorporar el consumidor de autoridad de Billing. Se recompilaron los contratos,
Identity y Billing antes del ensayo final persistente.

## Diez grupos persistentes

1. Ausencia de concesión automática y de efectos fiscales.
2. Persistencia/reinicio con JWT SERVICE verificado realmente.
3. Edición concurrente de permisos: una ganadora y un conflicto de revisión.
4. Rechazo de punto/RUC/tipo/familia incorrectos y maestros inactivos.
5. Historial inmutable y cabeza monotónica protegidos por PostgreSQL.
6. Fallo de auditoría revierte también revisión y cabeza del permiso.
7. Rotación del cliente invalida tokens y exige concesión explícita nueva.
8. Vínculo USER, roles/permisos y asignación de serie de nota leídos de Identity.
9. Permisos independientes de factura/boleta y NC/ND; sin producto cartesiano.
10. Documentos, Outbox y correlativos Billing quedan intactos.

El verificador externo OIDC de ese ensayo USER es un fixture; no se afirma un
SSO/MFA desplegado. Las pruebas HTTPS usan una CA y certificados efímeros ficticios,
validación TLS estricta y peers distintos; no usan certificados de empresas.

## Aislamiento y límites

Las bases son nuevas y ficticias dentro de un contenedor propio etiquetado,
tmpfs, `--network none`, sin puertos publicados. El ensayo retiró sólo sus
recursos desechables; no se borró historial del cliente.

No se consultaron ni modificaron credenciales, certificados, grants, esquemas,
ventas o contadores QA. No hubo SOAP/REST/OAuth oficial, correo ni callbacks
reales, migración aplicada, cambio de Kong o despliegue.

## Siguiente dependencia

Resolvedor propietario individual 01/F07/F08 preparado como candidato de sólo
lectura. Falta componer RC/miembros, paquete despachado y original/historial de
créditos con preparación del comando, autorización fresca, reserva financiera
y efectos aceptados/rechazados.
El productor fiscal y la conciliación de respuestas ambiguas siguen pendientes.
Ningún permiso ni resultado de estas pruebas autoriza a retirar sus bloqueos.
