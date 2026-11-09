# T14 — Pendientes priorizados y control manual

**Decisión del usuario, 22-10-2026. Implementado local v0.14.2, 001–023; próxima 024.** Las reglas de precio/período, alta y suspensión ya fueron respondidas. [Guía vigente](../runbooks/t14-control-mensual.md), [acta y capturas](../evidencias/t14-control-mensual.md). Los apartados de propuesta inicial que siguen conservan su contexto; no son nuevos bloqueos de definición. [Avances](../avances.md), [puertas](00-puertas.md), [ficha de salida](03-salida-independiente.md).

**Actualización 23-10-2026:** [T14-08](../runbooks/t14-cierre-local.md) entrega dossier estructurado cifrado e inventario de revisión por alumno y adapta preparaciones de pruebas a aprobación manual. Dos casos dirigidos aprobados; no se ejecuta matriz histórica. El procedimiento integral de derechos de datos y P03 siguen abiertos.

## 1. Decisión confirmada: dinero fuera de la aplicación

- Alumno paga al coach por el medio externo acordado. El coach registra si pagó o sigue pendiente.
- Coach paga al operador por el medio externo acordado. El operador verifica por su cuenta y registra el estado desde su panel; decide habilitar, mantener, suspender o restaurar acceso.
- No incluir checkout, pasarela, tarjeta, débito, sincronización bancaria, webhook de pago o validación automática de transferencias. La aplicación no mueve dinero ni confirma operaciones bancarias.
- El registro de pago y el permiso de acceso son datos distintos. Marcar pagado no debe restaurar inadvertidamente una suspensión por otra causa. No implantar bloqueo automático por impago.
- Mantener estado por mes/período y actor/fecha de cambio; un único indicador permanente perdería el historial al cambiar de mes. Pagado/Pendiente debe ser comprensible sin desplegar una gestión contable completa.
- No exigir comprobante para marcar pago. La UI simple no debe obligar a emitir cuentas, cargar imágenes o repartir cuotas para el caso habitual. Campos avanzados existentes no constituyen requisitos del flujo simple.
- Conservar registros financieros históricos, datos y permisos existentes. Reducir la interfaz no autoriza borrar tablas, pagos o comprobantes.

## 2. Base existente frente a trabajo pendiente

| Parte | Base anterior conservada | Adaptación entregada en T14-07 |
|---|---|---|
| Coach/alumno | T12 registra pagos externos, saldo/cuotas y correcciones, sin mover dinero | Vista sencilla por alumno/período, marcar Pagado/Pendiente y corregir con historia |
| Operador/coach | T07 registra pagos externos; /admin permite suspender/restaurar un estudio con motivo y auditoría | Mostrar pago del período junto al acceso del coach y facilitar acción manual explícita |
| Prueba/alta | Existe prueba de 14 días y reglas de suscripción previas | Decidir estado inicial/prueba; revisar su interacción con habilitación manual antes de cambiar código |
| Suspensión | Suspender estudio corta también acceso de sus alumnos activos; restaurar lo recupera según estado | Confirmar si ese efecto es el deseado para impago del coach y explicarlo antes de aplicar |
| Seguridad | Separación saas_* / coach_*, permisos y hechos históricos | Preservar separación; alumno no marca su propio pago, coach no modifica su pago al operador |

La prueba WebKit 0.14.1 verificó registro manual, reintento sin duplicado y comprobante; nunca probó ni implantó una pasarela. [Evidencia](../evidencias/t14-continuacion.md).

## 3. T14-07 entregada en local: control mensual simple

**Usuario:** coach independiente y operador. **Problema observado:** el registro existente exige más conceptos que marcar pago del período y gestionar acceso. **Alternativa actual:** cuenta/cuotas detalladas y acción de acceso separada. **Resultado esperado:** lista móvil/PC con período, Pagado/Pendiente y acceso explícito, manteniendo historial y permisos. **Soporte:** reutilizar infraestructura existente, sin servicios/SDK o worker nuevos. **Parada:** no ampliar a contabilidad/pasarelas ni automatizar suspensiones; pedir solo reglas que cambien el resultado.

1. Reglas resueltas: mensualidad/cupo/acceso configurables por operador; alta nueva pendiente de habilitación, sin prueba automática; suspender coach bloquea alumnos. No se necesita otro precio fijo fuera del panel.
2. Revisar reutilización de modelos existentes antes de crear tablas o migraciones. 023 aplicada; próxima 024. No editar migraciones aplicadas.
3. Diseñar listado del coach: alumno, período elegido y estado; acción sencilla con confirmación y corrección trazable. Importe solo si forma parte del acuerdo definido.
4. Diseñar listado del operador: coach, pago del período y acceso; acciones Habilitar/Suspender/Restaurar separadas de la marca de pago, con motivo y aviso de efecto sobre alumnos.
5. Mantener contexto móvil primero, PC con espacio suficiente, campos 16 px, acciones táctiles 44 px, zoom nativo, cinco destinos y firma NAVZ. Sin panel contable complejo como paso obligatorio.
6. Servidor autoriza cada cambio y conserva actor/fecha/período. Cambio de mes no borra el anterior. No presentar un click local como guardado confirmado si falla la red.
7. Verificar solo los casos nuevos: otro coach/alumno no modifica pago ajeno, repetición no duplica, corrección conserva historia y acceso solo cambia por acción autorizada. Una revisión visual corta de pantallas afectadas, sin suites históricas o PDF/restore rutinarios.
8. Actualizar acta, guías, versiones y avances con resultado observado. Esta guía no equivale a implementación de esos pasos.

## 4. Prioridad y consumo

| Orden | Pendiente | Qué puede hacerse con bajo consumo | Qué se necesita |
|---|---|---|---|
| 1 | Control manual simple | T14-07 local, reutilizando backend; pocos casos nuevos | Reglas de sección 5 |
| 2 | Identidad/soporte y condiciones | Completar ficha y textos; sin navegador/build por Markdown | Nombre del operador, canal y precio/límites acordados |
| 3 | Datos/contenido y alcance inicial | Preparar procedimiento concreto de exportación/borrado y revisión de contenido | Responsable, finalidades/retención/menores y catálogo permitido; aprobación/verificación pendientes |
| 4 | Prueba guiada móvil/PC | Una persona de confianza, datos ficticios y casos esenciales; repetir solo fallos | iPhone/Android disponibles. Segundo iPhone y matriz física completa antes de cerrar P04 |
| 5 | Staging mínimo | Usar infraestructura disponible, configuración/HTTPS/SMTP y una sonda operativa | Dominio/VPS o acceso autorizado, remitente/correo y presupuesto máximo |
| 6 | Continuidad | Una recuperación externa aislada programada cuando exista el destino | Copia/clave separadas, destino y responsable; medir RPO/RTO |
| 7 | Piloto real | Primera incorporación acompañada y luego cohorte de 3–5; observación hasta cuatro semanas | Coaches de confianza, acuerdos, responsables y puertas aplicables cerradas |

Si recursos/contenido profesional no están listos, decidir antes qué módulos entran al piloto; cualquier módulo excluido debe quedar efectivamente inaccesible. No cerrar scanner/privacidad/permisos omitiendo una prueba de una función que sigue disponible.

No hacen falta más suites completas, benchmarks de carga, navegadores instalados, restauraciones repetidas o PDFs para decidir el control manual. Las evidencias 0.14.1 se reutilizan hasta que cambie su alcance. Infraestructura/correo/backup sí necesitan medios y pruebas reales antes de personas/datos reales.

## 5. Información mínima del usuario

### Para implementar el siguiente paso local

1. **Resuelto:** todo mensual. El operador define precio y cupo de cada coach desde su panel; el coach acuerda el pago de sus alumnos fuera de la app y registra el mes.
2. **Resuelto:** el operador decide habilitación desde admin. Nueva alta pendiente, sin prueba gratuita automática.
3. **Resuelto:** suspender coach corta también el acceso de sus alumnos, sin borrar historia ni reactivar alumnos pausados al restaurar.

### Para completar la salida, más adelante

- Nombre/identidad del operador y canal de soporte; la firma NAVZ de creador no asigna ese rol por sí sola.
- Si ya hay dominio/VPS/correo y presupuesto mensual máximo; no contratar ni instalar nada para responder esta ficha. Entregar secretos mediante configuración segura, no en Markdown/chat.
- Disponibilidad de iPhone y Android y un coach de confianza para prueba guiada inicial, con cuentas ficticias.
- Decisión sobre módulos iniciales, contenido permitido y responsable de privacidad. Aprobar finalidad/retención/menores y un procedimiento de exportación/borrado; el autoservicio integral no está implementado.

**Estado vigente:** T14-07 implementada localmente, v0.14.2/023, con pruebas dirigidas y acta. La propuesta documental anterior queda sustituida por la guía vigente. Piloto real y puertas físicas/externas pendientes.
