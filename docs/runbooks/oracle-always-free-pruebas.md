# Prueba privada en Oracle Cloud Always Free

**Estado:** guía preparada el 26-10-2026; no se ha creado cuenta, VM, dominio ni despliegue. Usar solo cuentas y datos ficticios. Esta guía utiliza el Compose de este repositorio, PostgreSQL dentro de la VM y Mailpit para capturar correos de prueba.

## 0. Enlaces y decisión de coste

- Alta oficial: [Oracle Cloud Free Tier](https://www.oracle.com/cloud/free/) → **Start for free**.
- [Límites Always Free](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm): en la región principal, Ampere A1 permite en total 2 OCPU y 12 GB de RAM gratuitos; el cupo gratuito de volúmenes es 200 GB, incluido el disco de arranque. La disponibilidad A1 varía y Oracle puede recuperar instancias muy ociosas.
- [Condiciones de la cuenta](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier.htm): se suele pedir teléfono y tarjeta para verificar identidad. La tarjeta no se cobra salvo que se actualice la cuenta, aunque puede aparecer una retención temporal. **No pulsar Upgrade / Pay As You Go ni crear recursos sin etiqueta Always Free.** La prueba inicial de US$300/30 días no convierte en gratuitos los recursos que excedan Always Free al terminar.
- Subdominio opcional sin comprar dominio: [DuckDNS](https://www.duckdns.org/about.jsp). Solo se necesita un nombre que apunte a la IP pública de la VM.

El objetivo es **un único servidor de prueba**; no usar Oracle Autonomous Database, load balancer de pago ni discos fuera del cupo. Comprobar límites y avisos de la consola antes de confirmar cada recurso. Esta guía no garantiza una factura cero si se eligen recursos distintos.

## 1. Crear la cuenta

1. Abrir el enlace oficial, pulsar **Start for free**, completar correo, identidad y teléfono. Usar datos propios y guardar el nombre de la cuenta y el acceso multifactor.
2. Elegir con cuidado la **home region**. Las VM Always Free se crean allí; la región principal no se cambia después. Preferir una región con latencia razonable para Paraguay, sujeto a disponibilidad real de A1.
3. Completar la verificación de tarjeta. Tras entrar, comprobar que el tipo de cuenta sigue siendo **Free Tier**, sin actualización a Pay As You Go.
4. En **Governance & Administration → Limits, Quotas and Usage**, localizar los cupos Always Free de Compute y Block Volume. Si no aparece A1 disponible, detenerse; no elegir una forma de pago como sustituto.

## 2. Crear red y VM

Seguir la [guía oficial de creación de instancias](https://docs.oracle.com/en-us/iaas/Content/Compute/Tasks/launchinginstance.htm). Los nombres del menú pueden variar.

1. En **Networking → Virtual Cloud Networks**, crear una VCN con el asistente **Create VCN with Internet Connectivity**. Usar una subred pública regional para esta única VM.
2. En **Compute → Instances → Create instance**, elegir una imagen **Ubuntu 24.04 LTS arm64**. En **Security**, desactivar **Shielded instance** antes de buscar la forma: [Oracle no incluye A1 entre las formas compatibles con Shielded](https://docs.oracle.com/en-us/iaas/Content/Compute/References/shielded-instances.htm). Luego elegir **VM.Standard.A1.Flex** marcada como Always Free. Asignar **2 OCPU y 12 GB RAM** como máximo total de A1 de la cuenta. Evitar E2 Micro de 1 GB para este Compose. Si Ampere sigue sin mostrar A1 después de desactivar Shielded, consultar **View critical resources** y el cupo de A1; no crear una forma de pago por sustitución.
3. Seleccionar la VCN/subred pública, asignar una IPv4 pública y dejar el disco de arranque en unos **50 GB**, dentro del cupo gratuito. No añadir otros volúmenes o IP reservadas sin comprobar su coste.
4. Dejar que Oracle genere una pareja SSH o subir tu clave pública. **Descargar y guardar la clave privada una sola vez**; no subirla al repositorio, al chat ni a la VM. Anotar la IPv4 pública.
5. En el grupo de seguridad o security list de esa subred, permitir **TCP 80 y 443 desde 0.0.0.0/0**; permitir **TCP 22 solo desde tu IP pública /32**. Mantener cerrados 3001, 5432 y 8025 al exterior. Si hay firewall del sistema operativo, permitir 80/443 allí también. [Reglas de red de Oracle](https://docs.oracle.com/en-us/iaas/Content/Network/Concepts/securityrules.htm).

Desde PowerShell en Windows, conectar con la clave descargada (sustituir ruta e IP):

```powershell
ssh -i "C:\ruta\privada\clave.key" ubuntu@IP_PUBLICA
```

El usuario de las imágenes Ubuntu de OCI es `ubuntu`; [instrucciones SSH oficiales](https://docs.oracle.com/en-us/iaas/Content/Compute/Tasks/connect-to-linux-instance.htm). Si SSH protesta por permisos de la clave en Windows, seguir esa guía para restringirlos.

## 3. Nombre gratuito y HTTPS

1. En DuckDNS, crear un subdominio, por ejemplo `mi-forma-prueba.duckdns.org`, y señalarlo a la IPv4 pública de la VM. No publicar la URL hasta comprobar el acceso.
2. Verificar que el nombre resuelve a esa IP (`nslookup mi-forma-prueba.duckdns.org`).
3. El `Caddyfile.production` del repositorio solicitará HTTPS automáticamente cuando `SITE_DOMAIN` sea ese nombre. Deben llegar conexiones públicas a **80/443**; [requisitos de Caddy](https://caddyserver.com/docs/quick-starts/https). No usar la IP desnuda en `APP_ORIGIN`.

## 4. Docker y código

1. En Ubuntu, instalar **Docker Engine, Buildx y Compose plugin desde el repositorio oficial de Docker**, siguiendo [Docker para Ubuntu](https://docs.docker.com/engine/install/ubuntu/). El paquete soporta arm64. Evitar scripts de instalación de terceros.
2. Verificar `uname -m` (`aarch64`), `sudo docker version` y `sudo docker compose version`. El overlay de este proyecto usa `!override`: requiere **Compose 2.24.4 o posterior** según la [documentación de merge](https://docs.docker.com/reference/compose-file/merge/).
3. Preparar un **primer commit revisado** del código y clonarlo desde un repositorio privado en la VM. Actualmente este proyecto local aún no tiene commits; no copiar `.env`, `.local`, `node_modules`, `dist`, ZIP inicial ni bases de desarrollo. Antes de continuar, confirmar que en la VM existen `compose.yml`, `infra/compose.production.yml` y `infra/compose.oracle-test.yml` de la misma revisión.
4. Desde la raíz del proyecto en la VM, crear `.env` a partir de `.env.example` y restringir permisos:

```bash
cp .env.example .env
chmod 600 .env
nano .env
```

5. Definir al menos: `SITE_DOMAIN=mi-forma-prueba.duckdns.org`, `APP_ORIGIN=https://mi-forma-prueba.duckdns.org`, `POSTGRES_PASSWORD`, `API_DATABASE_PASSWORD`, `WORKER_DATABASE_PASSWORD`, `COOKIE_SECRET`, `BACKUP_PASSPHRASE`, `SMTP_HOST=mailpit`, `SMTP_PORT=1025` y `SMTP_FROM=Forma <no-reply@mi-forma-prueba.duckdns.org>`. Generar **valores hexadecimales distintos** para los tres roles DB, cookie y backup; `openssl rand -hex 32` produce uno. Los passwords hex evitan caracteres que requieren escape en las URL PostgreSQL del Compose. Quitar las tres URL de conexión locales de `.env.example` (`DATABASE_URL`, `DATABASE_ADMIN_URL`, `WORKER_DATABASE_URL`): Compose define conexiones internas propias para cada servicio. No dejar valores `forma_local_*`, marcadores `replace-with-*` ni pegar secretos en capturas o tickets. `SMTP_USER` y `SMTP_PASSWORD` pueden quedar vacíos porque Mailpit es interno.
6. `CLAMAV_HOST` vacío mantiene bloqueada la subida de PDF que exige antivirus. Para la primera prueba, dejarla vacía y comprobar las demás funciones; no presentar ese módulo como habilitado.

## 5. Arrancar una sola vez

Los tres archivos Compose van en este orden. El tercero deja Mailpit visible **solo en `127.0.0.1:8025` de la VM** para abrirlo por SSH, sin exponerlo a Internet.

```bash
sudo docker compose -f compose.yml -f infra/compose.production.yml -f infra/compose.oracle-test.yml --profile local-mail config --quiet
sudo docker compose -f compose.yml -f infra/compose.production.yml -f infra/compose.oracle-test.yml --profile local-mail up --build -d
sudo docker compose -f compose.yml -f infra/compose.production.yml -f infra/compose.oracle-test.yml --profile local-mail ps
```

La primera construcción instala Node, FFmpeg y Chromium, y puede tardar. Si `config --quiet` falla, **no ejecutar `up`**. Si alguna imagen no construye en arm64, registrar el error concreto y corregirlo antes de seguir. No subir la base de datos ficticia local: el migrador crea el esquema 001–036 en una base nueva; el seed de desarrollo no se usa en producción. Este comando **no inicia el perfil `backup`** ni configura copias externas.

## 6. Entrar y comprobar

1. Abrir `https://mi-forma-prueba.duckdns.org` desde el móvil. El certificado debe ser válido y el navegador debe permitir instalar la PWA. Comprobar `/v1/health` y `/v1/ready` sin exponer datos privados.
2. Crear **un coach ficticio**. Su correo de verificación llegará a Mailpit, no a una cuenta real. Desde PowerShell abrir un segundo terminal SSH con túnel:

```powershell
ssh -i "C:\ruta\privada\clave.key" -L 8025:127.0.0.1:8025 ubuntu@IP_PUBLICA
```

3. Mientras ese SSH siga abierto, abrir **solo en tu PC** `http://127.0.0.1:8025`, localizar el correo y usar el enlace de verificación en el navegador. No abrir 8025 en las reglas de Oracle. Los mensajes de Mailpit son solo de prueba y pueden contener enlaces privados.
4. Crear un alumno ficticio, invitarlo, entrar desde otro navegador móvil y recorrer rutina, dieta, mediciones y exportación. Comprobar que un segundo coach no ve esos datos. No introducir datos corporales de personas reales todavía.
5. El panel `/admin` requiere un **alta inicial de superadmin controlada**; registrarse como coach no concede ese permiso. Seguir el procedimiento de [uso y soporte](t02-uso-y-soporte.md) con una cuenta propia verificada y auditoría de la transacción. No usar el superadmin ficticio del seed local ni activar el permiso mediante una petición web.
6. Mantener una copia cifrada fuera de la VM antes de convertir la prueba en piloto. El volumen local sobrevive a reinicios, pero no es una copia externa. Ver [puertas del piloto](../piloto/00-puertas.md).

## 7. Revisar coste y resolver bloqueos

- En Oracle, comprobar periódicamente el consumo de Compute/Block Volume y que la instancia conserva la forma **Always Free**. Oracle avisa que puede recuperar VM muy ociosas; no usarla como único lugar para información valiosa.
- Si el asistente muestra un importe para el disco de arranque, no asumir que es una factura: [la estimación no aplica necesariamente precios por tramo](https://docs.oracle.com/en-us/iaas/Content/Billing/Tasks/signingup_topic-Estimating_Costs.htm). Confirmar la home region y que la suma de discos de la cuenta está dentro de los **200 GB Always Free**; ante cualquier duda de cobro, detenerse antes de **Create** y revisar límites/Cost Analysis.
- Si A1 indica **out of host capacity**, esperar o probar otro dominio de disponibilidad de la misma home region; no elegir una VM de pago sin decidirlo explícitamente.
- Si SSH funciona pero HTTPS no: comprobar DNS, reglas 80/443 y `sudo docker compose ... ps`; revisar logs del servicio `web` sin publicar secretos.
- Si la app abre pero responde 502: comprobar `api`, `migrate` y `db` en `ps`. Si no llega correo: comprobar `worker` y `mailpit`.
- `sudo docker compose ... down` detiene los contenedores; **no añadir `-v`** si se desean conservar los volúmenes de PostgreSQL y archivos. Detener contenedores no elimina ni deja de reservar la VM de Oracle.

Esta guía cubre un entorno privado de ensayo. La [auditoría de staging](../evidencias/auditoria-staging-2026-10-26.md) enumera las comprobaciones adicionales antes de un piloto con usuarios reales.

**Verificación local de la guía:** la combinación de los tres Compose pasó `config --quiet` con un dominio ficticio. La configuración resultante publica solo 80/443 para `web`, une Mailpit a `127.0.0.1:8025` y no publica `api` ni `db`. No se han construido contenedores arm64 ni probado servicios en Oracle.
