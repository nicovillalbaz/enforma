# Barrido previo al servidor de pruebas · 26-10-2026

## Alcance y resultado

Se revisaron el arranque de API/worker, autenticación, CSRF, contexto de organización, rutas y esquemas de entrada, migraciones, RLS, exportación, cliente HTTP, generación web/PWA y configuración Compose/Caddy. El inventario actual contiene **36 migraciones** y **199 declaraciones de rutas** en API: 190 con esquema declarado y nueve rutas públicas u operativas sin esquema. La consulta de catálogo detectó **94 tablas legibles por el rol API**. Las excepciones sin `FORCE ROW LEVEL SECURITY` se concentran en identidad/tokens, latidos operativos, planes globales y dos tablas de control manual con RLS aplicado al rol `forma_api` (que no es su propietario). No se leyó ni copió contenido de alumnos para este inventario.

**Estado: preparación local corregida; staging aún no desplegado.** La comprobación de migraciones, rol, versiones y build pasó. `release:check --database` devuelve `needs-attention` únicamente porque el origen de esta máquina es HTTP local; en staging se exige `APP_ORIGIN=https://...`. No hay prueba de PostgreSQL 18, Caddy en ejecución, TLS, SMTP, scanner, backup externo ni teléfonos físicos: el motor Docker no estaba disponible en esta máquina. No usar datos reales en el servidor de prueba hasta cerrar las puertas aplicables.

**Trazabilidad pendiente:** el repositorio tiene `.git` pero todavía no tiene ningún commit; el código aparece como no seguido. Antes de copiarlo al servidor hay que crear un snapshot Git revisado que excluya `.env`, `.local`, `tmp/`, `dist/` y el ZIP inicial si no forma parte de la entrega. Sin una revisión fija no hay rollback de código reproducible.

## Defectos encontrados y corregidos

| Área | Hallazgo | Cambio y evidencia |
|---|---|---|
| Cliente API | Una respuesta HTTP no JSON del proxy (por ejemplo, 502 HTML) se convertía en `NETWORK_ERROR` con estado 0. | `apps/web/src/api.ts` conserva el estado HTTP y ofrece un mensaje controlado. Dos casos unitarios distinguen 502 de fallo de transporte. |
| Exportación privada | `collectPrivacyData` exigía exactamente la migración 024; con 036 rechazaba cualquier exportación. Además omitía antropometría. | Guard actualizado a 036 e inventario por `organization_id` y `student_id` de `anthropometry_assessments`. Caso aislado confirma una medición propia y excluye la de otro alumno. |
| Informe personal | Una aserción antigua rechazaba incluso el campo `measurements`, incorporado por el informe actual. | La prueba exige `measurements: []` y `measurementsPrivate: false` sin permiso, y sigue rechazando claves/secretos. No se cambió el permiso de producto. |
| Servidor web | La regla SPA enviaba `index.html` para un chunk `/assets/*` ausente y no fijaba frescura de las rutas HTML. | Ambos Caddyfile sirven `/assets/*` como archivo (404 si falta), con caché inmutable para hashes; el resto de páginas usa `no-cache`. Se mantiene la recuperación de ruta en el cliente. Sintaxis contrastada con la [documentación oficial de Caddy](https://caddyserver.com/docs/caddyfile/directives/handle); ejecución real pendiente de Docker. |
| Dependencias | `npm audit` detectó un aviso alto en `@fastify/static`, transitivo de Swagger UI 5.x. | Swagger UI subió a 6.1.2 y `@fastify/static` a 10.1.7. [Repositorio oficial de Swagger UI](https://github.com/fastify/fastify-swagger-ui). Auditoría npm completa y de producción: 0 avisos al cierre. |
| Pruebas de bajo consumo | Dos unitarias excedieron 5 s durante ejecución paralela; al secuenciarlas pasaron. | `vitest.config.ts` usa archivos secuenciales y 15 s por caso. No se relajaron aserciones de negocio. |
| Empaquetado | `tmp/` era un archivo de trabajo visible para Git y la imagen. | Excluido de `.gitignore` y `.dockerignore`. |

## Comprobaciones ejecutadas

| Comprobación | Resultado |
|---|---|
| Unitarias | 21 archivos, **49/49** casos aprobados tras ejecución secuencial. |
| Integración PostgreSQL | 16 suites revisadas, **134 casos** en total. La primera pasada detectó dos fallos; se corrigieron y repitieron solo las tres suites afectadas (**20/20**) y el nuevo caso de privacidad por separado (**1/1**). Cada suite usa base temporal aislada y la elimina. |
| Build/tipos/PWA | Aprobado. Manifest de fuentes y artefactos verificado; shell precarga solo activos públicos. |
| ESLint/Prettier | ESLint aprobado; archivos modificados conformes a Prettier. |
| Dependencias npm | Auditoría completa y `--omit=dev`: **0 vulnerabilidades informadas** por el registro npm tras actualizar Swagger UI. |
| Base existente | 36/36 checksums aplicados; rol `forma_api` restringido. Solo lectura. |
| Compose | `docker compose ... config --quiet` aprobado con dominio ficticio; advirtió que `SMTP_USER` y `SMTP_PASSWORD` están vacíos. |
| Contenedores reales | No ejecutados: Docker Desktop no ofrecía motor Linux. |

## Segunda pasada: restauración, rol API y recorrido móvil

- El inventario de rutas por AST contó **199** declaraciones: 80 GET, 80 POST, 32 PUT, tres PATCH y cuatro DELETE. Se localizaron nueve sin `schema` (salud, CSRF, cierre de sesión, resumen piloto, logo público, lista de organizaciones, verificación de correo, bandeja de desarrollo y alta administrativa) y se revisaron sus controles de acceso o su carácter público. Este inventario comprueba presencia de esquema; no sustituye una prueba funcional de cada combinación de entrada.
- La copia/restauración aislada ahora cuenta también `anthropometry_assessments`. Se insertó una evaluación ficticia y se confirmó su presencia al restaurar: **87 indicadores de tablas** comprobados en la prueba dirigida. Así una futura restauración que pierda evaluaciones falla en la comprobación.
- La configuración de producción rechaza `DATABASE_URL` sin contraseña o con un usuario distinto de `forma_api`. Siete pruebas unitarias dirigidas y la comprobación de tipos pasaron.
- Se actualizó la prueba de navegador al flujo móvil vigente. **2/2 casos móviles aprobaron**: el primero recorrió alta, aprobación, verificación, ficha e invitación, acceso del alumno, pausa/reactivación, marca y aislamiento entre dos estudios; el segundo comprobó registro y páginas públicas a 320, 390, 768 y 1280 px, sin desbordes y sin bloquear zoom. La prueba fue secuencial, con un trabajador. Una comprobación final repitió solo el primer caso con la sesión del alumno también a 390 px y táctil: **1/1 aprobado**.
- ESLint pasó en los archivos modificados. El primer intento de navegador quedó detenido por el aislamiento local de los servicios; el segundo necesitó ajustar selectores desactualizados del propio test (pantalla de instalación y selector de estudio móvil). La ejecución final aprobó. No se observó un fallo de producto en ese recorrido.

El barrido sigue siendo local: faltan despliegue HTTPS, Docker/Caddy real, SMTP/worker en servidor, restauración desde almacenamiento externo y aceptación en teléfonos físicos. No se declara ausencia total de defectos; el corte es apto para preparar un staging con datos sintéticos siguiendo la secuencia siguiente.

La primera conexión DB desde la caja de herramientas fue denegada por el aislamiento local (`EACCES 127.0.0.1:54329`); la pasada autorizada contra PostgreSQL local terminó. Los dos fallos de integración observados eran reales en este corte y están cubiertos por la repetición dirigida. El build local retiene chunks previos para pestañas abiertas, por lo que su directorio acumuló 666 artefactos; la imagen Docker se construye desde un contexto que excluye `dist/` y comienza limpia.

## Secuencia para el servidor de pruebas

1. Crear y revisar el primer snapshot Git de fuentes; preparar servidor y dominio/subdominio de prueba; usar solo identidades sintéticas. Confirmar que 80/443 apuntan a Caddy y que API/PostgreSQL no tienen puertos públicos. Registrar revisión de código, versión de imagen y responsable.
2. Crear secretos independientes para PostgreSQL admin/API/worker, cookie y backup. Configurar `SITE_DOMAIN`, `APP_ORIGIN=https://dominio`, IP/subred de proxy, SMTP de prueba (`mailpit` interno o SMTP autorizado), almacenamiento y, si se ensayan PDF subidos, ClamAV. No copiar `.env` ni bases de la demo.
3. Ejecutar `docker compose -f compose.yml -f infra/compose.production.yml config --quiet`. Con motor disponible, validar Caddyfile dentro de la imagen y construir desde contexto limpio. Aplicar migraciones 001–036 una vez; no editar migraciones ya aplicadas.
4. Ejecutar `release:check -- --database` desde el entorno del servidor y exigir `productionConfig`, `appliedMigrations`, `apiRole`, `webBuildCurrent` y `webBuildPresent` verdaderos. Comprobar `/v1/health`, `/v1/ready`, 404 real de un asset ausente, 404 de `/v1/docs`, cookies seguras y `no-store` en API.
5. Probar un coach y dos alumnos ficticios: alta/invitación, suspensión/reactivación mensual, ejercicio/rutina, alimentación, antropometría, exportación por alumno y aislamiento de otra cuenta. En móvil real probar instalación, teclado, vuelta atrás, refresco tras nueva versión y sin desbordes a 320/390 CSS px.
6. Ensayar SMTP/worker, scanner si se habilitan documentos subidos, copia cifrada y restauración aislada. Guardar resultados sin tokens, contraseñas ni datos corporales. Cerrar las [puertas del piloto](../piloto/00-puertas.md) que correspondan antes de usar personas reales.

La [guía de salida](../runbooks/t14-salida-y-piloto.md) conserva los pasos operativos amplios; sus recuentos de v0.14.2/023 son históricos y este inventario 036 es el corte actual.
