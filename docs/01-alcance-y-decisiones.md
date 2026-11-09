# 01. Alcance, principios y decisiones técnicas

## Producto y usuarios

**Cliente inicial:** entrenador independiente de Paraguay con 10–50 alumnos. **Usuarios:** propietario del SaaS, coach propietario, alumno. **Alcance aprobado:** coaches independientes, un coach responsable por espacio y sus alumnos. Gimnasios, sedes y equipos multicoach fuera del alcance actual, sin compromiso de ampliación. Un usuario podrá participar en varias organizaciones, pero sus datos privados siempre pertenecen a una organización concreta.

La propuesta incluye la relación completa coach–alumno dentro del producto: programas, sesiones, progreso, vídeos propios de ejercicios y máquinas, menús, diario alimentario, chat, archivos y PDF. La amplitud es el destino del producto; la primera venta se basa en el entrenamiento (T01–T07). Los módulos se podrán activar por organización y por plan sin multiplicar aplicaciones.

## Decisiones cerradas

| Área | Decisión | Motivo / límite |
|---|---|---|
| Distribución | Web responsive + PWA por dominio de marca | Una base de código para iPhone, Android y escritorio. La publicación nativa por coach queda fuera del alcance inicial. |
| Interfaz | Vue 3 + TypeScript + Vite + Vue Router + Pinia; CSS con tokens y componentes propios | Continuidad con el plan original, control fino de tamaño y adaptación móvil. |
| API | Node.js LTS + TypeScript + Fastify; REST JSON `/v1`, esquema OpenAPI generado | Contratos claros entre web y servidor y validación de entrada/salida. |
| Datos | PostgreSQL, SQL de migraciones versionadas y consultas tipadas con Kysely | El SQL es la fuente de verdad; facilita claves compuestas, restricciones y RLS sin depender de una traducción automática del ORM. |
| Tareas | Worker Node separado; tabla de trabajos/outbox en PostgreSQL | Evita Redis y cobra cero por mensaje; reintentos, bloqueo y DLQ se implementan explícitamente. |
| Archivos | Volumen privado en el VPS, interfaz de almacenamiento preparada para migrar a S3 compatible | Coste inicial simple; réplica/backup externo obligatorios. |
| Vídeos | FFmpeg en worker; MP4/H.264 como formato inicial, póster y tamaños limitados | Un clip breve reemplaza GIF pesado para reproducción corriente. El original se retiene según política. |
| PDF | Plantillas HTML/CSS con Chromium en worker | Misma marca y tipografía; cola y cupos para no bloquear la API. |
| Chat | Persistencia PostgreSQL + WebSocket; sondeo como respaldo | Los mensajes se guardan antes de notificarse; no depender solo de la conexión en vivo. |
| Autenticación | Email + contraseña Argon2id, invitación de un uso, sesión opaca en cookie HttpOnly | Sin OTP ni SMS. Recuperación por enlace de correo; se necesita correo transaccional para invitaciones y recuperación. |
| Infraestructura | Un VPS con Compose, proxy TLS, web, API, worker y DB; respaldo cifrado fuera del VPS | Bajo coste fijo; separar servicios cuando métricas lo justifiquen. |
| IA | Fuera del plan | Exclusión expresa del usuario. |
| Cobros | Dinero fuera de la app; coach marca pagos de alumnos y operador registra pago del coach/decide acceso manualmente | Sin pasarela o cobro automático en el alcance actual. Control mensual implementado localmente (v0.14.2/023), precio/cupo/acceso en admin y acceso de alumnos por coach; [decisión y pasos](piloto/04-pendientes-y-control-manual.md). |

**Nota de costes:** el correo transaccional y el respaldo remoto son dependencias operativas. Se priorizan SMTP y almacenamiento de tarifa fija o autohospedados, pero no se promete coste cero. El dominio y el VPS también se pagan. Antes del piloto se presupuestan con datos reales.

## Alcance por versión

- **Piloto cobrable (T01–T07):** coach y alumno con marca propia; invitación, acceso, biblioteca y clips, constructor versionado, registro de series, historial, métricas básicas y estado de cuenta SaaS manual.
- **Superapp de relación (T08–T10):** nube privada, PDF, planes y diario de comida, mensajes, hábitos y check-ins.
- **Operación del coach (T11–T12):** agenda, automatizaciones internas, servicios y cobros que el coach registra.
- **Consolidación y piloto independiente (T13–T14):** simplificación de flujos, inicio guiado real, firma NAVZ, estabilidad, seguridad, recuperación y piloto pequeño. No incluye gimnasios o equipos.

No se incluyen en estas 14 tandas: IA, OTP/SMS, videollamadas, sincronización con wearables, cobro automático, publicación de cientos de apps nativas, marketplace, comunidad pública ni recomendaciones clínicas automáticas. Permanecen como ideas de evaluación posterior, no tareas comprometidas.

## Decisiones de producto para validar sin bloquear T01

Nombre y dominio, precio final de Básico/Pro, cuota mínima, días de prueba, límites de medios, política de pausa y exportación se validan comercialmente antes de cerrar T07. Para construir se usarán parámetros de plan versionados, nunca importes incrustados en código. Se adopta como regla propuesta el prorrateo por días calendario habilitados; ver [facturación](05-negocio-y-facturacion.md).

## Criterio de elección del stack

Se mantuvo Vue/Fastify/PostgreSQL del material previo para conservar continuidad. Se sustituyó Prisma por SQL + Kysely en el plan de ejecución porque las restricciones entre organizaciones y RLS necesitan migraciones SQL revisables. El equipo debe fijar versiones exactas y lockfile en T01, comprobar compatibilidad y registrar cualquier cambio como ADR; no cambiar de stack por preferencias personales durante una tanda.

## Decisión de alcance T13

V0.13.0 incorpora alta exclusiva coach y consolida la experiencia individual. La plataforma mantiene múltiples negocios aislados; no comparte alumnos entre coaches. El esquema previo conserva compatibilidad sin prometer producto de gimnasio. [ADR 013](decisiones/013-coaches-independientes.md), [T13](tandas/13-gimnasios.md), [T14 reorientada](tandas/14-escala-lanzamiento.md).
