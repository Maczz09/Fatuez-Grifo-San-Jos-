# Corrección GRE e identidad del certificado - alcance de esta implementación

Base: `f53648ced4715df619ed8bccdcb2d54ba7df8698`. Implementación independiente en el worktree `gre-repair-20261125`, sin integración, despliegue ni emisión real.

## Comportamiento

- OAuth GRE transforma el usuario SOL secundario en `RUC + usuario`. Tolera un prefijo del mismo RUC para datos heredados, sin duplicarlo, y rechaza otro RUC o formatos inválidos. El formulario compartido sigue indicando usuario **sin RUC**, porque SOAP de facturas y otros consumidores conservan ese contrato.
- Los tokens siguen en memoria, separados por RUC, cliente y revisión. Se comprueba autorización vigente antes de OAuth y antes del POST. Se admite `token_type` Bearer o JWT: el ejemplo del manual oficial muestra JWT y prescribe el esquema HTTP Bearer.
- El ticket es durable. `98` solo permite repetir la consulta; un POST de recepción incierta no se reenvía automáticamente. `99` sin CDR conserva un código funcional numérico y texto seguro acotado, nunca `exc`, HTML ni trazas.
- Código, descripción y observaciones del CDR se proyectan después de verificar archivo, identidad, documento, fechas y firma. El original se conserva sin alterarlo. La proyección admite hasta 500 caracteres por descripción/observación y 50 observaciones; contenido inseguro se omite.
- La URL QR se obtiene únicamente del CDR aceptado y autenticado: `cac:DocumentResponse/cac:DocumentReference/cbc:DocumentDescription`. **Es un perfil de interoperabilidad observado; ese XPath no se presenta como contrato oficial garantizado de SUNAT.** Ausencia, duplicados o URL maliciosa dejan el QR no disponible y conservan el CDR válido.
- El perfil URL permite solamente `https://e-factura.sunat.gob.pe/v1/contribuyente/gre/comprobantes/descargaqr?hashqr=...`, sin userinfo, puertos, fragmentos, otros parámetros ni redirecciones. El servidor no visita esa URL. Otro host o ruta legítimos futuros requieren revisión explícita del perfil.
- Billing valida los nuevos campos opcionales dentro del evento firmado, su snapshot y secuencia. El PDF A4 vuelve a verificar los originales y el CDR antes de dibujar el QR. Origen sintético, rechazo, estado pendiente o falta de CDR nunca producen un QR oficial.
- `authorizedForTransfer` permanece `false`. Los perfiles de bienes siguen limitados a `NON_REGULATED`: esta implementación no cubre GRE-BF ni autoriza combustible fiscalizado.

## Certificado público e identidad

`GET /api/v1/setup/sunat/:companyId/:environment/public-certificate` utiliza `ConfigurationGuard` y el mismo resolver de empresa/ambiente de `FiscalConfigurationService`. Solo entrega X.509 DER correspondiente a la huella guardada, con `application/pkix-cert`, attachment `RUC-AMBIENTE-publico.cer`, `private, no-store` y `nosniff`. Los buffers abiertos del vault se borran al terminar. El P12, su contraseña y las claves privadas nunca forman parte de la respuesta. La exportación también permite diagnosticar un certificado vencido y no decide si es apto para firmar.

Se reconoce adicionalmente el atributo OU (`2.5.4.11`) con texto exacto `FACTURA ELECTRONICA RUC ` seguido de once dígitos. Es un perfil de interoperabilidad observado en un certificado público autorizado, no una aprobación de SUNAT o de cualquier CA. No se reconoce CN, texto libre, sufijos, prefijos, cambios de mayúsculas, espacios extra ni caracteres bidi. Los RUC conflictivos con OU, serialNumber u organizationIdentifier se conservan para que el verificador los rechace. Todos los consumidores existentes usan el helper compartido; siguen exigiendo firma, huella, uso de clave, cadena y revocación.

El botón de descarga usa el transporte autenticado de la PWA, muestra carga/error, se oculta si no hay certificado y cancela la solicitud si cambia el contexto. No cambia cuentas, ambiente de emisión, concesiones ni habilitación fiscal.

## Diagnóstico de administrador, sin cambios de instalación

Con Node, las dependencias del worktree instaladas y SUNAT compilado (el diagnóstico reutiliza el helper de identidad compartido desde su build local):

```powershell
node tests/production-guides-readonly-diagnostic.cjs --read-only --container NOMBRE_EXACTO_SUNAT --container NOMBRE_EXACTO_BILLING --public-certificate C:/ruta/publico.cer --public-pki C:/ruta/roots.pem --public-pki C:/ruta/crls.pem
```

Usar nombres y archivos públicos explícitos. El script consulta únicamente metadatos de Compose y una lista cerrada de flags, normaliza los valores antes de la salida de Docker, y no vuelca `.env`, credenciales, mounts ni volúmenes. No acepta P12/PFX/KEY. Los archivos son del host que ejecuta el comando: para conocer la lectura efectiva del proceso dentro del servidor, el administrador debe ejecutar el diagnóstico en ese contexto o comprobar por separado los paths públicos montados. El script no demuestra por sí solo permisos del UID del contenedor ni estado en Billing de la empresa.

Para certificados públicos, `identityAttributes` incluye serialNumber, organizationIdentifier y OU (`2.5.4.5`, `2.5.4.97`, `2.5.4.11`). `subjectRucCandidates` utiliza la misma resolución estricta del backend, conserva conflictos y no interpreta CN. El resultado conserva `trustDecision: NOT_EVALUATED`: informar un candidato RUC no verifica confianza criptográfica ni autorización fiscal.

Una vez compilado SUNAT, puede comprobarse criptográficamente una cadena pública sin instalar raíces en Windows/Linux:

```powershell
node tests/production-guides-public-chain.cjs --read-only --public-certificate C:/ruta/publico.cer --root C:/ruta/root.pem --intermediate C:/ruta/intermediate.pem --crl C:/ruta/crls.pem --openssl 'C:/Program Files/Git/usr/bin/openssl.exe' --expected-ruc RUC_ESPERADO
```

El comando reutiliza `CertificateTrustService`: raíz fijada por hash, cadena estricta y `crl_check_all`; falla si faltan evidencias. No consulta AIA/OCSP ni SUNAT. Los hashes son de los bytes exactos PEM montados, no del DER equivalente. La intermedia debe provenir del P12 o del archivo público explícito; importar solo la raíz no completa la cadena.

Preparación de PKI, a revisar por el administrador antes de instalar:

1. Obtener raíz, intermedia y CRLs desde el [repositorio público de la CA](https://llama.pe/repository/), verificar firma, emisor, vigencia, `thisUpdate` y `nextUpdate` de cada CRL y la cadena completa offline.
2. Preparar archivos PEM públicos bajo control de despliegue, sin claves privadas, con lectura para el UID real de SUNAT y mounts de solo lectura. Fijar `SUNAT_TRUST_STORE_FILE`/`SUNAT_TRUST_STORE_SHA256`, `SUNAT_CRL_BUNDLE_FILE`/`SUNAT_CRL_BUNDLE_SHA256` y ejecutable OpenSSL absoluto. El firmante CDR necesita su propia confianza y pin `SUNAT_CDR_SIGNER_CERT_FILE`/`SUNAT_CDR_SIGNER_CERT_SHA256`; la CA del emisor no sustituye ese requisito.
3. Refrescar las CRLs **antes** de `nextUpdate`. Descargar solo a staging, validar allí con `crl_check_all`, calcular hashes de los bytes definitivos, publicar una pareja archivo/hash consistente mediante un despliegue controlado y conservar la evidencia anterior. Una ruta versionada con su hash evita una ventana de inconsistencia entre archivo y pin. Si la CRL falta, caduca o no coincide el hash, conservar el bloqueo; no desactivar la verificación ni restaurar una CRL vencida.
4. La CRL intermedia usada en la comprobación local del 25/11/2026 vence ese mismo día a las **14:40:59 de Lima**. No sirve como pin permanente para la instalación del viernes. Debe descargarse y validarse una versión vigente en cada preparación.

## Integración que falta y no se habilita aquí

- Precisar combustible/bien, modalidad, remitente/transportista y ruta con el usuario; decidir si corresponde GRE-BF. No sustituir esa decisión por un cambio de catálogo.
- Confirmar en cada instalación el Compose efectivo, empresa/ambiente en Billing, flags y revisión del certificado. Un contenedor QA en el puerto 8091 no demuestra composición productiva.
- Revisar y aplicar DDL de Billing y SUNAT con respaldo y control de versiones: concesiones, reservas, jobs, artefactos inmutables y outboxes. No se aplicó DDL en instalaciones reales.
- Componer los módulos y runtimes explícitamente en AppModules solo en una fase posterior. Preparar claves de sellado Billing/STATUS separadas y puertos privados con mTLS, CA y huellas de peers; no publicar rutas privadas en Kong.
- Conectar Identity y la autorización vigente de actor/empresa/sede/punto/serie en todas las operaciones, configurar catálogo `NON_REGULATED`, confianza del emisor/CDR, XSD y revisión de credenciales antes de conceder capacidades.
- Instalar las rutas exactas de certificado público en el gateway adecuado junto con backend/PWA de la misma versión. Esta implementación no abre prefijos privados ni publica rutas nuevas de emisión GRE.
- Conectar la pantalla GRE al owner productivo, relay de estado, worker de ticket, consulta y descarga de originales/PDF; definir operación de conciliación de `UNKNOWN` y observabilidad segura. No presentar QA como emisión oficial.
- Autenticación SOL, registro SEE, recepción y aceptación real requieren una fase posterior explícitamente autorizada. La comprobación criptográfica local del CER no acredita esos pasos.

## Fuentes primarias y evidencia

- [Sistemas de emisión GRE](https://cpe.sunat.gob.pe/node/116).
- [Manual Servicios GRE](https://cpe.sunat.gob.pe/sites/default/files/inline-files/Manual_Servicios_GRE%20(1)_0.pdf), páginas 5-7: username, respuesta JWT de ejemplo y esquema Bearer.
- [Manual URL GRE](https://cpe.sunat.gob.pe/sites/default/files/inline-files/Manual%20URL%20%E2%80%93%20GRE.xlsx): campos ZIP/SHA-256 y estados de ticket.
- [RS 123-2022/SUNAT](https://www.sunat.gob.pe/legislacion/superin/2022/123-2022.pdf): información QR procedente del CDR; no garantiza el XPath de interoperabilidad.
- [GRE de bienes fiscalizados](https://cpe.sunat.gob.pe/tipos_de_comprobantes/guiadebienesfiscalizados): modalidad independiente que este perfil no implementa.

Informe y resultados reproducibles: `output/gre-repair/implementation-report.md`. Evidencia visual sintética: `output/gre-repair/synthetic-*.pdf`, PNGs y `output/playwright/gre-repair/`. Nada de ello acredita un despliegue o una emisión real.
