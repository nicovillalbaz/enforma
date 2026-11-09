# API T12 — Comercio del coach

**v0.12.0, migración 021.** Raíz `B=/v1/organizations/:organizationId/commerce`. Sesión/cookie, contexto de organización activo, CSRF en mutaciones y `no-store`. Owner gestiona todo; alumno activo solo lee contratos propios/detalle/comprobantes. Staff no tiene permiso comercial implícito. [ADR](../decisiones/012-negocio-del-coach.md), [manual](t12-uso-y-operacion.md).

## Intención y cantidades

Mutaciones llevan `requestId` UUID. Repetición exacta devuelve recibo; mismo UUID con otro contenido da conflicto. Guardar `revision` de servicios/prospectos/cancelación. Creación usa revisión 0. UUID de servicio/contrato/prospecto generado por cliente; pagos/ajustes/retornos/ledger generan ID en DB. Respuesta de comando `{id,revision?,studentId?}`; consultar detalle tras éxito.

`priceMinor/amountMinor`: JSON number entero exacto, máximo 10^12; texto numérico y fracciones se rechazan antes de coerción. PYG unidad entera, USD/EUR centavo. Ajuste admite signo y no cero; otros importes positivos. Fecha `YYYY-MM-DD`; zona del estudio para vigencia/hoy. Totales agregados de reportes son cadenas para conservar precisión. No convertir moneda.

| Método / ruta desde B | Entrada | Salida / alcance |
|---|---|---|
| GET raíz | `q?`, `studentId?`, `before?` UUID | owner/timezone/today, catálogo owner, contratos 50+nextCursor, alumnos owner hasta 100 filtrados por q |
| PUT `/services/:id` | requestId, revision, document | Crear/editar/archivar; owner |
| PUT `/contracts/:id` | requestId, document | Venta congelada y cuotas; owner |
| GET `/contracts/:id` | — | contract, charges con pagos/ajustes, refunds, sessions, eligibleBookings (solo owner, hasta 50) |
| POST `/contracts/:id/cancel` | requestId, revision, reason | Cancelar sin borrar deuda/reservas; owner |
| POST `/charges/:id/adjust` | requestId, amountMinor firmado, reason | Ajuste inmutable; owner |
| POST `/charges/:id/payments` | requestId, amountMinor, paidOn, method, reference, receiptDataUrl? | Pago parcial/total; owner |
| POST `/payments/:id/return` | requestId, amountMinor, returnedOn, kind, reason | Devolución/corrección; owner |
| GET `/payments/:id/receipt` | — | WebP privado autenticado; owner/alumno del pago |
| POST `/contracts/:id/sessions` | requestId, kind, referenceId, reason | Consumo/restauración; owner |
| GET `/prospects` | `q?`, `stage?`, `before?` | prospects 50+nextCursor; owner |
| PUT `/prospects/:id` | requestId, revision, document | Crear/editar prospecto abierto/perdido; owner |
| POST `/prospects/:id/convert` | requestId, revision | Vincula/crea alumno; owner, sin envío ni activación |
| POST `/prospects/:id/erase` | requestId, revision | Redacta contacto/notas y vínculo visible; owner |
| GET `/reports` | `from,to`, `csv=1?` | summary por moneda o CSV; owner, rango hasta 366 días |

## Documentos

Servicio:

```json
{"name":"Paquete fuerza","description":"Ocho sesiones","kind":"package","currency":"PYG","priceMinor":300000,"validityDays":30,"sessions":8,"capacity":10,"archived":false}
```

kind single/membership/package; paquete 1–1000 sesiones, otros 0. Capacidad 0–5000; vigencia 1–730 días. Nombre 2–100, descripción hasta 1000.

Venta:

```json
{"studentId":"UUID","serviceId":"UUID","serviceRevision":1,"startsOn":"2026-11-01","renewalOf":null,"installments":[{"dueOn":"2026-11-01","amountMinor":150000},{"dueOn":"2026-12-01","amountMinor":150000}]}
```

Fechas ordenadas y 1–24 cuotas que suman precio actual. Inicio desde hoy −366 hasta hoy +366; final calculado por duración, incluido. Renovación enlaza contrato anterior del mismo servicio/alumno y empieza después de su final.

Pago: method cash/transfer/other; reference 3–150, única en estudio (normalizada por espacios externos/minúsculas), incluso tras corrección. paidOn no futura, hasta 1826 días anteriores. receiptDataUrl opcional PNG/JPEG/WebP base64, 2 MiB/8 MP sin animación, normalizada WebP. Body máximo 2.900.000 bytes. La intención compara hash de entrada/bytes normalizados, no la clave aleatoria de almacenamiento; archivo extra de reintento se descarta.

Retorno: kind refund/correction. refund hasta importe no devuelto; correction íntegro y sin devoluciones previas. returnedOn desde fecha del pago hasta hoy. Motivo de todo ajuste/retorno/cancelación/consumo: 10–500 caracteres.

Sesión: kind use, referenceId=booking UUID confirmada/presente/dentro de vigencia; kind restore, referenceId=ID del consumo previo. Una restauración por consumo; no se reutiliza la asistencia restaurada.

Prospecto:

```json
{"name":"Contacto de prueba","email":"contacto@example.test","phone":"","source":"Recomendación","stage":"contacted","nextAction":"Llamada acordada","nextOn":"2026-11-02","notes":"Contacto comercial ficticio"}
```

stage editable new/contacted/trial/lost; won/erased solo mediante operaciones correspondientes. nextOn fecha o null. email vacío permitido salvo conversión; contacto por correo único entre prospectos sin eliminar. name 2–100, email 254, phone 40, source 100, nextAction 300, notes 1000. Sin información sanitaria ni envío automático.

## Detalle, informes y errores

Contract contiene snapshot original, startsOn/endsOn, state, revision, cancelación, total/balance/netPaidMinor, used/remainingSessions y nextDueOn. Cuota contiene importe original/ajustado, saldo/neto, pagos y ajustes. Owner y alumno autorizado leen su historia sin obtener claves privadas de almacenamiento.

Reportes: por moneda currency, sales/cancellations/expirations y cadenas salesMinor/grossMinor/refundsMinor/netMinor/dueMinor/overdueMinor. CSV son esos mismos agregados en unidad mínima; encabezado fijo, sin texto de usuario ni contactos. Pago corregido se excluye; devolución usa fecha de retorno. Saldo/vencido es estado actual de cuotas que vencen en el rango, no un histórico retrospectivo.

Errores específicos: INVALID_COMMERCE 400, COACH_NOT_FOUND 404, STALE_COMMERCE 409, COMMERCE_LIMIT 409, COACH_INSTALLMENTS 400, COACH_CAPACITY/OVERLAP/RENEWAL/BALANCE/SESSION 409, COACH_CONVERSION 409 y COMMERCE_IMMUTABLE 409. Se conservan IDEMPOTENCY_CONFLICT, DUPLICATE, contexto y CSRF comunes. No revelar contacto o importe de otra organización.
