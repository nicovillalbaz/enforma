# ADR 012 — Servicios y pagos del coach

**22-10-2026 · T12 · v0.12.0.** Decisión de implementación local. [Plan](../tandas/12-negocio-coach.md), [manual](../runbooks/t12-uso-y-operacion.md), [API](../runbooks/api-t12.md), [acta](../evidencias/t12.md).

## Alcance y tecnología

Se reutilizan Vue/Fastify/PostgreSQL, almacenamiento privado y worker de seguimiento. No se incorporan dependencias, pasarela, cobro recurrente ni motor externo. `/servicios` presenta catálogo, ventas, CRM y resumen al propietario; el alumno ve únicamente contratos/movimientos propios. Staff no obtiene acceso comercial por gestionar agenda o tener alumnos vinculados. T13 deberá definir cualquier delegación adicional.

Diez tablas `coach_*`: services, contracts, charges, adjustments, payments, refunds, session_entries, prospects, prospect_events y commands. FKs de organización/identidad, sin relaciones de cobro con facturas SaaS. Vender, renovar o cancelar no activa acceso, modifica plazas SaaS ni cancela reservas de agenda. Ser owner comercial no concede chat, fotos corporales o respuestas privadas.

## Precio, vigencia y cupo

- Servicio único, membresía o paquete. PYG en unidades enteras; USD/EUR en centavos. Precio y movimientos se transmiten como enteros exactos de unidad mínima; máximo 10^12 por importe. Frontend convierte el decimal mediante texto/BigInt, sin redondear ni aceptar separador de miles. API rechaza números monetarios como texto o fracciones de unidad mínima.
- DB guarda `bigint`; reportes agregados viajan como cadenas y se formatean con BigInt. Nunca se suman monedas distintas ni se aplica tipo de cambio. La elección de enteros sigue los [tipos exactos de PostgreSQL 16](https://www.postgresql.org/docs/16/datatype-numeric.html). El patrón de unidad mínima está documentado también en [API de monedas de Stripe](https://docs.stripe.com/currencies#minor-units-in-api-amounts); esa referencia no implica integrar Stripe.
- La venta congela snapshot completo de servicio/precio/moneda/vigencia/sesiones. Cambiar o archivar catálogo solo afecta nuevas ventas. Se exige revisión del precio visible al vender para impedir una confirmación con precio cambiado en otra sesión.
- Vigencia fija de 1–730 días, inicio y último día incluidos, zona del estudio. Una membresía de 30 días dura exactamente 30 días; no representa un mes calendario automático. Renovación crea otro contrato explícito del mismo servicio/alumno después del anterior, con precio actual y sin transferir saldos/sesiones. Un contrato admite un sucesor directo; cancelar no borra esa historia.
- Cupo opcional 0–5000 contratos concurrentes de un servicio; 0 sin límite. Se comprueba todo el periodo al vender bajo bloqueo de organización. No es cupo de clase. No se superpone el mismo servicio/alumno; distintos servicios pueden coexistir. Reducir el cupo del catálogo no cancela ventas existentes.

## Cuotas y libro de movimientos

1–24 cuotas positivas, ordenadas por fecha y con suma exacta al precio. Vencimientos permitidos desde inicio −366 días hasta final +366. UI reparte unidades restantes entre primeras cuotas y propone intervalos de 30 días editables. No hay emisión recurrente de nuevas cuotas.

`saldo de cuota = importe original + ajustes − pagos + devoluciones/correcciones`. Ajustes firmados y motivados no pueden dejar saldo negativo ni importe ajustado por encima de 10^12. Pago parcial o total exige fecha declarada no futura, método y referencia única en el estudio; pago no supera saldo. Se conserva la referencia incluso al anular para evitar duplicar el mismo comprobante con otro requestId.

Devolución real puede ser parcial, hasta el remanente del pago. Reabre deuda; reducir la obligación necesita además ajuste negativo. Corrección anula íntegramente un pago erróneo sin devolución previa y se excluye del efectivo confirmado. No borra registros. Cancelar contrato libera vigencia/cupo pero conserva deuda y pagos; no genera devolución o ajuste implícitos.

Contratos congelados y tablas financieras tienen protección de inmutabilidad, RLS y funciones controladas. Recibos por UUID/hash de intención, transacción y bloqueo por organización evitan duplicar y sobrepagar con solicitudes concurrentes. No se guardan cuerpos con datos personales en el recibo técnico; sí IDs de resultado y hashes. El cliente conserva intención ante fallo y descarta la confirmada.

## Comprobantes y paquetes

Comprobante opcional como PNG/JPEG/WebP hasta 2 MiB/8 MP sin animación: normalizar WebP, sin metadatos, hasta 1280 px, una transformación simultánea. Repositorio privado autenticado, `no-store`, solo owner/alumno del pago; sin enlaces públicos ni PDF subido. Presupuesto financiero de **64 MiB por organización** para estos comprobantes, independiente del de medios y de recibos SaaS. El inventario de referencias/backup los incorpora; un reintento no retiene otro archivo. El historial financiero no se purga automáticamente sin política aprobada.

Paquete descuenta manualmente una reserva confirmada y marcada presente, del mismo alumno y dentro de su vigencia. Ni reservar ni faltar descuentan. Ledger de consumo/restauración con motivo; una asistencia se descuenta una sola vez globalmente, incluso si su consumo fue restaurado. Restaurar una vez devuelve sesión sin borrar registro; cambiar después la asistencia no altera el ledger automáticamente. Cancelado no admite consumos nuevos; sí restaurar errores históricos.

## CRM y retención

Propietario registra nombre/contacto, origen, etapa, próxima acción y notas comerciales. Conversión por correo reutiliza ficha existente del estudio o crea invitado; no envía invitación ni activa acceso. Estado/revisión/recibo hacen segura su repetición. Reapertura de perdido es explícita; convertido y eliminado no se editan como prospectos activos.

Eliminar redacciona nombre/email/teléfono/origen/acción/notas y vínculo visible, conservando evento técnico sin contenido. La ficha de alumno y los registros financieros tienen ciclos propios. Worker existente elimina datos de perdidos/convertidos tras 90 días de cierre, hasta 100 por ciclo; respeta bloqueo de mutaciones y revalida estado para no borrar un prospecto recién reabierto. Prospectos abiertos requieren revisión del propietario; política definitiva y derechos deben validarse antes del piloto. Recibos/auditoría conservan IDs técnicos, no se afirma anonimización completa de toda la base.

## Reportes, límites y operación

Resumen por moneda: precio original de ventas según fecha de registro, cancelaciones según cancelación, vencidos cuyo último día ya pasó; pagos no corregidos por fecha declarada, devoluciones reales por su fecha y neto. Saldo/vencido es estado actual de cuotas con vencimiento en el rango: no reconstruye balance histórico. CSV de agregados numéricos/moneda, owner autorizado, `no-store` y auditoría; no exporta textos de prospectos ni fórmulas.

Límites: 300 servicios, 10.000 contratos por estudio, 2.000 prospectos sin eliminar, 100 pagos/ajustes por cuota y 100 devoluciones por pago. Paginación de 50 ventas/prospectos, búsqueda de 100 alumnos y 50 asistencias elegibles. Sin sondeo continuo del navegador.

Backup añade diez conteos y doce sumas por moneda (contratos, ajustes, pagos y devoluciones/correcciones): **81 indicadores previstos, 66 conteos y 15 sumas**. Esto no acredita un ensayo de recuperación T12. Cierre local y límites reales constan en el acta; teléfonos, HTTPS, operación y revisión profesional/comercial siguen pendientes. Firma NAVZ conservada en su [pendiente](../pendientes/firma-navz.md).



## Actualización de alcance T13

La decisión vigente limita el producto a coaches independientes. Cualquier referencia previa a equipos, sedes, recepción o grupos formales como entrega T13 queda sustituida por [consolidación individual](../tandas/13-gimnasios.md); [multicoach se aplaza](../pendientes/gimnasios-futuro.md) fuera de las tandas actuales.

