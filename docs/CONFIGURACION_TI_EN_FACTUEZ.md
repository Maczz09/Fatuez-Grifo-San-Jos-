# Preparación de FactuEz por TI

El personal autorizado puede introducir la información de cada empresa en la
plataforma. Los datos y claves de la empresa no se solicitan por chat. Esta guía
describe las pantallas existentes y su alcance actual en desarrollo BETA; no
equivale a la habilitación fiscal ni al despliegue privado aprobado.

1. Iniciar sesión como administrador general y abrir **Integraciones y
   preparación**. Elegir en la cabecera el RUC que se va a configurar. La vista
   muestra sólo metadatos del emisor seleccionado; si la consulta falla, indica
   que el estado no está disponible.
2. En **Sedes y maestros**, registrar o revisar el emisor, sus sedes, puntos y
   series confirmados por la empresa. No deducir correlativos de los PDF de
   ejemplo ni cambiar la propiedad de una serie histórica sin conciliación.
3. En **Configuración SUNAT**, seleccionar **Beta / pruebas** y cargar el
   certificado y su contraseña, las credenciales SOL secundarias y, cuando se
   disponga de ellas, las credenciales GRE para ese mismo RUC. La pantalla no
   vuelve a mostrar las claves guardadas. Guardar no activa envío ni valida por
   sí mismo la confianza del certificado, la identidad o la autenticación.
4. En **Documentos recibidos → Recepción automática**, preparar SIRE e IMAP por
   RUC con los accesos autorizados. SIRE puede descubrir comprobantes; el XML
   completo puede quedar pendiente hasta recibirlo del proveedor. La recepción
   externa requiere infraestructura y validación independiente.
5. En **Correo corporativo**, preparar SMTP por RUC. La configuración se guarda
   cifrada cuando el almacenamiento y las claves de infraestructura estén
   disponibles; el flujo actual no acredita autenticación ni entrega externa.
6. En **Integraciones**, usar la sesión administrativa autorizada para gestionar
   aplicaciones y permisos B2B. El acceso privado, las identidades y la
   verificación adicional requieren la configuración de infraestructura y el
   piloto correspondiente. La disponibilidad del panel depende de ese entorno.

Las pantallas que aceptan secretos requieren HTTPS fuera de localhost. El primer
aprovisionamiento de HTTPS, llaves de cifrado, servicios internos, base de datos
y respaldo corresponde a la infraestructura de TI: una pantalla no puede
custodiar sus propias llaves antes de que esa infraestructura exista. No se debe
introducir información real en el entorno de demostración ni sustituir sus datos
ficticios. Cuando exista un entorno autorizado, TI configura los accesos en la
plataforma; nadie necesita enviar certificados o contraseñas al desarrollador.

## Estado del trabajo

El acceso unificado de preparación y la consulta de metadatos Beta se añadieron
al código de la PWA; hay que construir y desplegar esa versión para verla en un
entorno autorizado. Las pruebas de interfaz y sesión aprobadas son 26, incluidas
cinco del panel (`output/qa/b2b-ti-overview-executed-20261027.json`).
El puente privado de historial de notas está ensamblado internamente, resuelve
versiones exactas y vuelve a comprobar el historial; sólo tiene ruta privada y no
declara firma, CDR o historial completo. El adaptador Redis añadido es una
fixture en memoria, no un RDB de Redis ni una restauración operativa. El cierre
B2B-09, la recuperación integral y el piloto privado siguen pendientes. Ver
`B2B_FASE9_CIERRE_OPERATIVO_UBUNTU.md` para los detalles y el Compose de revisión.

## Pendientes SMTP en el panel de TI

Para el RUC seleccionado y con permiso de correo, el panel consulta los indicadores
SMTP existentes y señala almacenamiento, cifrado, lista de servidores, configuración,
aprobación del servidor, credenciales e integridad cuando corresponda. Un error o
una respuesta ajena al RUC se muestran como estado no disponible o no confirmado.
El enlace abre la pantalla existente para configurar el correo; los bloqueos de
infraestructura los resuelve TI. Ningún indicador confirma conexión, entrega ni
activación del envío externo. Los estados pertenecen al entorno consultado.
