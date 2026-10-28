# B2B-03 — lectura y extracción privada

Fecha: 20/10/2026. **Código candidato y pruebas aisladas para 01/03; no
desplegado en el Kong/QA actual. No habilita SUNAT ni producción.**

## Resultado

- Fachada NestJS independiente `services/b2b-api-service`, sin acceso a las bases
  de negocio. Consulta a Identity, Billing, SUNAT y el propietario de exportación
  mediante HTTPS/mTLS, orígenes fijos y permisos vigentes en cada servicio.
- Identidad actual, capacidades y selección autorizada de emisor/sede/punto/serie.
  Cada permiso corresponde a una tupla completa; no se combinan listas de IDs.
- Detalle de 01/03, cliente, ítems, impuestos, totales y búsqueda por clave fiscal.
  Decimales como texto. Código 0/estado ACCEPTED no se convierte en aceptación
  fiscal verificada. 07/08/09/31 no se anuncian como fuentes empresariales listas.
- XML firmado/no firmado, ZIP de envío y CDR XML/ZIP originales, si existen y se
  puede acreditar su pertenencia. Para un CDR de lote se autorizan TODOS sus
  miembros, incluso los que estén fuera del filtro de fechas de la consulta.
- Descargas verificadas por tamaño/SHA-256, sin rutas de disco, URLs públicas,
  secretos ni sustituciones silenciosas de archivos. Auditoría obligatoria antes
  de entregar bytes; esquema B2bArtifactAudit candidato, no instalado en QA.
- PDF A4/ticket local bajo demanda: perfil visual vigente + hechos históricos
  congelados + caché temporal/versionada. No escribe PDFs ni altera XML/CDR o
  datos fiscales. Sólo perfiles locales preparados: los documentos con otro
  estado fiscal se rechazan hasta incorporar su prueba fiscal correspondiente.

## Cortes, exportaciones y feed

Se reutilizan los motores existentes IntegrationExports/IntegrationChanges,
BillingCapture y SunatRead mediante adaptadores B2B explícitos. El bearer B2B
NO se envía a las rutas ni guards de la audiencia readonly antigua.

Los registros persistentes del motor tienen un namespace derivado de audiencia,
aplicación, actor, revisión del grant y revisión de autorización del usuario.
Dos personas de la misma aplicación OIDC no comparten sus cortes/exportaciones.
La proyección preserva tuplas individuales, nunca permisos ALL. El adaptador de
compatibilidad admite hasta 100 tuplas por cliente; un alcance mayor se rechaza
explícitamente para que se configure un cliente más acotado, no se recorta.

El ensamblaje de producción del propietario exige una BD técnica NUEVA llamada
`b2b_exports_beta`, distinta de `integration_exports_beta`, y su propia clave de
cifrado. Se reutilizan las tablas técnicas de los scripts SQL del exportador;
no se aplican automáticamente ni se accede a las tablas fiscales desde allí.
No conectar dos workers de dominios diferentes a la misma cola/BD/vault.

- `GET /b2b/v1/documents`: corte breve en memoria; pierde su cursor al reiniciar.
- `GET /b2b/v1/document-cuts`: corte persistente, cifrado, paginado y con checkpoint
  inicial consistente de Billing/SUNAT. Reautoriza los hechos antes de responder.
- `GET /b2b/v1/document-cuts/{snapshotId}/documents/{id}`: detalle de ese corte.
- `POST /b2b/v1/exports`: reserva idempotente y preparación técnica asíncrona.
- `GET /b2b/v1/exports/{id}` y `/manifest` y `/content`: estado, manifiesto y ZIP.
- `GET /b2b/v1/changes`: cambios de diarios durables con checkpoint; no Socket.io
  ni un filtro por updatedAt. La pérdida de retención invalida el checkpoint.

En estas rutas se exige `issuerId` y `environment=BETA`. El cuerpo de exportación
no acepta issuerRuc/issuerId en filters: el servicio resuelve el RUC canónico del
issuerId autorizado de la consulta. Nunca se acepta PRODUCTION ni se lo transforma
silenciosamente en BETA. Tipos admitidos: 01/03.

Ejemplo de cuerpo, sin datos personales reales:

```json
{
  "filters": { "from": "2026-10-01", "to": "2026-10-20", "types": ["01", "03"] },
  "artifactKinds": ["SIGNED_XML", "CDR_XML"],
  "missingArtifacts": "REPORT",
  "dataFormat": "JSONL"
}
```

El envoltorio externo es `factuez.b2b.v1`; `payload` conserva y declara el contrato
`factuez.integration.v1` del motor reutilizado. Los JSONL/manifiestos del ZIP
conservan su versión original. No se cambió el contrato de /integration/v1.

## Límites y autorización

Token SERVICE con audiencia B2B; USER con OIDC introspectado y vínculo explícito.
Los scopes nuevos sólo existen como vocabulario hasta configurar una política
explícita de Identity: su constructor continúa activando únicamente context/catalog
por defecto. Leer archivos requiere documents+artifacts; exportar requiere
documents+exports:create/read y artifacts cuando se piden archivos. USER necesita
document.view y, para exportación, report.export. Las claves no pasan por el chat.

Cortes: hasta 10 000 filas, 16 MiB de captura, páginas de hasta 100. PDF/XML/ZIP
individual: hasta 10 MiB; paquete técnico: hasta 64 MiB. Exportación/feed: máximo
dos peticiones activas por núcleo. Se conservan las cuotas persistentes de Identity
(300 introspecciones/minuto por peer); un paquete con muchos archivos puede requerir
consultas más acotadas. No se han relajado cuotas para aparentar una prueba masiva.

El worker empaqueta sólo los hechos ya capturados y cifrados: no guarda bearer ni
necesita las credenciales SUNAT. Auditoría y reautorización siguen siendo obligatorias
para descargar un paquete ya preparado, incluso tras un reinicio o retry.

## Verificación y contratos

- Pruebas de recorrido real HTTPS/mTLS entre cinco listeners efímeros de loopback,
  con certificados, documentos y almacenes de negocio ficticios.
- Ensayos PostgreSQL en contenedores NUEVOS, tmpfs, sin red ni puertos publicados:
  cortes/cola/checkpoints técnicos reales; propietarios de negocio ficticios.
  No se consultó la BD ni los XML/certificados de clientes.
- El inventario AST cubre controladores reales, no infiere despliegue a partir
  de una declaración de ruta.
- Contrato completo candidato: [OpenAPI](b2b/openapi.candidate.v1.json).
  Los contratos read/drafts son subconjuntos de ese candidato; el diseño B2B-01
  continúa separado y contiene operaciones futuras que NO están implementadas.

Reproducir: `pnpm test:b2b-read`, `pnpm test:b2b-extraction`,
`pnpm test:b2b-extraction:db`. El último exige Docker y sólo crea/retira recursos
temporales etiquetados del ensayo. No ejecutar sus DDL sobre QA o bases fiscales.

## Lo que NO acredita esta entrega

No son endpoints disponibles todavía en localhost:8091/api-docs ni un despliegue
externo. Faltan el ensamblaje/rollout aprobado de los listeners, esquemas/roles/TLS
dedicados, alta de clientes y política de scopes, SSO/MFA real y piloto privado
de las fases posteriores. No se tocó Kong, firewall, numeración ni historial QA.
El maestro de clientes queda en B2B-08. La emisión local candidata 01/03 se completó
en [B2B-04](B2B_FASE4_BORRADORES.md), sin rollout ni envío oficial. Webhooks, notas
empresariales y guías siguen en sus fases; los contratos no equivalen a activación.
