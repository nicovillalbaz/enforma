# API T13 — Alcance independiente e inicio

**v0.13.0 / migración 022.** No añade tablas, workers, cobros o permisos compartidos.

## Altas

POST /v1/auth/register-coach y POST /v1/organizations conservan contrato anterior, pero kind solo admite coach. Gym se rechaza con 400 antes de crear organización/usuario. La función app.create_organization valida lo mismo y devuelve INDEPENDENT_COACH_ONLY ante otro kind; su constructor anterior es interno y sin EXECUTE para forma_api. No se modifican tenants existentes.

## GET /v1/organizations/:organizationId/coach-start

Sesión y organización activa, **solo owner**. Respuesta privada no-store; lectura sin CSRF. Contexto actor/tenant comprobado antes de consulta y de nuevo en función SQL. Alumno/staff 403, organización inaccesible 404 y sin sesión 401.

```json
{
  "timezone":"America/Asuncion","today":"2026-10-22",
  "brandReady":true,"emailVerified":true,
  "activeStudents":1,"invitedStudents":0,"publishedPrograms":1,
  "currentAssignments":1,"upcomingSessions":0
}
```

- Marca: nombre/color guardados, logo opcional. Correo: estado real del actor.
- Alumnos: total del estudio por estado, sin paginación ni contactos devueltos.
- Publicados: programas distintos con versión publicada y programa sin archivar.
- Asignaciones: state active, alumno activo y endsOn desde hoy; incluye periodos próximos y excluye canceladas/terminadas.
- Sesiones: propias del coach, publicadas/no canceladas, inicio entre ahora y siete días.

Sin nombres de alumnos, emails, respuestas, notas ni cuerpos privados. UI calcula cinco pasos desde estos datos, sin marcar avances manuales o persistir flags. Se solicita al montar/actualizar o volver a pestaña visible; no polling.

## Rutas UI

/mas agrupa enlaces según rol, conservando guardas de cada destino. /informacion es pública, sin API nueva para datos personales; firma NAVZ/versionado son constantes de producto. Teléfono solo como enlace tel activado por usuario. Una ruta visible no concede acceso a una API de otro rol.

[Manual](t13-uso-y-operacion.md), [decisión](../decisiones/013-coaches-independientes.md), [plan](../tandas/13-gimnasios.md).
