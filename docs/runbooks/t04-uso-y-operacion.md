# T04 — Uso y operación de rutinas

**Versión 0.4.0 · 21-10-2026.** [Decisiones](../decisiones/004-rutinas-versionadas.md) · [API](api-t04.md) · [Pruebas y capturas](../evidencias/t04.md). Solo local; se conservan pendientes de infraestructura, correo, políticas y teléfonos físicos.

## 1. Preparar

1. Arrancar el proyecto siguiendo [desarrollo](desarrollo.md), PostgreSQL y servicios locales de API/web/medios.
2. Ejecutar `npm run db:migrate`: aplica 006–008 sin cambiar migraciones previas. No ejecutar el SQL conceptual original.
3. Entrar con la cuenta ficticia del coach y elegir su estudio. Abrir **Rutinas** (`/rutinas`). La demostración `/demo` continúa separada de datos reales de PostgreSQL.
4. Preparar ejercicios y equipo en **Ejercicios** siguiendo [T03](t03-uso-y-operacion.md). Los medios deben llegar a **Listo** para publicarlos en una rutina. No hace falta vídeo para publicar un ejercicio con instrucciones.
5. Crear alumnos, verificar el correo del coach, invitarlos y aceptar desde sus cuentas. Para asignar deben figurar activos y ser gestionables por ese profesional.

## 2. Crear el borrador

1. Pulsar **Nuevo programa**. Escribir nombre y objetivo/descripción; marcar **Guardar como plantilla reutilizable** si se volverá a usar.
2. En móvil se muestran tres pasos; PC ancho permite verlos en columnas. **Estructura** contiene nombre, semanas, duplicar, subir/bajar y eliminar semana.
3. En **Ejercicios**, elegir semana/día. Completar nombre de semana, nombre del día, posición 1–7 del ciclo e indicaciones. No repetir posición en la misma semana.
4. Añadir o duplicar días. Día 1 es la fecha inicial de la asignación; los días sin entrenamiento son descanso. Revisar el campo del ciclo al ordenar tarjetas: determina su fecha, independientemente de su orden visual.
5. **Añadir ejercicio** abre una búsqueda de biblioteca global/propia. Seleccionar uno y completar sus series. Consultar o cargar más resultados cuando sea necesario.
6. Repeticiones: mínimo/máximo. Tiempo: segundos. Distancia: metros. Carga en kg opcional, descanso en segundos y esfuerzo 1–10 opcional. Carga vacía significa que el coach no fijó un peso, no 0 kg.
7. Añadir/quitar series y notas; mover/eliminar ejercicios con botones. Cambiar de ejercicio conserva los valores del borrador.
8. Guardar con **Guardar borrador**. Esperar el indicador de revisión guardada. Se puede guardar un día todavía vacío; no se puede publicar así.
9. Para ocho semanas, preparar una semana válida y duplicarla siete veces. Las copias tienen IDs y series independientes: editar una no cambia las demás.

Límites: 1–16 semanas, hasta siete días, 20 ejercicios/día, 12 series/ejercicio y 1500 series totales. Borrador DB ≤220 000 bytes y snapshot publicado ≤2 000 000 para conservar instrucciones repetidas sin truncarlas. No hay guardado local offline de borradores en esta tanda. Salir, cambiar de estudio o cerrar sesión con cambios pendientes solicita confirmación; una recarga usa el aviso nativo del navegador.

## 3. Revisar y publicar

1. En **Revisar**, abrir **Vista previa alumno**. Recorre semana/día, instrucciones, material, medio y series objetivo. La preview usa biblioteca actual y no guarda ni publica cambios.
2. Corregir los problemas mostrados: objetivos que faltan, días vacíos, referencias archivadas o medios todavía procesándose.
3. Pulsar **Publicar versión**. Primero guarda los cambios pendientes; después publica esa revisión. El éxito indica un número de versión concreto.
4. Volver a programas y abrir **Versiones y asignar**. Elegir la versión exacta y **Consultar versión** para leer su snapshot. Cargar versiones anteriores si hay más de una página.
5. Editar el borrador y publicar de nuevo crea v2. Los alumnos con v1 conservan sus valores. Una edición posterior de las instrucciones o del equipo en la biblioteca tampoco cambia v1.
6. **Duplicar programa** copia el borrador. **Usar versión como borrador** parte de objetivos/estructura publicados y crea otro programa; la nueva publicación toma los ejercicios actuales de la biblioteca.
7. Archivar oculta un programa de la lista principal y bloquea su edición hasta restaurarlo. Las versiones/asignaciones existentes y sus medios permanecen disponibles según sus permisos.

Si la conexión se corta al publicar, volver a consultar las versiones antes de asumir un fallo. Repetir la publicación de la misma revisión devuelve su versión existente.

## 4. Asignar a uno o varios alumnos

1. Abrir **Versiones y asignar** desde la tarjeta del programa.
2. Seleccionar versión y fecha inicial. Cada semana tiene siete días desde esa fecha; la fecha final se calcula automáticamente.
3. Marcar alumnos activos. **Cargar más alumnos** continúa la lista. Se admiten hasta 100 por petición.
4. Pulsar **Asignar versión a N alumno(s)** y esperar confirmación. Comprobar las tarjetas de **Asignaciones**: alumno, nombre, versión, inicio y fin.
5. No se permite que un alumno tenga dos programas con periodos activos solapados. Elegir otro periodo o cancelar el anterior con un motivo; no se sustituye silenciosamente.
6. Si uno de los alumnos del lote no es válido o hay solapamiento, ninguna asignación de ese lote se confirma. Corregir y volver a enviar.
7. El formulario conserva el identificador de solicitud mientras el contenido no cambia para poder reconciliar una respuesta perdida sin duplicar asignaciones.

Los periodos incluyen inicio/fin. Una asignación de ocho semanas termina 55 días después de su inicio. Se puede iniciar hasta 90 días atrás o 366 días adelante. Trial/suscripción vencida impide nuevas asignaciones, aunque permita preparar un borrador.

## 5. Comprobar como alumno

1. Acceder en otra sesión con una cuenta de alumno invitada/activa. El inicio muestra un acceso a su programa; **Mi plan** abre `/mi-programa`.
2. Abrir **Consultar programa**. Elegir semana y día; comprobar las fechas, equipo y objetivos.
3. Leer las instrucciones y usar **Ver medio y guía** cuando exista. El medio es privado; se aplican permisos de la asignación y el fallback de T03.
4. La pantalla muestra **Planificado** y **Series objetivo**. El registro de series realizadas, temporizador, offline y sincronización llegan en T05.
5. Después de publicar v2, recargar el portal y comprobar que una asignación v1 sigue mostrando su versión y objetivos anteriores.
6. Cancelar la asignación desde el coach y recargar: no debe aparecer como disponible. Otra cuenta o alumno no asignado tampoco puede abrir su versión o medio por URL.

## 6. Cancelar o cambiar un plan

1. En **Asignaciones**, localizar alumno/versión/fechas.
2. Pulsar **Cancelar asignación**, escribir motivo (3–200 caracteres) y confirmar.
3. Se conserva el historial para el coach y se retira la autorización derivada de esa asignación. Otro permiso legítimo al mismo medio puede seguir permitiendo su descarga.
4. Crear una asignación nueva si corresponde. No se cambian versión/fechas del registro histórico.
5. Una versión publicada y sus referencias son inmutables. Un medio utilizado por ella no se puede eliminar aunque ya no esté en la biblioteca o se hayan cancelado alumnos. Revisar retención antes del piloto; no borrar filas manualmente para liberar cupo.

## 7. Errores y soporte

| Caso | Acción |
|---|---|
| Borrador desactualizado | Mantener a salvo las indicaciones necesarias y volver a abrir la revisión del servidor; no sobrescribir otra sesión |
| Día vacío/objetivo inválido | Completar cada semana/día/serie y revisar métrica/unidades |
| Ejercicio archivado/no disponible | Elegir otro ejercicio válido antes de publicar |
| Medio no listo | Revisar cola/worker de T03 y esperar o retirar su asociación |
| Periodo solapado | Revisar asignaciones existentes; cancelar con motivo o elegir otra fecha |
| Alumno no seleccionable | Revisar aceptación, estado activo, profesional asignado y paginación |
| Fallo de red con resultado incierto | Consultar borrador/versiones/asignaciones antes de repetir; la API conserva idempotencia de publicación/asignación |
| Medio usado por una versión | Conservarlo; es una dependencia histórica protegida y cuenta en cupo |

No hay migración de vuelta que borre versiones. Backups y restauración incluyen tablas nuevas y referencias de medios. Seguir [operación](operacion.md) y probar siempre en base/carpeta nuevas.

## 8. Repetir evidencia

1. Ejecutar lint/build, unitarias, integración y navegador con los comandos de desarrollo. Bases de integración aisladas; cuentas de navegador ficticias.
2. Ejecutar `node --import tsx scripts/capture-t04.mjs` con Node 24 y la app local para regenerar las capturas. El script restringe la escritura al estudio del seed y reutiliza material técnico de T03.
3. Verificar en 320/390/768/1280–1440 px: pasos/columnas, campos, teclado, selector de semanas, series, diálogo de asignación y ausencia de scroll horizontal del documento. La tira de días tiene desplazamiento propio.
4. Conservar las puertas pendientes: iPhone/Android físicos, teclado/safe areas, 200 % texto/zoom real, PWA/offline T05/T07, SMTP, VPS/TLS, backup externo, entrevistas y políticas.
