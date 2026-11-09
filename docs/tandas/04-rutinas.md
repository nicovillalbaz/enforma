# T04 — Constructor y asignación de rutinas

**Depende de:** T03. **Objetivo:** programa reutilizable y versión publicada inmutable, con prescripciones precisas y asignación por alumno.

**Corte 21-10-2026:** implementada y verificada en local v0.4.0. [ADR 004](../decisiones/004-rutinas-versionadas.md), [uso/operación](../runbooks/t04-uso-y-operacion.md), [API](../runbooks/api-t04.md), [acta](../evidencias/t04.md). Teléfonos físicos y puertas de T01/T03/T07 pendientes.

| Ticket | Avance | Evidencia |
|---|---|---|
| T04-01 | Implementado | Documento acotado, revisiones, versiones, medios y asignaciones; migraciones 006–008 |
| T04-02 | Implementado | Snapshot inmutable, publicación idempotente y guardas SQL |
| T04-03 | Implementado | Guardar/copiar/preview/publicar/listar/asignar/cancelar; periodo sin solapamientos y RLS |
| T04-04 | Verificado local | Pasos móvil, columnas PC, duplicación/orden por botones, guardado y aviso de cambios |
| T04-05 | Implementado | Portal por versión asignada, semana/día/fecha, equipo/medio y objetivos |
| T04-06 | Verificado local | 15 pruebas DB nuevas, cuatro unitarias y tres recorridos nuevos de navegador; 77 acumuladas. Siete capturas y restauración |

## Base disponible y decisiones de entrada — 21-10-2026

T03 está implementada localmente: [API](../runbooks/api-t03.md), [ADR](../decisiones/003-biblioteca-y-medios.md) y [acta/límites](../evidencias/t03.md). Reutilizar ejercicios, equipos y derivados privados, las transacciones de actor y permisos del alumno gestionable.

1. Diseñar snapshot de nombre/instrucciones/métrica/equipo al publicar; editar la biblioteca después no debe alterar una versión asignada.
2. Conservar referencias a medios de versiones publicadas, ampliar inventario de backup/GC y bloquear su eliminación mientras exista una referencia histórica válida.
3. Autorizar esos medios por asignación activa además del permiso directo de guía de T03, con pruebas de RLS y revocación. Evitar compartir toda la biblioteca por tener una rutina.
4. Añadir migraciones nuevas desde 006; no reescribir 001–005. Extender tests de inmutabilidad/concurrencia y mantener las 55 pruebas actuales.
5. Mantener abiertas las pruebas físicas de vídeo de T03 y las puertas externas de T01/T07. Avanzar T04 en local no acredita lanzamiento.

## Pasos en orden

1. **T04-01 Modelo.** Programas, borradores, versiones, semanas, días, ejercicios y series prescritas; campos de repeticiones, kg, tiempo, descanso y esfuerzo con unidades/límites. Asignación referencia versión exacta, fecha y estado.
2. **T04-02 Reglas.** Crear/copiar/reordenar borrador; validar al publicar que tenga al menos un día y series coherentes; publicar copia inmutable en transacción. Evitar borrar versión usada. Crear nueva versión para cambios.
3. **T04-03 API.** CRUD de borrador, preview, publicación, lista/versiones, asignación a uno o varios alumnos, cancelación y calendario. Controlar permisos del coach asignado y tenant en cada operación.
4. **T04-04 Constructor coach.** Flujo móvil y escritorio: elegir ejercicio, orden, series objetivo, descanso, nota, semana/día, duplicar día/semana y plantilla; guardado de borrador, indicador de cambios no guardados y vista previa alumno.
5. **T04-05 Portal alumno.** Ver plan actual, semana, día, ejercicio, equipo, instrucciones, vídeo y series objetivo; distinguir programa programado de ejecutado.
6. **T04-06 QA.** Publicar v1, asignar, editar borrador y publicar v2; comprobar que v1/fechas y sus prescripciones no cambian. Probar publicación concurrente, datos inválidos, falta de media y alumno de otra organización.

## Aceptación y evidencia

Coach construye programa de ocho semanas, lo guarda como plantilla y asigna a dos alumnos. Después modifica una serie y publica v2: la asignación de v1 permanece idéntica. El alumno ve el contenido completo en pantalla de 320 px sin scroll horizontal general.
