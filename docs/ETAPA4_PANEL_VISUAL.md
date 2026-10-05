# Etapa 4 — Panel visual del modo sombra

Fecha: 04/10/2026. Panel PWA shadcn del laboratorio **BETA/SYNTHETIC**.
No cierra la etapa 2 fiscal ni autoriza migración real, corte o producción.

Existe ahora un [laboratorio CLI separado de evidencia](ETAPA4_EVIDENCIA_COMPLETA_LOCAL.md)
con XML de negocio, firma/CDR ficticios y lectura de PDF/QR reales de prueba.
No se sustituyeron los fixtures/proyecciones declarados de esta pantalla ni se
desplegó una API de datos reales. Su evidencia y sus límites siguen siendo los
descritos en este documento.

## Uso

Entrar con un administrador general que tenga `sunat.configure` y abrir
**Administración → Modo sombra (pruebas)**, ruta `/shadow-lab`.
El laboratorio usa exclusivamente cuatro casos ficticios integrados en código;
no consulta ni representa el RUC/sede seleccionado en la cabecera.

- Resumen del lote: cuatro casos, 20 diferencias, una coincidencia comparativa
  sin verificar fiscalmente y un caso con evidencia faltante.
- Búsqueda por documento, cliente, tipo o RUC ficticio; filtros de estado,
  tipo y clasificación. El resumen superior siempre corresponde al lote completo.
- Botón **Ver comparación** con pestañas de diferencias, datos e ítems, XML,
  proyecciones declaradas 80 mm/A4 y campos QR, y anotaciones.
- Tabla en escritorio y tarjetas en móvil; temas claro/oscuro, foco y navegación
  de los componentes Radix, mensajes de error, carga y resultados vacíos.
- Informe JSON del lote y CSV de la vista filtrada. CSV con BOM UTF-8,
  valores entrecomillados y neutralización de fórmulas.
- Anotaciones JSON vinculadas al hash del caso y al ID de diferencia. Motivo
  de 1–500 caracteres y categorías del core, incluida posible falla del legado
  **pendiente de aprobación**. Anotar no resuelve ni reduce diferencias.

Los motivos y anotaciones sólo viven en memoria. No hay guardado automático,
localStorage, IndexedDB o persistencia de revisiones. Descargar antes de salir;
un motivo no registrado no se exporta. Cerrar el detalle conserva el borrador
durante esta sesión de pantalla. Cambiar de página, emisor/sede o recargar puede
descartarlo: se conserva el aviso existente de cambios sin guardar. Descartar
revisión exige confirmación dentro de la interfaz y no modifica ventas.

**Recalcular pruebas** ejecuta de nuevo el comparador puro en la ruta Node dinámica,
sin aceptar entradas del navegador. Está deshabilitado mientras haya anotaciones
o motivos sin registrar. No equivale a consultar estado fiscal o reintentar envíos.

## Implementación y límites

- `packages/shadow-core/src/fixtures.ts`: fixture fijo desplegable, independiente
  de helpers de tests; paridad de informe y hashes con la CLI verificada.
- `apps/web-pwa/features/shadow/data.server.ts`: código `server-only`; sin argumentos,
  certificados, entorno fiscal, red, base, Billing, Outbox o transporte SUNAT.
- `features/shadow/model.ts`: contratos sólo de tipos, filtros, importes decimales
  exactos, CSV y borradores. Precios hasta seis decimales sin usar `Number`.
- `features/shadow/panel.tsx` y `workspace.tsx`: componentes shadcn, control de
  acceso visual y protección de borradores mediante el workspace existente.
- `packages/ui/src/components/textarea.tsx`: componente compartido.
- Dockerfile web compila también history-core/shadow-core. No cambia imágenes de
  servicios fiscales, rutas Kong, roles, esquemas o bases.

Se rechazan payloads fuera de BETA/SYNTHETIC, RUC reales, duplicados, estadísticas
inconsistentes y flags de escritura, transmisión, firma verificada o aprobación.
Los datos fijos son públicos en el payload de la página; el guard visual **no es
una API autenticada para consultar historial privado**. No ampliar esta ruta a
ventas reales quitando esos controles: requiere otro adaptador y autorización.

XML mostrado es estructura ficticia, no UBL firmado/validado. Impresión/QR muestra
metadatos declarados, no PDF real, lectura de QR ni prueba física. La pantalla no
ofrece botón de envío, activación fiscal, importación, firma o corte. Los borradores
exportados tampoco son actas aprobadas ni identidad contable autenticada.

## Verificación local

- 64 pruebas nuevas en dos suites: fixture, filtros, importes exactos, aislamiento,
  anotaciones/hash obsoleto, CSV, SSR seguro y restricción a administrador general.
- Regresión completa: 2.370 pruebas / 71 suites PASS, ninguna omitida, con XSD local.
- Monorepo: 20 tareas TypeScript PASS; compilación web Next.js en Docker PASS.
- Navegador con identidad/catálogo ficticios en loopback: búsqueda vacía,
  filtro de evidencia faltante, cinco pestañas, A4/80 mm declarados, anotación,
  aviso al navegar, confirmación al descartar, recálculo, claro/oscuro y móvil
  de 390 px sin desbordamiento horizontal de página.
- El navegador mostró solicitud de descarga del borrador JSON; su contrato se
  comprobó por round-trip con el core en tests. No se afirma haber verificado el
  archivo guardado por el gestor de descargas del navegador.

Repetir pruebas sin datos del cliente:

```powershell
pnpm test:shadow-panel
pnpm typecheck
$env:FACTUEZ_FISCAL_XSD_PYTHON='C:\Users\maxmo\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
pnpm test:regression
```

La vista visual de ensayo se prepara sólo en loopback:

```powershell
node tests/shadow-panel-preview.cjs --isolated-synthetic-only
# En otra consola:
$env:NEXT_PUBLIC_API_BASE_URL='http://127.0.0.1:3174'
pnpm --filter @factuez/web-pwa exec next dev --hostname 127.0.0.1 --port 3104
```

Cerrar ambas consolas con Ctrl+C al terminar. No usar esa identidad simulada
en QA/intranet: sólo es un fixture local de UI, no un servicio de autenticación.
Ensayo realizado: 32 solicitudes sintéticas permitidas, cero rutas no previstas,
cero escrituras fiscales y cero solicitudes salientes del fixture. Servidores
de vista previa detenidos al finalizar; no son parte del despliegue.

## Pendientes fuera del panel

La captura real autorizada, binding XML completo, firma/CDR/PKI, PDF/QR reales,
conciliación con contabilidad y aprobación de corte siguen pendientes. Ver
[límites del comparador](ETAPA4_MODO_SOMBRA_LOCAL.md) y
[estado de migración](ESTADO_MIGRACION.md). Completar esta pantalla no habilita
operaciones oficiales ni cambia el gate de etapas 2/3.

## Despliegue verificado

Se actualizó exclusivamente `web-pwa` en el proyecto Docker existente
`factuez-stage2-qa`, con `up -d --no-deps --no-build --pull never web-pwa` después
de construir esa única imagen. Sin migradores, seeds, Compose general, consultas
de credenciales, cambios de redes/puertos, certificados o variables fiscales.

- [Abrir panel QA](http://localhost:8091/shadow-lab).
- Acceso LAN conservado: `http://192.168.100.5:8091/shadow-lab`.
- HTTP 200 a través de Kong; fixture y SHA esperado presentes en el payload.
- Web y otros diez contenedores QA saludables. Se conservaron los IDs de los
  otros diez contenedores; sólo cambió el ID de web-pwa.
- Regresión definitiva, repetida después de los ajustes móviles: 2.370 pruebas
  / 71 suites PASS, ninguna omitida. TypeScript definitivo: 20 tareas PASS.

La revisión visual/interactiva fue con identidad ficticia en loopback; la
comprobación del despliegue fue HTTP/estado de contenedores sin abrir una sesión
real ni leer configuraciones de emisores. Entrar con el administrador existente
y recargar la PWA para ver el nuevo enlace.
