# Traslado limpio a Windows 11 Pro — servidor de prueba

La entrega de fuentes se genera con `scripts/package-clean-source.py`. No contiene las carpetas locales de asistentes, dependencias instaladas, compilados, secretos, certificados privados, bases, respaldos ni temporales. Incluye código nuevo aunque todavía no esté confirmado en Git. El manifiesto SHA256 permite comprobar cada archivo. El paquete es **fuente para compilar**, no una aplicación ya instalada ni evidencia de que todos los pendientes funcionales estén terminados.

## Qué copiar

Utilizar `output/install/FactuEz_fuentes_limpias_Win11_20261028.zip` y extraerlo en una carpeta nueva del equipo de prueba. No copiar íntegra la carpeta de trabajo del desarrollador, `output`, `tmp`, `.factuez-demo`, `backups` o `secrets`. No importar ventas o credenciales reales desde este equipo.

El respaldo de lo retirado por limpieza permanece únicamente en `output/codex-cleanup-backup-*.zip`; no forma parte de la entrega.

## Preparación del equipo

1. Instalar Docker Desktop para Windows y usar su backend WSL 2 con **contenedores Linux**. Comprobar los requisitos de la versión instalada y que la virtualización esté habilitada.
2. Abrir Docker Desktop y comprobar desde PowerShell `docker info --format '{{.OSType}}'`: debe devolver `linux`. Comprobar también `docker compose version`.
3. Preparar los secretos y volúmenes nuevos del entorno de prueba siguiendo el Compose y la guía de pruebas elegidos. El ZIP no los proporciona ni reutiliza los del desarrollador.
4. Compilar o descargar imágenes de una versión revisada, preparar el esquema de bases nuevas y revisar los puertos antes de arrancar. No usar el Compose de producción Ubuntu sin adaptar y revisar sus rutas `/srv`, permisos y archivos de infraestructura para el entorno Windows.
5. Mantener las pruebas en desarrollo/Beta; la limpieza no activa SUNAT, SMTP externo ni producción. Validar acceso, datos, permisos y colas antes de compartir la aplicación.

El circuito `infra/deployment/cicd/deploy.mjs` exige Linux y está destinado al VPS Ubuntu. La publicación de imágenes desde GitHub puede reutilizarse en Windows con Docker Desktop, pero **el despliegue remoto automatizado a Windows no está implementado por este circuito**. No ejecutar el script Ubuntu como si fuera un instalador de Windows.

Documentación oficial: [Docker Desktop en Windows](https://docs.docker.com/desktop/setup/install/windows-install/) y [backend WSL 2](https://docs.docker.com/desktop/features/wsl/).

## Limpieza realizada

Se retiraron `.agents`, `.kilo`, `skills-lock.json` y las notas internas `CORPORATE_DOCUMENT_HANDOFF.md` y `CORPORATE_MAIL_HANDOFF.md`. Se excluyen asistentes del contexto Docker y de nuevas entregas. Se conservan la aplicación, Swagger, GitHub Actions, pruebas y guías operativas. Los archivos de sesión de usuarios no son archivos de Codex y se conservan.

No se borraron contenedores, volúmenes, certificados, ventas, bases ni trabajo pendiente. Los directorios de datos del equipo original quedan fuera del paquete.
