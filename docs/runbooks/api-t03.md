# Contratos API — T03

**Versión 0.3.0 · 21-10-2026.** Base `B=/v1/organizations/{organizationId}`. Reutiliza sesión opaca, CSRF y errores de [T02](api-t02.md). Contratos JSON completos en los schemas de `apps/api/src/library.ts`; OpenAPI `/v1/docs` solo en desarrollo.

## Autorización

La organización debe resolverse contra la identidad autenticada en cada petición. Mutaciones: owner/coach, con pertenencia activa y reglas comerciales aplicables. Alumno: catálogo global y guías propias publicadas con permiso explícito a su ficha activa. Las consultas de equipos/medios siguen ese alcance mediante RLS. La API no devuelve storage keys ni hashes privados. El catálogo global no admite escritura desde la API.

## Ejercicios y equipos

| Método y ruta relativa a B | Contrato |
|---|---|
| GET `/exercises` | `{exercises,nextCursor}`; filtros `q,muscle,origin=all\|own\|global,state=all\|draft\|published\|archived,equipmentId,cursor,limit` |
| GET `/exercises/{id}` | `{exercise}` si es visible |
| POST `/exercises` | Cuerpo completo de creación; 201 `{exercise}` |
| PUT `/exercises/{id}` | Cuerpo completo más `version`; `{exercise}`; 409 si cambió |
| GET `/exercises/{id}/students` | Staff: `{students:[studentId,…]}` |
| POST `/exercises/{id}/students` | `{studentId}`; exige guía propia publicada y alumno gestionable; idempotente |
| DELETE `/exercises/{id}/students/{studentId}` | Retira acceso; `{success:true}` |
| GET `/equipment` | `{equipment,nextCursor}`, `q,cursor,limit` |
| POST `/equipment` | Cuerpo completo; 201 `{equipment}` |
| PUT `/equipment/{id}` | Cuerpo completo más `version`; `{equipment}` |

Ejercicios: límite por página 1–100, defecto 30. Equipos: 1–100, defecto 50. Cursor opaco UUID del último registro visible; orden estable `(created_at,id)` descendente. No usar números de página. Los listados no implican permiso para consultar registros de otro estudio.

```json
{
  "name": "Remo del estudio",
  "instructions": "Instrucciones originales y revisadas por el coach.",
  "muscle": "Espalda",
  "equipmentTag": "Polea",
  "metric": "reps",
  "variations": ["Agarre neutro"],
  "tags": ["Técnica"],
  "state": "draft",
  "equipmentId": null,
  "mediaId": null
}
```

Todos los campos son obligatorios en POST/PUT; usar `null` en asociaciones vacías y `[]` en listas. Nombre 2–100, instrucciones 10–5000, músculo 2–60, material genérico ≤60, hasta ocho variaciones de 80 caracteres y ocho etiquetas de 40. `metric`: `reps|time|distance`. Estados: `draft|published|archived`. PUT añade la versión leída, sin incrementarla en el cliente.

Equipo: `{name,description,location,state,photoId}`; nombre 2–100, descripción ≤1000, ubicación ≤100, estado `available|maintenance|archived`, foto de imagen propia o `null`. Equipo/medio siempre pertenecen al mismo estudio que la guía. Claves compuestas refuerzan esto en DB.

## Carga y procesamiento

1. POST `B/media/uploads` con `{kind:"image"|"video",bytes:entero,requestId:UUID}`. Devuelve `{media}` con 201 al crear. El mismo UUID/parámetros recupera el medio existente; otros parámetros producen 409. Guardar el UUID en el cliente para reconciliar incertidumbre.
2. PUT `B/media/{id}/content`, `Content-Type: application/octet-stream`, cuerpo binario exacto y cabecera CSRF. No multipart ni base64 JSON. Tiempo de recepción ≤60 s; máximo 5 MiB imagen o 20 MiB vídeo. Devuelve **202 `{media}`** después de persistir original y job en transacción; esto no significa que sea reproducible.
3. GET `B/media/{id}` devuelve `{media}`. Consultar hasta `ready` o estado terminal. El worker verifica formato/duración, convierte y publica con lease vigente. El DTO incluye `id,kind,state,bytes,durationSeconds,width,height,version,errorCode,createdAt,url,posterUrl,processingMs`.
4. URL/póster son `null` hasta estar listo. Los errores de conversión no se presentan como error HTTP del upload ya aceptado: aparecen en estado `failed` y `errorCode`.

| Método y ruta | Contrato |
|---|---|
| GET `B/media` | Staff: `{media,nextCursor}`, `cursor,limit` |
| GET `B/media/usage` | Staff: `{usage}`; espacio, reservas, segundos, límites y disponibilidad reciente del worker |
| POST `B/media/{id}/retry` | Nuevo intento limitado y auditado; `{media}` |
| POST `B/media/{id}/cancel` | Cancela operación propia/owner; `{media}` |
| POST `B/media/{id}/delete` | Borrado lógico; falla si está asociado; `{media}` |

Reservas y cuotas se bloquean por organización. No reintentar indefinidamente ante 409/413/429; reconciliar primero el estado. Los originales son privados y no tienen endpoint de descarga.

## Entrega privada y rangos

GET o HEAD `B/media/{id}/file?v={version}` entrega el derivado; `variant=poster` pide el póster. Requiere sesión y autorización actual en cada petición, aunque se conozca la URL. `v` invalida una versión atrasada. `Content-Type` se fija con el formato normalizado; `Cache-Control: private, no-store` y `Accept-Ranges: bytes`.

- Sin Range: 200 con longitud total.
- Rango simple válido, por ejemplo `bytes=0-1`: 206 con `Content-Range` y longitud parcial.
- Rango inválido/múltiple/no satisfacible: 416.
- Sesión ausente: 401. Medio inexistente/no visible o versión inválida: denegación sin revelar su clave.
- Estado aún no listo: no se entrega el original como sustituto.

## Errores recuperables

| Código | Significado / acción |
|---|---|
| `STALE_RECORD` | 409: abrir ficha actualizada |
| `INVALID_REFERENCE` | 400: asociación inválida o de otro estudio |
| `MEDIA_QUOTA` | 409: cupo insuficiente |
| `MEDIA_QUEUE_FULL` | 429: cuatro cargas pendientes |
| `MEDIA_SIZE` | 413: bytes fuera del límite |
| `MEDIA_STATE` | 409: operación incompatible con estado actual |
| `MEDIA_REFERENCED` | 409: retirar asociaciones antes de eliminar |
| `IDEMPOTENCY_CONFLICT` | 409: UUID reutilizado con otros parámetros |
| `MEDIA_NOT_FOUND` | 404: no disponible para este actor |

En `failed`, códigos de worker como `MEDIA_FORMAT`, `MEDIA_CORRUPT`, `MEDIA_DURATION`, `MEDIA_DIMENSIONS`, `MEDIA_TIMEOUT` o `MEDIA_ENGINE_UNAVAILABLE` orientan la recuperación. Nunca exponer stderr, rutas de disco, payloads privados o credenciales al cliente. [Operación y recuperación](t03-uso-y-operacion.md).
