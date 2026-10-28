# B2B-08 — Consulta de documentos recibidos y cliente de integración

Fecha: 24/10/2026. Primer bloque de B2B-08; no cierra toda la fase.
Estado: primer bloque terminado técnicamente y verificado en LOCAL/BETA.
No desplegado en el stack actual. B2B-08 completa sigue abierta.

**Documento histórico del primer incremento.** Para el avance posterior de
administración, escrituras, conectores, reportes y correo, consultar
[entrega técnica integrada B2B-08](B2B_FASE8_ENTREGA_TECNICA.md).
Los pendientes y cifras de este documento corresponden al primer incremento.

## Comportamiento implementado

Otra aplicación puede consultar las compras ya recibidas y asignadas a una sede,
ver el detalle completo de ítems, impuestos, referencias y totales extraídos del
XML, y descargar los originales XML, CDR y PDF del proveedor que existan.
No se convierte un registro de totales del SIRE en un XML con ítems inventados.
El PDF del proveedor se conserva exactamente; no es el PDF regenerado de ventas.

| Método | Ruta candidata | Resultado |
| --- | --- | --- |
| GET | `/b2b/v1/received-documents` | Página de documentos recibidos |
| GET | `/b2b/v1/received-documents/{id}` | Cabecera, cliente, ítems e impuestos del XML |
| GET | `/b2b/v1/received-documents/{id}/artifacts` | Inventario de originales con SHA256 y tamaño |
| GET | `/b2b/v1/received-documents/{id}/artifacts/{artifactId}/content` | Bytes exactos del original autorizado |

Todas requieren `environment=BETA`, `companyId`, `recipientRuc` y `branchId` en
la consulta, mTLS, Bearer y `X-FactuEz-Actor-Kind: SERVICE` o `USER`.
El listado requiere además `from` y `to`, admite tipo, `after` y límite de 1 a
100. El rango máximo es de 366 días. La paginación por ID es una lectura viva:
no promete un corte histórico inmutable ni un total global.

## Separación de servicios y permisos

El consumidor se conecta a la fachada B2B. Ésta consulta por HTTPS/mTLS el
propietario `received-documents-service`; no accede directamente a su base.
La ruta privada fija es `POST /internal/b2b/received-read` y no acepta destinos
remotos elegidos por el consumidor. Kong sigue siendo el punto de entrada del
despliegue autorizado; esta entrega no modifica su configuración actual.

Se exigen `b2b:received:read` y, para inventario/descarga, también
`b2b:received:artifacts:read`. Además existe una concesión independiente en el
propietario de recepción por cliente, actor, empresa, RUC destinatario, sede,
ambiente y revisión. Un permiso de ventas emitidas no concede acceso a compras.
SERVICE conserva `subjectId=null`; nunca se simula un administrador humano.
USER necesita permisos humanos actuales: `document.view` y `report.view`, y
`report.export` adicional para descargar originales.

Los documentos sin sede asignada quedan fuera de este contrato. Un cambio de
RUC o sede no amplía la concesión. Se revalida la identidad y se exige auditoría
antes de entregar datos. El administrador de políticas necesita una autoridad
privada de elevación de privilegios; sin ella, la administración falla cerrada.
El DDL es candidato y se ensaya solamente en bases nuevas aisladas.

## Integridad y límites fiscales

El detalle se vuelve a contrastar con el XML original, su SHA256 y la proyección
persistida. Los importes mantienen sus cadenas decimales originales. Los CDR se
vinculan al documento; los archivos se verifican por nombre, tipo, tamaño y SHA.
Esto acredita integridad y relación documental, no autenticidad SUNAT ni PKI.
Las respuestas mantienen `fiscalAcceptance=NOT_VERIFIED`,
`signatureTrust=NOT_VERIFIED` y `officialTrust=false`.

Los errores públicos tienen códigos finitos y no incluyen cuerpos XML,
credenciales, rutas de almacenamiento ni errores internos. Las descargas usan
adjunto, nombre Unicode seguro, `nosniff`, CSP y `private, no-store`.

## Cliente y conexión

El paquete Node/TypeScript `@factuez/b2b-sdk` y los ejemplos locales están en
`packages/b2b-sdk` y `docs/examples/b2b-received`. El consumidor aporta su CA,
certificado/clave mTLS, huella verificada del certificado del servidor y un
proveedor de Bearer vigente. No se distribuyen claves del emisor, no se desactiva
TLS y no se reintentan operaciones automáticamente. Cada descarga comprueba
manifiesto antes y después, tamaño, SHA256, nombre y origen de la respuesta.
Los ejemplos TypeScript y PowerShell/curl no hacen peticiones al importarlos.

## Ensayos y pendientes

Comprobaciones sobre el código integrado:

| Ensayo | Resultado |
| --- | --- |
| Wire adversarial, núcleo, HTTPS/mTLS, SDK e Identity | 456 pruebas aprobadas |
| Fuente, inventario y contratos candidatos de Swagger | 37 pruebas aprobadas |
| Propietario persistente en PostgreSQL NUEVO, temporal y sin red/puertos | 41 pruebas aprobadas |
| Compilación de contratos, transporte, SDK, recepción, Identity y API B2B | Correcta |
| Tipos globales | 29 tareas satisfactorias en 22 paquetes |
| Auditoría de fuente | 275 rutas declaradas; 80 operaciones candidatas, 48 GET |
| Regresión completa | 235 archivos aprobados; 10.310 pruebas aprobadas, una omisión condicional preexistente y cero fallos; 240,73 segundos |

La prueba HTTPS incluye SDK → fachada creada con `createB2bPhase8Application` →
propietario de recepción → parser real y originales ficticios. El ensayo SQL usa
importación real en una BD nueva, verifica actores, permisos, revocación,
auditoría inmutable, CAS concurrente, rollback y alteración de originales.
No quedaron contenedores temporales de ese ensayo.

Comandos reproducibles desde la raíz: `pnpm test:b2b-received` y
`pnpm test:b2b-received:db`. Este último exige el runner sintético, crea su propia
BD y no admite una URL de base existente. La regresión general usa
`pnpm exec vitest run --maxWorkers=2 --testTimeout=30000 --hookTimeout=30000`.
No se cuentan pruebas omitidas como aprobadas. La prueba PostgreSQL separada
tiene sus 41 casos ejecutados, sin omisiones.

Queda pendiente el resto de B2B-08: administración delegada y su panel,
maestros/clientes/productos, importación/asignación por API, conectores y tareas
de recepción automatizada, y los demás bloques del plan según su propietario.
El SDK 0.1.0 cubre este bloque de lectura; no promete métodos para todas las
operaciones futuras del plan.

| Paridad de B2B-08 | Estado de esta entrega |
| --- | --- |
| Listado y detalle por ítem de documentos recibidos asignados | Implementado y probado |
| XML/CDR/PDF originales de proveedores | Implementado y probado; no acredita PKI ni aceptación fiscal |
| SDK de lectura y ejemplos para consumidores | Implementado y probado, incluyendo ambos servicios por mTLS |
| Administración de aplicaciones/concesiones y panel delegado | Pendiente; sólo puerto privado de autoridad, sin altas públicas automáticas |
| Maestros, clientes, productos, turnos/caja, reportes y formatos por API | Pendiente de paridad por propietario |
| Importación, asignación y automatización SIRE/correo por API B2B | Pendiente; no se expone la sesión humana como integración |

El próximo bloque de B2B-08 es la administración delegada: políticas de alta,
revisión y revocación por aplicación/actor/alcance, con privilegios vigentes,
auditoría y panel que no revele secretos. No ampliar roles de SERVICE a ADMIN.

El despliegue, enrolamiento real, VPN/Kong y piloto privado pertenecen a B2B-09.
No se han ejecutado migraciones del stack actual, llamadas SUNAT/SIRE/OAuth,
correos reales, cambios de correlativos ni activación de producción.
