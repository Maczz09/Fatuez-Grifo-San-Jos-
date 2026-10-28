# B2B-06 — Autorización explícita de series NC/ND

Fecha: 21/10/2026. Implementación candidata aislada; sin despliegue ni activación fiscal.

## Entregado

El permiso de emitir una factura o boleta no autoriza una corrección. Se añade
un permiso emparejado independiente, sin ampliar `B2bBinding` ni el principal
existente: contexto íntegro del original 01/03 + UUID de serie de nota + tipo
07/08. Nunca se autoriza por compartir etiquetas como F001, ni combinando
listas independientes de empresas, sedes, puntos y series.

Identity conserva este permiso por cliente y revisión. Billing valida de nuevo
el par: RUC/empresa BETA, sede, punto y ambas series activos, tipos correctos y
familia F/B coherente con el original. Este perfil conservador exige el mismo
punto para original y nota; no habilita traslados de series.

- Alta/reemplazo/vaciado por administrador con step-up y peer mTLS específico.
- Revisión esperada del cliente y del conjunto de permisos; una edición
  concurrente pierde con conflicto, no sobrescribe la ganadora.
- Historial append-only de permisos, cabeza monotónica y auditoría en la misma
  transacción de Identity. Si falla la auditoría, no se confirma el cambio.
- Ningún permiso predeterminado. Rotar/cambiar la revisión del cliente vuelve
  obsoleto el conjunto anterior: requiere concesión explícita nueva.
- SERVICE usa su token corto vigente y no se transforma en usuario humano.
- USER requiere vínculo local vigente, versión de autorización, permisos de
  lectura/emisión y acceso local al punto y **a las dos series**, no sólo al
  documento original. Un usuario GLOBAL sigue sujeto al par del cliente.
- Fallos de Identity, catálogo o autoridad de usuario impiden autorizar.
- Billing consume la autoridad privada con principal recién verificado; rechaza
  respuestas con otro cliente/par, scope ampliado o supuesta activación fiscal.
  No almacena el resultado como permiso reutilizable.

## Contrato interno, no endpoints públicos de emisión

| Propietario | Método y ruta | Protección adicional |
| --- | --- | --- |
| Identity | `GET /internal/b2b/clients/:id/correction-grants` | Peer de administración + token humano con step-up |
| Identity | `POST /internal/b2b/clients/:id/correction-grants` | Mismo control + `expectedClientRevision`, `expectedGrantRevision`, `bindings` |
| Identity | `POST /internal/b2b/authorize-correction` | Peer Billing aprobado + Bearer SERVICE/USER + `{kind,binding}` |
| Billing | `POST /internal/b2b/validate-correction-bindings` | Peer de catálogo aprobado + `{bindings}` |

Los peers de administración y de autorización son distintos. Las respuestas
son privadas/no-store y no contienen certificados, secretos ni tokens.
Autorización devuelve procedencia SERVICE/USER y alcance ASSIGNED exacto,
`grantRevision`, `clientRevision`, `candidateOnly=true`,
`fiscalExecutionEnabled=false`, `transmissionAuthorized=false`.

`B2bCorrectionAuthorityModule.isolated(...)` puede ensamblarse explícitamente
mediante el cuarto argumento opcional de `createB2bIdentityApplication(...)`.
`B2bCorrectionCatalogueModule.isolated(...)` es un módulo Billing independiente.
No se importaron en AppModule/main actuales ni se modificó Kong. Por tanto,
el Swagger de localhost:8091 no adquiere estas rutas por este trabajo.

## Persistencia y pruebas

`services/identity-service/b2b-correction-grants-schema.candidate.sql` declara
`B2bCorrectionGrantRevision` y `B2bCorrectionGrantHead`. No es una migración
aplicada: no se ejecuta al arrancar ni crea permisos o clientes automáticamente.

Comandos reproducibles:

- `pnpm test:b2b-correction-authority`: validación de pares, revocación,
  SERVICE/USER, fallo de auditoría, consumidor Billing y HTTPS/mTLS real con
  PKI efímera ficticia en loopback.
- `pnpm test:b2b-correction-authority:db`: dos bases PostgreSQL nuevas, una por
  propietario, dentro de un contenedor temporal etiquetado, tmpfs, sin red ni
  puertos publicados. Prueba JWT SERVICE real, persistencia/reinicio, edición
  concurrente, permisos locales/vínculos USER, CAS, triggers y rollback de auditoría.
  El verificador OIDC externo USER es un fixture, no un proveedor desplegado.

El ensayo no lee QA, credenciales ni archivos del cliente. Su limpieza elimina
únicamente el contenedor de prueba propio y sus bases ficticias desechables.

[Verificación del 21/10](B2B_VERIFICACION_2026-10-21.md): 45 pruebas nuevas,
10 grupos PostgreSQL, regresión de 5.681 pruebas aprobadas y revisión de tipos
del monorepo sin errores.

## Lo que no resuelve ni habilita

No es evidencia de aceptación SUNAT, confianza PKI o saldo fiscal disponible.
No registra notas, consume correlativos, firma XML ni publica Outbox/webhooks.
No se conectó este permiso a un productor fiscal abierto: los guards existentes
siguen cerrados y la reserva financiera anterior sigue siendo sólo sintética.

Antes de una futura ejecución, el propietario debe volver a autorizar el par
y verificar sus maestros dentro de la reserva transaccional. Una respuesta
distribuida previa no bloquea cambios posteriores de permisos o de maestros.

El siguiente bloque de B2B-06 sigue siendo el resolvedor propietario de evidencia
XML/CDR/firma/PKI y su composición con comando, reserva financiera y efectos
aceptados/rechazados. Después corresponde transporte y conciliación de respuestas
ambiguas. No se declara cierre de B2B-06 ni avance a B2B-07 por entregar permisos.

Continuación: [evidencia propietaria individual](B2B_FASE6_EVIDENCIA_DOCUMENTO_PROPIETARIO.md)
implementada como componente aislado 01/F07/F08. No conecta permisos y ejecución
automáticamente; conserva pendientes de composición descritos allí.
