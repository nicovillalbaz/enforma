# T16 — Primer corte de interfaz y navegación

**24-10-2026 · Alcance:** código local, sin migración. Corresponde a partes de T16-01, T16-02, T16-03 y T16-04 del [plan](../tandas/16-ficha-alumno-y-experiencia.md). No cierra esas cuatro etapas completas ni acredita aceptación visual.

## Entregado

1. Acceso reducido a un solo panel legible, sin hero promocional. La firma NAVZ queda bajo el formulario, separada por pie; se conserva el enlace a Información. Mensualidad usa campo y botón de 44 px alineados en escritorio/apilados en móvil, con copia repetitiva retirada.
2. Perfil por rol: coach ve nombre, correo, estudio y estado de acceso; enlaces a marca, mensualidad, restablecimiento de contraseña, instalación, Información y cierre de sesión. El alumno conserva edición de nombre/objetivo y obtiene accesos de cuenta.
3. Navegación principal coach: Inicio, Alumnos, Rutinas, Ejercicios, Dieta; alumno: Hoy, Entrenar, Comidas, Historial. Avatar directo a perfil. `/mas` redirige a perfil por compatibilidad de enlaces antiguos; chat, recursos y agenda ya no aparecen en navegación principal ni inicio del coach.
4. Inicio del coach reducido a una acción pendiente, cifras y cuatro destinos funcionales. Inicio del alumno sin hero grande, con acciones directas.
5. Ficha de alumno: acciones de rutina/asignación, alimentación, mediciones/progreso e historial; edición, invitación y acceso quedan en secciones desplegables. Los destinos llevan `studentId` y retorno limitado a la ficha. Rutinas preselecciona al alumno activo al entrar desde su ficha; Alimentación arranca con ese alumno seleccionado. Historial y Progreso muestran «Volver a la ficha». El servidor conserva sus permisos existentes.

## Comprobación de bajo consumo

- `npx vue-tsc --noEmit -p apps/web/tsconfig.json`: **aprobado** tras el último ajuste del inicio del coach. Las pasadas dirigidas previas también terminaron sin errores; no se ejecutaron suites históricas.
- `prettier --write` solo en archivos tocados. No se ejecutaron tests de DB, suites e2e, build ni navegador nuevo.
- Revisión estática: no quedan `/mas`, `/agenda`, `/seguimiento` ni `/recursos` en la navegación principal, inicio coach, ficha o perfil modificados. Las rutas/ACL antiguas continúan existentes para no perder documentos o registros.

## Pendientes concretos

- Revisar visualmente 320/390/desktop y teclado, pie/scroll/safe areas en teléfonos reales. La captura previa del usuario sigue siendo la referencia de rechazo; este corte no demuestra aún que el nuevo aspecto le agrade.
- Ficha central con resumen de asignaciones vigentes, editor y vista previa dentro del contexto del alumno; hoy reutiliza pantallas existentes y preselección. Volver desde pasos internos de rutina/alimentación requiere recorrido manual.
- Quitar selección de profesional alimentario con cambio seguro de permisos; catálogo visual con auditoría de licencia; períodos día/semana/mes; correcciones de mediciones; exportación PDF por rango y XLSX. No se declara resuelto ningún punto de T16-05 a T16-10.
- El perfil usa restablecimiento de contraseña existente; edición directa de datos del coach y preferencias aún no existe.

**Estado de piloto:** sin cambio. Datos reales, derechos de medios, recuperación, aislamiento nuevo y aceptación física siguen abiertos en [puertas](../piloto/00-puertas.md).
