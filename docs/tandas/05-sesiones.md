# T05 — Entrenamiento y registro del alumno

**Depende de:** T04. **Objetivo:** registrar series sin pérdidas, duplicados ni escala incorrecta en móvil.

## Ejecución T05 — 21-10-2026

Implementación y QA local v0.5.0 completados: 99 pruebas acumuladas, cinco capturas y backup restaurado. La aceptación en teléfonos físicos sigue abierta.

| Ticket | Resultado implementado | Verificación |
|---|---|---|
| T05-01 | Día congelado, realización separada, eventos/recibos inmutables y referencias históricas | 009/010; tests de SQL y snapshot |
| T05-02 | Preparar/iniciar/guardar/deshacer/notas/finalizar/reabrir; CAS por serie y UUID por intención | Repetición concurrente, dos dispositivos y permisos |
| T05-03 | `/entrenar`, objetivo/realización, selector, guía, timer y cierre parcial; móvil/PC | Reflujo 320–1440 px y campos de 16 px |
| T05-04 | IndexedDB antes de red, cola ordenada, conflicto explícito, contexto offline y borrado al salir | Pérdida de respuesta, cuota llena, recarga, navegador persistente |
| T05-05 | `/historial`, detalle de valores y acceso desde ficha coach | Comparación con hechos del servidor |
| T05-06 | Automatización local y diagnóstico de motores | iPhone/Android físicos, pantalla bloqueada y teclado real pendientes |

Guías: [uso y recuperación](../runbooks/t05-uso-y-operacion.md), [API](../runbooks/api-t05.md), [ADR 005](../decisiones/005-sesiones-y-sincronizacion.md), [evidencia y límites](../evidencias/t05.md).

## Base disponible al empezar T05 — 21-10-2026

T04 verificada localmente: [contratos](../runbooks/api-t04.md), [ADR 004](../decisiones/004-rutinas-versionadas.md) y [acta](../evidencias/t04.md). Migraciones siguientes desde 009; no reescribir 001–008.

1. Vincular sesión a asignación/versión y a IDs de semana/día/ejercicio/serie del snapshot. La biblioteca mutable no debe sustituir la prescripción histórica.
2. Mantener objetivos y valores realizados separados. La UI actual solo muestra planificación; no hay sesiones completadas que migrar desde `/demo`.
3. Definir qué hacer con una sesión iniciada si se cancela el plan: conservar registro local/histórico, revalidar autorización al sincronizar y mostrar conflicto explícito. No descartar silenciosamente hechos pendientes.
4. Mantener `app.media_storage_references()` y permisos de medios/versiones al incorporar referencias históricas de ejecución. Revisar retención antes de borrar.
5. Extender las 77 pruebas actuales con cola local, idempotencia, dos dispositivos, recarga y mala red. Añadir pruebas físicas y cerrar las puertas externas antes del piloto.

## Pasos en orden

1. **T05-01 Modelo de ejecución.** Sesión con referencia a asignación/versión y copia de prescripción; ejercicios y series realizadas; `client_event_id` único, estado `planned/in_progress/completed`, timestamps y origen de cambio. Definir edición posterior con auditoría.
2. **T05-02 API idempotente.** Iniciar/reanudar sesión, guardar una serie, deshacer, finalizar. Reintentar mismo evento devuelve mismo resultado; dos eventos con mismo ID y contenido distinto producen conflicto explícito. Bloquear doble sesión activa del mismo día cuando aplique.
3. **T05-03 UI de entrenamiento.** «Hoy», ejercicio actual, objetivo y último registro, controles numéricos adecuados, botón de serie completada, descanso, notas, vídeo y progreso; confirmar antes de abandonar solo si hay datos sin persistir localmente. Validar la composición móvil de [plan visual](../11-plan-visual.md) con uso a una mano y teclado abierto.
4. **T05-04 Guardado local.** Escribir en IndexedDB antes de intentar red; cola local con estado pendiente/sincronizado/error, reintento al volver conexión, y borrado seguro al cerrar sesión. La interfaz diferencia borrador local de confirmación servidor.
5. **T05-05 Resumen y coach.** Al finalizar, mostrar series reales, duración y notas; el coach ve el resultado en ficha del alumno. Mantener registro histórico aun si cambia rutina.
6. **T05-06 Casos de campo.** Probar modo avión a mitad de sesión, alternancia de apps, bloqueo de pantalla, recarga, dos taps rápidos, mala red, mismo usuario en dos dispositivos y caída de API. Resolver conflictos con mensaje claro y sin sobrescribir silenciosamente.

## Aceptación y evidencia

Un alumno completa sesión en un iPhone real con desconexión durante dos series; al reconectar aparecen una sola vez, con valores exactos en historial y panel coach. La sesión se puede reabrir después de cerrar la PWA. Probar también Android de gama baja y teclado numérico sin zoom involuntario.
