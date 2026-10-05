# Acta de conciliación y corte — BORRADOR NO APROBADO

FactuEz · Estaciones San José · Mavric Technologies.
Estado: **PENDIENTE**. Este documento no autoriza producción, emisión, importación
real, cambios de correlativos o reasignación de series. No contiene aprobaciones
ni firmas; los campos deben completarse y revisarse por TI y Contabilidad.

## 1. Alcance que debe aprobarse antes del ensayo real

- Responsable TI, Administración/Contabilidad y responsable técnico: pendiente.
- RUC/razón social de cada empresa, sedes y establecimientos: pendiente.
- Periodo, fecha de congelamiento y origen de copia offline: pendiente.
- Identificador y SHA-256 del respaldo/export/manifiesto de archivos: pendiente.
- Destino de BD nueva/copia y almacenamiento aislado, permisos, acceso y
  retención: pendiente. No usar bases/archivos de emisión como destino inicial.
- Tipo/serie/punto propietario en origen y destino: pendiente.
- Autorización específica para leer/copiar datos del cliente: pendiente.

## 2. Conciliación con Contabilidad

Comparar por RUC, moneda, tipo y serie: filas, identidades, mínimo/máximo,
huecos, bases netas, IGV, otros impuestos, total pagable y estados declarados.
Las notas se conservan positivas; las ventas netas contables deben reconciliarse
aparte. No rellenar huecos, reutilizar numeración ni ocultar duplicados.

| Evidencia / decisión | Estado | Responsable / referencia |
|---|---|---|
| Mapa empresa–RUC–sede–punto–serie firmado | Pendiente | Por completar |
| Cabecera, cliente e ítems completos | Pendiente | Por completar |
| Duplicados/conflictos fiscal y origen resueltos | Pendiente | Por completar |
| Conciliación de importes y estados | Pendiente | Por completar |
| XML/CDR/firma/cadena/confianza revisados | Pendiente | Por completar |
| Excepciones y documentos sin evidencia resueltos | Pendiente | Por completar |
| Respaldo + restauración de copia real verificados | Pendiente | Por completar |
| Lectura por usuario/sede/punto/serie verificada | Pendiente | Por completar |

Anexar incidencias, decisiones y excepciones expresamente aceptadas. Ningún
estado declarado «aceptado» o hash correcto acredita por sí solo aceptación fiscal.

## 3. Corte futuro por serie — no ejecutable con este documento

Por cada RUC/tipo/serie registrar propietario actual/propuesto, sistema emisor
único, último número **confirmado y autorizado**, siguiente número propuesto,
ventana de corte, bloqueo del origen y responsables. No fijar números por
inferencia del export ni mover propietarios mientras ambos sistemas emitan.

Registrar plan de reversión y condiciones de no retorno. No restaurar o
retroceder contadores para reutilizar números que ya fueron emitidos; una
reversión después de emisión requiere conciliación específica y nueva decisión.

El importador histórico no debe crear Outbox, firmar o reenviar documentos.
Las discrepancias permanecen en revisión, no en una cola de envío automático.

## 4. Aprobaciones requeridas

- Autorización del ensayo con copia real por TI: **NO OTORGADA**.
- Conciliación/aprobación de Contabilidad y Administración: **NO OTORGADA**.
- Restauración y permisos validados sobre esa copia: **NO EJECUTADOS**.
- Acta de corte y ventana aprobadas: **NO OTORGADAS**.
- Activación fiscal/producción: **FUERA DE ALCANCE**.

El ensayo sintético descrito en [persistencia y restauración de etapa 3](ETAPA3_PERSISTENCIA_Y_RESTAURACION.md)
es una comprobación técnica de desarrollo, no una firma o aprobación de este acta.
