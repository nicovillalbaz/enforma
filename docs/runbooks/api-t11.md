# API T11 — Agenda y reglas

**v0.11.0 / migración 020.** Raíz `B = /v1/organizations/:organizationId/agenda`. Cookie de sesión, organización activa, CSRF para mutaciones y respuestas privadas `no-store`; JSON estricto. UUIDs de cliente para crear bloques/sesiones. `revision=0` al crear; la lectura devuelve revisión vigente.

## Contrato de comandos

Todas las mutaciones de dominio llevan `requestId` UUID, con excepción de marcar notificaciones leídas. Mismo requestId y contenido exacto devuelve recibo; contenido distinto entra en conflicto. Repetir solo la intención pendiente. Cancelar y volver a reservar requiere un nuevo requestId. Recibos antiguos no reactivan reservas canceladas.

`Timing = {timezone, localStartsAt, localEndsAt}`: zona IANA del estudio y horas `YYYY-MM-DDTHH:mm`. Instantes `startsAt/endsAt` RFC3339 con Z u offset explícito. Servidor contrasta instantes con las horas locales; desajuste devuelve 409. No inferir offset fijo de Paraguay.

| Método/ruta desde B | Cuerpo o consulta | Resultado/permiso |
|---|---|---|
| GET raíz | `from,to` fechas opcionales, hasta 31 días; `professionalId?`, `cursor?`, `mine=1?` | Zona/hoy/studentId, eventos 100, nextCursor, bloques 100 y availabilityTruncated, profesionales, 30 avisos propios, preferencias, workerOnline |
| PUT `/availability/:id` | requestId, revision, professionalId, startsAt, endsAt, location, Timing | Crear/editar bloque; owner o profesional propio |
| POST `/availability/:id/cancel` | requestId, revision | Cancelar si no hay sesiones activas |
| PUT `/events/:id` | requestId, revision, document, reason, Timing | Crear/editar; motivo mínimo 10 si ya hay inscritos |
| GET `/events/:id?q=texto` | Búsqueda opcional | event, bookings hasta 200 priorizando activos, people vinculados hasta 50; alumno recibe arrays vacíos |
| POST `/events/:id/book` | requestId, studentId | Alumno propio o gestión de alumno vinculado; capacidad transaccional |
| POST `/events/:id/cancel` | requestId, revision, reason (10–300) | Cancela sesión y reservas, prepara avisos |
| POST `/bookings/:id/cancel` | requestId, revision, reason | Alumno dentro del plazo; profesional excepción motivada |
| POST `/bookings/:id/attendance` | requestId, revision, state | pending/attended/absent; gestión, inicio hasta fin +30 días |
| PUT `/preferences` | requestId, revision, document | Preferencias propias del estudio |
| POST `/notifications/read` | ids UUID[] (1–50) | Lectura solo de avisos propios |
| GET `/rules` | — | Tres reglas y últimas 50 ejecuciones; owner |
| POST `/rules/:id` | requestId, revision, enabled, leadMinutes | Publica versión inmutable, owner |
| GET `/rules/:id/preview` | — | Hasta 50 fuentes, sin mutar; owner con acceso específico a check-ins |
| POST `/runs/:id/retry` | requestId, revision | Solo fallo técnico vigente, máximo tres reintentos; owner |

## Documentos

`event.document`:

```json
{
  "professionalId": "UUID", "availabilityId": "UUID", "kind": "class",
  "title": "Fuerza en grupo", "instructions": "Traer agua", "location": "Sala principal",
  "startsAt": "2026-11-02T13:00:00Z", "endsAt": "2026-11-02T14:00:00Z",
  "capacity": 8, "bookingLeadMinutes": 60, "cancelLeadMinutes": 120, "published": true
}
```

`kind`: appointment/class; cita exige capacidad 1, clase 1–100. title 2–100, instructions hasta 1500, location hasta 200. Antelación 0–10080 minutos. Enviar `reason:""` en creación sin inscritos. Revisar hora local real del estudio al construir Timing del ejemplo.

`preferences.document`: booleanos `booking, change, reminder, welcome, checkin`; `quietStart, quietEnd` minutos desde medianoche 0–1439; `dailyLimit` 1–20. No enviar revision dentro de document. Primera revisión ausente se representa con 0.

Reglas: welcome, appointment.soon, checkin.pending. leadMinutes 5–10080 para reglas temporales; bienvenida no usa el intervalo como temporizador. UI envía valor vigente. owner no puede consultar respuestas o conversaciones privadas mediante este API.

## Respuestas y errores

Leer el estado devuelto/recargar tras comando. `AgendaEvent` incluye cupo/confirmados, canManage/canBook, revisión, cancelled y ownBooking (solo propia). ownBooking conserva estado, asistencia, cancelUntil y marca tardía. Nunca derivar autorización del rol visible en frontend.

Errores de dominio: inválido, no encontrado, revisión obsoleta, disponibilidad, capacidad, plazo, reserva ya existente, motivo, vínculo, límite, bloque referenciado y reintento. Solapamiento es 409 `AGENDA_OVERLAP`; conversión de zona 409 `AGENDA_TIMEZONE`; cursor inválido 400. Contexto/CSRF/permisos conservan el contrato común. El error no revela personas de otro estudio. [Manual](t11-uso-y-operacion.md), [ADR](../decisiones/011-agenda-y-avisos-internos.md).
