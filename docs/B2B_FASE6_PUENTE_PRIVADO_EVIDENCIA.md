# B2B-06 — Puente privado de evidencia Billing–SUNAT

Fecha: 21/10/2026. Implementación candidata aislada, **sin despliegue ni emisión**.
Complementa [composición y resultados](B2B_FASE6_COMPOSICION_Y_RESULTADOS.md).

## Qué resuelve

Billing ya no necesita importar el motor propietario SUNAT, compartir su Prisma
ni tratar un WeakSet serializado como prueba. Se incorporaron dos rutas privadas
de sólo consulta; no son endpoints para emitir una nota:

| Propietario | POST privado | Función |
| --- | --- | --- |
| SUNAT | `/internal/b2b/correction-evidence` | Verificar original, prerrequisitos o resultado en sus archivos propios |
| Billing | `/internal/b2b/correction-evidence-authorize` | Validar permiso vigente y correspondencia con sus documentos/series/comandos |

Flujo: Billing → SUNAT → callback Billing → Identity. SUNAT verifica sus XML/CDR
y vuelve a consultar la autoridad antes de responder. Billing comprueba la
respuesta y crea una capacidad **local distinta**, sólo válida en ese proceso.
Una copia JSON de cualquiera de los sellos no se acepta como capacidad verificada.

## Controles implementados

- Orígenes HTTPS fijos, validación de CA/nombre del servidor, certificado cliente
  obligatorio y allowlists explícitas de huellas de peer. El emisor de solicitudes
  y el emisor del callback tienen papeles separados. Las cabeceras reenviadas o
  `X-User-Role` no autorizan nada.
- Bearer reenviado sólo al propietario fijo. Billing usa la autoridad pareada
  existente: introspección actual, grants, revocación y validación canónica de
  maestros. No hay permisos ADMIN implícitos ni grants nuevos automáticos.
- Tupla completa RUC/empresa/sede/punto/serie original/serie de nota. Consulta
  propias filas activas y snapshots exactos, referencia, tipo, número y
  establecimiento. El resultado exige el comando Outbox propio y exacto.
- Lector `BillingCorrectionEvidenceCommandReader`: autentica antes de consultar,
  filtra operación por RUC/empresa y vuelve a comprobar autoridad, filas y comando
  antes de devolverlo. No hay lectura de tablas SUNAT desde Billing.
- Contrato exacto y versionado, nonce aleatorio por solicitud, hash canónico del
  pedido completo, fecha ligada a la solicitud, revisión de autoridad y flags
  de no activación. Presupuesto de 2 MiB, 100.000 nodos y profundidad 32.
- JSON separado y congelado; rechaza getters, proxies, ciclos, prototipos extraños,
  claves peligrosas y campos adicionales. Validación temporal estricta: ventana
  de 30 segundos y tolerancia máxima de dos segundos de desfase de reloj.
- La respuesta debe coincidir con nonce/hash/fecha y tipo de consulta. El hash
  de autoridad participa en las huellas usadas por el coordinador financiero;
  cambiar el permiso invalida la operación aunque el XML no cambie.
- No se devuelve el Bearer, certificado, ruta de archivo, XML, CDR ni snapshot
  completo. Sólo evidencia mínima y huellas. El servidor comprueba la procedencia
  local antes de serializar y el consumidor verifica vínculos antes de sellar.
- Sin cache de aceptación: las consultas, la autoridad y los archivos se vuelven
  a verificar. Timeout privado de 30 segundos sólo en estas dos rutas, sin
  ampliar los límites de otras rutas. No hay redirects ni destinos del consumidor.
- `Cache-Control: private, no-store` y `X-Content-Type-Options: nosniff`.

El hash de la respuesta **no es una firma SUNAT ni una atestación portátil**. La
procedencia depende del canal mTLS fijo, callback, permisos y verificadores
propietarios. No aceptar ese JSON fuera de este protocolo autenticado.
Estas relecturas tampoco son una transacción distribuida entre Billing, SUNAT e
Identity: no prometen bloquear cambios remotos posteriores a la última consulta.

## Ensamblaje candidato

SUNAT: `SunatCorrectionEvidenceModule.isolated(...)`, con
`SunatCorrectionEvidence`, el ensamblaje propietario de evidencia y
`HttpCorrectionEvidenceAuthority` dirigido a Billing.

Billing: `BillingCorrectionEvidenceModule.isolated(...)`, con
`BillingCorrectionEvidenceAuthority`, `PrismaCorrectionEvidenceScope` y la
autoridad Identity pareada ya existente.

`createBillingCorrectionEvidencePorts(...)` reúne lector, autoridad y cliente
HTTPS para los coordinadores de reserva/commit. Mantiene el Prisma de Billing
local y no instancia el motor SUNAT. Crear esos ports no consulta la BD ni inicia
workers, publica eventos, asigna números o transmite documentos.

No se importan los nuevos módulos en AppModule/main ni se cambia Kong. Para un
futuro host privado: configurar HTTPS con `requestCert=true` y
`rejectUnauthorized=true`, JSON limitado a 2 MiB y filtro de errores sanitizados
equivalente al `B2bContextFilter` existente. No registrar cuerpos/Bearers ni usar
un proxy que termine TLS y confíe en una cabecera como sustituto del peer.
Los relojes de los hosts deben estar sincronizados. Configuración/grants reales
y despliegue requieren revisión aparte; no se modificaron durante esta entrega.

## Alcance y límites conservados

El puente de esta entrega autentica **un par explícito de series por instancia**:
consulta del original 01/03 y prerrequisitos/resultados NOTE. Los originales B
se resuelven por RC dentro del propietario; la autoridad de comandos/lotes RC/RA
no se infiere de un permiso de nota y se rechaza en este puente. El despacho
individual de notas F usa los perfiles BETA existentes.

No agrega grants de otras series para créditos históricos: si el historial
requiere una serie fuera del par, bloquea. Componer varios pares explícitos,
autoridad de lotes/versiones RC2 y procedencia SERVICE permanece pendiente.

No es el productor empresarial. Siguen pendientes reservas dinámicas posteriores
al ledger, materialización de versiones, bajas/no entrega, recuperación de
resultados ambiguos e integración vertical de emisión/eventos. Las cuotas de
Identity y timeouts transaccionales se conservan: antes de un uso real se debe
medir carga/latencia y preparar verificaciones agrupadas para cohortes grandes,
sin cachear permisos ni ampliar cuotas/tiempos como sustituto de ese diseño.

## Pruebas

`pnpm test:b2b-correction-evidence`: **192 comprobaciones aprobadas** sobre contrato,
consumidor, alcance/lector/ensamblaje Billing y ambos extremos HTTPS/mTLS.

Regresión final: **172 archivos, 6.185 aprobadas, una omitida y cero fallos**.
Tipos: 28 tareas correctas en 21 paquetes. Inventario: 227 rutas declaradas,
52 acciones públicas candidatas; las dos nuevas rutas son privadas, no desplegadas.

Las 24 pruebas HTTP usan CA/certificados efímeros, conexiones loopback reales y
sellos de los verificadores propietarios. Identity/catálogo y política
criptográfica son fixtures explícitos: no prueban SSO o PKI oficial desplegados.
Las pruebas Prisma simulado no se presentan como prueba de persistencia.

El ensayo `phase6-financial-db.e2e.cjs` incorpora una comprobación adicional aprobada del
alcance y lector con Prisma real en PostgreSQL nuevo etiquetado/tmpfs, sin
red/puertos ni clientes reales. Su autoridad es un fixture; no es una integración
con Identity/SUNAT oficial. El bloque financiero pasa 19 grupos; junto con los
16 de reserva y ocho de evidencia son 43 grupos PostgreSQL aislados. Resultados
finales de regresión y persistencia en
[verificación](B2B_VERIFICACION_2026-10-21.md).

No se cerró B2B-06, no se cambió Swagger activo y no se autoriza producción.
