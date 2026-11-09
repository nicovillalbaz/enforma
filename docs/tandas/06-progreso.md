# T06 — Historial, mediciones y dashboards

**Depende de:** T05. **Objetivo:** convertir sesiones reales en seguimiento útil y verificable para alumno y coach.

**Estado:** T06-01–06 implementados y verificados localmente en v0.6.0. La aceptación física y puertas externas permanecen abiertas.

## Base entregada por T05 (referencia de entrada)

- [API](../runbooks/api-t05.md) y [ADR 005](../decisiones/005-sesiones-y-sincronizacion.md): sesiones/días congelados, objetivos y realizaciones separados, revisiones y eventos auditados. Migraciones aplicadas 001–010; continuar desde 011.
- Historial básico de alumno y coach ya existe en `/historial`, con filtro por alumno y detalle de cada serie. Extenderlo para métricas y filtros; no duplicar otra fuente de sesiones.
- Calcular progreso oficial desde `workout_sets` y sesiones confirmadas en DB. La cola local proyecta intenciones que el coach aún no ve; nunca sumarlas otra vez al sincronizar.
- Definir explícitamente cómo cuentan sesiones parciales, deshacer, reaperturas y cancelaciones. La duración de T05 es declarada por el dispositivo, no asistencia certificada.
- Mantener objetivos/instrucciones históricos al cambiar programa/equipo y permisos por alumno/profesional. Medidas/fotos necesitarán sus propios permisos y consentimiento.

## Pasos ejecutados en orden

1. **T06-01 Definiciones.** Fijar fórmulas: volumen `repeticiones × kg` solo para ejercicios de peso, frecuencia de sesiones finalizadas, cumplimiento `días realizados / días programados` con ausencias y cancelaciones visibles. Diferenciar PR real de objetivo programado.
2. **T06-02 Consultas.** Historial paginado, detalle inmutable, progreso por ejercicio, comparaciones semanales y consultas con índices por organización/alumno/fecha; evitar N+1. Resúmenes/materializaciones solo si las mediciones muestran necesidad.
3. **T06-03 Mediciones.** Peso y perímetros con unidad/fecha/origen; fotos solo con consentimiento y permiso específico, miniatura privada, acceso revocable y opción de no usarlas. No mezclar medidas con datos de entrenamiento visibles a todo staff.
4. **T06-04 Panel alumno.** Gráficos legibles en 320 px con tabla textual equivalente, filtros por periodo y estados «sin datos»; historial de sesión y marcas personales.
5. **T06-05 Panel coach.** Ficha unificada, tendencia, adherencia, último entrenamiento y alerta simple de inactividad configurada. Ver solo alumnos asignados cuando aplique.
6. **T06-06 QA.** Calcular resultados manuales sobre fixture pequeño y compararlos; cargas cero, tiempo/distancia, sesiones parciales y cambio de zona/fecha. Probar denegación de fotos y desempeño con miles de series.

## Aceptación y evidencia

La sesión de T05 modifica un gráfico y la ficha del coach sin entrada manual. Los valores coinciden con cálculo de referencia documentado, y no aparecen fotos/medidas a un profesional sin permiso.

## Cierre local y evidencia

| Tarea | Estado | Entrega comprobable |
|---|---|---|
| T06-01 | Hecho local | [ADR 006](../decisiones/006-progreso-y-privacidad.md), calendario y fórmulas con cero/null, parciales, reapertura, ausencias y cancelaciones |
| T06-02 | Hecho local | Agregación SQL e índices, cursor y carga constante por lote; filtros de historial por fecha/estado. [API](../runbooks/api-t06.md) |
| T06-03 | Hecho local | Migraciones 011–013, mediciones con origen/anulación, fotos privadas con consentimiento y permisos por profesional, miniatura/normalización y retención |
| T06-04 | Hecho local | `/progreso` alumno: métricas, ejercicio/marca, comparación, tablas, mediciones y privacidad; móvil 320–1440 y PC |
| T06-05 | Hecho local | Cohorte y ficha coach, alumnos gestionables, actividad y aviso configurable propio, permiso explícito para datos opcionales |
| T06-06 | QA local aprobada | [Fixture manual](../evidencias/t06-calculos.md), 5.000 series, permisos/concurrencia/cuotas, matriz de navegadores y restauración de 201 archivos/13 conteos. [Acta/capturas](../evidencias/t06.md) |

[Manual paso a paso](../runbooks/t06-uso-y-operacion.md). Migraciones 001–013 aplicadas; siguiente 014. Se mantienen Vue/Fastify/PostgreSQL/Sharp, sin dependencias nuevas. No hay despliegue público.

### Demostración de salida

1. Alumno finaliza parcialmente una sesión: 42,5 kg × 10 → 425 kg·rep y un día completado.
2. Alumno abre Progreso y su tabla; coach abre el mismo alumno y obtiene el mismo resultado confirmado.
3. Registrar 70,5 y 71 kg; anular 71 con motivo. Historial conserva ambos y la gráfica vuelve a 70,5.
4. Coach sin permiso recibe panel privado. Alumno concede Mediciones y, opcionalmente, consentimiento/Fotos; tras guardar se ven solo los datos autorizados.
5. Revocar Fotos y consultar la URL anterior: 404. Retirar consentimiento elimina todas las activas; reactivar no las recupera.
6. Filtrar historial, revisar último cierre/aviso y contrastar copia/restauración aislada.

### Puente a T07

No añadir otra cola offline ni cachear datos privados al instalar PWA. Conservar permisos/revisión y contratos de T05/T06. Cerrar teléfonos físicos, políticas de retención/exportación/borrado, infraestructura, respaldo externo e investigación/piloto antes de aceptación comercial. [Plan T07](07-piloto.md).
