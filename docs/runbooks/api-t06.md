# API T06 — Progreso, mediciones y fotos privadas

**Versión 0.6.0 · local · 21-10-2026.** Todas las rutas requieren sesión y organización activa; escrituras con cookie y `x-csrf-token`. Mantener el contrato de [T02](api-t02.md) y los [errores de T05](api-t05.md). Respuestas sin caché; los archivos añaden `private, no-store`.

Base `P=/v1/organizations/:organizationId/progress`. Los UUID se validan y el rol se comprueba en servidor y DB; no confiar en parámetros del navegador.

| Método/ruta | Contrato |
|---|---|
| GET `P?q=&cursor=&limit=20` | Owner: alumnos gestionables; coach: asignados. Máximo 50 por página. Sesiones/volumen últimos 28 días y actividad; no devuelve mediciones ni fotos. `students,nextCursor` |
| GET `P/:studentId?from=2026-10-01&to=2026-10-21` | Alumno propio o profesional autorizado al alumno. Periodo inclusivo hasta 366 días y hasta hoy en Paraguay. `metrics`: resumen, semanas, comparación, ejercicios, tendencia, acceso a datos privados y actividad |
| GET `P/:studentId/privacy` | Solo alumno propio. `privacy`: revisión, consentimiento y profesionales elegibles con permisos actuales |
| PUT `P/:studentId/privacy` | Solo alumno propio. Reemplazo completo de permisos con revisión; devuelve configuración confirmada |
| PUT `P/:studentId/alert` | Profesional con acceso al alumno. `{revision,days:7..90,enabled:boolean}`. Configuración propia, independiente de otros profesionales |
| GET `P/:studentId/measurements?kind=weight&from=&to=&cursor=&limit=50` | Propio o permiso explícito de mediciones. Máximo 100, orden fecha/UUID descendente; incluye anulaciones. `measurements,nextCursor` |
| GET `P/:studentId/measurements/trend?kind=weight&from=&to=` | Permiso de mediciones, máximo 366 días. Último valor válido por fecha; excluye anulaciones, orden ascendente. `points:[{date,value}]` |
| POST `P/:studentId/measurements` | `{requestId,kind,value,measuredOn}`. Positivo finito, número JSON real; origen/creador derivados en servidor. Devuelve `measurement` (201), mismo ID al repetir |
| POST `P/:studentId/measurements/:id/void` | `{reason}` de 3–200 caracteres. Alumno puede anular los propios/de profesionales; profesional solo los creados por él con permiso vigente. No altera el valor original |
| GET `P/:studentId/photos?cursor=&limit=12` | Consentimiento vigente y alumno propio o permiso de fotos. Máximo 30; `photos,nextCursor`. Solo activas, sin claves de disco |
| POST `P/:studentId/photos` | Solo alumno propio con consentimiento. `{requestId,measuredOn,caption,dataUrl}`. Descripción hasta 200 caracteres; PNG/JPEG/WebP base64, entrada hasta 2 MB/8 MP sin animación. 201 y `photo` |
| DELETE `P/:studentId/photos/:id` | Solo alumno propio; retirada inmediata y depuración posterior. `{success:true}` |
| GET `P/:studentId/photos/:id/file?variant=thumbnail` | Autorización vigente en cada petición; WebP privado. Sin variante entrega versión normalizada, con variante miniatura. No es una ruta de biblioteca ni un enlace público |

## Ejemplos de escritura

```json
{
  "revision": 0,
  "photoConsent": true,
  "professionals": [
    {"id": "UUID-del-profesional-elegible", "measurements": true, "photos": false}
  ]
}
```

La lista de profesionales procede de GET privacidad: responsables y coaches activos asignados. Omitir uno retira sus permisos. El permiso de mediciones permite lectura/registro y anulación de creaciones propias; fotos solo lectura para profesionales. Retirar el consentimiento maestro también retira todas las fotos activas; reactivarlo no las recupera.

```json
{
  "requestId": "UUID-nuevo-por-intencion",
  "kind": "weight",
  "value": 70.5,
  "measuredOn": "2026-10-21"
}
```

`weight` usa kg (máximo técnico 500). `waist,hip,chest,arm,thigh` usan cm (máximo técnico 300). Fechas de registro: últimos 1.826 días hasta hoy; no aceptar futura. Un UUID repetido con contenido diferente devuelve conflicto, nunca otra medición. Las fechas se transmiten `YYYY-MM-DD`, sin convertir a medianoche local. Estos límites validan entradas, no representan criterios de salud.

## Semántica de métricas

Aplicar [ADR 006](../decisiones/006-progreso-y-privacidad.md) y [fixture manual](../evidencias/t06-calculos.md). `volumeKgReps` suma kg × rep; `unweightedSets` informa carga no indicada. Cero no equivale a `null`. `recordedSets` incluye también tiempo/distancia, cada marca conserva su unidad. `dateBasis=scheduled_on`, semanas empiezan el lunes. `expectedDays/completedDays` cuentan fechas distintas, no número de sesiones.

`exerciseId` opcional limita la serie temporal devuelta; resumen y lista de ejercicios siguen describiendo el periodo completo. El selector de la interfaz filtra el conjunto ya agregado, sin pedir una consulta por ejercicio. Última actividad usa cierre real del servidor, distinto del día programado.

## Errores y límites

- `INVALID_PROGRESS` 400: fechas, unidad, tipo o valor incorrectos; `STALE_PROGRESS` 409: revisión antigua, volver a consultar antes de editar.
- `PROGRESS_PRIVATE` 403: profesional sin permiso de mediciones/listado privado. Archivo privado no visible: 404; organización ajena: 404. No inferir existencia por un ID.
- `PROGRESS_PHOTO_REMOVED` 409: reintento de una foto ya eliminada, incluso después de depurar bytes; no se recupera.
- `IDEMPOTENCY_CONFLICT` 409: mismo UUID con otro contenido. Conservar UUID al reintentar la misma intención; generar otro para una acción diferente.
- `PHOTO_CONSENT_REQUIRED` 403, `INVALID_PHOTO` 400/413 y `PHOTO_BUSY` 429. Dos transformaciones simultáneas como máximo por proceso API; transformación principal acotada a cinco segundos, lado máximo 1280 y miniatura 320. No se conserva el original ni EXIF.
- `MEDIA_QUOTA` 409: presupuesto conjunto de biblioteca, logos y fotos, incluidas reservas/retención. `PROGRESS_LIMIT` 409: 20.000 mediciones o 100 registros históricos de fotos por alumno. Depurar bytes no elimina auditoría ni reinicia ese límite de fotos; revisar retención antes de uso prolongado real.

## Historial T05 ampliado

GET `/v1/organizations/:org/workouts` admite `studentId,from,to,state,before,limit`; estado `planned|in_progress|completed`, máximo 50. Fechas válidas y ordenadas. Paginación por `(created_at,id)` con fila adicional para decidir `nextBefore`. Carga de sesiones/series/medios y bloqueo autorizado por lote: número de consultas constante por página. El alumno conserva su proyección local de T05 y aplica filtros también a esa proyección; los gráficos T06 usan exclusivamente confirmaciones del servidor.
