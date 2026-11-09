# T12 — Servicios, membresías, CRM y pagos del coach

**Depende de:** T02, T07 y T11. **Objetivo:** coach administra lo que vende y cobra a sus alumnos, separado de la factura SaaS.

## Entrega local T12 — 22-10-2026

V0.12.0, migración 021; siguiente 022. [Manual paso a paso](../runbooks/t12-uso-y-operacion.md), [API](../runbooks/api-t12.md), [ADR 012](../decisiones/012-negocio-del-coach.md), [acta y alcance de verificación](../evidencias/t12.md).

| Tarea | Resultado implementado | Aceptación local |
|---|---|---|
| T12-01 | Diez tablas coach_*, snapshots, cuotas y ledger financiero inmutable; recibos de intención y RLS | Integración de precio/moneda/cuotas/historia y permisos |
| T12-02 | Único/membresía/paquete, PYG/USD/EUR, vigencia fija en días, cupo y archivo | Cambios del catálogo no alteran lo vendido |
| T12-03 | Venta de dos pasos, 1–24 cuotas, pagos parciales, recibo privado, devolución/corrección/ajuste y renovación explícita | Saldo exacto, duplicados y último saldo concurrente; cancelación sin modificar SaaS |
| T12-04 | Prospectos/etapas/origen/acción, conversión por correo, borrado y retención de cerrados | Reutiliza alumno existente o crea invitado sin enviar/activar acceso |
| T12-05 | Resumen por moneda, efectivo/devolución/neto, deuda/vencimientos y CSV owner | Agregados exactos, sin sumar monedas o exponer contactos |
| T12-06 | Nueve integraciones y dos unitarias con evidencia aprobada mediante ejecución inicial + filtro | Sin suite histórica; revisión visual y límites detallados en acta |

Paquetes: consumo manual solo de asistencia confirmada/presente dentro de vigencia, con ledger de restauración. No descuenta por reservar o faltar. Owner gestiona negocio; alumno lee lo suyo; staff sin acceso comercial implícito. Firma NAVZ conservada como pendiente posterior.

## Base recibida y orden de continuidad

T11 recibida: **v0.11.0, 001–020**. [Agenda](11-agenda-automatizaciones.md) aporta reservas/asistencia, comandos idempotentes, outbox y avisos internos. T12 amplía con 021; ver acta para el cierre aplicado y pruebas reales.

1. Partir de los contratos de agenda y mantener historia de reservas/asistencia. Definir explícitamente en T12 si una venta concede sesiones y cuándo se consumen/devuelven; T11 no consume bonos ni cobra al reservar o faltar.
2. Diseñar transacciones/recibos auditables de `coach_*`, independientes de facturación SaaS T07. Precio y moneda quedan congelados al vender; no activar cobro automático.
3. Vincular avisos comerciales solo mediante una nueva categoría/contrato autorizado y preferencia, sin reutilizar silenciosamente recordatorios de citas. No conceder lectura de chat ni respuestas a quien gestione ventas.
4. Mantener formularios por pasos y tarjetas en móvil, tabla/resumen en PC; campos 16 px, acciones 44 px y reflujo desde 320. Usar casos dirigidos de bajo consumo; recuperar evidencia previa sin repetir suites históricas.
5. Conservar puertas de teléfonos/HTTPS/recuperación/retención, los 59 indicadores previstos de T11 y el [pendiente de firma NAVZ](../pendientes/firma-navz.md).

## Pasos en orden

1. **T12-01 Modelo.** Servicio, precio y moneda, paquete/membresía, contrato/asignación, vencimiento, cuota/pago y ajuste; namespace/tablas `coach_*` sin FK a factura SaaS salvo organización. Congelar precio al vender.
2. **T12-02 Catálogo.** Coach crea programa mensual, paquete de sesiones y servicio único; activa/archiva, define cupos y reglas de vencimiento. No se cobra automáticamente.
3. **T12-03 Venta.** Asociar alumno, vigencia y servicio; ver saldo, próximo cobro y renovaciones; registrar pago manual con referencia/recibo privado y actor. Correcciones auditadas sin borrar historia.
4. **T12-04 CRM.** Prospecto, etapa, origen, próxima acción y conversión a alumno sin duplicar; acceso según rol. Eliminar datos del prospecto conforme a retención.
5. **T12-05 Reportes.** Altas, bajas, ingresos confirmados, pendientes y vencimientos; distinguir efectivo registrado de ingreso estimado. Exportación CSV autorizada.
6. **T12-06 QA.** Precio cambia tras venta, pago parcial, devolución, servicio vencido, duplicación de pago, usuario de otro tenant y consistencia con factura SaaS.

## Aceptación y evidencia

Coach vende dos servicios distintos a alumnos, registra pagos manuales y ve saldos/renovaciones sin alterar la deuda del coach hacia la plataforma. Cada número se explica con operaciones históricas.

No se incorporan pasarela/cobro automático ni avisos comerciales con categorías ajenas. Comprobante como imagen normalizada privada, presupuesto financiero 64 MiB por estudio; incorpora inventario y backup. **81 indicadores previstos**, sin ensayo nuevo de backup/restore. iPhone/Android físicos, HTTPS, operación externa y políticas de privacidad/comerciales siguen pendientes. Próxima ampliación [T13](13-gimnasios.md), desde 0.12.0/021; no reescribir migraciones aplicadas.
