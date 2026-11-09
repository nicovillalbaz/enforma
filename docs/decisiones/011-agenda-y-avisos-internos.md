# ADR 011 — Agenda y avisos internos

**Fecha:** 22-10-2026. **Estado:** implementado en local, v0.11.0, migración 020. Siguiente migración: 021.

## Decisión y alcance

Se mantienen Vue, Fastify y PostgreSQL; no se añaden dependencias, servicios de automatización ni proveedores de mensajería. `/agenda` ofrece bloques de disponibilidad manuales, citas individuales, clases con cupo, reservas, cancelaciones y asistencia. Ubicación es texto; sedes estructuradas corresponden a T13. Recurrencias y lista de espera quedan pendientes de necesidad del piloto.

### Tiempo y concurrencia

- Guardar instantes UTC y mostrar la zona IANA de la organización. El dispositivo no determina la hora de negocio. El formulario convierte la hora local con `Intl`, rechaza horas inexistentes y permite elegir explícitamente entre las dos interpretaciones de una hora repetida. API/DB contrastan zona, hora local e instante con `AT TIME ZONE`.
- Intervalos semiabiertos `[inicio, fin)`: dos sesiones contiguas son válidas. Exclusión GiST global por profesional para sesiones activas y por usuario alumno para reservas confirmadas, incluso entre organizaciones. Las restricciones no exponen nombres de otro estudio en los errores.
- Bloqueos transaccionales por organización, alumnos ordenados, profesionales ordenados y fila de sesión. El último cupo se cuenta dentro de la transacción. Se conserva historial cancelado.
- Comandos con UUID de intención, hash de contenido canónico y recibo. Mismo UUID/contenido devuelve el recibo original; reutilizarlo con otro contenido se rechaza. El cliente conserva intención ante fallo y la elimina tras respuesta confirmada; una nueva reserva tras cancelar usa otra intención.

La semántica sigue las [restricciones sobre rangos de PostgreSQL](https://www.postgresql.org/docs/current/rangetypes.html#RANGETYPES-CONSTRAINT) y la [conversión de zona horaria](https://www.postgresql.org/docs/current/functions-datetime.html#FUNCTIONS-DATETIME-ZONECONVERT). Estas referencias explican el mecanismo, no acreditan una ejecución en producción.

### Permisos y políticas

Owner administra agenda del estudio; profesional administra la propia. Alumno activo solo ve sesiones publicadas de profesionales vinculados y su historial autorizado. Nunca recibe listados de otros inscritos. Administrar agenda no concede acceso al chat ni a respuestas privadas de T10.

Disponibilidad de 5 minutos a 24 horas; sesión de 5 minutos a 12 horas, dentro de un bloque activo del profesional. Horizonte de 366 días, hasta 500 bloques/sesiones futuros activos por organización y 50 reservas futuras por alumno/organización. Cita: una plaza; clase: hasta 100. Antelaciones: 0–10080 minutos. La reserva del profesional puede hacerse hasta el inicio; la del alumno respeta antelación.

Cambiar una sesión con inscritos exige motivo de al menos 10 caracteres y conserva cupo/vínculos/ausencia de conflictos. Actualiza reservas y libera cancelación hasta el nuevo inicio. Cancelación excepcional del profesional exige motivo y marca tardía. Asistencia desde el inicio hasta 30 días después del fin. No hay multas ni cobros automáticos.

## Outbox y reglas

Mutaciones y outbox se confirman juntos. Referencias tipadas, sin cuerpos de mensajes ni respuestas. Tres reglas fijas, inicialmente pausadas: bienvenida al activar, próxima cita/clase y check-in pendiente. Configuración con versiones inmutables y revisión optimista; pausar/cambiar invalida trabajos de la versión anterior. Bienvenida conserva versión de activación y solo se emite si estaba habilitada; no reproduce alumnos históricos.

Se reutiliza `dev:followup`, cada minuto: hasta 100 fuentes de cita, 100 de check-in, 100 outbox y 50 entregas secuenciales. Cola `notification.internal`, clave única por outbox, lease y comprobación de propietario del lease. Entrega idempotente: una notificación por ejecución. Fallos técnicos tienen hasta tres intentos automáticos y tres reintentos manuales, sobre el mismo trabajo. Reintento no revive entregas descartadas o vencidas.

Al entregar se revisan permiso/vínculo/consentimiento, versión activa, preferencias, ventana y límite diario. Diferir por quiet hours o cupo diario no gasta intentos. Por defecto silencio 22:00–07:00 y máximo 10 avisos diarios por persona/organización, configurable de 1 a 20; inicio y fin iguales desactivan silencio. Las notificaciones son internas: no prueban recepción en un teléfono bloqueado.

La vista previa es de solo lectura, hasta 50 fuentes. Check-in exige acceso real a la conversación propia y consentimiento; el owner no obtiene respuestas ni IDs privados mediante el historial de reglas. Lista de ejecuciones limitada a 50, con destinatario de check-in oculto si corresponde a otro profesional.

## Datos y operación

Diez tablas de dominio `agenda_*`: disponibilidad, eventos, reservas, recibos, reglas, versiones, outbox, ejecuciones, preferencias y notificaciones. RLS forzada, acceso API mediante funciones controladas; funciones internas no ejecutables por API. `agenda_worker_state` solo guarda latido operativo.

Notificaciones se purgan tras 90 días. Reservas, recibos y ejecuciones mantienen historial técnico; la política definitiva de retención/ejercicio de derechos debe aprobarse antes del piloto. No se incorporan archivos privados nuevos. Backup incorpora diez conteos: **59 indicadores previstos (56 conteos y tres sumas)**; no se ha ejecutado otra copia o restauración T11. Monitor amplía latido y cola interna; no se presenta como monitor externo verificado.

## Aceptación y límites

[Acta T11](../evidencias/t11.md), [manual](../runbooks/t11-uso-y-operacion.md), [contratos](../runbooks/api-t11.md). Teléfonos físicos, instalación, HTTPS, despliegue, recuperación completa y validación de políticas siguen abiertos. Firma NAVZ sigue documentada para más tarde en su [pendiente](../pendientes/firma-navz.md).



## Actualización de alcance T13

La decisión vigente limita el producto a coaches independientes. Cualquier referencia previa a equipos, sedes, recepción o grupos formales como entrega T13 queda sustituida por [consolidación individual](../tandas/13-gimnasios.md); [multicoach se aplaza](../pendientes/gimnasios-futuro.md) fuera de las tandas actuales.

