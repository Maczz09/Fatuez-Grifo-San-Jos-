# Verificación de API y concesiones de guías — 23/10/2026

Séptimo bloque B2B-07. [Alcance](B2B_FASE7_API_Y_PERMISOS_GUIAS.md).
No desplegado ni habilitado para producción o transmisión oficial.

## Resultado específico

**532 pruebas aprobadas en 14 archivos, cero fallos**, en una corrida conjunta
con `vitest run guide-issue`. Incluyen las 187 del productor atómico anterior y
345 nuevas de lectura, autorización, contrato, validación de respuestas y HTTP,
incluida la matrícula SERVICE/USER de sólo lectura sin capacidad de emisión.
No sumar de nuevo esas 187 al comparar con la regresión previa.

Se verificaron:

- Concesiones independientes y persistentes, CAS, auditoría atómica, revisión
  inmutable y fallo cerrado ante grants dañados o callbacks que ocultan errores.
- Ningún permiso heredado de WRITE del borrador; se exige `b2b:guides:issue`
  además del par explícito de tres series. No cambian los scopes predeterminados.
- Procedencia SERVICE/USER, revisiones de cliente/usuario, permisos y alcance.
  Revocación del administrador durante un reemplazo y del usuario durante RPC.
- Dos rutas públicas candidatas, dos RPC de productor/consulta, catálogo privado
  y matrícula/autorización de Identity con huellas mTLS separadas.
- HTTPS real de loopback con PKI efímera de pruebas: rechazos de certificado,
  Bearer, JSON, límites de cuerpo, cabeceras/alias y parámetros duplicados.
- Respuestas completas verificadas por esquema/hash/ámbito, sin aceptar
  activación fiscal ni reflejar errores internos, token o datos del recibo.
- Recuperación por `operationId` sin reenviar el comando ni consumir otro
  correlativo. Ni otro cliente ni otro actor o borrador leen el resultado.
- Contrato OpenAPI candidato y referencias internas, sin ruta pública de
  administración ni confusión con el Swagger que ya está en ejecución.

La fachada no importa los módulos o bases de Billing/SUNAT. Identity valida el
vínculo mediante RPC propietario; el lector/contador siguen dentro de Billing.
El tipo nulo del `get` base de Identity se anotó explícitamente conforme a su
contrato existente, sin cambiar su consulta o comportamiento.

## Persistencia real, exclusivamente sintética

**25 grupos PostgreSQL aprobados** del productor/lectura en una base NUEVA,
vacía, temporal, etiquetada y sin red/puertos. Repite los 22 grupos anteriores y
añade consulta por operación, catálogo ISSUE frente a READ histórico y aislamiento
de otro cliente. Se comprueba además que reservar el último número con el
catálogo propietario real no revoca el permiso de devolver/repetir su recibo;
una nueva reserva sigue bloqueada por el contexto transaccional. READ de una
serie inactiva tampoco permite nueva emisión. Contexto, productores, catálogos y stores compilados reales;
autoridad de identidad ficticia en este ensayo de Billing.

**Diez grupos adicionales aprobados** de Identity en dos bases NUEVAS separadas
por propietario. Identidad/JWT, store, enlaces de usuario y autoridad reales;
administrador, verificador delegado y catálogo de negocio ficticios y explícitos:

1. Matrícula independiente, reinicio de autoridad y auditoría de denegación.
2. Coincidencia de la tupla completa y READ de historia sin permiso para ISSUE.
3. Concurrencia Serializable/CAS: un solo reemplazo vencedor por revisión.
4. Revocación tardía del administrador: rollback de concesión y auditoría.
5. Fallo de auditoría, incluso ocultado por un callback: rollback completo.
6. Guards físicos de revisión/cabecera/auditoría y rechazo de revisiones huérfanas.
7. Rotar revisión/secreto del cliente invalida su autorización anterior hasta
   concederla explícitamente otra vez.
8. Usuario enlazado, permisos y las tres series; revocación de asignación durante
   RPC y cambio de revisión del usuario producen denegación.
9. Revocación por conjunto vacío y cero cambios de ventas/Outbox/correlativos
   en la base de Billing de ese ensayo de identidad.
10. Matrícula de consumidor con scopes exclusivamente de consulta: permite READ
    y rechaza ISSUE sin exigir permiso de emisión latente.

Los helpers no aceptan destinos, archivos o URL de conexión del cliente. Usan
PostgreSQL temporal en tmpfs, sin red y sin puertos publicados, con imagen local
preexistente y verificación de la etiqueta propia para limpiar al terminar.
No se aplicó DDL sobre el QA existente ni se consultaron configuraciones reales.
No se deshabilitaron triggers, constraints, roles o aislamiento: un trigger
adicional de rechazo se usó sólo para inyectar fallo en la base ficticia y se
retiró allí conservando todos los guards del candidato.

Estos ensayos verifican componentes propietarios por separado y contratos
HTTPS; **no son un piloto fiscal del cliente ni un despliegue integrado vivo**.

## Inventario y comprobación global

Artefactos regenerados desde fuente: 255 rutas declaradas, 30 funciones,
109 acciones planificadas y 20 pantallas. OpenAPI candidato: 65 operaciones
públicas (39 GET), sin activación. No se modificaron Kong, main/AppModule, el Swagger
activo, credenciales, series reales, certificados, historial o contadores.

Tipos del monorepo: **28 tareas correctas en 21 paquetes**. Compilados contracts,
service-access, Billing e Identity. No se modificaron dependencias o lockfiles.
Regresión integral final: **212 archivos aprobados, 9.300 pruebas aprobadas,
una omisión condicional preexistente y cero fallos**, en 183,49 segundos.
Incluye las 345 comprobaciones nuevas de este bloque; no se suman nuevamente
las pruebas específicas o corridas de revalidación al total.

Se actualizaron tres expectativas de inventario que conservaban el corte de
63 rutas: ahora contrastan las 65 operaciones con los controladores y OpenAPI,
incluida la presencia explícita de las dos rutas nuevas. Se mantuvieron los
guards, las comparaciones exactas y las afirmaciones de no despliegue. La
corrida final se ejecutó con el código estable y sin ediciones en paralelo.

## Límites conservados

El único perfil del productor sigue siendo 09/privado/04. Numeración y hashes no
equivalen a firma, reglas completas, confianza PKI, CDR auténtico o autorización
de traslado. No se ejecutaron SOAP/REST oficiales, OAuth, correos o webhooks
externos. Perfil 31, originales XML firmados/CDR, reglas oficiales, lotes,
integración UI y piloto/despliegue quedan expresamente pendientes.

Reproducir:

- `pnpm test:b2b-guide-issue`
- `pnpm test:b2b-guide-issue:db`
- `pnpm test:b2b-guide-issue-authority:db`
