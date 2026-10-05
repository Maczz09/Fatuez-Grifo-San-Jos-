# Prueba local integrada (sin SUNAT real)

Este corte sirve para verificar, en una sola máquina, el recorrido **PWA →
Kong → Identity → Billing → Redis/BullMQ → Sunat-service**. No firma, no envía
SOAP/REST y no carga certificado digital, clave SOL ni credenciales de GRIFO
SAN JOSE S.R.L.

## Requisitos

- Docker Desktop en ejecución.
- Node.js 22.18 o superior y Corepack habilitado.
- Puerto local `8080` disponible. La prueba sólo escucha en `127.0.0.1`.

## Levantar la prueba

Desde la raíz del repositorio:

```powershell
node .\scripts\create-demo-secrets.mjs
docker compose -f .\docker-compose.demo.yml up --build --wait
```

El primer comando genera claves y una contraseña aleatoria en
`.factuez-demo\demo-admin.txt`; ese directorio está ignorado por Git. Consulte
el archivo sólo en la máquina de prueba:

```powershell
Get-Content .\.factuez-demo\demo-admin.txt
```

Abra [http://localhost:8080](http://localhost:8080), ingrese con `demo.admin`
y la contraseña del archivo. Emita una boleta `B001`: se reservará el
correlativo, se registrará el documento, BullMQ entregará el evento y
`sunat-service` construirá el UBL no firmado. La lista cambiará a
**Procesando**, que en esta prueba significa “UBL construido, sin firma ni
transmisión”.

Para comprobarlo sin operar la interfaz:

```powershell
node .\scripts\verify-demo.mjs
docker compose -f .\docker-compose.demo.yml exec sunat-service sh -lc "find /data/artifacts -type f"
```

El segundo comando muestra el XML UBL generado dentro del volumen efímero.

## Detener y limpiar

```powershell
docker compose -f .\docker-compose.demo.yml down -v
```

Esto elimina **sólo** los volúmenes `factuez_demo_*` de la prueba. No ejecute
este comando contra el compose productivo. Para crear nuevos secretos después
de limpiar los volúmenes, ejecute `node .\scripts\create-demo-secrets.mjs
--rotate`.

## Qué queda fuera de esta prueba

La activación de firma XMLDSig, SOAP/REST de SUNAT, certificado `.p12/.pfx`,
credenciales SOL/OAuth, PDF/ticket, correo y GRE requiere una homologación
controlada y datos reales validados. El compose productivo sigue siendo un
artefacto separado y no debe iniciarse con estos secretos de demo.
