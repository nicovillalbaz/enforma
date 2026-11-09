# ADR 005 — Sesiones, hechos realizados y sincronización

**Fecha:** 21-10-2026 · **T05 / v0.5.0**. Se conservan Vue/Pinia, Fastify y PostgreSQL. Resultados de QA en [acta T05](../evidencias/t05.md).

## Datos y autoridad

1. `workout_sessions` identifica organización, alumno, cuenta, asignación, versión, semana y día. Guarda una copia inmutable **del día**, nombre del programa/semana, fecha relativa y número de versión. Una restricción única impide preparar dos sesiones del mismo día de una asignación. Preparar un día nuevo admite desde 30 días anteriores hasta siete posteriores a hoy en Asunción; una sesión existente se recupera también después.
2. `workout_sets` preasigna cada serie prescrita. `target` conserva sus objetivos; los campos de realización son independientes y nullable. Cero kg es distinto de carga no indicada. Las métricas admiten repeticiones, segundos o metros; las unidades incompatibles se rechazan.
3. `workout_events` conserva intención, UUID del evento, dispositivo, hora declarada, hora de recepción y recibo. No admite UPDATE/DELETE. Deshacer vacía la realización actual y deja el hecho anterior en este registro. La API no tiene escritura directa sobre estas tablas.
4. `workout_session_media` retiene referencias del día y permite consultar sus medios históricos cuando la sesión está en curso o finalizada. Cancelar la asignación cierra el acceso al programa completo, pero no elimina el día ejecutado. No abre el resto de la biblioteca.
5. RLS verifica organización, identidad activa y alumno propio o gestionado por el profesional. Un alumno pausado/archivado no obtiene datos nuevos; sus intenciones locales quedan retenidas hasta verificar acceso con la misma cuenta.

## Eventos y concurrencia

- Preparar bloquea la asignación. Aplicar un evento toma bloqueo asesor por organización/cuenta/UUID, bloqueo compartido de asignación y bloqueo de sesión. La cancelación y el registro se ordenan en DB. Un UUID reutilizado entre sesiones tampoco crea dos hechos.
- El mismo UUID con idéntico contenido devuelve su recibo original; otro contenido produce `IDEMPOTENCY_CONFLICT`. También se conservan los recibos rechazados: una intención rechazada no empieza a aceptarse por repetirla después.
- Cada serie tiene su revisión. Dos dispositivos pueden guardar series diferentes sin competir por una revisión global; cambiar la misma serie con revisión antigua exige resolver un conflicto. Notas tienen revisión propia. Inicio, cierre y reapertura usan la revisión global de sesión.
- Un recibo rechazado llega con HTTP 200 y `receipt.status=rejected`, además del estado actual autorizado. Errores de autenticación, estructura, permisos o UUID reutilizado usan HTTP 4xx. El cliente debe interpretar ambos niveles.
- Límites: 240 series por día según T04, 2000 eventos por sesión, cuerpo HTTP de 8000 bytes y cola local de 500 intenciones por sesión. Carga 0–1000 kg, repeticiones 1–999, segundos 1–86400, metros 1–100000, esfuerzo 1–10; notas de serie 500 y de sesión 1500 caracteres. Validación previa a coerción en TypeScript y validación independiente en SQL.

## Estados y correcciones

`planned → in_progress → completed`. Iniciar habilita el registro. Finalizar requiere al menos una serie y confirmación si quedan pendientes. El resumen indica las series realizadas frente a las prescritas. La duración es **declarada por el dispositivo**, limitada a 24 horas; no se presenta como una medición de asistencia verificable.

El alumno puede reabrir durante siete días desde el cierre con un motivo de 3–200 caracteres. La corrección queda auditada y mantiene los eventos originales. La duración acumula el tramo anterior y el nuevo, con el mismo límite. El coach consulta resultados; no modifica hechos del alumno en esta tanda.

## Guardado local

1. IndexedDB `forma.workouts.v1` almacena sesiones y cola en una transacción durable antes de reconocer el guardado. La clave incluye cuenta, organización y sesión. Los controles se bloquean durante ese commit. Un fallo de cuota conserva los campos escritos y no manda el evento a la API.
2. El estado mostrado proyecta intenciones pendientes sobre la última base confirmada. La UI diferencia «guardado en este dispositivo» de «confirmado por el servidor». Una serie pendiente puede aparecer realizada localmente; el coach solo ve hechos confirmados.
3. La cola se drena por orden, con un único proceso por sesión/pestaña. Varias pestañas pueden intentar el mismo evento; DB e IDB hacen seguro el recibo repetido. La confirmación elimina solo su UUID y nunca reemplaza una base más reciente. BroadcastChannel notifica cambios entre pestañas.
4. Se verifica `/auth/me` antes de drenar y se revalida todo en servidor. Red/5xx/429 conservan la cola; se reintenta con botón, al volver conexión/visibilidad o cada 15 segundos mientras la pantalla está abierta. No se promete sincronización con la app cerrada. Tras reconectar un contexto offline, Actualizar acceso vuelve a cargar identidad/organización antes de recuperar otras rutas.
5. El primer conflicto detiene la cola. La UI muestra valores de servidor y cambio local; descartar elimina **solo esa intención**. Aplicar el registro crea un UUID nuevo con la revisión actual y requiere confirmación. Los cambios posteriores se conservan; si otro también entra en conflicto se revisa por separado. No hay mezcla ni sobrescritura silenciosa.
6. Cancelar una asignación bloquea escrituras y preparación de nuevos días. Los pendientes se conservan y pueden descargarse en JSON. No se reasignan a otro programa; el soporte/profesional revisa su contenido y decide el seguimiento fuera de esta tanda.
7. Un contexto mínimo de alumno, sin tokens ni credenciales, habilita el arranque offline durante 24 horas desde su preparación. Los permisos se verifican nuevamente al conectar. Un 401/403 no restaura identidad desde caché. Las sesiones confirmadas caducan de la caché tras siete días sin uso; las que tienen pendientes no se borran automáticamente.
8. Cerrar sesión con pendientes exige confirmar el borrado local. Un fallo de logout online conserva los datos y la sesión de UI. Logout offline borra la caché de la cuenta y deja una marca de revocación pendiente; al reconectar se revoca la cookie antes de recuperar identidad o iniciar otra cuenta. El cierre se comunica a otras pestañas.

El almacenamiento del navegador puede ser eliminado por el sistema o por el usuario: antes del piloto deben probarse persistencia y expulsión de datos en dispositivos reales. El JSON de soporte contiene datos privados y debe compartirse solo por un canal acordado. No hay cifrado local con una clave independiente del navegador en T05.

## Shell y diseño

El build genera un service worker que precarga únicamente HTML, JS, CSS y fuentes públicos. Nunca almacena `/v1`, respuestas privadas, medios ni peticiones Range. Al navegar sirve el shell de su versión; las actualizaciones esperan al cierre de las pestañas, sin recarga forzada sobre un formulario. Esta base permite reabrir un entrenamiento preparado sin red; manifiesto instalable, iconos finales, despliegue y aceptación PWA siguen en T07.

Móvil: una columna, selector horizontal de series, objetivo separado de realización, campos de 16 px, teclado numérico/decimal y acciones de al menos 44 px. PC: lista de series lateral y área de ejercicio/descanso/cierre. Timer basado en una fecha límite persistida, recalculado con reloj real al volver a la app; no cuenta ticks ni solicita notificaciones. El zoom accesible permanece habilitado.

## Operación y continuidad

009 añade modelo, funciones y permisos; 010 añade bloqueo de lectura autorizado para que el DTO no mezcle una revisión con series de otra transacción. Migraciones aplicadas, no reescribir sus checksums. El backup añade conteos de sesiones, series y eventos al snapshot compartido y verifica referencias privadas. T06 consumirá estas realizaciones confirmadas para métricas, sin usar la proyección pendiente como progreso oficial.
