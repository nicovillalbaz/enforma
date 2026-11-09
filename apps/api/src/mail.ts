export function transactionalMail(kind: string, payload: Record<string, unknown>) {
  if (typeof payload.to !== 'string' || typeof payload.url !== 'string')
    throw new Error('Invalid mail payload');
  const content: Record<string, { subject: string; introduction: string }> = {
    'email.password_reset': {
      subject: 'Recupera tu acceso a Forma',
      introduction: 'Solicitaste restablecer tu contraseña. El enlace vence en 30 minutos.',
    },
    'email.verification': {
      subject: 'Confirma tu correo en Forma',
      introduction:
        'Confirma tu correo para comenzar a invitar alumnos. El enlace vence en 24 horas.',
    },
    'email.invitation': {
      subject: `Tu invitación a ${typeof payload.studioName === 'string' ? payload.studioName : 'tu estudio'}`,
      introduction:
        'Tu coach te invitó a su espacio de entrenamiento. El enlace se puede usar una sola vez y vence en 72 horas.',
    },
  };
  const selected = content[kind];
  if (!selected) throw new Error('Unknown mail kind');
  return {
    to: payload.to,
    subject: selected.subject,
    text: `${selected.introduction}\n\n${payload.url}\n\nSi no esperabas este mensaje, puedes ignorarlo.`,
  };
}
