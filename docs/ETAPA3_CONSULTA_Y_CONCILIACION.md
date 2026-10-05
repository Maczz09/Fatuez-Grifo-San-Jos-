# Etapa 3 — Consulta protegida y conciliación del historial

Fecha: 03/10/2026. **Fase actual: desarrollo de etapa 3.** La etapa 2 fiscal
oficial sigue abierta; importación real, corte y producción no están habilitados.
La información y aprobaciones del cliente quedan pendientes, sin impedir este
incremento de código y pruebas exclusivamente BETA + SYNTHETIC.

Continuación posterior: [primer laboratorio de etapa 4](ETAPA4_MODO_SOMBRA_LOCAL.md),
autorizado en paralelo. No cierra etapas 2/3 ni cambia este ensayo de lectura;
los conteos de esta página corresponden al incremento de historial.

## Incremento implementado

- API NestJS de sólo lectura para listar, consultar detalle, descargar archivos
  y obtener totales del historial, separada de Billing, SUNAT y Outbox.
- Adaptador de identidad con JWT RS256 y revalidación de sesión y alcance contra
  Identity. El ensayo usa una autoridad HTTP ficticia y claves efímeras propias,
  no el servicio Identity activo ni certificados fiscales.
- Modo explícito `READ_ONLY` del repositorio: exige `history_reader_qa` en cada
  transacción y rechaza importaciones antes de abrir una transacción.
- Conciliación exacta y comparación de totales versionadas, sin aprobación
  contable automática ni cálculo de un próximo correlativo.
- Fragmento candidato de Kong, limitado a GET. **No está incluido en Kong activo,
  Compose ni la PWA. No hay un servicio nuevo desplegado en la intranet.**

Se preservan los snapshots y guardas del
[adaptador persistente aislado](ETAPA3_PERSISTENCIA_Y_RESTAURACION.md).
El nuevo código no añade tablas fiscales, migraciones a bases activas, usuarios
reales, permisos en Identity, colas, emisiones o cambios de contador.

## API preparada, deshabilitada por defecto

`createHistoryReadApp()` inicializa la aplicación pero **no escucha un puerto
automáticamente**, no carga `.env`, secretos ni conexiones a BD. Activarla exige
composición explícita con `enabled=true`, `environment=BETA`,
`datasetClass=SYNTHETIC` y el servicio de lectura. Otros perfiles se rechazan.
La composición del E2E utiliza el repositorio `READ_ONLY` y el rol lector real
de PostgreSQL; el factory no provisiona ese rol ni reemplaza los controles.

| Método y ruta | Resultado |
|---|---|
| GET `/api/v1/history/documents` | Página de registros autorizados y cursor |
| GET `/api/v1/history/documents/:recordId` | Snapshot completo y metadatos, sin claves internas de almacenamiento |
| GET `/api/v1/history/documents/:recordId/artifacts/:kind` | Archivo adjunto, con bytes y hash comprobados y reautorización tras leer |
| GET `/api/v1/history/reconciliation` | Totales de toda la selección autorizada, no sólo de una página |

Filtros: `issuerRuc`, `branchId`, `documentTypeCode`, `series`. El listado admite
`take` de 1 a 100 (25 por defecto) y `afterRecordId`; conciliación no admite
paginación y rechaza selecciones de más de 2.000 registros, sin devolver un total
parcial como si fuese completo. Parámetros desconocidos, repetidos o anidados
no se aceptan. **Filtros de fecha, búsqueda libre y panel PWA histórico todavía
no están implementados en esta API.**

No hay rutas POST/PUT/PATCH/DELETE ni importación HTTP. Se exige Bearer y nunca
se confía en `x-user-id` u otros claims del navegador. Respuestas sin caché,
`nosniff`, política CSP restrictiva y errores sin SQL, URLs de conexión, tokens
o stacks. Los archivos se entregan como `application/octet-stream` y attachment
con nombre UTF-8 escapado, no como HTML/XML ejecutable inline.

`/health` informa configuración/liveness: **no acredita disponibilidad de BD,
conectividad a Identity ni habilitación fiscal**. Listado/detalle usan
`factuez.history-read.v1`; los flags siguen indicando lectura, BETA/SYNTHETIC,
sin autoridad fiscal, autenticidad CDR, transmisión ni cambios de correlativo.

## Identidad y alcance

Se utiliza el permiso existente `document.view`, traducido exclusivamente al
puerto interno `history.view`. No se modificó la matriz de roles; `history.import`
siempre se rechaza por este adaptador. El alcance combina sede, punto y UUID del
contador de serie, no sólo la etiqueta F001/B001.

Se verifica RS256 con clave pública RSA fijada, al menos 2.048 bits; issuer,
audience, expiración, fecha de emisión, `nbf` si existe, usuario, `authVersion`,
sesión de navegador y alcance. No se aceptan algoritmos HMAC/none ni claves
privadas; no hay descarga de claves por URLs del token ni rotación JWKS
implementada en este adaptador.

Cada autorización consulta `/api/v1/auth/me`, sin redirecciones ni caché,
con timeout de cuatro segundos y respuesta limitada a 64 KiB. Se compara la
identidad vigente con la firmada: revocación o cambio de usuario, permiso,
versión, sesión o alcance bloquea la lectura. Si Identity no responde, no existe
fallback offline permisivo. Sólo se admite la dirección interna prevista o
loopback explícito para pruebas, no una URL arbitraria.

**La criptografía JWT fue probada; la autoridad HTTP del ensayo es simulada.**
No se afirma integración/despliegue contra Identity o Kong activos. La clave JWT
no es un certificado de firma SUNAT; no se leyó ni usó la clave fiscal real.

## Conciliación y comparación exactas

`factuez.history-reconciliation.v1` vuelve a validar los snapshots y agrupa por
**RUC, moneda, tipo y serie**, sumando nueve importes con enteros `BigInt` y
devolviendo cadenas decimales. No mezcla PEN/USD ni empresas. Las notas mantienen
importes positivos: no es un informe de ventas netas ni un asiento contable.

Las secuencias se agrupan por RUC/tipo/serie, sin dividirlas por moneda y crear
huecos ficticios. Se reportan sólo huecos internos observados, hasta 20 ejemplos
de rangos con sus conteos completos. No se presume numeración inicial/final,
cancelación ni derecho a reutilizar un número o iniciar desde el máximo.

Los estados y presencia de XML firmado/CDR son **declaraciones del snapshot**.
No acreditan disponibilidad de bytes, XSD, firma, confianza PKI, aceptación
SUNAT o autenticidad del CDR. Las referencias de notas ausentes en la selección
se señalan para revisar, sin declararlas inválidas por estar fuera del filtro.
Se conservan conteos completos y hasta 100 ejemplos de diagnóstico.
El SHA de selección liga snapshots completos; no sustituye una firma o hash
normativo del comprobante.

`compareHistoricalTotals()` es una función pura, no un endpoint de carga. Recibe
totales `factuez.history-expected-totals.v1` BETA/SYNTHETIC, compara presencia de
grupos, cantidad y nueve importes, conserva ambos SHA y hasta 100 diferencias
con conteo total. Un grupo ausente no equivale a un grupo con saldo cero.
Incluso con `match=true` permanecen `accountingApproved=false`,
`reviewRequired=true`, `fiscalAuthority=false`, `cdrAuthenticityVerified=false`,
`transmission=false` y `countersChanged=false`.

## Verificación ejecutada

- 100 pruebas adicionales respecto al incremento persistente anterior:
  tres suites nuevas y cobertura ampliada del repositorio.
- Repetición final focalizada: **132 pruebas / cuatro suites PASS** mediante
  `pnpm test:history-read`; es un subconjunto de la regresión, no se suma al total.
- **2.212 pruebas / 66 suites PASS, ninguna omitida**, con XSD offline mediante
  el runtime local ya disponible; sin red SUNAT ni descarga de dependencias.
- **18 tareas TypeScript PASS**, tres ejecutadas y quince reutilizadas de caché.
- **24 comprobaciones E2E PASS**: las 18 de persistencia/restauración anteriores
  y seis nuevas de lectura HTTP, alcance, reportes, archivos, revocación y guards.
  Incluye revocación después de leer los bytes y consulta HTTP tras restaurar.
- 102 snapshots, dos RUC ficticios y dos archivos en PostgreSQL nuevo, tmpfs,
  red Docker propia `--internal`, sin publicar el puerto de BD. Nest y la
  autoridad HTTP ficticia escucharon sólo en loopback temporal.
- Recursos del ensayo retirados al terminar. Cero bases activas tocadas, datos
  reales leídos, escrituras fiscales/Outbox, cambios de contador o transmisión.

Una primera regresión en paralelo con Docker/compilación alcanzó el timeout de
un test CLI existente. La repetición completa por separado pasó, sin cambiar
aserciones ni tiempos límite. Ejecutar los comandos secuencialmente.

SHA-256 del respaldo **temporal y sintético**, no del cliente:
`1fbe4137307a72da8e205c57e409c6da32c8c8b0d302af1fe7457c35bc6cc33e`.
Se retiró junto con los fixtures; no es evidencia fiscal ni un backup conservado.

```powershell
# Desde D:\Facturacion\FactuEz; QA exclusivamente sintético.
pnpm test:history-read
pnpm qa:history:persistence
pnpm typecheck
```

El runner necesita Docker autorizado e imagen PostgreSQL ya local. No admite
URLs de BD arbitrarias ni copias reales. No aplicar sus SQL a otras bases.

## Pendientes y siguiente avance

Puede continuar código sin datos del cliente: filtros de fecha/búsqueda,
exportación e interfaz histórica aislada con sus pruebas. No se declaran hechos
ni desplegados en este incremento.

Para migrar realmente siguen pendientes autorización/copia offline íntegra,
mapa empresa–RUC–sede–punto–serie, contraste del contrato/extractor con el origen,
verificación XML/CDR/firma/confianza, conciliación con Contabilidad, ensayo sobre
copia autorizada y aprobación del [acta de corte](ETAPA3_ACTA_CORTE_BORRADOR.md).
No habilitar datos reales reemplazando `SYNTHETIC` o quitando guards. La solicitud
al cliente ya incluye fases 2 y 3 y no se modificó en este incremento.

Código: [API](../services/history-service/src/read-api.ts),
[identidad](../services/history-service/src/read-identity.ts),
[repositorio](../services/history-service/src/repository.ts),
[conciliación](../packages/history-core/src/reconciliation.ts),
[fragmento Kong no aplicado](../infra/kong/kong.history-read.qa.fragment.yml),
[E2E](../tests/history-archive-db.e2e.mjs).
