# P2 - Configuración fiscal segura por RUC y ambiente

Actualizado: 1 de octubre de 2026. Incremento preparatorio, no emisión fiscal.

## Pantalla y API

`/sunat-settings`, usando componentes shadcn existentes. Elegir emisor en la
cabecera y ambiente en esta pantalla. BETA y PRODUCTION guardan credenciales
independientes. Esto **no cambia** el ambiente de Billing ni el de documentos.

Por Kong: `GET/POST /api/v1/setup/sunat/:companyId/:environment`.
Sólo ADMIN de alcance GLOBAL con `sunat.configure`. Identity verifica token y
revocación en cada solicitud; si Identity/Billing caen, se deniega el acceso.
El RUC se obtiene por la API de Billing, no de un header o cuerpo del navegador.
No se comparten Prisma Clients ni conexiones entre servicios.

POST requiere `expectedRevision`, y uno o más grupos completos:

```json
{
  "expectedRevision": 0,
  "certificate": { "fileName": "archivo.p12", "base64": "BASE64_DEL_ARCHIVO", "password": "SOLO_EN_SOLICITUD_HTTPS" },
  "sol": { "username": "USUARIO_SECUNDARIO", "password": "SOLO_EN_SOLICITUD_HTTPS" },
  "gre": { "clientId": "CLIENT_ID", "clientSecret": "SOLO_EN_SOLICITUD_HTTPS" }
}
```

Los valores del ejemplo son marcadores, nunca credenciales válidas. Se conserva
cada grupo omitido; no hay borrado ni rotación de clave maestra automática.
La interfaz confirma RUC/ambiente antes de guardar, limpia campos tras éxito,
no recupera contraseñas y no las escribe en storage/caché del navegador.
Bloquea carga sobre HTTP de intranet; localhost queda disponible exclusivamente
para QA ficticia. En producción servir siempre HTTPS desde Kong y no exponer
el puerto de SUNAT-service. El control de TLS también debe aplicarse al gateway,
no confiar sólo en la interfaz. No habilitar logging de bodies o Authorization.

## Seguridad y límites

- PKCS#12 máximo 512 KB; JSON máximo 768 KB en SUNAT-service.
- Lectura PKCS#12 en worker aislado, máximo dos validaciones simultáneas,
  cinco segundos y heap limitado por worker. No bloquea el event loop de la API.
- Comprobación local de contraseña, par clave/certificado RSA >=2048 bits,
  vigencia, uso de firma si se declara, no CA y ausencia de identidad ambigua.
  Se selecciona el certificado que coincide con la clave, no el primero del PFX.
- Huella SHA-256 y fecha de vencimiento visibles; certificado/contraseñas/SOL/GRE
  nunca salen por GET/POST. Respuestas `private, no-store`.
- AES-256-GCM con nonce aleatorio y AAD ligado a RUC/ambiente/campo/versión.
  PKCS#12 completo cifrado en la BD propia de SUNAT-service; no en public/,
  imagen Docker, XML, repositorio o Redis. Contraseña cifrada por separado.
- Clave maestra externa: `APP_MASTER_KEY_FILE`, 32 bytes codificados base64url,
  base64 o hex. Se utiliza el Docker secret existente; no se crea ni cambia.
  Su ausencia/error falla cerrado. Respaldar clave en custodia separada y
  restringir ACL de secretos/backups al administrador del servidor. Sin la
  clave original no se pueden recuperar los secretos cifrados.
- Auditoría transaccional: ID externo del administrador, RUC, ambiente, nombres
  de grupos, revisión y fecha. Nunca guarda valores del cuerpo o secretos.
- Bloqueo PostgreSQL por par fiscal y `expectedRevision`: conflicto 409 si otra
  sesión cambió la configuración. No sobrescribir silenciosamente.
- node-forge actualizado de 1.3.1 a 1.4.0 por las correcciones del proveedor:
  [notas de versión oficiales](https://github.com/digitalbazaar/forge/blob/main/CHANGELOG.md).
  Validación de clave/certificado y autofirma por OpenSSL/Node, no por Forge.

**No se validan aún cadena de confianza/revocación del certificado, vinculación
fiscal del RUC ni registro en SOL.** Un autofirmado sólo permite QA local y se
muestra como tal. `trustAndRucVerified=false` y `fiscalTransmission=false` siempre.
Guardar credenciales de producción no activa transportes, firma, pruebas de
conexión ni OAuth. Ningún proceso de este incremento solicita tokens/envía CPE.
SUNAT exige la identidad/RUC correspondiente; completar ese control antes del
piloto fiscal: [certificado digital](https://orientacion.sunat.gob.pe/04-certificado-digital)
y [SEE del contribuyente](https://cpe.sunat.gob.pe/sistema_emision/see_contribuyente).

## Base de datos y pruebas

`services/sunat-service/prisma/fiscal-configuration-expand.sql` es aditivo:
columnas cifrado/autofirma/revisión y tabla propia de auditoría. Si lo ejecuta
el DBA, concede sólo SELECT/INSERT de esa tabla al propietario de la base
de SUNAT-service, nunca a PUBLIC ni a roles de otras bases. Respaldar primero;
no usar `db push`, reset o down -v para instalaciones con datos. Los secretos
legados no se importan ni recifran automáticamente; conservar la clave original
y revisar su formato antes de una migración específica.

QA se mantiene en `factuez-stage2-qa` (8091), separada de `factuez-demo` (8080).
No se reconstruyen los servicios ni migran bases de 8080 en esta entrega.
Respaldo QA previo: `backups/qa-sunat-before-config-20261001.dump`, ignorado en Git.
La expansión conservó 6 documentos, 18 artefactos y 0 credenciales existentes.

```powershell
pnpm test:fiscal-config
pnpm test:fiscal-config:e2e
pnpm test:stage2:e2e
pnpm typecheck
```

E2E sólo permite 8091 y exige demo sin transmisión: crea dos emisores ficticios
rotulados PRUEBA, certificado autofirmado temporal y secretos aleatorios de QA.
Comprueba actualización parcial, revisiones, ambientes/RUC aislados, ausencia de
secretos en respuesta, acceso 401/403 y revocación. Desactiva su usuario temporal
al terminar; no toca la configuración del RUC real ni registra documentos fiscales.

Validado en 8091: E2E de configuración y PDF aprobado; una configuración ficticia
persistida, dos auditorías, cero envíos y cero CDR. Se descifró sólo en memoria
para comprobar correspondencia del PKCS#12/huella y rechazo del ambiente incorrecto,
imprimiendo únicamente booleanos y conteos. El runtime tiene SELECT/INSERT sobre
la auditoría, no DELETE. La cuenta temporal quedó desactivada; sólo `demo.admin`
permanece activa. Pruebas locales: 81 aprobadas en conjunto y worker real validado
con dos operaciones concurrentes/tercera limitada. TypeScript/Prisma/Next correctos.
QA visual: dashboard/acceso sin nombre ni frase de colaboración, nueva pantalla
sin secretos visibles ni desbordamiento horizontal y Beta/Producción separados.

## Lo siguiente

Completar confianza/vinculación/registro del certificado y perfil UBL verificable;
después firma local verificada/ZIP en Beta, adaptadores/CDR y flujo RC/RA separado
para boletas. QR/hash y PDF fiscal sólo a partir de datos auténticos. Correo,
WebSockets, notas, GRE y corte histórico continúan pendientes.
