# Verificación B2B — 22/10/2026

Continuación posterior: [cuarto bloque, catálogos y bienes locales](B2B_VERIFICACION_CATALOGOS_2026-10-22.md).
Los resultados de este archivo corresponden al tercer bloque y se conservan como historial.

## Alcance

Tercer bloque B2B-07: [registro local de establecimientos](B2B_FASE7_MAPA_ESTABLECIMIENTOS.md),
administración privada y guard estricto de preparación. Código candidato aislado;
no cierra fase 7 ni las etapas fiscales históricas, ni autoriza despliegue oficial.
Resultados anteriores: [registro del 21/10](B2B_VERIFICACION_2026-10-21.md).

## Evidencia del bloque

| Verificación | Resultado |
| --- | --- |
| Núcleo y política de configuración | 166 pruebas aprobadas |
| Adaptador SQL: contrato, reintentos y fallos transaccionales | 32 pruebas aprobadas |
| Preparador con guard estricto | 13 pruebas aprobadas |
| HTTP privado HTTPS/mTLS | 73 pruebas aprobadas |
| PostgreSQL NUEVO | 38 grupos aprobados |
| Tipos del monorepo | 28 tareas correctas en 21 paquetes |
| Regresión general | 190 archivos; 8.338 aprobadas, una omitida, cero fallos |

Las 252 pruebas del núcleo/guard/HTTP están incluidas en la regresión general.
La suite nueva del adaptador SQL se incorporó después de que Vitest enumerara
los archivos: sus 32 casos se ejecutaron por separado y aprobaron. No se presentan
como un único recuento de 8.370 de esa corrida. En conjunto, los cuatro archivos
del bloque tienen 284 pruebas aprobadas; no hubo cambios de fuente después de
la regresión. La omisión condicional XSD anterior no es nueva.

- Núcleo real con persistencia en memoria transaccional para las pruebas, no
  implementación fallback para despliegue: autoridad reforzada, revocación,
  revisiones de emisor/sede/mapa, CAS, retiro explícito, corrupción, aislamiento,
  lectura administrativa de mapas obsoletos y guard de origen/destino.
- Tres tipos de ensayos separados: las pruebas HTTPS/mTLS usan un núcleo
  double, las de dominio usan memoria y el ensayo PostgreSQL usa lectores reales
  con una autoridad humana ficticia explícita. No se suman como un piloto SUNAT.
- PostgreSQL NUEVO: 38 grupos aprobados con DDL, triggers, CAS/concurrencia,
  auditoría append-only, cuotas, reinicio y guard sobre una guía READY real del
  fixture. El helper conserva tmpfs, ausencia de red/puertos y limpieza del
  contenedor etiquetado propio. No se consultó una base existente.
- Contadores, Document, ítems, Outbox y lotes fiscales no cambiaron. Preparar con
  mapa no crea operaciones adicionales del borrador. Las versiones/auditoría/cuotas
  del registro y las operaciones CREATE/READY del fixture son cambios esperados.

La revisión detectó y corrigió dos casos del guard directo: remitente o destinatario
de un RUC ajeno podían coincidir con direcciones del mapa. Ahora ambos deben
pertenecer al emisor local, además de verificar el RUC del binding. Se conservaron
las dos regresiones y se añadieron al ensayo PostgreSQL, repetido tras compilar.
El preparador ya comprobaba las partes; el nuevo guard conserva esa restricción
también al usarse directamente desde otro ensamblaje interno.

El modo estricto también rechaza un resultado de guard ausente/mal formado;
no cae silenciosamente al modo declarativo anterior. Una coincidencia local no
promueve flags de validación oficial ni retira gates del contrato de preparación.

## Interfaces y operación

Dos rutas adicionales exclusivamente privadas; el B2B público mantiene 63
operaciones candidatas y 38 GET. Inventario: 247 rutas declaradas, 30 funciones,
109 acciones planificadas. No se infiere publicación por encontrar decoradores.
El OpenAPI público anterior permanece compatible y fue contrastado contra fuente.

El módulo administrativo requiere un host HTTPS dedicado con `bodyParser:false`,
pares administrativos fijados y autoridad humana propietaria. Su lector JSON valida
par/cabeceras antes del cuerpo, máximo 128 KiB y deadline total de diez segundos;
timeout devuelve error saneado y cierre. No acepta actor/contexto/entorno en JSON.
El esquema no se aplica al iniciar. No se habilitaron main/AppModule/Kong ni se
configuró un administrador ficticio en producción.

La revisión estática final no encontró otros P1/P2 en el núcleo/STORE/DDL.
No acredita SSO real, permisos de despliegue, inscripción SUNAT de establecimientos
o confianza del certificado. Los mapas de prueba son íntegramente ficticios.

## Sin efectos externos

No se leyeron credenciales/P12/tokens/configuración fiscal real, no se modificaron
otros RUC, ventas o series existentes, y no hubo SOAP/REST/OAuth, correos o webhooks
reales. No se ejecutaron db push/migradores ni se reinició el stack QA. No se retiró
ninguna guarda de TLS, fiscalidad o aislamiento.

Comandos: `pnpm test:b2b-guide-establishments`,
`pnpm test:b2b-guide-establishments:db`, `pnpm typecheck` y regresión Vitest completa.
El ensayo DB sólo acepta `--isolated-synthetic-only`, no una URL de base del cliente.
