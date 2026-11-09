# T09 — Guía de alimentación, recetas, menú y diario

**22-10-2026 · v0.9.0.** [Decisiones](../decisiones/009-alimentacion-versionada.md) · [API](api-t09.md) · [Evidencia](../evidencias/t09.md).

## 1. Preparar el entorno y los permisos

1. Usar Node 24 y PostgreSQL del proyecto. Aplicar 001–018 con `scripts/forma.ps1 run db:migrate`; no modificar una migración aplicada. Siguiente: 019.
2. Arrancar con `scripts/forma.ps1 run dev`. Para trabajo limitado, web/API bastan; iniciar `dev:documents` cuando se necesite procesar la cola PDF. No requiere paquete nuevo ni servicio de datos alimentarios.
3. Abrir **Más opciones → Alimentación** en móvil o enlace lateral en PC. Se conservan cinco destinos principales. Sin conexión no se ofrece un diario offline; las sesiones de entrenamiento T05 mantienen su funcionamiento propio.
4. Como owner, entrar en **Profesionales**. Comprobar credenciales y alcance de cada profesional, escribir una referencia y habilitarlo. El owner debe habilitarse también si va a crear menús. El registro de la app no certifica títulos.
5. Coach habilitado necesita además vínculo con la ficha T02. Diario/fotos requieren consentimiento y permiso del alumno; no los concede la habilitación profesional ni ser propietario.

## 2. Crear alimentos fiables

1. Alimentos → Nuevo alimento. Indicar nombre y preparación exacta: crudo, cocido, marca, etc.
2. Fuente: etiqueta del producto o ficha verificable, por ejemplo USDA FoodData Central. Añadir referencia/producto/FDC ID o URL, licencia/procedencia y fecha de revisión.
3. Introducir valores **por 100 g**, energía en kcal y macronutrientes en gramos. Dejar vacío lo desconocido. Cero es un dato conocido igual a cero; no usarlo como sustituto de un dato ausente.
4. Si la fuente declara alérgenos, activar el control y transcribirlos separados por coma. Si no hay información, dejarlo desactivado. Lista vacía declarada no garantiza ausencia de trazas o seguridad ante alergia.
5. Guardar. Editar exige revisión actual; ante conflicto actualizar y reconciliar. Archivar retira la ficha de nuevas selecciones; no modifica fuentes ya publicadas en un menú.
6. No se importó una base masiva ni se proporcionan valores inventados. El estudio verifica unidades, preparación, procedencia y uso antes de incorporarlos a un plan real. Catálogo inicial: 200 alimentos, incluidos archivados.

## 3. Recetas y rendimiento

1. Recetas → Nueva receta. Elegir nombre y rendimiento **de toda la preparación**, en porciones positivas; nunca cero.
2. Seleccionar alimentos y gramos según la preparación de su fuente. Añadir hasta 30 ingredientes. No introducir mililitros/tazas como gramos sin una equivalencia comprobada fuera de esta entrega.
3. Escribir preparación e instrucciones. La estimación por porción divide los ingredientes entre el rendimiento.
4. Guardar. Un nutriente ausente en un ingrediente deja ese nutriente incompleto, sin anular automáticamente los otros valores conocidos.
5. Hasta 100 recetas. Editar/archivar no modifica las recetas conservadas en publicaciones anteriores. Para incorporar un cambio al alumno, publicar otra revisión del menú y asignarla de forma explícita.

## 4. Construir y publicar siete días

1. Menús → Nuevo menú. Nombre e indicaciones generales.
2. Elegir el día. Cada comida tiene momento/nombre, receta principal, porciones previstas, alternativa opcional y nota.
3. **Copiar día al resto** sustituye los borradores de los otros días tras confirmación y genera identificadores distintos. Después ajustar cada día. Siete días, de una a seis comidas por día.
4. Guardar borrador. Todavía no aparece como menú del alumno.
5. Publicar desde la tarjeta. La versión conserva ingredientes, fuente, preparación, rendimiento, alternativas y notas. Publicar la misma revisión reutiliza esa versión; cambiar solo un alimento no reescribe publicaciones anteriores.
6. Para un corte nuevo, editar/guardar el menú y publicar otra revisión. Hasta 50 menús y 50 versiones por menú.

## 5. Asignar y gestionar cambios

1. Menús → Versiones / asignar. Elegir versión publicada y alumno activo administrable.
2. Las primeras 100 fichas se cargan en la selección. Para otra ficha, buscarla en Seguimiento; el resultado de búsqueda alimenta la selección de alumnos. No cambiar de alumno con un registro sin guardar.
3. Elegir inicio y fin, hasta 84 días. La semana se repite por día de la semana; puede empezar un jueves. La lista de compras representa una semana de principales, sin alternativas, no todo el periodo.
4. Asignar. Un menú activo solapado impide guardar. Revisar el periodo o cancelar la asignación anterior con motivo.
5. Seguimiento → alumno → fecha: consultar menú, ingredientes/fuentes, sustitución y compras. Solo se muestra diario/fotos si ese profesional tiene permiso.
6. Cancelar asignación conserva el historial y bloquea nuevas modificaciones de sus comidas. Consultar una fecha del periodo para encontrar la asignación cancelada. Una nueva puede ocupar el periodo cancelado; no borra registros anteriores.

## 6. Portal alumno y privacidad

1. Alimentación → Mi menú → fecha. Leer indicaciones, receta, ingredientes y alternativa. No es obligatorio registrar ni contar calorías para leer el menú.
2. Privacidad: aceptar diario opcional. Elegir profesional por profesional para compartir diario/comentarios; fotos tienen consentimiento y concesión adicionales. Guardar los permisos.
3. Mi menú → Registrar esta comida. Elegir realizada u omitida, receta principal/alternativa/otra comida y nota opcional. Otra comida necesita descripción.
4. Porciones realmente consumidas es opcional y empieza vacío. No se copia la cantidad prevista. Si no se indica cantidad o se elige otra comida, la app no inventa sus nutrientes.
5. Guardar; queda registro del servidor. Editar permite corregirlo con revisión. Intervalo permitido: hoy y los 30 días anteriores, dentro del periodo de una asignación activa. Fechas futuras sirven para consultar, no registrar.
6. Tras guardar el registro, añadir hasta tres fotos opcionales de 2 MiB/8 MP, sin animación. Se recodifican sin EXIF y permanecen privadas. Si falla la subida, conservar la selección y usar Reintentar foto seleccionada.
7. Las fotos se abren con sesión y no se incorporan a biblioteca/recursos. Retirar foto bloquea nuevas lecturas inmediatamente; bytes se conservan 30 días para mantenimiento.
8. Al guardar revocación se bloquean consultas posteriores del profesional. El alumno conserva sus registros y puede retirar fotos existentes. Desactivar consentimiento no hace borrado integral ni elimina copias previamente descargadas.

## 7. Seguimiento y comentarios

1. Profesional: buscar alumno, seleccionar día. El menú previsto y el consumo declarado se muestran separados. Sin acceso al diario aparece privado, no un cero de consumo.
2. Realizadas/omitidas son declaraciones. Un día sin registros queda sin evaluar. Resumen de los últimos siete días consultados y accesos a sus fechas.
3. Las estimaciones solo usan fuente y cantidad compatibles. Cada macronutriente conserva sus propios datos ausentes; un total consumido no se completa con la prescripción.
4. Comentar un registro exige permiso del diario. El texto lo ve el alumno y profesionales actualmente autorizados; no usarlo como nota privada interna. Hasta 20 comentarios por registro.
5. Actualizar es manual; no hay polling ni recordatorios nuevos. Menú, diario y fotos requieren red. Editor, registro y privacidad avisan antes de descartar cambios al navegar/cambiar estudio/cerrar.
6. La API limita un periodo de hasta 90 días a 90 asignaciones y 540 registros, con indicadores de datos parciales y sin total consumido completo si se alcanza el límite. Consultar un periodo menor por API o soporte si ocurre. La interfaz usa ventanas de siete días.

## 8. PDF privado con marca

1. En asignación activa, **Preparar PDF privado** solicita un recurso/versión T08. No concede lectura automáticamente ni incluye diario/fotos/comentarios.
2. Iniciar worker documental cuando corresponda. Procesa uno cada vez; Chromium se abre solo para generar y se cierra al terminar. Rutinas T08 conservan su plantilla; el menú usa `forma-menu-v1`.
3. Abrir Recursos y PDF → Actualizar. Confirmar estado listo; compartir explícitamente con el alumno del documento y preparar apertura/descarga temporal T08.
4. Incluye marca/logo, alumno, fecha Paraguay, siete días, ingredientes, alternativas, alérgenos declarados, fuentes y compras de una semana. El visor PDF conserva su ampliación; el portal sigue responsive.
5. Presupuesto conjunto de PDF: Básico 10 / Pro 50 solicitudes/mes. Fallo se reintenta en la misma versión; no crear versiones nuevas repetidas. Hasta cuatro preparaciones pendientes/estudio y 10 MiB de salida. Sin recargos nuevos por alimentación.
6. El PDF conserva datos al solicitarlo. Cambiar catálogo, menú o marca después no altera ese archivo. Retirar capacidad profesional impide su gestión/procesamiento; no retira copias ya descargadas ni el menú leído por su alumno.

## 9. Operación y recuperación

1. Aplicar 018 antes de arrancar código 0.9.0. Reutilizar almacenamiento, bloqueo de backup y mantenimiento T03/T08. No borrar archivos UUID a mano.
2. Fotos de comidas cuentan en cuota conjunta y monitor. `media:maintenance` retira bytes de fotos eliminadas hace 30 días; conservar semántica de consentimiento/retención y auditoría.
3. Backup incluye claves privadas nuevas y nueve conteos. Total esperado **36 indicadores: 33 conteos y 3 sumas financieras**. No se ejecuta otra restauración en T09 por presupuesto; ensayos anteriores acreditan su corte, no los datos T09.
4. Antes del piloto, restauración aislada de versiones/asignaciones/consentimientos/diario/comentarios/fotos/PDF con hashes y permisos negativos. Conciliar revocaciones posteriores al snapshot antes de reabrir.
5. Mantener puertas de infraestructura, ClamAV real, producción, teléfonos y políticas integrales de datos. Añadir revisión profesional y de fuentes/consentimiento. No se incorporaron coaches reales ni se enviaron mensajes.

## 10. Comprobación de bajo consumo

Consultar primero el [acta existente](../evidencias/t09.md). Solo si cambia el área:

```powershell
scripts/forma.ps1 run test -- tests/unit/nutrition.test.ts
scripts/forma.ps1 run test:db -- tests/integration/nutrition.test.ts
# Para un ajuste de fotos, limitar además con -t 'consentimiento separado para fotos'.
```

No repetir suites históricas, matriz de motores, carga, contenedores ni restauraciones como rutina. El recorrido visual opt-in crea solo datos ficticios en localhost, usa un Chromium compartido para UI y un PDF y cierra sus servicios al terminar. No ejecutarlo contra el piloto.
