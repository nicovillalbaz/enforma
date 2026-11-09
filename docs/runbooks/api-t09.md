# API T09 — Alimentación

**v0.9.0 · migración 018.** Base `/v1/organizations/:organizationId/nutrition`. Sesión, CSRF en mutaciones, control de host/tenant y estado T02. Respuestas privadas no cacheables. No escribir directamente en tablas con el rol API.

## Rutas

| Método / ruta relativa | Contrato | Acceso |
|---|---|---|
| GET `?from=YYYY-MM-DD&to=YYYY-MM-DD&studentId=UUID&q=texto` | Estado: catálogo autorizado, alumnos, asignaciones, registros, privacidad propia e indicadores de acceso/truncamiento | Alumno propio; profesional habilitado y ficha administrable |
| GET `/professionals` | `{professionals:[{id,name,enabled,qualification,revision}]}`; vacío fuera de owner | Owner administra capacidad, sin lectura implícita del diario |
| PUT `/professionals/:id` | `{revision,enabled,qualification}` → `{ok:true}` | Owner; miembro activo owner/coach |
| PUT `/items/:id` | `{kind:'food'\|'recipe'\|'menu',revision,archived,document}` → `{ok:true}` | Profesional habilitado |
| POST `/menus/:id/publish` | `{revision}` → `{versionId}` | Profesional habilitado; misma revisión reutiliza versión |
| GET `/menus/:id/versions` | `{versions:[{id,number,sourceRevision,snapshot}]}` | Catálogo profesional; historial inmutable |
| PUT `/assignments/:id` | `{versionId,studentId,startsOn,endsOn}` → `{ok:true}` | Profesional + ficha activa administrable |
| POST `/assignments/:id/cancel` | `{revision,reason}` → `{ok:true}` | Profesional + ficha administrable |
| PUT `/privacy/:id` (ID de alumno) | `{revision,diaryConsent,photoConsent,professionals:[{id,diary,photos}]}` | Solo alumno propio; concesiones a profesionales habilitados/vinculados |
| POST `/entries` | `{assignmentId,eatenOn,mealId,requestId,revision,state,choice,portions,note}` → `{id}` | Alumno propio, consentimiento de diario |
| POST `/entries/:id/comments` | `{requestId,message}` → `{id}` | Profesional habilitado con permiso de diario |
| POST `/entries/:id/photos` | `{requestId,dataUrl}` → `{id}` (201) | Alumno propio, consentimiento de diario/fotos |
| DELETE `/photos/:id` | Sin cuerpo → `{ok:true}` | Alumno propio, aunque haya retirado consentimiento |
| GET `/photos/:id/file?thumbnail=1` | WebP privado, sesión y autorización por solicitud, auditoría de acceso | Alumno propio o profesional con concesión de fotos vigente |

`q` busca alumnos activos administrables (100 por resultado). `studentId` omitido selecciona la ficha propia del alumno; staff sin selección obtiene catálogo/alumnos sin diario de otra persona. Periodo máximo 90 días. Estado incluye `professional`, `selfStudentId`, `canReadDiary`, `canReadPhotos`, `foods`, `recipes`, `menus`, `assignments`, `entries`, `privacy`, `students`, `entriesTruncated`, `assignmentsTruncated`.

Se cargan como máximo 90 asignaciones (activas primero) y 540 registros, con flags si había más. No afirmar totales completos cuando sean parciales. La interfaz usa siete días. Catálogo inicial acotado a 200 alimentos/100 recetas/50 menús, con búsqueda local en sus fichas.

## Documentos del catálogo

### Alimento

```json
{
  "name": "Nombre y preparación exacta",
  "source": "Fuente comprobada",
  "reference": "Referencia o identificador verificable",
  "license": "Licencia/procedencia comprobada",
  "checkedOn": "2026-10-22",
  "nutrients": {"kcal": null, "protein": null, "carbs": null, "fat": null},
  "allergensKnown": false,
  "allergens": []
}
```

Valores por **100 g**; kcal o gramos según clave. `null` desconocido, 0 conocido. Fecha de revisión válida desde 2000 hasta hoy Paraguay. No se incorporan valores nutricionales de ejemplo a planes reales. Fuente/referencia/licencia obligatorias. Energía 0–2000 y macronutrientes 0–100 por 100 g son límites de validación de entrada, no recomendaciones.

### Receta

```json
{
  "name": "Nombre de receta",
  "instructions": "Preparación",
  "servings": 2,
  "ingredients": [{"foodId":"UUID del mismo estudio", "grams":150}]
}
```

De 1 a 30 ingredientes; gramos positivos y rendimiento 0,01–1000 porciones. Seleccionar alimentos activos del estudio. Al publicar menú, el servidor resuelve y congela sus datos; no aceptar un snapshot nutricional enviado por el cliente.

### Menú borrador

```json
{
  "name":"Nombre del menú",
  "description":"Indicaciones generales",
  "days":[{
    "weekday":1,
    "meals":[{
      "id":"UUID único en el menú",
      "label":"Almuerzo",
      "recipeId":"UUID de receta principal",
      "alternativeRecipeId":null,
      "servings":1,
      "notes":"Instrucción opcional"
    }]
  }]
}
```

El fragmento ilustra un día: el documento válido contiene exactamente los siete días únicos 1=lunes…7=domingo y 1–6 comidas por día. Principal/alternativa deben ser recetas activas del mismo estudio. Identificadores de comidas únicos. Máximo 50 kB de borrador, snapshot publicado 1 MB; menú/receta referencian fuentes mediante funciones SQL, no DML de la API.

PUT usa UUID elegido por el cliente y revisión 0 para alta; actualizaciones exigen revisión vigente. Un UUID de otro estudio no permite sobrescribir su ficha. `archived:true` retira de nuevas selecciones; snapshots históricos se conservan. Para incorporar cambios de fuentes al menú publicado, guardar una nueva revisión del menú y publicar.

## Asignación y registro

- Asignación: UUID estable por intención; reintento idéntico devuelve la misma fila. Periodo inclusivo de 1–84 días, semana repetida por día de la semana. Exclusión SQL de menús activos solapados; cancelación no borra historial.
- Registro: `state='eaten'|'skipped'`, `choice='main'|'alternative'|'other'`, `portions=number|null` (0,01–100). Omitida exige `portions:null`; otra comida exige nota descriptiva y no genera macros automáticos.
- `eatenOn`: hoy o hasta 30 días anteriores, dentro de asignación activa. `mealId` debe pertenecer a ese día de la semana en la versión asignada. No se puede registrar la comida de un menú distinto o una alternativa ausente.
- Revisión 0 para alta; actualización CAS. `requestId` estable en el reintento **de esa comida/fecha/asignación**; mismo ID con contenido distinto produce conflicto. Reintento idéntico no modifica la fila. No se copian porciones previstas al valor real.
- Comentarios idempotentes por requestId dentro del estudio, hasta 20/registro, 1000 caracteres. Nombre de autor mostrado como Profesional; sin exponer email o notas internas. Se comparten con alumno y profesionales con acceso vigente al diario.
- Privacidad CAS, revisión inicial 0; fotos requieren diario y concesión de fotos requiere concesión de diario. Retirada de consentimiento bloquea acceso profesional, no lectura/eliminación propia del alumno.

## Fotos

Autenticar antes de parsear cuerpo (límite JSON 2,9 MB); comprobar consentimiento antes de normalizar y al guardar. PNG/JPEG/WebP base64 ≤2 MiB, no animado, ≤8 MP. Normalización única simultánea, timeout, WebP 1280 px y miniatura 320 px sin EXIF. Hasta tres fotos por registro. Mismo requestId/hash/registro devuelve la misma foto, sin duplicar bytes; no permite resucitar una retirada.

Lectura `image/webp`, `nosniff`, `private, no-store`; comprobar permiso en cada solicitud y auditar identificador sin copiar el contenido del diario. Ninguna foto se hereda por permiso T03/T06/T08. Rutas `/v1` excluidas del shell offline. Bytes retenidos tras eliminación lógica cuentan en cuota hasta mantenimiento de 30 días.

## PDF de menú por API T08

1. Crear recurso privado con requestId estable (`POST /resources`).
2. `POST /resources/:id/versions` con `{requestId,kind:'menu',studentId,assignmentId}`.
3. Snapshot construido en SQL desde asignación activa, versión, marca/alumno y fecha Paraguay; `forma-menu-v1`. No incluye diario, fotos o comentarios.
4. Worker T08 genera y conserva archivo; mismo presupuesto mensual y espacio conjunto. `resource_usage` incluye PDF de menú en el conteo mensual y fotos de comidas en bytes.
5. Compartir expresamente con su alumno mediante `/resources/:id/access`. Otro alumno se rechaza. Preparar `/versions/:versionId/link`, cookie HttpOnly restringida y entrega autenticada T08. Sin token en URL ni permiso público por UUID.
6. Gestión/worker de PDF de menú exige capacidad nutricional vigente y ficha administrable; el alumno conserva lectura del menú y recursos expresamente compartidos. La retirada del diario no retira automáticamente el menú previsto.

## Errores principales

`INVALID_NUTRITION` 400; `NUTRITION_NOT_FOUND` 404; `STALE_NUTRITION`, `IDEMPOTENCY_CONFLICT`, `ASSIGNMENT_OVERLAP`, `NUTRITION_LIMIT`, `NUTRITION_DATE` 409; `FORBIDDEN`, `NUTRITION_CONSENT` 403. Fotos inválidas 400/413 y normalizador ocupado 429. PDF conserva errores de cuota/cola/plantilla T08.

No devolver mensajes SQL internos, claves privadas o notas de otros alumnos en errores. [Manual](t09-uso-y-operacion.md) · [ADR](../decisiones/009-alimentacion-versionada.md) · [Acta](../evidencias/t09.md).
