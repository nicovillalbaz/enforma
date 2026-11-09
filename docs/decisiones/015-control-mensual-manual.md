# ADR 015 — Mensualidad, cupo y acceso manual

**Decisión expresa del usuario, 22-10-2026. T14-07 implementada en local, v0.14.2/023.** El operador define en su panel precio mensual, máximo de alumnos habilitados y acceso del coach. El coach decide pago mensual y acceso de cada alumno. Suspender al coach bloquea también a sus alumnos. Ninguna pasarela, cobro o suspensión por cambio de mes automática. [Resultados y límites](../evidencias/t14-control-mensual.md).

**Usuarios:** operador y coach independiente. **Problema:** los flujos anteriores exigían planes/cuotas y ofrecían prueba automática en vez de decisiones del responsable. **Alternativa actual:** registros detallados T07/T12 y suspensión separada. **Resultado esperado:** controles claros de pago por mes y acceso, cupo comprobado en servidor e historial de correcciones. **Soporte:** mismo stack/worker, sin dependencias nuevas. **Parada:** no desarrollar contabilidad, cobro ni automatismos; verificar solo contratos nuevos y pantallas afectadas.

## Reglas de implementación

1. Mes calendario en zona del estudio, selector mensual e historial conservado. Un mes nuevo empieza sin marca de pagado; no cambia acceso ni copia el pago anterior.
2. Alta nueva: espacio pendiente/suspendido, sin acceso de trabajo ni alumnos hasta habilitación explícita del operador. No prueba gratuita automática. Precio sin definir, cupo inicial cero; el operador puede permitir acceso con cupo cero para preparar contenido.
3. Precio fijo mensual PYG configurable por coach, opcional mientras no se acuerda. Cero es válido; sin definir no es cero. No es cargo bancario, tarifa pública o factura fiscal.
4. Cupo de alumnos **habilitados** 0–5000, independiente del tier técnico heredado. Invitados/pausados/archivados no ocupan plaza; reactivar o aceptar invitación valida cupo bajo bloqueo del estudio. No reducir por debajo de alumnos conservados como activos, incluso si el estudio está suspendido.
5. El operador guarda precio/cupo/acceso con revisión, intención idempotente y motivo. Marcar pago mensual es otra acción: no restaura una suspensión por otra causa. El coach usa las transiciones existentes para acceso de alumnos; no basta marcar pagado.
6. Espacios anteriores conservan configuración/historial hasta revisión explícita del operador. Al guardar control manual se dejan atrás prueba/precio por alumno para decisiones de acceso futuras, sin reescribir cuentas anteriores. Revisar todos los espacios antes de piloto real.
7. Al suspender estudio se bloquea el trabajo del coach y acceso de alumnos, sin cambiar individualmente activos a pausados ni borrar sesiones. Restaurar recupera solo alumnos que seguían activos, manteniendo cupo. La cuenta mensual propia sigue consultable por owner suspendido.
8. Permisos: solo operador cambia precio/cupo/acceso y pago del coach. Solo owner activo del estudio marca pagos de sus alumnos; alumno/otro coach no escriben ni listan esos datos. Administrar plataforma no concede acceso a pagos privados de alumnos.
9. Migración nueva 023; conservar 001–022. Tablas nuevas con RLS, funciones de escritura controladas, revisiones e historial append-only. Backup añade indicadores correspondientes; no se simula una restauración ejecutada.

## Diseño y verificación

Móvil primero: tarjetas, selector de mes, estado escrito y acciones separadas. PC usa rejilla flexible, campos 16 px/acciones 44 px, sin bloquear zoom. Cinco destinos y firma NAVZ conservados. Sin comprobantes, importes o emisión obligatorios para marcar el mes.

Pruebas puntuales: alta bloqueada, operador configura/activa, cupo/revisión y aislamiento, pago no cambia acceso, suspensión en cascada y recuperación de alumnos individualmente activos. Una revisión de pantallas afectadas con datos sintéticos; sin suites históricas, PDFs, carga o restore rutinarios. Resultados se registrarán al terminar.
