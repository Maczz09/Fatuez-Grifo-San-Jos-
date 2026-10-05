# Secretos locales (no versionar)

Crear en este directorio, con ACL de lectura sólo para el administrador del
servidor y el servicio de Docker:

- `postgres_admin_password.txt`: contraseña aleatoria del rol administrador de
  PostgreSQL, usada sólo para inicialización/operación.
- `identity_db_password.txt`, `billing_db_password.txt`,
  `sunat_db_password.txt`, `mailer_db_password.txt` y
  `reporting_db_password.txt`: credenciales diferentes; cada rol sólo es dueño
  de la base de su microservicio.
- `redis_password.txt`: contraseña aleatoria de Redis.
- `app_master_key.txt`: 32 bytes aleatorios en Base64; cifra por envelope
  encryption las credenciales SOL, API SUNAT y contraseña del PKCS#12.
- `jwt_private_key.pem` y `jwt_public_key.pem`: par RSA para tokens emitidos por
  `identity-service`; los demás servicios sólo reciben la clave pública.
- `internal_service_token.txt`: credencial aleatoria para APIs internas que no
  se publican a operadores.
- `tls_cert.pem` y `tls_key.pem`: certificado TLS y clave usados por Kong.

El certificado cargado desde el setup se guarda cifrado en `private_data`; no
se copia a la imagen, al repositorio ni a variables `NEXT_PUBLIC_*`. Añadir
`secrets/*.txt` al `.gitignore` del monorepo.
