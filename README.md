# FactuEz — Grifo San José

Sistema de Facturación para **GRIFO SAN JOSE S.R.L.** (RUC 20450819230),
basado en FactuEz y diseñado para despliegue local/on-premise.

El repositorio contiene la vertical de demostración desacoplada y el primer
incremento de fundamentos multi-RUC/multi-sede e interfaz (P1): Identity, Billing y SUNAT
con bases propias, Kong y una PWA Next.js con componentes shadcn compartidos.
No está habilitada la transmisión fiscal: la emisión local no envía a SUNAT
ni equivale a un CPE aceptado. El laboratorio separado firma documentos ficticios
y prueba SOAP/CDR mediante un emulador aislado, con gate XSD oficial versionado,
sin modificar el estado fiscal. XSD válido no significa homologación ni aceptación SUNAT.

- Avance, pruebas y ejecución de P1: [docs/ETAPA1_AVANCE.md](docs/ETAPA1_AVANCE.md)
- P2: [PDF/configuración](docs/ETAPA2_AVANCE.md), [firma local](docs/ETAPA2_FIRMA_LOCAL.md)
  y [circuito SOAP/CDR simulado y límites](docs/ETAPA2_CIRCUITO_QA.md).
- Preparación local ampliada de P2: [notas, guías, lotes, impresión y habilitación futura](docs/ETAPA2_PREPARACION_LOCAL.md).
- Revisión actual: [etapa 2 y criterio de avance](docs/ETAPA2_REVISION_Y_GATE.md).
  [Recuperación y emisión QA desde la PWA](docs/ETAPA2_RECUPERACION_LOCAL.md):
  dos defectos locales corregidos y desplegados. Incremento posterior:
  [pagos, integración preparada y transporte/CDR propio de notas](docs/ETAPA2_INTEGRACION_Y_NOTAS.md);
  603 pruebas en 31 suites, sin nuevos envíos oficiales.
  La etapa fiscal no está cerrada. Etapa 3 tiene desarrollo aislado; la importación
  real/corte no se han iniciado. Ver [historial persistente y restauración sintética](docs/ETAPA3_PERSISTENCIA_Y_RESTAURACION.md).
  Incremento de fase 3: [consulta protegida y conciliación histórica](docs/ETAPA3_CONSULTA_Y_CONCILIACION.md),
  API candidata NestJS de sólo lectura, identidad RS256/revalidación y reportes
  exactos, con 2.212 pruebas/66 suites y 24 checks E2E aprobados. Exclusivamente
  BETA/SYNTHETIC, sin desplegar en Kong/PWA activos ni habilitar migración real.
  Un piloto técnico separado
  fue aceptado con observación en Beta, no habilitó emisión automática ni producción.

- Desarrollo de fase 4 iniciado: [laboratorio de modo sombra offline](docs/ETAPA4_MODO_SOMBRA_LOCAL.md).
  Comparador puro, anotaciones y CLI con fixtures sintéticos. Nuevo
  [panel visual shadcn](docs/ETAPA4_PANEL_VISUAL.md) en `/shadow-lab`:
  filtros, detalle comparativo y JSON/CSV. Sin datos reales, firma, envío ni
  numeración; no es un ensayo de PDF/ventas reales. Las fases 2 fiscal y 3 real
  siguen pendientes.

- Incremento local de fase 4: [XML completo del perfil, bytes PDF/QR, firmas/CDR
  ficticios e informes de conciliación](docs/ETAPA4_EVIDENCIA_COMPLETA_LOCAL.md).
  Ejecutar `pnpm test:evidence` y `pnpm qa:evidence`. Laboratorio CLI aislado,
  sin información real ni modificaciones del panel, servicios, Kong o bases.

- Corrección de emisores y actualización segura: [docs/MULTI_RUC.md](docs/MULTI_RUC.md)

- Arquitectura: `docs/ARQUITECTURA_FACTUEZ_GRIFO_SAN_JOSE.md`
- Migración: `docs/MIGRACION_RESTOAPP_A_FACTUEZ.md`
- Modelos: `services/*/prisma/schema.prisma` (una base por microservicio)
- Gateway: `infra/kong/kong.yml` (Kong DB-less)
- Demo: `docker-compose.demo.yml`; `docker-compose.yml` sigue siendo el blueprint de producción, no el despliegue completo validado.
- Estado de migración: `docs/ESTADO_MIGRACION.md`
- Usuarios, roles y permisos: `docs/RBAC_USUARIOS_Y_ROLES.md`
