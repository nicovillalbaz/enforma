# API T05 — Sesiones del alumno

**Versión:** 0.5.0. Cookies de sesión y CSRF de T01/T02; organización autorizada y RLS en cada operación. Prefijo `B=/v1/organizations/{organizationId}/workouts`. [Decisiones y límites](../decisiones/005-sesiones-y-sincronizacion.md).

| Método/ruta | Entrada | Respuesta |
|---|---|---|
| POST `B/prepare` | `{assignmentId,weekId,dayId}` | `{session}`; idempotencia por día de asignación |
| GET `B/:id` | UUID de sesión | `{session}` con snapshot del día, objetivos y realizaciones |
| GET `B` | `studentId?`, `before?` (UUID del último elemento), `limit=1..50` (20 por defecto) | `{sessions,nextBefore}`; alumno propio o alumnos gestionados por el coach |
| POST `B/:id/events` | Evento descrito debajo | `{receipt,session}`; interpretar `receipt.status` |

Preparar y enviar eventos requiere rol alumno. Lectura permite alumno propio, owner o coach que gestiona ese alumno; otro estudio/alumno recibe 404. No se acepta un `userId` ni `organizationId` dentro de la intención como autoridad.

## Evento

```json
{
  "clientEventId": "uuid-generado-una-sola-vez",
  "deviceId": "uuid-del-dispositivo",
  "command": {
    "kind": "set.save",
    "expectedRevision": 0,
    "clientOccurredAt": "2026-10-21T13:00:00.000Z",
    "entryId": "uuid-del-ejercicio-en-el-dia",
    "setId": "uuid-de-la-serie-prescrita",
    "actual": {
      "weightKg": 42.5,
      "reps": 9,
      "seconds": null,
      "distanceMeters": null,
      "rpe": 7,
      "note": "Movimiento controlado"
    }
  }
}
```

Los UUID de ejemplo se sustituyen por UUID válidos; `entryId` es la instancia del ejercicio en ese día, no su ID de biblioteca. Los cinco campos numéricos de `actual` deben existir, con `null` si no están indicados. Unidades ajenas a la métrica deben ser `null`. No enviar cadenas numéricas, `NaN` ni campos vacíos como `""`.

| `kind` | Campos adicionales | Revisión esperada |
|---|---|---|
| `session.start` | Ninguno | Sesión |
| `set.save` | `entryId,setId,actual` | Serie |
| `set.undo` | `entryId,setId` | Serie |
| `session.note` | `notes` | `notesRevision` |
| `session.complete` | `notes,durationSeconds,allowPartial` | Sesión |
| `session.reopen` | `reason` | Sesión |

Todos incluyen `expectedRevision` entero y `clientOccurredAt` ISO. La hora del cliente es declarativa; autorización y ventana de corrección se calculan en servidor. El recibo incluye `clientEventId,status,code,sessionRevision`.

## Reintentos y conflictos, paso a paso

1. Generar UUID y guardar evento completo en IndexedDB. Mantener contenido exacto mientras esté pendiente.
2. Enviar el primer evento de la cola. HTTP 200 con `accepted`: confirmar estado recibido y quitar solo ese UUID.
3. Si se pierde la respuesta, repetir exactamente UUID y contenido. El recibo es el original; la sesión adjunta puede ser más reciente.
4. `rejected`: conservar intención, actualizar base confirmada y detener cola. `SET_CONFLICT` requiere elegir valores; `SESSION_CONFLICT` requiere revisar notas/estado/cierre.
5. Al decidir aplicar un cambio contra la revisión actual, crear **otro UUID**. Repetir uno rechazado devuelve su rechazo original.
6. `WORKOUT_ACCESS_REVOKED`: conservar/exportar pendientes y consultar al coach; no cambiar de asignación automáticamente. `WORKOUT_STATE`: revisar estado y, si corresponde, reabrir con motivo antes de editar.

Otros códigos: `WORKOUT_EMPTY`, `WORKOUT_INCOMPLETE`, `WORKOUT_SET_NOT_FOUND`; de estructura/HTTP: `INVALID_WORKOUT` 400, `WORKOUT_NOT_FOUND` 404, `WORKOUT_DATE` 409, `WORKOUT_EVENT_LIMIT` 409 e `IDEMPOTENCY_CONFLICT` 409. 401/403 de identidad/perfil requieren volver a verificar acceso, nunca borrar pendientes automáticamente.

## DTO y privacidad

`session`: IDs de organización/alumno/cuenta/asignación/versión/semana/día, fecha sin conversión horaria, nombres/versiones, `prescription`, estado/revisión, notas/revisión, hora inicial declarada, cierre, duración declarada, `accessActive` y `sets`.

Cada serie contiene posición, métrica, `target` inmutable, estado, revisión y `actual`. URLs de medios son privadas y conservan cookies/GET/HEAD/Range de T03; no se incluyen claves de almacenamiento. El día histórico permanece consultable tras cancelar; el programa completo deja de estar autorizado. El historial del coach contiene únicamente hechos aceptados, nunca la cola de un dispositivo.
