# Entrega parcial del cliente · preparación de fases 2 y 3

Fecha: 05/10/2026. Exclusivamente desarrollo BETA en el QA `factuez-stage2-qa`.

## Avance implementado

La entrega revisada se convirtió en un expediente versionado de
**configuración empresarial**, no en un historial de comprobantes. Está disponible
para el administrador general en **Sedes y maestros → Entrega del cliente**.
La pantalla usa los componentes shadcn existentes y conserva la interfaz operativa.

- Tres empresas, direcciones fiscales según fichas y 21 sedes según el anexo.
- Mapa consultable por RUC y búsqueda de sede/código, sin alterar el emisor activo.
- Campos no entregados explícitamente pendientes: ubigeo numérico, dirección de
  sede, establecimiento, punto y series. No se inventaron ni dedujeron de muestras.
- Diferencia de razón social marcada para Contabilidad, sin sobrescribir el catálogo.
- Pendientes separados por fase y responsable, incluidos los trabajos técnicos de Mavric.
- Descarga de mapa CSV con celdas faltantes vacías, plantilla de alcance por
  autorizar y reporte JSON. Son documentos de coordinación, no archivos ejecutables
  de carga ni autorizaciones de emisión/importación.
- Icono de pestaña: isotipo FactuEz WebP existente, sin letras en la imagen,
  con variante oscura y URL versionada. Se conserva el título
  `FactuEz | Grifo San José` solicitado por el usuario.

## Datos recibidos y límites

Fuentes revisadas: `C:\Users\maxmo\Downloads\documentos` y
`C:\Users\maxmo\Downloads\Respuesta informacion fase 2 - Estaciones San Jose.docx`.
La carpeta contiene tres fichas RUC y siete muestras de comprobantes PDF;
las fichas suman seis páginas y las muestras siete. No se recibieron XML/CDR
originales, ZIP, copia de BD o exportación íntegra. Los PDF no tienen adjuntos
XML/CDR embebidos según la revisión previa de sus estructuras.

| RUC | Razón social según ficha | Sedes del anexo |
| --- | --- | ---: |
| 20175642341 | ESTACION DE SERVICIOS SAN JOSE S.A.C. | 17 |
| 20600979630 | MAX GAS SOCIEDAD ANONIMA CERRADA | 3 |
| 20614605864 | ESTACION DE SERVICIOS SAN JOSE ORIENTE S.A.C. | 1 |

La distribución entregada es **21 sedes en total**, no 21+1. El RUC de la
configuración inicial del proyecto no se reemplazó ni se eliminó.
La respuesta Word llama al RUC 20175642341 `ESTACIONES SAN JOSE S.A.C.`;
la ficha usa el nombre de la tabla. Contabilidad debe resolver esta diferencia
antes del alta definitiva. El dígito de control RUC se comprobó localmente;
eso no verifica identidad, vigencia o habilitación ante SUNAT.

La declaración general de desarrollo Beta no define el piloto oficial concreto,
ni autoriza lectura/importación de un historial íntegro, firma con claves reales
o un corte. Las series observadas en los PDF no prueban su pertenencia a una
sede/punto ni autorizan una numeración nueva. Las muestras incluyen guías 09/31;
el adaptador remitente 09 y el QA de mercancía no regulada no acreditan un flujo
real de combustibles ni soporte oficial transportista 31.

## Arquitectura y seguridad

`GET /api/v1/stations/client-intake` en Billing, a través de la ruta Kong existente.
Usa el mismo guard JWT RS256 y revalidación de identidad; exige además rol ADMIN,
alcance GLOBAL y permiso `setup.manage`. Respuesta `private, no-store` y
`Vary: Authorization`. Flag opt-in `CLIENT_INTAKE_QA_ENABLED=true` sólo en el
overlay QA; el despliegue base permanece cerrado.

El contrato puro `factuez.client-intake.v1` fija esta entrega revisada y rechaza
producción, claves desconocidas, datos no revisados, getters/prototipos/ciclos,
asignaciones inventadas y supuestas aprobaciones. Una nueva entrega requiere
revisión y versión: no quitar guards. El payload del servidor es una importación
opt-in `@factuez/contracts/client-intake`; el índice común sólo reexporta sus tipos,
para no incluirlo al importar eventos/permisos desde otros consumidores.
La PWA sólo importa esos tipos y solicita datos al activar la pestaña.
Al cambiar permisos o usuario oculta/descarta la vista y aborta la consulta.

No se copiaron los PDF del cliente al repositorio o carpeta pública. No se
incluyeron nombres/documentos de clientes, importes, placas, teléfonos, claves,
XML, certificados o secretos en el expediente. Exportar CSV neutraliza fórmulas.

**Todos los gates siguen cerrados:** `canEmit`, `canImportHistory`,
`canChangeCounters`, `phase2Closed` y `phase3Closed` son `false`.
No hay dependencias de Prisma, Outbox, BullMQ, SMTP o adaptadores SUNAT en
este endpoint. No modifica otros emisores ni crea series o comprobantes.
Los runners de historial/evidencia SYNTHETIC mantienen sus contratos y aislamiento.

## Lo que sigue pendiente

### Complemento recibido el 06/10/2026: muestra GT tipo 31

Se revisaron offline cuatro archivos autorizados de una misma guía transportista:
XML firmado, CDR XML, ZIP del CDR y PDF. Firma/digest del XML correctos con dos
verificadores independientes; PDF/hash/QR y referencias de la respuesta
correspondientes. No se acredita confianza PKI sólo con certificados embebidos.

**Incidencia:** el digest del CDR no coincide con el contenido recibido; ambos
verificadores lo rechazan. El ZIP contiene exactamente ese mismo XML. El texto
reporta código 0 y tres observaciones, pero no se considera aceptación
autenticada. Solicitar nuevamente el ZIP original, sin editar ni recomprimir.

La entrega cubre una muestra GT 31, no los XML/CDR de los otros seis tipos ni
la copia/export completo. No se alteró el expediente versionado servido por
la API, datos de empresa, perfiles SYNTHETIC, producción o gates. Esta revisión
no cierra fases 2/3 ni autoriza emisión/importación/corte.

Informe detallado local (ignorado por Git):
`output/reviews/Revision_XML_CDR_GT_Fases_2_3_20261006.md`.

### Pendientes restantes

Fase 2: originales XML/CDR, mapa completo y nombre confirmado, configuración
directa por los responsables de cada emisor, confianza/identidad y definición
autorizada del piloto Beta. Mavric debe terminar y verificar los pendientes
técnicos del circuito fiscal oficial de notas/lotes, reglas y perfiles de guías;
no se resuelven sólo recibiendo documentos.

Fase 3: copia/export completo, periodo y alcance de lectura autorizados, origen
confirmado, extractor adaptado, archivos y verificación XML/CDR/firma/PKI/PDF/QR,
conciliación con Contabilidad, respaldo/restauración sobre copia autorizada
y acta de corte. No se inicia numeración a partir del máximo visto en las muestras.

Ver [estado de migración](ESTADO_MIGRACION.md),
[gate fiscal](ETAPA2_REVISION_Y_GATE.md) y
[acta de corte pendiente](ETAPA3_ACTA_CORTE_BORRADOR.md).
La solicitud formal al cliente continúa en
`output/pdf/Solicitud_pendientes_Estaciones_San_Jose_Fases_2_y_3.pdf`.

## Verificación y despliegue

- **99 pruebas nuevas/5 suites PASS**. Con las cinco pruebas de branding existentes,
  la verificación focalizada suma 104 PASS.
- **2.783 pruebas/81 suites PASS, ninguna omitida**; XSD offline. La primera pasada
  con cuatro workers agotó límites de tiempo en dos pruebas existentes (conciliación
  de 100 líneas y hook de la API histórica). La repetición completa con dos workers
  y timeouts de 30 s aprobó todo, sin omitir casos ni cambiar validaciones.
- **15 proyectos TypeScript PASS**, comprobados con sus `tsconfig.json` existentes.
- Build directo de las dos imágenes aprobado; Next.js 15.5.25 compiló 18 rutas.
- QA actualizado: únicamente Billing y PWA recreados con `--no-deps --no-build
  --pull never`, conservando los tres overlays existentes. Once contenedores
  saludables; los otros nueve conservan sus IDs. PostgreSQL/Redis/SUNAT/Identity/
  mailer/realtime/Kong no se recrearon. Seeding deshabilitado.
- **6 checks HTTP GET PASS** en `127.0.0.1:8091`: login y manifiesto, dos isotipos
  WebP idénticos por SHA a los recursos existentes, API sin token y con token inválido
  rechazada con 401 sin revelar la entrega. No se abrió sesión con claves reales.
- Navegador temporal: título conservado y tres links de icono/shortcut comprobados
  desde el DOM. La vista autenticada se verificó por SSR/guards con identidad ficticia;
  no se afirma una prueba visual autenticada sobre la sesión del cliente.
- **46 chunks públicos JS auditados, cero RUC de esta entrega incluidos**.
- Runtime SUNAT mantiene BETA, transmisión y workflow oficiales deshabilitados.
  El nuevo expediente conserva todos los gates en `false`.

Las imágenes previas siguen recuperables con las etiquetas
`factuez-stage2-qa/web-pwa:pre-client-intake-20261005` y
`factuez-stage2-qa/billing-service:pre-client-intake-20261005`.
El primer build Compose incluyó una imagen dependiente en su plan: se canceló
antes de desplegar y se usaron builds Docker directos sólo de los dos servicios.
No hubo despliegue de esa dependencia. No se borraron imágenes ni volúmenes.

No se declara cierre fiscal u operación histórica real por completar esta pantalla.
Para actualizar se permite sólo `billing-service` y `web-pwa` del QA existente;
no usar `compose up` general, migradores, seeding, `db push`, reinicios de
contadores o cambios de producción.

Pruebas con dependencias existentes, sin reinstalarlas:

```powershell
node node_modules/typescript/bin/tsc -p packages/contracts/tsconfig.json
node node_modules/vitest/vitest.mjs run --maxWorkers=2 tests/client-intake.spec.ts tests/client-intake-controller.spec.ts tests/client-intake-ui.spec.ts tests/client-intake-templates.spec.ts tests/browser-icons.spec.ts
$env:FACTUEZ_FISCAL_XSD_PYTHON='C:\Users\maxmo\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
node node_modules/vitest/vitest.mjs run --maxWorkers=2 --testTimeout=30000 --hookTimeout=30000
node tests/client-intake.runtime.audit.cjs --read-only-qa
```

Despliegue específico (IP LAN comprobada el 05/10; no recrear Kong):

```powershell
$env:FACTUEZ_INTRANET_IP='192.168.100.5'
docker compose -p factuez-stage2-qa -f docker-compose.demo.yml -f tests/compose.stage2.qa.yml -f tests/compose.intranet.qa.yml up -d --no-deps --no-build --pull never --wait --wait-timeout 60 billing-service web-pwa
```

La auditoría HTTP usa sólo GET y un token inválido fijo. No lee secretos,
documentos del cliente o configuraciones SUNAT por RUC, ni escribe en la BD.

El host conserva `node_modules` instalado con pnpm 9; el `packageManager` del
proyecto fija pnpm 11. La ejecución automática de pnpm 11 quiso reinstalar el
árbol y abortó sin TTY. No se aprobó purga, ni se cambiaron dependencias/lockfile:
las pruebas se ejecutaron directamente con los runners instalados.
