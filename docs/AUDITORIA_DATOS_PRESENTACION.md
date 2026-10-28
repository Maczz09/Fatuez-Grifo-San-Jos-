# Auditoría de datos de presentación — 2026-10-05

Alcance: PWA, consultas Billing y representaciones locales/Beta. No se borran
registros ni se habilita producción. Los selectores de las capturas mostraban
registros QA **persistidos**, no una lista de RUC codificada en el frontend.

| Hallazgo | Corrección |
| --- | --- |
| Emisores/sedes QA mezclados con los del negocio | Fuente explícita: Negocio (inicial), Laboratorios QA y Todo el catálogo. Clasificación por identidad sintética RUC00, no por nombres como PRUEBA. |
| Catálogo filtrado pero totales/listados consolidados incluían QA | `dataSource` validado y aplicado en SQL a filas, cuenta y todos los agregados. El frontend siempre envía la fuente elegida. |
| GRE elegía el primer RUC ficticio aunque la cabecera indicase otro | Se exige selección explícita del RUC en cabecera y sedes del mismo emisor; no se cambia automáticamente a otro RUC. |
| Ubigeo GRE precargado y catálogo duplicado en UI | Ubigeo inicialmente vacío; códigos/nombres y unidades de ítems se consultan en capabilities del servidor. Sigue siendo catálogo QA acotado, no catálogo fiscal completo. |
| SUNAT/SMTP tomaban la primera empresa al estar en consolidado | No se consulta ni se muestra configuración de ningún RUC hasta seleccionarlo explícitamente. |
| Crear sede preseleccionaba el primer emisor | El administrador debe elegir su emisor en el formulario. |
| Descarga de ventas dependía del PDF archivado al emitir | Renderer vigente bajo demanda y caché temporal privada; el nuevo consumidor sólo prepara el XML local. |
| Formato congelado de notas/GRE QA | Sus siguientes visualizaciones también consultan el perfil RUC/sede vigente. |

## Fuentes y límites

- Los maestros, productos/precios configurados, series y sedes provienen de
  PostgreSQL mediante APIs autorizadas. Cambiar la vista no amplía permisos:
  siguen aplicándose sedes, puntos y UUID de series asignados en el servidor.
- `BUSINESS` significa «no usa identidad sintética RUC00»; no certifica que un
  RUC sea válido, que sus documentos sean oficiales o que sus datos estén completos.
- Las consultas históricas conservan maestros inactivos; consulta por ID sigue
  autorizada independientemente del filtro visual. API sin `dataSource` conserva
  compatibilidad histórica ALL; la PWA siempre especifica la fuente.
- El catálogo administrativo permite revisar/desactivar/reactivar QA sin
  borrarlo. Los laboratorios aislados conservan fixtures inventados y bloqueos
  explícitos: sus nombres, datos y simulaciones no son valores por defecto del negocio.
- Identidad visual San José, FactuEz/Mavric, etiquetas, unidades, estados y códigos
  de protocolo no son datos fiscales de un emisor. Logos/formatos se personalizan
  por RUC/sede; no se alteran snapshots con la configuración actual de la empresa.
- `demo-bootstrap.service.ts` conserva el seed histórico del modo demo separado.
  En este QA `FACTUEZ_DEMO_SEED=false`: no ejecuta seed ni reemplaza maestros o
  precios existentes. No debe activarse sobre datos operativos.
- Permanecen los pendientes fiscales/documentales de etapas 2/3; esta auditoría
  no convierte GRE/GT de laboratorio en guías oficiales.

Ver [política PDF bajo demanda](PDF_BAJO_DEMANDA.md) para preservación de XML/CDR,
hechos originales, caché, límites de actualización y conservación de archivos.
