# Operación, respaldos y recuperación

**Referencia vigente T14 (v0.14.2/001–023):** [salida y piloto](t14-salida-y-piloto.md), [comprobación de huellas y cuenta WebKit](t14-continuacion-local.md), [evidencia actual](../evidencias/t14-continuacion.md), [responsables pendientes](../piloto/03-salida-independiente.md). Overlay con IP inmediata fija de Caddy/red edge y API con validación de HTTPS/secretos; revisar subred/IP y no publicar API. Conservar dist/release-manifest.json junto al artefacto, fuera de la raíz pública. Los apartados siguientes conservan el historial; no acreditan staging, SMTP, scanner o recuperación externa.

## Entorno en contenedores

Docker Desktop está instalado en este equipo, pero el motor Linux no estuvo disponible durante la implementación. El esquema de Compose puede validarse sin arrancar servicios. La ejecución de imágenes, los certificados TLS y el comportamiento del proxy se comprobarán cuando haya un motor Docker/VPS operativo.

```powershell
docker compose config --quiet
docker compose up --build -d
```

Compose local usa `127.0.0.1:8080`, PostgreSQL 18, API, worker, Caddy y Mailpit. No arrancar simultáneamente PostgreSQL nativo y el del Compose en el mismo puerto. `migrate` termina antes de que arranquen API y worker. El rol de API carece de DDL y el worker solo consume la cola. La contraseña administrativa se entrega a migrador/backup, no a la API.

Para un VPS, configurar secretos propios, `SITE_DOMAIN`, SMTP y un destino independiente de respaldo; después usar `docker compose -f compose.yml -f infra/compose.production.yml --profile backup up --build -d`. El overlay requiere Docker Compose con soporte de `!reset`/`!override`. Verificar `config --quiet`, dominio/DNS, volúmenes y permisos antes de ejecutar. El sitio obtiene HTTPS con Caddy y la DB deja de tener puerto de host. No hay despliegue remoto realizado.

## Backup cifrado y ensayo local

`npm run backup` produce un archivo `.enc` con dump PostgreSQL, manifiesto y medios. AES-256-GCM autentica el contenido, scrypt deriva la clave y una contraseña aleatoria vive en `.env` local. Conservar la clave fuera del servidor para recuperación. Se rechazan enlaces simbólicos dentro de storage.

```powershell
.\scripts\forma.ps1 run backup
.\scripts\forma.ps1 run backup -- verify RUTA_ABSOLUTA_DEL_ARCHIVO.enc
```

`verify` descifra a una carpeta nueva en `.local`, restaura en una base temporal `forma_restore_*`, contrasta conteos y hashes de todos los medios del manifiesto y elimina exclusivamente esa base temporal. La base original permanece abierta. El ensayo está incluido en `test:db`.

Un archivo de backup local no proporciona recuperación ante pérdida del equipo. Antes del piloto hay que montar un destino fuera del VPS, activar el servicio de backup diario y sus alertas, ensayar restauración desde ese destino y medir RPO/RTO. El scheduler emite `backup.completed` o `backup.failed` y termina con error para que el operador detecte el fallo. Retención y monitor externo pendientes de configurar.

## Incidente o despliegue fallido

1. Cortar nuevas operaciones del componente afectado y conservar logs con `request_id` sin copiar credenciales ni contenido de alumnos.
2. Identificar versión, migración y último backup verificado. Restaurar siempre en base/directorio nuevos.
3. Verificar acceso, registros y medios antes de conmutar la aplicación al destino restaurado.
4. Documentar pérdida máxima observada, tiempo de recuperación y causa; rotar secretos si hubo exposición.

Las migraciones se validan por SHA-256 y llevan bloqueo asesor para evitar ejecuciones simultáneas. Una migración aplicada no se reescribe: se crea otra. El retorno de aplicación exige migraciones compatibles con ambas versiones.

## Incorporación de T03

[Manual de biblioteca y medios](t03-uso-y-operacion.md). `dev` inicia web/API y worker de medios; el worker SMTP se mantiene separado. Compose añade servicio `media`, FFmpeg/FFprobe, storage compartido, healthcheck, 2 CPU/768 MiB y temporales limitados. Migraciones 003–005; no reescribirlas. Estos contenedores aún requieren ejecución y validación en Docker/VPS.

El backup v2 mantiene un snapshot PostgreSQL para conteos/dump/referencias, copia solo archivos finalizados a una carpeta propia y se coordina con el mantenimiento mediante bloqueo asesor compartido/exclusivo. Falla si falta un archivo referenciado. La restauración comprueba conteos, hashes y referencias, además de usar una DB nueva. Las carpetas temporales nuevas de backup/restauración se eliminan al terminar o fallar tras verificar su ruta generada dentro de `.local`; los temporales históricos de ejecuciones anteriores no se borran automáticamente. Nunca restaurar sobre datos activos.

La limpieza de medios expira reservas, concilia leases y retira archivos sin referencias con retención; fallos de unlink se reintentan posteriormente. Antes del piloto configurar alertas de disco/cola/worker y backup externo. El ensayo adicional de T03 restauró 132 archivos ficticios de la base local; no acredita recuperación desde otro equipo.

## Incorporación de T04

[Manual de rutinas](t04-uso-y-operacion.md). Aplicar 006–008; conservar sus checksums. No borrar versiones publicadas o sus medios para liberar espacio: son dependencias históricas. Archivo/cancelación no eliminan snapshots. Un cambio de plan se hace con nueva asignación tras revisar periodos solapados.

La restauración compara también conteos de programas, versiones y asignaciones si constan en el manifiesto; mantiene compatibilidad con backups anteriores. Ensayo final local de T04: cinco conteos y 160 archivos privados verificados con las ocho migraciones. Las suites trabajan en bases aisladas; el destino externo y sus alertas siguen pendientes.

Aceptación de invitaciones local: 50/15 minutos para ejecutar la matriz ampliada. Producción conserva 8/15 minutos, verificado por unitarias. No ejecutar regresiones/capturas contra datos reales. T05 inicia en migración 009.

### Referencia histórica de cuentas T02

[Guía de cuentas, suspensión, planes, correo y soporte](t02-uso-y-soporte.md). Migración 002 aplicada en local; no editarla después de su checksum. Confirmación, recuperación e invitación utilizan el mismo worker SMTP; los mensajes pueden reintentarse y el estado de cola no acredita entregabilidad. No usar la cuenta sembrada de superadmin en producción.


## Sesiones y pendientes T05

Migraciones hasta 010, [contratos](api-t05.md) y [recuperación de pendientes](t05-uso-y-operacion.md). Una cola local no forma parte del backup servidor hasta aceptarse: no borrar datos del sitio ni cerrar sesión sin revisar el contador pendiente. El JSON descargado es privado y no equivale a una importación ni a un registro confirmado. Cancelar conserva historial y detiene escrituras.

El backup cifrado contrasta ahora ocho conteos y referencias privadas. Mantener publicados juntos el shell y sus assets por versión; las actualizaciones esperan al cierre de pestañas. No cachear `/v1` ni medios privados en CDN/service worker. La aceptación iPhone/Android, restauración externa y despliegue siguen como puertas de T07.

## Incorporación de T10

V0.10.0/019, [manual de seguimiento](t10-uso-y-operacion.md). Añadir programador `dev:followup`/servicio Compose `followup`, monitor de heartbeat y soporte WebSocket del proxy. Medios incorpora audio/PDF, `MEDIA_WORKER_CONCURRENCY=1` por defecto y scanner configurado también en medios. Descarga privada revalida conversación y recurso original.

Trece conteos adicionales, 49 indicadores previstos hasta 019. Sin backup/restore ni Docker nuevo ejecutado en T10. No confundir ese inventario preparado con una recuperación aprobada. Mantener restauración T08–T10, scanner real, móviles y privacidad como puertas. El mantenimiento retira contenido vencido y ficheros revocados siguiendo el umbral T03; revisar revocaciones tras recuperar backups históricos.
