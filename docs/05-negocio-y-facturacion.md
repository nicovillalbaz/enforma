# 05. Negocio, precios y facturación auditable

## Decisión vigente: control manual, sin procesar dinero

El usuario confirma pagos fuera de la app: coach registra Pagado/Pendiente de sus alumnos y operador verifica pagos de coaches/decide habilitación o suspensión desde su panel. No checkout, pasarela, sincronización bancaria o bloqueo por impago automático. Mantener pago por período e historial y acceso como acción manual explícita. Ya existen registros manuales y suspensión/restauración; la interfaz sencilla está pendiente. Reglas resueltas: todo mensual, precio/cupo/acceso de cada coach se definen en admin; alta nueva pendiente sin prueba automática; suspender coach bloquea alumnos. T14-07 implementada localmente en v0.14.2/023; [guía](runbooks/t14-control-mensual.md). [Plan priorizado T14-07 e información necesaria](piloto/04-pendientes-y-control-manual.md). Las cifras/modelos anteriores que siguen son hipótesis e historia, no aprobación de precio por esta decisión.

## Propuesta comercial a validar

Cobrar al coach, no al alumno. Hipótesis inicial: Básico G. 10.000 y Pro G. 15.000 por alumno habilitado al mes. Gimnasios y equipos quedan fuera de la oferta actual; no se compromete cotización ni ampliación tras el piloto. Las cifras vienen de la conversación y **no están validadas**. Entrevistar 10 coaches y ofrecer piloto a 3–5 antes de fijar lista pública. Considerar cuota mínima y tope mensual para cuentas grandes, comparando margen con almacenamiento y soporte.

## Definiciones que se implementarán

- **Alumno invitado:** no posee acceso habilitado y no genera cargo.
- **Alumno habilitado:** puede acceder; cuenta aunque no abra la app. Se factura una sola vez por organización, aun con dos profesionales asignados.
- **Alumno pausado:** deja de contar desde la fecha de pausa según regla publicada; conserva historial con el acceso permitido por contrato.
- **Alumno archivado:** sin acceso ni cargo futuro; historial retenido/exportado según política de datos.
- **Periodo:** mes calendario en `America/Asuncion`, `[día 1 00:00, día 1 del siguiente mes 00:00)`. Si se necesita ciclo por fecha de alta, introducirlo como nueva versión de plan tras validación.
- **Día facturable propuesto:** día calendario en que el alumno tuvo acceso habilitado en algún momento. Alta y pausa el mismo día cuentan como un día. Timestamps y cambios de estado se registran; las ventanas se calculan en zona local. Publicar esta regla antes de cobrar.
- **Prorrateo:** `precio_mensual × días_habilitados / días_del_mes`, redondeo al guaraní entero por alumno con `ROUND_HALF_UP`; sumar los importes redondeados. Ejemplo 15 de 30 días a G. 15.000 = G. 7.500. Congelar fórmula, precio y zona en cada periodo.

La cuota base, incluidos, mínimo y tope son campos versionados del plan, inicialmente 0/no aplicable hasta decidirlos comercialmente. No introducir cargos sin explicación visible.

## Tareas de implementación T02 y T07

1. `saas_plans` + versiones inmutables con precio, límites, fecha de vigencia y reglas; suscripción apunta a versión concreta.
2. Abrir/cerrar intervalos facturables en la misma transacción que cambia el acceso. Impedir solapamientos y duplicados bajo concurrencia. Conservar actor, razón y hora.
3. Simulador en superadmin y coach: alumnos, días, precio, subtotal y total. Previsualización antes del cierre.
4. Cierre idempotente del periodo: snapshot del plan, suma por alumno, líneas y total. Reejecutar el job no crea otra cuenta ni cambia una ya emitida.
5. Registrar pago manual con referencia, comprobante privado, fecha, actor confirmador y estado; la confirmación actualiza saldo mediante transacción y auditoría.
6. Correcciones posteriores mediante nota de ajuste/abono y motivo, nunca alterando silenciosamente el periodo histórico.
7. Probar altas, pausa, reactivación, meses de 28/29/30/31 días, cambio de plan a mitad de ciclo, dos coaches por alumno, baja y concurrencia.

## Dos libros de dinero separados

`saas_*`: lo que el coach debe al operador de la plataforma. `coach_*`: servicios y pagos que el alumno debe al coach (T12). No mezclar reportes ni saldos. El PDF de estado de cuenta comercial es informativo; los requisitos de factura fiscal y tributación se validan con asesor local antes de cobrar formalmente.

## Métricas del piloto

Coaches que crean primera rutina en 24 h, alumnos invitados que activan cuenta, alumnos que completan primer entrenamiento en 7 días, sesiones por alumno/semana, tiempo del coach para crear plan, errores de sincronización, tickets de soporte por 100 alumnos, almacenamiento/transferencia por organización, pago y retención del coach. Revisión semanal con datos agregados; no incluir datos sensibles en analítica de producto.

## Estado implementado hasta T02

Básico/Pro versión 1, prueba de 14 días, cupos 25/100, precios de prueba 10.000/15.000 PYG, intervalos transaccionales y cambio auditado de versión de suscripción. La aplicación todavía no liquida esos intervalos, no emite facturas y no procesa cobros. Ver [uso de planes](runbooks/t02-uso-y-soporte.md) y [ADR](decisiones/002-organizaciones-y-acceso.md).


## Implementación local T07 — 21-10-2026

Cuenta informativa por mes en Paraguay con días distintos, redondeo entero por alumno, versión/precio de apertura y snapshot inmutable; ajustes/pagos/reversiones auditados y comprobantes privados. La habilitación administrativa activa la suscripción y registra inicio actual, sin retroactividad; el cálculo respeta fin de prueba. Cambio de precio durante el mes aplica al siguiente, manteniendo cupos/funciones inmediatos de T02. Base/incluidos/mínimo/tope siguen 0/0/0/null.

El mes actual es estimación. Emisión de mes terminado, sin pasarela/cobro automático ni factura fiscal. [Fórmula y ejemplos](evidencias/t07-calculos.md), [uso](runbooks/t07-uso-y-operacion.md), [API](runbooks/api-t07.md), [decisiones](decisiones/007-pwa-y-cuenta-saas.md). Precios/acuerdos/coste y revisión comercial/legal pendientes de piloto; [registro](piloto/02-registro.md).


## Presupuesto documental T08

Básico 10 / Pro 50 solicitudes PDF por mes de Paraguay, cuatro preparaciones pendientes y hasta 10 MiB de salida. Reintentar una versión no añade solicitud; no hay nueva tarifa ni cargo implícito. Bytes compartidos con medios/logos/fotos; reutilizar medio no duplica almacenamiento. Son límites técnicos iniciales, pendientes de validación comercial. Los documentos de entrenamiento no son facturas ni exponen pagos/comprobantes. [Operación](runbooks/t08-uso-y-operacion.md).

## Alimentación T09 — alcance comercial

Capacidad profesional y catálogo verificado por el estudio; no certificación automática, prescripción algorítmica o recargo nuevo por este módulo. El presupuesto de menú PDF comparte Básico 10 / Pro 50 solicitudes mensuales con T08. Fotos comparten espacio y retención; límites iniciales 200 alimentos, 100 recetas, 50 menús y 84 días/asignación. Validar utilidad, permisos y contenido con profesionales antes de cobrar por este alcance. [ADR 009](decisiones/009-alimentacion-versionada.md), [puertas](piloto/00-puertas.md).

## T12 implementada — Operaciones coach/alumno

La cuenta SaaS anterior conserva su modelo por plaza. /servicios añade ventas del coach a alumnos en tablas coach_* independientes: precio congelado y moneda, vigencia fija, cuotas/pagos manuales, devoluciones/correcciones/ajustes e historial. No activa accesos ni cobra automáticamente. Renovación es venta nueva explícita; cancelación conserva obligación hasta ajustar/devolver según corresponda.

Se soportan PYG/USD/EUR en unidad mínima, sin conversión ni suma entre monedas. Neto registrado se distingue de precio comprometido y saldo actual de cuotas; no constituye contabilidad fiscal. [ADR y fórmulas](decisiones/012-negocio-del-coach.md), [manual](runbooks/t12-uso-y-operacion.md). Validación comercial con coaches/políticas definitivas sigue pendiente.
