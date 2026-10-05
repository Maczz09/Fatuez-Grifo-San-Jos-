# Etapa 3 — Integridad de archivos y ensayo histórico por lotes

Fecha: 03/10/2026. Desarrollo de etapa 3 autorizado en paralelo mientras la
etapa 2 fiscal permanece abierta. No autoriza importar datos del cliente,
aplicar migradores, cambiar series, enviar a SUNAT ni habilitar producción.

## Incremento implementado

1. Normalización separada, desligada del origen y con snapshots inmutables.
2. Plan de archivos ligado por SHA-256 al export completo. Lectura local sólo
   para comparar tamaño y hash con lo declarado; sin copiar ni modificar archivos.
3. Archivo candidato de metadatos **en memoria**, en cuarentena. Lotes de 500
   filas, reanudación verificada y repetición sin añadir duplicados.
4. CLI exclusiva de desarrollo, fixtures ficticios y pruebas automatizadas.

En este primer incremento no se añadió importador persistente, endpoint,
worker, tabla o migración. El siguiente incremento implementó un
[adaptador aislado y contrato completo](ETAPA3_PERSISTENCIA_Y_RESTAURACION.md),
ensayado exclusivamente sobre PostgreSQL nuevo y datos sintéticos. No amplió
esta CLI ni habilitó importación real.
Incremento posterior: [consulta protegida y conciliación](ETAPA3_CONSULTA_Y_CONCILIACION.md),
API candidata de lectura, JWT RS256/revalidación y reportes exactos ensayados con
datos sintéticos. Sin integración con servicios activos ni importación real.
Se preservan Billing/SUNAT desacoplados y Kong; la herramienta no conecta con
ellos. Ningún cambio de este incremento requiere reiniciar la intranet.

| Capa | Qué acredita | Qué no acredita |
|---|---|---|
| Diagnóstico de metadatos | Duplicados, mapeos declarados, sumas y huecos | Permisos o existencia del mapeo en Billing |
| Verificador de bundle | Bytes coinciden con tamaño/SHA-256 declarados | XML válido, firma, PKI, CDR auténtico o aceptación SUNAT |
| Ensayo por lotes | Prefijo y recibos coherentes con el plan en memoria | Commits de PostgreSQL, copias de artefactos o importación |
| Importación real | Pendiente de copia, integración real, conciliación y autorización | No queda habilitada por los tres pasos anteriores ni el ensayo sintético |

## Probar ahora, sin datos del cliente

Desde `D:\Facturacion\FactuEz`:

```powershell
pnpm migration:preview:build
node migration/history-bundle-cli.cjs --dry-run --development-only --input migration/fixtures/history-development-bundle.json --bundle-root migration/fixtures/history-bundle
pnpm test:history-stage3
```

El fixture contiene dos boletas, RUC ficticio `00000000000` y dos XML que dicen
explícitamente que **no son XML firmado ni CDR oficial**. No usan certificados.
Resultado esperado: dos archivos/294 bytes coincidentes, dos candidatos en
memoria y `REVIEW_REQUIRED`, con código de salida **3**. Es deliberado: la
integridad no elimina la revisión fiscal y una fila no declara CDR.

No se crean archivos de salida automáticamente. `--full-report` incluye el
estado del ensayo; sin ese flag se imprimen únicamente resumen y diagnósticos.
La CLI no muestra contenido de XML/PDF/ZIP, rutas absolutas ni errores internos.

## Verificación del incremento

- Compilación TypeScript de las tres herramientas de migración: PASS.
- 146 pruebas nuevas de etapa 3, incluidas en la regresión.
- Regresión completa: **1.993 pruebas / 59 suites PASS, ninguna omitida**.
- 15 tareas TypeScript del monorepo aprobadas (caché de código no modificado).
- Ejecución real de la CLI con el fixture: salida 3 de revisión, 2 archivos,
  294 bytes coincidentes, 2 candidatos y cero escrituras. Hash del export:
  `f0a5b07365e4480c7e4486676d39fc972033e509d2495400305aefc48d0509d3`.

La regresión completa se ejecutó con `FACTUEZ_FISCAL_XSD_PYTHON` apuntando al
Python/lxml local ya disponible, para incluir la prueba opcional de cuerpos
NC/ND/RC/RA contra el XSD público offline. No valida firma o confianza fiscal.
Sin ese runtime configurado, esa prueba se omite y no debe contarse como PASS.

`pnpm test:regression` limita la suite a cuatro procesos. La ejecución masiva
por defecto saturó la PC y agotó tiempos de pruebas nuevas y una anterior;
no se ampliaron los timeouts ni se deshabilitaron aserciones para conseguir
el resultado. Se optimizó la reanudación evitando generar un informe por fila.
El hash del export/plan ficticio se conservó después de esa optimización.

No se desplegaron servicios, reinició Docker, usó certificado ni modificó
configuración fiscal. La comprobación intranet del incremento anterior no
se presenta como un nuevo E2E de importación; esa integración todavía no existe.

## Bundle dedicado y límites de lectura

El verificador no busca archivos en RestoApp, almacenamiento activo ni
configuración SUNAT. Sólo usa una raíz offline explícita y rutas derivadas de
los metadatos ya validados:

```text
<bundle-root>/<RUC>/<tipo>/<serie>/<número>/<clase>/<nombre-original>
ej.: history-bundle/00000000000/03/BQ01/1/CDR_XML/fixture.xml
```

Se conserva el nombre original, pero no se admiten rutas arbitrarias, nombres
reservados de Windows, streams alternativos, extensiones inesperadas o nombres
de secretos/certificados. XML usa `.xml`, ZIP `.zip` y representaciones `.pdf`.
No se descomprime ZIP ni se interpreta XML/PDF: un archivo ficticio con la
extensión correcta puede coincidir en hash y seguirá sin valor fiscal.

Se rechazan raíces remotas/URL, enlaces simbólicos/junctions, hard links,
directorios en lugar de archivos y rutas resueltas fuera de la raíz. Antes y
después de leer se comprueban identidad del descriptor/ruta, tamaño, fechas y
directorios padre. Si un archivo cambia durante la lectura queda bloqueado.
Estos controles **no sustituyen una copia offline confiable y estable** frente
a procesos privilegiados que cambien rutas concurrentemente.

Límites específicos: 1.000 archivos, 16 MiB por archivo y 128 MiB agregados
declarados para lectura, chunks de 64 KiB y una sonda adicional de un byte por
archivo. Cien ejemplos máximos, sin perder el conteo completo de errores.
Los límites de metadatos de la herramienta anterior son distintos: declarar
un artefacto grande no autoriza leerlo con este verificador.

`.gitattributes` impide que Git altere finales de línea de los fixtures cuyos
hashes/tamaños están fijados. No recalcular el hash para ocultar una diferencia
en un archivo real: primero se debe investigar la discrepancia.

## Reanudación del ensayo, no de una importación

`rehearseHistoryArchive(input, state?, batchBudget=1)` es una función sin I/O.
Produce filas con `QUARANTINED_PENDING_FISCAL_REVIEW`, identidad fiscal y de
origen separadas, hash de fila y recibos del prefijo completado. Acepta un
presupuesto de 1 a 20 lotes. En cada llamada vuelve a validar todo el export.

La CLI acepta `--batches N` y `--rehearsal-state archivo.json`. El archivo debe
contener **sólo el objeto `rehearsal.state`** obtenido de `--full-report`, no el
reporte entero ni el checkpoint de la CLI anterior. Debe ser JSON UTF-8 compacto
de hasta 16 MiB. Su guardado es una acción explícita del operador; esta CLI sólo
lo lee y nunca sobrescribe progreso.

Versión, hash del export, hash del plan, cantidad de lotes, filas, orden y
recibos deben coincidir exactamente con el prefijo recalculado. Cambiar datos,
mapeos o hashes declarados invalida el estado. Si ya terminó, repetir añade
cero filas. No se usa únicamente una bandera «completado» como prueba de avance.

`complete=true` significa **ensayo en memoria terminado**, no fase 3 cerrada.
`persisted=false`, `importAllowed=false`, `databaseWrites=0`, `fiscalWrites=0`,
`artifactCopies=0`, `transmission=false`, `countersChanged=false` y
`cdrAuthenticityVerified=false` permanecen explícitos. El estado no es un recibo
de PostgreSQL. Las notas conservan importes positivos; no se netean ventas.

La integridad de archivos se recalcula en cada ejecución con `--bundle-root`;
no queda acreditada por un estado anterior ni por un recibo de metadatos.

| Salida de la nueva CLI | Significado |
|---|---|
| 1 | Argumentos, JSON, contrato, raíz o estado inválidos |
| 2 | Metadatos bloqueados o diferencias/ausencia de archivos |
| 3 | Ensayo local realizado; revisión fiscal pendiente, nunca autorización |

No existe `--apply`, `--import`, `--send` ni flag de producción. Sin
`--bundle-root` sólo se ensayan metadatos; `bundle=null` evita fingir una
comprobación de bytes. Los contratos no aceptan ambiente distinto de BETA.

## Lo que sigue de etapa 3

El [incremento posterior de persistencia](ETAPA3_PERSISTENCIA_Y_RESTAURACION.md)
ya implementó el adaptador, las identidades únicas fiscal/origen, el checkpoint
transaccional y snapshots de cabecera/cliente/ítems en un contrato separado.
Verificó respaldo/restauración y lectura por sede en BD nueva y archivos
sintéticos. Esas pruebas no son una migración real ni acreditan confianza CDR.

Pendientes con el cliente:

- Validar el mapa real empresa–RUC–sede–punto–serie, XML/CDR y confianza;
  conciliar una copia autorizada y resolver diferencias con contabilidad.
- Integrar extracción/API autorizada y repetir respaldo/restauración y lectura
  sobre esa copia; aprobar acta de corte antes de tocar contadores o propietario.

Nada de esto último se marca como ejecutado. La CLI de diagnóstico conserva sus
límites y no sirve para insertar un comprobante íntegro en `Document`. Para el
ensayo con información real harán falta copia autorizada, mapeos y aprobación.

Código: [verificador](../migration/history-artifacts.ts),
[ensayo](../migration/history-rehearsal.ts),
[CLI](../migration/history-bundle-cli.cjs).
