# T11 — Uso y operación de agenda

**Versión:** 0.11.0. **Base:** migraciones 001–020; próxima 021. [Decisiones](../decisiones/011-agenda-y-avisos-internos.md), [API](api-t11.md), [evidencia](../evidencias/t11.md).

## 1. Preparar al profesional

1. Iniciar sesión, seleccionar estudio y entrar en **Agenda** desde Más opciones en móvil o sidebar en PC.
2. Comprobar la zona mostrada. Los horarios pertenecen al estudio, aunque el teléfono esté en otra zona. Para cambiar la zona del estudio, revisar primero las sesiones existentes; sus instantes no se trasladan automáticamente.
3. En **Disponibilidad**, elegir profesional y **Nuevo bloque**. Indicar fecha/hora inicial/final y ubicación. Guardar. Owner puede administrar todo el estudio; profesional solo lo propio.
4. Crear bloques manuales de 5 minutos a 24 horas, dentro de los próximos 366 días. No hay repetición automática semanal. No cancelar un bloque que conserva sesiones activas: cambiarlas/cancelarlas primero.
5. Si una hora no existe por cambio horario, elegir otra. Si se repite, seleccionar el desplazamiento indicado antes de guardar; nunca interpretar una hora ambigua silenciosamente.

## 2. Publicar cita o clase

1. En **Sesiones**, pulsar **Nueva sesión**. Seleccionar profesional y bloque disponible.
2. Elegir cita (una plaza) o clase (1–100), título e instrucciones comunes, ubicación e inicio/fin. Duración: 5 minutos a 12 horas, completamente dentro del bloque.
3. Definir minutos de antelación para reserva y cancelación (0–10080). Cero permite hasta el inicio. No se aceptan reservas durante/después de la sesión.
4. Marcar publicada para que aparezca al alumno vinculado. Un borrador no se ofrece al alumno.
5. Guardar. Si hay conflicto de horario o revisión, actualizar y revisar. No intentar evadir un solapamiento cambiando solo el profesional.
6. Consultar día/semana, filtro profesional y **Cargar más** si corresponde. Se cargan hasta 100 sesiones por página; bloques tienen aviso de truncado. Actualizar antes de tomar decisiones sobre plazas.

## 3. Reservar desde el móvil

1. Alumno activo entra en Agenda y abre una sesión de sus profesionales vinculados. Comprueba fecha, zona, ubicación, instrucciones y plazas.
2. Pulsa **Reservar mi plaza** y espera **Tu plaza está confirmada**. Un botón pulsado o una pantalla antigua no confirma reserva. El servidor comprueba cupo y solapamiento.
3. En **Solo mis reservas**, consultar las propias. No se muestran nombres de compañeros.
4. Para cancelar, abrir reserva y pulsar **Cancelar mi reserva** antes del plazo indicado. Si el plazo venció, contactar al profesional. Cancelar no genera un cargo.
5. Volver a reservar una plaza disponible crea una reserva nueva y conserva la cancelación anterior. Ante fallo de red, repetir la intención pendiente; no se reserva sin conexión.

## 4. Gestión del coach

1. Abrir sesión y consultar **Reservas y asistencia**. **Reservar para un alumno** busca exclusivamente alumnos activos vinculados al profesional.
2. Para editar con inscritos, introducir motivo de al menos diez caracteres. No reducir cupo bajo inscritos, mover fuera del bloque ni elegir un profesional sin vínculo a todos los inscritos.
3. Guardar cambio: reservas se actualizan juntas, se preparan avisos y los afectados pueden cancelar hasta el nuevo inicio. Actualizar para ver el estado confirmado.
4. Para cancelar sesión, desplegar acción, explicar motivo y confirmar. Se cancelan sus reservas y se preparan avisos.
5. Cancelación individual excepcional: registrar motivo; queda marca si estaba fuera de plazo. El historial no se borra.
6. Desde el inicio y hasta 30 días después del final, marcar presente/ausente/pendiente. Si otra persona editó, actualizar antes de repetir. Asistencia no consume bonos ni registra pagos en T11.

## 5. Preferencias e inbox

1. **Mis avisos** configura reserva, cambios, recordatorios, bienvenida y check-ins para la persona actual dentro del estudio.
2. Ajustar inicio/fin de silencio en la zona del estudio. 22:00–07:00 es el valor inicial; ambos iguales desactivan silencio. Límite diario de 1–20, por defecto 10.
3. Abrir **Avisos internos** para consultar y marcar leído. **Ver sesión** lleva al día correspondiente; seguimiento respeta su permiso propio.
4. Los avisos llegan dentro de la app al abrir/actualizar. App cerrada, bloqueo del teléfono o un worker detenido no garantizan una alerta. Push no está habilitado.

## 6. Reglas del owner

1. Abrir **Reglas**. Las tres reglas comienzan pausadas.
2. Bienvenida: activar solo para altas/activaciones nuevas. No reenvía a alumnos históricos ni a activaciones realizadas mientras estaba pausada.
3. Próxima cita/clase: fijar 5–10080 minutos antes del inicio. Check-in pendiente: 5–10080 minutos después de abrir la tarea. Comienzan con 1440 minutos.
4. **Publicar configuración** crea una versión inmutable. Revisar **Vista previa de destinatarios** con cambios guardados; es de solo lectura y tiene hasta 50 fuentes. No garantiza entrega si luego cambia permiso, preferencia o plazo.
5. Desmarcar activación y publicar para pausar. Cambiar o pausar descarta entregas pendientes de la versión anterior; reanudar no reproduce bienvenidas históricas.
6. En ejecuciones recientes, distinguir programado/entregado/descartado/fallido y motivo. Solo un fallo técnico vigente admite **Reintentar fallo**, hasta tres veces; se reutiliza el trabajo, no se duplica el aviso.

## 7. Operación de bajo consumo

1. Arrancar servicios habituales según [desarrollo](desarrollo.md). `scripts/forma.ps1 run dev:followup` procesa seguimiento T10 y agenda T11 en el mismo proceso; no iniciar otro motor externo.
2. El ciclo es de un minuto, con fuentes acotadas y hasta 50 entregas secuenciales. Una demora breve es normal; comprobar latido si supera tres minutos. API sigue confirmando reservas aunque los avisos estén demorados.
3. `ops:check` incluye latido de agenda y cola interna. Ejecutarlo cuando estén levantados los servicios esperados; servicios detenidos o un backup viejo no acreditan un incidente de agenda por sí solos.
4. En fallo de entrega, revisar worker, fecha de vencimiento, permisos, regla y preferencias antes de reintentar. No alterar outbox/recibos directamente para forzar entrega.
5. Backup incorpora diez conteos y requiere ensayar recuperación con **59 indicadores**. Ese ensayo no se ejecutó en T11; programarlo al preparar el entorno externo, con acceso autorizado y copia cifrada.
6. Para cambios, usar un caso dirigido del módulo afectado. No repetir las suites históricas, capturas masivas ni restauraciones por un cambio documental. `tests/manual/t11-visual.mjs` es opt-in (`FORMA_T11_LOCAL_QA=1`), exige fixture ficticia local y cierra navegador/servidores; no usar contra usuarios reales.

## 8. Incidencias y salida a piloto

| Situación | Paso siguiente |
|---|---|
| Última plaza ocupada / solapamiento | Actualizar, elegir otro horario; no hay lista de espera automática |
| Conflicto de revisión | Recargar y revisar cambios antes de guardar |
| Conversión horaria distinta | Actualizar zona/configuración; volver a elegir hora y desplazamiento |
| Aviso diferido | Revisar silencio, límite diario y vigencia; no consume intentos técnicos |
| Aviso descartado | Consultar motivo: consentimiento/vínculo/regla/plazo; no reintentar como fallo técnico |
| Bloque no cancelable | Cambiar/cancelar primero sus sesiones activas |

Antes del piloto: comprobar iPhone/Android reales, teclado y zoom accesible, cambio de zona/horario, app visible/oculta y quiet hours, HTTPS/PWA, latido y recuperación. Aprobar retención y políticas de cancelación con responsables. Ver [puertas](../piloto/00-puertas.md). La [firma NAVZ](../pendientes/firma-navz.md) continúa pendiente para una entrega posterior.
