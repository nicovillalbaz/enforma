# ADR 004 — Programas, versiones y asignaciones

**Fecha:** 21-10-2026 · **Versión:** 0.4.0. Implementación local de T04; resultados finales en [acta](../evidencias/t04.md). Se mantienen Vue/Pinia, Fastify y PostgreSQL.

## Modelo elegido

- `training_programs`: documento de borrador acotado, revisión optimista, archivo lógico y creador. Plantilla es una propiedad del programa reutilizable, no otra copia del catálogo.
- `program_versions`: snapshot inmutable, número consecutivo por programa y revisión de origen única. Incluye semanas/días, prescripciones e instrucciones, músculo, etiquetas, variantes, nombre/ubicación/estado de equipo e IDs de medios. No almacena rutas de disco ni URLs públicas.
- `program_version_media`: referencias compuestas de versión y medio de la misma organización. Impide eliminar/cancelar medios usados por cualquier publicación, incluso tras cancelar una asignación.
- `program_assignment_batches`: intención de asignación con `requestId`, huella del contenido y actor.
- `program_assignments`: alumno, versión exacta, fechas inclusivas, estado, revisión y motivo de cancelación. Restricción de exclusión PostgreSQL impide periodos activos solapados para un alumno.

El documento JSONB permite guardar y validar un borrador completo en una transacción, incluidos días todavía vacíos. Los límites son 16 semanas, siete días distintos por semana, 20 ejercicios por día, 12 series por ejercicio y 1500 series totales; cuerpo HTTP hasta 240 000 bytes y borrador DB hasta 220 000 bytes de su representación. El snapshot publicado admite hasta 2 000 000 bytes para repetir instrucciones completas por semana sin truncarlas. No crear tablas de ejecuciones vacías: T05 añadirá hechos realizados vinculados a estos IDs y a una versión exacta.

## Guardado, preview y publicación

1. Validación de schema HTTP, reglas compartidas TypeScript y guardas de estructura/unidades en PostgreSQL. IDs únicos dentro del documento; valores numéricos finitos y límites explícitos. El borrador puede estar incompleto; publicar exige al menos un día con ejercicios en cada semana y objetivos de serie compatibles con la métrica.

   La validación previa a coerción conserva `null` en carga/esfuerzo no prescritos y rechaza descanso nulo. El schema nullable numérico evita convertir una carga vacía en 0 kg. Las pruebas comprueban estos valores al publicar.
2. Guardado con revisión: `UPDATE ... WHERE revision=esperada`. Dos editores no se sobrescriben silenciosamente. Guardado explícito; el indicador distingue cambios sin guardar de confirmación del servidor. No hay autosave/offline de borradores en T04.
3. Preview resuelve la biblioteca actual, con permisos, sin insertar una versión ni guardar cambios. Publicar vuelve a leer y bloquear las referencias válidas; una preview anterior no constituye publicación.
4. Publicación bloquea el programa y comprueba revisión. Una segunda solicitud de la misma revisión recupera su versión existente. Nunca crea dos números para la misma revisión.
5. El snapshot se construye en DB desde ejercicios/equipos autorizados, no desde texto histórico enviado por el cliente. Un medio asociado debe estar listo. Una guía sin medio es válida y conserva instrucciones de texto.
6. Triggers impiden UPDATE/DELETE de versiones y sus referencias, incluso desde una sesión administrativa ordinaria. El rol API no tiene INSERT directo de versiones ni escritura directa de asignaciones; llama funciones acotadas.

Modificar biblioteca o borrador y publicar v2 no cambia v1 ni sus asignaciones. Copiar una versión recupera estructura y objetivos como borrador nuevo; al volver a publicar se resuelven los ejercicios de la biblioteca actual. No promete reponer una máquina borrada o convertir instrucciones históricas en una guía nueva.

## Fechas y asignación

Los días 1–7 son posiciones relativas al inicio de cada semana del programa, no nombres fijos lunes–domingo. Semana 1/día 1 ocurre en `startsOn`; semana N/día D en `startsOn + (N−1)*7 + D−1`. Cada semana dura siete días; los huecos son descanso. El orden visual de los días y el campo de día del ciclo son explícitos. Las fechas se devuelven como `YYYY-MM-DD`; no se convierten desde medianoche a la zona del navegador.

Se asigna de una vez a 1–100 alumnos activos gestionables por el coach, con cuenta aceptada, versión del estudio y suscripción/trial vigente. La fecha inicial admite hasta 90 días pasados o 366 futuros respecto a `America/Asuncion`. La fecha final se calcula desde el número de semanas; no la decide el cliente.

La transacción bloquea la organización y valida todo el lote antes de confirmar. El mismo `requestId` con alumnos ordenados de otra manera devuelve las asignaciones originales; distinto contenido produce conflicto. Un alumno inválido o un solapamiento revierte el lote completo. Para cambiar un plan ya asignado se cancela con motivo y se crea una nueva asignación; no se cambia su versión en el sitio.

## Permisos y medios históricos

RLS separa borradores, versiones, referencias y asignaciones. Staff gestiona la biblioteca de programas del estudio; owner gestiona sus alumnos y un coach profesional solo los que tiene asignados. El alumno activo consulta exclusivamente versiones asociadas a sus asignaciones activas. Esto no abre borradores, otras versiones o toda la biblioteca privada.

Los medios del snapshot se autorizan por esa asignación además del permiso de guía de T03. Cancelar la asignación impide nuevas lecturas de versión/medio, salvo que exista otro permiso legítimo independiente. Los bytes y textos ya descargados no se pueden retirar remotamente.

El inventario `app.media_storage_references()` incluye referencias de versiones. El trigger de medios y las claves compuestas impiden que un original/derivado publicado entre en limpieza. Las referencias de publicaciones canceladas o archivadas se conservan; su coste sigue contando en el cupo. Antes del piloto debe cerrarse una política de retención y borrado compatible con historial y privacidad. No añadir una limpieza que rompa rutinas históricas.

El backup sigue usando el snapshot compartido con el dump y añade conteos de programas/versiones/asignaciones. La restauración verifica estos conteos si constan en el manifiesto y conserva compatibilidad con copias anteriores; comprueba también hashes y referencias privadas.

## Interfaz móvil y PC

Móvil: tres pasos accesibles (estructura, ejercicios, revisar), tarjetas de series, campos de 16 px, objetivos con unidades y barra de guardar/publicar. PC ancho: estructura, editor de día y revisión en tres columnas; tamaños intermedios mantienen los pasos. Se puede ordenar y duplicar con botones, sin arrastrar obligatoriamente.

El alumno ve semana/día/fecha, ejercicio, equipo, instrucciones, medio y series objetivo. Se identifica como planificado; no se inventan sesiones completadas, progreso ni guardados de series de T05. El reproductor conserva el fallback de T03 y su limitación de WebKit Windows.

## Migraciones y continuidad

006 crea programas/versiones/asignaciones, permisos, publicación y retención de medios. 007 refuerza validación de documentos/unidades en DB; 008 separa la cota del snapshot histórico de la del borrador. Aplicadas en local; no editarlas después de su checksum. La siguiente migración comienza en 009.

T05 debe referenciar asignación, versión, semana/día/ejercicio/serie y conservar prescripción frente a hechos realizados. Añadirá idempotencia de eventos, registro local y sincronización, sin modificar estas publicaciones.
