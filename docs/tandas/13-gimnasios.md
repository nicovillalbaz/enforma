# T13 — Consolidación para coaches independientes

**Alcance aprobado por el usuario:** coaches independientes, un coach responsable por espacio y sus alumnos. La plataforma aloja múltiples coaches con datos aislados. Gimnasios, sedes, recepción y equipos compartidos quedan fuera de estas tandas; no son dependencias del lanzamiento.

El nombre de este archivo se conserva para mantener los enlaces anteriores. Su contenido sustituye el antiguo plan multicoach. **Base recibida:** v0.12.0, 001–021; próxima 022. [T12](12-negocio-coach.md), [avances](../avances.md).

## Objetivo

Terminar una experiencia coherente para el coach individual, facilitar sus primeros pasos y completar la firma NAVZ antes de preparar el piloto. Mantener Vue/Fastify/PostgreSQL y módulos existentes, sin nuevos servicios.

## Pasos y aceptación por tarea

| Tarea | Paso a paso | Aceptación |
|---|---|---|
| T13-01 Alcance | Actualizar visión/hoja de ruta/catálogo/T14; retirar alta de gimnasio de UI/API y proteger creación en DB. Conservar datos históricos y aislamiento entre coaches. | Registro solo coach; solicitud gym rechazada; otro coach no lee datos propios |
| T13-02 Inicio útil | Sustituir bienvenida estática del owner por estado real: marca, correo, primer alumno activo, rutina publicada y asignación vigente/próxima. Mostrar contadores completos y accesos a tareas. | Estado calculado en servidor, sin casillas ficticias, sin sondeo continuo ni carga de listas privadas |
| T13-03 Navegación | Agrupar Más opciones por uso y rol, mantener cinco destinos inferiores. Ocultar selector de estudio/profesional cuando solo existe una opción, conservar contexto legible. | Coach/alumno encuentran módulos en móvil/PC sin controles vacíos ni acciones ajenas |
| T13-04 Ayuda y firma | Crear Información con versión, guía por rol, límites offline y contacto del creador. Integrar firma compartida en footer/acceso/registro y enlaces a Información. | Creado por NAVZ, +595972995557 legible; tel solo por acción del usuario; no tapa navegación |
| T13-05 Correcciones | Revisar los flujos afectados, estados vacíos, textos, carga/error y avance de primer uso. Registrar pendientes físicos/externos para T14 sin añadir módulos nuevos. | Formularios 16 px, acciones 44 px, reflujo 320–1440, temas claro/oscuro y zoom accesible conservado |
| T13-06 Evidencia | Casos puntuales del nuevo alcance/estado/permisos, un recorrido Chromium compartido de los cambios, build/lint y enlaces. Documentar resultados y actualizar guías/avances. | Sin suites históricas, pruebas masivas, PDF, Docker o restores repetidos |

## Orden de trabajo

1. Cerrar contratos de alcance y registrar decisión; no eliminar tablas/roles históricos para simplificar la UI.
2. Implementar 022 con guard de altas y lectura de resumen limitada al owner. No añadir tablas, cobros o permisos clínicos.
3. Conectar inicio, navegación y simplificación de selectores a datos reales; evitar prometer preparación para producción por completar la guía.
4. Implementar [firma NAVZ](../pendientes/firma-navz.md) y ayuda accesible a coach/alumno, incluso desde acceso público.
5. Verificar únicamente lo nuevo o corregido y registrar acta de T13. Mantener puertas de T07–T12, los 81 indicadores previstos y próxima migración real.
6. Entregar continuidad a [T14](14-escala-lanzamiento.md), enfocada en piloto de coaches individuales.

## Qué no entra

Sin sedes, invitación/reasignación de staff, recepción, gimnasio multicoach, comunidad, nuevas automatizaciones, cobro automático ni ampliación offline a todos los formularios. El esquema heredado mantiene compatibilidad interna; no constituye una oferta de esos productos. Ver [aplazamiento](../pendientes/gimnasios-futuro.md).

## Estado

**Implementada en local — v0.13.0, 022 aplicada; próxima 023.** T13-01 a T13-06 entregadas: [manual](../runbooks/t13-uso-y-operacion.md), [API](../runbooks/api-t13.md), [ADR](../decisiones/013-coaches-independientes.md), [acta](../evidencias/t13.md). Cuatro casos nuevos con evidencia aprobada, tipos/build/lint y una revisión visual de 15,3 s, sin suites históricas. Teléfonos, despliegue/HTTPS, recuperación y piloto conservan sus puertas abiertas para T14.
