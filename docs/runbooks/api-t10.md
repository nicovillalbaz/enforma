# API T10 — Chat y seguimiento

Base: `/v1/organizations/:organizationId/followup`. Sesión por cookie, tenant validado, mutaciones con Origin permitido y CSRF. JSON estricto, UUID y fechas ISO. No guardar respuestas ni adjuntos en caché. [ADR](../decisiones/010-chat-y-seguimiento-privados.md), [uso](t10-uso-y-operacion.md).

## Acceso y lecturas

| Método/ruta | Contrato |
|---|---|
| `GET /` | `q?`, `cursor?`, `notificationCursor?`; 30 conversaciones, 30 avisos, contactos vinculados (hasta 100), preferencias, heartbeat y disponibilidad de reserva PDF |
| `POST /threads` | `{studentId,professionalId}`; abre o reutiliza la pareja autorizada; devuelve `{id}` |
| `GET /threads/:id/messages` | `before?` o `after?` (secuencias, excluyentes); 40 mensajes ordenados, thread, settings, hasMore |
| `POST /threads/:id/read` | `{seq}` monotónica, no supera lastSeq, marca avisos anteriores; no emite invalidación de lectura |
| `PUT /threads/:id/settings` | `{revision,muted,trackingConsent}`; solo el alumno puede activar consentimiento, cada usuario tiene revisión propia |
| `PUT /preferences` | `{revision,message,checkin,comment}`; revisión por usuario/organización |
| `POST /notifications/read` | `{ids:UUID[]}` hasta 50; solo avisos propios accesibles |

Cursores de listas: base64url del par `[timestamp,id]` devuelto por la API. No fabricarlos con offsets. Los contactos se filtran por nombre; abrir un contacto que ya existe no crea otro hilo. El rol owner no elude la pareja privada. Al retirar el vínculo, el profesional pierde acceso y el alumno conserva lectura histórica permitida.

## Mensajes y tiempo real

`POST /threads/:id/messages`: `{clientId,body,attachments:UUID[]}` → `{id,seq}`. Hasta 4.000 caracteres y 3 adjuntos propios listos y sin usar. Misma intención/UUID devuelve el mismo resultado; hash distinto produce `IDEMPOTENCY_CONFLICT`. No se revive un mensaje retirado al reintentarlo.

`POST /messages/:id/withdraw`: solo autor durante 15 minutos. Retira contenido y revoca adjuntos.

`GET /threads/:id/socket` con upgrade WebSocket, cookie de sesión y Origin exacto permitido. No utiliza tokens en URL. Emite `{type:'invalidate'}` y `{type:'heartbeat'}` sin contenido. Registrar el plugin antes de rutas y listeners del socket sin `await`; autenticar en preValidation. Validación de acceso por evento/30 segundos; TTL de 15 minutos. Máximo 3 sockets/usuario, 100/proceso, payload 2 KiB, sin compresión. Mensajes de cliente cierran con 1008; permiso revocado cierra con 1008. El cliente recupera por HTTP; desconexión no deshace un mensaje confirmado.

Los avisos SQL se entregan después del commit. Deben deduplicarse por conversación, usuario, categoría y evento. No deduplicar solo por secuencia: cada conversación tiene su propio contador.

## Adjuntos

| Método/ruta | Entrada/resultado |
|---|---|
| `POST /threads/:id/attachments` | `{requestId,kind,name,bytes,versionId}`; kind image/video/audio/pdf/resource; devuelve id/attachment |
| `PUT /attachments/:id/upload` | `application/octet-stream`, cookie/CSRF; stream de tamaño exacto declarado; 60 s; reserva y contexto comprobados antes de leer el stream |
| `GET /attachments/:id` | Estado autorizado; sin storage keys |
| `POST /attachments/:id/revoke` | Revoca descarga y cancela trabajo pendiente |
| `GET /attachments/:id/file` | Sesión y ACL actuales; `poster=1` opcional; bytes, rangos 206/416, MIME fijo, no-store/nosniff |
| `GET /threads/:id/resources` | Hasta 50 versiones elegibles de recursos ya compartidos, del profesional de esa conversación |

Los archivos usan `versionId:null`; recursos usan `bytes:0` y versión UUID. Imagen/audio/PDF hasta 5 MiB, vídeo hasta 20 MiB; audio/vídeo hasta 60 segundos. No se utiliza la ruta de biblioteca para cargar como alumno. Los medios de seguimiento están excluidos de la lectura/acción de biblioteca y no pueden envolverse como nuevos recursos T08.

PDF se reserva solo si hay scanner configurado y permanece privado/no listo hasta resultado limpio. Reutilizar un recurso no amplía su ACL; se comprueba permiso original en cada descarga. PDF usa Content-Disposition attachment y CSP sandbox. No se devuelven enlaces públicos ni tickets portables.

## Hábitos

- `GET /threads/:id/tracking`: documentos de hábitos, entradas desde 14 días anteriores, plantillas propias, programaciones y tareas del intervalo −14/+31 días. Incluye `trackingAllowed`, `recordingAllowed` y `truncated`. El alumno conserva su lectura propia, aunque `recordingAllowed` sea falso; el profesional necesita consentimiento para entradas/respuestas.
- `POST /threads/:id/habits`: `{id,document:{name,kind,target,weekdays,instructions},startsOn,endsOn}`. Solo profesional de la pareja; kind check/water/sleep/energy, target nullable (check requiere 1), weekdays ISO 1–7 únicos. Snapshot fijo; ID de intención idempotente.
- `PUT /habits/:id/entry`: `{day,value,note,revision,requestId}`. Solo alumno propio, vínculo escribible, consentimiento vigente, fecha programada entre hoy−14 y hoy. `value:null` conserva ausencia; 0 no es ausencia. CAS y hash del reintento.
- `POST /assignments/:id/cancel`: `{kind:'habit'|'checkin',revision}`; solo profesional de la pareja.

Rangos técnicos: agua 0–20 L, sueño 0–24 h, energía entera 1–5, check 0/1. Son validaciones de entrada, no recomendaciones. Máximo 20 hábitos activos por conversación y asignación hasta 366 días.

## Check-ins

| Método/ruta | Entrada |
|---|---|
| `PUT /templates/:id` | `{revision,document:{name,description,fields}}`; borrador del profesional, hasta 12 campos |
| `POST /templates/:id/publish` | `{revision}` → `{id}` de versión inmutable; publicar misma revisión es idempotente |
| `POST /threads/:id/schedules` | `{id,versionId,frequency,weekday,monthDay,windowDays,startsOn,endsOn}` |
| `PUT /tasks/:id/response` | `{revision,requestId,answers,declined}` → `{id}` de respuesta |
| `POST /responses/:id/review` | `{requestId,review}`; profesional con consentimiento, cierre de edición |

Campo: `{id,label,type,required,min,max,options,unit}`. IDs UUID únicos; min/max nullable; options array; type text/number/scale/choice/boolean/attachment. Escala exige extremos enteros; opción exige opciones válidas. Una respuesta no admite IDs de preguntas ajenas; attachment requiere UUID propio/listo de esa conversación. Vacío de un campo opcional no se transforma en cero. JSON con número/booleano/null mantiene su tipo (unión de tipos AJV); `anyOf` coercitivo no debe sustituirlo.

Semanal: weekday ISO. Mensual: day 1–31 ajustado al último día del mes. Ventana 1–14, hasta 10 programaciones activas, periodo hasta 366 días. `app.followup_schedule_tick()` solo para worker, lote hasta 100 por minuto y lock asesor; el cliente no puede disparar trabajo arbitrario ni ejecutar helpers internos.

Respuesta editable en ventana y sin revisión, con CAS. Declinar usa `answers:{},declined:true` y no requiere consentimiento. Revisión de 1–1.000 caracteres, idempotente con mismo UUID/contenido, una vez por respuesta. Modificar un borrador no afecta a tareas antiguas.

## Errores y conservación

`FOLLOWUP_NOT_FOUND` 404 evita revelar conversaciones/archivos ajenos; `FOLLOWUP_CONSENT` 403; `INVALID_FOLLOWUP` 400; `STALE_FOLLOWUP` e `IDEMPOTENCY_CONFLICT` 409; `FOLLOWUP_DATE` 409 cuando fecha/cancelación/revisión cierra escritura; `FOLLOWUP_LIMIT` 429. Se reutilizan `MEDIA_*`, cuota/cola, `INVALID_REFERENCE`, `SUBSCRIPTION_INACTIVE` y scanner no disponible 503.

Conservación técnica: contenido 180 días, avisos 90 y cargas sin usar 24 horas; retirada del autor en 15 minutos. La descarga comprueba retención aunque aún no haya corrido la limpieza. Metadatos de secuencia/idempotencia no se eliminan como el contenido. Revisar finalidad/condiciones y recuperación antes del piloto. [Acta](../evidencias/t10.md).
