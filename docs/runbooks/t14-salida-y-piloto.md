# T14 — Preparar salida, operar y ejecutar el piloto

**Corte actual 26-10-2026:** el inventario llegó a migración 036 y el [barrido previo a staging](../evidencias/auditoria-staging-2026-10-26.md) corrigió exportación privada, cliente HTTP y Caddy. Los números v0.14.2/023 de esta guía son históricos; para el siguiente despliegue usar el inventario y las puertas vigentes de esa acta.

Para una primera prueba sin contratar servidor de pago, seguir la [guía Oracle Cloud Always Free](oracle-always-free-pruebas.md), preparada para esta versión con dominio HTTPS y correo ficticio privado.

**Base vigente:** v0.14.2, 001–023; siguiente 024. Solo coaches independientes. [Acta inicial](../evidencias/t14.md), [continuación local](../evidencias/t14-continuacion.md), [decisión](../decisiones/014-estabilizacion-y-piloto.md), [ficha de autorización](../piloto/03-salida-independiente.md). La preparación local no autoriza el lanzamiento con datos reales.

## 1. Revisar la entrega sin consumir recursos de más

1. Leer el estado vigente de [avances](../avances.md) y [puertas P01–P18](../piloto/00-puertas.md). Reutilizar actas de funciones no modificadas; fechas históricas no se convierten en aceptación de esta versión.
2. Mantener `.env` fuera de Git y no pegar `docker compose config` completo o URLs de conexión en tickets. No usar el seed compartido ni las cuentas `forma.local` en un entorno público.
3. En una instalación ya preparada, ejecutar solo el chequeo de configuración, sin DB ni navegador:

```powershell
.\scripts\forma.ps1 run release:check
```

4. El comando evalúa configuración **de producción**, aunque la máquina sea de desarrollo. Por tanto, `APP_ORIGIN=http://127.0.0.1:5173` debe producir `needs-attention`. No cambiar `.env` de desarrollo para disimularlo. Resultado 1 indica un requisito fallido; valores `null` indican comprobaciones no solicitadas.
5. Al preparar una versión, ejecutar `build` una vez. Desde 0.14.1 el último paso escribe `dist/release-manifest.json` fuera de la raíz pública. El inventario compara versión y huellas de fuentes web/artefactos; una salida modificada o fuentes posteriores dan `webBuildCurrent=false`. No repetir build por Markdown exclusivamente documental. [Alcance y pasos](t14-continuacion-local.md): la comparación no acredita constructor, dependencias instaladas, variables de compilación o despliegue remoto.
6. Si hay acceso autorizado al destino de prueba, ejecutar una vez:

```powershell
.\scripts\forma.ps1 run release:check -- --database --evidence
```

`--database` exige las dos conexiones explícitas; comprueba migraciones/checksums vigentes exactos (001–023) y rol `forma_api` sin membresías administrativas detectadas. Una conexión/consulta tiene topes de 3/5 s. No ejecuta DDL, migración o consultas a contenido privado. `--evidence` sobrescribe solo `docs/evidencias/t14-preparacion.json`; el informe conserva `pilotApproved: false`.

## 2. Configurar staging antes de arrancar

1. Crear entorno/volúmenes separados del desarrollo, definir operador, dominio y presupuesto en la ficha. Resolver P01/P03 antes de datos reales. Usar cuentas sintéticas propias para aceptación física.
2. Generar credenciales aleatorias distintas para administrador, API, worker, cookies y backup. API recibe solo `DATABASE_URL` de rol restringido. `DATABASE_ADMIN_URL` pertenece al migrador, backup e inventario optativo; no al proceso API.
3. Configurar `SITE_DOMAIN`, DNS y HTTPS. `APP_ORIGIN` debe ser el origen exacto `https://dominio`, sin barra final/ruta/credenciales/query. En producción una URL HTTP o un marcador conocido de COOKIE_SECRET impide arrancar la API. La validación de longitud no mide aleatoriedad.
4. Revisar que `EDGE_SUBNET` (por defecto 172.30.14.0/29) no solape redes del servidor. `CADDY_PROXY_IP` (por defecto 172.30.14.2) debe estar dentro y no ser gateway/broadcast. El overlay asigna esa IP a web y configura `TRUSTED_PROXY_IP` en API. No publicar el puerto API; solo Caddy entra por 80/443. No usar `true`, comodines o rangos completos como proxy fiable.
5. Si se añade CDN, otro balanceador o exposición directa de API, detener la salida y revisar peer/headers/red antes de cambiar confianza. No copiar el ejemplo a otra topología suponiendo que el número de saltos basta.
6. Preparar SMTP autorizado, remitente/DNS, scanner real y rutas/budgets de medios. No iniciar worker SMTP contra la cola antigua de desarrollo ni desactivar el bloqueo de PDF por ausencia de antivirus. El chat actual selecciona audios existentes; no incorpora grabadora de micrófono.
7. Validar esquema sin levantar imágenes:

```powershell
docker compose -f compose.yml -f infra/compose.production.yml config --quiet
```

8. En el entorno de staging preparado, construir y arrancar con las guías de [operación](operacion.md). No se ha realizado ese arranque ni emitido certificados en la entrega local. Compose requiere `!reset`/`!override`. PostgreSQL 18 de contenedores sigue pendiente de ejecución; PostgreSQL 16 local no acredita esa compatibilidad completa.
9. Ejecutar `release:check -- --database` con las conexiones de **ese entorno**, sin `--evidence` si no se quiere reemplazar la evidencia local. Registrar versión de imagen y manifest/checksums. No ejecutar migraciones aplicadas con SQL modificado.

## 3. Aceptación de infraestructura (una vez por entorno)

1. Abrir `/v1/health`: debe corresponder a la versión preparada. `/v1/ready` solo comprueba conexión DB; no prueba SMTP, medios, scanner o todas las migraciones. El inventario añade checksums, pero tampoco sustituye esos servicios.
2. Comprobar por HTTPS que `/sw.js` responde `Cache-Control: no-cache`, las respuestas privadas `/v1/*` conservan `no-store`, `/v1/docs` y bandeja de desarrollo no son públicas. Revisar cookie `__Host-forma_session`, Secure/HttpOnly/SameSite=Strict, sin copiar su valor.
3. Desde dos clientes controlados, comprobar que límites distinguen IP real y que un `X-Forwarded-For` arbitrario no sustituye el cliente. El puerto API no debe ser accesible desde Internet. No hacer carga sostenida ni saturar login con usuarios reales.
4. Probar una entrega SMTP a buzón de prueba autorizado y un fallo/reintento controlado. Registrar resultado sin token/correo real en documentación pública. Revisar cola antes de habilitar envíos.
5. Ejecutar un archivo limpio y uno de ensayo seguro acordado con el responsable del scanner; comprobar fallo/timeout y que no se ofrece descarga antes de procesar. No subir malware ni material de personas reales para probar.
6. Ejecutar `ops:check` una vez con los servicios esperados activos. El informe incluye almacenamiento lógico reservado/finalizado, comprobantes SaaS y del coach. No es medición de egreso o de todos los bytes físicos (temporales/copias/backups quedan fuera).
7. Asignar monitor/alertas al operador: servicio no listo, worker sin latido, cola retrasada, disco bajo y backup >24 h. El comando es una sonda de un momento, no instala vigilancia. Costes desconocidos quedan `null`; fixtures no son denominador comercial.

## 4. Recorrido móvil/PC acotado

1. Completar una ficha por equipo con versión, OS, navegador/instalada y red. Usar iPhone pequeño, otro iPhone, Android de gama baja y PC. [Protocolo detallado](../piloto/01-protocolo.md).
2. Coach: alta coach → marca → invitar alumno sintético → publicar una rutina pequeña → asignarla. Alumno: activar → preparar sesión → dos series → desconectar/reabrir → reconectar → una sola sesión en historial → progreso sin convertir ausencia de dato en cero.
3. Revisar 320/390 px y PC; texto largo, teclado decimal, orientación, safe areas y botón de guardar. Texto al 200 %, zoom, foco y lector de pantalla deben conservar acceso. La evidencia T13 de 320/390/768/1440 se reutiliza porque T14 no cambia componentes/CSS; no sustituye teléfonos.
4. Probar únicamente módulos acordados para piloto: chat/adjuntos con permiso propio, agenda/reserva/cancelación con zona visible, servicio/pago ficticio y comprobante privado. No confundir saldo comercial con cuenta SaaS; alumno no ve CRM/finanzas del coach.
5. Dos cuentas/marcas instaladas no deben compartir identidad. Probar logout, pausa y revocación con URL privada anterior. Pago/reintento/comprobante WebKit T07 ya verificado en [continuación local](../evidencias/t14-continuacion.md); no repetir toda la matriz. Esto no acepta instalación/arranque frío, Safari físico o límites de vídeo/CacheStorage.
6. Guardar incidencia mínima: caso, pasos, resultado esperado/real, severidad, versión y dispositivo. No copiar contenido corporal, chat, recibos, contraseñas o tokens. Repetir solo el caso corregido.

## 5. Continuidad y vuelta atrás

1. Programar **un ensayo autorizado de recuperación externa**, distinto de los backups locales históricos. Copia cifrada y clave bajo custodias separadas; alertas y retención con responsable.
2. Restaurar DB y archivos en destinos nuevos/aislados. Validar 85 indicadores previstos de la versión (69 conteos/16 sumas), hashes/referencias y permisos/comprobantes. Los 81 previstos no son resultados de un ensayo T14.
3. Conciliar bajas, sesiones, revocaciones y eliminaciones posteriores al snapshot antes de reabrir. Conservar historia financiera y permisos; no resucitar fotos retiradas.
4. Medir desde el incidente simulado hasta servicio utilizable (RTO) y desfase de datos recuperados (RPO). No publicar objetivos como mediciones. Registrar evidencia saneada en P09/P14–P18.
5. Antes del despliegue, conservar imagen/config anterior y registrar compatibilidad. T14-07 añade 023 y el contrato de aprobación manual; no declarar compatible un rollback a interfaces antiguas sin ensayarlo con ese contrato y esquema. No ejecutar down SQL; conservar un artefacto/configuración conocidos y registrar la prueba de compatibilidad antes del despliegue. Si se vuelve atrás, cortar altas reales y revisar proxy/controles antes de reabrir. No ejecutar down SQL ni restaurar encima de la base viva.
6. Ante incidente de privacidad/pérdida/doble pago: detener nuevas operaciones afectadas, anotar hora/request_id, preservar evidencia mínima y escalar al responsable. Reparar mediante mecanismos auditados; no editar hechos financieros con DELETE. Reabrir con decisión registrada y un caso dirigido aprobado.

## 6. Autorizar y observar el piloto

1. Completar [ficha de salida](../piloto/03-salida-independiente.md), precio, contenido, identidad/soporte y derechos de datos. No presentar la firma NAVZ como operador automáticamente.
2. El responsable cierra las puertas que aplican con evidencia, fecha y firma; cualquier exclusión de módulo debe ser explícita y efectivamente impedir su uso. No basta omitir la prueba de una función disponible.
3. Incorporar 3–5 coaches independientes solo cuando se autorice; sin contactos del agente. Registrar cohortes/observación sin publicar datos personales.
4. Seguir semanas 1–4 del [registro](../piloto/02-registro.md): primera rutina/sesión, uso semanal, tiempos observados, errores, soporte y costes reales. No derivarlos de fixtures o timestamps de DB.
5. Decidir pasar/corregir/pausar con cero incidentes críticos abiertos y evidencia física/operativa. T14 local cerrada no equivale a piloto real completado; no hay una tanda 15 autorizada por defecto.
