# T10 — Uso y operación de chat, hábitos y check-ins

**Versión:** 0.10.0. **Migración:** 019; siguiente 020. [Decisiones](../decisiones/010-chat-y-seguimiento-privados.md), [API](api-t10.md), [evidencia](../evidencias/t10.md).

## 1. Preparar el estudio

1. Arrancar PostgreSQL local y aplicar migraciones con el procedimiento de [desarrollo](desarrollo.md). No modificar migraciones aplicadas.
2. Iniciar `./scripts/forma.ps1 run dev`: web, API, medios, documentos y programador de seguimiento. El correo conserva su proceso independiente. Para una revisión solo de chat bastan API/web; medios se necesita al adjuntar y el programador para avisos con la pantalla cerrada.
3. Comprobar usuario verificado, estudio activo/trial, alumno activo y vínculo del profesional con su ficha. Crear un alumno con el coach establece su vínculo; otros profesionales deben estar vinculados en la administración correspondiente.
4. Abrir **Más opciones → Chat y seguimiento** (`/seguimiento`). En PC está también en la navegación lateral.
5. Los contactos son vínculos vigentes. Un alumno puede tener varias conversaciones privadas con profesionales distintos; el owner solo accede a las suyas.

## 2. Conversar desde móvil o PC

1. En **Iniciar conversación**, elegir el alumno o profesional. Si ya existía la pareja se abre la conversación existente.
2. Escribir el mensaje de hasta 4.000 caracteres. No se interpreta HTML.
3. Enviar. «Guardado» acredita persistencia. Un fallo de conexión conserva el borrador para reintentar la misma intención sin duplicar el mensaje.
4. Al consultar los mensajes se actualiza la marca de lectura de la conversación. «Visto» es esa marca y no implica respuesta inmediata.
5. **Cargar anteriores** recorre páginas de 40 mensajes; **Volver a mensajes recientes** vuelve al extremo actual. Una página a la vez reduce memoria y permite recorrer el historial retenido.
6. El autor puede **Retirar** durante 15 minutos. Se conserva la posición de la conversación, se elimina el contenido y sus adjuntos dejan de descargarse. No es una edición del texto ya enviado.
7. Al salir de un borrador o cambiar de estudio se pide descartar cambios. No se guarda una copia de mensajes o formularios en almacenamiento del navegador.

Móvil muestra lista o conversación con Volver. PC ancho presenta lista y detalle a la vez. No hay un sexto destino en la barra inferior ni un footer fijo adicional.

## 3. Adjuntar archivos y recursos

1. Abrir **Adjuntar archivo o recurso**. Seleccionar un archivo del dispositivo: imagen, audio o PDF hasta 5 MiB; vídeo hasta 20 MiB. Audio/vídeo no pueden superar 60 segundos.
2. Esperar a que termine la carga y el procesamiento. Se permite **Consultar estado** después de la espera breve automática. Si falla, eliminar la carga y seleccionar de nuevo; el archivo fallido no se envía como listo.
3. Revisar el nombre en el compositor. Se admiten hasta tres adjuntos por mensaje. **Quitar** revoca su descarga.
4. El profesional puede elegir una versión de un recurso T08 ya compartido con ese alumno y creado por él. No se duplican sus bytes ni se concede acceso al compartir el mensaje.
5. Enviar. Otro profesional, otro alumno o alguien con un UUID aislado no obtiene permiso para descargarlo.
6. Si se retira el vínculo o acceso al recurso original, se revalida al descargar; una referencia no mantiene acceso revocado.

Audio usa el selector nativo de archivos; T10 no añade grabación del micrófono. Imagen → WebP, vídeo → MP4 compatible, audio → MP4/AAC. Vídeo usa `playsinline`; ningún medio tiene autoplay. Archivos privados no se guardan offline ni se sirven desde una URL pública permanente. La compatibilidad real de HEIC, formatos del dispositivo y controles nativos mantiene puerta física; no asumir que cualquier extensión se acepta.

## 4. Avisos y privacidad

1. Abrir **Avisos internos** para ver los 30 recientes, marcar como leídos o desactivar categorías de mensajes, check-ins y revisiones.
2. Las preferencias se guardan por usuario y estudio. **Privacidad → Silenciar** afecta solo a esa conversación. El contador de mensajes sigue existiendo.
3. El alumno puede autorizar **seguimiento** para ese profesional desde Privacidad. Es independiente de fotos corporales/diario de alimentación.
4. Retirar el permiso: el profesional deja de leer registros y respuestas; el alumno conserva su consulta propia durante el plazo técnico. El chat sigue separado.
5. No se solicita permiso Push ni se envían SMS/correos externos desde estos eventos. Push permanece opcional y pendiente de teléfonos reales.

## 5. Asignar y registrar hábitos

**Profesional:**

1. Abrir **Hábitos y check-ins → Asignar un hábito**.
2. Elegir nombre y tipo: realizado/no realizado, agua en litros, sueño en horas o energía 1–5.
3. Para tipos numéricos dejar la referencia vacía si no procede. No se propone una cantidad automáticamente.
4. Elegir días de semana, fecha inicial/final e instrucciones opcionales; guardar. Máximo 20 asignaciones activas y hasta 366 días por periodo.
5. Consultar días registrados en los últimos 14 días, y referencia alcanzada solo cuando se configuró. Cancelar detiene registros nuevos conservando el historial permitido.

**Alumno:**

1. Autorizar seguimiento en Privacidad si quiere registrar.
2. Elegir fecha dentro del periodo asignado, desde hoy hasta 14 días anteriores.
3. Registrar valor, dejar **Sin dato**, o añadir una nota opcional. Cero y vacío tienen significados distintos.
4. Guardar. Si hubo cambios en otro dispositivo, recargar el registro guardado antes de volver a editar.

Un dato faltante no equivale a cero ni a un fallo personal. No se calculan diagnósticos ni recomendaciones automáticas.

## 6. Crear, programar, responder y revisar check-ins

**Profesional:**

1. Abrir **Plantillas y programación de check-ins → Nueva plantilla**.
2. Añadir nombre, descripción y de 1 a 12 preguntas. Cada pregunta tiene tipo, obligatoriedad y, si procede, unidad/rango/opciones.
3. Una escala requiere mínimo y máximo enteros. Un booleano distingue Sin respuesta / Sí / No. El adjunto usa el mismo control privado de carga.
4. **Guardar borrador**. Luego **Publicar versión guardada**. Una versión publicada no cambia al editar el borrador.
5. Programar para este alumno: semanal con día de semana o mensual con día 1–31, ventana de 1–14 días y periodo máximo 366 días. En meses más cortos se usa el último día disponible.
6. Las tareas se materializan para los últimos 14 días y próximos 31. El programador revisa hasta 100 programaciones por minuto; abrir seguimiento también actualiza el periodo. Los avisos disponibles se deduplican.
7. Consultar respuestas con el permiso vigente; añadir revisión compartida. Guardarla bloquea las ediciones posteriores del alumno. Cancelar la programación detiene nuevas respuestas pendientes.

**Alumno:**

1. Abrir el check-in disponible y revisar las fechas de apertura/cierre.
2. Responder preguntas y, si procede, adjuntar archivo listo. Se respetan `false`, `0` y vacío sin inventar valores.
3. Enviar; puede editar mientras la ventana esté abierta y antes de revisión.
4. Si no quiere responder, usar **Prefiero omitir este check-in**. Omitir no exige autorizar el seguimiento ni completar preguntas obligatorias.
5. Tras revisión, consultar el comentario. Un borrador no enviado solo existe en la pantalla y necesita red para guardarse.

## 7. Operación y recursos

| Proceso | Función | Arranque individual |
|---|---|---|
| API/web | Conversación, formularios, permisos, avisos y WebSocket | `dev:api`, `dev:web` |
| Medios | Imagen/vídeo/audio y análisis de PDF adjunto | `dev:media` |
| Seguimiento | Tareas y avisos de programación | `dev:followup` |
| Documentos T08 | Generación/escaneo de recursos PDF originales | `dev:documents` |

Usar `./scripts/forma.ps1 run NOMBRE` en Windows. `MEDIA_WORKER_CONCURRENCY=1` por defecto limita conversiones; puede ser 1 o 2. La cola mantiene una conversión por organización. El programador no convierte medios y no necesita Chromium.

PDF propio: configurar `CLAMAV_HOST` y `CLAMAV_PORT` tanto en API como en medios. Sin host, se rechaza al reservar; scanner inaccesible o resultado no limpio impide publicar el archivo. El despliegue Compose incluye las variables y un servicio `followup` de recursos limitados; no se ejecutó Docker ni se instaló ClamAV en T10.

`ops:check` incluye heartbeat de seguimiento (máximo tres minutos), medios, documentos y resto de puertas previas. Puede salir en error al parar esos procesos o por backup antiguo; no falsear su estado para aprobar una revisión local.

## 8. Retención, backup y soporte

1. Contenido de mensajes, registros y respuestas: 180 días; avisos: 90. Adjuntos sin enviar: 24 horas. Son plazos técnicos propuestos para revisar antes del piloto.
2. La descarga revocada se bloquea inmediatamente. El mantenimiento de medios limpia posteriormente bytes eliminados/cancelados con el umbral existente de T03, conservando el inventario durante backups.
3. El backup incorpora 13 conteos de seguimiento: 49 indicadores previstos con todo el esquema hasta 019. No se corrió backup/restauración en esta tanda; ensayar la recuperación T08–T10 en destino nuevo antes del piloto.
4. Si el mensaje parece duplicado, revisar UUID de cliente, secuencia y recibo; no borrar filas para corregirlo. No registrar el texto en logs.
5. Si un envío queda incierto, volver a intentar la misma intención; un cambio de contenido usa otro UUID. Si el formulario indica conflicto, recargar su estado antes de editar.
6. Si los avisos tardan, comprobar el programador y el proxy WebSocket. Si no hay socket, HTTP consulta mientras la página está visible. No se garantiza aviso en segundo plano.
7. Adjuntos no listos: revisar error del job y scanner/motor; eliminar la carga fallida y volver a elegirla. Los jobs usan leases y no deben completarse manualmente con contenido sin verificar.

## 9. Comprobación mínima y siguiente tanda

Consultar el [acta T10](../evidencias/t10.md) antes de repetir pruebas. Hay once casos de integración y tres unitarias nuevos; las correcciones se verificaron por filtro. La revisión Chromium quedó como observación parcial con acciones persistidas confirmadas; sus continuaciones y límites constan en el acta. No reemplaza dos teléfonos físicos ni la matriz pendiente de T07.

T11 inicia desde 0.10.0/migración 020 y reutiliza avisos internos, preferencias, deduplicación y el patrón del programador sin obtener acceso implícito a chats. La [firma NAVZ](../pendientes/firma-navz.md) sigue pendiente de presentación para más adelante.
