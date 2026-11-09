export class ApiProblem extends Error {
  constructor(
    public statusCode: number,
    public publicCode: string,
    message: string,
  ) {
    super(message);
  }
}
export const problem = (status: number, code: string, message: string) =>
  new ApiProblem(status, code, message);
const databaseProblems: Record<string, [number, string]> = {
  INVALID_MANUAL_CONTROL: [400, 'Revisa mes, cupo, importe y motivo.'],
  STALE_MANUAL_CONTROL: [409, 'Los datos cambiaron. Actualiza antes de guardar.'],
  MANUAL_CAPACITY: [
    409,
    'El cupo no puede ser menor que los alumnos activos, incluso si el estudio está suspendido.',
  ],
  MANUAL_INTENTION_CONFLICT: [
    409,
    'Esta intención ya se usó con otros datos. Actualiza antes de repetir.',
  ],
  MANUAL_HISTORY_IMMUTABLE: [409, 'El historial se conserva. Registra una corrección.'],
  INDEPENDENT_COACH_ONLY: [400, 'Esta versión está preparada para coaches independientes.'],
  INVALID_COMMERCE: [400, 'Revisa importes, fechas, moneda y campos del negocio.'],
  COACH_NOT_FOUND: [404, 'El servicio, contrato o movimiento no está disponible.'],
  STALE_COMMERCE: [409, 'Los datos cambiaron. Actualiza antes de guardar.'],
  COMMERCE_LIMIT: [409, 'Se alcanzó el límite de catálogo, operaciones o comprobantes.'],
  COACH_INSTALLMENTS: [400, 'Las cuotas deben sumar exactamente el precio vigente del servicio.'],
  COACH_CAPACITY: [409, 'El servicio no tiene cupo en todo el periodo elegido.'],
  COACH_OVERLAP: [409, 'El alumno ya tiene este servicio en ese periodo.'],
  COACH_RENEWAL: [
    409,
    'La renovación debe continuar el mismo servicio y alumno después del periodo anterior.',
  ],
  COACH_BALANCE: [409, 'El movimiento supera el saldo o produciría un importe pendiente negativo.'],
  COACH_SESSION: [409, 'Revisa vigencia, asistencia, saldo de sesiones o consumo ya restaurado.'],
  COACH_CONVERSION: [409, 'La conversión necesita un correo y un prospecto abierto.'],
  COMMERCE_IMMUTABLE: [409, 'El historial se conserva. Registra un ajuste o una corrección.'],
  INVALID_AGENDA: [400, 'Revisa fechas, duración, capacidad y campos de la agenda.'],
  AGENDA_NOT_FOUND: [404, 'La cita, clase o reserva no está disponible.'],
  STALE_AGENDA: [409, 'La agenda cambió en otra sesión. Actualiza antes de guardar.'],
  AGENDA_AVAILABILITY: [
    409,
    'El horario debe estar dentro de un bloque disponible del profesional.',
  ],
  AGENDA_CAPACITY: [
    409,
    'No hay plazas libres o la capacidad propuesta es menor que las reservas.',
  ],
  AGENDA_CUTOFF: [409, 'La antelación o el estado ya no permiten esta operación.'],
  AGENDA_ALREADY_BOOKED: [409, 'Ya tienes una reserva confirmada para este evento.'],
  AGENDA_REASON: [400, 'Indica un motivo de entre 10 y 300 caracteres.'],
  AGENDA_LINK: [403, 'El alumno debe estar activo y vinculado al profesional de la sesión.'],
  AGENDA_LIMIT: [429, 'Se alcanzó el límite operativo de agenda o reservas.'],
  AGENDA_REFERENCED: [409, 'El bloque contiene sesiones activas. Reubícalas o cancélalas primero.'],
  AGENDA_RETRY: [409, 'Este aviso no admite reintento o ya venció su periodo.'],
  INVALID_FOLLOWUP: [400, 'Revisa campos, valores, fechas y unidades.'],
  FOLLOWUP_NOT_FOUND: [404, 'Conversación o contenido no disponible.'],
  STALE_FOLLOWUP: [409, 'El contenido cambió. Actualiza antes de guardar.'],
  FOLLOWUP_CONSENT: [403, 'El alumno debe autorizar el seguimiento en esta conversación.'],
  FOLLOWUP_DATE: [409, 'La fecha o el periodo de respuesta no permite esta operación.'],
  FOLLOWUP_LIMIT: [429, 'Se alcanzó el límite de conversaciones, mensajes o asignaciones.'],
  FOLLOWUP_LOCKED: [409, 'La respuesta ya fue revisada o cerró su periodo de edición.'],
  SCANNER_UNAVAILABLE: [503, 'El análisis de archivos no está disponible.'],
  INVALID_NUTRITION: [
    400,
    'Revisa alimentos, fuentes, porciones, fechas y permisos de alimentación.',
  ],
  STALE_NUTRITION: [409, 'Los datos cambiaron en otra sesión. Actualiza antes de guardar.'],
  NUTRITION_NOT_FOUND: [404, 'No se encontró el contenido de alimentación.'],
  NUTRITION_LIMIT: [409, 'Se alcanzó el límite de catálogo, versiones, comentarios o fotos.'],
  NUTRITION_CONSENT: [
    403,
    'Activa el consentimiento correspondiente en Privacidad de alimentación.',
  ],
  NUTRITION_DATE: [
    409,
    'El menú debe estar activo. Registra entre hoy y los últimos 30 días dentro de su periodo.',
  ],
  RESOURCE_NOT_FOUND: [404, 'No se encontró el recurso o no tienes acceso.'],
  INVALID_RESOURCE: [400, 'Revisa el tipo, fechas y datos del recurso.'],
  STALE_RESOURCE: [409, 'El recurso cambió en otra sesión. Actualiza antes de guardar.'],
  RESOURCE_LIMIT: [
    409,
    'Se alcanzó el límite operativo de colecciones, versiones o filas del PDF.',
  ],
  RESOURCE_MONTHLY_LIMIT: [409, 'Alcanzaste el presupuesto de generación de PDF de este mes.'],
  RESOURCE_LINK_EXPIRED: [403, 'El enlace temporal venció. Prepara otro desde el recurso.'],
  INVALID_BILLING: [400, 'Revisa mes, guaraníes enteros, fecha y motivo.'],
  IMMUTABLE_BILLING: [
    409,
    'Los asientos emitidos no se modifican. Registra un ajuste o reversión.',
  ],
  BILLING_LIMIT: [409, 'Se alcanzó el límite operativo de cuentas o comprobantes.'],
  BILLING_NOT_FOUND: [404, 'No se encontró la cuenta o el pago.'],
  BILLING_PERIOD_OPEN: [409, 'El mes sigue abierto. Puedes consultar la estimación.'],
  BILLING_NOT_ENABLED: [
    409,
    'La cuenta no estaba habilitada en ese mes. No se generan cargos retroactivos.',
  ],
  BILLING_OVERPAYMENT: [409, 'El movimiento superaría el saldo o dejaría un total negativo.'],
  BILLING_ALREADY_REVERSED: [409, 'Ese pago ya tiene una reversión.'],
  INVALID_PROGRESS: [400, 'Revisa valores, fechas y permisos del progreso.'],
  STALE_PROGRESS: [409, 'La configuración cambió. Actualiza antes de guardar.'],
  PROGRESS_LIMIT: [409, 'Se alcanzó el límite de registros. Contacta con soporte.'],
  PHOTO_CONSENT_REQUIRED: [403, 'Activa el consentimiento para usar fotos de progreso.'],
  WORKOUT_NOT_FOUND: [404, 'No se encontró la sesión.'],
  INVALID_WORKOUT: [400, 'Revisa los valores y unidades del registro.'],
  WORKOUT_DATE: [409, 'Prepara un día entre los últimos 30 y los próximos 7 días.'],
  WORKOUT_ACCESS_REVOKED: [
    403,
    'El programa se canceló. Conservamos tus registros; consulta a tu coach.',
  ],
  WORKOUT_EVENT_LIMIT: [409, 'Esta sesión alcanzó el límite de cambios. Contacta con soporte.'],
  IMMUTABLE_EVENT: [409, 'Los hechos auditados no se pueden modificar.'],
  PROGRAM_NOT_FOUND: [404, 'No se encontró el programa.'],
  VERSION_NOT_FOUND: [404, 'No se encontró la versión publicada.'],
  ASSIGNMENT_NOT_FOUND: [404, 'No se encontró la asignación.'],
  STALE_PROGRAM: [409, 'El programa o la asignación cambió. Vuelve a abrirlo.'],
  INVALID_PROGRAM: [400, 'Revisa las semanas, días y prescripciones antes de continuar.'],
  INVALID_REFERENCE: [400, 'El ejercicio o equipo no está disponible en este estudio.'],
  MEDIA_NOT_READY: [409, 'Espera a que todos los medios estén listos antes de publicar.'],
  IMMUTABLE_VERSION: [409, 'Una versión publicada no puede modificarse. Crea otra versión.'],
  UNAUTHENTICATED: [401, 'Inicia sesión para continuar.'],
  FORBIDDEN: [403, 'No tienes permiso para esta operación.'],
  STUDENT_NOT_FOUND: [404, 'No se encontró el alumno.'],
  ORGANIZATION_NOT_FOUND: [404, 'No se encontró el estudio.'],
  EMAIL_NOT_VERIFIED: [403, 'Verifica tu correo antes de invitar alumnos.'],
  INVALID_PLAN: [400, 'El plan seleccionado no está disponible.'],
  INVALID_TRANSITION: [400, 'Este cambio de estado no está permitido.'],
  STALE_STUDENT: [409, 'El alumno cambió en otra sesión. Actualiza su ficha.'],
  INVITATION_REQUIRED: [409, 'El alumno debe aceptar su invitación antes de habilitar el acceso.'],
  INVALID_INVITATION: [400, 'La invitación venció o ya no está disponible. Solicita una nueva.'],
  INVITATION_ACCOUNT_MISMATCH: [403, 'La invitación corresponde a otra cuenta.'],
  STUDENT_LIMIT: [409, 'Alcanzaste el límite de alumnos habilitados de este plan.'],
  SUBSCRIPTION_INACTIVE: [
    403,
    'La suscripción no permite habilitar más accesos. Contacta al administrador.',
  ],
  ORGANIZATION_LIMIT: [409, 'Alcanzaste el límite de estudios de esta cuenta.'],
  MEDIA_SIZE: [413, 'El archivo supera el tamaño permitido.'],
  MEDIA_QUOTA: [
    409,
    'No hay espacio o minutos suficientes en tu plan. Elimina medios sin uso o revisa el plan.',
  ],
  MEDIA_QUEUE_FULL: [429, 'Hay cuatro cargas pendientes en este estudio. Espera a que terminen.'],
  MEDIA_STATE: [409, 'La carga cambió de estado. Actualiza su ficha antes de repetir.'],
  MEDIA_NOT_FOUND: [404, 'No se encontró el medio.'],
  MEDIA_REFERENCED: [
    409,
    'Este medio está asociado a un ejercicio o equipo. Desvincúlalo antes de eliminarlo.',
  ],
  IDEMPOTENCY_CONFLICT: [
    409,
    'Esta solicitud ya se usó con otro contenido. Inicia una operación nueva.',
  ],
  SLUG_RESERVED: [409, 'Esta dirección no está disponible. Elige otra.'],
};
export function expectedDatabaseProblem(error: unknown): ApiProblem | undefined {
  if (!error || typeof error !== 'object' || !('code' in error)) return;
  const item = error as { code: string; message?: string; constraint?: string };
  if (item.code === '23P01' && item.constraint?.startsWith('agenda_'))
    return problem(
      409,
      'AGENDA_OVERLAP',
      'Ya existe una ocupación del profesional o del alumno en ese horario.',
    );
  if (item.code === '23P01')
    return problem(
      409,
      'ASSIGNMENT_OVERLAP',
      'El alumno ya tiene un programa en ese periodo. Cancela la asignación anterior o elige otra fecha.',
    );
  if (item.code === 'P0001' && item.message && databaseProblems[item.message]) {
    const [status, message] = databaseProblems[item.message]!;
    return problem(status, item.message, message);
  }
  if (item.code === '23505')
    return problem(
      409,
      'DUPLICATE',
      'Ya existe un registro con esos datos. Revisa el correo o la dirección del estudio.',
    );
  if (item.code === '23503')
    return problem(
      400,
      'INVALID_REFERENCE',
      'La referencia no pertenece a este estudio o no está disponible.',
    );
  if (['23514', '23502', '22P02', '22007', '22008'].includes(item.code))
    return problem(400, 'INVALID_DATA', 'Revisa los datos ingresados.');
}
