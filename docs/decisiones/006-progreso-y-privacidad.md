# ADR 006 — Progreso confirmado, mediciones y fotos privadas

**Fecha:** 21-10-2026. **Implementado y verificado en local, v0.6.0.** Se mantienen Vue, Fastify, PostgreSQL y Sharp; gráficos SVG locales con tabla textual, sin dependencias nuevas.

## Fórmulas y fechas

- Periodo inclusivo de hasta 366 días, terminado como máximo hoy en `America/Asuncion`. La fecha base de entrenamiento es **el día programado** (`scheduled_on`), sin convertir medianoches desde el navegador. El último entrenamiento/inactividad usa el cierre real confirmado por el servidor.
- Solo sesiones `completed` con al menos una serie `recorded`. Parciales cuentan una sesión; se presentan por separado y conservan la proporción de series. Reabrir retira temporalmente esa sesión de las métricas hasta finalizar de nuevo; deshacer retira la realización actual, sin borrar auditoría.
- Volumen conocido = suma de `reps × weightKg` de series de repeticiones registradas en esas sesiones. Carga cero aporta cero; carga no indicada no se transforma en cero y aparece en el contador de series sin carga. Tiempo y distancia no se convierten a volumen.
- Cumplimiento = días finalizados / días programados exigibles, contado por fecha distinta. Reemplazar una asignación no duplica la obligación del mismo día. Se excluyen días posteriores a cancelar salvo que conserven una sesión ya finalizada; se informan cancelados por separado. Días anteriores a hoy sin finalizar son ausencias; hoy se muestra pendiente. Fechas futuras quedan fuera.
- Marcas por ejercicio **y métrica**, dentro del periodo: máxima carga con repeticiones válidas y repeticiones de esa serie; máximo tiempo/distancia como valores registrados, sin calificarlos como mejora clínica o deportiva. Los objetivos de la rutina no son marcas realizadas. Un cambio de nombre conserva el ID y usa el nombre de la última ejecución; el detalle histórico conserva su propio texto/version.
- Comparación de volumen de los últimos siete días del periodo frente a los siete anteriores; con base cero no se inventa un porcentaje. En periodos cortos se advierte que la ventana anterior puede ser incompleta.
- Inactividad configurable por profesional/alumno (7–90 días, predeterminado 14, desactivable), a partir del último cierre real o del alta si nunca entrenó. Solo se señala alumno activo. Es un aviso dentro de la aplicación; no envía mensajes ni diagnostica.

Las consultas agregan hechos confirmados en DB; no incorporan la proyección de IndexedDB, no suman eventos repetidos y no requieren materializaciones. El listado de seguimiento usa agregación por lote; índices por organización/alumno/fecha y cierre.

## Mediciones

Peso en kg y perímetros en cm (cintura, cadera, pecho, brazo, muslo), con fecha, origen y creador. Límites técnicos de entrada, sin rangos de salud ni recomendaciones. Un UUID identifica cada intención de alta: repetirla no duplica el valor; cambiar su contenido entra en conflicto. Los hechos no se editan: se anulan con motivo y se registra una corrección nueva. Anulaciones excluidas de gráficos, visibles en historial.

El alumno consulta/introduce sus mediciones. Cada profesional necesita autorización explícita para verlas y registrarlas; ser owner o gestionar al alumno no basta. El alumno puede revocar permisos, y puede anular hechos propios o de profesionales; un profesional solo anula los que él creó y mientras conserve acceso.

## Fotos y consentimiento

Fotos opcionales en una tabla/almacenamiento privado separado de medios de biblioteca. Consentimiento general versionado y permiso individual por profesional; activar fotos no concede permisos automáticamente. Retirar consentimiento oculta y elimina lógicamente todas las fotos activas; volver a activarlo no restaura esas fotos.

Entrada PNG/JPEG/WebP de hasta 2 MB y 8 megapíxeles, sin animación. Se normaliza orientación, se elimina metadata y se generan WebP de hasta 1280 px y miniatura de 320 px. Se conserva únicamente el resultado normalizado y miniatura; no el original. Sharp asíncrono, máximo dos transformaciones simultáneas por API, con plazo de cinco segundos para la transformación principal: presupuesto pequeño equivalente al patrón de logos, sin ejecutar FFmpeg ni convertir vídeos en HTTP.

Cuota combinada con medios/logos del estudio; máximo 100 registros de foto por alumno, contando eliminados hasta depurar. Cada alta revalida consentimiento y presupuesto dentro de la transacción. Las URLs requieren sesión y autorización en cada petición, sin caché pública ni incorporación a IndexedDB/service worker. El owner sin permiso no obtiene fotos desde el catálogo de medios ni mediante URL directa.

Eliminar o revocar corta inmediatamente nuevas lecturas. Los archivos eliminados lógicamente se retienen 30 días para recuperación operativa y se depuran por el mantenimiento con el mismo bloqueo de backup; backups anteriores pueden conservarlos durante su retención. Antes de datos reales deben revisarse esas retenciones y el consentimiento con el marco de privacidad del piloto. Los bytes ya descargados no se pueden retirar remotamente.

## Interfaz y operación

Primero móvil: tarjetas de cumplimiento/frecuencia/volumen, filtros sencillos, gráfico con unidad y tabla equivalente. PC distribuye comparaciones y métricas. Sin datos se explica la causa; no se trazan marcas falsas ni se representan `null` como carga cero. Mediciones/fotos no se cachean para uso offline. El entrenamiento de T05 mantiene su cola independiente.

[Guía](../runbooks/t06-uso-y-operacion.md), [API](../runbooks/api-t06.md), [fixture manual](../evidencias/t06-calculos.md) y [acta/capturas](../evidencias/t06.md) registran el cierre local. Migraciones 011–013 aplicadas; continuar desde 014. Las puertas físicas de iPhone/Android, SMTP, despliegue, retención y piloto previas siguen abiertas.
