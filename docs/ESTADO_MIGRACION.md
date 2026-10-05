# Estado de migración

Actualizado: 2026-10-05

## Fase actual

**Desarrollo de etapas 3 y 4 en paralelo; validación real y corte pendientes.**
Nuevo incremento de preparación de fases 2/3 con la
[entrega parcial del cliente](ETAPA2_3_ENTREGA_CLIENTE.md): tres RUC y 21 sedes
(17+3+1), contrato empresarial versionado y GET de sólo lectura protegido por
JWT/permisos, vista shadcn en Sedes y maestros y plantillas de mapa/alcance.
Los PDF y el Word no contienen XML/CDR originales ni un historial íntegro;
ubigeo numérico, establecimientos/puntos/series y autorizaciones siguen pendientes.
Diferencia de razón social marcada, sin inventar datos ni sobrescribir el emisor
inicial. Isotipo FactuEz en la pestaña, título conservado. No se importó historial,
crearon emisores/series, usaron claves reales, tocaron correlativos o habilitó
producción/transmisión. **Fase 2 fiscal no cerrada; fase 3 real sin corte.**
Verificación de este incremento: **2.783 pruebas/81 suites PASS, ninguna omitida;
15 proyectos TypeScript PASS; 6 checks GET de QA PASS**. Sólo Billing y PWA
recreados, once contenedores saludables y nueve sin cambios; cero RUC de la
entrega en los 46 chunks públicos auditados. BETA y gates oficiales cerrados.

Nuevo incremento local completado: [lectura/binding XML del perfil completo,
bytes PDF/QR, firmas/CDR ficticios y conciliación ampliada](ETAPA4_EVIDENCIA_COMPLETA_LOCAL.md).
Paquete puro `evidence-core` y runner CLI fijo BETA/SYNTHETIC, no API real o
cambio de los fixtures del panel. **314 pruebas nuevas/5 suites PASS;
2.684 pruebas/76 suites PASS, ninguna omitida; 21 tareas TypeScript PASS;
55 checks integrados PASS**, cuatro tipos y ocho representaciones, cero red.
A4 simple ajustado/revisado en una página; ticket y archivos archivados intactos.
No se desplegaron servicios, reiniciaron contenedores, aplicaron migraciones,
leyeron datos/certificados reales ni cambiaron correlativos. Verificación y
conciliación autorizadas con información real de San José siguen pendientes.

Se completó el [panel visual shadcn del modo sombra](ETAPA4_PANEL_VISUAL.md):
búsqueda/filtros, comparación por documento, XML y proyecciones declaradas,
anotaciones en memoria y exportaciones JSON/CSV. Vista móvil y claro/oscuro.
Exclusivamente cuatro fixtures integrados, sin datos reales, firma, envío,
persistencia de revisión o números fiscales. **2.370 pruebas/71 suites PASS,
ninguna omitida; 20 tareas TypeScript PASS**, incluidas 64 pruebas nuevas del panel.
El [primer comparador/CLI](ETAPA4_MODO_SOMBRA_LOCAL.md) conserva sus límites:
20 diferencias pendientes y cero efectos de emisión. No cierra etapas 2/3 reales;
captura real, binding/firmas/CDR/PKI sobre esa copia, PDF/QR del cliente,
conciliación aprobada y corte siguen pendientes. El nuevo laboratorio anterior
ya desarrolla esas herramientas con fixtures; no sustituyó la evidencia del panel.
Panel desplegado sólo en web-pwa del QA `factuez-stage2-qa`, a través de Kong en
`localhost:8091/shadow-lab`; once contenedores saludables y diez sin recrear.
Sin migraciones, envíos o cambios de producción. Prueba visual con identidad
ficticia aislada; no se abrió sesión con datos reales para validar la pantalla.

P1 multi-RUC/multi-sede implementado. P2 incluye representaciones PDF locales,
descargas autorizadas y configuración cifrada por RUC/ambiente; no se ha
habilitado emisión fiscal a SUNAT.

**Gate actual: etapa fiscal 2 no cerrada; importación/corte REAL de etapa 3 no iniciados.**
El usuario autorizó continuar **desarrollo de etapa 3 en paralelo**. Incremento anterior:
[consulta protegida y conciliación del historial](ETAPA3_CONSULTA_Y_CONCILIACION.md):
API NestJS de sólo lectura, JWT RS256/revalidación de identidad, rol lector,
totales exactos y comparación versionada. Exclusivamente BETA/SYNTHETIC;
API/Kong candidatos, sin despliegue o cambios en la intranet. Verificación de ese incremento:
**2.212 pruebas/66 suites PASS, ninguna omitida; 18 tareas TypeScript PASS;
24 checks E2E PASS**, incluida revocación tras leer archivos y consulta restaurada.
No datos reales, emisión, Outbox, contador o producción. Copia, mapa, confianza,
conciliación del cliente, integración activa y acta siguen pendientes.

Incremento anterior:
[historial persistente y restauración aislados](ETAPA3_PERSISTENCIA_Y_RESTAURACION.md):
contrato completo v1, repositorio Prisma separado, unique fiscal/origen,
checkpoint transaccional, archivo append-only y lectura interna por alcance.
Ensayo nuevo, sintético y temporal: 18 checks PostgreSQL PASS, 102 registros
restaurados y dos archivos verificados. Sin tablas/escrituras fiscales ni Outbox,
sin credenciales, datos reales, cambios de correlativos o envíos. No desplegado;
autenticación/API activa, copia/mapa/conciliación y acta siguen pendientes.
Regresión de ese incremento: **2.112 pruebas/63 suites PASS, ninguna omitida** con runtime
XSD offline; **18 tareas TypeScript PASS**. No se modificó Docker/intranet activos.

Primer incremento histórico:
[integridad de archivos y ensayo histórico por lotes](ETAPA3_BUNDLE_Y_ENSAYO.md):
SHA-256/tamaño de bundle ficticio, candidatos en memoria, reanudación y CLI local.
En ese primer incremento no había persistencia ni copias. Verificación histórica:
146 pruebas nuevas; regresión completa
1.993 pruebas/59 suites PASS sin omisiones con runtime XSD local, 15 tareas
TypeScript aprobadas y compilación aparte de migración. Ensayo ficticio: dos
archivos/294 bytes, dos candidatos, cero escrituras y revisión fiscal pendiente.
No hubo despliegue de servicios ni cambios de Docker/intranet en este incremento.
Nuevo [productor y laboratorio financiero](ETAPA2_PRODUCTOR_Y_CONCILIACION.md):
reserva interna y cola dedicada preparadas, guards cerrados; conciliación
versionada sólo en simulación, sin proyección persistida en Billing.
Ahora se prepara su [persistencia candidata](ETAPA2_PERSISTENCIA_CANDIDATA.md)
con contrato, repositorio y schema/blueprint; SQL sin aplicar y guard cerrado.
No hay escrituras financieras reales ni evidencia fiscal autenticada nueva.
Nuevo seguimiento de notas/lotes en el detalle y consumidor de evidencia con
Inbox e invalidaciones WebSocket; no proyección financiera. Ver
[seguimiento integrado](ETAPA2_SEGUIMIENTO_INTEGRADO.md).
Se preparó el [dry-run histórico de etapa 3](ETAPA3_PREPARACION_HISTORICOS.md)
sin leer RestoApp, importar registros ni cambiar correlativos.
Regresión del anterior incremento fiscal: 1.847 pruebas/56 suites y 15 tareas TypeScript aprobadas,
además de validación/generación Prisma sin conexión. Los contadores siguientes son históricos.
Despliegue del anterior incremento fiscal: sólo Billing/SUNAT, sin migraciones; once
contenedores saludables, 16 checks por Kong PASS y login local/LAN HTTP 200.

Los dos bloqueos
locales de recuperación XSD/preparación de lotes están corregidos y desplegados
en QA. Se integró un botón PWA de emisión/firma ficticia/SOAP interno/CDR simulado,
sin cambios fiscales en Billing. Regresión: 603 pruebas/31 suites y 15 tareas
TypeScript aprobadas. Ver [revisión](ETAPA2_REVISION_Y_GATE.md) y
[recuperación local](ETAPA2_RECUPERACION_LOCAL.md). No se necesitan nuevas
credenciales del cliente para continuar implementación local; la vertical oficial
continúa pendiente y la clave real no se utilizó en esta reparación.

Incremento posterior: [integración, pagos y notas](ETAPA2_INTEGRACION_Y_NOTAS.md).
Reserva/pipeline Beta 01/03 preparados con gate oficial cerrado; contado/crédito,
cuotas y PDF; transporte/CDR propio 07/08 simulado, avisos WebSocket y confianza
CDR fail-closed. Aquel incremento no cerró fiscalidad oficial ni inició etapa 3.

Circuito SOAP/CDR simulado añadido: tablas/red/flags aislados, RC QA firmado
y PDF QR/hash; gate XSD oficial versionado en el circuito QA, sin atribuir
validación retroactiva. Los laboratorios usan credenciales ficticias. Hubo un
piloto externo separado para 20615878481: una factura 01 Beta aceptada con
observación 4252, sin ventas/correlativos ni producción; no valida la vertical
automática ni cierra la habilitación. Ver [piloto](PILOTO_BETA_DESARROLLO.md) y
[ETAPA2_CIRCUITO_QA.md](ETAPA2_CIRCUITO_QA.md) para límites y bloqueos de cierre.

Completado:

- arquitectura de microservicios aprobada;
- Kong DB-less como único gateway publicado;
- separación de base, usuario, Prisma Schema y migraciones por servicio;
- contratos iniciales de integración SUNAT SOAP/REST y firma XML;
- infraestructura Docker Compose y persistencia on-premise;
- repositorio de destino creado en `D:\Facturacion\FactuEz`;
- módulo legado localizado en
  `D:\Restaurantes\la-barra-del-ceviche\apps\servicio-facturacion`;
- línea base verificada: 8 suites y 89 pruebas aprobadas;
- snapshot de referencia copiado sin generados ni artefactos compilados.
- contratos de eventos versionados y colas BullMQ implementados;
- emisión transaccional con correlativo, Idempotency-Key y Outbox;
- consumidor SUNAT con Inbox, UBL persistido y retorno asíncrono de estado;
- cálculo fiscal exacto y pruebas portadas.
- `identity-service` con usuarios, roles múltiples, permisos y asignación a
  puntos de emisión; JWT RS256 y JWKS interno;
- Billing protegido por permiso `document.issue`, sin confiar en `x-user-id`.
- Emisores RUC, sedes, puntos y series configurables; la distribución 21+1
  no se fija en código. Identidad y alcance verificados por cada servicio.
- PWA con componentes shadcn, dashboard, POS local, documentos, usuarios,
  roles y sedes. Logos San José/Mavric y créditos del desarrollador incorporados.
- Ticket de 80 mm y A4 locales de factura/boleta, con San José y FactuEz/Mavric,
  sin nombre personal ni frase de colaboración,
  desde snapshot inmutable; descarga por Kong con permiso y revocación.
- Configuración SUNAT por RUC/ambiente, sólo administrador global, certificados
  y credenciales cifrados AES-256-GCM, auditoría y revisión contra cambios concurrentes.

El estado detallado y los límites de cada incremento están en
[ETAPA1_AVANCE.md](ETAPA1_AVANCE.md), [MULTI_RUC.md](MULTI_RUC.md) y
[ETAPA2_AVANCE.md](ETAPA2_AVANCE.md) y [CONFIGURACION_SUNAT.md](CONFIGURACION_SUNAT.md).
La línea base de 89 pruebas anterior
corresponde al módulo legado, no a la suite actual de FactuEz.

El [incremento Beta posterior](ETAPA2_INCREMENTO_BETA.md) registra la base de
1.114 pruebas, 15 tareas TypeScript y el piloto separado FQ02-1: HTTP 200,
respuesta 0 sin observaciones, pero `CDR_UNVERIFIED`. No se reenvía ni acredita
aceptación fiscal. Los contadores de 603/89 anteriores son históricos.

## Inventario disponible

El análisis y el mapa de extracción están en
`docs/INVENTARIO_RESTOAPP_FACTURACION.md`. El snapshot de sólo lectura para la
migración está en:

```text
migration/legacy-reference/servicio-facturacion
```

RestoApp permanece sin cambios. No se harán envíos a SUNAT durante
descubrimiento, modo sombra ni conciliación.

## Primer corte vertical

Flujo local implementado para tipos 01 y 03:

```text
PWA -> Kong -> Billing -> Outbox/BullMQ -> SUNAT-service
    -> XML sin firmar + PDF de prueba -> evento -> estado local en Billing
```

Siguiente corte fiscal, pendiente y limitado inicialmente al piloto Beta:

```text
PWA -> Kong -> billing-service -> Outbox/BullMQ -> sunat-service
    -> firma/ZIP + transporte por perfil -> CDR -> evento -> WebSocket/PWA
```

Debe completar firma verificable, transporte de facturas y resúmenes de
boletas, CDR, QR/hash auténticos, contingencia fiscal y conciliación. Los PDF
actuales llevan advertencia de prueba y no sustituyen comprobantes fiscales.
La instalación anterior de localhost:8080 no se migra automáticamente: requiere
respaldo, ensayo sobre copia y corte controlado. QA usa un proyecto Docker y
volúmenes separados en localhost:8091.
