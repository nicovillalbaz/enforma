# T09 — Alimentación, recetas, menús y diario

**Revisión 24-10-2026:** [T16](16-ficha-alumno-y-experiencia.md) propone que el coach independiente sea autor del plan alimentario sin seleccionar otro «profesional». El modelo y las pruebas de T09 de abajo son históricos; deben adaptarse conservando versionado, fuentes de datos y privacidad de diario/fotos.

**Estado 22-10-2026:** base implementada en local, v0.9.0, migración 018 aplicada. [Manual](../runbooks/t09-uso-y-operacion.md), [API](../runbooks/api-t09.md), [ADR 009](../decisiones/009-alimentacion-versionada.md), [acta](../evidencias/t09.md). Revisión profesional, fuentes de piloto, teléfonos, contenedor/antivirus reales y restauración T09 siguen abiertos. Verificaciones dirigidas; no repetir suites completas.

**Depende de:** T08 para fotos/PDF y T04 para patrón de versiones. **Objetivo:** menú profesional y seguimiento de comidas dentro de la app.

## Base recibida de T08

V0.8.0, migraciones 001–017; siguiente 018. Reutilizar snapshots, cuotas y entrega autenticada de [T08](08-archivos-pdf.md), su [API](../runbooks/api-t08.md) y el [motor PDF](../decisiones/008-recursos-y-pdf.md). Añadir una plantilla versionada de menú; conservar las ya publicadas. Diario y fotos de comida necesitan permisos/finalidades propios, no una concesión automática de biblioteca. ClamAV real, teléfonos, recuperación T08 y piloto siguen abiertos. Verificar solo cambios concretos, sin repetir suites históricas.

## Pasos en orden

1. **T09-01 Alcance profesional.** Definir quién puede crear plan nutricional, quién solo lo consulta y qué datos ve cada profesional. Revisar consentimiento, advertencias no diagnósticas y base de datos de alimentos con fuente/licencia.
2. **T09-02 Datos.** Alimentos por 100 g con unidad y fuente, recetas con ingredientes y rendimiento, plan de comidas versionado, día/franja/comida, asignación y diario real. Separar cantidades estimadas de datos confirmados.
3. **T09-03 Constructor.** Nutricionista/coach autorizado arma menú semanal, receta, sustitución y lista de compras; borrador y publicación inmutable. PDF con marca y alérgenos declarados cuando los datos sean fiables.
4. **T09-04 Portal alumno.** Ver menú del día, receta e instrucciones, marcar comida, foto y nota, registrar cantidad opcional. No obligar a contar calorías. Mostrar datos faltantes sin inventar macros.
5. **T09-05 Seguimiento.** Comparación plan vs registro y resumen cualitativo; totales energéticos/macros solo si la fuente y la cantidad permiten cálculo. Comentarios profesionales y visibilidad configurada.
6. **T09-06 QA.** Cambiar menú tras asignar, receta con 0 o múltiples porciones, alimento sin dato nutricional, foto privada, alumno de otra org, acceso del staff sin rol nutricional y uso a 320 px.

## Aceptación y evidencia

Profesional publica menú de siete días, alumno consulta/registra comidas y ambos ven resumen coherente; editar borrador no altera menú histórico. Los permisos y consentimientos se aplican a fotos/diario, y no aparecen valores nutricionales inventados.

## Ejecución y resultado local

| Tarea | Implementado | Pendiente externo / límite |
|---|---|---|
| T09-01 | Capacidad explícita owner/coach, vínculo a ficha y concesiones propias del alumno para diario/fotos | Revisar habilitación/alcance profesional y condiciones de datos antes del piloto; la app no certifica títulos |
| T09-02 | Alimentos por 100 g con procedencia, valores nullable, recetas/rendimiento, menú de siete días/versiones/asignación y diario real | Catálogo real comprobado por el estudio, sin importación masiva ni datos inventados |
| T09-03 | Constructor por día móvil, copia con IDs nuevos, principal/alternativa, publicación conservada, compras y PDF con marca | Fuentes/alérgenos no garantizan ausencia de trazas; visor físico pendiente |
| T09-04 | Consulta diaria, registro opcional principal/alternativa/otra, cantidad sin prefijar, notas y fotos privadas normalizadas | Red necesaria; permisos de cámara/HEIC y teclado en dispositivos físicos pendientes |
| T09-05 | Previsto/consumido separados, macros completos solo cuando hay datos y cantidades, resumen cualitativo y comentarios compartidos | Sin inferencias clínicas ni recomendación automática de calorías |
| T09-06 | Nueve casos dirigidos, cuatro unitarias, corrección puntual de null y auditoría de foto; revisión visual/PDF documentada | No suite histórica, carga, nuevos restores o motores físicos |

## Secuencia para demostrar

1. Owner → Alimentación → Profesionales: habilitar profesional comprobado (también owner si crea contenido).
2. Crear alimento con fuente y dato ausente real; otro con cero conocido.
3. Crear receta de dos porciones y alternativa; menú de siete días; publicar y asignar hasta 84 días.
4. Editar borrador/fuente y comprobar que la versión asignada permanece igual. Otra revisión publicada recibe otro corte.
5. Alumno configura privacidad, registra una comida sin cantidad y otra con porciones reales; usa foto opcional y recibe comentario autorizado.
6. Profesional consulta menú y lo compartido; revocar concesión bloquea otra lectura de foto/diario, conservando lectura propia.
7. Preparar PDF privado, procesar worker y compartir desde Recursos explícitamente con su alumno. Revisar marca, fuentes, alternativas, compras, español/guaraní y valores desconocidos.
8. Actualizar avances/puertas con evidencia y límites; no declarar piloto real ni repetir pruebas ya acreditadas.

## Puente a T10

Base 0.9.0, migraciones 001–018; siguiente 019. Chat/hábitos/check-ins necesitan modelos, finalidades, roles, límites de mensajes y permisos propios. No heredar diario, fotos de comidas o fotos corporales como contexto visible de una conversación. Reutilizar identidad/relación profesional-alumno y patrón de revisión/idempotencia; no enviar mensajes fuera de la app ni activar recordatorios sin configuración apropiada. Mantener fuentes/consentimiento, teléfonos, recuperación y puertas T07/T08/T09 abiertas. [T10](10-chat-habitos.md).
