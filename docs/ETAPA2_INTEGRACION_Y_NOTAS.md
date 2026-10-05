# Etapa 2: integración, pagos y transporte propio de notas

Actualización: 02/10/2026. Proyecto de pruebas `factuez-stage2-qa`, puerto 8091.
**Este incremento es desarrollo local; no cierra la etapa fiscal oficial.**
Conserva microservicios, bases propias, Kong, intranet y datos anteriores.

## Implementado

### Vertical de preparación Beta 01/03

El consumidor de `document.issued.v1` prepara una reserva idempotente propia
SUNAT junto con Inbox, artefactos y Outbox. Sólo para nuevos documentos Beta
con RUC estructuralmente válido: `AWAITING_AUTHORIZATION`. No reinterpreta ni
reactiva documentos históricos, ni consume otro correlativo de Billing.

La nueva máquina interna separa preparación/firma, XML/ZIP, XSD, barrera durable
antes del POST, ticket, consultas y CDR. Factura: `sendBill`; boleta: RC propio
`sendSummary` y consulta del mismo ticket. Contempla lease, CAS, máximo tres
preparaciones, consultas acotadas y resultados inciertos que nunca se reenvían.
El CDR se archiva con un CAS dentro de la transacción antes de publicar estado.

**El wiring oficial permanece sellado por `assertOfficialFiscalActivation()`**,
antes de abrir claves. Los flags no sustituyen ese bloqueo ni constituyen una
autorización. No hay activación automática por guardar credenciales. Los tests
de esta vertical usan puertos ficticios: no acreditan un piloto integrado en SUNAT.

La metadata durable v1 de la reserva usa `SunatSubmission.errorMessage` y la
fase `errorCode`, columnas existentes. El manifiesto incluye revisión, hashes,
paths, evidencia XSD e identidad del evento; nunca secretos. No se ejecutó una
migración. Esta versión de metadata debe preservarse al evolucionar el esquema.

### Forma de pago

- La PWA solicita Contado o Crédito explícito; crédito sólo en factura 01.
- Captura moneda, saldo pendiente e importes/fechas de cuotas. UI: hasta 20
  cuotas; validador: 1-999. PEN/USD en el contrato; terminal actual emite PEN.
- Cálculo decimal exacto: saldo positivo no mayor al total, cuotas positivas,
  suma exacta, moneda coherente y fechas de calendario válidas. Preparación
  real exige vencimiento posterior al día de emisión en Lima.
- Se congela en snapshot/evento antes de consumir el número. XML contiene
  `FormaPago` y las cuotas. PDF local ticket/A4 muestra saldo y cronograma.
- Un snapshot histórico sin dato de pago no se convierte retroactivamente en
  Contado. Para nuevas facturas con RUC real se exige declaración explícita.
- Crédito en boleta y notas que modifiquen una factura a crédito permanecen
  bloqueados: no se inventa la corrección del saldo o del cronograma.

Los perfiles no implementados se rechazan antes de numerar: exonerado/inafecto,
descuentos, anticipos, ISC y otros campos financieros desconocidos. Esto evita
ignorarlos silenciosamente; **no constituye implementación de esos perfiles**.

### Transporte propio de notas QA 07/08

- Sólo administrador global autorizado, original ficticio Beta y certificado
  ficticio autofirmado. No permite utilizar el certificado real del usuario.
- Nota F contra factura: XML/ZIP propio y `sendBill` al emulador interno.
- Nota B contra boleta: RC firmado propio con `BillingReference` 03, ticket
  y `getStatus`, sin reutilizar el CDR del comprobante original.
- Escenario fijado una sola vez. XSD antes de cada POST, incluido retry;
  comparación de ZIP/XML, firma, fingerprint, snapshot y revisión.
- Reserva independiente de transporte en `NotesQa.xsdEvidence.transportQa`
  v1; conserva la evidencia XSD original y el estado SQL `SIGNED_LOCAL`.
- Lease/fence/CAS, tres preparaciones y ocho consultas como máximo. Respuesta
  perdida o persistencia incierta: `UNKNOWN`, nunca reenvío ni nuevo número.
- CDR XML/ZIP y petición XML/ZIP descargables desde la pantalla de notas.
  Marcas SIMULADO/NO FISCAL y avisos WebSocket con REST de respaldo.
- La venta y su estado fiscal no se modifican. No es transporte oficial de notas.

Motivos locales ya cubiertos: crédito 01/06/07, débito 02. Los demás motivos,
créditos acumulados y documentos especiales continúan bloqueados.

### Evidencia de estado y confianza CDR

La proyección de estados finales en Billing exige contexto Beta/RUC/documento,
identificador de envío y evidencia de CDR/firma verificada. Un evento tardío de
progreso no rebaja un estado final. No se acepta un resultado del emulador como
fiscal, ni se convierte un fallo de confianza en aceptación.

El verificador CDR dispone de perfil RSA-SHA256 acotado: certificado público del
firmante fijado por archivo/hash de despliegue, cadena, identidad SUNAT, CRL y
firma XML de `ApplicationResponse`. Falta de pin, CRL, cadena o algoritmo fuera
del perfil => no confiable. Las pruebas de firma usan claves generadas en tests
y dobles de cadena/CRL; no acreditan confianza PKI real de SUNAT.

## Evidencia reproducible

```powershell
pnpm exec vitest run --maxWorkers=2
pnpm typecheck
node tests/qa-pdf.mjs --local-only --credit
```

Regresión: **603 pruebas / 31 suites**. TypeScript: **15 tareas / 11 paquetes**.
La concurrencia limitada evita timeouts por carga durante builds Docker.
Incluye pruebas de pago, firmas CDR sintéticas, transporte de notas, pérdida
de respuesta/lease, autorización, producción bloqueada y rechazo antes de numerar.
Los paquetes firmados de las cuatro combinaciones F/B y 07/08 se verifican
criptográficamente con P12 generado en memoria, no sólo con mocks del firmador.
Los PDF ficticios de crédito ticket/A4 fueron renderizados e inspeccionados.

Auditoría adicional sin DB/Redis/HTTP ni secretos montados:

```powershell
Get-Content tests/notes-transport.crypto.audit.cjs -Raw |
  docker run --rm --network none -i --entrypoint node factuez-stage2-qa/sunat-service:local -
```

Usa el XSD público fijado del servicio y un certificado creado en memoria.
No ejecutar scripts de piloto externo para repetir estas comprobaciones.

## Lo que sigue abierto

La integración preparada 01/03 no está habilitada ni ensayada contra SUNAT
desde la emisión normal. Notas, RC/RA y GRE permanecen QA, no fiscales.
Faltan transporte/conciliación oficial de notas y lotes, nuevos pilotos autorizados,
confianza de CDR reales y ampliación de reglas/motivos/perfiles aplicables.
GRE de combustible, SMTP corporativo, impresión física y TLS/PWA de intranet
tienen gates propios. La suite verde no reemplaza esas verificaciones.

El único piloto Beta anterior para 20615878481 se conserva sin cambios y sin
reenvío; su autorización de una factura ya fue utilizada. No se usó el PFX real
en este incremento, no se solicitaron tokens OAuth ni se enviaron correos reales.
**Producción bloqueada. Etapa 2 fiscal abierta. Etapa 3 no iniciada.**

## Despliegue verificado

Se reconstruyeron imágenes SUNAT, Billing y PWA. Se recrearon exclusivamente
SUNAT, emulador, Billing y PWA usando los overlays existentes y `--no-deps
--no-build --pull never`. No se ejecutaron migradores ni cambios de base de datos.
Once contenedores saludables; red de servicios `internal=true`.

- `http://localhost:8091/login`: HTTP 200.
- `http://192.168.100.5:8091/login`: HTTP 200 desde el servidor.
- Salud SUNAT por Kong: HTTP 200.
- POST al transporte de notas sin sesión: HTTP 401 antes de leer/reservar datos.
- Flags de transmisión y workflow oficial Beta: false; guard oficial bloqueado.

No se acreditó acceso desde otra PC, impresión física ni un E2E con emisión
nueva en las bases del usuario. La auditoría de cuatro firmas/XSD se ejecutó
en contenedor temporal sin red ni secretos montados y pasó todos los casos.

## Fuentes técnicas fijadas

- [Reglas SUNAT actualizadas al 26/08/2026](https://cpe.sunat.gob.pe/sites/default/files/2026-08/Reglas%20de%20validaci%C3%B3n%20-%20actualizado%20al%2026.08.2026.xlsx):
  reglas de forma de pago/cuotas documentadas en `fiscal-rules.ts`; cobertura parcial.
- [Guías y manuales oficiales](https://cpe.sunat.gob.pe/guias-y-manuales):
  manual del programador y guía RC para rutas SOAP y referencias de notas.

La fecha y hash del paquete XSD están versionados en el repositorio. Un XSD
correcto no implica cumplimiento de toda la matriz ni aceptación SUNAT.
