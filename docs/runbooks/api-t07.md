# API T07 — PWA, cuentas y administración

**Versión 0.7.0.** Sesión opaca y CSRF de T02; sin pasarela ni transferencia de dinero. [ADR 007](../decisiones/007-pwa-y-cuenta-saas.md).

## PWA pública

| Método/ruta | Resultado |
|---|---|
| GET `/v1/public/studios/:slug/manifest.webmanifest` | Identidad estable `/app-id/:organizationId`, nombre, color, iconos y arranque `/abrir/:slug`, accesos a Entrenar/Progreso. No incluye tokens, alumnos ni datos privados |
| GET `/v1/public/studios/:slug/app-icon.png?size=192` | PNG 180/192/512, logo público con margen o inicial sobre color de marca. Cache pública 60 segundos; versión del logo en URL del manifest |

La raíz compilada ofrece manifest/iconos genéricos de Forma. La interfaz enlaza los del estudio al conocer su marca. Scope `/` en el host compartido local; no es una frontera de autorización. En producción la arquitectura prevé origen por marca. [Identidad](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/id), [scope](https://developer.mozilla.org/docs/Web/Progressive_web_apps/Manifest/Reference/scope) y [arranque](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/start_url).

## Cuenta comercial

Base `B=/v1/organizations/:organizationId/billing`. Lectura: responsable activo del estudio o superadmin activo. Alumnos/coaches, incluso asignados, no tienen permiso. Se conserva lectura financiera del responsable con el estudio suspendido; no habilita entrenamiento. El host de marca debe corresponder al estudio solicitado.

| Método/ruta | Contrato |
|---|---|
| GET `B/preview?month=2026-09` | Mes `YYYY-MM`, últimos cinco años hasta mes actual. `preview` con plan/precio de apertura, fórmula, fechas, líneas por alumno y días exactos, total y `issuedId`. Si fue emitida devuelve snapshot conservado |
| POST `B/enable` | Solo superadmin. `{reason}` 10–500 caracteres. Habilitación desde ahora con versión inicial y activación transaccional de suscripción, sin fecha retroactiva de cliente; el cobro espera al fin de prueba. Repetir conserva la primera habilitación |
| POST `B/issue` | Solo superadmin. `{month}`. Solo mes terminado y habilitado; bloqueo estudio + unicidad estudio/mes. Repetir devuelve misma cuenta y snapshot |
| GET `B/invoices?before=&limit=12` | Hasta 50 resúmenes paginados por mes; base y saldo actual, `nextBefore` |
| GET `B/invoices/:id` | `invoice` con snapshot, ajustes, pagos, reversiones y saldo derivado |
| POST `B/invoices/:id/adjustments` | Superadmin. `{requestId,amountPyg,reason}`; importe entero con signo, distinto de cero. No admite saldo negativo; no altera base histórica |
| POST `B/invoices/:id/payments` | Superadmin. `{requestId,amountPyg,reference,paidOn,receiptDataUrl?}`; importe positivo entero, referencia 3–150, fecha desde mes de cuenta hasta hoy. Sin sobrepago |
| POST `B/payments/:id/reverse` | Superadmin. `{requestId,reason}`; asiento nuevo, una reversión por pago, original intacto |
| GET `B/payments/:id/receipt` | Owner/superadmin autorizado; WebP privado/no-store, también después de revertir el asiento. No pertenece a biblioteca ni se publica |
| GET `/v1/admin/pilot-summary` | Solo superadmin: agregados de plataforma y ventana de 28 días, activaciones, primer programa en 24 h, primera sesión en 7 días, sesiones, alumnos habilitados, cuentas y saldo. Sin identidades ni medidas/fotos/notas |

Todas las escrituras tienen CSRF y permisos SQL; no basta cambiar UUID o esconder el botón. Importes JSON deben ser números enteros: rechaza strings, null y decimales antes de coerción de Ajv. Máximo técnico por movimiento/total 10¹² PYG. Razones 10–500. Reintentar mismo UUID/contenido no duplica; contenido distinto devuelve `IDEMPOTENCY_CONFLICT`. El espacio de idempotencia es por organización y tipo de movimiento.

Comprobante opcional PNG/JPEG/WebP ≤2 MB, ≤8 MP, sin animación; Sharp asíncrono hasta 1280, elimina metadatos y original. Dos transformaciones máximas por proceso y cinco segundos para la principal. Presupuesto de comprobantes de plataforma: 64 MiB por estudio; hasta 1.000 pagos y 1.000 ajustes por cuenta. Estos límites son operativos y no generan cargos nuevos al coach. PDF se evalúa con T08.

## Campos y fórmula

`preview`: `organizationName,month,currency,timezone,formula,daysInMonth,enrolledAt,chargeStartsAt,computedThrough,plan,lines,totalPyg,issuedId,isEstimate`. Plan congela ID/código/versión/precio y base/incluidos/mínimo/tope (0/0/0/null). Línea: `studentId,name,days,dates,pricePyg,amountPyg`.

`invoice`: ID/mes/emisión, `snapshot`, `totalPyg,adjustmentPyg,paidPyg,balancePyg`, estado derivado `issued|partial|settled`, ajustes y pagos (referencia, fecha, comprobante y reversión). Los pagos revertidos permanecen visibles y dejan de reducir el saldo.

`ROUND_HALF_UP(precio × días / días_mes)` por alumno, después sumar. Inicio de cobro = máximo entre habilitación y fin de prueba. Un día cuenta solo si existe intersección no vacía de acceso, ventana local del día y ventana cobrable; fin exclusivo. El cambio de precio aplica el mes siguiente; la versión inicial de habilitación rige el primer mes parcial. Los cupos siguen T02 y pueden cambiar de inmediato.

## Errores

- `INVALID_BILLING` 400; `BILLING_NOT_FOUND` 404; acceso de otro estudio/no propietario 404.
- `BILLING_PERIOD_OPEN` 409: el mes sigue siendo estimación.
- `BILLING_NOT_ENABLED` 409: habilitación ausente o posterior al mes; no cobro retroactivo.
- `BILLING_OVERPAYMENT` 409: sobrepago o ajuste que dejaría saldo negativo.
- `BILLING_ALREADY_REVERSED`, `IMMUTABLE_BILLING`, `BILLING_LIMIT` 409.
- `INVALID_RECEIPT` 400/413, `RECEIPT_BUSY` 429; errores preservan el formulario. Las operaciones registradas no se borran para resolver un error.
