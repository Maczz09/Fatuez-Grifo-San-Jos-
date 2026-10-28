# SDK Node: documentos recibidos B2B-08

Bloque LOCAL/BETA, sólo lectura de las APIs existentes. No declara cerrada la
fase 08, no despliega rutas y no activa SUNAT. TI debe configurar el servicio
candidato y sus permisos antes de usar estos ejemplos contra una instalación.

## Qué permite

`@factuez/b2b-sdk` exporta `FactuEzB2bClient`, `B2bSdkError`, las opciones y los
DTO portables. No tiene dependencias de ejecución externas ni importa Nest,
Prisma o los servicios. Necesita Node >= 20.19. Dentro del monorepo se consume
como dependencia `workspace:*`; para otro repositorio, TI debe distribuir el
paquete compilado por su canal privado. No está publicado en un registro público.

| Método | API existente |
| --- | --- |
| `capabilities()` | `GET /b2b/v1/capabilities?environment=BETA` |
| `listReceived({scope,from,to,limit?,after?,type?})` | `GET /b2b/v1/received-documents` |
| `detail(scope,id)` | `GET /b2b/v1/received-documents/{id}` |
| `artifactManifest(scope,id)` | `GET /b2b/v1/received-documents/{id}/artifacts` |
| `downloadArtifact(scope,id,artifactId)` | `GET /b2b/v1/received-documents/{id}/artifacts/{artifactId}/content` |
| `downloadXML`, `downloadCDR`, `downloadProviderPDF` | La misma API de contenido, seleccionada por manifiesto |

Las tres últimas aceptan un `artifactId` opcional. Si hay más de un archivo del
tipo solicitado, es obligatorio elegirlo: no se adivina ni se genera otro.
El resultado `{artifact,bytes}` conserva exactamente los bytes del proveedor.
No se usa el endpoint de archivos emitidos ni se recrean PDF/XML/CDR ausentes.

## Configuración por TI

Entregar a la aplicación consumidora mediante su almacén privado de secretos:

1. Origen HTTPS privado, accesible por intranet/VPN; no abrir la aplicación en
   Internet sólo para usar el SDK. Se admite únicamente un origen, sin usuario,
   contraseña, ruta, parámetros ni fragmento.
2. CA de confianza y certificado/clave **mTLS del consumidor**, en PEM. No son
   el certificado fiscal `.p12` ni las credenciales SOL de la empresa.
3. SHA-256 hexadecimal minúsculo de los bytes DER del certificado del servidor.
   TI debe obtenerlo por un canal autenticado, no confiar en el primer servidor
   contactado. La huella se comprueba además de CA, vigencia y nombre de host.
   Su rotación requiere actualizar explícitamente esta configuración.
4. Proveedor de Bearer B2B autorizado: el SDK lo consulta para **cada petición**,
   con actor explícito `SERVICE` o `USER`. No lee variables de entorno, no
   decodifica JWT ni reutiliza cookies o tokens de la PWA. La obtención/renovación
   del Bearer corresponde al servicio consumidor y a Identity, no a este SDK.
5. Tupla BETA de destinatario: `companyId`, `recipientRuc`, `branchId`. Los
   identificadores son los concedidos por el servidor, no valores elegidos para
   ampliar el acceso.

Se necesitan `b2b:context:read` para capacidades y `b2b:received:read` para
lectura. Los archivos requieren además `b2b:received:artifacts:read` y permisos
independientes vigentes del propietario de documentos recibidos para el RUC,
sede y actor. Tener permiso de emisión no concede acceso a las compras.

## Integración

- [Ejemplo TypeScript](./consumer.ts): recibe credenciales ya obtenidas por TI,
  procesa una página y entrega los originales a un almacenamiento controlado.
  Exporta una función; no ejecuta peticiones al importarlo.
- [Ejemplo PowerShell / curl.exe](./read-example.ps1): función que lee una página
  usando mTLS. No se ejecuta al cargar el archivo y no contiene credenciales.
  Usa configuración por stdin para no poner el Bearer en los argumentos del
  proceso. No activar transcripción, depuración ni trazas de curl.

Los datos de los ejemplos son ficticios. Sustituir sólo por los identificadores
autorizados. No enviar claves por chat ni almacenarlas en este directorio.

## Integridad, límites y errores

El SDK comprueba el contrato versionado, la tupla, el detalle por ítem y los
importes como cadenas decimales. La paginación es keyset vivo por UUID, **no una
copia histórica inmutable**: el llamador decide cuándo usar `nextAfter`. Fechas
inclusivas `YYYY-MM-DD`, máximo 366 días de diferencia, 1–100 filas (25 por defecto).

Cada descarga obtiene un manifiesto nuevo, comprueba nombre/tipo/tamaño/SHA-256
y origen de la respuesta, y vuelve a comprobar el manifiesto antes de devolver
los bytes. Tres peticiones y tres invocaciones del proveedor Bearer. No conserva
caché ni escribe archivos. Guardar por ID en una carpeta privada; el nombre
del proveedor es metadato, **no una ruta de destino segura**.

JSON: máximo 16 MiB, reducible con `maxJsonBytes` (mínimo 1 KiB). Archivo: máximo
10 MiB y nunca más que el tamaño del manifiesto. Cabeceras: 16 KiB. Tiempo total
por petición, incluyendo el proveedor de token: 30 segundos por defecto,
configurable de 100 ms a 120 segundos. No hay reintentos, redirecciones,
descompresión automática, descargas remotas de enlaces ni telemetría.

Errores finitos `B2bSdkError.code`: `INVALID_CONFIGURATION`, `INVALID_REQUEST`,
`TOKEN_UNAVAILABLE`, `TLS_OR_NETWORK_ERROR`, `REQUEST_TIMEOUT`,
`RESPONSE_TOO_LARGE`, `INVALID_RESPONSE`, `REDIRECT_REFUSED`,
`REMOTE_REQUEST_FAILED` (con estado HTTP), `ARTIFACT_NOT_FOUND`,
`ARTIFACT_AMBIGUOUS`, `ARTIFACT_CHANGED`, `ARTIFACT_INTEGRITY_FAILED`.
No incluyen el cuerpo remoto, mensajes internos, tokens ni PII. Un 401/403 debe
resolverse con TI; el SDK no eleva permisos ni repite la solicitud. Tras un
cambio de manifiesto, el llamador puede iniciar otra lectura deliberadamente.

`NOT_VERIFIED`, `NOT_CHECKED` y `officialTrust:false` se preservan. SHA-256
correcto prueba integridad de los bytes recibidos, **no aceptación por SUNAT ni
confianza de firma**. Sólo aparecen originales ya ingresados y asignados al
destinatario/sede: no se inventan ítems con totales SIRE ni se importan compras
por usar este SDK.

## Verificación local

Desde el repositorio, con dependencias previamente instaladas:

```powershell
pnpm exec tsc -p packages/b2b-sdk/tsconfig.json --noEmit
pnpm exec vitest run tests/b2b-sdk-received.spec.ts --maxWorkers=1 --hookTimeout=30000
```

Las pruebas usan certificados efímeros de `tests/b2b-tls.fixture.ts`, servidores
loopback HTTPS y documentos ficticios. Incluyen lectura real por los
controladores existentes, actor USER/SERVICE, archivos exactos, huellas
distintas, JSON malformado, redirecciones, corrupción y revocación. No acceden a
QA, SUNAT, SMTP, certificados fiscales ni información del cliente.
