# PLAN MAESTRO DE CONSTRUCCION — SAAS FITNESS & COACHING MARCA BLANCA

**Estado:** propuesta tecnica inicial para revision e implementacion por tandas.  
**Objetivo:** una PWA unica, multiempresa, autohospedada, que permita al coach administrar alumnos, rutinas, videos, alimentacion, chat, ficheros, PDF, progreso y cobros; cada alumno tiene acceso privado.  
**Restricciones:** sin IA, sin SMS/OTP, sin servicios obligatorios de pago por usuario/mensaje/archivo, con infraestructura propia. Pagos al SaaS registrados manualmente al principio.  
**Moneda inicial:** PYG (guaranies enteros). **Zona horaria inicial:** America/Asuncion. **Idiomas de interfaz iniciales:** espanol.

## A. Decisiones no negociables

1. Modelo multiempresa: `organizations`, una empresa puede ser un coach o gimnasio; `organization_id` en toda entidad privada. Una identidad de acceso puede pertenecer a varias organizaciones sin compartir automaticamente sus datos.
2. No un sitio o base de datos PostgreSQL por coach en la primera version. Una BD transaccional aislada por tenant/roles, indices por tenant, tablas de registros historicos y auditoria.
3. Rutinas versionadas e inmutables tras publicacion: cambios nuevos crean versiones; registros realizados se mantienen siempre historicos.
4. Almacenar archivos/videos en almacenamiento privado; en PostgreSQL solamente metadatos, permisos, relaciones y referencias a objetos. Separar subida, procesamiento y publicacion.
5. Chat interno y notificaciones de aplicacion; WhatsApp/Drive no son necesarios para completar el flujo principal.
6. Mobile-first para el alumno; panel de escritorio y movil para el coach; PWA instalable, y offline progresivo.
7. Facturacion SaaS basada en alumno habilitado, no en acciones como abrir la app; intervalos de activacion y periodos auditables.
8. Seguridad desde la primera tanda: contrasenas Argon2id, HTTPS, sesiones revocables, invitaciones privadas, limites de intentos, validaciones por tenant/rol, backups y restauraciones verificadas.
9. Modulos avanzados no justifican microservicios al principio: monolito modular + worker + PostgreSQL + almacenamiento.
10. Los planes de nutricion individualizada y ciertos datos de salud requieren criterios de acceso, consentimiento y responsabilidad profesional; la app no diagnostica ni prescribe por si misma.

## B. Stack de referencia

- Frontend: Vue 3, TypeScript, Vite, PWA, componentes reutilizables; vistas separadas por rol en una misma base de codigo.
- Backend: Node.js, TypeScript, Fastify y Prisma; API REST versionada, WebSocket para chat.
- Persistencia: PostgreSQL 17+; transacciones, migraciones y Row-Level Security planificada/validada. No usar el propietario de tablas como rol de API.
- Procesos: worker propio y pg-boss respaldado en PostgreSQL. No se necesita Redis de entrada.
- Media: almacenamiento privado en volumen o servidor de objetos autohospedado, FFmpeg para conversion/miniaturas, entrega con permisos y urls temporales.
- Documentos: templates HTML/CSS renderizados a PDF en worker mediante Chromium headless.
- Infraestructura: Docker Compose/Easypanel, proxy inverso, certificados TLS gratuitos, variables y secretos fuera del repositorio, metricas/logs, backups fuera del VPS principal.

## C. Tandas de trabajo y criterios de cierre

### ETAPA 0 — CIMIENTOS (tandas 1 y 2)

**Tanda 1 — Repositorio, arquitectura y operacion**
- Monorepo: `apps/web`, `apps/api`, `apps/worker`, `packages/ui`, `packages/shared`, `packages/db`.
- Entornos `local`, `staging`, `production`; Docker Compose y migraciones SQL trazables.
- API base, logs estructurados, manejo de errores, health checks, auditoria y tests base.
- DB PostgreSQL; convenciones tenant, columnas `created_at`, claves UUID, migraciones y seeds reproducibles.
- Seguridad: HTTPS, contrasenas hasheadas, sesiones revocables, rate limiting, politicas de recuperacion seguras.
- Storage abstracto y privado; backups automatizados de BD y media fuera de maquina principal; prueba de restauracion.
- Cierre: se puede desplegar una instancia vacia, crear datos de prueba y restaurarlos, y las suites basicas pasan en CI.

**Tanda 2 — Multiempresa, marca blanca, alumnos y planes SaaS**
- Registro propietario; crear organizacion tipo coach/gym; slug y branding, panel basico.
- Usuarios, memberships por roles, permisos; alumno invitado/activo/pausado/archivado.
- Invitaciones por enlace seguro de un uso; registro y login de alumno sin SMS ni OTP.
- Superadmin: listar organizaciones, cambiar estado y ver alumnos facturables.
- Planes comerciales versionados: Basico/Pro, precios e incluidos; suscripcion organizacion-plan.
- Intervals de alumno facturable, vista de consumo y conteo sin duplicados dentro de la organizacion.
- Cierre: Coach A no puede ver ni alterar alumnos de Coach B, incluso cambiando IDs/URLs; alumnos logran iniciar sesion con la marca correcta; el panel muestra conteo correcto.

### ETAPA 1 — MVP ENTRENAMIENTO (tandas 3 a 7)

**Tanda 3 — Biblioteca de ejercicios, equipos y media**
- Catalogo global + ejercicios privados por organizacion; filtros, grupos musculares, material.
- Alta de ejercicio, descripcion, notas, medios relacionados, favoritos.
- Subida directa y segura de fotografia/video; limites de tamano, formato y cuota; validacion antivirus si se incorporan archivos arbitrarios.
- Worker FFmpeg: miniaturas, conversion, estados pendiente/procesando/listo/fallo; politica de formatos.
- Registrar maquinas especificas del gimnasio y enlazarlas a ejercicios/videos.
- Cierre: coach sube un clip, termina de procesarse y se reproduce desde la ficha de ejercicio con acceso privado.

**Tanda 4 — Constructor y asignacion de rutinas**
- Programas, versiones, semanas, dias, ejercicios, series, repeticiones, descansos, RPE/RIR basico.
- Crear, ordenar, duplicar, guardar plantillas; vista previa; borrador/publicacion.
- Asignar version publicada a alumno, con inicio, estado e historial.
- Cierre: una plantilla se asigna a varios alumnos y una edicion posterior no modifica historicos de una asignacion antigua.

**Tanda 5 — Ejecucion de sesiones de alumno**
- Pantalla de hoy, iniciar entrenamiento, progreso de ejercicios, series individuales.
- Mostrar ultima carga y repeticiones, modificar valor, finalizar serie; timer y pausa.
- Notas por ejercicio, finalizacion, control de acceso y resumen de sesion.
- Guardado automatico local/servidor; `client_event_id` para evitar duplicados.
- Cierre: alumno completa una rutina en movil, la reabre y ve sus series exactamente como las registro.

**Tanda 6 — Historial, estadisticas y dashboard coach**
- Progreso por ejercicio, volumen registrado, asistencia/cumplimiento, comparativa temporal.
- Mediciones y graficos iniciales, ficha 360, alertas simples por inactividad.
- Consultas y indices para miles de series sin consultas N+1.
- Cierre: una sesion completada actualiza los informes del alumno y la vista del coach sin editar a mano.

**Tanda 7 — PWA pulida, administracion comercial y piloto**
- Instalacion PWA, icono/marca por organizacion, navegacion de cinco tabs del alumno.
- Buenas prestaciones en movil, imagenes lazy-loading, almacenamiento cacheado de recursos esenciales.
- Cierre del periodo SaaS, calculo de cargos por alumno-dia (o criterio comercial validado), estado de cuenta, pago manual confirmado.
- Suite E2E que cubra onboarding, rutina, sesion, historial, billing y aislamiento de tenant.
- Piloto con coaches reales; recoger fallos de uso, no desarrollar funciones nuevas indiscriminadamente.
- Cierre: 1 coach puede captar, entrenar y cobrar/ser cobrado desde el sistema sin hojas de calculo.

### ETAPA 2 — SUPERAPP (tandas 8 a 10)

**Tanda 8 — Biblioteca de archivos y documentos PDF**
- Carpetas, comparticion por alumno, control de permisos, version de archivos.
- PDF de rutinas, progreso y ficha de ejercicio con logo; generacion via worker y almacenamiento.
- Compartir en portal y descargar con autorizacion; limites de almacenamiento por plan.
- Cierre: coach genera y comparte un PDF que el alumno abre en su portal sin Drive.

**Tanda 9 — Alimentacion y diario**
- Catalogo de alimentos, nutricion por 100g, recetas e ingredientes; trazabilidad de fuente.
- Plan de menús por dia y comida, asignacion y lista de compras.
- Diario de comidas con foto, cantidades y notas; comparacion plan vs registro.
- Versionado de planes publicados, permisos de nutricionista, guardas para datos sensibles.
- Cierre: profesional crea menu semanal, alumno lo consulta/registra y ve un resumen.

**Tanda 10 — Chat, archivos conversacionales, check-ins y habitos**
- Conversaciones privadas, participantes, WebSocket y busqueda simple.
- Adjuntos reutilizando media_assets; leido/no leido; notificaciones internas.
- Formularios versionados y check-ins periodicos; registro sencillo de habitos.
- Cierre: alumno pregunta por un ejercicio en chat, adjunta un video y recibe respuesta; coach ve el check-in semanal.

### ETAPA 3 — NEGOCIO Y AUTOMATIZACION (tandas 11 y 12)

**Tanda 11 — Agenda, clases y reglas automaticas**
- Calendarios, slots, citas, clases, reservas/cancelaciones, asistencia.
- Automatizaciones base: eventos en PostgreSQL/outbox + worker para recordatorios y avisos internos.
- Preferencias de notificacion y limites antispam; trazabilidad de ejecucion.
- Cierre: reservas y recordatorios funcionan internamente sin n8n ni servicios de mensajeria externos.

**Tanda 12 — Servicios y cobros propios del coach**
- Catalogo de servicios, membresias, paquetes, fecha de vencimiento y cobro manual.
- Separar facturas/cobros del entrenador a sus alumnos de las facturas SaaS al entrenador.
- CRM comercial basico, indicadores de altas/bajas, renovaciones y deudas.
- Cierre: coach vende y administra 2 o mas tipos de programa y controla pagos dentro de su panel.

### ETAPA 4 — GIMNASIOS Y ESCALA (tandas 13 y 14)

**Tanda 13 — Gimnasios multisede y varios profesionales**
- Staff, roles, asignacion alumno-profesional, permisos granulares y departamentos.
- Sedes, calendarios, equipos, bibliotecas compartidas, alumnos sin cobro duplicado.
- Cierre: dos coaches atienden un alumno del mismo gimnasio sin duplicarlo y sin acceder a otros alumnos fuera de sus permisos.

**Tanda 14 — Rendimiento, seguridad avanzada y lanzamiento**
- Offline robusto para registros, resolucion de conflictos y sincronizacion; PWA segun navegador.
- Indices/migraciones revisados, colas, limites, observabilidad y pruebas de carga.
- Analisis de acceso indebido por ID/tenant, autorizacion de archivos, sesiones y casos de privacidad.
- Restauracion real desde backup de BD y medios, procedimientos de incidente, retencion/exportacion.
- Cierre: pruebas funcionales, aislamiento, recuperacion y carga aceptadas; manual de operacion y soporte listo.

## D. Orden de producto (MVP real vs fase completa)

**MVP cobrable:** cuenta coach + marca + alumno + biblioteca ejercicios/videos + constructor rutinas + registro series + progreso + pantalla alumno + registro de alumnos facturables + estado de cuenta manual. Chat/archivos/PDF/nutricion son ampliaciones importantes, no bloqueantes del primer piloto.

**Experiencia completa:** incorpora todas las funciones de etapa 2 y 3; negocios multi-coach en etapa 4. Una plataforma funcional sencilla es preferible a 40 pantallas inconclusas.

## E. Modelo de datos, entidades y relaciones

### E.1. Cuenta/organizacion
- `app_users`: identidad global y hash de contrasena.
- `organizations`: coach o gimnasio, `owner_user_id`, `slug`, idioma, moneda, zona, estado.
- `organization_branding`: logo, colores y preferencias visuales.
- `organization_memberships`: enlace persona–organizacion con rol, estado.
- `students`: perfil del alumno dentro de la organizacion; `user_id` opcional hasta aceptar invitacion; estado de acceso.
- `student_professionals`: asignacion del alumno a entrenadores/nutricionistas de su organizacion.
- `auth_sessions`: sesiones revocables.
- `invitation_links`: invitacion privada con token hasheado y caducidad.

### E.2. Ejercicios, programas y sesiones
- `media_assets`: clave privada del archivo, tipo, tamano, conversion y thumbnail.
- `equipment`: maquinas/material concreto por organizacion.
- `exercises`: global cuando `organization_id IS NULL`, o privado de una organizacion.
- `exercise_media` / `exercise_equipment`: relaciones de ejercicios con multimedia y material.
- `workout_programs`: plantilla de programa.
- `workout_program_versions`: version publicada e inmutable.
- `workout_weeks`: semanas de cada version.
- `workout_days`: entrenamientos de cada semana.
- `workout_exercises`: orden de ejercicios dentro de un dia.
- `workout_prescribed_sets`: objetivo de cada serie.
- `workout_assignments`: alumno + version concreta + calendario/estado.
- `workout_sessions`: ejecucion real con fechas y estado.
- `performed_exercises`: ejercicios realizados por sesion.
- `performed_sets`: series reales, peso, repeticiones, esfuerzo.

### E.3. Seguimiento, nutricion y comunicacion
- `student_measurements`, `student_progress_photos`.
- `food_catalog`, `recipes`, `recipe_ingredients`, `meal_plans`, `planned_meals`, `meal_assignments`, `food_diary_entries`, `food_diary_items`.
- `conversations`, `conversation_participants`, `chat_messages`, `chat_attachments`, `notifications`.
- `file_folders`, `file_entries`, `generated_documents`.
- Tablas futuras: `meal_plan_versions`, `planned_meal_items`, `checkin_templates`, `checkin_submissions`, `habits`, `habit_logs`, `appointments`, `classes`, `class_bookings`, `student_services`, `student_payments`.

### E.4. Modelo economico (SaaS -> coach)
- `saas_plans`: identidad comercial Basico/Pro/Studio.
- `saas_plan_versions`: tarifa congelada versionada, alumnos incluidos y limites de funciones.
- `saas_subscriptions`: que version de plan esta contratada por cada organizacion.
- `student_billable_intervals`: periodos en los que cada alumno tiene acceso habilitado y cuenta para facturar.
- `saas_billing_periods`: periodos mensuales por suscripcion.
- `saas_student_usage`: alumnos y dias de uso que contribuyeron a cada calculo.
- `saas_invoices`: estado de cuenta comercial al coach (sin confundir con factura fiscal oficial).
- `saas_invoice_lines`: lineas de importe y descripcion.
- `saas_payments`: registros de transferencias/efectivo, con confirmacion manual.

**Regla recomendada**: facturacion mensual vencida. Precio por alumno activo, prorrateado por dias de habilitacion para evitar disputas en altas y pausas a mitad de mes. Ejemplo: 15 dias habilitado de 30, tarifa G. 10.000/mes -> G. 5.000. El cálculo y las reglas de redondeo deben definirse por plan y congelarse en la factura. Los alumnos invitados que nunca tuvieron acceso no se facturan; un alumno con dos profesionales del mismo gimnasio se factura una sola vez.

**Prevencion de fraude/errores**: nunca depender de que el alumno inicie sesion para considerar su plaza habilitada; cambios de estado deben crear/cerrar intervalos en transacciones; cada periodo conserva su detalle historico aunque el alumno cambie de estado posteriormente.

### E.5. Relaciones cardinales (resumen)

```
app_users 1---N organization_memberships N---1 organizations
organizations 1---N students
app_users 1---N students (opcional: mismo usuario en varias organizaciones)
organizations 1---N workout_programs 1---N workout_program_versions
workout_program_versions 1---N workout_weeks 1---N workout_days
workout_days 1---N workout_exercises 1---N workout_prescribed_sets
students 1---N workout_assignments N---1 workout_program_versions
students 1---N workout_sessions 1---N performed_exercises 1---N performed_sets
exercises 1---N workout_exercises
organizations 1---N media_assets
organizations 1---N saas_subscriptions N---1 saas_plan_versions
students 1---N student_billable_intervals
saas_billing_periods 1---N saas_student_usage
saas_billing_periods 1---1 saas_invoices 1---N saas_invoice_lines
saas_invoices 1---N saas_payments
```

## F. Reglas tecnicas de base de datos

1. Todos los recursos privados: `organization_id NOT NULL` e indices que empiecen por `organization_id` en consultas frecuentes.
2. Toda peticion usa contexto de organizacion validado a partir de sesion y membership, **nunca** confia solo en un tenant enviado por el frontend.
3. Usar claves compuestas `FOREIGN KEY (organization_id, recurso_id)` para impedir asociaciones cross-tenant cuando es posible.
4. Aplicar Row-Level Security a recursos con tenant como defensa adicional, con rol SQL no propietario y pruebas de su comportamiento; superadmin usa consultas privilegiadas deliberadas/auditadas.
5. La excepcion `organization_id NULL` solo se permite en catalogos globales y activos publicados centralmente, nunca en fichas privadas.
6. Rutinas publicadas no se editan in-place; crear nueva version o clon. Ejecuciones no se recalculan destructivamente al cambiar el plan.
7. No guardar datos financieros monetarios con float: `BIGINT` en Gs, `NUMERIC` para cantidades/pesos y prorrateos.
8. Almacenar tiempos en UTC (TIMESTAMPTZ) y efectuar cortes de facturacion usando America/Asuncion de la organizacion.
9. Soft delete/logs/retencion de datos segun tipo; evitar cascadas accidentales de informacion personal.
10. Para sincronizacion offline, cada evento del cliente tiene UUID idempotente; crear o actualizar debe ser reintentable.
11. `JSONB` para configuracion flexible y metadatos no criticos; tablas tipadas para entrenamientos, series, asignaciones y cobros.
12. Nunca mezclar facturacion del SaaS (nuestro ingreso) con cobros del coach a alumnos (ingreso del coach).

## G. Estructura sugerida del repositorio

```
coaching-platform/
  apps/
    web/                   # Vue: coach + alumno + superadmin
    api/                   # Fastify: rutas, servicios, auth, ACL
    worker/                # transcodificacion, informes, cron, notificaciones
  packages/
    ui/                    # componentes comunes
    db/                    # Prisma/schema/migrations/seeds
    shared/                # tipos, validaciones, eventos
  docs/
    architecture/
    adr/                   # decisiones tecnicas
    api/
    runbooks/
  infra/
    compose/
    nginx/
    backups/
  tests/
    e2e/
    authorization/
    load/
```

Modulos backend propuestos: `auth`, `organizations`, `memberships`, `branding`, `students`, `exercises`, `equipment`, `media`, `training-programs`, `training-sessions`, `progress`, `nutrition`, `messaging`, `documents`, `notifications`, `scheduler`, `saas-billing`, `coach-billing`, `analytics`, `audit`.

## H. Flujo de desarrollo y control de calidad

Para cada tanda se requieren: (1) esquema/migracion, (2) backend + autorizacion, (3) interfaz coach, (4) interfaz alumno si aplica, (5) tests unitarios/e2e, (6) pruebas cross-tenant, (7) documentacion y despliegue en staging, (8) acta de cierre con demostracion.

Estados de tickets: `Backlog -> Preparado -> En desarrollo -> PR -> QA -> Aprobado -> Desplegado`.

Convenciones: PR pequeno, migrations hacia adelante, feature flags, code review, tests de contrato, sesiones historicas inmutables, fallback ante fallo de worker, logs sin datos sensibles, archivos con validacion de MIME y tamano.

## I. Indicadores de aceptacion y escalado

- Los registros de series se guardan inmediatamente en interfaz y llegan una sola vez al servidor tras reconectar.
- Pruebas de autorizacion: coach A y alumno A no pueden consultar recursos de coach B, por ID, enlace directo, API o archivo.
- Un programa antiguo sigue mostrando exactamente lo asignado aunque la plantilla actual se edite.
- El importe de facturacion reproduce la suma de lineas historicas y puede ser auditado meses despues.
- Medios: videos procesados en worker, con estados visibles, sin bloquear las solicitudes de API.
- Baseline de velocidad en movil y carga con diferentes niveles de simultaneidad; ajustar objetivos medibles en staging antes del piloto.
- Backups fuera del mismo servidor + restauracion probada, no solo archivos de backup existentes.
- Sin cargos invisibles por alumno: quotas de almacenamiento/video por plan, reportes de consumo, y limites configurables.

## J. Decisiones por validar antes de codificar determinadas tandas

- Publico principal del primer piloto: coach independiente vs gimnasio.
- Nombre del producto y dominio central.
- Planes: alumnos incluidos, minimo mensual, dias de prueba, y prorrateo o facturacion por ciclo.
- Reglas de pausa de alumno y derechos de acceso historico.
- Almacenamiento inicial: volumen privado de VPS o object storage autohospedado.
- Limite de video por archivo, duracion y almacenamiento/transferencia por plan.
- Politica de soporte y recuperación de cuentas sin OTP.
- Politica de archivos sensibles y autorizacion de datos de salud/fotos.

**Artefacto complementario:** `esquema_inicial_coaching.sql` contiene una base ilustrativa PostgreSQL para 52 tablas del nucleo; no ejecutar en produccion sin cerrar las reglas de seguridad y completar migraciones.
