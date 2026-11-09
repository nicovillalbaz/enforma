# Protocolo de piloto y soporte

## A. Antes de incorporar personas

1. Completar P01–P12 de [puertas](00-puertas.md), según su dependencia. Para pruebas físicas previas usar cuentas ficticias; datos reales requieren finalidad/condiciones/privacidad revisadas.
2. Preparar entorno separado del desarrollo. No incluir el seed de contraseñas compartidas ni ejecutar E2E contra la base del piloto.
3. Revisar catálogo/autoría y presupuesto de medios. No incorporar fotos corporales por defecto ni para demostrar éxito comercial.
4. Asignar responsable de soporte y suplente, horario y forma de escalar. Definir objetivo inicial de respuesta con coaches, sin declarar SLA no medido.
5. Registrar acuerdo/precio/límites y coste real; habilitar cuenta SaaS solo cuando exista esa decisión. No activar por alta automática ni cobrar meses anteriores.

## B. Ensayo en teléfonos (cuentas ficticias)

1. Registrar dispositivo, OS, navegador, tamaño, versión de Forma y red. Ejecutar en iPhone pequeño, otro iPhone y Android de gama baja.
2. Abrir enlace de marca → entrar → añadir al inicio → cerrar navegador/app → abrir icono. Verificar nombre, icono, estudio y cuenta. Repetir con otra marca y otra cuenta; ninguna debe heredar el acceso de la anterior.
3. Preparar una rutina → iniciar → teclado decimal → serie → descanso → notas → parcial. Girar, aumentar texto, bloquear/desbloquear y volver desde otra app; guardar no puede quedar tapado por teclado/barra del sistema.
4. Pasar a modo avión después de preparar → registrar dos series → recargar/cerrar/reabrir → reconectar. Comparar valores y una sola copia en historial/coach; resolver conflicto entre dos dispositivos y acceso cancelado.
5. Ver gráfico/tabla; comprobar carga cero y ausencia de dato. Registrar/anular medición. Activar fotos opcionales, probar orientación y archivo grande/HEIC con error comprensible; revocar permiso y repetir URL autorizada anterior.
6. Preparar actualización con formulario abierto. Verificar que espera; guardar/sincronizar y cerrar todas las ventanas. Reabrir y comprobar versión y cuenta correctas. No borrar almacenamiento para simular aceptación.
7. En admin configurar precio mensual/cupo/acceso del coach; en su cuenta comprobar precio/cupo actuales y marca del mes. Desde coach marcar pago mensual del alumno y gestionar acceso por separado. Cambiar de mes, pausar/restaurar y comprobar límites. Usar solo pagos ficticios; el alumno no ve la cuenta SaaS ni comprobantes privados del coach.
8. Lector de pantalla/teclado, 200 % texto y zoom real: foco visible, nombres de controles, tablas y errores. Registrar captura sin personas/datos reales y defectos por caso.

## C. Incorporación (3–5 coaches, cuando esté autorizada)

1. Seleccionar coaches con distintos tamaños de cartera; registrar hipótesis/objetivo y aceptación del precio. Obtener consentimiento y reglas de acceso/datos antes de invitar alumnos.
2. Alta guiada del primer día: marca, una plantilla, tres alumnos y un clip permitido. Cronometrar tareas con una persona observando; timestamps de DB no miden tiempo activo de trabajo.
3. Mostrar invitación privada y acceso propio del alumno, permiso de fotos/mediciones y diferencia entre guardado local y confirmado.
4. Explicar el precio mensual fijo y cupo acordados en admin, pago externo y habilitación explícita. El coach registra el mes pagado de sus alumnos y decide su acceso. Un mes nuevo no hereda pago y marcar pagado no habilita automáticamente. Las cuentas históricas por días no son la regla comercial vigente.
5. No enviar mensajes desde el agente sin autorización expresa de la persona. El registro de una lista de coaches no autoriza contactarles.

## D. Semanas 1–4

1. Semana 1: activación, primer programa y primera sesión; corregir bloqueos antes de ampliar funciones.
2. Semanas 2–3: uso semanal, tiempo observado de rutina, cola/sincronización, tickets por 100 alumnos, almacenamiento/egreso y soporte. Resumen de administración contiene agregados, no medidas/fotos/notas.
3. Semana 4: exactitud de cuenta, pago/disposición a pagar, retención y motivos de abandono. No sustituir conversación observada por registros de login.
4. Revisión semanal de defectos: crítico privacidad/pérdida/cuenta errónea → detener ampliación y corregir; importante usabilidad → priorizar; mejora → backlog. Conservar versiones y resultado de repetición.
5. Coste: factura VPS/backup, egreso, dominio, impuestos y horas reales. Registrar desconocidos; no proyectar desde el volumen sintético local.

## E. Soporte, exportación y borrado

1. Abrir ticket con ID anónimo, estudio afectado y síntoma mínimo. Verificar identidad por canal registrado; no pedir contraseña ni un token de invitación completo.
2. Separar pérdida de acceso de eliminación: pausa/archivo conserva historia y cierra intervalo; no equivale a borrar datos. Revocación de fotos tiene su propio flujo inmediato y depuración de bytes a 30 días.
3. Exportación: verificar solicitante/finalidad y alcance, documentar autorización y destinatario seguro. El [procedimiento T14-08](../runbooks/t14-cierre-local.md) prepara dossier estructurado cifrado por estudio/alumno; completar archivos/contexto y revisión antes de cerrar una solicitud integral. No enviar dumps completos de plataforma, backups o bytes privados por chat de soporte.
4. Borrado integral: definir obligaciones/retención con responsable de datos, incluyendo cuentas/comprobantes/auditoría y backups. No ejecutar DELETE manual contra tablas con hechos inmutables ni reutilizar un backup antiguo para recuperar fotos retiradas.
5. La versión local ofrece anulación, revocación, retirada de fotos y dossier/inventario técnico por alumno. **No tiene exportación/borrado integral autoservicio; el inventario no borra datos.** P03 permanece abierta hasta completar/autorizar archivos/contexto, conservación, eliminación integral y tratamiento de respaldos. El alcance documental/PDF de T08 no cierra por sí solo esta puerta.

## F. Incidentes y cierre

1. Registrar hora/versión/alcance sin datos sensibles. Cortar acceso afectado con acción auditada si está autorizado; preservar evidencia y no reenviar fotos o recibos como diagnóstico.
2. Revisar health/cola/disco/cuotas y último backup de la base correcta. No consumir correos pendientes hacia personas reales para “probar” SMTP.
3. Si se requiere restaurar, hacerlo primero aislado; hashes/conteos/referencias, saldo y revocaciones/borrados posteriores al snapshot. Aprobar reapertura con el responsable del servicio.
4. Cerrar piloto solo con observación de uso, cero defectos críticos abiertos, precio/coste revisados y decisión humana registrada. Elegir pasar/corregir/pausar, con evidencia y siguiente prioridad de T08–T10.
