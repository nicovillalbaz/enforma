# ADR 008 — Recursos privados y PDF

**21-10-2026 · T08 implementada en local, v0.8.0.** Vue/Fastify/PostgreSQL y almacenamiento T03 se mantienen. Un worker documental secuencial reutiliza Chromium/Playwright ya presentes; el navegador se abre únicamente para generar un PDF y se cierra al acabar. No se ejecutan suites ni cargas periódicas.

## Acceso y contenido

- Colecciones planas con descripción, alumno o versión publicada asociados; esas relaciones no conceden lectura. Compartición explícita por alumno administrable. Compartir una colección aplica a sus recursos actuales; los futuros requieren otra acción. Grupos formales quedan en T13.
- Recursos del creador o propietario del estudio, con versiones y revisión para evitar sobrescrituras. Alumnos activos solo leen recursos compartidos. Un informe personal no puede compartirse con otro alumno. Se comprueban actor/tenant/relaciones en SQL y en cada entrega.
- Fotos/vídeos reutilizan medios normalizados T03, sin copiar bytes. Los PDF subidos (hasta 10 MiB) permanecen privados hasta un resultado limpio de ClamAV INSTREAM. No se admiten Office, ZIP, HTML ni ejecutables. La falta de antivirus no se sustituye por una comprobación de extensión ni por un resultado ficticio.
- PDF subido: descarga como adjunto. PDF generado desde HTML escapado de plantillas propias: apertura o descarga. No se renderiza HTML aportado por usuarios ni se realizan peticiones de red durante la generación.
- Enlace temporal de cinco minutos vinculado a usuario, recurso y versión, con cookie HttpOnly restringida a su ruta. No hay tokens en URL, enlaces públicos ni autorización derivada de conocer un UUID. Revocación y estado se revalidan en cada solicitud. Una copia ya descargada no puede retirarse del dispositivo.

## Generación y operación

- Rutina desde asignación publicada, historial confirmado e informe de entrenamiento sin fotos, medidas corporales ni notas privadas. Snapshot de datos, versión de plantilla, nombre/logo/color y hora Paraguay. Cambiar marca o entrenamientos no altera el PDF existente.
- HTML/CSS A4 con tipografía local, cortes de página, cabecera/pie y caracteres españoles/guaraníes. El portal ofrece lectura en tarjetas; un PDF A4 requiere los controles de ampliación del visor nativo y no sustituye la pantalla responsive.
- Una generación simultánea, cuatro pendientes por estudio, máximo de 10 MiB por PDF y presupuesto inicial Básico 10 / Pro 50 generaciones por mes. Son límites técnicos versionados por esta entrega, sin nuevos recargos. Reintentar una versión no crea otro cargo ni otro snapshot.
- Espacio compartido con medios/logos/fotos, inventario de respaldo y bloqueo de mantenimiento. Archivar retira acceso inmediatamente; conservación de bytes 30 días antes de depuración. No equivale a borrado integral de datos personales.
- Pruebas dirigidas: un archivo de integración para permisos/cola/revocación/cuota y una muestra PDF revisada visualmente; una sola sesión Chromium para UI móvil/PC. No repetir la matriz histórica ni restauraciones.

Fuentes técnicas: [PDF con Playwright](https://playwright.dev/docs/api/class-page#page-pdf), [aislamiento de contexto](https://playwright.dev/docs/api/class-browsercontext), [protocolo ClamAV](https://docs.clamav.net/manual/Usage/ClamdProtocol.html). Configuración real de antivirus/contenedor y teléfonos conservan aceptación externa; no se declara piloto real por esta entrega.

Tras publicar una plantilla, conservar su implementación. Una versión nueva requiere otro archivo/identificador y despacho explícito; no rediseñar una plantilla publicada para reintentos anteriores. [Evidencia y alcance](../evidencias/t08.md).



## Actualización de alcance T13

La decisión vigente limita el producto a coaches independientes. Cualquier referencia previa a equipos, sedes, recepción o grupos formales como entrega T13 queda sustituida por [consolidación individual](../tandas/13-gimnasios.md); [multicoach se aplaza](../pendientes/gimnasios-futuro.md) fuera de las tandas actuales.

