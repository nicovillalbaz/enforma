# Avances del proyecto

**09-11-2026 · Investigación en GitHub:** comparados repositorios e issues de ScopeStrength, Gyme, OpenPersonalTraining, wger, Workout.cool, OpenExerciseDB, Forge y Open Food Facts con el código actual. Se documentaron mejoras propuestas para clasificación de ejercicios, registro móvil, procedencia nutricional y casos dirigidos de seguridad/consistencia, separando lo que Forma ya implementa. [Investigación y orden de trabajo](investigacion-github-2026-11-09.md). No se incorporó código ni contenido externo.

**09-11-2026 · Barrido visual y preparación de GitHub:** inventariadas 36 vistas Vue y recorridas 18 rutas públicas o ficticias a 320/390 px. Se compactaron navegación, inicio real, alimentación, entrenamiento, demo de rutinas y ejercicios, y pantalla del alumno. Las rutas sin organización muestran un estado explícito en lugar de quedar vacías. Siguen pendientes el recorrido autenticado completo de coach, alumno y admin, el modo oscuro y la aceptación en teléfonos físicos. [Acta y límites](evidencias/barrido-visual-2026-11-09.md). No se ejecutó el build.

**30-10-2026 · Estado honesto del barrido visual:** tercera pasada puntual en apertura PWA, verificación, lista secundaria de progreso y documentos del alumno. El inventario cubre 36 vistas, pero **la aceptación visual sigue abierta**: falta recorrer coach, alumno y admin a 320/390 px con datos reales, modo oscuro, teclado y estados de error; también decidir rutas antiguas y revisar textos legales del cobro manual. Prettier, tipos Vue y ESLint dirigido aprobados; sin build ni navegador. [Matriz y límites](evidencias/revision-superficies-2026-10-30.md).

**30-10-2026 · Segunda pasada visual:** simplificadas las pantallas activas de marca, rutinas, inicio, dieta, antropometría, biblioteca, progreso, instalación y exportación. Se retiraron previsualizaciones ficticias, accesos duplicados, estados vacíos decorativos y textos sin función; en móvil, el inicio del alumno y las métricas usan filas y tamaños más contenidos. Prettier, tipos Vue y ESLint dirigido aprobados. Sin build ni servidor. La aceptación visual con datos reales en 320/390 px y teléfonos físicos sigue abierta. [Acta](evidencias/revision-superficies-2026-10-30.md).

**30-10-2026 · Superficies y texto:** inventario estático de las 36 vistas Vue y revisión de estilos/componentes de coach, alumno, admin y acceso. El área de trabajo y registro pasan a superficie continua; tarjetas repetidas se sustituyen visualmente por secciones y filas. Inicio, demo de alumno, información y registro pierden copy decorativo; nutrición deja de tener guardado flotante. Tipos, lint y formato dirigidos aprobados, sin build ni servidores. Falta aceptación visual con app ejecutada en 320/390 px y móvil físico; la página legal requiere actualización del modelo de cobro manual. [Acta](evidencias/revision-superficies-2026-10-30.md).

**29-10-2026 · Barrido de alumno y admin:** contrastadas rutas, guardas, pantallas principales, permisos SQL y pruebas de integración existentes de ambos actores. Corregida la vuelta de «Mis documentos» al destino anterior; el panel admin dejó de enlazar la pantalla heredada de facturas, `/admin/cuenta` redirige al control mensual, la demo no abre el admin y una recarga fallida no conserva filas de otro mes. Tipos, ESLint y Prettier de los archivos tocados aprobados, sin build. Sigue pendiente el recorrido funcional completo del admin y la aceptación en móviles reales. [Acta específica](evidencias/auditoria-vistas-alumno-admin-2026-10-29.md).

**28-10-2026 · Auditoría extendida:** inventariadas 200 operaciones API registradas, 122 escrituras y sus parámetros/cuerpos; revisados controles de sesión, CSRF, RLS, archivos, PDF, PWA y entrega web. Corregidos los enlaces de rutina/alimentación de alumnos inactivos que llevaban a permisos denegados, la URL antigua de entrenamiento del alumno real, el límite discordante de menús mediante la migración 037 y la limpieza de borradores corporales al cambiar de sesión. Verificación dirigida: 8/8 unitarias, tipos del cliente y del servidor, ESLint y Prettier aprobados; auditoría de dependencias de producción sin avisos; sin build ni servicios levantados. Quedan priorizados los esquemas de respuesta y la aplicación real de la migración 037 y las pruebas de staging. [Informe extendido](evidencias/auditoria-extendida-2026-10-28.md).

**28-10-2026 · Barrido general de rutas y estados:** revisados navegación, sesión, actores, cliente API, exportación, nutrición y despliegue mediante análisis estático de 50 rutas web y 36 migraciones. Corregida la reutilización de una vista con el token de otra invitación o el ID de otro alumno al cambiar de URL dentro de la misma pestaña; la exportación ya aparece para el personal al que la API permite gestionar la ficha. Eliminados botones de demostración sin acción real y textos caducados sobre futuras tandas. Tipos y ESLint globales, más verificación dirigida de los archivos modificados, aprobados; sin build, base, navegador ni despliegue nuevos. [Acta, matriz y límites](evidencias/barrido-general-2026-10-28.md). Sigue pendiente la prueba dirigida final con datos ficticios y dispositivos físicos.

**26-10-2026 · Limpieza de textos en alimentación:** retirados de las tarjetas los números internos de revisión, el aviso repetido de alimentos sin valores y las frases de relleno; ahora muestran nombre, acción y datos nutricionales solo cuando existen. Reducidos títulos duplicados, espacio de las tarjetas y metadatos técnicos visibles en editores, rutinas, seguimiento y servicios. Las revisiones siguen guardándose para control de cambios; las versiones publicadas mantienen un nombre comprensible. Tipos aprobados; no se levantó la app ni se repitió la suite completa. Pendiente aceptación visual en móvil real.

**26-10-2026 · Guía de prueba gratuita en Oracle Cloud:** documentados alta Always Free, VM Ampere A1, red, DNS gratuito, Docker arm64, Compose de producción, secretos, Mailpit privado por SSH, verificación móvil y control de coste. Añadido overlay de correo local para no exponer la bandeja. Guía preparada; **no hay cuenta, VM ni despliegue creados**. [Paso a paso](runbooks/oracle-always-free-pruebas.md).

**26-10-2026 · Segunda pasada de depuración para staging:** inventariadas 199 rutas API (190 con esquema); las nueve restantes se revisaron como rutas públicas u operativas. La copia/restauración aislada ahora verifica antropometría entre 87 indicadores. Producción exige que la API conecte con el rol restringido `forma_api` y contraseña. Recorrido móvil actualizado y aprobado (2/2): coach, alumno, invitación, pausa/reactivación, marca, dos estudios y páginas públicas en cuatro anchos; repetición puntual 1/1 con el alumno también a 390 px y táctil. Siete unitarias dirigidas, tipos y ESLint de archivos tocados aprobados. Quedan despliegue HTTPS, contenedores, SMTP/backup externo y teléfonos físicos. [Acta](evidencias/auditoria-staging-2026-10-26.md).

**26-10-2026 · Auditoría previa a staging:** revisados API, contratos, 36 migraciones, rol/RLS, cliente, PWA y Compose/Caddy. Se corrigieron el diagnóstico de respuestas HTTP no JSON, la exportación privada bloqueada en migración 024 y la omisión de antropometría, el tratamiento de chunks ausentes y dos expectativas de prueba desactualizadas. Swagger UI y su dependencia estática se actualizaron tras un aviso alto; auditoría npm completa y de producción con 0 avisos. 49 unitarias y 134 casos de integración cubiertos; build/tipos, lint, formato dirigido, checksums/rol y sintaxis Compose aprobados. Docker real, HTTPS, SMTP, recuperación externa y teléfonos físicos siguen pendientes. [Acta y secuencia para staging](evidencias/auditoria-staging-2026-10-26.md).

**26-10-2026 · Alimentos comunes y recetas editables:** migración 036 en bases local y ficticia, con 80 nombres de alimentos por coach y sin datos nutricionales inventados. El editor ofrece 22 puntos de partida para platos, deja gramos en blanco y permite añadir/quitar ingredientes; catálogo buscable y paginado visualmente en móvil. Comprobación dirigida de Aurora/Brisa, aislamiento, receta rusa a 320/390 px y rechazo API de datos sin fuente; build, tipos, lint y formato aprobados. [Acta, captura y límites](evidencias/alimentos-comunes-2026-10-26.md). La demo sigue en [127.0.0.1:4180/acceso](http://127.0.0.1:4180/acceso).

**26-10-2026 · Nuevo barrido móvil:** 38 combinaciones de ruta/ancho recorridas con datos ficticios a 320/390 px, sin errores de JavaScript/API/assets ni desbordes; build, tipos, lint y formato aprobados. Se corrigió el filtro de grupos en Ejercicios y se eligieron pares de dibujos más uniformes en 14 ejercicios; las cuatro tarjetas cardio se verificaron en una captura móvil. Los tres accesos de la ficha del alumno siguen abriendo tras el último build. [Acta y límites](evidencias/barrido-movil-2026-10-26.md). Pendiente la aceptación en iPhone/Android físicos.

**26-10-2026 · Accesos de ficha y regiones de ejercicios:** corregido el 404 de módulos de rutas tras reconstruir la demo: los nuevos builds conservan los archivos JavaScript anteriores, el router intenta recuperar una navegación desactualizada y el shell busca primero la versión actual al navegar en línea. Los tres accesos de la ficha (Alimentación, Medidas básicas y progreso, Exportar PDF o Excel) abrieron en un recorrido ficticio dirigido. Migración 035 aplicada a la base de prueba, sin reiniciar cuentas ni datos: las 56 fichas base tienen zonas trabajadas y etiquetas visibles; se comprobó el catálogo y el detalle de press de banca a 390 px. Tipos y build aprobados; shell offline precarga solo la versión actual. **Las pestañas abiertas antes de este arreglo requieren una recarga completa o reabrir la app**, pues los hashes viejos ya se habían borrado. [Guía de prueba](runbooks/t14-prueba-privada.md). No se repitió la suite completa.

**26-10-2026 · Secuencias de ejercicios pulidas:** 52 series ilustradas revisadas en una galería completa, encuadre común y trazos finos reforzados. Se eligieron dos posturas distintas por serie y el ciclo pasó a 1,8 s; sin controles ni animación de palitos en el catálogo base. 53 de 56 ejercicios base tienen ilustración fiel; los otros tres muestran un estado neutro. Precarga offline reducida de 239 a 194 activos. Tipos, build y una revisión móvil de tres presses aprobados sin errores/desbordes. [Acta y galería](evidencias/secuencia-ejercicios-2026-10-26.md). La demo local sigue disponible; la aceptación en teléfonos físicos queda para la prueba del usuario.

**26-10-2026 · Ilustraciones de ejercicios renovadas:** 50 ejercicios base reciben tres SVG locales específicos de Workout Guide (Everkinetic/Bryl Lim, CC BY-SA 4.0); barra, mancuernas, banco, polea y máquina se distinguen visualmente. Detalle con tres posturas en secuencia automática, sin controles, y miniatura fija en catálogo. Los dibujos propios quedan para fichas sin coincidencia exacta. Verificación puntual: tres presses en móvil 390 px, imágenes cargadas, sin errores ni desborde; tipos y build aprobados. Demo local encendida para revisar. [Acta, galería, licencia y captura](evidencias/ilustraciones-ejercicios-2026-10-26.md). Aceptación visual y teléfonos físicos pendientes. Las notas inferiores son cortes históricos.

**26-10-2026 · Pictogramas estáticos:** retirada la animación y el control de reproducción de esquemas. El detalle de ejercicio muestra dos posturas fijas; el catálogo conserva una vista compacta. Redibujo de 13 familias y trazo uniforme en las 25, distinción de barra/mancuernas, etiquetas breves y retiro de indicaciones base vacías. Cuatro fichas ficticias verificadas a 390/1366 px sin errores ni desbordamientos; tipos, build y lint dirigido aprobados. [Acta, galería y capturas](evidencias/pictogramas-estaticos-2026-10-26.md). Aceptación visual/técnica del coach pendiente.

**26-10-2026 · Barrido de código e interfaz previo a prueba:** revisados 123 archivos del cliente y 32 combinaciones generales de ruta/ancho; corregidos desbordamiento de Rutinas a 390 px, títulos duplicados en móvil, controles pequeños, acciones sin nombre, selector de alumno sobredimensionado, panel mensual desigual y accesos del alumno. Revisión final focalizada de 12 combinaciones a 320/390/1366 px sin errores JavaScript/API, sin desbordamiento y sin objetivos visibles menores de 40 px. Build/tipos y lint dirigido aprobados; paquete final regenerado. [Acta y capturas](evidencias/ux-code-audit-2026-10-26.md). Aceptación manual e iOS/Android físicos pendientes; no hubo suite completa ni escrituras de negocio.

**26-10-2026 · T17 antropometría local:** ISAK restringido de 21 sitios, medidas libres, BIA/DXA externo, Σ4/Σ8, estimación opcional Durnin–Womersley/Siri, historial de correcciones y PDF/Excel privados. Migraciones 033–034 en ambas bases existentes; build y cuatro unitarias dirigidas aprobados. Recorrido ficticio autenticado: borrador oculto al alumno, final visible, otro coach rechazado, XLSX/PDF, corrección reintentada y 320/390/1366 px sin desbordamiento. La demo vuelve a estar encendida solo en este PC. Perfil ISAK completo, revisión de un antropometrista, adjuntos y teléfonos físicos siguen abiertos. [Plan](tandas/17-antropometria-y-densidad-visual.md) · [acta](evidencias/t17-antropometria-local.md) · [uso](runbooks/t17-antropometria.md). Los cortes inferiores conservan su fecha histórica.

**24-10-2026 · T17 primer corte y nuevo plan:** el usuario rechazó otra vez la densidad visual y las mediciones básicas y señaló 401/403. Se corrigieron la inicialización de la ruta pública, el acceso a Dieta desde invitación pendiente, textos/encabezados duplicados y el riel de filtros de Progreso. Build y un recorrido Chromium dirigido aprobados a 390/1366 px, sin suites completas. **Antropometría ISAK, estimación de grasa, DXA/BIA y auditoría global de formularios permanecen pendientes** y tienen pasos y criterios en [T17](tandas/17-antropometria-y-densidad-visual.md); [evidencia de este corte](evidencias/t17-primer-corte.md). T16 sigue sin aceptación de uso. La demo privada está activa solo en este PC.

**24-10-2026 · T16 lista para prueba manual local:** migración 032 con 56 ejercicios base, 25 esquemas originales en total y opción de crear cualquier ejercicio propio; sin medios externos. Base de trabajo y demo ficticia migradas sin reset. Build aprobada. Coach autenticado: 58 tarjetas entre base y contenido propio, detalle animado sin desborde a 320/390/1366. Alumna Luna: Hoy, Mi programa, Historial y Documentos recorridos sin desborde en ventana móvil. Demo activa solo en este PC. [Acta](evidencias/t16-catalogo-y-prueba.md) · [acceso y pasos](runbooks/t14-prueba-privada.md). Aceptación funcional del usuario y prueba física iOS/Android abiertas; los cortes inferiores son históricos.

**24-10-2026 · T16 segundo corte local:** alimentación escrita por el coach sin selección de profesional, días de entrenamiento con texto libre, altura y correcciones históricas, exportación XLSX y solicitud de PDF privados, documentos en cuenta del alumno y demo compacta. Migraciones 025–031 aplicadas también a la base ficticia; pruebas dirigidas de progreso 14/14 y alimentación 9/9; build aprobado; ancho sin desborde en capturas locales 320/390/1366 y recorrido del coach autenticado a 390 px. Demo detenida al terminar. Derechos del catálogo, flujo completo coach/alumno y aceptación iOS/Android pendientes. [Acta detallada](evidencias/t16-segundo-corte.md) · [estado de cada T16-nn](tandas/16-ficha-alumno-y-experiencia.md). Las notas de cortes anteriores debajo son históricas.

**24-10-2026 · T16 primer corte implementado localmente:** acceso/mensualidad compactos, perfil coach y alumno, menú directo sin «Más», inicio simplificado, ficha con acciones y retorno a ficha, preselección de alumno en rutinas/alimentación. `vue-tsc` aprobó las fuentes; no hubo build, DB, navegador ni teléfonos. [Acta](evidencias/t16-primer-corte.md), [plan/pendientes](tandas/16-ficha-alumno-y-experiencia.md). Las notas de T16 «solo plan» siguientes son el corte documental previo.

**24-10-2026 · Nuevo avance documental:** recibidas dos capturas y rechazo explícito del diseño T15. Se creó la [propuesta de T16](tandas/16-ficha-alumno-y-experiencia.md) y la [decisión 018](decisiones/018-ficha-y-catalogo.md): ficha del alumno, retorno al padre, navegación directa, perfil coach, nutrición del propio coach, catálogo visual con derechos auditados y exportación por rango. **Estado T16: planificado; cero código, migraciones o pruebas nuevas.** La revisión local T15 fue técnica, no aceptación del usuario. Los cortes inferiores son históricos.

**Actualización vigente 24-10-2026:** demo reactivada por petición del usuario, build/tipos aprobados, revisión breve móvil/PC y correcciones puntuales de encabezado/retorno verificadas. Sin nueva migración o reset. [Acta y capturas](evidencias/t15-revision-local.md). Aceptación manual/física pendiente; las referencias a apagado del corte anterior son históricas.

**Corte:** 23-10-2026. **Estado global:** T15 de rediseño en fuentes v0.15.0, 001–024 aplicadas; próxima 025. App apagada por petición del usuario. Revisión visual/navegación y build de los últimos ajustes pendientes. [Plan](tandas/15-redisenio-mobile-first.md), [acta](evidencias/t15-redisenio.md). Admin define precio/cupo/acceso del coach; coach marca pago mensual y acceso de alumnos. Altas pendientes, sin prueba automática; suspensión bloquea estudio/alumnos. Reglas del usuario resueltas, importes/cupos se eligen en panel. Aceptación física/externa, derechos de datos, operación/recuperación y piloto real abiertos. Priorizar verificaciones dirigidas y reutilizar evidencia; límites físicos/vídeo/CacheStorage conservados.

| Bloque | Estado | Evidencia / siguiente paso |
|---|---|---|
| Conversación y materiales iniciales | Revisado | Chat contrastado con texto adjunto; plan y SQL originales inventariados |
| Visión, decisiones y arquitectura | Preparación local independiente | Guías y ADR T01–T14; alcance independiente aprobado; piloto real pendiente |
| Dirección visual móvil/PC | Rediseño T15 en curso | Se sustituye el diseño anterior tras revisión del usuario; nuevas capturas/reflujo pendientes. [Acta T15](evidencias/t15-redisenio.md); T13 conserva evidencia histórica |
| Entrevistas/prototipo | Pendiente | 10 entrevistas y prueba de flujos móviles antes de piloto |
| T01 Cimientos | En curso | Repo, interfaz, API, DB, RLS, identidad, cola y restauración local verificados. Staging, respaldo externo y teléfonos físicos pendientes; ver [acta](evidencias/t01.md) |
| T02 Multiempresa | Hecho local | Marca/alumnos/planes conectados; 40 pruebas aprobadas acumuladas y capturas. [Acta y límites](evidencias/t02.md) |
| T03 Ejercicios y medios | Hecho local; puerta física abierta | Biblioteca, equipos, clips/fotos, permisos y operación; 55 pruebas acumuladas. [Acta y límite WebKit Windows](evidencias/t03.md) |
| T04 Rutinas | Hecho local | Constructor móvil/PC, plantillas, versiones y asignaciones; 77 pruebas acumuladas. [Acta y capturas](evidencias/t04.md) |
| T05 Sesiones | Hecho local; puerta física abierta | Sesiones, cola IndexedDB, conflicto e historial; 99 pruebas acumuladas. [Acta](evidencias/t05.md) |
| T06 Progreso | Hecho local; puerta física abierta | Progreso, mediciones y fotos privadas; 117 pruebas acumuladas y restauración de 201 archivos/13 conteos. [Acta](evidencias/t06.md) |
| T07 PWA, cuenta y piloto | Base local implementada; piloto abierto | [Acta histórica](evidencias/t07.md); pago/reintento/comprobante WebKit verificado por caso aislado en [continuación T14](evidencias/t14-continuacion.md), sin nueva pasada completa |
| T08 Archivos/PDF | Base local implementada | Colecciones, permisos, versiones, PDFs y worker; nueve casos + dos unitarias, revisión UI/PDF de consumo reducido. [Acta](evidencias/t08.md) |
| T09 Alimentación | Base local implementada | Alimentos con fuente, recetas, menús/versiones, diario/fotos con permisos propios y PDF; nueve casos + cuatro unitarias. [Acta](evidencias/t09.md) |
| T10 Chat/hábitos | Base local implementada | Chat privado, adjuntos, avisos, hábitos y check-ins versionados; once casos y tres unitarias. [Acta](evidencias/t10.md) |
| T11 Agenda y reglas | Hecho local; puertas físicas/externas abiertas | Disponibilidad, reservas, asistencia y avisos internos; nueve casos + tres unitarias dirigidos. [Acta](evidencias/t11.md) |
| T12 Negocio coach | Hecho local; puertas físicas/externas abiertas | Servicios, cuotas, pagos/retornos, paquetes, CRM y resumen; nueve casos + dos unitarias. [Acta](evidencias/t12.md) |
| T13 Consolidación independiente | Hecho local; puertas físicas/externas abiertas | Alta solo coach, inicio real, Más opciones, Información y NAVZ. [Acta](evidencias/t13.md) |
| T14 Piloto independiente | Preparación técnica local ampliada; aceptación/piloto abiertos | [Entrega inicial](evidencias/t14.md), [huellas y WebKit 0.14.1](evidencias/t14-continuacion.md), [guía](runbooks/t14-salida-y-piloto.md), [responsables pendientes](piloto/03-salida-independiente.md) |
| T15 Rediseño | Código principal implementado; revisión visual pendiente | Escala compacta, páginas, pasos, vocabulario propio y símbolos opcionales. App apagada. [Plan](tandas/15-redisenio-mobile-first.md) |
| T16 Ficha central | Entrega técnica local; aceptación visual y uso abiertos | Catálogo, ficha, planes, exportación y demo ficticia; fallos detectados por usuario se trasladan a [T17](tandas/17-antropometria-y-densidad-visual.md) |
| T17 Antropometría y densidad | Primer corte local verificado; núcleo científico pendiente | 401/403 y riel de fechas corregidos; faltan modelo ISAK, fórmulas verificadas, exportación y revisión física. [Plan](tandas/17-antropometria-y-densidad-visual.md) |

## Registro de avance (añadir una entrada por semana)

### 24-10-2026 — T15 reanudada para prueba manual

- Usuario autoriza volver a probar. Build/tipos actuales aprobados; PostgreSQL local estaba apagado y se reactivó conservando bases. Primer login fallido diagnosticado; se retomó desde ese punto, sin repetir bienvenida.
- Revisión de nuevo alumno a 320/390 px, cancelar/confirmar descarte, rutina de PC con un paso sin scroll interno ni acciones flotantes y abrir/volver de crear ejercicio sin perder borrador. Cero errores JS; sin guardar datos de negocio durante la revisión.
- Corregidos botón Volver con estilo nativo, detección errónea de `/alumnos` como vista alumno, Más duplicado y enlace de cuenta mensual. Un empaquetado puntual adicional y comprobación exclusiva de esos detalles; sin repetir tipos/suites.
- Tres instancias Chromium cortas, tres capturas generadas (móvil inicial, PC y móvil final), inspeccionadas. Build final: 85 assets de shell/86 artefactos/146 fuentes. Sin migraciones, reset, dependencias o workers.
- Demo queda encendida solo en este PC para el usuario, con accesos/datos conservados. Sin builds o pruebas automáticas en marcha. [Acta, capturas y pendientes](evidencias/t15-revision-local.md); aceptación del usuario y teléfonos/recuperación externos abiertos.


### 23-10-2026 — T15, rediseño tras uso y pausa de ejecución

- Replanteada escala, navegación y autoría a partir de las dos capturas: Inter, títulos 22/17 px, campos 16 px, acciones táctiles 44 px, menos copy y ornamentación. Constructor por pasos anchos; sin tres paneles con scroll ni barra flotante sobre campos.
- Alta/ficha, biblioteca/guías, versiones, cancelaciones y fotos pasan a páginas. Confirmaciones y motivos se resuelven dentro de la app. Creación de ejercicio desde la rutina y vuelta al editor montado.
- Opciones de objetivo/categoría/material/ubicación libres, vacías inicialmente y guardadas por coach/espacio. Migración aditiva 024 aplicada a `forma` y `forma_manual_demo`, sin reset. Próxima 025. Once SVG propios opcionales; medios/instrucciones del coach, sin importación masiva.
- Dos casos de integración nuevos aprobados en ejecuciones dirigidas: primer caso aprobado inicialmente; segundo repetido solo tras corregir permiso de columna. Una unitaria de consentimiento explícito aprobada. Dos builds/tipos previos al apagado concluidos; últimas correcciones de navegación posteriores sin nuevo build. Lint dirigido con correcciones; ver [acta](evidencias/t15-redisenio.md) para alcance exacto.
- Usuario pidió apagar proyecto y detener builds; demo detenida y sin listeners de app. Se siguió editando código/guías sin arrancar ni hacer revisión de navegador. Datos ficticios y accesos conservados. No hay capturas nuevas, aceptación visual o instalación física acreditadas.
- Backup actualizado a 86 indicadores previstos (70/16), sin otra restauración. Dossier revisado para 024, vocabulario compartido fuera del alcance individual, futuro esquema exige nueva revisión. Piloto real y puertas físicas/externas abiertos.
- [ADR 017](decisiones/017-redisenio-y-autoria-coach.md), [tareas/plan visual T15](tandas/15-redisenio-mobile-first.md), [manual](runbooks/t15-interfaz-y-contenido.md). Siguiente: recorrido breve móvil/PC solo cuando se permita volver a ejecutar.


### 23-10-2026 — T14-09, prueba privada local y comparación de alojamiento

- Creada base persistente separada `forma_manual_demo` con 001–023 y storage propio. Tres coaches, cuatro alumnos con cuenta, una invitación sin cuenta, dos programas publicados, cuatro asignaciones, una sesión completada parcial, tres mediciones y dos mensajes; pagos/accesos en distintos estados. Solo datos ficticios, sin mutaciones de negocio en `forma`.
- Contraseña ficticia generada por instalación en `.local/manual-demo/ACCESOS.md`, excluida de Git; no se copia a las guías. Administrador, coaches y alumnos usan sus permisos reales. No se publica enlace, túnel o regla de firewall.
- Prueba encendida solo en este PC: http://127.0.0.1:4180/acceso. API 3010, web 4180, procesos ocultos; `scripts/manual-demo.ps1 start/status/stop` conserva datos. Preparación no resetea una base existente y detención verifica instancia/proceso propios.
- Preparación ejecutada una vez y recorrido HTTP breve aprobado: instancia, admin/tres coaches, coach/cuatro fichas, alumno activo, alumno pausado e intento de otro coach. [Informe sin credenciales](evidencias/t14-demo-privada.json). Sin navegador de prueba, workers, PDFs, SMTP, instalaciones o build nuevo. Lint de scripts aprobado tras quitar un import no usado.
- Investigadas fuentes oficiales de Railway, Render, Hetzner, DigitalOcean, Fly.io, Supabase, Vercel, Tailscale y Cloudflare. [Comparativa, costes y ruta privada](piloto/05-alojamiento-privado.md). Finalistas para alojamiento autónomo: VPS por encaje con Compose/volumen compartido y Railway sujeto a adaptación/presupuesto; sin contratar ni desplegar.
- [Guía de uso y cuentas](runbooks/t14-prueba-privada.md): recorrido admin → coach → alumno, conservación de cambios, límites de módulos sin worker y fechas del contenido. Móvil físico requiere perfil HTTPS privado separado; la URL loopback no funciona desde el teléfono.


### 23-10-2026 — T14-08, cierres locales de datos y preparaciones de pruebas

- Herramienta técnica `plan/export/open`: inventario y dossier estructurado cifrado por estudio/alumno, lectura consistente, operador declarado activo/superadmin, límites de tamaño y revisión obligatoria ante esquema posterior a 023. No expone HTTP, secretos o rutas de storage; no ejecuta borrados.
- Dossier con datos propios de entrenamiento/progreso/alimentación/seguimiento/agenda/negocio y referencias acotadas; cuenta compartida no incorpora perfiles de otro estudio. Bytes, contexto compartido y eliminación integral siguen pendientes. P03 abierta.
- Doce preparaciones de integración actualizadas: habilitación explícita mediante función real y DB sintética validada; facturación/carga histórica reconstruyen pre-023 únicamente en aislamiento. Preparaciones de navegador y expectativas de alta/cuenta/admin adaptadas; los scripts manuales antiguos conservan límites históricos.
- Verificación dirigida: **2 casos aprobados, 3 omitidos**, en dos bases temporales; un caso nuevo de dossier/aislamiento/cifrado y un caso existente de inicio con fixture habilitada. Primer intento bloqueado por sandbox EACCES antes de ejecutar casos; reintento autorizado contra PostgreSQL local. Sin suite completa.
- Tipos servidor aprobados una vez, lint dirigido aprobado, ayuda CLI revisada y descubrimiento estático Playwright: 21 combinaciones en seis archivos, **cero navegadores ejecutados**. Huellas web vigentes: 134 entradas/78 artefactos, sin reconstruir.
- Aplicación conserva v0.14.2/001–023, próxima 024; sin dependencias, migraciones o cambios UI/CSS. Backup sigue 85 indicadores previstos, sin otro restore. Cero datos reales exportados, envíos, PDFs o despliegues.
- [Guía detallada y siguiente recorrido ficticio](runbooks/t14-cierre-local.md), [acta y límites](evidencias/t14-cierre-local.md), [ADR 016](decisiones/016-cierre-local-y-datos.md). Próximo paso: uso manual móvil/PC con datos ficticios y correcciones puntuales; físico/externo y piloto real siguen pendientes.


### 22-10-2026 — T14-07, mensualidad/cupo/acceso manual entregados en local

- Usuario decide en admin precio mensual, cupo y habilitación de coach; coach decide mes pagado y acceso individual. Suspender coach también bloquea alumnos. Reglas cerradas, sin otra consulta de precio/prueba necesaria.
- V0.14.2, 023 aplicada, próxima 024. Nuevas altas suspendidas con cupo 0/precio sin definir, sin prueba automática; espacios anteriores conservados hasta configuración explícita. Cuenta propia legible con suspensión. No pasarela, cobros, copia de pagos o suspensión al cambiar de mes.
- /admin muestra controles; /mensualidades ofrece lista de alumnos/mes y decisiones separadas; /cuenta muestra mensualidad propia readonly. RLS, funciones, revisiones, intenciones y eventos inmutables; cupo de activos bajo bloqueo, restauración no reactiva alumnos pausados. Precios/cupos actuales no se presentan como reconstrucción histórica.
- Cinco integraciones nuevas aprobadas inicialmente. Solo filtro SQL reforzado repetido (1 aprobado/4 omitidos) con control positivo, otra organización y usuario deshabilitado. Tipos/build una vez; Vite 13,38 s, shell 77 assets/78 artefactos y 134 entradas de huella. Inventario confirma 23 checksums/rol/versión/huellas; HTTP local mantiene needs-attention correctamente.
- Un Chromium/una página, 11,946 s, dos capturas inspeccionadas y cero errores/PDF. Admin configura y marca mes; coach reintenta respuesta perdida con un evento, pausa alumno y consulta mes anterior sin copiar pago. Reflujo 320/1440 y captura 390, campos 16 px/acciones 44; firma y cinco destinos conservados. DB/storage de fixture eliminados, procesos cerrados.
- Backup añade tres conteos y una suma de configuración: 85 indicadores previstos (69/16), sin restore ejecutado. Sin dependencias, servicios, envíos, dinero real, suites históricas, carga, Docker o scanner. Fixtures históricos deben adaptarse a aprobación explícita antes de repetirse.
- [Acta/capturas](evidencias/t14-control-mensual.md), [manual](runbooks/t14-control-mensual.md), [ADR](decisiones/015-control-mensual-manual.md). T14-07 entregada local; [puertas externas](piloto/00-puertas.md) y piloto real abiertos. Código anterior y decisiones documentales posteriores se conservan como histórico.

### 22-10-2026 — Decisión de pagos externos y control manual

- Usuario confirma que no habrá pagos procesados dentro de la app: coach marca si sus alumnos pagaron; operador comprueba el pago externo de cada coach y decide acceso desde su panel.
- Código revisado: ya existen registros manuales T07/T12 y suspensión/restauración de estudio auditada en /admin. Falta simplificar a Pagado/Pendiente por período y reunir pago/acceso en una vista clara. No se afirma que esa UI esté implementada.
- T14-07 planificada como siguiente trabajo local de bajo consumo, sin pasarela/SDK/worker nuevos ni bloqueo por impago automático. Conservar historia y separar pago de permiso de acceso. Reglas por definir: precio/período, alta/prueba y efecto de suspender coach sobre alumnos.
- [Plan priorizado e información necesaria](piloto/04-pendientes-y-control-manual.md), alcance/negocio/tanda/ficha actualizados. Corte de código sigue v0.14.1/001–022, próxima 023. Esta actualización solo lee código y escribe Markdown; sin build, tests, DB, servicios o nuevas mediciones. Puertas físicas/externas y piloto siguen abiertos.

### 22-10-2026 — Continuación T14 local, v0.14.1

- Pendientes abordables sin infraestructura externa: huella de build y caso funcional de pago/reintento/comprobante WebKit T07. No se cambian componentes/CSS, navegación o firma NAVZ; coaches independientes y diseño móvil/PC conservados.
- Build escribe manifiesto fuera de dist/web; inventario compara versión, 128 entradas web/UI/shared y 73 salidas (72 assets de shell). Detecta fuente posterior, salida alterada incluso de igual tamaño y manifiesto ausente. No lee .env/datos privados ni acredita constructor, node_modules, variables de compilación o despliegue remoto.
- Dos unitarias nuevas aprobadas; solo filtro de artefactos repetido tras ampliar inventario de salidas. Tipos servidor y un empaquetado web/shell/procedencia aprobados; no repetir vue-tsc de UI intacta ni suites históricas.
- Una pasada WebKit aislada aprobada: 27,664 s total, una página, sin capturas/trazas/PDF. Pérdida de respuesta conserva formulario/archivo, reintento mantiene ID y crea un solo pago con saldo cero; selector nativo limpio. Comprobante owner 200/alumno 404, owner sin movimientos admin, 320/1440 sin desborde/campo 16 px/zoom no bloqueado y cero errores de página.
- Base/storage temporales eliminados y procesos/conexiones cerrados. Cero mutaciones de negocio en base de trabajo; cero correo/worker/Docker/restore/carga. El pendiente funcional local WebKit de cuenta queda acreditado por este caso, sin afirmar repetición completa del recorrido histórico ni aceptación Safari/iPhone o límites de vídeo/CacheStorage.
- Inventario sin DB: versiones/huellas aprobadas, configuración global needs-attention por HTTP local (correcto). Se reutilizan checksums/rol previos sin repetir SQL; snapshots operativos históricos no se declaran actuales. Siete manifiestos/lock alineados en 0.14.1, 001–022 sin cambios, próxima 023 y 81 indicadores de backup previstos.
- [Acta y evidencia](evidencias/t14-continuacion.md), [guía reproducible](runbooks/t14-continuacion-local.md), [ADR actualizado](decisiones/014-estabilizacion-y-piloto.md). Pendientes físicos/externos, privacidad/operador/precio, recuperación y piloto real continúan en [ficha](piloto/03-salida-independiente.md); 0 coaches reales.

### 22-10-2026 — T14, preparación técnica local y salida independiente

- V0.14.0, siete manifiestos/lock alineados; 001–022 sin cambios, siguiente 023. Mismo stack, sin dependencias, tablas, servicios o datos de negocio nuevos. Firma NAVZ y diseño móvil/PC conservados; se reutiliza revisión visual T13 porque no se cambian componentes/CSS.
- Arranque valida origen exacto/HTTPS de producción, secreto y conexión explícita sin administrador habitual. Proxy por IP inmediata explícita, no por cabeceras de cualquier cliente; red edge/IP fija en overlay y API sin puerto público. SW de producción con no-cache.
- Monitor incluye comprobantes de pagos del coach, límites 3/5 s y conexión de solo lectura. Un único snapshot dejó pendientes reales del desarrollo: cuatro comprobaciones de workers sin latido, 499 jobs retrasados, diez fallidos y backup local de 25,88 h. No se arrancaron procesos ni consumieron correos para cambiar el resultado. Costes desconocidos; fixtures no son métricas de negocio.
- Tres unitarias nuevas con evidencia aprobada entre inicial y un filtro; caso de proxy se corrigió al comprobar que Fastify rechaza confianza por saltos. Build/tipos y lint aprobados. Compose local/producción validado sin levantar contenedores, con SMTP_USER/PASSWORD sin configurar en el ejemplo de validación.
- Una pasada de inyección local de 10,329 s midió cinco rutas, tres muestras por ruta y dos denegaciones de alumno; no hay p95 o capacidad comercial. Continuación de 1,713 s/6 peticiones solo para owner ajeno y sin sesión, tras corregir expectativa del script 403→404 conforme al contrato; no se repitieron mediciones. Sesiones técnicas cerradas.
- Inventario compara 22 checksums con DB y privilegios del rol API: aprobados; build presente y versiones alineadas. Configuración de producción devuelve needs-attention por origen HTTP local, correctamente; no se altera `.env` para fingir salida. Siempre pilotApproved=false.
- [Guía completa](runbooks/t14-salida-y-piloto.md), [ficha de salida](piloto/03-salida-independiente.md), [ADR](decisiones/014-estabilizacion-y-piloto.md), [acta y resultados](evidencias/t14.md). T14 no se declara terminada en dispositivos/operación real: siguen P01–P18 aplicables, privacidad/derechos de datos, staging, una recuperación externa y piloto de 3–5 coaches durante cuatro semanas.
- Cero navegadores, PDFs, carga, restores, suites históricas, instalaciones, contactos o despliegues. 81 indicadores de backup previstos conservados; no se añade una tanda 15 ni gimnasios por defecto.




### 22-10-2026 — T13 reorientada a coaches independientes

- Decisión expresa del usuario: un coach responsable por espacio y sus alumnos; plataforma con múltiples negocios aislados. Gimnasios, staff compartido y sedes fuera del alcance actual. T13/T14, visión, hoja de ruta y catálogo actualizados.
- V0.13.0, 022 aplicada; próxima 023. Registro/UI/API/función SQL solo aceptan altas coach; constructor previo interno sin EXECUTE API. Datos, roles históricos y permisos se conservan.
- Inicio owner con cinco pasos derivados y contadores completos: marca, correo, alumno activo, rutina distinta publicada y asignación actual/próxima. Resumen owner privado sin contactos o contenidos; sin polling.
- Más opciones por rol y agrupación de uso; cinco destinos inferiores conservados. Selector de espacio/profesional solo si hay más de una opción. Información pública con ayuda/versionado y firma exacta Creado por NAVZ, +595972995557; componente compartido en footer/acceso/registro, teléfono solo al pulsar.
- Cuatro casos nuevos de integración con evidencia aprobada: tres iniciales y uno repetido tras corregir fixture de rutina; sin cambios extra de negocio para esa repetición. Tipos/build/lint y alcance visual en [acta](evidencias/t13.md). [Manual](runbooks/t13-uso-y-operacion.md), [API](runbooks/api-t13.md), [ADR](decisiones/013-coaches-independientes.md).
- Revisión con un Chromium compartido de 15,3 s: Inicio/Agenda/Más/Información/registro, temas claro/oscuro, 320/390/768/1440, cero errores, cero mutaciones de negocio y cero PDFs. Firma exacta y tel verificados sin llamarlo; servidores/navegador cerrados.
- Cierre ligero: lint del script aprobado, siete manifiestos/lock alineados y 791 enlaces locales comprobados sin roturas. Sin repetir pruebas de negocio por documentación.
- Sin tablas/medios privados o dependencias nuevos, 81 indicadores previstos de backup conservados. Sin suites históricas, PDF, carga, Docker, antivirus o restores. T14 sigue planificada; teléfonos/HTTPS/recuperación/operador y pendiente WebKit T07 permanecen abiertos.

### 22-10-2026 — T12 implementada en local

- V0.12.0, 021 aplicada; siguiente 022. /servicios: catálogo, venta de dos pasos con snapshot, 1–24 cuotas, PYG/USD/EUR, pagos parciales y comprobantes privados. Devoluciones reales, anulación de pago erróneo y ajustes separados; cancelación conserva deuda e historia.
- Vigencia fija en días, cupo concurrente y renovación explícita; paquetes descuentan manualmente una asistencia confirmada y pueden restaurar errores con ledger. Venta/cancelación no altera factura SaaS, acceso del alumno o reservas de agenda.
- CRM owner: etapas, origen, próxima acción, conversión por correo sin duplicar ficha/enviar invitación/activar acceso. Borrado de datos del prospecto y limpieza de cerrados a 90 días en worker existente, hasta 100/ciclo. Gestión comercial no concede chat ni permisos privados.
- Resumen por moneda con pagos confirmados/devoluciones/neto, precio comprometido y saldo actual de cuotas del periodo; CSV numérico autorizado. Nueve integraciones y dos unitarias con evidencia aprobada; se repitió únicamente resumen tras corregir alias de moneda. Tipos/build/lint y revisión móvil/PC detallados en [acta](evidencias/t12.md).
- Recorrido funcional con un Chromium compartido: 21,3 s, cinco comprobaciones, reflujo 320/390/768/1440, cero errores. Espaciado de tarjetas corregido; continuación de captura de solo lectura de 7 s, sin repetir ventas/pagos. Fixture cerrada mediante corrección/ajustes/cancelación/archivo/borrado CRM; procesos cerrados y cero PDFs.
- Cierre estático: lint aprobado, siete manifiestos/lock alineados y 758 enlaces locales comprobados sin roturas. Sin nuevas pruebas de negocio para documentación.
- Backup incorpora comprobantes, diez conteos y doce sumas por moneda: 81 indicadores previstos (66 conteos/15 sumas). Sin suites históricas, Docker, AV, carga, pasarelas, envíos o ensayo nuevo de recuperación. [Manual](runbooks/t12-uso-y-operacion.md), [API](runbooks/api-t12.md), [ADR](decisiones/012-negocio-del-coach.md), [plan visual](11-plan-visual.md).
- Próxima T13 planificada. Preservar puertas físicas/externas, piloto, pendiente final WebKit T07 y [firma NAVZ](pendientes/firma-navz.md).

### 22-10-2026 — T11 implementada en local

- V0.11.0, migración 020 aplicada; próxima 021. /agenda: disponibilidad manual, cita/clase, cupo, reserva, cancelación motivada, asistencia y zona del estudio. Exclusiones globales de profesional/alumno y último cupo transaccional, recibos idempotentes y revisión.
- Móvil lista o detalle; PC dos columnas, campos 16 px y acciones 44 px. Regla bienvenida/cita próxima/check-in pendiente, versiones inmutables, vista previa privada, pausa y reintento técnico acotado. Outbox, quiet hours, límites diarios y preferencia/consentimiento revisados al entregar; worker existente, sin nuevas dependencias ni Push.
- Nueve integraciones y tres unitarias con evidencia aprobada: seis casos iniciales, tres tras corregir alias SQL y dos de reglas repetidos únicamente por cambios de privacidad/bienvenida. Tipos y build aprobados; una corrección de botón solo requirió reconstruir web/shell. Alcance exacto de revisión visual y capturas en [acta](evidencias/t11.md).
- Revisión visual cerrada: dos pasadas Chromium secuenciales de 24,2 s y 12,4 s; segunda limitada a reglas, cancelar/reservar otra vez y botón móvil. Reflujo 320–1440 observado, cero errores de página y fixtures canceladas. Lint final y siete manifiestos/lock alineados; 687 enlaces comprobados sin roturas. Sin repetir la matriz histórica.
- Backup amplía diez conteos: 59 indicadores previstos; sin ensayo nuevo. Monitor incluye latido/cola interna. No se ejecutaron suites históricas, Docker, AV, carga, envíos externos ni restauración.
- [Manual](runbooks/t11-uso-y-operacion.md), [API](runbooks/api-t11.md), [ADR](decisiones/011-agenda-y-avisos-internos.md), [plan T11](tandas/11-agenda-automatizaciones.md) y [plan visual](11-plan-visual.md). T12 continúa planificada. Mantener teléfonos/HTTPS/retención/recuperación/piloto y pendiente WebKit T07. [Firma NAVZ](pendientes/firma-navz.md) pendiente para más tarde.

### 22-10-2026 — T10 implementada en local

- V0.10.0, migración 019 aplicada, siguiente 020. Parejas privadas alumno/profesional, mensajes secuenciados e idempotentes, lectura, retirada y retención. El owner no accede por su cargo a chats ajenos.
- WebSocket autenticado con invalidación tras commit, revalidación y reconexión; HTTP alternativo visible. Adjuntos de imagen/vídeo/audio/PDF privados, cuota compartida, biblioteca protegida y referencias T08 revalidadas.
- Bandeja, preferencias y silenciar; hábitos opcionales con permiso de seguimiento propio, formularios publicados inmutables, semana/mes y fin de mes, respuestas editables en ventana y revisión que cierra edición.
- Programador ligero, conversiones secuenciales por defecto, monitor y trece conteos de backup añadidos: 49 indicadores previstos. No se ejecutó backup/restauración, Docker, ClamAV real ni suites históricas.
- Once integraciones nuevas y tres unitarias aprobadas por ejecución y filtros afectados. Compilación/tipos y lint de cambios aprobados. [Acta y comprobaciones visuales](evidencias/t10.md), [uso](runbooks/t10-uso-y-operacion.md), [API](runbooks/api-t10.md), [ADR](decisiones/010-chat-y-seguimiento-privados.md).
- Teléfonos, Push opcional, proxy HTTPS, scanner y recuperación reales permanecen abiertos. T11 agenda recibe base 0.10.0/020; conservar la firma NAVZ como pendiente de presentación.

### 22-10-2026 — Firma NAVZ registrada para más adelante

- Petición del usuario: «Creado por NAVZ, +595972995557». [Pendiente detallado](pendientes/firma-navz.md), con ubicación propuesta en Información/footer y checklist móvil/PC. Todavía no implementada en la interfaz. Se continúa T10.

### 22-10-2026 — T09 implementada, con verificaciones dirigidas

- V0.9.0, migración 018 aplicada; siguiente 019. Capacidad profesional explícita y vínculo a ficha; owner sin concesión no lee diario. Consentimiento propio de alimentación, separado de datos corporales/recursos.
- Alimentos por 100 g con fuente/licencia/preparación y valores desconocidos conservados; recetas/rendimiento, siete días, alternativa, copia móvil, publicación congelada, compras y asignación sin solapamiento. Sin importar catálogos masivos.
- Alumno consulta menú sin registrar, declara comida/cantidad opcional/nota/foto privada; profesional comenta con permiso. Previsto y consumido separados, con ausencia de datos explícita.
- PDF independiente forma-menu-v1, marca/fecha/alumno, fuentes/compras/alternativas; nueve páginas de muestra ficticia. Presupuesto/cola/entrega T08 compartidos, sin nuevos recargos. Fotos incorporadas a cuota, inventario y retención; 36 indicadores de backup previstos, sin restauración nueva.
- Nueve casos de integración y cuatro unitarias aprobados; solo se repitieron individualmente foto/auditoría y publicación/null tras ajustes. La revisión visual detectó y corrigió coerción de null a cero; el script actualiza CSRF al mezclar API/UI. Se reutilizó constructor y se retomó lo afectado: dos sesiones Chromium, un PDF, continuación de 12 s; reflujo 320–1440, cero errores, revocación 200→404. Sin suite histórica, carga, Docker, AV pesado o restores.
- [Manual](runbooks/t09-uso-y-operacion.md), [API](runbooks/api-t09.md), [decisiones](decisiones/009-alimentacion-versionada.md), [acta](evidencias/t09.md) y [plan visual](11-plan-visual.md) actualizados. Revisión profesional/fuentes/consentimiento, teléfonos, recuperación e infraestructura pendientes. T10 sigue planificada.

### 21-10-2026 — T08 implementada y documentada, con pruebas puntuales

- Versión 0.8.0, migración 017 aplicada. Colecciones y vínculos a ficha/programa, recursos del creador/owner, versiones con datos históricos, edición/movimiento con revisión y archivo. Compartición por alumno y lote actual, sin permiso implícito por asociación.
- Fotos/vídeos reutilizan T03; PDFs subidos quedan en cuarentena hasta respuesta limpia de ClamAV. Sin servicio configurado se bloquea la subida. Contrato de escáner probado con un servidor local controlado; antivirus real no acreditado.
- Worker documental de un trabajo simultáneo, plantillas rutina/historial/informe, marca/logo/fecha/datos conservados, cuota conjunta y presupuesto mensual, reintento/cancelación. Archivo temporal autenticado, sin token en URL; revocación comprobada (200 → 404).
- **Nueve casos de integración T08 y dos unitarias nuevas con evidencia aprobada**, reutilizando resultados y repitiendo solo lo corregido. Tipos, build y lint de cambios aprobados. No se ejecutaron la suite histórica, WebKit, carga, Docker ni otra restauración.
- [Revisión UI](evidencias/t08-visual.json): un Chromium compartido, 13 s, una generación inicial, 320/390/768/1440 px, campos ≥16 px, cinco destinos y cero errores. Se corrigió un corte de tabla y se regeneró únicamente el PDF: siete páginas A4, marca, español/guaraní y copia ficticia. [Capturas y alcance](evidencias/t08.md).
- Backup amplía inventario y cuatro conteos: **27 indicadores previstos**, sin declarar un ensayo nuevo. Configuración ClamAV/contenedor/telefonía, restauración T08 y políticas integrales permanecen pendientes. Los servicios de la revisión se cerraron al terminar.
- [Manual](runbooks/t08-uso-y-operacion.md), [API](runbooks/api-t08.md), [ADR](decisiones/008-recursos-y-pdf.md) y plan de [T08](tandas/08-archivos-pdf.md) actualizados. Siguiente migración 018; T09 sigue planificada y no se ha implementado.

### 21-10-2026 — Inicio e implementación T08

- Recursos privados en `/recursos`: colecciones, fichas/programas asociados, versiones, permisos por alumno y entrega temporal ligada a la sesión. Móvil primero, panel de detalle en PC y cinco destinos principales conservados.
- Migración 017 preparada; primero se verifica en base aislada. Worker documental secuencial y plantillas HTML/CSS de rutina, historial e informe con snapshots de datos y marca. Fotos/vídeos reutilizan medios T03 sin copiar bytes.
- PDF subido requiere ClamAV; sin servicio configurado la carga se bloquea explícitamente. Los comprobantes financieros y las fotos de progreso conservan su ámbito independiente.
- Verificación de consumo reducido: tipos y ocho casos dirigidos sin navegador; después una sola sesión Chromium para muestra PDF e interfaz. No se ejecutan la matriz histórica, cargas ni otra restauración. El primer intento no ejecutó casos porque PostgreSQL estaba detenido; se arranca únicamente la base local existente.
- [ADR 008](decisiones/008-recursos-y-pdf.md). Estado de T08 y acta se actualizarán con resultados reales; pendientes de T07 conservados.

### 21-10-2026 — T07 implementada; cierre documental y uso reducido de recursos

- Versión 0.7.0 y migraciones 014–016: cuenta mensual auditable, días por alumno, precio de apertura, emisión inmutable, ajustes, pagos manuales/reversiones y comprobante privado. Habilitación activa la suscripción sin cobro retroactivo y respeta el fin de prueba.
- PWA por marca, arranque con selección explícita del estudio, instalación guiada y actualización en espera. Móvil primero y PC: tarjetas, campos 16 px, cinco destinos principales, opciones secundarias, sidebar desplazable y tema oscuro.
- **23/23 unitarias y 73/73 integraciones aprobadas**, build/tipos/lint/formato correctos. Carga sintética de cinco actores/50 alumnos/75 lecturas sin errores; no acredita capacidad comercial.
- Navegador: pasada general 40/44; cuatro bloqueos de fixture resueltos y repetición dirigida WebKit 5/5 aprobada. El caso ampliado final de cuenta pasa en PC y móvil; WebKit agotó tiempo y queda pendiente tras ajustar captura/contexto. [Acta y alcance exacto](evidencias/t07.md). No se declara una pasada final completa de 140 casos verdes.
- Respaldo cifrado/restauración ya verificados: **239 archivos, 23 indicadores y siete saldos**. Monitor con DB/disco/medios/backup sanos y alerta de cola antigua: 455 atrasados y 10 fallidos en ese corte. Sin nuevos envíos, restauraciones repetidas ni costes inventados.
- [Manual T07](runbooks/t07-uso-y-operacion.md), [API](runbooks/api-t07.md), [ADR 007](decisiones/007-pwa-y-cuenta-saas.md), [cálculos](evidencias/t07-calculos.md), [puertas](piloto/00-puertas.md), [protocolo](piloto/01-protocolo.md) y [registro](piloto/02-registro.md) actualizados. Cero coaches reales; T07-07 sigue abierta. T08 queda planificada, sin comenzar su implementación.
- Preferencia del usuario: pruebas permitidas con consumo reducido. Un proceso a la vez, casos dirigidos y evidencia reutilizada; no repetir suites, carga, capturas masivas o restauraciones sin una necesidad concreta. Se detienen las repeticiones finales costosas.
- Cierre documental: 405 enlaces locales comprobados, ninguno roto. Tras la petición de consumo reducido solo se actualiza documentación y se realiza esa comprobación ligera; no se lanzan nuevas suites ni restauraciones.

### 21-10-2026 — T07 funcional; QA y operación en curso

- Migraciones 014/015 aplicadas: habilitación, cuentas/snapshots, ajustes, pagos/reversiones, comprobantes privados y agregados de piloto. Mes actual estimado, cierre de meses terminados e inmutabilidad verificados.
- PWA con manifest/iconos por estudio, arranque que selecciona su marca y actualización en espera sin recarga forzada. Instalación y cuenta adaptadas a móvil/PC; textos y protocolo de piloto preparados.
- Suite DB completa de 70 y 21 unitarias aprobadas antes de casos adicionales; lectura ligera de cinco actores/50 alumnos/75 consultas aprobada. Los seis recorridos T07 de cuenta/PWA pasan en PC/móvil/WebKit; regresiones y shell en revisión.
- Detectado y corregido alcance de Cerrar sesión en sidebar de ventanas bajas; repetición pendiente. Monitor local muestra alerta de correos antiguos, sin enviarlos ni ocultarla.
- Backup añade comprobantes y 23 indicadores (20 conteos/3 sumas). El monitor identifica la base/storage para no acreditar una copia de tests como respaldo operativo. Ensayo final y aceptación física/externa pendientes.

### 21-10-2026 — Inicio T07

- PWA por estudio con identidad/arranque explícitos y actualización controlada, conservando la cola y privacidad offline.
- Cuenta mensual informativa: días por alumno, prorrateo entero, snapshot e idempotencia, ajustes y pagos manuales con auditoría. Habilitación explícita y sin cobro retroactivo; plan de apertura para precio del mes.
- Pulido móvil/PC, operación y preparación del piloto. Teléfonos, políticas, infraestructura y coaches reales mantienen puertas abiertas. [ADR 007](decisiones/007-pwa-y-cuenta-saas.md).


### 21-10-2026 — T06 implementada y verificada en local

- T06-01–05: fórmulas, agregaciones, historial con filtros/carga por lote, mediciones y fotos privadas, panel alumno y seguimiento coach conectados. Un cierre confirmado modifica el gráfico sin registro duplicado; reaperturas, parciales, cargas cero/no indicadas y cancelaciones explícitos.
- T06-06: **19 unitarias + 62 integración verificadas; 12 recorridos de navegador de regresión dirigida aprobados**. Los tres T06 se repitieron al terminar el pulido. Cobertura acumulada: **117 únicas** (19 + 62 + 36); los otros 24 recorridos de navegador conservan evidencia T05, sin declarar otra pasada completa.
- Fixture manual exacto y 5.000 series adicionales comprobados; datos de mediciones/fotos denegados a profesionales sin permiso, revocación efectiva reutilizando URL, normalización sin EXIF, idempotencia concurrente y cuota compartida. Se conservó la inmutabilidad de planes en pruebas.
- Móvil de una columna, PC con comparación, etiquetas de gráfico adaptadas al contenedor y tabla equivalente. Medidas/privacidad priorizan formulario; inputs 16 px y zoom accesible. Capturas ficticias claras/oscuras y WebKit revisadas.
- Corregida notificación de bucle ResizeObserver en WebKit sin silenciar errores; al volver del fondo se revalidan permisos conservando el archivo seleccionado. Las tres variantes finales pasan. El reintento de una foto eliminada devuelve conflicto explícito antes y después de la depuración, sin recuperar el archivo.
- Build/tipos/lint/formato aprobados. Backup cifrado/restauración local: **201 archivos y 13 conteos**, hashes e inventario privado correctos en DB nueva aislada. No hay publicación ni backup externo.
- [Manual T06](runbooks/t06-uso-y-operacion.md), [API](runbooks/api-t06.md), [ADR 006](decisiones/006-progreso-y-privacidad.md), [fixture](evidencias/t06-calculos.md), [acta/capturas](evidencias/t06.md). Plan general, visual, arquitectura y puente T07 actualizados; 311 enlaces locales válidos.
- Se mantienen puertas físicas/externas, políticas de retención/exportación/borrado y entrevistas. Siguiente entrega: [T07, PWA, facturación y piloto](tandas/07-piloto.md), migración siguiente 014.

### 21-10-2026 — T06 funcional; cierre de QA

- Migraciones 011–013 aplicadas: preferencias/consentimiento, permisos por profesional, hechos de medición, fotos privadas y avisos; consultas agregadas con fechas explícitas.
- `/progreso` de alumno y coach, gráficos SVG con tabla equivalente, comparación semanal, marcas realizadas, ficha y listado de seguimiento. Historial con fecha/estado y lectura por lote.
- 19 unitarias aprobadas y suite DB de 61 aprobada antes del caso adicional de cuotas/concurrencia. Recorrido nuevo Chromium PC aprobado; móvil/WebKit y regresiones en curso.
- Manual, API y fixture de cálculo escritos. Backup ampliado a 13 conteos e inventario de foto/miniatura; ensayo final pendiente. Puertas físicas/externas anteriores conservadas.

### 21-10-2026 — Inicio T06

- Métricas oficiales desde sesiones finalizadas y series confirmadas. Se distinguirán sesiones y días, parciales, reaperturas, cargas cero/no indicadas y cancelaciones.
- Mediciones con unidad/fecha/origen y correcciones auditadas; fotos opcionales fuera de la biblioteca general, con consentimiento y permisos revocables por profesional.
- Panel móvil de tarjetas y gráficos con tabla equivalente; PC con comparaciones y ficha del alumno. Se mantienen abiertas las puertas físicas y externas anteriores.

### 21-10-2026 — T05 implementada y verificada en local

- T05-01–05 cerrados localmente: sesiones por día/version, valores reales, eventos idempotentes, deshacer/notas/cierre parcial/reapertura, cola durable, conflictos y resultados alumno/coach. Diseño móvil de una columna y selector horizontal, PC con lista lateral, campos de 16 px y zoom accesible.
- T05-06: **17 unitarias + 49 integración + 33 navegador = 99 pruebas únicas aprobadas**. Los 24 recorridos anteriores pasaron en la regresión; las nueve pruebas T05 pasaron en su repetición final después de resolver una carrera entre el reintento automático y la prueba del botón. No se ocultó un fallo de datos ni se redujeron permisos.
- Build/tipos/lint/formato aprobados. Cinco capturas ficticias revisadas, 250 enlaces locales válidos y guías/planes T06/T07 actualizados.
- Backup/restauración: 167 archivos, ocho conteos, hashes y referencias privadas verificados en base nueva aislada. No hay respaldo externo ni despliegue realizado.
- Actualizar acceso permite volver al resto de la app tras reconectar; los avisos antiguos de red desaparecen después de sincronizar. Cancelación conserva/exporta pendientes; logout offline borra con confirmación y difiere revocación.
- Chromium reabre navegador persistente offline; WebKit Windows aprueba recarga en la misma página. Safari/iPhone y Android físicos, teclado/bloqueo/persistencia y limitación de vídeo T03 siguen abiertos antes del piloto.
- [Manual T05](runbooks/t05-uso-y-operacion.md), [API](runbooks/api-t05.md), [ADR 005](decisiones/005-sesiones-y-sincronizacion.md), [acta/capturas/diagnóstico](evidencias/t05.md). Siguiente entrega: [T06, progreso y métricas](tandas/06-progreso.md).


### 21-10-2026 — T05 funcional; cierre de QA

- T05-01/02: migraciones 009/010, copia del día, realizaciones separadas, eventos/recibos inmutables, idempotencia concurrente y revisión por serie/notas/sesión. Cancelación conserva historial y medios del día ejecutado.
- T05-03/04: entrenamiento móvil/PC, descanso, notas, cierre parcial, reapertura auditada, IndexedDB antes de red, conflictos explícitos y contexto offline acotado. Borrado confirmado al salir y revocación diferida en logout offline.
- T05-05: historial alumno y coach con objetivos frente a valores reales; acceso desde ficha y paginación estable incluso con fechas iguales.
- T05-06: unitarias e integración verificadas; casos nuevos de navegador aprobados por separado. Regresión global en curso. Cinco capturas ficticias revisadas, manual/API/ADR y planes actualizados.
- Backup cifrado/restauración local: 167 archivos, ocho conteos, hashes y referencias privadas verificados.
- Chromium reabre un perfil persistente sin red. WebKit Windows verifica recarga en la misma página; su reinicio frío no se declara aprobado. Diagnóstico sintético y puerta física en [acta](evidencias/t05.md).


### 21-10-2026 — Inicio T05

- Sesión ligada a día y versión inmutable. Objetivos separados de valores realizados; eventos con UUID, recibo durable y revisión por serie.
- IndexedDB antes de red, confirmación local diferenciada de servidor y conflictos explícitos entre dispositivos. Cancelar una asignación conserva los hechos y bloquea nuevos cambios.
- Diseño móvil de una columna y controles de pulgar; resumen lateral en PC. Implementación y pruebas en curso, sin declarar aceptación física.

### 21-10-2026 — T04 implementada y verificada en local

- T04-01/02: borradores acotados con revisión, snapshots inmutables y referencias históricas de medios; publicación concurrente idempotente. Migraciones 006–008 aplicadas sin reescribir las anteriores. El presupuesto del snapshot permite repetir instrucciones completas durante ocho semanas, sin truncarlas.
- T04-03: API para guardar/copiar/previsualizar/publicar/listar/asignar/cancelar, asignación atómica a varios alumnos y periodos sin solapamientos. Guardas RLS por estudio/alumno/profesional y conservación de `null` en cargas no prescritas.
- T04-04/05: constructor móvil de tres pasos, PC en tres columnas, duplicación independiente y orden por botones; portal `/mi-programa` con fechas, versión, equipo, instrucciones, medio y objetivos. Avisos de cambios antes de salir/cambiar estudio/cerrar sesión.
- T04-06: **13 unitarias + 40 integración + 24 navegador = 77 aprobadas**. Quince pruebas nuevas DB y cuatro unitarias; tres recorridos nuevos de navegador. Ocho semanas y dos alumnos, v1 intacta tras v2, cancelación, aislamiento, nulabilidad, instrucciones extensas y reflujo 320–1440 px verificados.
- Build/tipos/lint aprobados. Siete capturas ficticias y guías/ADR/API actualizados. Backup/restauración contrasta también programas, versiones y asignaciones; ver cifra final de archivos en el acta.
- Se amplía solo en desarrollo el límite de aceptación de invitaciones para la matriz de pruebas; producción conserva ocho por 15 minutos, con test de regresión. Un fallo de navegador provocado por recarga local de API se repitió con servicios estables y pasó.
- Se mantienen abiertas las pruebas físicas de T01/T03/T07, el límite de vídeo de WebKit Windows, SMTP/VPS/TLS/backup externo y políticas. T04 muestra planificación; el guardado de series reales/offline llega en T05.
- [Manual](runbooks/t04-uso-y-operacion.md), [API](runbooks/api-t04.md), [ADR 004](decisiones/004-rutinas-versionadas.md), [acta](evidencias/t04.md). Próxima entrega: [T05](tandas/05-sesiones.md).

### 21-10-2026 — Inicio T04

- Modelo decidido: borrador editable con revisión, publicación transaccional de snapshot inmutable y referencias a medios retenidas; asignación idempotente a una versión exacta con fechas sin conversión de zona horaria.
- Una asignación activa por alumno y periodo, sin solapamientos; cancelación con motivo. Publicar otra versión no modifica asignaciones previas.
- Constructor por semanas/días y tarjetas en móvil, columnas en PC, controles de ordenar accesibles y aviso de cambios no guardados. Implementación y QA en curso.

### 21-10-2026 — T04 funcional; cierre de QA en curso

- 006/007 aplicadas: borradores con revisión, snapshots y medios inmutables, lotes idempotentes y exclusión de periodos solapados. Validación de estructura/unidades también en DB.
- Constructor móvil de tres pasos y PC de tres columnas, duplicación independiente, series con unidades, preview, publicación, plantillas, archivo y avisos antes de descartar cambios.
- Asignación a varios alumnos y portal `/mi-programa`, con versión, calendario relativo e instrucciones/medios históricos; cancelación con motivo.
- 14 pruebas de integración nuevas y cuatro unitarias aprobadas. Chromium PC/móvil completa el recorrido de ocho semanas/dos alumnos/v2 y revocación. WebKit en curso; no se declara cierre físico ni despliegue.
- Manual, API y ADR escritos; capturas ficticias generadas y en revisión. Backup ampliado para contrastar también conteos de programas/versiones/asignaciones al restaurar.

### 21-10-2026 — T03 implementada y QA local completada

- T03-01/02: cuatro guías globales originales de solo lectura, ejercicios propios con versiones/filtros y equipos con foto, ubicación y estado.
- T03-03/04: recepción binaria privada idempotente, reserva de cuotas, FFmpeg/Sharp en proceso separado, dos slots/una conversión por estudio, leases, reintentos y cancelación que invalida resultados atrasados. Migraciones 003–005 aplicadas.
- T03-05/06: biblioteca coach, editor/preview, Mis guías del alumno, compartición explícita, revocación y streaming GET/HEAD/Range autorizado. Seis capturas con cuentas/material ficticios.
- T03-07: **9 unitarias + 25 integración + 21 navegador = 55 aprobadas**. Tipos/build/lint aprobados. API máxima observada de 77 ms durante dos conversiones sintéticas; no extrapolar a carga real.
- Backend inspirado en reglas de WaFlow v1/Frappe: intención durable, HTTP separado de trabajos, límites, leases y estados honestos. Se mantiene Vue/Fastify/PostgreSQL.
- Backup sincronizado con limpieza y snapshot PostgreSQL. Ensayo de la base local: 132 archivos, conteos/hashes y referencias privadas verificados. Suites DB ahora aisladas; archivos ficticios antiguos recuperados desde sus propios temporales.
- [Manual T03](runbooks/t03-uso-y-operacion.md), [API](runbooks/api-t03.md), [ADR 003](decisiones/003-biblioteca-y-medios.md), tanda, plan visual, arquitectura y recorrido actualizados.
- **Límite abierto:** WebKit Windows omite cookie en vídeo nativo y rechaza el Blob de respaldo. Su test verifica descarga autenticada y texto, no reproducción. Chromium PC/móvil sí carga el clip privado. Safari/iPhone y Android físicos siguen pendientes junto a infraestructura/correo/políticas de T01/T07.
- Próxima entrega funcional: [T04, rutinas versionadas](tandas/04-rutinas.md), conservando esas puertas antes del piloto.

### 21-10-2026 — Inicio T03

- Revisados contratos de medios, cola y endurecimiento de WaFlow v1/Frappe como referencias de backend.
- Decisión: mantener la arquitectura Vue/Fastify/PostgreSQL existente; procesamiento FFmpeg/Sharp en worker separado, estados durables, cuotas reservadas y entrega privada con permisos.
- FFmpeg/FFprobe disponibles en el equipo. Implementación y pruebas en curso; todavía no se declara T03 completada.


### 20-10-2026 — T02 completada en local

- T02-01/03: datos separados por organización, RLS, claves compuestas, roles y selección de estudio implementados.
- T02-02/05/06: registro, confirmación de correo, invitaciones, perfiles, pausa/reactivación, intervalos y límites de planes implementados. Diez pruebas de integración aprobaron la primera ejecución.
- T02-04: interfaz de registro, marca, alumnos, perfil, plan y superadmin conectada; comprobación de tipos aprobada.
- T02-07: QA aprobada: 7 unitarias + 15 API/DB + 18 navegador = 40. Build, tipos, lint y formato aprobados; cinco capturas y pruebas de dos marcas/logos.
- Documentación actualizada: [uso/soporte](runbooks/t02-uso-y-soporte.md), [API](runbooks/api-t02.md), [ADR 002](decisiones/002-organizaciones-y-acceso.md), tanda, arquitectura, negocio y plan visual.
- Correo real, despliegue y dispositivos físicos siguen pendientes. No hay datos de personas reales ni publicación externa. No se cierra T01 por avanzar T02.
- Próxima acción: [T03, ejercicios y medios privados](tandas/03-ejercicios-medios.md).


### 20-10-2026 — Primera implementación de T01

Monorepo npm/Vue/Fastify con Node 24. Panel del coach y vista de alumno, identidad visual editable, temas y ejemplo local de series. PostgreSQL propio en puerto 54329, migración incremental, login/logout/recuperación con sesiones revocables, cola y almacenamiento privado. Pruebas de aislamiento y ensayo de restauración cifrada ejecutados. Las versiones exactas están fijadas en `package-lock.json`.

La siguiente entrega funcional es T02 (organizaciones, alumnos y marca persistida), conservando pendientes de T01 que requieren infraestructura o participación externa. No hay alumnos reales ni despliegue público.

```md
### AAAA-MM-DD — Tanda actual
- Responsables:
- Tickets cerrados/en curso:
- Demo y enlace:
- Pruebas (iPhone/Android/API/DB) y resultados:
- Riesgos/bloqueos:
- Costes/uso medido:
- Decisiones y cambios de alcance:
- Próxima acción:
```



