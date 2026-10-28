# ConexiÃ³n a la API nativa de FactuEz

## DirecciÃ³n y autenticaciÃ³n

TI publica Ãºnicamente el origen HTTPS aprobado del core detrÃ¡s de su nginx. PostgreSQL y Redis no se exponen. El consumidor usa el dominio aprobado o una conexiÃ³n privada/VPN segÃºn la red que configure TI. No debe usar la direcciÃ³n interna de un microservicio. No es necesario entregar a la otra aplicaciÃ³n el certificado P12, SOL, OAuth SUNAT ni contraseÃ±aSMTP.

La API nativa documentada en la PWA, **Conexiones e integraciones â†’ API del sistema**, usa una identidad de usuario vigente con permisos y sedes/puntos/series asignados. `POST /api/v1/auth/login` entrega un accessToken Bearer, tokenType y expiresIn; no crea una cookie. Enviar `Authorization: Bearer ...` en cada operaciÃ³n. Al vencer o revocarse el acceso se requiere iniciar sesiÃ³n explÃ­citamente; no guardar el token ni la contraseÃ±a en logs, URLs, localStorage o cÃ³digo fuente. TI debe autorizar la cuenta y su alcance.

Las sesiones de la PWA tienen su circuito propio de cookie HttpOnly, origen y 30 minutos de inactividad. No sustituirlas por el token externo ni manipular cookies desde el ejemplo. La autenticaciÃ³n OAuth client_credentials del servicio B2B es otro contrato; este ejemplo no habilita su publicaciÃ³n productiva.

## Flujo

1. Consultar `GET /api/v1/auth/me` y `GET /api/v1/documents/catalog/issuance`. Elegir los IDs autorizados de empresa, sede, punto y serie devueltos por el catÃ¡logo. No adivinarlos ni asumir que F001 pertenece a todos los emisores.
2. Construir el cuerpo de `POST /api/v1/documents` segÃºn su schema Swagger actual: INVOICE/SALES_RECEIPT, datos del cliente e Ã­tems. Consultar la vista previa de importes si hace falta. Los perfiles fiscales habilitados se comprueban en el servidor.
3. Guardar una `Idempotency-Key` estable vinculada a la venta ANTES de llamar. Reutilizar esa misma clave y cuerpo para reconciliar una respuesta incierta. No cambiarla ni repetir un POST automÃ¡ticamente tras timeout, reinicio o error 5xx.
4. La respuesta 202 confirma el registro/encolamiento; **no significa aceptaciÃ³nSUNAT**. Guardar documentId y consultar `GET /api/v1/documents/{documentId}` hasta disponer de un estado y evidencia. No editar el snapshot de un comprobante emitido; las correcciones se realizan con las notas admitidas.
5. Descargar PDF actual con `GET /api/v1/fiscal-artifacts/{documentId}/a4` o `/ticket`. El formato se genera bajo demanda; los datos fiscales del snapshot y originales no se cambian con el diseÃ±o.
6. Descargar originales con `/original/xml`, `/original/submission-zip`, `/original/cdr-xml` y `/original/cdr-zip`. Respetar Content-Type y Content-Disposition; un409 puede indicar un original pendiente o una evidencia incompatible. No generar un XML/CDR de reemplazo cuando el servidor lo rechace. En boletas, ZIP/CDR de envÃ­o corresponden al resumen RC vinculado. En 01/07/08 corresponden al envÃ­o individual.
7. Correo documental: autorizaciÃ³nDOCUMENT vigente porRUC/revisiÃ³n y envÃ­o con destinatario confirmado, Idempotency-Key propia y estado consultable. La autorizaciÃ³nTEST no concede DOCUMENT. El perfil v2 admite 01/03/07/08 integrados y exige nueva confirmaciÃ³n si la autorizaciÃ³n era anterior. HANDED_OFF es recepciÃ³n por SMTP, no entrega al destinatario.

## Ejemplo incluido

`examples/native-api-client.ts` puede importarse desde una aplicaciÃ³nTypeScript. El constructor exige un origen HTTPS exacto; HTTP sÃ³lo se permite expresamente para localhost en desarrollo. No hace solicitudes al importarlo ni al construirlo. Sus mÃ©todos son `login`, `me`, `catalog`, `list`, `detail`, `issue`, `pdf`, `original` y `clearSession`. Devuelve bytes de archivos sin guardarlos automÃ¡ticamente.

`login(usuario,contraseÃ±a)` recibe las credenciales por el mecanismo privado de la aplicaciÃ³n consumidora; devuelve sÃ³lo tipo y vencimiento. `issue(cuerpo,claveIdempotenteGuardada)` realiza un Ãºnico intento. Un error `NativeApiError` con indeterminate=true obliga a consultar/reconciliar antes de reenviar. No hay fallback a otra API, RUC, ambiente o clave.

Pruebas offline: `pnpm exec vitest run tests/native-api-client.spec.ts`. No emiten comprobantes ni contactan SUNAT/correo. Este cliente es un ejemplo de la API nativa autenticada, no el SDK completo de B2B ni un certificado de aceptaciÃ³n fiscal.
