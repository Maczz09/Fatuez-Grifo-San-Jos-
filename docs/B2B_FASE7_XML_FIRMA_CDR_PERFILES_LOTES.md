# B2B-07 — XML, firma, CDR, perfiles y lotes

Actualizado: 2026-10-23. Desarrollo/Beta local exclusivamente.

Continuación y verificación final: [cierre técnico B2B-07](B2B_FASE7_CIERRE_TECNICO.md).
El documento enlazado reúne los adaptadores persistentes 31/RC2/SERVICE y las
APIs añadidas después de la primera entrega descrita aquí. No implica despliegue
ni habilitación fiscal oficial.

## Entrega implementada

### Guía 09: circuito local integrado

`GuideArtifactPipeline` obtiene la operación numerada mediante lectura privada
autorizada de Billing. `PrivateGuideArtifactOwner` exige permisos independientes
de emisión o lectura, valida al actor SERVICE/USER, los tres identificadores de
serie y el alcance RUC/sede/punto. Usa los RPC mTLS existentes de Identity/Billing;
no comparte bases entre microservicios ni acepta un XML enviado por el consumidor.

El XML se reconstruye del snapshot íntegro reservado, con contrato y perfil
versionados, no de la propuesta de vista previa. La firma XMLDSig RSA/SHA-256 se
verifica nuevamente contra el documento completo y el certificado público del
RUC. Se valida el contenido único del ZIP, cabeceras, tamaños y CRC. La identidad
del certificado no acredita por sí sola confianza PKI, inscripción o habilitación.

`PostgresGuideArtifactStore` conserva los originales en `GuideLocalArtifact` y
`GuideLocalCdr`: XML sin firma, XML firmado, ZIP y certificado **público**, y ZIP
CDR original separado. No guarda P12, contraseña ni clave privada. Escrituras
append-only; SQL prohíbe modificar, eliminar y truncar. Identidad fiscal única
por RUC/número y operación/documento únicos. Los replays verifican nuevamente
firma y bytes, sin asignar otro correlativo. Un CDR diferente causa conflicto,
no reemplazo silencioso. PDF bajo demanda y originales fiscales son cosas distintas.

La prueba PostgreSQL encontró y corrigió la carrera de dos preparaciones
simultáneas: una instantánea serializable anterior a la espera del bloqueo puede
producir `23505`. El reintento local acotado vuelve a autorizar y recupera el
original; una colisión fiscal con otra operación permanece bloqueada. No hay
efectos externos dentro de este reintento.

`GuideDispatchCdrReview` enlaza los bytes del CDR con el SHA del resultado del
diario durable local. La cadena probada es: productor numerado → XML/firma/ZIP
archivados → intención durable → ticket del emulador → resultado → CDR firmado
verificado y archivado. Reiniciar/consultar no repite el envío ni la numeración.

### Firma y CDR

`signLocalGuideXml` comprueba la identidad del XML y del certificado, firma y
empaqueta de forma reproducible. `verifyGuideIssuerXmlTrust` permite al propietario
conectar el verificador offline existente con certificado público fijado,
cadena/CRL, vigencia, identidad RUC y comparación del XML completo.

`verifyGuideCdrEvidence` comprueba ZIP, UTF-8, emisor SUNAT, receptor, tipo/número,
fechas, respuesta y firma mediante el verificador inyectado por el propietario.
Código `0`, hash correcto o `KeyInfo` no sustituyen esa verificación. Se conserva
también una respuesta rechazada autenticada.

El CDR de este perfil no autentica los hashes locales del XML/ZIP de solicitud:
`requestHashesBoundByCdr=false`. La correlación con ellos se conserva en el dueño
de la operación y en el diario; no se inventa un campo firmado inexistente.
Las pruebas usan PKI efímera, no la cadena ni el certificado oficiales de SUNAT.

### Perfiles 09 y 31

- 09 numerado: traslado 04, transporte privado 02 y bienes no fiscalizados.
- 31: contrato independiente `factuez.carrier-guide-input.v1`, transporte público
  terrestre, una referencia 09 íntegra, vehículo/TUC, conductor/licencia, MTC,
  remitente/destinatario, pagador remitente, sin subcontratación ni bienes
  fiscalizados. `createCarrierGuide31Profile(owner)` verifica la referencia por
  un puerto privado antes/después de construir el XML. Nunca completa datos
  faltantes con valores ficticios ni convierte un borrador viejo en guía válida.
- El contrato antiguo de guía no representa todos los datos de una 31 y sigue
  rechazándola. El perfil nuevo no levanta ese bloqueo implícitamente.
- Ambos XML **firmados** se ensayaron contra el paquete XSD local fijado por SHA.
  XSD estructural correcto no significa reglas SUNAT completas o aceptación.

Fuentes primarias revisadas: [portal técnico GRE](https://cpe.sunat.gob.pe/node/116)
y [RS 123-2022, anexos, guía transportista](https://www.sunat.gob.pe/legislacion/superin/2022/anexo-123-2022.pdf).
El mapeo usa la estructura admitida por el XSD para la parte remitente de 31;
no afirma que se hayan ejecutado las reglas/XSL vigentes completas.

### Lotes RC/RA

`B2bBatchMemberAuthority` recibe identificadores/versiones, no snapshots ni CDR
autoaprobados del cliente. Reconstruye cada documento con el dueño, incluyendo
originales de notas, historial de créditos y versiones anteriores de RC 2/3.
Autoriza la **totalidad** de miembros/dependencias antes de reservar identidad;
un miembro denegado invalida el lote completo. Comprueba revisiones y permisos
antes/dentro/después del trabajo local mediante un contrato de transacción.

Integra el motor fiscal RC/RA existente y su constructor UBL. Las capacidades de
plan no se pueden fabricar, reusar para escribir, ejecutar concurrentemente o
retener fuera del callback. El diario liga solicitud, miembros y comando.
`REUSE_JOURNAL` recupera una respuesta perdida sin ejecutar otra vez el productor;
un estado ambiguo no se convierte en permiso de reenvío.

`createBillingBatchMemberProducer` conecta `reserveWithinTransaction` del
repositorio real a la **misma** transacción del propietario; no abre una segunda
reserva. Conserva sus límites actuales: USER, un punto, RC alta/baja y RA.
Ese puente heredado sigue bloqueando RC modificación y SERVICE correctamente.
Ahora `PostgresBatchMemberOwner` y `createDurableBatchMemberProducer` aportan un
agregado nuevo persistente para RC1/RC2/RC3/RA y SERVICE/USER, sin alterar ese
guard. Se persisten versiones, historial, políticas, solicitud original, comando,
journal y outbox local deshabilitado. Los bloqueos y revocaciones se ensayan
en PostgreSQL nuevo; las firmas y CDR se verifican con PKI efímera.

## Ampliación final y límites de activación

1. La composición sigue explícita e inerte para el stack activo. Se añadieron
   controladores opt-in y Swagger candidato con `x-runtime-enabled=false`;
   `createB2bPhase7Application` los reúne. No se desplegaron en QA/Kong ni se
   registraron consumidores fiscales. Ver rutas en el documento de cierre.
2. El propietario persistente 31 y su referencia pública 09 ya están implementados:
   `CarrierGuideOwner`, `PostgresCarrierReference09Owner`,
   `CarrierReferenceCryptoVerifier`, autoridad Identity y adaptadores HTTP mTLS.
   El recibo conserva versiones y originales; no hay relabel de 02 a 01.
3. El propietario de lotes ya usa PostgreSQL real con historial, políticas
   independientes, journal y RC2/SERVICE. Sus originales XML/firma/ZIP/CDR se
   conservan en SUNAT y se consultan mediante APIs privadas/autorizadas. Los locks
   de Billing son transaccionales; Identity se reconsulta, no se afirma una
   transacción distribuida ni revocación remota atómica.
4. Reglas oficiales versionadas completas, confianza PKI/CDR oficial, transporte
   autorizado y piloto integrado siguen siendo gates distintos. No se usaron
   credenciales ni certificados reales, OAuth ni endpoints oficiales.

Todas las salidas nuevas mantienen `transmissionAuthorized=false`,
`officialCdrVerified=false` y `authorizedForTransfer=false`; ningún resultado
local habilita producción ni acredita traslado. El cierre técnico LOCAL/BETA
está verificado y registrado en el documento enlazado: 9.910 pruebas aprobadas,
cero fallos, tipos y ensayos aislados correctos. No equivale a activación oficial.

## Verificación reproducible

Desde la raíz del repositorio, sin levantar el stack:

```powershell
pnpm typecheck
pnpm exec vitest run --maxWorkers=2 --testTimeout=30000 --hookTimeout=30000
pnpm --filter @factuez/billing-service build
pnpm --filter @factuez/sunat-service build
node tests/guide-artifact-db.e2e.cjs --isolated-synthetic-only
node tests/numbered-carrier-profiles-signed-xsd.e2e.cjs --isolated-synthetic-only
```

El runner PostgreSQL sólo crea BD nueva mediante el helper existente: contenedor
etiquetado, `--rm`, tmpfs, `--network none`, sin puertos ni descarga de imagen;
verifica propiedad antes de eliminarlo. Aplica únicamente allí el DDL candidato.
Los diez grupos comprueban persistencia/replay, concurrencia, inmutabilidad,
alcance, identidad fiscal global, rollback ante revocación, errores absorbidos,
callbacks retenidos, FK/procedencia CDR y conservación/verificación del CDR real
**del ensayo ficticio**. No migra ninguna base de la aplicación.

El runner XSD no accede a la red: usa el paquete local SHA-256
`5cac9d9353521340fbc15d23f465a4946b004535b9ff411541c87da01694dbd5`,
firmas efímeras y directorio temporal propio con limpieza validada.

Resultado de la primera entrega de este bloque (línea base, no recuento de la
ampliación final; resultados actuales en el documento de cierre):

- `pnpm typecheck`: 28 tareas satisfactorias, 21 paquetes.
- Regresión completa: 219 archivos; **9.621 pruebas aprobadas**, una omisión
  condicional preexistente, cero fallos; 197,09 segundos.
- PostgreSQL nuevo aislado: **10 grupos aprobados**, incluida la conservación
  del CDR firmado con certificado efímero, sin confundirlo con un CDR oficial.
- Perfiles 09/31: 76 pruebas específicas, incluidos 10 controles XSD con XML
  firmados y casos negativos, sobre el paquete local fijado por SHA.
- En esa primera entrega no se añadieron controladores; la ampliación final sí
  incluye APIs candidatas, sin activarlas en el stack.

No se alteró la BD de QA, no se migraron historiales, no se accedió a P12 reales
ni se enviaron solicitudes SOAP/REST/OAuth/correo. Los contenedores temporales
del runner se retiraron comprobando su etiqueta de propiedad.
