# B2B-07 — Borradores empresariales de guías 09/31

Actualizado: 21/10/2026. **Primer bloque implementado como código candidato;
la fase 7 completa sigue en curso. No desplegado ni habilitado fiscalmente.**

Continuación: [preparación local UBL 09 privado/04](B2B_FASE7_PREPARACION_UBL09.md).
Los conteos de pruebas y rutas de este documento corresponden al primer bloque;
el registro de verificación mantiene los resultados más recientes.

## Qué entrega este bloque

Nuevo agregado persistente independiente del laboratorio GRE: creación, consulta,
listado, edición, preparación y cancelación de borradores para 09 y 31. Incluye
cabecera, remitente/destinatario, origen/destino, peso, transporte, conductor o
transportista, ítems y referencias declaradas. No usa datos del cliente en pruebas.

`DRAFT → READY` congela un plan empresarial; **NO significa guía emitida,
aceptada ni autorización para trasladar bienes**. `CANCELLED` es terminal.
Una guía READY sólo puede cancelarse, sin modificar su contenido. No hay borrado
de historial. Las revisiones emplean `ETag`/`If-Match`; reintentos con la misma
clave y contenido devuelven el recibo original, sin repetir efectos.

El perfil de borrador 31 exige transporte público, que el RUC del transportista
coincida con su contexto y una referencia 09 declarada. Esto NO implementa todos
los perfiles fiscales de transporte ni acredita esa referencia, permisos MTC,
ubigeos, catálogos, bienes fiscalizados o habilitación de combustibles.

## Separación y permisos

- Identity conserva clientes y concesiones explícitas versionadas para cada par
  contexto–serie de borrador de guía. Alta/reemplazo exige administrador con
  verificación reforzada, revisiones esperadas y auditoría transaccional.
- Billing conserva el agregado y operaciones; revalida el par completo y el
  catálogo antes de escribir y antes de confirmar. Cambios de permisos/configuración
  durante la transacción provocan rollback.
- La fachada B2B recibe sólo respuestas privadas verificadas. Comunicación privada
  HTTPS/mTLS, pares fijados, rutas limitadas y respuestas acotadas.
- Scopes: `b2b:documents:read` más `b2b:guides:read` o `b2b:guides:write`.
  Consultar operaciones exige además `b2b:guide-operations:read`. No se amplía
  `b2b:operations:read`, que mantiene su restricción anterior de emisión.
- USER requiere `document.view`; escritura requiere además `document.issue` y
  alcance asignado completo. SERVICE no inventa un usuario humano. Cada agregado
  queda aislado por cliente, tipo de actor, usuario y par autorizado.
- Los scopes predeterminados siguen siendo contexto/catálogo; nada se concede
  automáticamente por tener permiso de factura, boleta o nota.

El `anchor` 01/03 es un contexto existente de autorización, **no** una factura
referenciada ni una concesión implícita para 09/31. `guideSeriesId` identifica un
registro nuevo `DRAFT_ONLY`, sin contador ni autoridad fiscal. El lector fiscal
existente no se amplió artificialmente para simular originales de guías.

## API candidata

| Método | Ruta `/b2b/v1` | Uso |
| --- | --- | --- |
| POST | `/guide-drafts` | Crear borrador |
| GET | `/guide-drafts` | Listar en su contexto |
| GET | `/guide-drafts/{id}` | Consultar detalle |
| PATCH | `/guide-drafts/{id}` | Editar DRAFT con revisión |
| POST | `/guide-drafts/{id}/ready` | Congelar borrador |
| POST | `/guide-drafts/{id}/cancel` | Cancelar, sin baja fiscal |
| GET | `/guide-operations/{id}` | Consultar recibo propio |

`Authorization: Bearer …` y `X-FactuEz-Actor-Kind: SERVICE|USER` son obligatorios.
Escrituras requieren `Idempotency-Key`; salvo creación, también `If-Match: "vN"`.
Lecturas reciben el contexto íntegro en parámetros: emisor/RUC/BETA, sede, punto,
serie y tipo del anchor, más serie de borrador y tipo 09/31. No basta un ID suelto.
Listado máximo 10; paginación por UUID viva, no corte consistente de exportación.

[OpenAPI candidato](b2b/openapi.candidate.v1.json): siete operaciones adicionales;
62 operaciones públicas candidatas en total. No implica publicación en el Swagger
del stack activo. Los módulos sólo se agregan al ensamblaje si se suministran sus
dependencias explícitamente; no se incorporaron a `main`, AppModule ni Kong activo.

## Persistencia y verificación

DDL candidato aditivo en Billing: `B2bGuideDraftSeries`, `B2bGuideDraft` y
`B2bGuideDraftOperation`. Identity tiene su DDL de concesiones separado.
No hay aplicación de esquemas al iniciar ni cambios al enum fiscal existente.
Registro de borrador y recibo se confirman en UNA transacción Serializable;
CAS, exclusión de reintentos concurrentes y triggers preservan identidad,
congelación y auditoría. Ningún flujo escribe Document, SeriesCounter, Outbox
o DailySummary. No se generan XML/CDR/PDF ni se invocan credenciales SUNAT.

Ensayos específicos: 675 pruebas aprobadas, incluido el ensamblaje opcional real
HTTPS/mTLS y la integridad de metadatos del recibo; 30 grupos aprobados en el
ensayo final PostgreSQL NUEVO, etiquetado, tmpfs, sin red
ni puertos. Su autorización es ficticia explícita; no equivale a una integración
real Identity–Billing–SUNAT ni a PKI del cliente. Tipos: 28 tareas correctas.
Resultados finales: [registro de verificación](B2B_VERIFICACION_2026-10-21.md).

Comandos reproducibles: `pnpm test:b2b-guides` y `pnpm test:b2b-guides:db`.
El segundo reconstruye dependencias y crea únicamente su PostgreSQL desechable;
no acepta una URL de base del cliente. No ejecutar migraciones generales para
activar este bloque.

## Qué sigue dentro de fase 7

1. Productor empresarial fiscal 09/31 con perfiles oficiales, referencias
   comprobadas, catálogos/versiones, actores y reglas de bienes regulados.
2. Firma/PKI, transporte y recepción de CDR, originales y PDF/QR coherentes por
   propietario, y ampliación del lector sólo cuando existan esas fuentes reales.
3. RC/RA, notas de boleta, autorización de todos los miembros, versiones de lotes
   y recuperación de respuestas ambiguas sin renumerar ni repetir efectos.
4. Ensamble y pruebas integradas de esos productores. El piloto externo conserva
   su autorización y gate independiente; no se presume por terminar código.

Antes de despliegue se requiere aprovisionar explícitamente los nuevos registros
DRAFT_ONLY, concesiones y pares privados. No existe aquí alta administrativa
visual de esas series ni autoasignación desde SeriesCounter; la administración
delegada general pertenece a B2B-08. No se asigna numeración fiscal por este medio.

No se modificaron configuraciones/datos reales, contenedores QA, producción,
contadores existentes ni conexiones oficiales. Este avance no cierra las etapas
fiscales históricas 2/3 ni sustituye las aprobaciones del cliente.
