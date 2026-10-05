# Etapa 2 — Recuperación y emisión QA desde la PWA

Implementado y desplegado: 02/10/2026, proyecto `factuez-stage2-qa`.
Acceso: <http://localhost:8091/login> y <http://192.168.100.5:8091/login>.

Este incremento corrige bloqueos locales. **No cierra la etapa fiscal oficial,
no inicia etapa 3 ni habilita producción.** No requiere nuevas credenciales del
cliente y no utiliza la clave privada real del usuario.

## Recuperación sin duplicar documentos

- XSD ocupado, proceso local no disponible o timeout tienen un error temporal
  específico. XML inválido, permisos, certificado cambiado e integridad no se
  convierten en errores reintentables.
- Notas 07/08 y preparación RC/RA conservan la reserva y aplican máximo 3
  intentos con backoff. No reciclan numeración ni liberan crédito reservado.
- Lease, heartbeat y compare-and-set impiden finalizar/bloquear con un claim
  antiguo. El lote no se cancela por tener más de 60 segundos de antigüedad
  mientras conserve un heartbeat válido.
- La preparación RC/RA interrumpida se recupera desde su snapshot y el contexto
  propio de SUNAT-service, previamente admitido por JWT. Se revalida revisión
  del certificado ficticio y originales; no se persiste JWT ni se leen otras BD.
- Circuitos individuales y lotes reintentan indisponibilidad XSD antes del POST.
  Después de un envío con resultado desconocido quedan `UNKNOWN`: no hay
  reenvío ciego. Una consulta continúa con el mismo ticket.
- Los registros históricos `BLOCKED` no se desbloquean automáticamente.

Se reutilizan columnas existentes: en notas, `claimedAt` representa fecha de
reintento estando `QUEUED` y heartbeat estando `SIGNING`; `attempts` identifica
el claim. En lotes, `claimedAt` identifica al propietario y `updatedAt` su
heartbeat; `pollAttempts` limita la preparación y vuelve a cero al pasar a
transporte. No se añadieron columnas ni se ejecutaron migradores.

## Nuevo botón de terminal

En **Terminal de pista**, un ADMIN GLOBAL con `sunat.configure` puede elegir
**Emitir y ejecutar circuito QA** para un emisor ficticio `00` + nueve dígitos,
ambiente BETA y demostración con transmisión externa deshabilitada.

```text
PWA -> Kong -> Billing (una venta + clave idempotente)
    -> Outbox/BullMQ -> copia local en SUNAT-service
PWA -> Kong -> workflow QA -> firma ficticia/XSD/ZIP
    -> registro durable/BullMQ -> SOAP del emulador interno
    -> CDR simulado -> consulta del mismo circuito en PWA
```

Para factura 01 el emulador devuelve el CDR individual; para boleta 03 se
conserva el circuito RC/ticket existente. El botón inicia escenario de aceptación
simulada. Los otros escenarios siguen disponibles en el detalle del documento.

La emisión conserva la misma clave idempotente al reintentar. Después de registrar
el comprobante, un error del laboratorio no hace otro POST a Billing. La pantalla
muestra progreso, resultado o indicación de continuar en el **mismo detalle**.
Al salir de la pantalla se cancela la espera, no el trabajo durable del servidor.
La espera de preparación/consulta es limitada; no es una sesión infinita.

La acción no aparece para cajeros ni emisores reales, incluido `20615878481`.
El backend también impone esta separación: ocultar el botón no es la protección.
`official=false`, `officialCdr=false` y `fiscalTransmission=false`; el CDR
simulado no convierte una venta en aceptada por SUNAT. Las notas 07/08 siguen
siendo firma local, sin transporte/CDR propios.

Para probarlo, utiliza un emisor ficticio QA ya configurado con certificado
autofirmado y datos compatibles con el perfil oneroso PEN/IGV 18%. No cargues
tu certificado real en un emisor ficticio. Este turno no creó emisores ni
nuevas ventas para efectuar un E2E contra los volúmenes existentes.

## Evidencia y despliegue

- `pnpm exec vitest run`: **373 pruebas, 27 suites**, aprobadas.
- Selección de recuperación `tests/etapa2-audit.config.mts`: **77 pruebas,
  5 suites**, aprobadas (incluidas en las 373, no adicionales).
- `pnpm typecheck`: **15 tareas en 11 paquetes**, aprobadas.
- Imágenes Docker SUNAT-service/PWA construidas; Next.js compila y valida tipos.
- Actualización sólo de esos dos servicios, con `--no-deps --no-build`; 11
  contenedores saludables después. Se conservaron Kong, bases y volúmenes.
- Login HTTP 200 por localhost e IP LAN, comprobado desde el servidor;
  no acredita acceso/driver de impresión de otra terminal.
- Salud interna SUNAT HTTP 200 y nueva ruta workflow HTTP 401 sin sesión;
  no se realizó una operación autenticada con datos existentes.
- Red Docker `internal=true`, `SUNAT_BETA_TRANSMISSION_ENABLED=false`, guard
  de activación oficial conservado. Sin nuevos envíos SUNAT, OAuth o SMTP real.

Las pruebas nuevas cubren recuperación, límites, concurrencia, lease vencido,
50 miembros con preparación lenta, worker reemplazado, pérdida de respuesta,
cancelación y rechazo de contexto real/producción. Usan repositorios/adaptadores
dobles y reloj simulado. No son una prueba de carga con PostgreSQL real ni
validación de PKI, reglas completas, impresión física o aceptación SUNAT.

## Pendientes de cierre

La vertical fiscal oficial 01/03, transporte/CDR propios de 07/08, cobertura
fiscal adicional, confianza/revocación del certificado y firma CDR siguen sin
cierre. Ver [revisión y criterio de avance](ETAPA2_REVISION_Y_GATE.md).
Se preserva la evidencia original de la única factura técnica autorizada en Beta;
otro uso de la clave real o envío externo requiere acordar su alcance concreto.
