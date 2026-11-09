# T11 — Agenda, clases y automatizaciones internas

**Depende de:** T10 para avisos y worker de T01. **Objetivo:** coordinar reservas y recordatorios dentro de la app.

**Resultado 22-10-2026:** implementada en local, v0.11.0, migración 020 aplicada; próxima 021. [Manual paso a paso](../runbooks/t11-uso-y-operacion.md), [API](../runbooks/api-t11.md), [ADR 011](../decisiones/011-agenda-y-avisos-internos.md), [acta y alcance de QA](../evidencias/t11.md). Las puertas externas permanecen abiertas.

| Tarea | Estado local | Entrega |
|---|---|---|
| T11-01 | Hecha | UTC/zona IANA, bloques, cita/clase, reservas, cancelación y asistencia; exclusiones globales y revisión |
| T11-02 | Hecha | Día/semana en lista, filtros, gestión y avisos de cambio; lista de espera diferida hasta necesidad del piloto |
| T11-03 | Hecha | Reserva/cancelación propia, cupo y ubicación; móvil lista o detalle, PC dos columnas |
| T11-04 | Hecha | Outbox transaccional, tres reglas versionadas, preferencias, quiet hours, límites y deduplicación |
| T11-05 | Hecha | Vista previa privada, publicar/pausar, historial y reintento técnico acotado; worker T10 reutilizado |
| T11-06 | Verificada de forma dirigida | Nueve integraciones y tres unitarias con evidencia aprobada; revisión Chromium acotada. Teléfonos/infraestructura/restore pendientes |

## Base recibida de T10

V0.10.0, migraciones 001–019; siguiente 020. [Chat y seguimiento](10-chat-habitos.md) aporta preferencias/avisos internos, idempotencia por evento, consulta privada y programador de lotes limitado. Conservar la privacidad de las parejas: gestionar una reserva no concede lectura de chat o respuestas. El contrato actual de avisos está ligado a conversación y tres categorías; extenderlo mediante migración/contrato explícitos para agenda, sin reutilizar categorías con otro significado ni crear conversaciones automáticas para notificar.

Agenda debe introducir outbox y reglas versionadas con quiet hours y límites propios; no atribuirlos al programador de check-ins ya entregado. Mantener avisos internos como canal base, Push opcional pendiente, sin SMS ni scripts arbitrarios. Preservar puertas físicas, scanner real, recuperación T08–T10 y piloto T07; solo verificaciones puntuales según [desarrollo](../runbooks/desarrollo.md).

## Pasos en orden

1. **T11-01 Modelo temporal.** Disponibilidad del profesional, sede opcional, cita/clase, cupo, reserva, cancelación y asistencia; almacenar instantes UTC y mostrar zona de organización. Definir antelación y política de cancelación.
2. **T11-02 Agenda coach.** Crear bloque disponible/cita/clase, editar con aviso a inscritos, ver semana/día y lista de espera simple si el piloto la pide. Prevenir doble reserva y sobrecupo en transacción.
3. **T11-03 Portal alumno.** Buscar hueco, reservar, cancelar y consultar estado, ubicación e instrucciones. Teclado/scroll y calendario deben funcionar en iPhone pequeño.
4. **T11-04 Motor de reglas.** Eventos outbox → reglas versionadas (bienvenida, cita próxima, check-in pendiente) → job con clave idempotente → notificación interna. Límites por usuario/día, quiet hours, preferencia y registro de ejecución.
5. **T11-05 Operación.** Pantalla de reglas, vista previa de destinatarios, pausar/reanudar y reintentar fallos sin duplicar. No aceptar scripts arbitrarios del coach.
6. **T11-06 QA.** Reservas simultáneas último cupo, horario de verano/zona, cancelación, cambio de clase, worker repetido y notificaciones fuera de preferencia.

## Aceptación y evidencia

Alumno reserva cupo, aparece en agenda de coach, recibe recordatorio interno una sola vez y se registra asistencia. Dos solicitudes simultáneas no exceden capacidad; no se necesita n8n/SMS para este flujo.

Asistencia se comprobó por API/integración con reloj de fixture; no se esperó una sesión real ni se atribuye a la revisión móvil. El recordatorio se observó en bandeja interna, sin Push ni envío externo. Backup amplía a 59 indicadores previstos, sin repetir restauración. [Firma NAVZ](../pendientes/firma-navz.md) sigue pendiente para más tarde.

## Orden siguiente

Continuar [T12](12-negocio-coach.md) sobre 0.11.0 / 001–020: servicios, membresías, CRM y pagos manuales. No cobrar automáticamente ni modificar factura SaaS o privacidad de seguimiento a partir de reservas/asistencia.
