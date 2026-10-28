# B2B-06 — Evidencia propietaria de documentos individuales

Fecha: 21/10/2026. Componente candidato de sólo lectura; no activación fiscal.

## Avance implementado

Se preparó `BetaOwnerDocumentAcceptance`, que compone un lector Prisma SUNAT,
el almacén de artefactos, verificación de firma del emisor y el verificador CDR
existente. No recibe XML, ZIP, rutas o banderas de confianza de una aplicación
externa. Lee las copias del propietario y contrasta el snapshot completo.

Perfil de esta entrega: factura 01 y notas F de crédito 07 y débito 08 de los
constructores UBL actuales de FactuEz, exclusivamente BETA. No es un validador
general de XML históricos/proveedores ni soporta nuevos regímenes fiscales.
Las boletas y notas B requieren pertenencia/versionado de un RC. Su composición
propietaria candidata se implementó en la [continuación integrada](B2B_FASE6_COMPOSICION_Y_RESULTADOS.md).

## Qué comprueba

- Snapshot SUNAT idéntico al solicitado por el propietario de negocio; tipo,
  RUC, serie, número, fecha y perfil coherentes. Una nota requiere su contexto
  original completo para reconstruir el cuerpo UBL.
- Estado y fecha de aceptación coherentes con una única operación `sendBill`
  propia finalizada. Varios intentos o resultados ambiguos no se resuelven
  eligiendo silenciosamente un éxito anterior.
- XML firmado y CDR ZIP originales, con identificador, tamaño y SHA-256.
  Manifiesto, evento, operación y CDR log deben corresponder a esa identidad.
- Reconstrucción completa del XML esperado y firma XMLDSig con certificado
  público resuelto por RUC y huella archivada. `KeyInfo` no aporta confianza.
- Certificado público vigente, RSA admitido, uso de firma, identidad RUC,
  cadena y CRL mediante el servicio de confianza existente. Sin pruebas de
  confianza/revocación la comprobación falla; no existe opción de omitirlas.
- ZIP CDR clásico acotado: coherencia de cabeceras, CRC, rutas, duplicados,
  tamaño y nombre esperado. Se reutiliza la comprobación estricta del RC,
  sin relajar su política. Sólo admite XML esperado y `dummy/` vacío opcional.
- CDR con emisor SUNAT, receptor RUC, referencia y tipo exactos, código y fecha
  coherentes, observaciones separadas y firma/confianza CDR verificadas de nuevo.
- Segunda lectura de metadatos y archivos para detectar cambios durante los
  pasos asíncronos. Devuelve huellas de versión para una futura reserva.

## Certificados públicos y configuración

`PinnedBetaIssuerPublicCertificates` recibe una lista de despliegue explícita:
RUC, huella SHA-256 del certificado, ruta absoluta del PEM público y hash del
archivo. No busca archivos del usuario ni obtiene rutas de solicitudes HTTP.
El lector existente comprueba archivo regular, no enlaces, tamaño, hash y
ausencia de claves privadas. El PEM empieza por la hoja y puede incluir cadena.

Esta configuración no lee ni extrae un `.p12`, ni consulta `SunatCredentials`.
No sustituye los pins de firmante SUNAT, raíces y CRL requeridos por los
verificadores existentes. No se configuraron archivos, pins ni credenciales
reales durante este trabajo.

## Resultado y límites de confianza

El resultado incluye evidencia ligada al snapshot, operación, hashes XML/CDR,
huella del certificado, almacén de confianza y fecha de comprobación. Se sella
en memoria: serializar/deserializar el objeto no lo convierte en una capacidad
verificada. Las respuestas JSON de un consumidor nunca sustituyen este proceso.

Conserva `candidateOnly=true`, `fiscalExecutionEnabled=false` y
`transmissionAuthorized=false`. No verifica integridad del historial de créditos,
no calcula saldo disponible ni acredita aprobación contable.

La correspondencia con la operación descansa en metadatos propietarios y en el
ZIP de solicitud, que ahora se abre y se vincula byte a byte al XML firmado.
Se comprueban sus tamaño, SHA-256, CRC, nombre y manifiesto y se relee al final.
No acredita por sí solo una llamada de red oficial ni inventa en el CDR un hash
del cuerpo que no contenga. Ver la [continuación](B2B_FASE6_COMPOSICION_Y_RESULTADOS.md).

El resultado de lectura no evita una carrera posterior: una futura reserva debe
revalidar las huellas y la autoridad vigentes dentro de su protocolo transaccional.
No debe reutilizar una comprobación histórica como permiso de emisión. La fecha
`asOf` corresponde al propietario interno, no a un campo aceptado de una API pública.

## Pruebas reproducibles

- `pnpm test:beta-owner-evidence`: contratos, mutaciones, ZIP, firmas XML reales
  con claves efímeras, fallos de confianza, lector Prisma simulado y regresión RC.
- `pnpm test:beta-owner-evidence:db`: base PostgreSQL nueva, tmpfs, etiquetada,
  sin red ni puertos; lector Prisma real y ensamblaje de sólo lectura.

Las pruebas criptográficas generan certificados ficticios en memoria. La política
de cadena/CRL es un puerto controlado en ese ensayo: no se afirma PKI SUNAT oficial.
El ensayo PostgreSQL usa puertos criptográficos ficticios y no firmas reales;
comprueba persistencia y vínculos, no confianza. No mezcla esas garantías.

[Verificación del 21/10](B2B_VERIFICACION_2026-10-21.md): 72 pruebas nuevas,
8 grupos PostgreSQL, 220 pruebas focalizadas finales y regresión completa de
5.753 aprobadas con una omitida. Tipos: 28 tareas correctas en 21 paquetes.

No hay registro en AppModule, cron, cola, RPC público, Kong o Swagger. No se cambió
la instancia QA ni se ejecutó SOAP, OAuth, correo o callbacks reales. No se
modificaron permisos ni se firmaron ventas del cliente.

## Siguiente bloque

RC/miembros, paquete archivado, prerrequisitos y efectos aceptados/rechazados
tienen composición candidata ensayada. Permanecen pendientes el puente privado
entre propietarios, productor empresarial, reservas dinámicas y conciliación de
respuestas ambiguas. Detalle y límites en la [continuación](B2B_FASE6_COMPOSICION_Y_RESULTADOS.md).

Se conservan los gates cerrados del productor empresarial, ledger y ensayo
sintético. Esta entrega no cierra B2B-06 ni las fases fiscales históricas 2/3.
