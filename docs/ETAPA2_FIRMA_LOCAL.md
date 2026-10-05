# Etapa 2 — Laboratorio de XML, firma y ZIP

Este incremento permite comprobar el circuito criptográfico **local**, no emitir
comprobantes fiscales. Sólo está habilitado en Compose QA 8091, con emisor
ficticio cuyo identificador empieza por `00`, ambiente BETA y certificado
autofirmado vigente. No toca credenciales del RUC real ni el demo 8080.

## Flujo y límites

PWA → Kong → ConfigurationGuard → Identity (sesión vigente / ADMIN GLOBAL /
`sunat.configure`) → Billing (detalle y snapshot autorizado) → SUNAT-service.
No hay acceso cruzado a tablas. Se coteja el snapshot inmutable de ambos
servicios. Se admite sólo factura/boleta onerosa 0101, PEN/USD, IGV 18%, hasta
500 ítems. Cantidades, precios, bases, impuesto y total se recalculan usando
enteros escalados; la fecha del XML corresponde a America/Lima.

SUNAT-service abre el PKCS#12 cifrado ligado a RUC/ambiente/campo, y un worker
acotado a 10 s y 96 MB selecciona la pareja clave/certificado por correspondencia
criptográfica, no por posición de las bolsas. Firma toda Invoice con referencia
vacía, XMLDSig enveloped / exclusive C14N / RSA-SHA256 / SHA256. Este perfil
`LOCAL-QA-UBL21-RSA256-v1` **no se presenta como perfil aprobado por SUNAT**.

Un verificador diferente verifica la firma con el certificado externo fijado,
ignora KeyInfo como fuente de confianza, consume `getSignedReferences()` y
compara el contenido autenticado con el XML esperado. Rechaza referencias
parciales/remotas, DTD/entidades, wrapping, IDs duplicados, múltiples firmas,
algoritmos fuera del perfil, XML roto y límites de tamaño/profundidad.
La estrategia sigue la [documentación oficial de xml-crypto](https://github.com/node-saml/xml-crypto#verifying-xml-documents).

El ZIP contiene un único XML firmado de nombre RUC-tipo-serie-correlativo.xml;
se verifica su extracción antes de archivar. El archivo descargado lleva
`PRUEBA-LOCAL.zip`. No contiene P12, clave privada, contraseña, SOL ni CDR.

Se guardan archivos privados con SHA-256 y un registro `LocalXmlValidation`
separado de los estados/artefactos fiscales. La clave documento/perfil/revisión
evita duplicados por replay; el registro conserva actor y fecha. Cambiar
credenciales exige una nueva prueba. Se revalida acceso y contexto antes de
guardar/descargar. Los locks no consumen correlativos. No se actualiza
FiscalDocument.status/digestValue, Outbox, Inbox, SunatSubmission ni CdrLog.

## Uso

1. En QA, configurar un emisor ficticio BETA, sede y punto con series F/B.
2. En Configuración SUNAT, cargar su PKCS#12 ficticio autofirmado.
3. Emitir una operación de prueba. Abrir su detalle como ADMIN GLOBAL.
4. Pulsar **Validar firma y descargar ZIP de prueba** en Laboratorio XML.
5. La UI muestra firma local verificada, fingerprint y SHA-256 ZIP; mantiene
   expresamente la advertencia sin validez tributaria ni aceptación SUNAT.

API protegida: POST/GET `/api/v1/local-xml-validation/:documentId`;
GET `/api/v1/local-xml-validation/:documentId/zip`. GET nunca firma ni reencola.
La opción `LOCAL_XML_VALIDATION_ENABLED=true` sólo está en el override QA;
por defecto está deshabilitada, incluso en el Compose de producción/demo.

## Instalación segura y pruebas

Respaldar SUNAT QA antes de ejecutar `services/sunat-service/prisma/local-xml-expand.sql`;
expansión aditiva, sin db push/reset. Reconstruir únicamente web-pwa/migrate-sunat
y reiniciar web/SUNAT/Kong del proyecto factuez-stage2-qa. No ejecutar contra 8080.

```powershell
pnpm test:local-xml
pnpm typecheck
pnpm test:local-xml:e2e
```

E2E exige `--isolated-only`, fija 8091, verifica demoData/transmisión deshabilitada,
crea un emisor/sede y dos documentos ficticios, comprueba firma externamente,
ZIP/idempotencia/revisión/permisos/revocación y preserva credenciales reales.
Desactiva su cuenta temporal; conserva documentos y auditoría de QA.

### Verificado en QA el 1 de octubre de 2026

- 106 pruebas automatizadas aprobadas: 81 de regresión y 25 de XML/firma/aislamiento.
- TypeScript del monorepo y build Docker de Next.js/SUNAT-service correctos.
- E2E real por Kong/PostgreSQL: factura y boleta ficticias, firma comprobada con
  certificado externo, ZIP extraído y checksum, replay, revisiones y 401/403/revocación.
- Tres registros LocalXmlValidation, cero SunatSubmission y cero CdrLog;
  los documentos permanecen BUILDING, sin cambio de correlativo al repetir.
- PWA real: botón, resultado «Firma local verificada · ZIP preparado», fingerprint,
  checksum y advertencias comprobados visualmente. Descarga por HTTP y desde el
  botón de la PWA confirmada: ZIP de 2310 bytes guardado en Downloads con SHA-256
  igual al mostrado por el servicio. La espera automática del evento blob no
  funcionó en el navegador integrado; se verificó el archivo real guardado.
- Backup previo conservado en `backups/qa-sunat-before-local-xml-20261001.dump`.
  Datos QA etiquetados PRUEBA conservados para trazabilidad, incluidas pruebas
  inicialmente fallidas; cuentas temporales desactivadas. Demo 8080 sin cambios.

## Pendiente antes de Beta y producción

`xsdValidated`, `sunatRulesValidated`, `trustAndRucVerified`, `fiscalTransmission`
y `cdrReceived` siguen en false. Este chequeo estructural y aritmético no sustituye
los [XSD, guías y reglas oficiales vigentes](https://cpe.sunat.gob.pe/guias-y-manuales).
Falta ampliar UBL (dirección/establecimiento, subtotales tributarios, firma referenciada,
forma de pago y casos fiscales), fijar esquemas/reglas con versión y checksum,
validar cadena/revocación/registro del certificado y vínculo del RUC, probar
transportes SOAP/Beta/resúmenes de boletas y CDR. Ninguna ruta de este incremento
llama a un adaptador SOAP/REST ni habilita producción. QR/hash de representación
fiscal y correo con adjuntos oficiales pertenecen a los siguientes bloques.
