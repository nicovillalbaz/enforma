# Auditoría extendida de código — 28-10-2026

## Resultado y alcance real

Revisión estática de autenticación, CSRF, límites y validación de entradas, contexto de estudio, rutas del cliente, descargas, almacenamiento, documentos, caché sin conexión, migraciones y despliegue. Se contrastaron las observaciones con la [auditoría anterior](auditoria-staging-2026-10-26.md) y el [barrido general de hoy](barrido-general-2026-10-28.md). No se leyó contenido personal de alumnos ni se inició un build o un servidor persistente.

El router contiene 50 rutas declaradas y la base 37 migraciones. Al inicializar Fastify sin conectar a una base, OpenAPI enumeró **200 operaciones registradas en 178 paths**; el recuento incluye la ruta WebSocket y rutas creadas en bucles, por eso no es idéntico a las 199 declaraciones de código de la pasada anterior. Hay 122 operaciones de escritura. Dieciocho no declaran un cuerpo JSON en OpenAPI: comprenden acciones sin cuerpo, tres cargas binarias y dos entradas validadas manualmente antes del handler (`workouts/events` y `progress/measurements`). Las rutas parametrizadas publicadas incluyen sus parámetros en OpenAPI.

Se verificaron: `vue-tsc` del cliente, ESLint y Prettier de los tres archivos TypeScript/Vue cambiados; tres suites unitarias dirigidas (8/8 casos) sobre límites de API, configuración de producción y almacenamiento; y `npm audit --omit=dev`, que informó cero avisos en dependencias de producción. El primer comando de Vitest usó una opción no disponible en esta versión; se repitió con la opción compatible y aprobó. La terminal disponible usa Node 20, mientras el proyecto declara Node 24 y la imagen Docker usa Node 24. Estas pruebas locales no sustituyen una prueba del entorno objetivo.

## Defectos corregidos

| Prioridad | Flujo | Evidencia y corrección |
| --- | --- | --- |
| Media | Ficha de alumno pausado o invitado → Alimentación | `StudentDetails.vue` ofrecía el enlace con `studentId`, pero `app.nutrition_manage` exige alumno activo y el GET devuelve 403. La ficha ahora presenta las acciones de asignar rutina y alimentación solo para alumnos activos; en la demostración siguen disponibles. Historial, exportación y gestión de acceso permanecen accesibles. |
| Baja | URL antigua `/alumno/entrenar` con sesión de alumno real | El guard de alumno no admitía esa ruta y la redirigía a `/alumno`. Ahora remite a `/entrenar`, que es el entrenamiento real. El recorrido de demostración conserva su vista. |

| Media | Menú extenso aceptado por HTTP y rechazado por PostgreSQL | La migración `037_nutrition_document_budget.sql` amplía el límite del documento a 100 KB, con margen sobre el máximo de 60 KB de la petición HTTP. Se aplica a la restricción de tabla y a `app.save_nutrition_item`; las migraciones anteriores permanecen intactas. Falta ejecutarla en PostgreSQL 18 y probar un menú cercano al límite. |
| Media | Borrador corporal conservado al cambiar de sesión | La recuperación de formularios usaba `sessionStorage` y no limpiaba las lecturas al cerrar sesión, entrar en demo o cambiar de cuenta. `studio.ts` borra esas claves en cierre, inicio de sesión exitoso, alta, cambio a demo y pérdida de autorización. |

## Controles examinados

- Autenticación: sesión opaca con hash en base, cookie `__Host-` segura en producción, cierre que revoca la sesión, Argon2 para contraseñas y tokens de invitación/restablecimiento de un solo uso. El 401 de `/v1/auth/me` sin sesión es intencional.
- Escrituras: token CSRF firmado, comprobación de `Origin` y límites de frecuencia; en el WebSocket se exige origen explícito y se revalida la sesión y el acceso a la conversación durante su vida.
- Aislamiento: el servidor resuelve usuario y estudio, fija ambos en una transacción y consulta funciones/permisos RLS. Las rutas administrativas de resumen y cambio llaman a funciones SQL que comprueban `app.is_platform_admin()`.
- Archivos y cliente: borradores de antropometría eliminados al cambiar/cerrar sesión; claves de almacenamiento restringidas, rutas privadas resueltas desde la base, descarga de Excel con cadenas como texto XML (no fórmulas), y HTML del PDF con escape, JavaScript deshabilitado y red bloqueada en Chromium. Se inspeccionaron las interpolaciones SQL de la API: las variables observadas son valores enlazados o alternativas literales fijadas por el código.
- Entrega web: `/v1/*` no se almacena en caché, los chunks versionados se sirven como archivos y un chunk ausente responde 404; el router intenta recuperar una actualización. Los controles de formulario tienen base de 16 px para evitar el zoom de foco en iOS.

## Riesgos y deuda técnica encontrados

1. **Contrato de salida incompleto (media):** 199 de 200 operaciones aparecen en OpenAPI con respuesta genérica. El código construye DTO o selecciona columnas para las rutas revisadas, pero no hay un esquema de salida que impida por sí mismo añadir campos sensibles accidentalmente. Antes de ampliar el piloto, tipar primero respuestas de identidad, fichas, exportación, administración y datos corporales, y comprobar que el contrato publicado coincide con el cliente.
2. **Despliegue pendiente (alta para salir a Internet):** no se ejecutaron PostgreSQL 18, incluida la migración 037, Caddy/TLS, SMTP, antivirus, workers, copia/restauración externa ni teléfonos físicos en esta pasada. El repositorio sigue sin primer commit: hace falta una revisión fija y auditable antes de publicar. La [guía de staging](auditoria-staging-2026-10-26.md) detalla la verificación mínima.
3. **Acceso sin conexión (decisión de producto):** el contexto de alumno permanece hasta 24 horas en IndexedDB. Una pausa aplicada por el coach no se puede imponer al dispositivo mientras esté desconectado; al reconectar se revalida. Debe aceptarse explícitamente este intervalo o reducirse antes del piloto con datos reales.
4. **Superficie heredada (producto):** existen rutas y módulos de agenda, chat/seguimiento y comercio aunque se ocultaron de la navegación compacta. No hay evidencia aquí de una fuga por esas rutas; retirarlas o restringirlas requiere una decisión de producto y una migración cuidadosa para conservar historiales.

## Próxima verificación de bajo consumo

En un staging con datos ficticios y una revisión Git fija, hacer **una** pasada: coach activo y alumno activo/pausado/invitado; dos estudios y dos alumnos cruzados; guardar rutina y menú cercano a sus límites; exportar PDF/Excel; cerrar sesión y volver; abrir una pestaña anterior tras publicar una versión nueva; comprobar la instalación en iOS y Android, sin desbordes a 320 y 390 px. Registrar códigos HTTP, tiempos, resultado y captura sin secretos ni mediciones reales. Si alguna comprobación falla, repetir solo el flujo afectado.

Esta auditoría reduce riesgos concretos; no demuestra ausencia absoluta de defectos ni certifica seguridad de una instalación que todavía no existe.



