# Contratos API — T04

**0.4.0 · 21-10-2026.** Base `B=/v1/organizations/{organizationId}`. Sesión/CSRF/tenant de T02, medios de T03. Schemas ejecutables en `apps/api/src/programs.ts`; tipos en `packages/shared/src/index.ts`, reglas compartidas en `programs.ts` del mismo paquete.

## Rutas

| Método / ruta relativa a B | Contrato |
|---|---|
| GET `/programs` | Staff: `{programs,nextCursor}`; `q,template,archived=false,cursor,limit` (1–50, defecto 20) |
| POST `/programs` | `{document}` → 201 `{program}`; borrador revisión 1 |
| GET `/programs/{id}` | Staff: `{program}` |
| PUT `/programs/{id}` | `{document,revision}` → `{program}` con revisión incrementada |
| POST `/programs/preview` | `{document}` → `{snapshot}` con biblioteca actual, sin guardar/publicar |
| POST `/programs/{id}/copy` | `{versionId:null|UUID}` → 201 `{program}` nuevo; de borrador o versión propia |
| POST `/programs/{id}/archive` | `{revision,archived:boolean}` → `{program}` |
| POST `/programs/{id}/publish` | `{revision}` → `{version}`; repetición de revisión devuelve el mismo ID |
| GET `/programs/{id}/versions` | Staff: `{versions,nextNumber}`; metadata sin snapshot, `beforeNumber,limit` (1–100, defecto 30) |
| GET `/program-versions/{id}` | `{version}` con snapshot y DTOs de medios autorizados; alumno solo si asignado |
| POST `/program-versions/{id}/assignments` | `{studentIds,startsOn,requestId}` → 201 `{assignments}`; todo el lote o ninguno |
| GET `/program-assignments` | `{assignments,nextCursor}`; filtros `studentId,state=all|active|cancelled,from,to,cursor,limit` (1–100, defecto 30); RLS limita alumnos |
| POST `/program-assignments/{id}/cancel` | `{revision,reason}` → `{success:true}` |

`from/to` seleccionan periodos que se cruzan con el intervalo de consulta. Cursor de programas/asignaciones es UUID del último registro visible, con orden compuesto estable; versiones usan número descendente. No hay endpoint para actualizar o borrar una versión publicada.

## Documento de borrador

```json
{
  "name": "Fuerza con intención",
  "description": "Objetivo revisado por el coach",
  "isTemplate": true,
  "weeks": [{
    "id": "UUID",
    "name": "Semana 1",
    "days": [{
      "id": "UUID",
      "name": "Fuerza y técnica",
      "weekday": 1,
      "notes": "Indicaciones del día",
      "exercises": [{
        "id": "UUID",
        "exerciseId": "UUID_DE_BIBLIOTECA",
        "notes": "Indicaciones de este ejercicio",
        "sets": [{
          "id": "UUID",
          "repsMin": 8,
          "repsMax": 12,
          "weightKg": null,
          "seconds": null,
          "distanceMeters": null,
          "restSeconds": 60,
          "rpe": null
        }]
      }]
    }]
  }]
}
```

Cada UUID de bloque es único dentro del documento y se conserva al editarlo. Duplicar bloques genera IDs nuevos. El ejemplo usa marcadores: sustituirlos por UUID reales antes de enviar.

Todos los campos son obligatorios. Nombre 2–100; descripción ≤1500; nombres de semana/día 1–80; notas de día/ejercicio ≤1000. Hasta 16 semanas, siete posiciones distintas 1–7 por semana, 20 ejercicios/día, 12 series/ejercicio y 1500 series en total. Borrador DB ≤220 000 bytes, cuerpo HTTP ≤240 000. El snapshot publicado admite ≤2 000 000 bytes para conservar las instrucciones repetidas por semana.

Series: repeticiones enteras 1–999 y mínimo ≤máximo; kg 0–1000 o `null`; segundos enteros 1–86400 o `null`; distancia 1–100000 m o `null`; descanso entero 0–1800 s; esfuerzo 1–10 o `null`. Publicar exige los objetivos de la métrica real del ejercicio. `null` significa no prescrito; no sustituirlo por cero.

`weekday` es posición relativa, no día ISO de la semana. Fechas de consulta/asignación se devuelven como cadenas `YYYY-MM-DD`. El final inclusivo se calcula como inicio + semanas×7−1.

## DTO y snapshot

`program`: `id,document,revision,archived,createdAt,updatedAt,publishedCount,latestPublishedRevision`.

`version`: `id,programId,number,sourceRevision,snapshot,createdAt`. El snapshot mantiene la estructura y añade a cada ejercicio los textos/equipo/metric y referencias de medios congelados. GET resuelve `media/photo` como DTO privado, sin claves de storage. Las URLs siguen exigiendo sesión y permiso en cada solicitud.

`assignment`: `id,versionId,studentId,studentName,programName,versionNumber,startsOn,endsOn,state,revision,cancellationReason`. `active` es autorización vigente; no acredita que una sesión haya empezado o terminado. Cancelación conserva el historial del coach.

## Concurrencia, acceso y errores

- Guardar exige revisión actual. Publicar bloquea programa y usa unicidad `(programId,sourceRevision)` para recuperar el mismo resultado bajo concurrencia.
- Asignar requiere owner/coach con permiso sobre todos los alumnos, activos y con cuenta aceptada. De 1 a 100 IDs sin duplicados; organización/versión válidas, suscripción vigente, inicio desde hoy−90 hasta hoy+366 en Asunción.
- `requestId` único por organización y contenido normalizado del lote. No cambiarlo al reintentar una respuesta perdida; sí cambiarlo si cambia versión/fecha/alumnos. Repetir contenido devuelve registros originales, aunque luego se hayan cancelado.
- Restricción de exclusión impide solapar periodos activos. Un fallo revierte todo el lote. Cancelar requiere motivo de 3–200 caracteres y revisión actual.
- Borradores solo staff; alumno solo sus versiones/asignaciones autorizadas. Conocer un UUID no habilita consulta. El permiso de una rutina no comparte toda la biblioteca.

| Código | HTTP / recuperación |
|---|---|
| `STALE_PROGRAM` | 409: recargar revisión y reconciliar cambios |
| `INVALID_PROGRAM` | 400: corregir estructura/objetivos/fecha |
| `PROGRAM_NOT_FOUND`, `VERSION_NOT_FOUND`, `ASSIGNMENT_NOT_FOUND` | 404: no disponible para este actor |
| `MEDIA_NOT_READY` | 409: esperar conversión o retirar la referencia |
| `INVALID_REFERENCE` | 400: sustituir ejercicio/equipo inválido |
| `ASSIGNMENT_OVERLAP` | 409: otro periodo activo se cruza; cancelar o cambiar fecha |
| `IDEMPOTENCY_CONFLICT` | 409: solicitud usada con otro contenido |
| `STUDENT_NOT_FOUND` | 404: alumno inexistente/no gestionable/no activo |
| `SUBSCRIPTION_INACTIVE` | 403: revisar trial/plan antes de asignar |
| `MEDIA_REFERENCED` | 409 al eliminar medio de una publicación histórica |

Auditoría: creación/guardado/copia/archivo/publicación/asignación/cancelación. Las operaciones no producen sesiones realizadas ni facturación nueva. [Uso y recuperación](t04-uso-y-operacion.md).
