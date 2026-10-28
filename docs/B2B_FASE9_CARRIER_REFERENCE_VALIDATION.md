# B2B-09 — Validación privada de referencia pública 09 para transportista

Entrega de código LOCAL/BETA. No se transmite a SUNAT, no se habilita traslado y
no se declara cerrado el piloto o un ejecutable completo. Este bloque añade un
validador criptográfico, protocolo y módulo HTTP privados, más el cliente opcional
de Billing; el padre debe montar e inyectar estas piezas en su composición.

## Archivos exactos y fronteras del bloque

Nuevos:

- `services/sunat-service/src/b2b/carrier-reference-validation.ts`
- `services/sunat-service/src/b2b/carrier-reference-validation-protocol.ts`
- `services/sunat-service/src/b2b/carrier-reference-validation-http.ts`
- `services/billing-service/src/b2b/carrier-reference-validation-http.ts`
- `tests/b2b-carrier-reference-validation.spec.ts`
- Este documento.

No se modifican mains, runtime*.ts, host config, protocolos/helpers compartidos,
paquetes, esquemas SQL, migraciones ni los guards de ingreso/uso de referencia de
Billing. No se crea ni inicia Docker, se leen certificados del cliente o se
realizan builds/regresiones globales.

## Validador y binding completo

`CarrierReferenceValidation.verify` implementa estructuralmente el contrato
Billing `CarrierReferenceSignatureCdrValidator`: recibe el ownerSnapshot completo,
projection, XML09 firmado original y CDR XML original, con todos sus SHA; devuelve
la aceptación interpretada y validada, nunca un accepted/approved Boolean.
SUNAT no importa ni conecta la base Billing.

Se reutilizan las implementaciones vigentes:

- validatePublicGuide09OwnerSnapshot/projectPublicGuide09OwnerSnapshot y
  buildPublicGuide09Xml del perfil público 01/venta 01.
- CarrierReferenceCryptoVerifier.
- verifyGuideIssuerXmlTrust, parseSafeInvoice y verifyLocalSignedInvoice.
- verifyGuideCdrEvidence y parseCdrZip, usando exclusivamente un sobre ZIP temporal
  en memoria para revisar el XML CDR. No se presenta ese ZIP como original.
- PinnedBetaIssuerPublicCertificates, CertificateTrustService y
  CdrSignatureTrustService como dependencias propietarias reales.

El perfil completo existente es
`factuez.public-guide09-issued-owner.v1`: companyId, branchId, documentId,
operationId, emisor, serie/número y body exacto. El body incluye emisión, inicio
del traslado, remitente/destinatario/transportista y nombres, origen/destino con
ubigeos/direcciones, registro MTC, peso/unidad e ítems con código, descripción,
cantidad y unidad. Exige transportMode 01, reasonCode 01 y regulatedGoods false.
No se adapta un perfil privado 02 o numbered-v1 quitando sus guards.

Flujo:

1. Acotar/copiar ambos originales, validar el perfil completo, recalcular todos
   los hashes y comparar la projection exacta derivada, no solo peso/totales.
2. Leer el registro propietario independiente. La copia completa y hashes de los
   originales deben coincidir con lo pedido; el digest debe ser el del propietario.
3. Construir el XML esperado con el binder existente y verificar la firma RSA-SHA256
   de documento completo contra el certificado público elegido por el propietario.
   La comparación canónica incluye todos los nodos no pertenecientes a XMLDSig;
   una firma válida sobre otro destinatario, transporte, ítem o emisión se rechaza.
4. Verificar cadena, identidad RUC, vigencia, usos de clave y CRL offline mediante
   las clases reales. KeyInfo no elige certificados, roots ni política.
5. Verificar criptográficamente el CDR completo con su pin/PKI; interpretar tipo 09,
   número, emisor/receptor, fechas/horas y código. Un rechazo o referencia ajena no
   produce aceptación. La hora exacta del CDR es obligatoria; no se inventa medianoche.
6. Comparar DigestValue autenticado con el digest del registro propietario,
   releer el registro completo y exigir su misma revisión. El verificador existente
   también relee el pin activo. Detectar mutación del input entre awaits y limitar
   la operación a 30 segundos.
7. Devolver environment BETA, documentId, issuerRuc, fullNumber,
   snapshotSha256 de la projection, cdrSha256 del XML original, responseCode 0,
   status interpretado y acceptedAt exacto. Se preservan observaciones autenticadas.

El serializer existente representa segundos completos. Un issueDate con fracciones
distintas de .000 se rechaza, en vez de redondearlo y afirmar un binding que el XML
no contiene.

### Registro propietario y lo que no está dentro de XML

`CarrierReferenceOwnerBindingPort.current` es una dependencia del servidor,
independiente del body HTTP. Ancla todo el ownerSnapshot, hashes de originales,
digest y revisión. Los UUID/companyId/branchId/operationId no aparecen como UUID
firmados en el perfil UBL: su asociación depende del registro propietario
independiente. No se afirma que una firma XML autentique campos ausentes del XML.

`PrismaCarrierReferenceOwnerBinding` es un adaptador concreto de lectura SUNAT:
requiere FiscalDocument BETA/09, número/emisor exactos, estado ACCEPTED o
ACCEPTED_WITH_OBSERVATIONS, immutablePayload con el perfil público completo,
digestValue y los dos metadatos originales SIGNED_XML y CDR_XML. Selecciona columnas
explícitas por Prisma y no lee credenciales, modifica filas ni crea un registro.
Falla si solo existe CDR_ZIP o un perfil parcial/privado. La selección por estado
del owner no acredita aceptación: la firma y contenido del CDR se verifican siempre.

Si la referencia procede de un propietario externo y ese registro no existe en
SUNAT, el padre necesita aportar una fuente propietaria auténtica por el puerto.
No hay fallback al input como prueba independiente, a una URL recibida, a la base
Billing ni a una fila que este código fabrique. Las pruebas no demuestran que una
instalación actual tenga ya ese registro público completo.

### Límites de evidencia

El CDR de este perfil firma identidades, número y respuesta; no contiene un SHA
firmado del XML/ZIP enviado. La firma del XML verifica su snapshot y la del CDR
verifica su respuesta, con asociación por identidad/número y registro propietario.
No se presenta una correlación local de hashes como campo autenticado por el CDR.
El SHA del ownerSnapshot completo queda ligado al request/registro; la aceptación
mantiene el SHA de projection exigido por el contrato Billing existente.

Las relecturas y CRL/pins vigentes no son un lock distribuido ni garantizan ausencia
de un cambio posterior al último chequeo. No se conceden permisos del transportista,
aceptación oficial general, traslado, numeración, ingestión ni envío.

## Puerto mTLS y protocolo acotado

`CarrierReferenceValidationModule.isolated(core, {billing:[fingerprints]})` instala:

`POST /internal/b2b/carrier-reference-validation`

Solo admite una conexión TLS realmente autenticada cuyo fingerprint pertenezca
al rol Billing configurado. Otro certificado de la misma CA o ausencia de
certificado se rechaza antes de leer el owner. No acepta bearer, query string,
cabeceras repetidas, compresión o transfer encoding en el request.

El host debe habilitar requestCert/rejectUnauthorized, parser JSON estricto con
límite 2 MiB y un filtro global sanitizado para errores del parser anteriores al
controlador. El módulo exporta su filtro; el padre integra estos ajustes sin
que este bloque altere runtime/host config. No se abre un listener automáticamente.

El request v1 contiene schemaVersion, requestId UUID4, environment BETA, asOf e
input de campos exactos. El input contiene ownerSnapshot/projection y sus SHA,
XML/CDR base64 canónico y sus SHA. No hay campos source, URL, filepath, certificado,
clave, contraseña, policy ni approved/verified/trusted.

Límites: 384 KiB por original, 64 KiB de snapshot, 2 MiB de request, 8 KiB de
respuesta y 30 segundos de frescura con tolerancia de reloj de dos segundos.
El servidor no usa red ni selecciona fuentes desde el request; los puertos
propietarios/certificados/política son inyectados por construcción.

La respuesta liga requestId y SHA canónico del request completo, environment BETA,
verifiedAt y aceptación exacta. No devuelve XML, certificados, rutas, revisiones
internas ni diagnósticos de OpenSSL/SQL. Fallos de propietario, PKI, parser o
verificación se sanitizan; indisponibilidad no se convierte en aprobación.

## Cliente Billing opcional

`HttpCarrierReferenceSignatureCdrValidator` implementa la interfaz existente y
está deshabilitado por defecto. Requiere origen HTTPS fijo sin path/query/userinfo,
TLS explícito y fingerprint del servidor SUNAT. Usa únicamente el endpoint fijo
anterior, verifica hostname/CA/pin dentro del handshake, limita tiempo y respuesta,
rechaza redirecciones y valida nonce, hash integral, fechas y aceptación contra
el input original. Nunca propaga diagnósticos privados.

Es un transporte dedicado nuevo porque el allowlist de B2bPrivateHttp compartido
no incluye este endpoint; no se modifica ni se sortea ese allowlist. No hay URL
ni certificado elegibles desde una operación pública.

El padre debe inyectar este cliente en los puntos existentes de validación/
ingestión de referencias de Billing y montar el módulo SUNAT con su owner binding,
pins, resolver público, trust y CDR reales. Este bloque no toca esos ensamblajes
ni afirma que el CLI anterior ya esté completo.

XSD es un puerto adicional opcional tipado al servicio real; si se aporta, se
exige evidencia con perfil/archiveSHA vigentes y SHA de los bytes exactos. No se
convierte una respuesta Boolean en evidencia XSD. Sin ese puerto no se declara
validación XSD ni homologación de reglas SUNAT. No se implementa un pipeline PDF.

## Pruebas y comprobaciones focalizadas

```powershell
pnpm exec vitest run tests/b2b-carrier-reference-validation.spec.ts --maxWorkers=1 --hookTimeout=60000 --testTimeout=30000
pnpm --filter @factuez/sunat-service typecheck
pnpm --filter @factuez/billing-service typecheck
```

52 pruebas con XML/llaves ficticios y mTLS real. Las claves/P12 se generan en
memoria; los archivos temporales contienen solo CA/certificados públicos y CRL
sintéticos. Se ejecutan CertificateTrustService/CdrSignatureTrustService y
OpenSSL reales, sin reemplazar evaluate/verify por un proof prefabricado.

El fixture usa Python cryptography para emitir CA, hojas y CRL firmadas. El motor
OpenSSL aplica cadena estricta y CRL, incluyendo una hoja emisora revocada,
firmante CDR revocado, CRL vencida y una revocación introducida tras verificar
al emisor. Los cambios de pin/revisión del owner y caída del verificador fallan
cerrados. Se prueba también una firma válida sobre campos modificados manteniendo
los mismos totales, digest/metadata, mutación entre awaits, roles TLS, límites,
respuestas cruzadas/vencidas y saneamiento de errores.

Dependencias locales de prueba: Python con cryptography y OpenSSL 3.x real
(`/usr/bin/openssl` en Linux; instalación existente de Git en
`C:/Program Files/Git/usr/bin/openssl.exe` en el ensayo Windows). Las variables
SUNAT_* de política apuntan temporalmente SOLO al material público del fixture;
se restauran después. No se inspecciona un certificado/P12 real ni se descarga
ninguna dependencia.

Resultado observado: 52/52 casos aprobados, typecheck focal SUNAT correcto y
Billing correcto. No se ejecutan PostgreSQL, Docker, migraciones, transmisiones
ni build/regresión global. Las lecturas Prisma se ejercitan con un doble de filas;
no se atribuye a estas pruebas validación del almacenamiento real del despliegue.
