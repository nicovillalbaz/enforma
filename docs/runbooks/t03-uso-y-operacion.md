# T03 — Uso y operación de la biblioteca

**Versión:** 0.3.0 · **Fecha:** 21-10-2026. Implementación local; teléfonos físicos, correo y despliegue continúan pendientes. [Decisiones y límites](../decisiones/003-biblioteca-y-medios.md) · [API](api-t03.md) · [Pruebas](../evidencias/t03.md).

## 1. Preparar el entorno

1. Seguir [desarrollo](desarrollo.md), conservar `.env` y ejecutar las migraciones 003–005 con `npm run db:migrate`. No editar migraciones aplicadas ni ejecutar el SQL conceptual original.
2. Instalar FFmpeg con FFprobe y comprobar `ffmpeg -version` y `ffprobe -version`. En este equipo están en PATH; `.env.example` muestra cómo indicar rutas absolutas alternativas. El contenedor incorpora ambos binarios.
3. Ejecutar `npm run dev`: inicia API, web y worker de medios separados. `npm run dev:media` sirve para iniciar solo este último. El worker SMTP sigue siendo `npm run dev:worker` y requiere SMTP disponible.
4. Abrir `/acceso`, entrar como `coach@forma.local` / `Forma-demo-2026!` y elegir Nico Studio. Estas cuentas son ficticias y el seed está prohibido en producción.
5. Abrir **Ejercicios → Medios**. Comprobar el indicador del procesador y el uso de espacio/minutos. Una carga aceptada solo significa que el original y el trabajo están guardados. **Listo** confirma la conversión publicada.
6. Si el proceso no está disponible, revisar `scripts/check-media-worker.ts`, FFmpeg/FFprobe, migraciones y conexión del rol `forma_worker`. No entregar credenciales administrativas al worker o a la API.

En Windows puede usarse `scripts/forma.ps1 run ...`, que selecciona Node 24. Para argumentos que empiezan con guiones, escribirlos entre comillas; por ejemplo `.\scripts\forma.ps1 run test:e2e '--' '--workers=1'`. Playwright también fija un solo worker en su configuración.

## 2. Crear material del estudio

1. En **Equipos**, pulsar **Nuevo equipo**.
2. Escribir nombre, descripción, ubicación y estado: disponible, mantenimiento o archivado.
3. Subir una foto propia. Esperar **Archivo recibido. Su procesamiento está en cola.** y guardar. La tarjeta mostrará la foto cuando esté lista.
4. Editar si cambia su ubicación o estado. Las actualizaciones incluyen una versión: si otra sesión lo modificó, volver a abrir la ficha antes de guardar.
5. Para sustituir una foto, elegir otra o desvincularla. Los medios asociados no se pueden eliminar hasta retirar sus referencias.

Los equipos de otra organización no son seleccionables ni asociables mediante un ID conocido. La foto de equipo solo admite imágenes.

## 3. Crear y publicar una guía

1. En **Ejercicios**, buscar por nombre/instrucciones/etiquetas y filtrar por origen, músculo y estado.
2. **Catálogo base** contiene cuatro textos originales, sin vídeos de terceros. **Usar como base** crea una copia propia editable; el catálogo global permanece de solo lectura.
3. Pulsar **Nuevo ejercicio** y completar nombre, instrucciones, músculo, material genérico o equipo del estudio, tipo de registro, variaciones y etiquetas.
4. Elegir **Borrador** mientras se prepara. Añadir foto o clip propio y guardar. Puede consultarse texto mientras el medio se procesa.
5. Revisar la ficha, el equipo, la imagen/clip y los controles del reproductor. Cambiar a **Publicado** para poder compartirla.
6. Publicar no la entrega automáticamente a todos los alumnos. Abrir la guía, elegir un alumno activo y pulsar **Compartir guía**. **Actualizar alumnos** refresca las incorporaciones recientes; **Cargar más alumnos** pagina la lista.
7. Para retirar acceso, usar el botón correspondiente en la lista de alumnos compartidos. Archivar o volver a borrador también impide su consulta al alumno.

Una guía de T03 es una instrucción individual. Programas, semanas, series, asignaciones de rutinas y registro de entrenamientos corresponden a T04/T05.

## 4. Comprobar como alumno

1. Crear/invitar una ficha desde **Alumnos** siguiendo T02, aceptar la invitación y acceder con esa cuenta en otro navegador o sesión privada.
2. Entrar en **Mis guías**, ruta `/biblioteca`. Se muestran el catálogo base y las guías publicadas que el coach compartió expresamente.
3. Abrir la guía: instrucciones, material y medio. El vídeo tiene controles nativos, reproducción integrada y póster; no se inicia automáticamente.
4. Si falla el vídeo, leer las instrucciones que permanecen visibles y consultar al coach. El sistema intenta una descarga autenticada alternativa antes de mostrar este estado.
5. Retirar el permiso desde la cuenta del coach y volver a consultar: las nuevas peticiones de guía/medio deben rechazarse. La aplicación no puede borrar bytes que ya se descargaron al dispositivo.

**Límite observado:** el WebKit de Playwright en Windows omite la cookie al pedir el vídeo privado y rechaza su alternativa Blob. La descarga autenticada por JavaScript sí devuelve 200 y la guía conserva el texto. Chromium PC/móvil reproduce el medio privado en la prueba. Esto no confirma reproducción en Safari/iPhone real: queda como puerta explícita de aceptación antes del piloto.

## 5. Límites y estados

| Recurso | Límite inicial |
|---|---|
| Imagen de entrada | 5 MiB, PNG/JPEG/WebP/GIF, 12 MP; GIF queda estático |
| Vídeo de entrada | 20 MiB, MP4/MOV/WebM, 1–60 s, 8 MP, lado ≤4096 px |
| Imagen entregada | WebP, lado ≤1600 px, ≤2 MiB |
| Clip entregado | MP4 H.264/AAC, ≤1280×720, 30 fps, ≤24 MiB; póster ≤512 KiB |
| Basic / trial Basic | 512 MiB y 30 minutos de vídeo |
| Pro | 2 GiB y 120 minutos de vídeo |
| Cola por estudio | Cuatro cargas pendientes; una conversión simultánea |
| Capacidad inicial del proceso | Dos conversiones simultáneas de estudios distintos |

El cupo incluye originales, derivados, pósteres, reservas y versiones de logos conservadas. Se reserva espacio antes de recibir el archivo y 60 segundos por vídeo hasta conocer su duración real. El navegador permite seleccionar formatos admitidos, pero el worker comprueba los bytes y metadatos reales.

`reserved → uploading → pending → processing → ready` es el recorrido normal. Las ramas de error terminan en `failed`, `cancelled` o `deleted`. Consultar siempre el estado del servidor después de un corte de red; repetir una reserva con el mismo `requestId` y los mismos parámetros no duplica el medio.

## 6. Resolver incidencias

| Síntoma | Acción |
|---|---|
| En cola y procesador sin conexión | Restablecer worker/DB/FFmpeg; no volver a subir repetidamente |
| Cuatro cargas pendientes | Esperar o cancelar cargas propias sin uso |
| Sin espacio/minutos | Desvincular medios innecesarios, eliminarlos y esperar limpieza; revisar plan |
| Formato/corrupción/duración | Exportar un archivo válido dentro de los límites y preparar otra carga |
| Timeout o fallo transitorio | Revisar recursos y reintentar desde Medios cuando sea posible |
| Edición desactualizada | Abrir de nuevo la ficha; no sobreescribir cambios de otra sesión |
| Medio asociado | Editar ejercicios/equipos para retirar la asociación antes de eliminar |
| Alumno no ve la guía | Revisar estudio, ficha activa, publicación y permiso explícito |
| 401/403/404 del vídeo | Revisar sesión/permisos; no volver público el almacenamiento |

Hasta tres intentos automáticos por trabajo y tres versiones por reintentos manuales. Una cancelación o cambio de versión invalida resultados atrasados. Los subprocesos tienen tiempos límite y se interrumpen al perder el lease.

## 7. Limpieza y recuperación

1. El worker ejecuta mantenimiento cada minuto. Como tarea manual: `npm run media:maintenance`, con credenciales del worker.
2. Reservas caducan a los 30 minutos. Archivos de medios cancelados/eliminados se retiran tras un minuto; logos sin referencia tras siete días.
3. Huérfanos con nombres opacos conocidos se retiran tras 24 horas; temporales conocidos de conversión tras una hora. No se siguen enlaces simbólicos. Un fallo de borrado se reintenta en la pasada posterior de huérfanos: el uso físico del disco puede tardar en bajar.
4. El mantenimiento toma un bloqueo coordinado con el backup. La copia usa un snapshot PostgreSQL, copia archivos finalizados, contrasta referencias y cifra el conjunto; si falta un archivo requerido, falla y no acredita un backup válido.
5. Usar [operación](operacion.md) para restaurar siempre en una base y carpeta nuevas. El ensayo comprueba conteos, hashes y presencia de todos los archivos referenciados. Las carpetas temporales nuevas de backup/restauración se eliminan al terminar o fallar mediante rutas generadas y verificadas.
6. Antes del piloto configurar alertas de disco, cola y worker; backup externo con restauración probada; TLS y pruebas físicas. Los límites de CPU/RAM/tmpfs de Compose están configurados, pero no acreditan ejecución del contenedor en este equipo.

## 8. Repetir QA y demostración

1. `npm run lint`, `npm run build`, `npm test`, `npm run test:db` y `npm run test:e2e`.
2. Integración crea bases temporales por suite; las elimina al cerrar conexiones. Los ficheros de prueba quedan bajo `.local` ignorado por Git. No apuntar pruebas a datos reales.
3. Ejecutar `node --import tsx scripts/capture-t03.mjs` con Node 24 y servicios locales activos para regenerar las seis capturas. Solo modifica el estudio sembrado ficticio y crea materiales técnicos originales de demostración; no es un vídeo de ejecución física de un ejercicio.
4. Registrar dispositivo, SO, navegador, versión, ancho, teclado, orientación, carga/reproducción y resultado de revocación en el acta para iPhone y Android físicos.
