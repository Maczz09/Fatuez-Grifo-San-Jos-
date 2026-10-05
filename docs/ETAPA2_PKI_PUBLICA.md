# ETAPA 2 — PKI pública del piloto 20615878481

Resultado: **cadena del certificado público de la factura y revocación verificadas independientemente**, con las CRL principal y espejo por separado. El CDR Beta observado **no es autenticable**: su `SignatureValue` no es Base64 válido y su bloque `X509Certificate` no contiene un X.509 público válido. Esto aporta evidencia pública para preparar el piloto normal; no acredita confianza fiscal completa ni sustituye sus gates.

Validación final: **2026-10-03T04:22:43.217Z**, equivalente a **2026-10-02 23:22:43.217 America/Lima**. Epoch usado por OpenSSL: `1791001363`, obtenido del reloj real de esa ejecución. No se retrocedió la fecha para hacer pasar certificados o CRL.

## Alcance y archivos

Se añadieron únicamente este documento, `tests/beta-public-pki.inspect.cjs` y 14 archivos de certificados/CRL públicos en `tmp/beta-public-pki/20615878481-20261002/`. Los artefactos públicos se escribieron con `flag: 'wx'`. La prueba de una segunda descarga obtuvo `WX_TARGET_ALREADY_EXISTS`, exit 1, y comprobó que todas sus huellas permanecían iguales.

Los únicos XML leídos fueron los dos autorizados de `tmp/beta-pilot/20615878481-20261002/`. No se imprimió el sujeto personal del certificado final, sus SAN ni su número de serie. Los nombres publicados en este informe corresponden exclusivamente a autoridades. La salida cruda de `openssl verify` se captura y se resume mediante códigos y SHA-256, porque sus errores pueden incluir el sujeto del certificado final.

No se importó ni ejecutó `beta-trust.public-metadata.cjs`. Tampoco se ejecutaron `prepareBeta`, `cert20615878481` ni el envío del piloto: esta inspección permanece dentro del alcance público. No se accedió a P12/PFX, SecretVault, DB, SMTP, SUNAT SOAP, OAuth o producción. No se modificaron archivos de otros agentes, configuración, gates, variables de entorno ni almacenes de confianza del sistema o de la aplicación.

## Fuente oficial y procedencia

Se consultó mediante la herramienta web actual y mediante HTTPS normal el [repositorio primario de RENIEC](https://pki.reniec.gob.pe/repositorio/). Su página publica ROOT 3, ECEP-RENIEC, sus huellas públicas y las CRL de esas autoridades. Los certificados y CRL se descargaron exclusivamente desde enlaces de ese repositorio o desde las URI RENIEC exactas embebidas en el certificado de la factura.

La descarga del HTML fue el `2026-10-03T04:19:42.317Z`; su SHA-256 fue `df8238177cb1772562bd9791e9b903e3b33a6452e78b88df7f115e2c7b7e8064`. No se guardó un HTML ni un informe JSON adicional. No se siguieron redirecciones ni se consultó OCSP; su URI se informa solamente como metadato público.

La página HTTPS oficial publicaba para ROOT 3 la huella SHA-1 `e611d33d29857be83b5003704bb61c9883ed8ded`, y para ECEP-RENIEC `2fe0a4ab97544334c122bb142e39e91f69607647`. Ambas coincidieron con los DER descargados. Esas huellas históricas corroboran la procedencia; los pins operativos independientes de esta inspección son los SHA-256 indicados abajo. No se atribuye a la página una publicación de SHA-256 que no proporciona.

Los enlaces de distribución usan HTTP tal como los publica RENIEC y como aparecen en AIA/CDP. No hubo desactivación de TLS: la consulta del repositorio utiliza HTTPS con `rejectUnauthorized: true`. Las descargas se contrastan con pins y las firmas se verifican offline. Ninguna raíz se acepta simplemente por aparecer en una respuesta AIA.

## Certificados y URI exactas

El parser `parseASN1GeneralName6` exige el tag primitivo `0x86`, longitudes DER exactas e IA5 ASCII válida, y devuelve exclusivamente los octetos de la URI. AIA se recorre por `AccessDescription` y OID; CDP por `DistributionPoint/fullName`. No se busca una URL con regex sobre todo el certificado. Las pruebas rechazan bytes ASN.1 externos, incluidos los sufijos `0&/06`, truncamiento, tags incorrectos y longitudes no mínimas.

Cadena comprobada:

```text
Certificado público embebido en factura — sujeto omitido
  → ECEP-RENIEC CAClass 1
  → ECEP-RENIEC
  → ECERNEP PERU CA ROOT 3 — raíz fijada por SHA-256
```

| Certificado | Clave pública | Inicio UTC | Fin UTC | SHA-256 del DER |
| --- | --- | --- | --- | --- |
| Final de factura, sujeto omitido | RSA 2048 | 2026-10-02 20:00:08 | 2029-10-01 20:00:08 | `d37b6eb06c4bfd3aba66e9630b84d28689bab2be595343643de02d61b971df8c` |
| ECEP-RENIEC CAClass 1 | RSA 4096 | 2025-03-20 17:23:34 | 2033-03-20 17:23:34 | `6c9d72e967d8e5f6435090851ddb7493525b141d6d5f6a8afc2280ff4f504c56` |
| ECEP-RENIEC | RSA 4096 | 2017-08-10 20:31:59 | 2033-08-10 20:31:59 | `91520e1f381a46402b9490c06749b2d81ddad4b53e7f252a1dd79b55dfcb340b` |
| ECERNEP PERU CA ROOT 3 | RSA 4096 | 2017-08-10 17:31:52 | 2042-08-10 17:31:52 | `96508217c36f3bbc556e2e07d7ab50c40da8027c388235813322e41b87a568be` |

Los DN de ECEP-RENIEC y Class 1 contienen `C=PE`, `O=Registro Nacional de Identificación y Estado Civil`; ROOT 3 contiene `C=PE`, `O=Entidad de Certificación Nacional para el Estado Peruano`. Los CN son los de la tabla. No se publica ningún DN del certificado final.

| Origen | URI exacta observada / descargada |
| --- | --- |
| AIA `caIssuers` del certificado final | [caclass1r.crt](http://crt.reniec.gob.pe/crt/sha2/caclass1r.crt) |
| CDP principal del certificado final | [caclass1r.crl](http://crl.reniec.gob.pe/crl/sha2/caclass1r.crl) |
| CDP espejo del certificado final | [caclass1r.crl en crl2](http://crl2.reniec.gob.pe/crl/sha2/caclass1r.crl) |
| AIA de Class 1 y enlace del repositorio | [ecep.crt](http://www.reniec.gob.pe/crt/sha2/ecep.crt) |
| Enlace de ROOT 3 del repositorio | [ecernep.crt](http://www.reniec.gob.pe/crt/sha2/ecernep.crt) |
| CDP de Class 1 y enlace del repositorio | [ecep.crl](http://crl.reniec.gob.pe/arl/sha2/ecep.crl) |
| CDP de ECEP y enlace del repositorio | [ecernep.crl](http://crl.reniec.gob.pe/arl/sha2/ecernep.crl) |

El AIA OCSP del certificado final es `http://ocsp1.reniec.gob.pe`; no se contactó. `caclass1r.crt` es la autoridad reemitida que corresponde al certificado observado. Su identidad se seleccionó por AIA, pin, emisor y firma, no solamente por similitud de nombres en el catálogo.

RENIEC sirve `caclass1r.crt` como una cadena pública con tres bloques PEM y texto de autoridades; `ecep.crt` contiene dos. El inspector valida el hash del archivo completo y el DER de cada CA de esos bloques. Los PEM normalizados se extraen por separado y la raíz utilizada se contrasta también con la descarga oficial independiente de ROOT 3.

## CRL vigentes en la ejecución

| CRL | Firmante | Número hexadecimal | thisUpdate UTC | nextUpdate UTC |
| --- | --- | --- | --- | --- |
| Class 1 principal | ECEP-RENIEC CAClass 1 | `0162` | 2026-10-02 05:00:22 | 2026-10-03 05:00:22 |
| Class 1 espejo | ECEP-RENIEC CAClass 1 | `0163` | 2026-10-02 22:00:22 | 2026-10-03 22:00:22 |
| ECEP | ECEP-RENIEC | `23` | 2026-07-20 16:15:09 | 2027-01-16 16:15:09 |
| ROOT 3 | ECERNEP PERU CA ROOT 3 | `0e` | 2026-06-01 20:34:26 | 2027-06-01 20:34:26 |

Principal y espejo no son idénticos: el espejo llevaba una edición posterior. Ambas copias tenían firma válida, estaban vigentes y permitieron validar por separado la cadena completa del certificado final con `-crl_check_all`, sin resultado de revocación para esa cadena en ese instante.

**Caducidad de esta evidencia:** la CRL principal vence el **2026-10-03 00:00:22 en Lima**; la del espejo, el **2026-10-03 17:00:22 en Lima**. El inspector requiere que todas las CRL fijadas sigan vigentes y falla después del primer vencimiento, aunque la otra ruta aún sea válida. Esta copia es evidencia temporal, no un mecanismo de actualización ni una autorización permanente. Actualizar exige una nueva inspección de descargas actuales y pins revisados, sin sobrescribir esta evidencia ni retroceder el reloj.

## Ejecución independiente con OpenSSL

Windows no exponía un ejecutable `openssl` nativo. Se usó OpenSSL **3.0.22**, versión verificada en la imagen local inmutable:

```text
sha256:d33e1d2100d1accd204cc4e265de5321aaea113b824bc9fa2403dc723f8b2e32
```

Cada ejecución utilizó `docker run --rm --pull=never --network none --read-only --cap-drop ALL --security-opt no-new-privileges --pids-limit 32 --memory 128m`, con entrypoint `/usr/bin/openssl`. Sólo se montó la carpeta pública indicada, en lectura, en `/pki`; las CRL individuales se suministraron por stdin. La imagen no declara volúmenes automáticos (`Config.Volumes = null`). No se montó el proyecto, una configuración, un volumen DB, un socket Docker ni un almacén global; no se suministraron flags de entorno.

Los argumentos centrales de las dos comprobaciones de cadena fueron:

```text
verify -no-CApath -no-CAstore
  -CAfile /pki/ecernep-root3.pem
  -purpose any -auth_level 2 -x509_strict -check_ss_sig
  -attime 1791001363
  -untrusted /pki/intermediates.pem
  -crl_check_all -CRLfile /pki/crls-primary.pem
  /pki/invoice-leaf.pem
```

La segunda comprobación sustituyó únicamente el bundle CRL por `/pki/crls-mirror.pem`. Estos argumentos quedan registrados en la salida JSON del inspector; en cada nueva ejecución el epoch se calcula del reloj actual. El nivel 2, strict, el propósito any y las comprobaciones de fecha/revocación permanecen obligatorios.

Además de OpenSSL, `node:crypto` comprobó independientemente las firmas e identidades de emisión del certificado final, Class 1, ECEP y la autofirma de ROOT 3. Las cuatro CRL se verificaron individualmente con la clave pública de su autoridad. Alterar un bit de cada firma produjo rechazo. En OpenSSL 3.0.22, `crl -verify` puede devolver exit 0 también al rechazar una firma: el inspector exige explícitamente `verify OK` para aceptar y `verify failure` para la prueba negativa.

Eliminar toda raíz de confianza con `-no-CAfile -no-CApath -no-CAstore` produjo exit 2 y error 20 en depth 2. Esta prueba confirma que las CA intermedias no se convierten automáticamente en raíces de confianza.

Las 13 pruebas internas y las 13 comprobaciones OpenSSL, incluidas las negativas esperadas, pasaron. La ejecución final de `--verify` devolvió exit 0.

| Evidencia | SHA-256 |
| --- | --- |
| Inspector final | `5a74f6b340047787cbc91af2e5788f64156e9121c8b41bf124926f0b148ec254` |
| Salida JSON completa de la ejecución final | `c57d04aed4a82f68248e3b5f67ca856e05ba5f07f68fcfff0dd6d1830aa14339` |
| stdout de la cadena principal y del espejo, ambos exit 0 | `7b343d9ca63e95837194b4b39fb053e62b7f6ce0136a3752bcade543acd7ed24` |
| stderr vacío de ambas cadenas | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| stderr de cada CRL válida, `verify OK` | `d35a38bf57642d07e0e940451a237cc1aac2f36952ee017e085166d2450bd9f8` |
| stderr de cada CRL alterada, `verify failure` | `5eb872a0b48e1d1827819cef356bea25379c418df2f705cd912e1270bac2a1e6` |
| stderr de la prueba sin raíz confiable, exit 2 | `2c5b173ab34ddc19a6ad6cfb828593328e6967a6ebc38917fc8ce5d78d440435` |

El hash del JSON identifica aquella ejecución concreta; una repetición cambia los campos del reloj y por ello su hash. Los hashes de archivos y de las salidas deterministas de OpenSSL permiten contrastar la evidencia por separado. No se guardaron diagnósticos crudos que revelaran el sujeto final.

## Inventario público y hashes de archivo

En `tmp/beta-public-pki/20615878481-20261002/`:

| Archivo | SHA-256 del archivo |
| --- | --- |
| caclass1r.crt | `cada3d2585c4f9359341cbcde7d63c98bbc8e87ade33042a31520507807a2047` |
| ecep.crt | `23ecc41dfc0fb0424f399062dd3e853d0eb6b48acc059d5aacceace81634537b` |
| ecernep-root3.crt | `96508217c36f3bbc556e2e07d7ab50c40da8027c388235813322e41b87a568be` |
| caclass1r-primary.crl | `f67ebbcc679ae596e1ffa2e4aa46a31f96ed14f863f74e0c8cfa8365d403da16` |
| caclass1r-mirror.crl | `00ff0b26a6edc44ea08eabac050395eea2208574660e5aa573779257916c25a3` |
| ecep.crl | `931fe7fa0b1ac45f193b5442139d0a2156086a469fc92a0744d717531c065095` |
| ecernep-root3.crl | `131163cc73d94f9ad5f52e2de2a534efe174adc8b8f14a3618572e19a8191694` |
| invoice-leaf.pem | `284bf4afa0f2f84dd3feac555e51775e1e2afaa00152218ff89fb2aa9ea3e5d4` |
| caclass1r.pem | `993d063df0a733c8b1ddf247c4f5eff89b070e7d563aa96bd178771fc217ee59` |
| ecep.pem | `4bb60f6c37ea32aa996ee48eb93257d3c85b4173607d505461d8e335c713bfd5` |
| ecernep-root3.pem | `5eba03b0cbb42c9882834d2b23206f8857c522f967be3b403a57579ad34f0c0f` |
| intermediates.pem | `3c825659aa5934c0490a565d83b9511aff8e14e33386ba9e3a9ca37b0dc1383b` |
| crls-primary.pem | `9d3395eea2bda0813ee8429d90fb42c2be5880baecd1a8de7665ed692c9ff838` |
| crls-mirror.pem | `b5a7abf29ecc940de27f5cd66255fe734a0a47561508f4aed83e3e9d2e1b3949` |

## XML y límite fiscal

La factura tiene un único `Signature` en el namespace XMLDSig y un certificado público X.509 utilizable. El elemento UBL `cac:Signature` no se cuenta como XMLDSig. SHA-256 del XML autorizado: `aae30a18b5ad395ecd11e7f27ca6029cd3cf618decabb8e100662f1b2c20b5e6`.

El CDR Beta también presenta estructura XMLDSig, pero su `SignatureValue` no es Base64 válido y su bloque de certificado no aporta un X.509 válido. Por ello el estado es `UNAUTHENTICATABLE_NO_VALID_SUNAT_PUBLIC_LEAF`; no hay una clave pública final SUNAT utilizable dentro del único CDR autorizado. No se afirma que el CDR carezca de etiquetas de firma, ni que SUNAT no tenga una PKI: la limitación pertenece a este archivo concreto. SHA-256 del CDR: `bb4fe9dfbbb65a956407b89ce53de85a5c4fd53423d69f15df89c4c4a83d8c37`.

Esta tarea verifica cadena y revocación del **certificado** de la factura. No verifica digest, canonicalización ni firma XMLDSig del documento, ni configura esa confianza en la aplicación. La evidencia pública permite preparar los insumos de la siguiente etapa del piloto, conservando los gates normales. No habilita un envío, una aprobación de CDR ni una certificación fiscal automática. El piloto completo continúa necesitando la validación XMLDSig y evidencia CDR auténtica que satisfagan sus requisitos existentes.

## Uso del inspector

Comandos sin escritura ni red:

```powershell
node 'D:\Facturacion\FactuEz\tests\beta-public-pki.inspect.cjs' --self-test
node 'D:\Facturacion\FactuEz\tests\beta-public-pki.inspect.cjs' --inspect
```

Comprobación offline de la copia existente, con Docker local y sólo montaje público en lectura:

```powershell
node 'D:\Facturacion\FactuEz\tests\beta-public-pki.inspect.cjs' --verify
```

`--download` se utilizó una vez para crear exclusivamente esta copia. Ahora debe rechazar la sobrescritura antes de contactar el repositorio. El inspector no admite rutas, imágenes, fecha o parámetros de relajación alternativos. Todos los informes se emiten por stdout; no se crea ningún archivo adicional de estado o configuración.
