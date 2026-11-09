export function moreNavigation(learner: boolean, owner: boolean) {
  return [
    {
      title: learner ? 'Mi entrenamiento' : 'Mi trabajo',
      links: learner
        ? [
            {
              to: '/mi-programa',
              title: 'Mi programa',
              description: 'Rutinas e indicaciones de tu coach.',
            },
            {
              to: '/historial',
              title: 'Mi historial',
              description: 'Sesiones registradas y resultados.',
            },
            {
              to: '/biblioteca',
              title: 'Mis guías',
              description: 'Ejercicios y material que te han compartido.',
            },
          ]
        : [
            {
              to: '/alumnos',
              title: 'Alumnos',
              description: 'Fichas, invitaciones y estado del acceso.',
            },
            {
              to: '/rutinas',
              title: 'Rutinas',
              description: 'Preparar, publicar y asignar entrenamiento.',
            },
            {
              to: '/ejercicios',
              title: 'Ejercicios',
              description: 'Tu biblioteca y material de entrenamiento.',
            },
          ],
    },
    {
      title: 'Acompañamiento',
      links: [
        { to: '/progreso', title: 'Progreso', description: 'Registros, mediciones y evolución.' },
        {
          to: '/agenda',
          title: 'Agenda',
          description: learner
            ? 'Consultar sesiones y tus reservas.'
            : 'Disponibilidad, citas y clases con tus alumnos.',
        },
        {
          to: '/seguimiento',
          title: 'Chat y seguimiento',
          description: 'Conversaciones, hábitos y check-ins privados.',
        },
        {
          to: '/alimentacion',
          title: 'Alimentación',
          description: 'Menús y diario según permisos propios.',
        },
        {
          to: '/recursos',
          title: 'Recursos y PDF',
          description: 'Archivos, guías y documentos compartidos.',
        },
      ],
    },
    ...(owner
      ? [
          {
            title: 'Mi negocio',
            links: [
              {
                to: '/mensualidades',
                title: 'Mensualidades de alumnos',
                description: 'Pago del mes y acceso, decididos por ti.',
              },
              {
                to: '/servicios',
                title: 'Servicios y pagos',
                description: 'Lo que vendes y cobras a tus alumnos.',
              },
              {
                to: '/cuenta',
                title: 'Mi mensualidad',
                description: 'Mes, precio, cupo y acceso definidos por administración.',
              },
              { to: '/plan', title: 'Mi plan', description: 'Funciones, plazas y uso disponible.' },
            ],
          },
        ]
      : learner
        ? [
            {
              title: 'Mis servicios',
              links: [
                {
                  to: '/servicios',
                  title: 'Mis servicios y pagos',
                  description: 'Tus vigencias, cuotas y pagos registrados por el coach.',
                },
              ],
            },
          ]
        : []),
    {
      title: 'Mi espacio',
      links: [
        ...(owner
          ? [
              {
                to: '/marca',
                title: 'Mi marca',
                description: 'Nombre, logo, color y presentación de tu espacio.',
              },
            ]
          : []),
        {
          to: '/instalar',
          title: 'Instalar la app',
          description: 'Acceso desde la pantalla de inicio del teléfono.',
        },
        {
          to: '/mi-perfil',
          title: 'Mi perfil',
          description: 'Tu cuenta, contraseña y preferencias.',
        },
        {
          to: '/informacion',
          title: 'Información y ayuda',
          description: 'Guía rápida, versión y contacto del creador.',
        },
      ],
    },
  ];
}
