# B2B-09 — Fuente propietaria de evidencia firmada 01/03: frontera pendiente

Revisión independiente, 27/10/2026. Este documento no instala código, esquemas ni
rutas; no declara operativa la fuente y no autoriza envío o consulta externa.

## Hallazgos

- `BatchMemberPrivateOwnerPort.load(handle)` exige una versión exacta inmutable,
  paquete firmado histórico y revisiones de la evidencia propietaria. El productor
  de `batch-member-evidence.repository.ts` además verifica firma y ZIP, contrasta
  la fila fiscal y relee la fuente antes de confirmar la captura.
- `FiscalDocument` guarda un snapshot y su digest, pero el esquema de artefactos
  identifica documentos y tipos; el consumidor usa `documentId_kind` para upsert.
  Esa unicidad no constituye un historial de versiones firmado e inmutable.
- `DocumentIssuedConsumer` genera XML sin firmar; `LocalXmlValidation` está
  explícitamente separado de artefactos fiscales y emplea un perfil local. Ninguno
  demuestra por sí solo un paquete firmado fiscal propietario histórico.
- El repositorio de aceptación individual exige estado, envío y CDR congruentes,
  y obtiene la huella de un manifiesto de envío. Su lectura actual y su hash de
  revisión no son por sí mismos un registro histórico de versiones firmado.
- El registro candidato `b2b_sunat_batch_member_evidence_version` almacena una
  captura después de verificar una fuente OWNED; no crea la procedencia de esa
  fuente. Un hash protege la detección de cambios, no acredita quién creó datos.
- El contrato del miembro exige también una atestación privada completa del
  catálogo de créditos. Para originales exige entradas vacías; no se puede afirmar
  esa completitud simplemente porque la consulta actual no encuentre créditos.

## Bloque previo necesario para una fuente real

Definir y revisar una escritura privada en el límite de producción firmado, con
identidad de documento y versión asignada por el propietario, snapshot congelado,
ligadura BETA/emisor/empresa/sede/punto/serie, huella y digest, y referencias
inmutables al XML y ZIP originales. Debe haber autoridad propietaria demostrable
sobre esos campos, publicación atómica o protocolo recuperable para artefactos y
registro, rechazo de conflictos y de referencias ausentes, y lecturas históricas
por handle exacto sin fallback a la fila actual. La verificación debe volver a leer
el registro y bytes, verificar XMLDSig, identidad/cadena y política de revocación,
además del contenido y límites del ZIP. Si hay aceptación, su evidencia y fence
necesitan su propio origen propietario y verificación; no inferir aceptación ni
no-entrega de una ausencia o estado mutable.

Separadamente, hace falta una autoridad de catálogo que cubra todas las notas y
reservas, con revisión estable y completitud demostrable. El contrato vigente no
permite sustituirla por una lista vacía arbitraria. El diseño también debe resolver
carreras entre captura, firma, catálogo y cambios de estado; relecturas aisladas
no prueban atomicidad global sin un cerco o protocolo equivalente.

Una migración y permisos específicos, protección contra update/delete y separación
de escritores requieren revisión independiente antes de cualquier instalación.
Nunca usar pruebas locales, DTO públicos, metadatos de cliente, certificados de
prueba, hashes sin procedencia o `latest` para rellenar huecos históricos.

## Pruebas necesarias antes de integrar

Con datos y PKI exclusivamente sintéticos y almacenamiento aislado: casos positivos
01 y 03; handles y versiones cruzados, inexistentes o sustituidos; emisor, sede,
punto y serie incorrectos; XML/ZIP/huella/digest alterados; aceptación o catálogo
incompletos; duplicados, cambios concurrentes, fallos parciales y recuperación;
intentos de mutación del registro; y aislamiento entre emisores. Confirmar que
los rechazos no producen captura persistente ni efectos externos. Las pruebas
existentes con owner y SQL simulados no demuestran procedencia propietaria real,
inmutabilidad de almacenamiento, ni integración completa.

Las guardas existentes para 07/08 permanecen vigentes. Este bloque identifica
condiciones y brechas; no implementa una fuente ni cierra B2B-09.