# T12 — Servicios, ventas, pagos y prospectos

**v0.12.0.** [Decisiones](../decisiones/012-negocio-del-coach.md), [API](api-t12.md), [resultados](../evidencias/t12.md).

## 1. Entrar y preparar catálogo

1. Elegir estudio y abrir **Servicios y pagos** en sidebar de PC o Más opciones del móvil. Solo owner gestiona. Alumno encuentra **Mis servicios**, con lectura de lo propio. Profesionales sin rol owner no acceden al CRM o finanzas.
2. Ir a **Servicios → Nuevo servicio**. Introducir nombre/descripción comercial y elegir servicio único, membresía o paquete.
3. Elegir PYG/USD/EUR y precio sin separador de miles: `100000` PYG, `25,50` USD/EUR. PYG no admite decimales; no hay conversión de moneda. No introducir puntos como separador de miles.
4. Definir vigencia en días (1–730). Membresía de 30 días no equivale a renovación automática cada mes calendario.
5. Si es paquete, indicar 1–1000 sesiones. Definir cupo de contratos simultáneos: 0 sin límite, hasta 5000; no modifica plazas de agenda.
6. Guardar. **Editar servicio** permite cambiar términos o archivarlo para nuevas ventas. Los contratos vendidos conservan snapshot original. No se eliminan contratos al archivar.

## 2. Registrar una venta y cuotas

1. En **Ventas**, buscar alumno por nombre y pulsar **Nueva venta**. Se ofrecen hasta 100 alumnos no archivados; afinar búsqueda antes de abrir formulario si falta el deseado.
2. Paso 1: seleccionar servicio activo, alumno y fecha inicial. Revisar precio vigente, duración/último día y sesiones. Vender no envía invitación ni habilita acceso a la app.
3. Paso 2: revisar precio congelado y cuotas. Una cuota es el valor inicial; **Dividir en N cuotas** reparte el precio exactamente y propone vencimientos cada 30 días. Cada nuevo reparto reemplaza el anterior: revisar antes de confirmar.
4. Editar fechas/importes si hace falta. Máximo 24, positivas, ordenadas por fecha y suma igual al precio. No se ejecutan débitos al llegar el vencimiento.
5. **Confirmar venta**. Si precio/revisión cambió, actualizar catálogo y revisar de nuevo; si hay solapamiento/cupo, elegir otro periodo o servicio.
6. Abrir la venta para ver snapshot, vigencia, saldo, próxima cuota pendiente, pagos y consumos. **Cargar más ventas** pagina resultados. Cada cuota tiene su propio estado.

## 3. Pago parcial o total

1. Abrir contrato y **Registrar pago de cuota N**. La pantalla propone saldo pendiente; cambiar a importe parcial si corresponde.
2. Elegir efectivo/transferencia/otro, fecha real declarada (no futura) y referencia única del estudio. Para efectivo usar número de recibo interno; no reutilizarlo para otra cuota.
3. Opcional: imagen PNG/JPEG/WebP del comprobante, hasta 2 MiB. Se normaliza y guarda privada. No se aceptan PDFs en esta carga.
4. Confirmar y esperar estado guardado. La cuota queda parcial o saldada según saldo; no basta con pulsar el botón. Ante red interrumpida se mantiene la intención para repetir sin duplicar.
5. **Ver comprobante** abre una lectura autenticada `no-store`; solo propietario y alumno de ese pago. No reenviar capturas de cuentas reales como evidencia de desarrollo.

## 4. Corregir y devolver

1. **Devolver o corregir pago** distingue devolución real de dinero y anulación de un registro equivocado.
2. Devolución: importe positivo hasta lo no devuelto, fecha desde la del pago hasta hoy y motivo de 10–500 caracteres. Puede ser parcial. Es un registro manual: el sistema no transfiere dinero.
3. Corrección: pago registrado por error, completo y sin devolución previa. Se conserva su registro y deja de contarse como cobro confirmado; su referencia sigue reservada.
4. Ambas operaciones reabren deuda. Si también se reduce la obligación del alumno, aplicar **Ajustar cuota**, marcar **Reducir deuda** e indicar importe/motivo. Para aumentar deuda, no marcar reducción.
5. Ejemplo: cuota 100.000, pago 100.000, devolución 20.000 → saldo 20.000. Ajuste −20.000 → saldo 0 y cobrado neto 80.000. Nunca registrar un ajuste que vuelva negativo el saldo.
6. Historial de ajustes/devoluciones conserva razones y registros anteriores; no editar o borrar pagos directamente en DB.

## 5. Vigencia, renovación y cancelación

1. Vigencias incluyen inicio y último día, según zona del estudio. Estado próximo/vigente/vencido/cancelado es explícito.
2. **Preparar renovación** propone día posterior al final, mismo alumno/servicio y precio actual del catálogo. Revisar dos pasos y confirmar una venta nueva. Saldos y sesiones anteriores no se transfieren automáticamente.
3. Un contrato tiene un sucesor directo; si se cometió un error en la cadena, conservar historia y revisar el caso antes de crear otra venta. No cancelar para intentar borrar la relación.
4. **Cancelar contrato** exige motivo. Libera cupo/uso futuro y conserva pagos/deuda. Si hay devolución o reducción de deuda, registrarlas por separado. No cancela sesiones de agenda ni acceso SaaS.

## 6. Descontar un paquete

1. En agenda, confirmar asistencia como presente a una reserva del alumno.
2. Abrir paquete cuya vigencia contiene esa asistencia y pulsar **Descontar asistencia del paquete**. Solo aparecen hasta 50 asistencias elegibles; no se descuenta al reservar/faltar.
3. Seleccionar asistencia, explicar motivo y confirmar. Se descuenta una sesión, una sola vez para esa reserva.
4. Ante error, **Restaurar este consumo**, motivo y confirmar. Se devuelve una sesión conservando ambos registros. Esa asistencia no se vuelve a consumir después de restaurarla.
5. Si cambia posteriormente la asistencia, revisar el ledger manualmente; no existe reconciliación automática. Contrato cancelado no permite consumos nuevos.

## 7. CRM

1. En **Prospectos → Nuevo prospecto**, registrar contacto comercial, origen, etapa, próxima acción/fecha y notas sin información de salud.
2. Buscar por nombre/correo o filtrar etapa. Se pagina de 50 en 50. Las próximas acciones no envían mensajes automáticos.
3. **Convertir a alumno** requiere correo y etapa abierta. Reutiliza ficha del mismo correo o crea alumno invitado. Consultar **Alumnos** para invitación/acceso mediante flujo existente; convertir no envía correo ni cobra plaza por sí solo.
4. Perdido se puede reabrir editando su etapa antes de convertir. Convertido no vuelve a prospecto editable.
5. **Eliminar datos del prospecto** redacciona sus datos personales. Si existe alumno, su ficha se gestiona por separado. Se retienen eventos/IDs técnicos necesarios para historia; no se afirma borrado de toda información del alumno.
6. Worker elimina datos de perdidos/convertidos tras 90 días de cierre, hasta 100 por ciclo. Revisar abiertos sin actividad con responsable; la política definitiva debe aprobarse antes del piloto.

## 8. Resumen y CSV

1. En **Resumen**, elegir desde/hasta (hasta 366 días) y consultar. Cada moneda tiene tarjeta separada.
2. Pagos confirmados excluye registros anulados; devoluciones reales se restan por fecha de devolución. Neto puede ser negativo si se devuelve un pago de otro periodo.
3. Ventas nuevas muestra precio original comprometido; no equivale a efectivo cobrado. Cancelaciones/vencimientos son recuentos por sus fechas.
4. Saldo/vencido muestra situación actual de cuotas cuyo vencimiento está dentro del rango. No es una reconstrucción histórica a la fecha final.
5. **Exportar resumen CSV** descarga agregados en unidad mínima y código de moneda, con acceso owner y auditoría. No exporta contactos ni notas. Es registro interno, no factura fiscal/conciliación bancaria.

## 9. Operación, límites y continuidad

1. Usar servicios existentes según [desarrollo](desarrollo.md). `dev:followup` añade limpieza de prospectos; no iniciar otro worker o pasarela. Si está detenido, pagos/ventas siguen funcionando pero la retención espera.
2. Comprobantes tienen presupuesto de 64 MiB por estudio; no se borran automáticamente recibos financieros para liberar espacio. Revisar política y retención con responsable antes de producción.
3. Inventario de backup incorpora comprobantes; se añaden diez conteos y doce sumas por moneda. **81 indicadores previstos (66 conteos/15 sumas)**. Ensayo de recuperación T12 pendiente, no repetirlo por cambios documentales.
4. Revisión/cupo/saldo en conflicto: actualizar y comprobar estado real; no reintentar con referencias nuevas para esquivar un rechazo. RequestId reutilizado con contenido distinto se rechaza.
5. Ver [acta](../evidencias/t12.md) antes de probar: casos nuevos y filtros dirigidos. No repetir suites históricas, carga, PDFs o capturas masivas. Fixture visual solo localhost y cuentas ficticias, sin envíos ni cobros reales.
6. Pendientes físicos/externos y aceptación P18 en [puertas](../piloto/00-puertas.md). Próxima ampliación [T13](../tandas/13-gimnasios.md); [firma NAVZ](../pendientes/firma-navz.md) sigue pendiente para más tarde.
