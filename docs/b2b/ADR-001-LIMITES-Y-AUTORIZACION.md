# ADR B2B-001 — límites, actores y evolución del contrato

Fecha: 20/10/2026. Aceptado para el diseño B2B-01; **no activa infraestructura**.

## Decisiones

1. **Dos microservicios nuevos:** `b2b-api-service` como fachada y
   `webhook-service` como propietario de suscripciones/Inbox/entregas. No son
   módulos añadidos al gateway ni un motor fiscal duplicado. Kong conserva su
   papel de entrada privada; los propietarios conservan reglas y autorización.
2. **Datos por propietario.** La fachada no accederá a las BD de Billing/SUNAT,
   claves de firma, P12, SOL ni sus volúmenes/colas de emisión. No habrá FK ni
   transacciones entre bases de servicios distintos. Su registro operacional
   no sustituye el comando deduplicado del propietario.
3. **Audiencia nueva:** `factuez-b2b-v1`. `/integration/v1` y su audiencia de
   extracción permanecen separados, compatibles y sólo lectura. No añadir
   scopes de escritura al token legado ni reenviarlo como identidad humana.
4. **Actores distintos:** SERVICE con client_credentials; USER delegado con
   Authorization Code + PKCE. La fachada no recibirá la contraseña del usuario
   ni aceptará roles, permisos o identidad aportados por el JSON del cliente.
   Selección de proveedor OIDC e integración de cuentas: decisión B2B-02;
   Keycloak sigue siendo candidato, no software instalado por esta fase.
5. **Permiso efectivo:** cliente ∩ usuario cuando exista ∩ grant canónico de
   RUC/sede/punto/serie/tipo ∩ política/estado del propietario. Los scopes no
   reemplazan esos checks. Administración crítica necesita persona privilegiada
   y step-up; SERVICE no hereda ADMIN. Revalidar antes de efectos encolados.
6. **BETA exclusivamente.** Ni contrato ni permiso ni certificado guardado
   levantan el bloqueo fiscal. Los estados oficiales requieren evidencia
   verificada y vinculada; una simulación no pasa por aceptación de SUNAT.

## Contratos durante B2B-01

Se publican como **subrutas opt-in de `@factuez/contracts`**, fuera de `index.ts`:
`/b2b`, `/b2b-openapi`, `/b2b-webhooks`. Son módulos puros sin Nest, DB ni red.
Esto evita instalar dependencias o fingir servicios ejecutables antes de su
identidad/adaptadores. Al crear los servicios se podrán separar en los paquetes
`b2b-contracts` y `webhook-contracts` previstos, conservando versión y pruebas.

El inventario contiene el alcance completo propuesto; OpenAPI especifica sólo
el primer corte de 21 operaciones. Las demás 77 acciones están inventariadas,
**no tienen todavía DTO completos ni controladores B2B**. No generar un cliente
que asuma disponibles esas 98 operaciones. El catálogo de 12 eventos tampoco
implementa el dispatcher, su firma o un broker.

## Consecuencias y alternativas descartadas

- No proxy genérico de todas las rutas internas: expondría laboratorios,
  contratos inestables y capacidades que aún no son empresariales.
- No suplantación de usuario ADMIN desde un token técnico ni sólo guard en Kong.
- No conversión silenciosa de rutas del router en funciones implementadas:
  una entrada de Kong, un enum o una tabla no acreditan un caso de uso completo.
- No migración de contraseñas ni instalación OIDC improvisada en esta entrega.
- Auditoría de fuente reproducible, sin afirmar registro efectivo de módulos,
  disponibilidad en ejecución, autorización efectiva ni validez fiscal.

## Aceptación de B2B-02

Implementar principal verificable, grants vigentes, revocación y separación de
audiencias con pruebas de denegación cruzada. Conectar una lectura del contexto
canónico mediante interfaz privada del propietario. Aprobar ADR OIDC y puente
de cuentas antes de habilitar login desde otra aplicación. No empezar emisión
si esos controles fallan. El despliegue y las migraciones se revisan aparte.
