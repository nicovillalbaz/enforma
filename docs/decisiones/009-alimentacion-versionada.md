# ADR 009 — Alimentación, versiones y privacidad

**22-10-2026 · v0.9.0 · T09.** Continuar Vue/Fastify/PostgreSQL y almacenamiento privado. Sin dependencias nuevas, llamadas a servicios de alimentos ni importaciones masivas. Migración 018; la siguiente es 019.

## Acceso profesional

- Propietario habilita explícitamente a cada owner/coach, incluyendo a sí mismo, con referencia de formación/habilitación comprobada por el estudio. La aplicación registra la decisión administrativa; no verifica automáticamente títulos ni autoriza actividad clínica. Revisar competencias y condiciones antes del piloto.
- Crear catálogo/publicar exige esa capacidad. Asignar/consultar seguimiento exige además poder administrar la ficha activa del alumno. Un coach de entrenamiento no obtiene acceso a alimentación por ese solo rol.
- El alumno lee sus menús asignados sin tener que registrar comidas. Diario y fotos son opcionales: consentimiento propio `nutrition-v1` y concesiones por profesional, independientes de mediciones/fotos corporales y de recursos T08. El propietario tampoco hereda lectura del diario.
- Revocar capacidad, vínculo, concesión o consentimiento bloquea nuevas consultas autorizadas por ese permiso. El alumno conserva lectura de sus registros y fotos existentes y puede retirar sus fotos. Retirar consentimiento no equivale a borrado integral ni retira copias descargadas.

## Datos y fuentes

- Catálogo privado del estudio: alimentos por **100 g**, recetas y borradores semanales. Una tabla de documentos tipados con validación AJV y funciones SQL; API sin escrituras directas, RLS y funciones con búsqueda de esquema fijada. Referencias siempre del mismo estudio y tipo.
- Cada alimento declara nombre/preparación, fuente, referencia, licencia/procedencia y fecha de revisión. Energía kcal y proteína/carbohidratos/grasa g admiten `null`; cero es conocido. Alérgenos desconocidos se distinguen de una fuente sin alérgenos declarados. No se infieren trazas ni ausencia de contaminación cruzada.
- Fuente externa elegida para altas verificadas: [USDA FoodData Central, licencia CC0](https://fdc.nal.usda.gov/api-guide/), con [tipos y documentación](https://fdc.nal.usda.gov/data-documentation/), consultadas el 22-10-2026. Se permiten transcripciones de etiquetas identificadas. La entrega no copia ni inventa un catálogo de valores; el estudio debe comprobar alimento, preparación, unidad y fuente de cada alta. No se necesita API key para utilizar fichas introducidas manualmente.
- Ingredientes en gramos de la preparación que describe la fuente; rendimiento positivo de toda la receta en porciones. No hay conversión inventada de taza/unidad/peso cocido a gramos ni recomendación calórica automática.
- Límites iniciales por estudio: 200 alimentos, 100 recetas, 50 menús (incluyen archivados), 30 ingredientes/receta, 7 días/menú y 1–6 comidas/día. Hasta 50 versiones por menú. Son límites de operación, sin recargos nuevos.

## Publicar, asignar y registrar

1. Guardar borrador con revisión optimista; conflictos no sobrescriben datos de otra sesión.
2. Publicar congela recetas principales/alternativas, ingredientes, revisiones, fuentes, rendimiento, notas y siete días. Publicar la misma revisión devuelve su misma versión. Para incorporar una fuente/receta nueva a otro corte, guardar otra revisión del menú y publicarla.
3. Asignar una versión a un alumno y periodo de hasta 84 días. La semana se repite por día de la semana; no exige empezar lunes. Exclusión SQL impide solapamiento de menús activos. Cancelación con motivo conserva registros; una nueva asignación puede ocupar ese periodo.
4. Alumno registra principal, alternativa u otra comida descrita; realizada/omitida, nota y porciones reales opcionales. No se copia la cantidad prevista al consumo. Registro entre hoy y los últimos 30 días, dentro de asignación activa. Reintento por intención y revisión para evitar duplicación/sobrescritura.
5. Seguimiento compara plan con lo declarado y muestra recuento cualitativo. Sin registro no significa comida omitida. Comentarios del profesional habilitado solo con permiso de diario; son compartidos con el alumno, no notas privadas.

## Cálculo

Por nutriente: `suma(valor por 100 g × gramos / 100) / rendimiento × porciones`. Se redondea a dos decimales por receta/porciones; suma diaria de valores de comidas redondeada a dos decimales. Cada nutriente propaga sus propios datos faltantes.

Consumido: solo receta principal/alternativa identificada y porciones realmente declaradas. Otra comida o porciones ausentes devuelve desconocido; omitida declarada cuenta cero. Falta de registro impide afirmar un total diario completo. No se iguala el consumido al plan. La lista de compras suma **una semana de principales** y sus porciones; excluye alternativas y separa revisiones distintas del mismo alimento.

Lectura API de hasta 90 días: 90 asignaciones y 540 registros, con indicadores explícitos de truncamiento; no presentar un total completo si se alcanza el límite. La interfaz consulta siete días y el día elegido, con búsqueda de alumnos (100 por resultado), sin sondeo continuo.

## Fotos y PDF

- Fotos de comidas propias, máximo tres por registro, entrada PNG/JPEG/WebP ≤2 MiB y 8 MP. Una normalización simultánea, orientación aplicada, sin animación, recodificación WebP sin conservar EXIF; miniatura 320 px y salida 1280 px. Requiere consentimiento antes de procesar y de nuevo al guardar. Entrega con sesión, RLS y auditoría; `no-store`, sin biblioteca pública ni caché PWA.
- Bytes y reservas comparten cuota T03/T08; inventario y mantenimiento incluyen fotos. Retirada inmediata de acceso, bytes retenidos 30 días tras eliminación lógica. Backup suma nueve conteos: **36 indicadores previstos** (33 conteos + 3 sumas financieras); no acredita restauración nueva.
- Plantilla independiente `forma-menu-v1`; conservar `forma-docs-v1` publicada en T08. Snapshot de menú asignado, alumno, marca/logo, fechas y zona Paraguay. Se excluyen diario, fotos y comentarios. Instrucciones, alternativas, alérgenos declarados, fuentes y compras de una semana.
- Motor, aislamiento de Chromium, cuota mensual compartida Básico 10 / Pro 50, reserva, cola, reintento, cancelación y entrega temporal T08 reutilizados. Cambiar marca/fuente no modifica el archivo. PDF personal solo se comparte con su alumno. Retirar capacidad profesional impide procesar/gestionar el PDF de menú, incluso al owner; el alumno conserva sus menús/recursos expresamente compartidos.

## Aceptación

Ver [acta](../evidencias/t09.md), [manual](../runbooks/t09-uso-y-operacion.md) y [API](../runbooks/api-t09.md). Mantener abiertas puertas de T07/T08 y revisión profesional/fuentes/consentimiento, teléfonos físicos, contenedor/ClamAV reales y recuperación T09 antes de datos/piloto reales. No repetir suites históricas ni restauraciones por rutina.
