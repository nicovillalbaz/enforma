# Barrido general de código — 28-10-2026

## Alcance y método

Revisión estática de navegación Vue, estado de sesión y organización, cliente HTTP, permisos Fastify/RLS, exportación, nutrición, migraciones y configuración de despliegue. Se inventariaron 50 rutas del router, 36 migraciones y 211 lugares del cliente con `fetch` o `apiRequest`. El inventario de 199 declaraciones de rutas API y 190 esquemas de la [auditoría previa](auditoria-staging-2026-10-26.md) sigue siendo la referencia; no se repitió la suite de integración ni se levantó el build.

Comprobaciones de bajo consumo efectuadas: `npm run typecheck` aprobado; `npm run lint` aprobado; búsqueda de enlaces estáticos contra el router: dos prefijos dinámicos esperados (`/estudio/` y `/alumnos/`), sin destino literal inexistente. Tras los últimos cambios, `vue-tsc` del cliente y ESLint de los tres archivos tocados aprobaron. No se ejecutaron navegador ni build final.

## Matriz de rutas y estados revisada

| Actor/estado | Entrada y rutas principales | Control visible y de servidor |
| --- | --- | --- |
| Sin sesión | `/acceso`, `/registro`, `/invitar`, `/verificar`, `/abrir/:slug` | Rutas públicas; acciones de mutación exigen origen y CSRF; invitación se valida en servidor. Un 401 de `/v1/auth/me` al no tener sesión es esperado. |
| Coach independiente activo | `/`, `/alumnos`, `/alumnos/:id`, `/rutinas`, `/ejercicios`, `/alimentacion`, `/antropometria`, `/progreso`, `/alumnos/:id/exportar` | El cliente cambia de organización; la API obtiene usuario, organización y rol y usa contexto de transacción/RLS. |
| Alumno activo | `/alumno`, `/mi-programa`, `/entrenar`, `/historial`, `/documentos`, `/alimentacion`, `/progreso` | El guard del cliente restringe rutas; las consultas de servidor comprueban alumno/organización y privacidad. |
| Alumno pausado o estudio suspendido | `/estado` | El guard bloquea otras páginas y `context()` devuelve 403 para datos del estudio. |
| Superadmin | `/admin`, `/admin/cuenta` | Guard de interfaz y funciones de servidor con rol administrativo. |
| Alumno sin conexión con caché válida | `/entrenar`, `/historial`, `/instalar` | La API no se consulta; al volver la conexión debe validarse el acceso. |

## Defectos corregidos

1. **Parámetros de ruta retenidos por una vista anterior.** `App.vue` solo distinguía el ID de organización al montar vistas privadas. `StudentExport.vue` captura `studentId` en `setup`; pasar de `/alumnos/A/exportar` a `/alumnos/B/exportar` podía conservar A. Ahora la clave privada incluye `studentId`. Las vistas públicas se remontan por `fullPath`, porque `InvitationView.vue` captura el token de la URL al montarse y `PwaLaunchView.vue` ejecuta su resolución en `onMounted`. Esto evita conservar el token o el slug anterior al abrir otro enlace dentro de la misma pestaña.
2. **Exportación en blanco para rol coach heredado.** La API de `student-record.ts` permite al personal que puede gestionar el alumno, pero `StudentExportView.vue` solo dibujaba el componente para `owner`, aunque la ficha ofrecía el enlace a `coach`. La vista ahora lo presenta a ambos roles de personal; el control de acceso continúa en la API.
3. **Acciones y textos caducados en el ejemplo.** `WorkspaceView.vue` mostraba frases sobre futuras tandas ya implementadas y botones que solo notificaban una promesa obsoleta. Ahora la demostración enlaza al alta de estudio y se retiró el texto de relleno. La creación real sigue en las vistas conectadas.

## Observaciones que no se deben confundir con un fallo cerrado

- La revisión encontró controles de permisos en servidor y políticas RLS; una inspección estática no demuestra que todas las combinaciones de actores y datos funcionen en una instalación nueva. La [pasada anterior](auditoria-staging-2026-10-26.md) cubrió aislamiento, 36 migraciones y pruebas dirigidas en base local; no se ha repetido hoy.
- El código aún conserva componentes y rutas de funciones secundarias, como agenda, chat/seguimiento y recursos. No están en la navegación principal compacta, pero las rutas siguen disponibles. La limpieza de producto requiere decidir si se mantienen como acceso contextual o se retiran junto con sus APIs y datos; no conviene borrar tablas históricas en este barrido.
- No se ha comprobado la imagen de producción con Docker, PostgreSQL 18, Caddy/HTTPS, correo, copias externas o teléfonos iOS/Android. Por ello el resultado es **código estáticamente revisado**, no certificación de despliegue o ausencia total de errores.
- El repositorio todavía aparece sin primer commit (`git status --short` muestra todos los archivos como no seguidos). Antes de subirlo, crear un snapshot revisado y excluir secretos, bases locales y artefactos temporales.

## Siguiente verificación mínima antes de staging

Una sola pasada con datos ficticios en la instalación final: abrir dos invitaciones distintas en la misma pestaña; alternar dos fichas y dos exportaciones; cambiar de estudio; recorrer coach/alumno/pausado; comprobar PDF/Excel y los permisos de una segunda cuenta; abrir en móvil a 320/390 px y refrescar tras una actualización. Guardar el resultado sin datos personales ni repetir toda la batería local.
