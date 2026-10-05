# Guía de migración: RestoApp → FactuEz Grifo San José

## Nota histórica de descubrimiento inicial

En la revisión de 2026-09-11 el workspace no contiene fuentes de RestoApp ni un
emisor existente; sólo existen directorios de infraestructura vacíos y varios
nombres `.yml` creados como carpetas. Por eso esta guía define el procedimiento
y los artefactos de salida, pero el inventario de clases/tablas concretas debe
completarse cuando se incorpore el repositorio original.

La nota anterior describe la revisión inicial, no el estado actual. El
inventario posterior está en [inventario de extracción](INVENTARIO_RESTOAPP_FACTURACION.md)
y el avance vigente en [estado de migración](ESTADO_MIGRACION.md).

## Principio de migración

Aplicar **Strangler Fig** con un anti-corruption layer (ACL). RestoApp deja de
conocer XML, certificados, SOAP, REST, CDR, PDF y correo. Como máximo transforma
una venta cerrada a un comando fiscal versionado y consulta su estado. Nunca se
permite que ambos emisores envíen el mismo documento a SUNAT.

```text
RestoApp venta/mesa -> ACL RestoApp -> POST FactuEz /api/v1/documents
                                      -> documentId + número + estado
FactuEz -> SUNAT / CDR / PDF / correo
```

Para Grifo San José, la UI de caja/pista será la PWA FactuEz. El ACL se conserva
sólo si hay datos/operaciones de RestoApp que deban convivir durante el corte.

## Fase 0 — Descubrimiento y congelamiento

Crear un inventario trazable:

- módulos que calculan IGV, descuentos, totales y redondeos;
- plantillas/generadores XML por tipo;
- firma PKCS#12, ubicación de certificados y manejo de contraseñas;
- cliente SOAP, endpoints, timeouts y parser de errores/CDR;
- correlativos, series, anulaciones y resúmenes diarios;
- generación de QR/hash/PDF y drivers de impresión;
- envío SMTP y reintentos;
- tablas, archivos, jobs/cron y estados existentes;
- flags Beta/Producción y cualquier dato fiscal hardcodeado.

Guardar ejemplos anonimizados de entrada, XML firmado, ZIP, CDR y PDF para cada
caso real. Calcular SHA-256; serán golden masters. No copiar secretos al nuevo
repositorio.

Salida: `migration/inventory.csv`, diagrama de dependencias, matriz de casos y
lista de deudas/bugs conocidos. Los comportamientos defectuosos no se convierten
automáticamente en requisitos.

## Fase 1 — Modelo canónico y pruebas de caracterización

Definir `IssueDocumentCommandV1` en `packages/contracts`, independiente de
mesas/restaurante:

```ts
type IssueDocumentCommandV1 = {
  commandId: string;
  origin: { system: 'RESTOAPP' | 'FACTUEZ'; id: string };
  type: '01' | '03' | '07' | '08' | '09';
  emissionPointCode: string;
  shiftId?: string;
  issueDate: string;
  currencyCode: 'PEN' | 'USD';
  customer: {
    identityType: string;
    identityNumber: string;
    legalName: string;
    address?: string;
    email?: string;
  };
  items: Array<{
    sku?: string;
    description: string;
    unitCode: string;
    quantity: string;
    unitPriceWithTax: string;
    taxAffectationCode: string;
  }>;
  reference?: {
    documentType: '01' | '03';
    series: string;
    number: string;
    reasonCode: string;
    reason: string;
  };
};
```

Los decimales viajan como strings. El servidor recalcula; no confía en totales
del cliente. Crear pruebas que ejecuten el emisor antiguo con fixtures y
registren resultados sin invocar SUNAT.

## Fase 2 — Extraer el núcleo fiscal

Clasificar cada pieza del emisor anterior:

| Pieza RestoApp | Destino FactuEz | Tratamiento |
|---|---|---|
| Cálculo fiscal correcto | `packages/sunat-core` | Reescribir como función pura + tests |
| Catálogos SUNAT | `packages/sunat-core/catalogs` | Importar con fuente/fecha/versionado |
| Builders XML | `packages/sunat-core/ubl` | Separar por tipo, sin I/O ni secretos |
| Firma digital | `sunat-service/infrastructure/crypto` | Encapsular detrás de puerto |
| SOAP/CDR | `sunat-service/infrastructure/sunat` | Adaptador + errores tipados |
| GRE REST | Adaptador nuevo | No reutilizar SOAP antiguo |
| Correlativos | PostgreSQL `SeriesCounter` | Sustituir contadores en memoria/archivo |
| PDF/QR | `packages/pdf-renderer` | Render desde snapshot fiscal |
| Correo | `mailer-worker` | Job idempotente después de commit |
| Datos de mesa/mozo/comanda | No migrar al dominio fiscal | Sólo metadata externa si auditable |

No se debe “mover carpetas” conservando acoplamientos. Primero se define el
puerto, después se adapta código útil y finalmente se eliminan dependencias a
RestoApp.

## Fase 3 — Persistencia y migración histórica

Preparación disponible: [conciliación dry-run de desarrollo](ETAPA3_PREPARACION_HISTORICOS.md).
Verifica metadatos normalizados sin acceder al origen ni importar datos. Ahora
se desarrolla etapa 3 en paralelo por autorización del usuario: también hay
[integridad de bundle y ensayo reanudable en memoria](ETAPA3_BUNDLE_Y_ENSAYO.md).
Estas dos herramientas no son un importador persistente. El siguiente incremento
añadió [contrato completo y adaptador de archivo histórico separado](ETAPA3_PERSISTENCIA_Y_RESTAURACION.md):
unique fiscal/origen, checkpoint transaccional, archivos y restauración probados
en PostgreSQL nuevo con datos ficticios. No escribe `Document`, no tiene endpoint
desplegado y no admite RUC/datos reales. Los pasos de importación/corte siguientes
son requisitos futuros, no acciones ejecutadas sobre el cliente.

El incremento más reciente prepara [consulta protegida y conciliación](ETAPA3_CONSULTA_Y_CONCILIACION.md):
API NestJS de sólo lectura, JWT RS256 y autorización vigente, rol lector y
comparación exacta por RUC/moneda/tipo/serie. Probado exclusivamente con identidad
HTTP ficticia y PostgreSQL nuevos. El fragmento Kong es candidato, no configuración
activa; no hay UI histórica desplegada ni lecturas de datos reales.

Antes de integrar un importador real con una copia autorizada:

1. Exportar series/correlativos y documentos históricos desde una réplica o
   backup, nunca desde tablas productivas mutadas por el importador.
2. Normalizar tipo, serie, número, fecha con zona Lima, documento del cliente y
   moneda.
3. Copiar XML/ZIP/CDR/PDF conservando nombre original y SHA-256.
4. Insertar `originSystem='RESTOAPP'` + `originId`; el unique evita duplicados al
   reanudar.
5. Importar historial como inmutable y **sin crear outbox de envío**.
6. Comparar por tipo/serie: conteo, mínimo, máximo, huecos, total gravado, IGV y
   total pagable.
7. Acordar y documentar el próximo número y propietario de cada serie en un acta
   aprobada de conciliación/corte, con respaldo y procedimiento de reversión.
   Sólo después ejecutar el cambio autorizado. El máximo observado no concede
   permiso ni determina por sí solo la numeración siguiente.

No se reasigna numeración histórica ni se reenvían CPE aceptados. Registros sin
CDR quedan en una cola de revisión, no de reenvío automático.

### Mapeo mínimo de datos

| Origen esperado | Destino | Regla |
|---|---|---|
| Empresa | `CompanySettings` | Una fila por RUC; asignación configurable de sedes; completar dirección/ubigeo reales |
| Usuarios | `User` | Reset de contraseña; mapear rol, no copiar hash débil |
| Caja/sucursal/pista | `EmissionPoint` | Código estable y series asignadas |
| Turno/cierre | `Shift` | Conservar apertura/cierre y operador |
| Productos | `FuelProduct` | SKU estable, unidad SUNAT y afectación revisada |
| Cabecera CPE | `Document` | Snapshot + `originId`; decimales exactos |
| Detalle CPE | `DocumentItem` | Orden de línea estable |
| Respuesta SUNAT | `CdrLog` | Parseada + artefacto original |
| Archivos | `DocumentArtifact` | Storage key, tamaño y SHA-256 |

## Fase 4 — Modo sombra

Primer incremento de desarrollo: [laboratorio offline BETA/SYNTHETIC](ETAPA4_MODO_SOMBRA_LOCAL.md).
Compara snapshots/XML y proyecciones de impresión declaradas, con anotaciones
y CLI ficticia; no recibe ventas del cliente ni se integra en Billing/Kong/PWA.
No crea PDF real ni verifica firmas/CDR. El flujo real descrito a continuación
es un requisito futuro que necesita acceso/alcance autorizados, no un despliegue
ejecutado ni un cierre de las fases 2/3.

Durante un periodo acordado, una venta real se emite **sólo por el emisor
actual**. En paralelo FactuEz recibe una copia marcada `SHADOW`, genera XML/PDF
pero el adaptador de red está físicamente deshabilitado.

Comparar automáticamente:

- identidad fiscal, fecha, moneda y serie propuesta;
- cantidades/valores unitarios;
- gravado/exonerado/inafecto/gratuito;
- IGV/ISC/descuentos/total;
- XML normalizado excluyendo firma, IDs/timestamps variables;
- contenido de QR, `DigestValue` verificable y dimensiones PDF.

Toda diferencia tiene clasificación: bug antiguo aceptado temporalmente,
corrección obligatoria, diferencia cosmética o dato faltante. El modo sombra no
consume correlativos productivos de FactuEz.

## Fase 5 — Beta y homologación funcional

- Cargar un certificado de pruebas permitido y credenciales Beta.
- Ejecutar casos por factura, boleta/resumen, notas, GRE, rechazos y
  observaciones.
- Probar caída antes/durante/después del POST, respuestas duplicadas y consulta
  de tickets.
- Verificar ticket 80 mm físico, A4, QR, correo y ZIP de entrega.
- Beta se usa con bajo volumen; no para pruebas de carga.
- Las pruebas de concurrencia se hacen contra stubs locales de SUNAT.

## Fase 6 — Corte progresivo

Usar feature flags por **serie + punto de emisión**, no porcentaje aleatorio:

1. Congelar configuración y tomar backup verificable.
2. Detener emisión de la serie piloto en RestoApp.
3. Conciliar último número y configurar el siguiente en FactuEz.
4. Habilitar una serie/punto/turno en FactuEz con un operador acompañado.
5. Vigilar cola, CDR, totales y artefactos; ampliar al siguiente punto sólo tras
   acta de validación.
6. Cambiar RestoApp a sólo consulta/redirect para facturación.
7. Al completar, retirar sus credenciales y acceso de red a SUNAT. Aunque quede
   código viejo, ya no podrá emitir.

Guardrail crítico: una serie sólo puede tener un `emitterOwner` activo. El
runbook de corte registra propietario, último correlativo, hora y responsable.

## Rollback

Rollback no significa borrar documentos FactuEz ni bajar la base:

- detener admisión de nuevos comandos para la serie;
- dejar que jobs ya enviados terminen y reconciliarlos;
- obtener último correlativo realmente emitido/estado;
- firmar acta y configurar RestoApp con el siguiente número sólo si se decide
  devolver propiedad;
- conservar FactuEz en lectura para CDR/artefactos;
- investigar antes de reintentar cualquier estado ambiguo.

Nunca se restaura un backup sobre producción si eso elimina comprobantes
emitidos después del backup.

## Fase 7 — Retiro y operación estable

- Eliminar del despliegue de RestoApp certificado, SOL, GRE y SMTP fiscal.
- Bloquear por firewall sus endpoints SUNAT.
- Conservar un export histórico firmado/hashado y documentación de auditoría.
- Ejecutar restauración trimestral, simulacro de caída de Internet y rotación de
  certificado/credenciales.
- Habilitar el worker de cumplimiento sólo después de configurar un manifiesto
  privado real, firmado y probado. Una URL ilustrativa nunca se habilita.
- Revisar mensualmente las alertas y bundles fiscales; los catálogos compatibles
  pueden autoactivarse, pero cambios UBL/API requieren Beta y aprobación.

## Gates de aceptación

- 100 % de documentos históricos conciliados por serie y totales, o excepciones
  firmadas.
- Cero correlativos duplicados con prueba concurrente.
- Cero envíos desde el modo sombra.
- Todos los tipos y estados pasan fixtures, stubs y Beta.
- Producción no puede activarse sin rol admin + checklist + auditoría.
- Backup restaurado en otro host y artefactos verifican SHA-256.
- Operadores completan emisión, reimpresión, búsqueda, reenvío y contingencia
  con el runbook disponible.

## Información necesaria para completar el mapeo real

- repositorio/branch y stack de RestoApp;
- dump anonimizado de esquema y catálogo de estados;
- cinco juegos anonimizados XML/ZIP/CDR/PDF por tipo y caso;
- series activas, último correlativo y punto propietario;
- modalidad SEE actual (directo SUNAT u OSE/PSE), endpoints y ambiente;
- modelo exacto de ticketera y política de impresión;
- dirección fiscal, ubigeo, nombre comercial y datos del jefe de estación;
- política del contador para contingencia física, conservación e impuestos de
  combustibles.

La corrección multi-RUC y el orden de expansión de bases existentes están en
[MULTI_RUC.md](MULTI_RUC.md). No importar certificados o series sin identificar
su emisor original.
