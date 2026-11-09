# Barrido específico de alumno y administración — 29-10-2026

## Alcance

Se contrastaron las rutas y guardas de Vue, las entradas visibles de alumno y administrador, las llamadas del panel mensual y las comprobaciones SQL correspondientes. Este barrido es estático y dirigido: no se levantó la aplicación ni se repitió la batería de navegador. La pasada anterior sí recorrió coach y alumno con cuentas ficticias en navegador local; no recorrió de extremo a extremo el panel admin. Por ello no equivale a una auditoría funcional completa de ambos actores.

## Resultado por vista

| Vista | Revisado | Resultado |
| --- | --- | --- |
| Alumno | Acceso activo/pausado, rutas de inicio, programa, entrenamiento, historial, alimentación, progreso, antropometría y documentos; selección del alumno propio en progreso y antropometría. | El guard limita rutas y envía cuentas pausadas a `/estado`. Las vistas examinadas usan el contexto del estudio y la API aplica permisos propios. En `Mis documentos` se corrigió la vuelta fija a historial: ahora usa el destino anterior y, si no existe, vuelve a `/alumno`. |
| Admin | Acceso de superadmin a `/admin`, listado mensual, cupos, acceso y marca manual de pago; funciones `app.is_platform_admin`, `app.monthly_info`, `app.manual_configure` y `app.monthly_mark`. | El control de servidor no depende del guard visual. Se retiró el enlace `Ver historial` que abría la facturación heredada; `/admin/cuenta` redirige al panel mensual. El mes se consulta con el selector del panel. |

## Comprobación adicional de rutas, datos y estados

- **Alumno:** el guard deja entrar a un alumno activo en inicio, perfil, programa, entrenamiento, historial, documentos, alimentación, progreso, antropometría, biblioteca e instalación. Para progreso y antropometría, la vista toma el ID del perfil propio, no el `studentId` de la URL. La API `portal/profile` exige rol alumno y actualiza la fila vinculada a su usuario. `context()` bloquea la organización suspendida y el alumno pausado o archivado antes de ejecutar los handlers revisados.
- **Admin:** `/admin` exige `isSuperadmin` en el router; `monthly-coaches` comprueba `app.is_platform_admin()` en SQL, y las escrituras de cupo, acceso y pago vuelven a comprobar el permiso dentro de sus funciones SQL. La demo ya no puede abrir `/admin` para caer en un 401 de la API; se redirige al inicio de la demo.
- **Consistencia de mes:** `ManualAdmin.vue` ahora vacía las filas anteriores al consultar un mes y no presenta «No hay coaches» junto con un error de red. El servidor recibe mes, revisión e ID de intención; rechaza marcas de otro actor, conflictos de revisión e intentos de repetir una intención con contenido distinto.
- **Cobertura existente sin reejecución:** `tests/integration/manual-monthly.test.ts` contiene casos de permiso admin, cupo, idempotencia, aislamiento entre estudios, alumno suspendido y separación entre marca de pago y acceso. `tests/integration/organizations.test.ts` cubre invitación y portal del alumno. Estos casos documentan intención y regresiones anteriores, pero no acreditan el VPS nuevo.

## Límites y siguiente comprobación

- Las APIs y tablas históricas de facturación siguen presentes, aunque la pantalla administrativa antigua ya no está enlazada. Antes de retirarlas hay que revisar si existen registros que conservar.
- Agenda, seguimiento, recursos y servicios no forman parte de la navegación principal compacta, pero algunas URLs y APIs heredadas siguen disponibles. Su cierre exige inventariar enlaces contextuales y conservar historiales; no se declara terminada esa limpieza.
- El selector de mes muestra el estado de cada mes; no muestra todavía una cronología detallada de quién cambió cada marca. El servidor conserva eventos de control manual.
- Falta una pasada funcional del panel admin en staging con datos ficticios: cambiar cupo, suspender/reactivar coach, marcar y desmarcar un mes, comprobar que un usuario normal recibe 403 y que el estado del alumno cambia según lo esperado.
- Falta aceptar en móviles reales la vuelta desde documentos, la instalación, el teclado y los anchos de 320/390 px. Repetir solo los flujos que fallen.

Verificación de bajo consumo de los archivos modificados: `vue-tsc`, ESLint y Prettier aprobados. No se ejecutó build ni base de datos.
