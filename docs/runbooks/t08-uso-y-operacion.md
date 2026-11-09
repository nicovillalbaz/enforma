# T08 — Recursos, colecciones y PDF

**0.8.0 · 21-10-2026.** [Decisiones](../decisiones/008-recursos-y-pdf.md), [API](api-t08.md), [evidencia y límites](../evidencias/t08.md).

## 1. Preparar el entorno

1. Mantener Node 24 y las variables privadas de [desarrollo](desarrollo.md). No publicar `.env` ni ejecutar fixtures sobre el piloto.
2. Aplicar migraciones 001–017. La siguiente empieza en 018; no modificar 017 después de aplicarla.
3. `scripts/forma.ps1 run dev` incluye API, web, medios y worker documental. Para un arranque limitado, iniciar web/API y usar `scripts/forma.ps1 run dev:documents` solo cuando se necesite procesar documentos.
4. El worker procesa **un documento a la vez**. No mantiene Chromium abierto ni lo arranca al consultar heartbeat; abre navegador únicamente al generar un PDF. El estado se actualiza desde el botón de la interfaz, sin sondeo continuo.
5. Local usa el Chromium ya instalado con Playwright. Producción dispone del target Docker `documents`, con Chromium y tipografías, y `PDF_CHROMIUM_PATH=/usr/bin/chromium`. El contenedor no se construyó ni desplegó en esta tanda.
6. PDF subido requiere `CLAMAV_HOST` y `CLAMAV_PORT` de un servicio INSTREAM controlado en red privada. Vacío bloquea la subida con explicación; no impide generar PDF desde plantillas propias. No instalar ni iniciar un antivirus pesado automáticamente en este equipo limitado.

## 2. Crear y organizar material

1. Abrir **Más opciones → Recursos y PDF** en móvil o el enlace lateral en PC.
2. Abrir Organizar colecciones. Nombre y descripción; opcionalmente asociar una ficha o versión publicada. Esa asociación organiza el material y **no concede lectura**.
3. Nuevo recurso → nombre, descripción y colección → Crear recurso. Después añadir contenido y compartir: son acciones separadas.
4. Para foto/vídeo, prepararlo en Biblioteca → Medios mediante T03 y elegir un medio disponible en Recursos. Se reutilizan sus bytes normalizados; no se vuelven a cargar ni se incluyen medios financieros o fotos corporales.
5. Para PDF propio, elegir Subir PDF y archivo de hasta 10 MiB. El archivo permanece en cuarentena hasta respuesta limpia del escáner. No se admiten Word, Excel, ZIP, HTML o ejecutables. Una firma/extensión PDF no sustituye al análisis.
6. Actualizar consulta el estado. Rechazado por seguridad no ofrece descarga ni un reintento que eluda el escáner. Si falta el servicio, resolver su configuración antes de repetir la misma versión.
7. Nombre, descripción y ubicación permite renombrar o mover. Guardado con revisión: ante conflicto actualizar y reconciliar los cambios; no sobrescribir silenciosamente.
8. Editar una colección desde su lista. Hasta 200 colecciones, 2.000 recursos y 50 versiones por recurso en esta entrega. Los grupos formales y cursos completos permanecen fuera de T08.

## 3. Generar documentos

1. Abrir un recurso propio/administrable → Añadir contenido → PDF de rutina, historial o informe.
2. Elegir un alumno que se pueda administrar. Para rutina, seleccionar una asignación activa publicada. Para historial/informe, elegir periodo de hasta 90 días terminado hoy o antes.
3. Solicitar PDF crea versión y trabajo durable. Se conserva la versión anterior disponible durante la preparación de otra. Cerrar la pantalla no cancela el trabajo.
4. Rutina conserva instrucciones y prescripciones; historial usa sesiones finalizadas y series registradas; informe usa métricas oficiales. No incluyen fotos corporales, medidas ni notas privadas de sesión/serie. Carga cero y carga sin indicar son distintas.
5. Nombre/logo/color, alumno, fechas, datos y plantilla quedan capturados al solicitar. Cambiar marca o entrenamientos después no modifica el archivo anterior. Cada nueva solicitud crea otra versión; un reintento usa el mismo snapshot.
6. Presupuesto inicial: Básico 10 y Pro 50 solicitudes de generación por mes en Paraguay. Los fallos siguen siendo solicitudes y se reintentan en su versión; no generar versiones nuevas repetidas para intentar arreglar una caída del worker. No hay recargo implícito.
7. Hasta cuatro preparaciones pendientes por estudio, 10 MiB de salida por PDF y espacio conjunto con fotos/logos/medios. Historial admite hasta 100 sesiones y 3.000 series por documento; reducir el periodo si supera el límite.
8. Cancelar preparación libera la reserva de salida sin eliminar la versión ya disponible. Los archivos recibidos conservan su retención. Una reserva sin subir vence a las 24 horas cuando se ejecuta mantenimiento.
9. Un PDF A4 usa los controles del visor para ampliar; el portal móvil mantiene reflujo y fuentes legibles. No desactivar zoom ni convertir el visor en sustituto de las pantallas de entrenamiento.

## 4. Compartir y entregar

1. Compartir con un alumno → buscar nombre si no está entre los primeros 100 → seleccionar → Conceder acceso. Un PDF personal solo permite su alumno.
2. Para una colección, seleccionar su filtro y Compartir colección. La operación aplica de forma atómica a los recursos **actuales**; uno personal de otro alumno impide conceder el lote. Los nuevos recursos no heredan esa concesión.
3. El alumno abre Recursos y PDF, elige un recurso y prepara acceso privado. El botón devuelve un vínculo de cinco minutos y una cookie HttpOnly restringida a esa versión; no hay token en URL ni enlace público.
4. Abrir archivo utiliza el visor nativo. Los PDF subidos se descargan como adjuntos; los generados pueden abrirse o descargarse. Preparar otro acceso si vence.
5. Revocar acceso bloquea nuevas solicitudes y rangos, aunque se conserve la URL anterior. Usuario pausado, estudio suspendido o sesión cerrada también pierden entrega. No se pueden retirar copias ya descargadas.
6. Archivo/preview/PDF requieren conexión. No se guardan en CacheStorage o IndexedDB. Las descargas voluntarias del usuario son copias fuera del control de la caché de la aplicación.
7. Archivar y retirar acceso afecta a todos los alumnos. No es borrado integral ni eliminación de auditoría; no hay restauración de archivo desde el portal en esta versión.

## 5. Operación y recuperación

1. Revisar heartbeat del worker documental (45 s), cola `document.process`, espacio conjunto y errores. No arrancar el worker de correo ni consumir su cola para probar PDF.
2. Worker parado: las solicitudes quedan en cola. Reiniciarlo cuando corresponda, consultar error y reintentar versiones fallidas desde el portal. Lease de dos minutos, renovación cada 15 s y máximo de seis intentos totales por versión mediante reintentos explícitos.
3. `SCANNER_UNAVAILABLE` / `SCANNER_TIMEOUT`: comprobar servicio privado y límites INSTREAM. `DOCUMENT_REJECTED`: conservar cuarentena; no cambiar el estado a ready manualmente. `DOCUMENT_TOO_LARGE`: crear una solicitud más pequeña. `DOCUMENT_STALE`: revisar archivo/autor/permisos.
4. El mantenimiento de T03 incluye documentos: libera reservas vencidas, concilia jobs fallidos y retira bytes de recursos archivados o versiones fallidas/rechazadas tras 30 días. Usa el bloqueo exclusivo compartido con backup; no borrar archivos UUID a mano.
5. Backup incorpora archivos PDF, logo congelado, medios reutilizados y cuatro conteos nuevos: colecciones, recursos, versiones y concesiones. Total actual esperado: **27 indicadores** (24 conteos y 3 sumas financieras).
6. No se ejecutó otra restauración en T08 por presupuesto de recursos. El ensayo T07 de 239 archivos/23 indicadores acredita su corte anterior, no los documentos nuevos. Registrar un ensayo T08 aislado antes del piloto, incluyendo PDF autorizado/denegado, hashes y 27 indicadores.
7. Reconciliar revocaciones/archivados posteriores al snapshot antes de reabrir una restauración. Las copias de seguridad y los PDF descargados requieren política integral de datos; P03 sigue abierta.

## 6. Verificación de consumo reducido

Usar casos dirigidos y un worker. La evidencia T08 reutiliza siete casos aprobados y verifica dos casos concretos posteriores; no afirma una pasada nueva de toda la suite. La revisión de UI usó un Chromium, cuatro anchos y una generación en 13 segundos. Se regeneró únicamente la muestra al corregir un corte de tabla; no se repitió la UI. Detalles y comandos en [acta](../evidencias/t08.md).
