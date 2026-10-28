# B2B-07 — Diario duradero de envío y recuperación de guías

22/10/2026. Quinto bloque candidato. Continúa
[catálogos y bienes locales](B2B_FASE7_CATALOGOS_Y_BIENES.md).
**No desplegado, sin conexión oficial, no cierra B2B-07.**

## Qué resuelve

Evita que repetir un trabajo después de perder su respuesta vuelva a despachar
el mismo paquete. La intención de envío se confirma en la base antes de llamar
al transporte. Una caída entre ese commit y la respuesta deja una intención o
un resultado incierto; no permite crear otro intento de envío.

| Estado del diario | Acción permitida | Qué no significa |
| --- | --- | --- |
| READY | Registrar un único intento | No reserva un número fiscal |
| INTENT_RECORDED | Recuperar/conciliar | No demuestra que salió de la máquina |
| UNCERTAIN | Buscar un ticket conocido por el canal propietario | No autoriza reenviar |
| TICKET_RECEIVED | Consultar el mismo ticket | No acredita aceptación |
| RESULT_PENDING_VERIFICATION | Entregar el resultado al futuro verificador propietario | No es CDR oficial verificado |

El coordinador sólo usa un **emulador local explícito**, en entorno BETA y con
metadatos de origen `LOCAL_EMULATOR`. No importa ni instancia el adaptador REST
oficial, que conserva sus bloqueos actuales. No se obtiene OAuth, carga una clave,
firma un XML o solicita producción para probar este bloque.

## Identidad e integridad

El manifiesto se obtiene de un port propietario interno, nunca de un cuerpo B2B.
Vincula empresa/RUC/operación, documento, tipo 09/31, número completo canónico,
revisión del contexto y huellas declaradas de snapshot/XML/ZIP. No contiene el
XML, ZIP, contraseña, certificado o token. Sus hashes no sustituyen verificar
los bytes originales, su firma, confianza o reglas fiscales.

Las identidades de este perfil son `Txxx-n` y `Vxxx-n`, con número positivo sin
relleno de ceros. No normaliza ni reescribe comprobantes históricos; el futuro
propietario debe definir explícitamente su identidad canónica. El mismo RUC,
tipo y número sólo pueden tener un stream, aunque cambie el ID interno de empresa
u operación. Otro RUC conserva una identidad fiscal independiente.

Cada evento incluye versión, huella anterior, fecha UTC y hash canónico. La
reconstrucción verifica todo el historial y sus transiciones. Hasta 128 eventos;
al alcanzar el límite se bloquea una nueva consulta antes de llamar al emulador,
sin truncar ni borrar el historial. No se promete un sondeo ilimitado de producción.

## Persistencia y recuperación

Registro e intento se guardan atómicamente; el envío local ocurre fuera de esa
transacción y sólo después de confirmar el commit. PostgreSQL usa Serializable,
bloqueo por operación, CAS de cabecera y eventos append-only, con restricción
diferida que enlaza cabecera y evento. Los errores SQL absorbidos por un callback
no permiten confirmar escrituras anteriores. No hay borrado o truncado de streams.

Se valida el propietario antes de la transacción, dentro de ella, después de
escrituras y antes de llamar al emulador. Propietario ausente, revocado, de otro
RUC o con contexto modificado: se bloquea el avance. No existe fallback a datos
del consumidor ni a un emisor configurado por defecto.

Después de timeout, respuesta inválida o error de persistencia posterior al envío,
el siguiente trabajo consulta el diario y no repite `submit`. Un ticket tardío
del mismo intento puede conciliarse. No se reemplaza uno ya registrado por otro.
Una respuesta PENDING tardía no revierte un resultado; resultados diferentes se
señalan como conflicto y no sobrescriben el anterior.

El port `findTicket` es exclusivamente del emulador de este ensayo: **no se
afirma que exista una API SUNAT para recuperar automáticamente un ticket por
hash u operación interna**. El circuito oficial deberá definir el canal autorizado
de conciliación, la recuperación de tickets conservados y la intervención del
operador cuando no haya evidencia suficiente. Un envío incierto puede requerir
revisión manual; no se sacrifica esa seguridad para prometer entrega automática.

## Ensamblaje y límites

`createLocalGuideDispatchCoordinator` exige base propietaria, proveedor explícito
de metadatos y emulador local. Construirlo no consulta la base ni instala un
esquema, arranca workers o registra rutas. La autoridad simulada de los ensayos
no se incorpora a una configuración de despliegue.

No hay nuevas rutas públicas, permisos, scopes, colas activas, cambios de Kong,
Swagger vivo o main/AppModule. No toca Billing, Document, correlativos u Outbox.
La marca `officialCdrVerified` permanece falsa incluso después de recibir un
resultado del emulador; tampoco habilita traslado o emisión fiscal.

Cubrir identidad 31 en el diario no implementa su generador XML, permisos de
transporte o validación normativa. Integrar al productor empresarial, verificar
CDR/PKI y reflejar estados fiscales son tareas distintas que permanecen pendientes.

## Reglas oficiales: comprobación de esta entrega

El [portal técnico GRE de SUNAT](https://cpe.sunat.gob.pe/node/116) enlaza reglas
del 25/09/2026 y XSL actualizado al 01/10/2026. La descarga del ZIP XSL enlazado
devolvió HTTP 403 durante esta continuación. No se alteraron controles TLS,
credenciales, cabeceras de identidad ni se recurrió a fuentes no oficiales para
sustituir el paquete. No se incorporó un archivo incompleto o inventado.

Por tanto, el paquete no se presenta como descargado o ejecutado. Continúan
pendientes sus reglas ejecutables/versionadas, el productor fiscal con numeración
atómica, perfil 31 completo, originales/firma/PKI/CDR y lotes RC/RA. La programación
independiente del diario sí puede avanzar sin esos archivos o datos del cliente.

## Verificación

Pruebas puras y del coordinador con documentos/propietarios/emulador ficticios;
adaptador SQL y ensayo PostgreSQL NUEVO, temporal, etiquetado, sin red ni puertos.
Resultados: [verificación del diario](B2B_VERIFICACION_DIARIO_GUIAS_2026-10-22.md).

Comandos reproducibles: `pnpm test:b2b-guide-dispatch` y
`pnpm test:b2b-guide-dispatch:db`. El segundo exige el modo sintético fijo; no
acepta la URL, documentos o credenciales del cliente.
