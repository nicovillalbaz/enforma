# API T14-07 — Control mensual manual

**V0.14.2 / 023.** Sesión cookie, CSRF firmado para mutaciones, respuestas privadas no-store. Dinero fuera de la app. [Uso](t14-control-mensual.md), [decisión](../decisiones/015-control-mensual-manual.md), [pruebas](../evidencias/t14-control-mensual.md).

| Método/ruta | Permiso y resultado |
|---|---|
| GET /v1/admin/monthly-coaches?month=YYYY-MM | Superadmin: nombre/id/estado, configuración actual, activos conservados y pago del mes; sin pagos/contactos de alumnos |
| PUT /v1/admin/organizations/:org/manual-control | Superadmin: precio mensual/cupo/acceso explícitos con revisión/intención/motivo |
| PUT /v1/admin/organizations/:org/monthly-payment | Superadmin: marca pago externo del coach, sin cambiar acceso |
| GET /v1/organizations/:org/monthly-control?month=YYYY-MM | Owner propio incluso suspendido o superadmin; sin contenido privado de alumnos |
| GET /v1/organizations/:org/monthly-students?month=YYYY-MM&q=&cursor=UUID | Owner activo: 50 fichas y nextCursor, estado/versión y marca mensual |
| PUT /v1/organizations/:org/students/:student/monthly-payment | Owner activo del estudio; marca mes del alumno, no habilita acceso |
| PATCH /v1/organizations/:org/students/:student/state | Contrato previo status/version/reason; cupo efectivo comprobado al activar |

## Configuración

Body: studentLimit (entero 0–5000), monthlyPricePyg (entero 0–10^12 o null), accessEnabled (boolean), revision (entero ≥0), requestId (UUID), reason (10–500 caracteres tras trim).

- revision 0 para espacio anterior aún sin control; alta nueva ya tiene revisión 1. Usar revisión leída, sin asumir incrementos de exactamente uno.
- Devuelve control con id/name/status/manualMode/studentLimit/monthlyPricePyg/revision/activeStudents/month/paid/paymentRevision. Precio/cupo/acceso actuales; el mes del resultado de configuración es el actual.
- Cupo no baja de activos conservados, incluso suspendido. Habilitación convierte suscripción técnica a active/paused, sin reescribir cuentas previas.
- /v1/plans y /admin/organizations conservan contrato técnico anterior. Para precio/cupo mensual actual usar endpoints nuevos y subscription (incluye manualMode/monthlyPricePyg/cupo efectivo).

## Marca mensual

Body: month (YYYY-MM), paid (boolean), revision (0 si sin marca), requestId (UUID), reason (3–500 caracteres tras trim). Devuelve payment con paid/revision/month. Usar paymentRevision del listado, no revisión de configuración o version de alumno.

Mes sin marca = pendiente/revisión 0. Ventana de cinco años anteriores y un año posterior. Misma intención/cuerpo devuelve resultado original sin duplicar; UUID reutilizado con otros datos da conflicto. Conservar UUID tras respuesta perdida y renovarlo tras confirmación/cambio de intención. Crear/corregir mes no cambia acceso.

## Errores y seguridad

401 sin sesión; 403 rol/estado; 404 estudio/alumno ocultos; 409 revisión/cupo/intención; 400 campos. Nuevos códigos: INVALID_MANUAL_CONTROL, STALE_MANUAL_CONTROL, MANUAL_CAPACITY, MANUAL_INTENTION_CONFLICT, MANUAL_HISTORY_IMMUTABLE.

RLS SELECT limitado y escritura por funciones controladas. Eventos append-only guardan actor/fecha/razón/resultado. Coach no modifica su pago al operador y administrar plataforma no concede acceso a pagos privados de alumnos. Nada otorga permisos sobre chat/fotos u otros recursos.
