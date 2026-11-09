# Ideas de GitHub aplicables a Forma · 09-11-2026

## Criterio

Revisión selectiva de repositorios públicos e issues relacionados con entrenamiento, alimentación, PWA y autohospedaje. No representa todos los proyectos de GitHub. Un issue describe un problema reportado en otro producto: sirve para diseñar una comprobación en Forma, no demuestra que Forma tenga el mismo fallo. Ningún código, base de ejercicios ni medio externo se incorporó en esta revisión.

Forma sigue dirigida a **coaches independientes** y sus alumnos. La interfaz prioriza móvil, acciones cortas, navegación con vuelta y datos definidos por el coach; no añade equipos multicoach, pagos dentro de la app, IA ni tablas sociales.

## Referencias y decisión

| Proyecto / evidencia | Idea útil | Estado en Forma y decisión |
| --- | --- | --- |
| [ScopeStrength](https://github.com/Ebrahimgreat/scopestrength) | Ficha y notas fechadas por alumno, programa asignado, historial de fuerza y reglas de progresión aisladas del transporte web. | Forma ya separa lógica de entrenamiento en `packages/shared`, conserva versiones y permite ver historial. Para una futura progresión, ofrecer solo una señal revisable por el coach, no cambiar la carga prescrita automáticamente. Su registro izquierda/derecha sugiere una extensión opcional para ejercicios unilaterales. |
| [Gyme](https://github.com/Rastin-Amani/Gyme) | App de marca blanca con una vista «Hoy» que presenta el tramo actual del plan y una acción clara. | Forma ya genera manifest e icono por estudio y el alumno tiene «Hoy». Mantener una tarea principal por pantalla. Un dominio por coach se puede estudiar después del piloto; añadiría configuración DNS y TLS por cliente. No adoptar su modelo multicoach. |
| [OpenPersonalTraining](https://github.com/clawnify/OpenPersonalTraining) | Ficha compacta del alumno y constructor que parte de ejercicios buscables; su enlace público revocable muestra una forma de compartir. | Aprovechar la cercanía entre ficha, rutina y catálogo. Mantener planes y datos corporales detrás del acceso del alumno; un enlace público con contenido privado sería una decisión de privacidad aparte. Su calendario y pagos internos no entran en el alcance actual. |
| [OpenExerciseDB](https://github.com/rfivesix/OpenExerciseDB) | Separar zona muscular, material principal, montaje, tipo de movimiento y forma de registrar; conservar ID y alias al fusionar ejercicios. | `exercises` guarda hoy `muscle`, `equipment_tag` y `metric`, con etiquetas libres. Proponer campos opcionales y un vocabulario interno para filtrar sin impedir ejercicios propios. No importar el catálogo de forma automática: los datos tienen licencia y atribución propias. |
| [wger](https://github.com/wger-project/wger) y su [interfaz React](https://github.com/wger-project/react) | Biblioteca, rutina, alimentación y medidas conectadas. [Teclado numérico móvil](https://github.com/wger-project/wger/issues/2409), [confirmación visible de guardado](https://github.com/wger-project/react/issues/1114) y [miniaturas para búsqueda](https://github.com/wger-project/react/issues/1250). | Forma ya usa `inputmode` en series y muestra guardado del editor. Mantenerlo y verificarlo en teléfono. Para pictogramas SVG actuales no hace falta otra miniatura; aplicarlo solo si más adelante se muestran fotos pesadas. |
| [Workout.cool](https://github.com/Snouzy/workout-cool) | Los issues sobre [orden de columnas](https://github.com/Snouzy/workout-cool/issues/224), [series por tiempo](https://github.com/Snouzy/workout-cool/issues/222), [kg/lb](https://github.com/Snouzy/workout-cool/issues/226), [finalización parcial](https://github.com/Snouzy/workout-cool/issues/212) y [semana fantasma](https://github.com/Snouzy/workout-cool/issues/232) señalan invariantes de datos que merecen casos dirigidos. | Forma almacena series por campos nombrados y peso en kg, por lo que no debe copiar el modelo de columnas dinámicas. Probar las transiciones reales de Forma: serie registrada/no registrada, tiempo, cierre parcial y asignaciones fuera de orden. |
| [Workout.cool: escritura entre usuarios](https://github.com/Snouzy/workout-cool/issues/240) y [borrado ajeno](https://github.com/Snouzy/workout-cool/issues/238) | Derivar actor y organización de la sesión del servidor; verificar propiedad en cada mutación, incluidos borrados y sincronización. | Forma ya usa `context(request, organizationId)` y políticas RLS. Antes del piloto, ejecutar casos puntuales con dos alumnos y dos coaches: IDs ajenos en URL y cuerpo deben rechazarse sin revelar datos. No se ha encontrado aquí una vulnerabilidad equivalente. |
| [Forge](https://github.com/bndct-devops/forge) | Reutilizar una sesión anterior o aceptar con un toque la última carga/repeticiones reduce escritura durante el entrenamiento; el descanso persiste al recargar. | Forma ya tiene descanso y cola local. Probar una sugerencia discreta de la última serie confirmada, siempre editable y subordinada a lo prescrito por el coach. No trasladar su panel de estadísticas ni sus objetivos automáticos. |
| [Open Food Facts: API](https://github.com/openfoodfacts/openfoodfacts-server/blob/main/docs/api/index.md) y [campos de datos](https://github.com/openfoodfacts/openfoodfacts-server/blob/main/html/data-fields.txt) | Distinguir porción declarada, gramos normalizados y valores ausentes; la API pública limita búsquedas y desaconseja usarla para autocompletar cada tecla. | Forma ya guarda fuente, gramos y porciones y permite valores desconocidos. Si se incorpora consulta de productos envasados, hacerla a petición del coach, con caché y revisión humana; no usar un alimento externo para prescribir un plan automáticamente. |
| [wger Flutter: rechazo 403 al sincronizar](https://github.com/wger-project/flutter/issues/1353) | Una sesión expirada puede hacer que una cola móvil falle aunque haya conexión. | Mostrar claramente «pendiente de enviar», recuperar sesión y reintentar sin duplicar ni borrar eventos confirmados. Validar un caso con token expirado durante entrenamiento offline; no afirmar todavía que ese flujo esté cubierto en Forma. |

## Orden de trabajo propuesto

### 1. Puerta de seguridad y consistencia para el piloto

1. Preparar dos coaches y dos alumnos ficticios en organizaciones distintas, sin publicar sus accesos.
2. Intentar leer, registrar, modificar o deshacer una serie ajena con IDs conocidos. El servidor debe responder sin dato ajeno y el registro original debe conservarse. Si se añade borrado de sesiones, aplicarle la misma comprobación antes de habilitarlo.
3. Completar una sesión con una serie registrada y otra pendiente; verificar que historial y progreso cuentan solo lo realmente registrado. Reabrir y repetir sin duplicar volumen.
4. Registrar una serie por tiempo de más de un minuto y comprobar segundos y resumen. Mantener kg como unidad de almacenamiento; si se añade lb, convertir al guardar y mostrar la unidad elegida.
5. Probar una sesión fuera de secuencia dentro de la asignación y confirmar que la siguiente semana visible existe.

**Aceptación:** cinco recorridos dirigidos, sin suite completa ni build repetido, y una evidencia breve por resultado. Estas son comprobaciones propuestas; no están aprobadas aún.

### 2. Catálogo más útil sin formulario pesado

1. Añadir clasificación opcional: zona principal, zonas secundarias, material de carga, elementos de apoyo y forma de registrar (`reps`, `time`, `distance`). No autoseleccionar zonas que el coach no confirme.
2. Conservar nombre e instrucciones libres y los IDs históricos. Las etiquetas propias del coach siguen disponibles; los filtros estructurados se ofrecen como ayuda, no como límite.
3. Migrar los ejercicios base con revisión humana de las zonas y materiales. Los ejercicios propios existentes quedan válidos aunque no tengan los campos nuevos.
4. Si dos entradas se unifican, crear un alias que apunte al ejercicio vigente; nunca reescribir ni borrar referencias de rutinas y sesiones anteriores.
5. En móvil, mostrar pictograma, nombre y dos datos útiles; abrir el detalle solo al tocar. Filtrar por zona, material y búsqueda sin desplegables precargados de objetivos inventados.

**Aceptación:** buscar «pecho + barra» encuentra press de banca, un ejercicio propio sin clasificación sigue visible y una rutina antigua conserva su referencia.

### 3. Entrenamiento con menos toques

1. En la serie activa, mostrar la última serie confirmada del mismo alumno y ejercicio como sugerencia compacta, con acción «Usar»; nunca sobreescribir el objetivo del coach.
2. Mantener teclado numérico y foco estable al pasar de carga a repeticiones y a la siguiente serie.
3. Mostrar estado de guardado o envío en la misma fila. Si se pierde conexión, conservar la entrada editable y distinguirla de una serie confirmada.
4. Usar el descanso existente sin pantalla adicional y respetar la navegación de vuelta al paso anterior.

**Aceptación:** el alumno registra dos series a 320 px sin cerrar popups ni repetir todos los valores; una entrada pendiente nunca aparece como confirmada.

### 4. Alimentación con fuente verificable

1. Mantener nombres comunes como punto de partida, sin macronutrientes supuestos.
2. En producto o receta, separar peso real en g/ml, porción elegida y fuente de cada valor nutricional. El cálculo de receta usa solo ingredientes con datos suficientes y avisa cuando faltan.
3. Una futura búsqueda externa se inicia con una acción explícita. Guardar selección local del coach y revisar cambios de fuente antes de afectar menús ya asignados.

**Aceptación:** cambiar la porción no cambia el dato original por 100 g y un ingrediente sin valores no aparece como cero conocido.

## Diseño y arquitectura

- Mantener Vue, Fastify y PostgreSQL: las referencias aportan patrones de dominio y UX, no justifican reemplazar el stack.
- La portada del coach lleva a alumnos, rutinas, ejercicios y dieta; el alumno comienza por «Hoy». Las pantallas de creación son páginas con regreso claro, acciones visibles y mensajes breves.
- Usar una única superficie por vista y filas densas para listas; mostrar detalle solo cuando el usuario lo pide. Los iconos identifican una acción o categoría y nunca sustituyen solos el nombre accesible.
- Conservar versiones publicadas y asignaciones históricas; cambios de catálogo o alimentación no alteran lo ya entregado al alumno.
- Cualquier catálogo o medio de terceros requiere revisar su licencia, procedencia y mantenimiento antes de incluirlo. Se pueden adoptar ideas de estructura sin copiar contenido.

## No priorizar ahora

IA, recomendaciones automáticas de entrenamiento o dieta, rankings, insignias, chat, integración de relojes, vídeo externo masivo y nuevos servicios de pago. Aumentan superficie y costo antes de validar los flujos centrales con coaches reales.
