# T01 — Cimientos, seguridad y operación

**Objetivo:** base reproducible y recuperable para construir sin deuda de permisos. **Entrada:** entrevistas/prototipo iniciados, decisiones de `01-alcance` revisadas. **Salida:** despliegue vacío en staging, prueba de login técnico y restauración verificada. No crear las 52 tablas todavía.

## Pasos en orden

1. **T01-01 Repositorio.** Crear monorepo `apps/web`, `apps/api`, `apps/worker`, `packages/ui`, `packages/shared`, `packages/db`, `infra`, `tests`, `docs`; gestor de paquetes y lockfile; TypeScript estricto, lint y formato. Definir ramas, PR y variables de entorno sin secretos reales.
2. **T01-02 Entornos.** Compose para web/API/worker/PostgreSQL/proxy en local y staging; health/readiness; HTTPS, dominio temporal y migraciones automáticas controladas. Documentar arranque desde cero y actualización.
3. **T01-03 API y contratos.** Fastify `/v1/health`, errores con `request_id`, validación por esquema, OpenAPI y cliente tipado de ejemplo. Logging JSON con redacción de tokens y datos personales.
4. **T01-04 DB y migraciones.** Instalar PostgreSQL y Kysely, rol dueño de migraciones separado del rol API, migración inicial pequeña, runner con orden/estado. Crear helper transaccional que establezca contexto local para RLS; pruebas de que falla cerrado sin contexto.
5. **T01-05 Identidad base.** Hash Argon2id, generador de sesión opaca, cookies seguras, CSRF, limitación de intentos, recuperación por token y configuración SMTP de pruebas. Las pantallas se completan en T02.
6. **T01-06 Worker y storage.** Cola SQL/outbox con reserva atómica, reintentos exponenciales y estado fallido, job de prueba; adaptador de almacenamiento privado y límite de tamaño. Nada de procesamiento pesado en petición API.
7. **T01-07 Operación.** Backup cifrado diario DB+medios fuera del VPS, alerta de fallo, restauración aislada, métricas básicas y manual de despliegue/incidente. Calcular costes fijos del entorno.
8. **T01-08 Diseño base y CI.** Implementar tokens, tipografía, shell y componentes iniciales del [plan visual](../11-plan-visual.md), con página de muestras a 320/390/768/1280 px. Ejecutar typecheck, lint, prueba API/DB real, migración desde cero, prueba de rol SQL sin privilegio y smoke E2E.

## Aceptación y evidencia

- Una persona nueva clona y levanta local siguiendo el README; CI ejecuta pruebas y staging responde con TLS.
- El rol de API no puede alterar tablas ni leer una tabla con RLS sin contexto válido; secrets no están en repo/logs.
- Se inserta un registro de prueba, se ejecuta backup, se restaura en entorno aislado y se lee el mismo registro; guardar acta y tiempos.
- Entregar diagrama actualizado, ADR de stack, costes estimados y demo de despliegue.

**Riesgo principal:** posponer seguridad o backups por ser «solo staging». Resolverlo aquí antes de datos reales.
