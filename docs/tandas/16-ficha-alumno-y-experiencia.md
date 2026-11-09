# T16 — Ficha del alumno como centro de trabajo

**Continuación 26-10-2026 · catálogo alimentario:** 80 nombres comunes editables por coach y 22 ejemplos de platos para empezar recetas, sin valores ni cantidades inventadas. El coach cambia ingredientes y gramos, y las fichas sin fuente mantienen los totales desconocidos. [Implementación, verificación y límite de 200 fichas](../evidencias/alimentos-comunes-2026-10-26.md). Esta ampliación no implica prescripción nutricional ni aceptación física.

**Actualización 26-10-2026:** el usuario rechazó los esquemas animados. La animación se retiró y las fichas muestran dos pictogramas estáticos con una línea común; [acta y galería](../evidencias/pictogramas-estaticos-2026-10-26.md). La descripción de esquemas animados en el corte histórico inferior ya no refleja la interfaz vigente.

**Revisión del usuario, 24-10-2026:** T16 no está aceptada como experiencia final. La prueba detectó 401 de arranque público, 403 al entrar a Dieta desde una invitación pendiente, controles desalineados y mediciones demasiado básicas. Los defectos inmediatos y el plan científico/visual se registran en [T17](17-antropometria-y-densidad-visual.md) y su [primer corte](../evidencias/t17-primer-corte.md). Las afirmaciones de entrega siguientes describen el alcance técnico anterior a esta revisión, no la aceptación del diseño ni la antropometría.

**24-10-2026 · Desarrollo local listo para revisión del usuario:** [catálogo y acta final local](../evidencias/t16-catalogo-y-prueba.md). Se añadieron 52 entradas a las cuatro iniciales y 14 esquemas originales a los once existentes; la demo está activa solo en este PC. Los flujos visibles de coach/alumno y el reflujo dirigido pasaron. La aceptación de uso, descargas reales y dispositivos físicos permanece abierta. Las notas de segundo corte que siguen conservan su momento histórico.

**24-10-2026 · Estado: en curso, segundo corte local hasta T16-09; T16-06 y T16-10 siguen abiertos, sin aceptación física ni piloto.** [Código, pruebas y límites del segundo corte](../evidencias/t16-segundo-corte.md). Sustituye la dirección visual de T15 tras las capturas y el rechazo del usuario. T15 conserva su evidencia técnica histórica; sus menús, símbolos y escala no son criterios de aceptación. Alcance: coaches independientes, alumno y administrador ya existentes; pagos mensuales marcados manualmente. No hay pasarela de pagos ni gimnasio multicoach.

## 1. Decisión de producto

**Usuario:** coach independiente que prepara y actualiza entrenamiento y alimentación; alumno que consulta, ejecuta y descarga su información en el teléfono. **Problema observado:** menú «Más», ficha sin acciones centrales, retornos perdidos, perfil del coach vacío, formularios dispersos, símbolos poco útiles, controles desalineados y mucho texto decorativo. **Alternativa actual:** navegar entre módulos, redactar planes fuera de la app y buscar archivos por separado. **Resultado esperado:** desde una ficha, crear o asignar plan, registrar medición, revisar historial y exportar por fechas; el alumno ve la misma información ordenada. **Coste de soporte:** migración aditiva y coexistencia de versiones, revisión de derechos de medios, privacidad, PDFs/XLSX y ensayos físicos de navegación. **Criterio de parada:** no sumar módulos ni importaciones masivas si el flujo alumno → plan → publicación → consulta → vuelta no funciona en móvil real con datos sintéticos y sin pérdida histórica.

### Inventario honesto antes de programar

| Ya existe en local | Falta o requiere revisión T16 |
|---|---|
| Programas versionados, días/ejercicios, asignaciones y portal de entrenamiento | Entrar y crear/asignar desde la ficha; periodicidad diaria/semanal/mensual comprensible; borrador libre y regreso contextual |
| Mediciones fechadas, tendencia e historial; acceso privado | Vista unificada en ficha, edición como corrección auditable, peso/altura y demás datos sin sobrescribir valores antiguos |
| Alimentos, recetas, menús semanales, asignaciones, diario y PDF alimentario | Coach como autor por defecto, sin selector de profesional; porciones/platos/franjas/días/meses manejables desde ficha y Alimentación |
| Worker y documentos PDF privados T08 | Acciones directas por tipo y rango desde ficha, identidad/alcance del documento, descarga del alumno; XLSX nuevo |
| Biblioteca de ejercicios y creación propia; 11 SVG genéricos | Catálogo de referencia con licencia revisada por cada imagen, cobertura útil y símbolos específicos consistentes |
| Ruta de perfil para alumno | Perfil completo del coach; firma NAVZ colocada con criterio; menú directo; retorno contextual |

## 2. Estructura de navegación

**Coach, escritorio:** Inicio · Alumnos · Ejercicios · Rutinas · Alimentación; avatar visible → Mi perfil, Mi marca y Mi mensualidad. **Móvil:** cinco destinos directos en barra inferior (icono reconocible + etiqueta breve) y avatar fijo en cabecera para cuenta. Si 320 px no permite cinco sin comprimir texto o objetivos táctiles, usar una banda horizontal desplazable con indicador visible de que hay más destinos, nunca un menú llamado «Más» ni destinos escondidos; validar en teléfono antes de cerrar. Progreso, historial y seguimiento viven dentro de la ficha de cada alumno. La vista de administración mantiene sus opciones propias.

**Alumno:** Hoy · Entrenar · Alimentación · Mi historial; avatar → Mi perfil. «Hoy» resume plan vigente, comidas y próximos pasos sin bloques promocionales. Mi historial incluye progreso, mediciones y descargas propias. Las acciones de revisión del coach nunca aparecen en el portal del alumno.

Ocultar del menú principal y del inicio de ambos roles: Chat, Recursos/PDF, Subir media, Agenda. Conservar código, registros, ACL y enlaces a documentos ya emitidos mientras se decide su destino; las rutas antiguas deberán redirigir a su contexto equivalente o mostrar un estado claro, sin acceso inadvertido a datos privados. La agenda servía para reservas, asistencia y recordatorios; queda fuera del flujo de entrenamiento actual. No quitar consentimiento o controles de privacidad del diario, fotos y mediciones por ocultar módulos.

```text
Coach: Alumnos → Ficha de Ana
                    ├ Resumen y acceso mensual
                    ├ Entrenamiento → Crear/Asignar → Revisar → Publicar
                    ├ Alimentación → Crear/Asignar → Revisar → Publicar
                    ├ Mediciones → Añadir / Corregir con motivo
                    ├ Historial y progreso → detalle fechado
                    └ Exportar → tipo + desde/hasta → PDF/XLSX privado

Alumno: Hoy → plan vigente → detalle/registro → volver a Hoy
        Mi historial → fecha/actividad/mediciones/documentos → volver a Mi historial
```

### Regla de regreso

Cada pantalla hija guarda **un padre inmediato concreto** (ruta interna permitida, ID de alumno, filtro, fecha y posición de lista). La flecha propia y el retroceso del navegador vuelven **solo a ese padre**; al regresar desde un detalle se conserva el estado útil. Un enlace directo sin origen usa un padre determinista: detalle de alumno → ficha, ficha → Alumnos; jamás usa una pila de otros módulos ni una URL arbitraria externa. Evitar ciclos entre `router.back()` y rutas de fallback. Borradores sin guardar: aviso dentro de la página con acciones Guardar/Descartar/Seguir, sin modal. Deben probarse secuencias Alumnos → ficha → historial → ficha, ficha → rutina → ficha, Alimentación → receta → Alimentación y entrada directa → padre esperado.

## 3. Ficha única del alumno

Cabecera compacta: nombre, estado de acceso de este mes, última actualización y acciones principales. Secciones con URL propia y retorno claro: **Resumen, Entrenamiento, Alimentación, Mediciones, Historial, Exportar**. En móvil una sección visible por vez; en PC se gana anchura, no se multiplica la navegación ni aparecen paneles con scroll interno. Un CTA primario por sección, secundarios como acciones cortas con texto accesible.

- **Entrenamiento:** desde la ficha, escoger rutina existente o «Crear para este alumno». Elegir día, semana o mes como período de aplicación, no como plantilla impuesta. Escribir instrucciones libres y añadir ejercicios/series opcionales. Vista previa idéntica a la del alumno. Guardar borrador, publicar versión y asignar con vigencia/fecha efectiva. Mostrar asignación actual y anteriores. Nueva versión no altera sesiones ejecutadas ni documentos emitidos.
- **Alimentación:** crear desde ficha o catálogo central, con la misma entidad y permisos. Texto libre primero; opcionalmente alimentos, porciones, recetas, platos, comidas y franjas (desayuno, almuerzo, merienda, cena o nombre propio del coach). Días/semanas/meses y vigencia explícitos. No sugerir cantidades o macros inventados. El coach es autor y responsable de lo que escribe; eliminar pregunta de «profesional de alimentación» de alta/editor. Mantener permisos privados de fotos/diario y atribución de datos de alimentos.
- **Mediciones y ficha personal:** peso, altura y tipos medibles ya soportados se muestran fechados, con unidad, autor y fuente. Una actualización agrega un registro; la corrección preserva original, responsable, fecha y motivo, o marca el dato anterior como anulado con trazabilidad. Si altura u otro dato no existe en el modelo actual, añadirlo sin reescribir los anteriores. Mostrar «último» como derivación, no reemplazo. Distinguir fecha medida de fecha cargada y usar zona del estudio.
- **Historial/progreso:** línea de tiempo filtrable por fecha y tipo (planes asignados/versiones, entrenamientos realizados, mediciones, dieta, documentos); detalle con retorno inmediato a ficha. Acceso del alumno limitado a lo suyo y a lo publicado/compartido.
- **Exportar:** tipo (entrenamiento, alimentación, mediciones/progreso o paquete), rango inclusivo, vista previa breve de lo incluido, formato PDF o XLSX cuando los datos son tabulares. Aclarar vacío y alcance antes de generar; estado del trabajo y descarga desde el mismo lugar. Alumno descarga únicamente sus documentos autorizados desde su historial.

## 4. Bibliotecas y editor

**Ejercicios.** Al abrir, mostrar catálogo de referencia legalmente aprobado y ejercicios propios; búsqueda por nombre/sinónimos y filtros de movimiento/equipo solo si el dato está verificado. Cada tarjeta: nombre, imagen/animación de referencia, equipo y señal visual específica; detalle con fuente/autor/licencia y advertencia clara cuando falta medio. «Crear ejercicio» acepta nombre libre, instrucciones y medio propio autorizado, también desde el editor de rutina, y retorna al borrador con el ejercicio seleccionado. Un catálogo finito no cubre literalmente todas las variantes: incorporar flujo de alta, edición y solicitud de huecos. No presentar dibujos o GIF como validación técnica del movimiento.

**Rutinas.** Lista con activos/archivados, búsqueda y crear. Edición por día/semana/mes + texto libre/ejercicios opcionales, sin formulario enorme ni número de series impuesto. Publicar crea versión inmutable. Archivar retira de selección futura pero conserva asignaciones e historial. «Eliminar» solo para borradores nunca publicados/asignados, con revisión y permisos; lo demás se archiva. Resolver si una rutina ya asignada puede recibir nueva versión sin reasignación implícita: por defecto no. Crear ejercicio dentro del paso actual sin perder borrador.

**Alimentación.** Secciones Alimentos y porciones · Recetas/platos · Planes/menús. Crear desde aquí o desde el alumno abre el mismo editor con distinto destino al guardar. Valores nutricionales opcionales y con fuente/porción/unidad; no inferir kcal/macros si faltan. Permitir nombres de comidas propios y notas extensas. Publicación/versionado/asignación como en rutinas.

## 5. Simbología y derechos

**Entrega local 24-10-2026:** se eligió la vía de dibujos originales en vez de importar medios ajenos. La migración 032 trae 56 ejercicios base y 25 claves visuales en total; cada coach puede añadir otros. Los esquemas animados identifican el tipo de ejercicio, pero no certifican una técnica. La revisión del usuario definirá qué dibujos necesitan una segunda versión o un vídeo propio.

No importar pictogramas olímpicos «oficiales»: las propiedades olímpicas tienen protección y necesitan autorización para usos comerciales ([COI](https://www.olympics.com/ioc/olympic-properties)). Adoptar un **lenguaje original** de siluetas específicas y datos del ejercicio; la imagen/clip es el apoyo principal para la técnica. Cada recurso debe tener procedencia, titular, licencia concreta, atribución exigida, alcance comercial/modificaciones, versión, fecha y procedimiento de retiro. No hacer hotlink del navegador a terceros para contenido privado.

Fuente candidata para estudio: [wger](https://github.com/wger-project/wger/blob/master/README.md) distingue licencia del código y de los datos; su [modelo de imágenes](https://github.com/wger-project/wger/blob/master/wger/exercises/models/image.py) guarda autor/licencia por imagen. Auditar entrada por entrada, idiomas, cobertura, atribución y condiciones de compartir adaptaciones antes de importar nada. [free-exercise-db](https://github.com/yuhonas/free-exercise-db) declara licencia de repositorio, pero su [incidencia de procedencia de imágenes](https://github.com/yuhonas/free-exercise-db/issues/2) impide tomar eso como permiso universal. Si ninguna fuente pasa la revisión, producir fotos/clips propios autorizados y catálogo inicial más pequeño. No prometer «todos los ejercicios» ni generar técnica con IA sin validación experta. La lista mínima se decide por cobertura de patrones/equipos observados con coaches piloto, no por un número arbitrario.

## 6. Perfil y detalles visuales

El perfil del coach hoy queda vacío porque la vista depende de datos del portal del alumno. Crear vista según rol: coach ve nombre/contacto, marca, acceso/cupo mensual, seguridad y preferencias reales con enlaces funcionales; alumno ve sus datos de cuenta, coach/marca y privacidad. No mostrar tarjetas sin contenido. «Creado por NAVZ, +595972995557» permanece accesible en Información/Créditos y un pie discreto de página completa; quitarlo de la fila de contraseña y de cualquier espacio entre etiqueta y campo. No duplicar la firma en cada tarjeta.

Escala móvil: títulos de sección 18–22 px, cuerpo 14–16 px, inputs **16 px** para evitar zoom de foco en iOS; altura táctil mínima 44 px y foco visible. Filas «campo + botón» usan misma altura y alineación vertical; en menos de 640 px se apilan ambos a ancho completo con separación corta. Rejilla desktop usa máximo de ancho legible y densidad; no hero de media pantalla en acceso, ni grandes áreas vacías en mensualidad. Icono informa tipo/acción, nunca sirve de único nombre accesible; etiqueta breve visible o accesible. Eliminar copys motivacionales y explicaciones obvias; usar ayuda solo junto al control que la necesita. Safe areas, teclado, 200 % de texto y zoom accesible se comprueban, sin bloquear gestos de zoom.

## 7. Datos, seguridad y compatibilidad

Reutilizar Vue/TypeScript, API, PostgreSQL/RLS, almacenamiento privado y worker. Antes de migrar, trazar entidades actuales de programas, alimentos, versiones, documentos, mediciones y perfiles. Diseñar migraciones **aditivas** desde 025 si hacen falta (periodicidad/vigencia, medios licenciados, alias, correcciones, exportaciones); backup y ensayo de restauración con esquema vigente antes de datos reales. Toda consulta y exportación filtra organización+alumno y revalida autorización al crear, consultar y descargar; revocación y suspensión mensual se aplican igual que en UI. Claves de idempotencia para guardar/publicar/exportar, límites de rango/tamaño, limpieza de trabajos vencidos, escape de contenido en PDF/XLSX, sin CSV formula injection. XLSX con hojas y unidades explícitas; PDF con versión, fechas, coach/marca y fuente de datos. Trabajos privados y asíncronos reutilizan cola T08; nunca almacenar enlaces públicos permanentes. El dossier/retención/borrado por alumno y controles de privacidad deben ampliarse por cada tabla nueva. PWA/offline actual no equivale a edición offline de todos los planes; mostrar estado real de conexión y guardado.

## 8. Tareas en orden y cortes demostrables

Cada subetapa empieza con lectura de esquema/rutas vigentes, cambio mínimo, prueba dirigida con datos sintéticos y actualización de guía/avance. Una sola pasada de build al final de un corte cuando haya código nuevo; no repetir suites históricas sin fallo concreto.

| ID | Entrega y pasos | Demostración de salida |
|---|---|---|
| T16-01 | Inventariar componentes/contratos y capturas de 320/390/1366; registrar rutas y licencias actuales; fijar mapa, wireframes y estados vacío/error/carga. | Prototipo breve coach/alumno revisable, sin código nuevo. |
| T16-02 | Corregir escala de acceso/mensualidad/firma, fila campo+botón, perfil por rol; eliminar copy sobrante. | Login, mensualidad y perfiles alineados y utilizables en móvil/PC. |
| T16-03 | Rehacer navegación directa y padres contextuales; redirigir rutas ocultas; conservar borradores y filtros en retorno. | Ningún «Más»; historial → ficha y detalle → lista funcionan con botón y navegador. |
| T16-04 | Construir ficha con resumen/acceso, pestañas de contenido y acciones; conectar versiones/asignaciones actuales; alumno recibe plan publicado en Hoy. | Coach asigna rutina existente desde ficha; alumno la ve y vuelve a su origen. |
| T16-05 | Simplificar editor de rutinas, texto libre, períodos/vigencia y crear ejercicio en contexto; archivar/eliminar con reglas históricas. | Crear, publicar, asignar, archivar y recuperar sin alterar una sesión anterior. |
| T16-06 | Auditar medios; diseñar catálogo/atribución; importar solo recursos aprobados; mejorar símbolos originales; búsqueda y ejercicio propio. | Cada imagen muestra origen válido o estado «sin imagen» y admite nueva variante. |
| T16-07 | Eliminar selección de profesional alimentario del flujo del coach, adaptar permisos de autor; editor de alimento/porción/receta/plato/menú diario/semanal/mensual y asignación desde ficha. | Coach crea y publica dieta, alumno la consulta; diario/fotos conservan sus controles privados. |
| T16-08 | Unificar mediciones y datos de ficha; registros/correcciones auditables, filtros y progreso dentro de ficha y portal. | Peso/altura actual e histórico antes/después de corrección sin pérdida de valor anterior. |
| T16-09 | Acción Exportar por tipo/fechas, PDF y XLSX privados, descargas en portal, revocación y límites; ampliar dossier. | Mismo rango produce documento correcto, nadie accede a otro alumno. |
| T16-10 | Recorrido completo con coach/alumno sintéticos en 320/390/desktop y después iPhone/Android reales; fallos de red/teclado/200 % texto/instalado; cerrar puertas de piloto pertinentes. | Acta separa comprobación local de aceptación física y derechos/licencias. |

**Avance del 24-10-2026:** T16-01/02: inventario y composición de acceso, perfil y mensualidad; capturas locales de acceso/instalación/demo y recorrido del coach autenticado a 390 px, faltan otras anchuras autenticadas y dispositivos. T16-03/04: menú directo, ficha contextual, resumen de periodo y retroceso de Rutinas/Alimentación a la misma ficha comprobados; editores siguen en páginas relacionadas y faltan recorridos internos y del alumno. T16-05: días solo de texto, publicación/archivo y eliminación de borrador nunca publicado; flujo completo pendiente. T16-06: símbolos originales y ejercicios propios; pendiente catálogo amplio con medios licenciados y validación técnica. T16-07: coach autor de alimentación, días vacíos y notas, asignación día/semana/mes; integración aprobada. T16-08: altura, correcciones auditables y privacidad, integración dirigida aprobada. T16-09: exportación XLSX por rango, solicitud de PDF privado y documentos del alumno; falta descarga de extremo a extremo. T16-10: build y capturas locales, sin teléfono físico. [Evidencia detallada](../evidencias/t16-segundo-corte.md).

### Dependencias y prioridad

Primera entrega útil: **01→02→03→04**, resuelve navegación, perfil y asignación actual sin esperar catálogo. Después **05/06/07/08** según datos y derechos; **09** depende de las estructuras y permisos finales; **10** valida cada corte y el conjunto. No publicar medios no auditados para acelerar el piloto. No cerrar T16 por una captura limpia: aceptar solo acciones guardadas, historial y retorno reales.

## 9. Verificación puntual y pendientes humanos

Pruebas técnicas mínimas por corte: un camino feliz y uno de error/autorización, un alumno de otra organización que no puede ver/exportar, conservación de una versión publicada y del valor anterior, retorno directo/por navegador, y reflujo de 320/390/1366 con teclado. Reusar fixtures y ejecutar solo el subconjunto afectado. QA físico y aprobación de contenido/licencias requieren responsables humanos; hoy están pendientes. No incorporar datos reales o publicar dominio sin las puertas de privacidad, copia/restauración, infraestructura y dispositivos del [piloto](../piloto/00-puertas.md).
