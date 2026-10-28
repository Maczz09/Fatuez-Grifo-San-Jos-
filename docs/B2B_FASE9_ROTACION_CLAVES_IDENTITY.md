# B2B-09 — Rotación de la clave de firma de acceso B2B

Fecha: 26/10/2026, Lima. Implementación técnica LOCAL/BETA; no desplegada en 8091.

## Resultado

`B2bTokenCodec` admite opcionalmente una clave pública anterior durante el cambio
de la clave privada que firma los tokens SERVICE. Los tokens nuevos se firman
exclusivamente con la clave activa. Los ya emitidos conservan su expiración
original, sin renovación automática ni ampliación de sus permisos.

El solapamiento tiene un máximo fijo de **300 segundos desde el instante de
cambio**. Sólo se admite una clave pública anterior; no se carga su clave privada.
Sin la opción explícita de rotación se conserva el comportamiento de una sola
clave. La misma forma permite retirar inmediatamente una clave comprometida,
componiendo Identity sólo con la clave activa y sin solapamiento.

Este bloque cambia la custodia de la firma de acceso B2B, no el certificado
SUNAT .p12/.pfx ni los XML/CDR. No cambia las credenciales SOL/GRE/SIRE, SMTP,
OIDC, TLS, las claves del vault de webhooks, el pepper ni las claves de respaldo.
La rotación de credenciales de cada aplicación ya existente sigue siendo una
operación distinta, autorizada con step-up y revisión de cliente.

## Controles implementados

- RS256 y claves RSA de al menos 2048 bits; `kid` derivado de la clave pública.
  No se acepta el identificador que declare un archivo o una solicitud externa.
- Clave anterior en formato público SPKI PEM. Se rechazan claves privadas,
  débiles, reutilizadas como activa o coincidentes con las de separación humana,
  integración y TLS aportadas por la composición existente.
- Instante de cambio explícito, en segundos Unix. No puede estar en el futuro;
  no hay parámetro para prolongar el plazo de gracia.
- Un token firmado con la clave anterior debe haber sido emitido antes o en el
  segundo del cambio. Un firmante antiguo que continúe emitiendo después del
  cambio no produce tokens aceptables en el nuevo verificador.
- Se mantienen audiencia, emisor, ambiente BETA, tipo SERVICE, revisión, scopes,
  firma, formato canónico y vigencia exacta de cinco minutos. No se siguen URLs
  de claves ni se confía en claves incorporadas en el propio JWT.
- Identity sigue consultando el estado vigente de la aplicación y escribiendo
  auditoría. Deshabilitarla, cambiar su revisión/permisos o rotar su secreto de
  cliente invalida el acceso durante el solapamiento. Los fallos de base o
  auditoría no permiten saltar esos controles.
- El JWKS **privado existente**, protegido con mTLS, publica activa y anterior
  durante el plazo. Después publica sólo la activa. Mantiene `private, no-store`;
  nunca contiene parámetros privados. No se añadió un endpoint público.
- Reloj inválido o que retrocede respecto del último instante observado por esa
  instancia bloquea la operación. Un límite monotónico y una marca irreversible
  local impiden reactivar una clave retirada dentro del mismo proceso.

La protección temporal local no es un reloj distribuido persistente. TI debe
mantener la hora sincronizada y la misma configuración en todas las réplicas,
también después de un reinicio. JWKS permite verificar firmas; **no sustituye la
introspección y autorización actual** de Identity ni los permisos del propietario.
Una firma válida por sí sola no concede acceso a un RUC, sede o comprobante.

## Composición privada

La extensión está en `services/identity-service/src/b2b/token.ts`. El quinto
argumento es opcional y no lee variables de entorno, archivos, claves o red.
Los materiales aprobados los aporta el despliegue de TI, sin enviarlos al chat.

```typescript
const codec = new B2bTokenCodec(
  approvedCurrentPrivateKeyPem,
  fixedB2bIssuer,
  () => Math.floor(Date.now() / 1000),
  separationPublicKeys,
  {
    previous: {
      publicKey: approvedPreviousPublicKeyPem,
      cutoverAt: approvedCutoverUnixSeconds,
    },
  },
);

const metadata = codec.rotationStatus();
```

`rotationStatus()` devuelve una copia con `activeKid`, `previousKid`, estado
`SINGLE_KEY / OVERLAP / RETIRED`, instante de cambio, límite de verificación y
duración del token. No devuelve PEM, contraseña, secreto ni token. Es metadato
local del operador, no una autorización, aprobación o journal persistente de
rotación. TI debe registrar y conservar la evidencia del cambio por separado.

## Secuencia operativa preparada

1. Inventariar las instancias que emiten y verifican tokens, fijar el emisor HTTPS
   y comprobar hora, separación de claves, custodia y permisos del nuevo material.
2. Programar una ventana y detener la emisión con la clave anterior en **todas**
   las instancias implicadas. Un drain de la fachada B2B no demuestra que Identity
   u otros emisores estén detenidos; su coordinación sigue siendo requisito.
3. Registrar el instante de cambio y desplegar el firmante nuevo más la clave
   pública anterior en las instancias. Reabrir la emisión sólo después de comprobar
   que coinciden los identificadores y la configuración. No se promete despliegue
   gradual sin coordinación ni operación automática sin ventana.
4. Verificar emisión nueva, introspección de un token anterior aún vigente, JWKS
   privado, rechazo por permisos revocados y ausencia de materiales privados en
   las respuestas. No ampliar la vida de tokens para compensar una incidencia.
5. Transcurrido el plazo, comprobar estado `RETIRED`, rechazo de tokens anteriores
   y JWKS con la activa únicamente. En el siguiente despliegue retirar también la
   opción anterior. Conservar la evidencia y aplicar la custodia acordada.

Ante compromiso, usar la composición sin clave anterior para revocación inmediata
del firmante. No restaurar una clave comprometida como mecanismo de rollback.
Un cambio posterior a otra clave exige otra decisión, instante y despliegue
coordinados; conservar el secreto de una aplicación no autoriza reutilizar firmas.

## Verificación

Pruebas: `pnpm test:b2b-key-rotation`.

Se aprobaron 82 pruebas en cuatro archivos: 14 casos unitarios nuevos, dos ensayos
HTTP/mTLS nuevos y 66 verificaciones existentes de identidad. Se cubren cambio
del firmante, expiración original, rechazo del firmante antiguo después del
cambio, separación, algoritmos, claves desconocidas, metadatos, reloj,
revocación de aplicación, secreto y scopes, y fallos de almacenamiento/auditoría.

El ensayo HTTP cierra una aplicación Identity y construye otra con la clave nueva
sobre el mismo store transaccional **ficticio en memoria**. Usa el cliente real
del RPC, OAuth y JWKS por HTTPS/mTLS de loopback. No simula restaurar PostgreSQL,
cambiar claves reales, coordinar réplicas o desplegar en la intranet del cliente.

Compilación de Identity/dependencias: tres tareas correctas. Tipos globales:
29 tareas correctas en 22 paquetes. Informes:
`output/qa/b2b-phase9-key-rotation-focused.json` y
`output/qa/b2b-phase9-key-rotation-typecheck.log`.

Regresión general final: **284 archivos, 11.924 pruebas aprobadas, cero fallos y
una omisión condicional preexistente**, en 269,28 segundos. El proceso terminó
con código cero. Informe: `output/qa/b2b-phase9-key-rotation-regression-final.json`.
La omisión XSD de `fiscal-batch.spec.ts` requiere su runtime opcional y no se
cuenta como aprobada ni acredita homologación fiscal. Los grupos de pruebas se
solapan; no se suman como un total adicional. No se crearon contenedores ni se
leyeron credenciales o certificados reales en estos ensayos de rotación.

## Límites y continuidad

No se tocaron bases existentes, credenciales o certificados del cliente ni el
stack 8091. No se añadieron rutas, scopes, migraciones, timers ni activaciones
automáticas. La rotación requiere configuración privada explícita.

B2B-09 continúa para cerco global de escritores, retención de otros almacenes,
respaldo integral, rotación de las otras familias de claves, observabilidad,
despliegue Windows y piloto privado autorizado. Este bloque no cierra los gates
fiscales ni la migración o el corte contable.
