# B2B-09 — Control operativo y ensayo del consumidor

Fecha: 25/10/2026 (Lima). Primer bloque técnico de B2B-09, exclusivamente LOCAL/BETA.
No desplegado en 8091. No activa conexiones oficiales ni cierra la fase completa.

## Implementado

La nueva fábrica `createB2bPhase9Application` conserva los módulos y propietarios
de B2B-08 y añade `B2bOperationalControl` antes del parser y los controladores.
Cada propietario sigue comprobando identidad, RUC/sede, scopes y concesiones.
Una política operativa OPEN permite tramitar la petición; no concede permisos.

El control está deshabilitado por defecto. Requiere dependencias explícitas y
una política BETA vigente antes de cada solicitud. Rechaza políticas vencidas,
producción, revisiones anteriores, modos contradictorios con la misma revisión,
campos extra y respuestas mal formadas. Si falta o falla la política, responde
503 con el contrato existente `OWNER_UNAVAILABLE`, sin exponer la excepción.

Incluye:

- Pausa local inmediata de nuevas solicitudes y pausa/reapertura mediante
  política operativa revisada. La pausa local es irreversible para esa instancia;
  un archivo OPEN posterior no la anula.
- Límite concurrente configurable de 1 a 16; predeterminado 8. Incluye las
  consultas pendientes de política y las operaciones cuyo cliente se desconectó.
- Cuota agregada de 1 a 600 solicitudes/minuto; predeterminada 120. La sobrecarga
  devuelve 429 y `Retry-After`. No confía en IP o headers enviados por el cliente.
- Consulta de política de hasta 1 segundo por defecto, configurable entre 25 y
  5.000 ms. Si el puerto queda colgado, conserva su reserva hasta que termine;
  no crea consultas ilimitadas después del timeout.
- HTTP con cabeceras de hasta 10 segundos, recepción de petición de 15 segundos,
  keepalive de 5 segundos, 100 solicitudes por socket y 64 conexiones máximas.
  Los límites de cuerpos, TLS/mTLS y rutas de las fases anteriores permanecen.
- Identificador de petición generado por el servidor y métricas de cardinalidad
  finita: familia de operación, método, clase HTTP, resultado y latencia.

Las cuotas son por proceso/listener. No sustituyen cuotas distribuidas de Kong,
revocación por aplicación en Identity ni controles propios de cada servicio.

## Desconexión y cierre sin duplicar trabajo

El interceptor conserva la suscripción a la operación hasta que su promesa termina.
Cerrar la pestaña, perder la conexión HTTP o agotar el tiempo del cliente no libera
un cupo mientras el propietario continúa escribiendo. La respuesta de sobrecarga
no provoca reintentos automáticos de comandos.

`await operations.drain(timeoutMs)` detiene la admisión y espera las operaciones
de ese listener. Devuelve `DRAINED` con cero pendientes o `DRAINING` con el número
restante. El timeout no cancela escrituras ni declara rollback. Sólo después de
`DRAINED` corresponde cerrar esa aplicación. Si se perdió la respuesta de un
comando, recuperar su resultado con la misma clave de idempotencia.

Este drain abarca solicitudes y consultas de política del listener. **No acredita
que las colas de emisión, webhooks, recepción o correo de otros procesos estén
vacías**, ni que sea seguro respaldar todas las bases simultáneamente. Esos
workers necesitan su propio procedimiento de pausa/conciliación. Un drain no
equivale a un corte contable ni a apagar toda la intranet.

## Política local concreta para TI

`FileB2bOperationalPolicy` implementa el puerto con un único archivo de metadatos:
`b2b-operations.json`, dentro de un directorio absoluto aprobado por TI. No carga
variables de entorno, certificados, contraseñas, tokens ni URLs.

El [ejemplo](../infra/b2b/b2b-operations.example.json) empieza en PAUSED:

```json
{"environment":"BETA","revision":1,"mode":"PAUSED"}
```

Cada lectura comprueba el directorio y el archivo regular, rechaza redirecciones,
junctions/symlinks/hardlinks, tamaño superior a 1 KiB, campos duplicados o escapados,
contenido incompleto y reemplazos detectados durante la lectura. Una lectura
válida devuelve un lease de admisión de cinco segundos. No es un lease de acceso
a documentos ni un token. Si TI cambia el modo, debe aumentar la revisión y
reemplazar el archivo de forma atómica; una escritura parcial bloquea admisión.

El servicio sólo necesita lectura. El directorio y su reemplazo deben quedar
restringidos por ACL a operadores autorizados; no ubicarlo en un recurso público,
directorio web o carpeta editable por consumidores B2B. El código no crea el
archivo, cambia ACL ni abre el acceso automáticamente.

Composición explícita en el despliegue privado:

```typescript
const policy = new FileB2bOperationalPolicy(directorioOperativoAutorizado);
const operations = new B2bOperationalControl(policy, {
  enabled: true,
  maxConcurrent: 8,
  requestsPerMinute: 120,
  policyTimeoutMs: 1000,
});
const app = await createB2bPhase9Application({
  ...dependenciasB2b08Autorizadas,
  operations,
});
// El despliegue decide cuándo y dónde escuchar, con TLS/mTLS y red aprobados.
// No hay bind, Compose, migraciones, grants ni lectura de secretos implícitos.
```

## Observabilidad y operación

`operations.snapshot()` devuelve métricas agregadas y estado local, sin rutas
crudas, querystrings, cuerpos, nombres de clientes, RUC, importes, XML o secretos.
Los intervalos de latencia no son acumulativos: ≤25, ≤100, ≤500, ≤2.000,
≤10.000 y >10.000 ms. Un resultado HTTP no representa aceptación SUNAT.

La consulta es un método privado del proceso. No se añadió un endpoint público
de métricas, pause, enable o RUN. Un despliegue podrá conectar este método a su
monitor autenticado; no se instaló un recolector corporativo. Los eventos
`CLIENT_ABORTED` distinguen una desconexión de la respuesta recibida; la ejecución
real y su auditoría siguen en el propietario.

Procedimiento de mantenimiento del listener:

1. Pausar admisión mediante la política revisada o `operations.pause()`.
2. Ejecutar `drain` y comprobar el resultado; si aún hay pendientes, conciliarlos.
3. Cerrar únicamente la aplicación tras `DRAINED`; coordinar los demás workers
   por separado cuando el mantenimiento lo requiera.
4. Iniciar la nueva composición inicialmente pausada, comprobar dependencias y
   reabrir con revisión nueva sólo bajo la configuración privada autorizada.
5. Recuperar respuestas ambiguas por idempotencia antes de crear otra operación.

## Verificación y evidencia

```powershell
pnpm test:b2b-operations
pnpm exec turbo run build --filter=@factuez/b2b-api-service...
pnpm typecheck
```

Las pruebas HTTPS usan el SDK público, la fábrica de aplicación real y el motor
de reportes NC/ND/NV. Verifican CSV, pausa, saturación, denegación TLS/permiso,
desconexión durante una mutación, drain y replay de la misma operación al
reconstruir la fachada. Usan certificados ficticios, loopback y almacenamiento
transaccional de prueba en memoria. Este caso no simula restaurar PostgreSQL ni
demuestra recuperación después de una caída del proceso propietario.

Las pruebas del archivo usan exclusivamente un directorio temporal nuevo con
metadatos ficticios y lo retiran al terminar. No se consultan configuraciones del
cliente, archivos `.env`, bases de QA o certificados reales.

Verificación enfocada: 119 pruebas aprobadas en siete archivos, cero fallos.
Incluye 36 casos nuevos (17 de admisión/cierre, cinco SDK/HTTPS y 14 de política
local), más 83 casos de contratos/inventario existentes. La compilación del
servicio y sus dependencias pasó tres tareas; tipos del monorepo, 29 tareas en
22 paquetes. Informe: `output/qa/b2b-phase9-operations-focused.json`.

Regresión final: **278 archivos aprobados, 11.859 pruebas aprobadas, cero fallos
y una omisión condicional preexistente**, en 278,00 segundos. El proceso terminó
con código cero. Informe: `output/qa/b2b-phase9-operations-regression-final.json`.
La omisión de `fiscal-batch.spec.ts` requiere `FACTUEZ_FISCAL_XSD_PYTHON`; no se
contabiliza como aprobada ni como validación fiscal. Los grupos enfocados se
solapan con esta regresión y no se suman como un total adicional.

El ensayo HTTP detectó inicialmente que devolver directamente una promesa de
resultado desde el interceptor no cumplía el protocolo Observable de NestJS:
el propietario había completado el reporte pero la fachada respondía 503. Se
corrigió devolviendo el Observable de la promesa que sigue bajo control del
interceptor. Los cinco casos HTTP pasan sin cambiar reportes ni permisos.

## Pendientes de B2B-09

Continúan el paquete de despliegue privado revisado para todos los propietarios,
esquemas aditivos, retención y limpieza por propietario, respaldo/restauración integral,
ensayos de carga distribuidos, rotación de claves, pausa/recuperación de workers,
monitor corporativo, autoinicio Windows y piloto autorizado VPN/Kong/HTTPS.
Se reutilizará el soporte Windows de la API de extracción donde corresponda;
ese perfil existente no se amplía silenciosamente de 17 a 136 operaciones.

TI aporta la configuración de red, identidades, certificados y permisos; el
equipo de desarrollo debe completar y ensayar los bloques técnicos restantes.
No se considera implementado un productor nuevo de webhooks por nombrarlo en el
catálogo. Las fases fiscales y el historial real conservan sus gates originales.

Continuación del 26/10/2026: [respaldo cifrado y recuperación de tres perfiles
aislados](B2B_FASE9_RESPALDO_RECUPERACION.md). Ese ensayo amplía la evidencia
técnica; no equivale a respaldar toda la instalación ni a autorizar datos reales.

El [bloque de mantenimiento de workers](B2B_FASE9_MANTENIMIENTO_WORKERS.md)
completa el cierre local de motores B2B de correo, publicación y webhooks, y
ensaya recepción con BullMQ real. No convierte el drain HTTP en cerco global.
