# API T08 — Recursos privados

**0.8.0.** Sesión y CSRF existentes; validación de host por estudio, permisos SQL y RLS. `B=/v1/organizations/:organizationId`.

## Recursos y colecciones

| Método / ruta | Contrato |
|---|---|
| GET `B/resources?q=&collectionId=&before=` | 24 entradas por lote, cursor estable por fecha/ID y `nextBefore`. Solo visibles/administrables, sin bytes ni claves de almacenamiento |
| GET `B/resources/capabilities` | Staff: worker/renderer, escáner configurado, cuota conjunta y solicitudes del mes del estudio |
| GET `B/resource-sources?q=&studentId=` | Staff: hasta 100 alumnos activos administrables, `moreStudents`, 100 versiones publicadas y 50 asignaciones activas del alumno seleccionado |
| GET `B/resource-collections` | Colecciones permitidas. Un alumno no recibe metadatos de una colección asociada a otra ficha |
| POST `B/resource-collections` | `{name,description,studentId:null|uuid,programVersionId:null|uuid}` |
| PUT `B/resource-collections/:id` | Los campos anteriores y `revision`; creador o owner, con revisión |
| POST `B/resources` | `{requestId,name,description,collectionId:null|uuid}`; idempotente por estudio/requestId, devuelve `resource,versions,grants` |
| GET `B/resources/:id` | Detalle y versiones; concesiones solo al gestor autorizado |
| PUT `B/resources/:id` | `{revision,name,description,collectionId,archive}`; `archive:true` retira acceso y cancela preparaciones, conserva hechos |
| POST `B/resources/:id/access` | `{studentId,grant}`; solo alumno administrable, recurso del creador/owner, sujeto personal coincidente |
| POST `B/resource-collections/:id/access` | Igual; aplica atómicamente a recursos actuales, no a incorporaciones futuras |

Nombres 2–100 y descripción hasta 1.500 caracteres. Relaciones usan claves compuestas por organización. Una relación con ficha/programa no equivale a conceder acceso. El coach asignado no puede abrir un recurso privado de otro creador por el solo hecho de administrar al alumno; owner sí puede administrarlo.

## Versiones y cola

POST `B/resources/:id/versions` lleva `requestId` y:

| `kind` | Campos adicionales |
|---|---|
| `media` | `mediaId` listo, propio o administrable por owner; reutiliza bytes |
| `upload` | `bytes` 1–10.485.760; requiere ClamAV configurado; devuelve reserva |
| `routine` | `studentId,assignmentId` activo; captura versión publicada |
| `history` / `report` | `studentId,from,to` en formato fecha, hasta 90 días inclusive, sin fecha futura |

Devuelve `versionId` y detalle. Idempotencia compara intención; cambiar contenido con el mismo UUID devuelve conflicto. Versiones conservan snapshot, fuente, número, plantilla, autor y fecha. Los datos históricos no se reescriben al terminar un trabajo.

- PUT `B/resources/:id/versions/:versionId/content`: `application/octet-stream`, bytes exactos de la reserva, hasta 10 MiB. Se comprueba firma/fin PDF y se encola; **eso no acredita escaneo limpio**. Un upload simultáneo por proceso. Archivo inválido no se publica y el recurso anterior se conserva.
- POST `…/retry`: reintento explícito de versión fallida, misma fuente/snapshot y máximo de seis intentos totales. Sin duplicar versión ni solicitud mensual.
- POST `…/cancel`: cancela preparación reservada/en cola/procesando, conserva recurso y versión disponible. Bytes recibidos conservan retención.

Estados: `reserved,pending,processing,ready,failed,rejected,purged`. Generación solo desde HTML/CSS propio escapado, sin JavaScript ni tráfico de red del documento. El informe captura únicamente resumen/semanas/ejercicios; no incluye permisos de fotos/medidas ni configuración privada de avisos.

## Entrega temporal

1. POST `…/link` valida usuario/recurso/versión ready; emite cookie `forma_resource_ticket`, HttpOnly, SameSite Strict, Secure en producción, Path de ese archivo, 300 s. Devuelve `{url,expiresAt}` sin token en URL.
2. GET `…/file` requiere sesión, cookie temporal vinculada al usuario y permiso vigente. `?download=1` fuerza adjunto; un PDF subido siempre es adjunto. Admite rango único y devuelve 416 ante rango inválido.
3. Respuesta `private, no-store`, MIME fijo validado, `nosniff` y sandbox CSP para PDF. Clave privada nunca se convierte en ruta pública. Cada apertura/rango autorizado registra ID de recurso/versión, sin copiar contenido sensible al log.
4. Revocar, archivar, pausar o suspender se comprueba en cada solicitud; un vínculo previo no mantiene acceso. Una descarga ya completada no puede revocarse del dispositivo.

## Errores principales

`RESOURCE_NOT_FOUND` 404, `INVALID_RESOURCE` 400, `STALE_RESOURCE` 409, `RESOURCE_LINK_EXPIRED` 403, `RESOURCE_LIMIT` / `RESOURCE_MONTHLY_LIMIT` 409, `MEDIA_QUOTA` 409, `MEDIA_QUEUE_FULL` / `RESOURCE_BUSY` 429, `SCANNER_UNAVAILABLE` 503, `INVALID_PDF` 400. Errores de fecha y estructura devuelven datos inválidos; no se exponen mensajes SQL al cliente.

[Operación](t08-uso-y-operacion.md) · [ADR](../decisiones/008-recursos-y-pdf.md) · [Pruebas](../evidencias/t08.md).
