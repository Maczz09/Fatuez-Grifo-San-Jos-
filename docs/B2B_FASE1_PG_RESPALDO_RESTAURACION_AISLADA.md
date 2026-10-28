# Fase 1 — Ensayo real aislado de PostgreSQL: respaldo y restauración

Fecha: 27/10/2026. Ensayo técnico con datos exclusivamente ficticios; no es una autorización para producción ni declara completo el respaldo integral B2B-09.

## Ejecución reproducible

Desde la raíz del repositorio, en Windows con Docker Desktop local y la imagen `postgres:17-alpine` ya instalada:

```powershell
node tests/b2b-backup-pg-real-isolated.cjs --isolated-synthetic-only
```

Sin el argumento exacto, la prueba sale antes de llamar a Docker. No acepta rutas, URL, nombres de bases o contenedores, imágenes, contraseñas ni otros parámetros. Usa exclusivamente el contexto `desktop-linux` si su endpoint es el pipe local de Docker Desktop, y resuelve la imagen local por ID; `--pull never` impide descargas. Requiere que Docker Desktop esté en ejecución. El script no lee archivos `.env`, credenciales, respaldos existentes ni configuraciones de FactuEz.

## Aislamiento y procedimiento

Se crean dos contenedores independientes, etiquetados con UUID de ejecución y rol `source` o `target`. Se comprueban ID, nombre, etiquetas, imagen, modo `network=none`, ausencia de puertos publicados y uso de tmpfs para los datos de PostgreSQL y `/tmp`, sin montajes de archivos del host. PostgreSQL tiene `listen_addresses` vacío, por lo que las conexiones son por socket Unix dentro de cada contenedor. Se usa autenticación `trust` exclusivamente en estos clústeres temporales y sin red; no se introduce ninguna contraseña ni se consultan credenciales externas.

Se crea una base ficticia en el origen y otra nueva y vacía en el destino. El ensayo crea una tabla con dos filas sintéticas, otra vacía, índice, restricción CHECK, función, trigger y secuencia de identidad mayor que 2^53. Ejecuta `pg_dump` real en formato custom sin filtros y examina su TOC con `pg_restore --list`. Los bytes pasan en memoria mediante los procesos Docker; no se guardan en una ruta del host.

Antes de la restauración válida, se intenta restaurar un archivo truncado con `--single-transaction --exit-on-error`: debe fallar y el destino debe seguir vacío. Después se restaura el dump completo con esas mismas opciones. Se comparan de forma independiente las filas, el valor y estado de la secuencia, la tabla vacía, el CHECK, índice, función y trigger; se comprueba que CHECK y trigger siguen activos, que la secuencia genera el siguiente valor esperado y que el origen conserva sus filas. Se verifica la identidad y aislamiento de cada contenedor antes de cada operación y antes de detenerlo. Los recursos creados usan `--rm` y se detienen al finalizar, también ante excepciones ordinarias. Si no puede comprobarse su identidad, el script no los elimina y reporta el ID para conciliación manual. Una interrupción abrupta del proceso o una respuesta incierta de Docker puede requerir revisión manual de los recursos con la etiqueta de ejecución; no ejecutar limpieza general de Docker.

## Resultado observado

- Ejecución final: `c6de6397-acde-44ad-a7b3-79595d2ffcc3`.
- Resultado: **PASS, 11 comprobaciones**, código de salida 0.
- Archivo custom ficticio, SHA-256: `e613a5109c069e7d29ebc166a125a202012dec506c3ffdf899a84a2bba4daeb4`. El hash identifica únicamente este archivo efímero, no un respaldo conservado.
- Ambos contenedores se detuvieron y eliminaron; una consulta posterior filtrada por la etiqueta y el UUID de esta ejecución no encontró recursos.
- Verificación sintáctica de Node: código 0.
- Una ejecución anterior falló en la expectativa de secuencia porque los intentos fallidos consumían valores; se corrigieron los casos negativos asignando IDs explícitos y se repitió la prueba. Sus contenedores también fueron eliminados.

## Alcance y pendientes

Este ensayo demuestra el recorrido real de `pg_dump` y `pg_restore` para el esquema ficticio descrito en dos clústeres nuevos. **No ejecuta `SyntheticPostgresArchiveDriver` ni verifica su autenticación peer, journal o filesystem:** ese driver exige una configuración Linux específica y sigue pendiente de ensayo real. Tampoco integra el adaptador integral ni demuestra la cobertura de todos los esquemas de FactuEz, roles globales, ACL/RLS, extensiones, objetos grandes, Redis, archivos originales, custodia, cifrado, coordinación de escritores o recuperación operativa. Es necesario diseñar y ensayar esos elementos y realizar una restauración autorizada y aislada del conjunto completo antes de cualquier uso operativo. No se activó ningún servicio de producción ni se tocó una base existente.

## Repetición con PostgreSQL 17

Se actualizó el ensayo para usar `postgres:17-alpine`, la versión prevista
en el Compose de revisión, y pasó nuevamente sus 11 comprobaciones en dos
contenedores aislados eliminados al terminar. Ejecución
`40dd7307-1068-4bab-a877-a1d9e4ec4831`; dump temporal SHA-256
`97abdd44342c6c98bd490958ab2839278f2b074a91154bbf7009c8eded2290c7`.
Se mantienen todos los límites de alcance anteriores.
