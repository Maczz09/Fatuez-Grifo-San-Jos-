# B2B-07 — Mapa fiscal local de establecimientos

22/10/2026. Tercer bloque candidato. **No desplegado; no cierra fase 7 ni
habilita SUNAT.** Continúa la [preparación local UBL 09](B2B_FASE7_PREPARACION_UBL09.md).

## Qué resuelve

Registro explícito por empresa/RUC, separado de códigos comerciales de sedes y
puntos. Cada entrada vincula sede, revisión del maestro, código de establecimiento,
ubigeo y dirección fiscal declarada. No deduce códigos SUNAT desde `Branch.code`
ni reutiliza automáticamente la dirección comercial.

El perfil permite hasta 200 entradas y un vínculo por sede/código de establecimiento
dentro del mismo emisor. Códigos iguales de emisores distintos no comparten mapa.
Es un perfil local acotado, no un catálogo completo de SUNAT ni una garantía de
inscripción del establecimiento. Los códigos de cuatro/seis dígitos se comprueban
sintácticamente; su contenido oficial aún requiere contraste autorizado.

## Administración y persistencia

- Autoridad humana autenticada con alcance GLOBAL, `setup.manage`, `series.manage`
  y verificación reforzada. No se convierte un token SERVICE en administrador.
- Actualización exige revisiones esperadas del mapa, emisor y cada sede. Conflictos
  rechazan el cambio; nunca se sobrescribe silenciosamente una edición concurrente.
- Revalidación de autoridad antes/después de las escrituras; cambios o revocación
  impiden confirmar la transacción. Cuotas por par privado, cuerpos acotados.
- Versiones y auditoría de lecturas/cambios autorizados append-only; cabeza con CAS y transacción
  Serializable. Retirar entradas o vaciar el mapa crea una revisión nueva, sin
  borrar el historial. No hay cambios de dueño de series ni reinicios de contadores.
- La lectura administrativa permite identificar mapas obsoletos. Su reemplazo
  requiere confirmar explícitamente las revisiones actuales; no se repara solo.

DDL candidato aditivo, nunca ejecutado al arrancar. La prueba persistente aplica
el esquema únicamente en una base NUEVA desechable. No se modificó Prisma ni
se ejecutaron migraciones/db push sobre bases existentes.

## Conexión con el preparador

Nueva fábrica **estricta y opcional**: después de leer/reautorizar el borrador
READY 09, comprueba que origen y destino coincidan exactamente con el mapa del
mismo RUC; el origen debe corresponder a la sede autorizada del punto y el
destino a una sede distinta. Revisa revisiones y actividad del emisor/sedes, hash
del registro y vigencia del mapa antes de devolver la preparación.

Falta de mapa, datos discordantes, cambios de revisión o configuración obsoleta
rechazan la operación. No se filtra el mapa completo al consumidor del borrador.
El resultado del guard es interno y no se acepta un supuesto comprobante de
validación aportado por el consumidor.

La fábrica anterior permanece como preflight declarativo separado. Al elegir el
modo estricto, un guard ausente o mal formado NO provoca fallback al anterior.
Ninguna de las dos fábricas habilita emisión. El contrato público de preparación
permanece compatible: `ESTABLISHMENT_MAPPING` y los demás gates siguen cerrados,
porque una coincidencia con configuración local no acredita validación oficial.
El futuro productor necesita su propio contexto fiscal versionado; no debe usar
el plan v1 como prueba de aceptación ni como reserva de numeración.

## Interfaces privadas candidatas

`POST /internal/b2b/guide-establishments/read`: cuerpo `{companyId}`.

`POST /internal/b2b/guide-establishments/replace`: cuerpo `{companyId,input}`;
`input` contiene `expectedRevision`, `expectedIssuerRevision` y `entries`.

HTTPS/mTLS y pares administrativos fijados; Bearer humano verificado por un port
propietario. El contexto de auditoría se genera en el servidor. No admite un actor,
RUC, entorno, aprobación contable o estado oficial declarado en el cuerpo.
El módulo exige un host HTTPS dedicado con `bodyParser:false`: valida el par y
cabeceras antes de su lector JSON acotado. No debe agregarse detrás de otro parser
que ya haya consumido la petición. El host debe conservar sus límites TLS y de
conexiones; no se expone directamente a Internet.

No se añaden operaciones administrativas al B2B público en esta entrega; su
delegación/panel corresponden a B2B-08. Las rutas privadas NO se registraron en
AppModule, `main`, Kong o Swagger activo. La fábrica requiere un verificador
administrativo real y no trae un administrador predeterminado/falso para despliegue.

## Verificación y límites

Pruebas con RUC/sedes/documentos ficticios, sin certificados ni credenciales.
Resultados: [verificación del 22/10](B2B_VERIFICACION_2026-10-22.md).
284 pruebas nuevas aprobadas y 38 grupos PostgreSQL aprobados. Regresión general:
190 archivos, 8.338 aprobadas, una omisión condicional preexistente y cero fallos;
las 32 del adaptador incorporadas después se verificaron aparte, sin cambiar fuente.
Tipos: 28 tareas correctas en 21 paquetes.

Reproducción: `pnpm test:b2b-guide-establishments` y
`pnpm test:b2b-guide-establishments:db`. El segundo exige el modo sintético fijo;
no acepta una URL o datos del cliente. No usarlo para cargar el mapa real.

Continuación: [política local de bienes y referencias versionadas](B2B_FASE7_CATALOGOS_Y_BIENES.md)
implementada posteriormente, sin acreditar clasificación legal ni validez normativa.
Pendiente: catálogos/reglas oficiales verificados y ejecutables,
productor con reserva/journal atómicos, guía 31, referencias, firma/PKI y
transporte/CDR; después lotes RC/RA y recuperación de respuestas ambiguas.
TI/Administración deberán configurar y confirmar el mapa real cuando se autorice
el despliegue. Esta entrega no cambia aprobaciones de Contabilidad ni actas de corte.
