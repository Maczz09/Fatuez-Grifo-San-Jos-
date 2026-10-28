# B2B-07 — Preparación local UBL de guía 09

21/10/2026. Segundo bloque candidato, sin despliegue ni transmisión.
**No cierra fase 7 ni constituye emisión fiscal.** Continúa los
[borradores 09/31](B2B_FASE7_GUIAS_BORRADORES.md), sin transformar el laboratorio
GRE en productor empresarial ni retirar sus restricciones.

Continuación del 22/10: [mapa local de establecimientos y guard estricto](B2B_FASE7_MAPA_ESTABLECIMIENTOS.md).
Los resultados de este documento corresponden al segundo bloque, no a los
conteos posteriores.

## Alcance implementado

Perfil independiente `FACTUEZ-BETA-GRE09-PRIVATE04-PREPARATION-v1`:
guía 09, transporte privado 02, motivo 04, un remitente/destinatario del mismo
emisor, establecimientos distintos, sin referencias relacionadas ni bienes
declarados regulados. Exige identificación del conductor, licencia, vehículo,
peso, ítems y cantidades decimales exactas. No implica verificación de registros
del MTC ni de la clasificación real del producto.

Se separan dos funciones:

1. Preparación autorizada de **sólo lectura**: toma un borrador READY en su revisión
   exacta y el RUC/razón social desde el propietario Billing, no de una declaración
   del consumidor. Revalida permisos, datos del emisor y contenido antes de entregar
   el plan. El borrador, sus operaciones y los contadores no se modifican.
2. Constructor puro de XML de preparación: recibe un plan íntegro y una identidad
   **propuesta, no reservada** en un ensayo interno. Produce UBL sin firma, marcado
   PRUEBA LOCAL/SIN VALIDEZ/NO AUTORIZA TRASLADO. No es un original fiscal ni se
   ofrece como descarga de XML aceptado. El endpoint público NO recibe series o
   números propuestos ni devuelve XML, ZIP, firma o CDR.

La guía 31, transporte público, otros motivos, referencias y bienes declarados
regulados se rechazan en esta preparación. Siguen disponibles sólo como planes
de negocio en el módulo anterior; no se declara cobertura fiscal de esos casos.

## Endpoint candidato

`POST /b2b/v1/guide-drafts/{id}/preparation`

Cabeceras: Bearer, `X-FactuEz-Actor-Kind: SERVICE|USER`, `If-Match: "vN"`.
Cuerpo exacto: `{ "binding": { ...contexto y concesión explícita de guía... } }`.
Sin query, `Idempotency-Key` ni creación de una nueva operación: es preflight
de lectura y repetirlo sin cambios produce el mismo plan/hash.

Requiere `b2b:guides:read` y `b2b:documents:read`, concesión de guía vigente y
alcance humano `document.view`. No amplía permisos de emisión. Los cambios de
revisión producen 412; borrador no READY o perfil no cubierto, 409. Los fallos de
autorización prevalecen sobre revelar información del perfil o del emisor.

RPC privada fija: `/internal/b2b/prepare-guide`, HTTPS/mTLS con pares fijados.
La fachada verifica forma, vínculo, hashes y flags, pero no importa el motor
SUNAT ni accede a la base Billing. Módulos y capacidad `guide-preparation`
opcionales; sólo aparecen al ensamblarlos explícitamente. No se activaron en
`main`, AppModule, Kong o Swagger del stack QA existente.

## Controles que permanecen cerrados

La respuesta devuelve explícitamente pendientes: reserva transaccional del número,
mapa de establecimientos, catálogos/clasificación de bienes, reglas XSL oficiales,
XSD sobre XML firmado, firma/PKI y transporte/CDR. Todos los indicadores de
emisión, reserva, firma y traslado permanecen falsos.

La tabla Branch actual no contiene vínculo fiscal completo ubigeo–establecimiento;
no se inventa ese mapa a partir de su código comercial ni dirección. Un consumidor
no puede convertir datos declarados en evidencia mediante flags o un hash correcto.
La lectura del emisor usa sólo id/RUC/razón social/BETA/configVersion; no toca
certificados, claves SOL, OAuth ni configuración del grifo.

## Fuentes y verificación estructural

La revisión de anexos PDF se usó para contrastar la estructura y separar el perfil
acotado de otras modalidades, no para afirmar cobertura de toda la normativa.

- [Anexo VII de RS 123-2022](https://www.sunat.gob.pe/legislacion/superin/2022/anexo-123-2022.pdf).
- [Modificación de RS 240-2024](https://www.sunat.gob.pe/legislacion/superin/2024/anexo3-000240-2024.pdf).
- El [portal técnico GRE](https://cpe.sunat.gob.pe/node/116) publica reglas del
  25/09/2026 y XSL actualizado al 01/10/2026. Se registraron esas referencias;
  **no se importaron ni ejecutaron esas reglas completas en esta entrega**.

El ensayo XSD usa el ZIP oficial ya versionado en el repositorio y SHA-256 fijado,
sin red ni imports externos, en una carpeta temporal propia. Comprueba estructura,
escapado, orden y negativos; no certifica validez fiscal ni aceptación SUNAT.
El primer ensayo detectó una extensión vacía inválida; se retiró de la
representación sin firma en lugar de insertar una firma ficticia.

Resultados finales y comandos reproducibles:
[verificación B2B](B2B_VERIFICACION_2026-10-21.md).

Verificaciones propias: 892 pruebas de perfil/propietario/wire/HTTPS más tres
del contrato; diez grupos PostgreSQL nuevos, XSD de preparación válido y cinco
controles negativos de estructura/DTD/importaciones. Tipos: 28 tareas correctas
en 21 paquetes. Estos ensayos son separados, no un piloto fiscal integrado.
Regresión general final: 187 archivos, 8.086 aprobadas, una omisión condicional
preexistente y cero fallos.

Reproducción local:

- `pnpm test:b2b-guide-preparation`: pruebas del nuevo bloque.
- `pnpm test:b2b-guide-preparation:xsd`: reconstruye dependencias y valida un XML
  ficticio contra el paquete fijado, sin red. Exige Python con lxml; no oculta
  como SKIP la falta de ese requisito.
- `pnpm test:b2b-guide-preparation:db`: reconstruye dependencias y usa únicamente
  un PostgreSQL nuevo, etiquetado, tmpfs, sin red/puertos. No acepta URL de BD.

## Siguiente trabajo

Completar el mapa fiscal persistente de establecimientos, clasificación/catálogos
versionados y reglas vigentes; productor con reserva y journal atómicos, perfiles
31/público y referencias verificadas, firma/PKI, originales y transporte/CDR.
Después continúan lotes RC/RA y recuperación ambigua de despacho. No se habilita
un productor oficial quitando la advertencia del XML de preparación.
