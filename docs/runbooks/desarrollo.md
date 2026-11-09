# Desarrollo local — referencia vigente T14

**Control mensual vigente:** [uso T14-07](t14-control-mensual.md), [API](api-t14-control.md), [acta](../evidencias/t14-control-mensual.md). V0.14.2/023: nuevas altas pendientes y habilitación desde admin; precio/cupo mensual configurables. Fixtures históricos que asumían prueba automática deben aprobar explícitamente al coach antes de preparar alumnos; no ejecutar sus suites completas sin adaptar ese contrato. Verificación actual limitada a casos nuevos y pantallas afectadas.

**V0.14.2, migraciones 001–023; próxima 024.** Coaches independientes. Las secciones T02–T14 inicial conservan sus instrucciones/evidencias históricas. Para la salida vigente usar [T14](t14-salida-y-piloto.md) y su [continuación local](t14-continuacion-local.md); para consumir poco, consultar el acta del caso y ejecutar solo el filtro afectado. No instalar de nuevo ni ejecutar todas las órdenes de pruebas en una instalación preparada.

La aplicación usa Vue 3/TypeScript/Vite, Fastify, PostgreSQL/Kysely y un worker separado. El nombre Forma y la marca Nico Studio son provisionales y configurables. El acceso real guarda organizaciones, marca, alumnos, invitaciones, sesiones, permisos, uso y trabajos en PostgreSQL. La demostración de diseño se abre expresamente en `/demo`. Uso y soporte: [T02](t02-uso-y-soporte.md).

T03 añade biblioteca, equipos, fotos y clips privados, además de un segundo worker para FFmpeg/Sharp. [Uso y operación de medios](t03-uso-y-operacion.md). T04 añade constructor/plantillas, versiones publicadas inmutables y asignaciones; [uso T04](t04-uso-y-operacion.md). Esa base histórica llegaba a 008; las ampliaciones posteriores y la versión vigente se indican arriba y al final.

## Prueba manual vigente con datos ya preparados

Para probar sin reconstruir o ejecutar suites, usar la [demo local separada T14-09](t14-prueba-privada.md): http://127.0.0.1:4180/acceso. Sus cuentas y datos ficticios no usan el seed histórico ni la base de trabajo; las preparaciones antiguas de pruebas se adaptaron en [T14-08](t14-cierre-local.md), con límites de ejecución registrados. La receta de instalación general que sigue no se repite en este equipo ya preparado.

## Arranque en este equipo

Se dispone de Node 24 en el runtime de Codex y de PostgreSQL 16.11 instalado. `scripts/forma.ps1` selecciona Node 24 sin modificar la instalación global de Node 20.

```powershell
.\scripts\forma.ps1 install --no-audit
.\scripts\forma.ps1 run setup
.\scripts\forma.ps1 run db:local
.\scripts\forma.ps1 run db:migrate
.\scripts\forma.ps1 run db:seed
.\scripts\dev.ps1
```

`setup` crea `.env` con secretos aleatorios si no existe. La base local del proyecto vive en `.local/postgres` y escucha solo en `127.0.0.1:54329`; otras bases de este equipo no se modifican. Para otra instalación, fijar `PG_BIN` al directorio de binarios PostgreSQL. Local y CI validan compatibilidad con PostgreSQL 16; el Compose del VPS utiliza PostgreSQL 18.

Instalar FFmpeg y FFprobe en PATH o fijar `FFMPEG_PATH`/`FFPROBE_PATH`. `dev` inicia web/API/medios; `dev:media` ejecuta solo el procesador. `node --import tsx scripts/check-media-worker.ts` comprueba su estado con Node 24. En PowerShell escribir argumentos con guiones entre comillas, por ejemplo `.\scripts\forma.ps1 run test:e2e '--' '--workers=1'`.

- Interfaz: `http://127.0.0.1:5173/`
- Registro: `http://127.0.0.1:5173/registro`
- Alumno: `/alumno`, requiere su sesión y una ficha activa
- Demostración sin cuenta: `http://127.0.0.1:5173/demo`
- Acceso real de desarrollo: `http://127.0.0.1:5173/acceso`
- API: `http://127.0.0.1:3001/v1/health`, readiness `/v1/ready`, contrato `/v1/docs` (solo desarrollo).
- Superadmin ficticio: `admin@forma.local` / `Forma-demo-2026!`, sin organización propia; entra en `/admin`.
- Cuenta sembrada exclusivamente para desarrollo: `coach@forma.local` / `Forma-demo-2026!`. El seed rechaza `NODE_ENV=production`.
- Biblioteca coach: `/ejercicios`; alumno: `/biblioteca`. Tras ejecutar `node --import tsx scripts/capture-t03.mjs` hay guías técnicas ficticias y un alumno `alumno.biblioteca@forma.local` con la contraseña local de demostración. El script solo modifica el estudio del seed.

En otra terminal, iniciar worker con `.\scripts\forma.ps1 run dev:worker`. SMTP local debe estar disponible para entregar recuperaciones; con Docker se incluye Mailpit en `http://127.0.0.1:8025`. Sin SMTP, el job queda pendiente/reintentable y no se finge envío exitoso al operador. En local, el propio usuario puede abrir la bandeja de verificación desde el aviso del panel. No arrancar un worker sin SMTP esperando que esa bandeja confirme entrega.

## Catálogo de comprobaciones (no ejecutar todas rutinariamente)

Este bloque conserva las órdenes generales. Con recursos limitados elegir solo la prueba del cambio; los totales/matrices T04 que siguen son históricos. No instalar navegadores ni repetir test:db/E2E para documentación o configuración. T14 tiene sus casos y resultados en [acta](../evidencias/t14.md).

```powershell
.\scripts\forma.ps1 run lint
.\scripts\forma.ps1 run build
.\scripts\forma.ps1 test
.\scripts\forma.ps1 run test:db
.\scripts\forma.ps1 exec playwright install chromium webkit
.\scripts\forma.ps1 run test:e2e
```

Las pruebas DB usan únicamente la base local configurada e introducen datos ficticios. Las de navegador cubren demostración, registro, invitación, pausa/reactivación, persistencia, dos organizaciones, dos marcas/logos y superadmin a 320/390/768/1280 CSS px en Chromium y WebKit. Ejecutar `test:e2e -- --workers=1` con PostgreSQL disponible; Playwright inicia API/web si no están encendidos. En CI se ejecuta el seed ficticio antes de esos recorridos. Los límites de registro/aceptación también funcionan en desarrollo: varias ejecuciones completas en 15 minutos pueden devolver 429; esperar el periodo o reiniciar solo la API local de pruebas. No alterar los límites de producción. Son emulaciones: la prueba física de iPhone/Android sigue pendiente. No se ha registrado un dominio ni desplegado a staging.

## Datos de la demostración

Desde T03 cada suite DB crea y elimina su propia base temporal y usa storage aislado; requiere privilegios administrativos de pruebas para crear DB. No ejecutar contra datos reales. Playwright inicia su worker de medios si no encuentra uno sano y solo termina el proceso que creó. Configura un solo worker de navegador. Total actual T04: 13 unitarias, 40 integración y 24 navegador. Se verifica carga/conversión, permisos, rutinas/versiones/asignaciones, viewport y bloqueo `/@fs/.local`. WebKit Windows verifica descarga autenticada y respaldo de texto para vídeo, con reproducción pendiente según el [acta T03](../evidencias/t03.md). Los límites locales de registro/aceptación son más amplios que producción.

Biblioteca, cuotas y rutinas están persistidas en PostgreSQL y archivos en storage privado. El coach abre `/rutinas` y el alumno `/mi-programa`; sesiones/progreso reales siguen en T05/T06. No confundirlos con los ejemplos de `/demo`.

T04: **13 unitarias + 40 integración + 24 navegador = 77 aprobadas**. La configuración sigue usando un solo worker de navegador. Registro/aceptación local admiten 50 operaciones por 15 minutos para la matriz; producción conserva ocho de registro/aceptación y cinco de login. Las pruebas unitarias comprueban esos límites de producción.

Para regenerar la evidencia T04: `node --import tsx scripts/capture-t04.mjs` con Node 24, servicios activos y la demostración técnica T03 ya creada. Solo escribe en el estudio fijo del seed. Crea/reutiliza una plantilla de ocho semanas y asignaciones a `alumno.biblioteca@forma.local` y `alumno.rutina@forma.local`, con la contraseña ficticia de desarrollo. No usar este script o estas identidades en producción. [Acta y capturas](../evidencias/t04.md).

Alumnos de ejemplo, marca, tema y series del prototipo se guardan bajo claves `forma.demo.*` de `localStorage`. Se identifican como ejemplo en pantalla y no corresponden a alumnos reales. La base PostgreSQL guarda las cuentas/sesiones, organizaciones, marcas, alumnos, invitaciones, planes, intervalos de uso, auditoría y trabajos. El modo real no restaura fichas del prototipo. El resto de tablas del SQL original se añadirá gradualmente en las tandas correspondientes.

## Detener

Detener web/API con Ctrl+C en su terminal y base con `.\scripts\forma.ps1 run db:local -- stop`. No ejecutar esa orden contra una base ajena ni editar los archivos de `.local/postgres` directamente.


## T05: probar el shell offline compilado

1. Aplicar migraciones hasta 010 con `scripts/forma.ps1 run db:migrate`.
2. Compilar `scripts/forma.ps1 run build`; genera `dist/web/sw.js` y precarga únicamente recursos públicos.
3. Terminal A: `scripts/forma.ps1 run preview:api` (API local 3002, origen permitido 4173). Terminal B: `scripts/forma.ps1 run preview` (4173).
4. Abrir `http://127.0.0.1:4173`, preparar un día con cuenta ficticia y esperar la instalación del shell. Desconectar, guardar dos series, recargar y reconectar. El shell no se registra en el Vite de desarrollo 5173.
5. `scripts/forma.ps1 run test:e2e` incluye la matriz de desarrollo y proyectos offline sobre la compilación. Siempre compilar antes; Playwright inicia las APIs y previews que falten. No cambiar fuentes/compilación durante la suite.
6. Consultar [uso/recuperación T05](t05-uso-y-operacion.md), [API](api-t05.md) y [acta](../evidencias/t05.md). Las pruebas DB usan bases aisladas.


## T06: progreso y privacidad

Aplicar migraciones hasta 013 y compilar antes de la matriz de navegador. [Manual T06](t06-uso-y-operacion.md) explica alumno/coach, fórmulas y datos privados opcionales; [API](api-t06.md) y [acta](../evidencias/t06.md) detallan límites/evidencia. La siguiente migración empieza en 014.

Con Node 24 en PATH y servicios locales activos:

```powershell
npm test
node node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts tests/integration/progress.test.ts
node node_modules/@playwright/test/cli.js test tests/e2e/progress.spec.ts --project=desktop --project=mobile --project=webkit --workers=1
```

El recorrido de navegador crea estudio/cuentas aleatorias ficticias y una PNG sintética; genera variantes de `docs/evidencias/t06-*.png`. No requiere consentimiento ni fotos de personas reales. También verifica retención del selector de archivo al revalidar la página y ausencia de errores ResizeObserver en WebKit. El caso de cuota DB crea versiones de plan nuevas, sin desactivar su inmutabilidad.

Cobertura acumulada al cerrar T06: 19 unitarias + 62 integración + 36 navegador = 117 únicas; ejecución dirigida T06: 19/62/12, con repetición final de sus tres recorridos nuevos. Backup/restauración local: 201 archivos y 13 conteos; no acredita respaldo externo. Datos de mediciones/fotos requieren red y quedan fuera de IndexedDB/CacheStorage.


## T07: instalación y cuenta

Migraciones 001–016, siguiente 017. Versión 0.7.0. Compilar antes de probar el shell; no editar fuentes mientras se ejecuta Playwright. El [manual](t07-uso-y-operacion.md) explica instalación/actualización, cuenta owner/admin, monitor y recuperación. [API](api-t07.md) y [acta](../evidencias/t07.md) registran fórmulas, pruebas y puertas abiertas.

```powershell
scripts/forma.ps1 run build
scripts/forma.ps1 test
scripts/forma.ps1 run test:db
scripts/forma.ps1 run test:e2e
scripts/forma.ps1 run ops:check
```

La matriz añade cuenta/instalación en tres proyectos y actualización en espera sobre preview en Chromium/WebKit. Cuenta/recibos son sintéticos; los fixtures históricos se preparan solo en la base nueva de cada prueba o en un estudio ficticio recién creado de localhost. No ejecutar tests/seed/capturas contra el piloto real.

El monitor puede terminar con código 1 y alerta de correos atrasados; no equivale a fallo de tests ni debe ocultarse para declarar operación lista. No enviar esa cola a destinatarios reales sin configuración/autorización. Un backup reconocido requiere sidecar coincidente con la base/storage actual, no uno recién creado por una suite aislada. Valores de coste vacíos son desconocidos, no cero.

### Límites de fixtures T07

**Preferencia del usuario, 21-10-2026: consumo reducido.** Ejecutar solo verificaciones relevantes para el cambio, con un worker y sin procesos de prueba simultáneos. Reutilizar resultados ya obtenidos. No repetir suites completas, carga, capturas masivas ni restauraciones como rutina después de cada ajuste. Si un motor local consume demasiado, registrar el caso pendiente y continuar el trabajo documental o de implementación que no dependa de él. No programar pruebas o seguimientos automáticos por esta preferencia.

En T07 ya existen 23 unitarias, 73 integraciones y evidencia de navegador/backup. El único pendiente final de navegador es `billing.spec.ts` en WebKit; no requiere repetir el resto. Su fixture usa administrador PC con densidad 1, capturas CSS y traza DOM/red sin imágenes continuas. Esos ajustes de reducción de consumo se dejan preparados sin otra ejecución pesada.

Los servidores de Playwright disponen de hasta 90 s para arrancar en frío en Windows. Un timeout de preparación sin casos ejecutados no es aceptación ni rechazo del recorrido funcional; comprobar readiness, resolver el arranque y repetir la misma prueba.

La preparación de invitaciones permite 100 solicitudes/15 min en desarrollo para la matriz secuencial de navegador; producción conserva 20/15 min. Registro/aceptación mantienen sus límites de producción, comprobados por la suite unitaria. Los helpers deben comprobar el estado HTTP antes de extraer un token o una URL. Un 429 de fixture no acredita un fallo funcional del recorrido y debe resolverse antes de registrar aceptación.


## T08: documentos con consumo reducido

V0.8.0, migración 017; siguiente 018. /recursos y `scripts/forma.ps1 run dev:documents`. Worker de un documento; Chromium solo al generar. Antivirus real configurado por entorno, sin instalación automática. [Uso](t08-uso-y-operacion.md), [API](api-t08.md), [acta](../evidencias/t08.md).

Nueve casos dirigidos, dos unitarias y revisión opt-in con un Chromium. No repetir suites históricas para un cambio documental. El script manual crea fixtures de localhost y cierra API/Vite/navegador. La corrección de impresión regeneró solo la muestra; backup amplía conteos sin restauración nueva.

## T09: alimentación con verificaciones puntuales

V0.9.0, migración 018 aplicada, siguiente 019. `/alimentacion` usa web/API existentes; documentos comparte worker T08. Owner debe habilitar capacidad profesional explícita antes de crear alimentos/recetas/menús; diario/fotos requieren permisos propios del alumno. [Uso](t09-uso-y-operacion.md), [API](api-t09.md), [ADR](../decisiones/009-alimentacion-versionada.md), [acta](../evidencias/t09.md).

No instalar catálogos/antivirus ni ejecutar suites completas como rutina. Hay nueve casos T09 y cuatro unitarias; foto/auditoría y preservación de null se comprobaron individualmente después de ajustes. La revisión opt-in `tests/manual/t09-visual.mjs` crea únicamente un estudio/cuentas ficticias de localhost y comparte un Chromium para UI/PDF; no ejecutarla para regenerar evidencia ya disponible. Su continuación `t09-finish.mjs` se usó solo para la corrección de esa fixture local existente, no es una tarea recurrente. No publicar credenciales sintéticas de `.local` ni usar estos scripts contra el piloto.

La validación API usa tipo conjunto `number/null` para nutrientes y porciones: un `anyOf` con número antes de null puede convertir desconocido en cero con la coerción de AJV. Conservar el caso dirigido de publicación/null si se toca ese contrato. Al mezclar llamadas API manuales e interfaz en un test, refrescar CSRF antes de la siguiente mutación manual. El cliente de la app ya renueva un CSRF inválido.

## T10: chat y seguimiento con consumo reducido

V0.10.0, 019 aplicada, siguiente 020. `dev` añade `dev:followup`; `dev:media` procesa adjuntos con concurrencia 1 por defecto y scanner configurado para PDF. No iniciar esos procesos para un cambio documental. [Manual](t10-uso-y-operacion.md), [API](api-t10.md), [ADR](../decisiones/010-chat-y-seguimiento-privados.md), [acta](../evidencias/t10.md).

Once casos T10 y tres unitarias nuevos. Usar filtro del caso afectado después de una corrección; no repetir suites históricas ni restauración rutinaria. `tests/manual/t10-visual.mjs` es opt-in con `FORMA_T10_LOCAL_QA=1` y solo localhost/forma/cuentas example.test. Reutiliza fixture sintética T09 para ahorrar recursos. Hubo continuación acotada de selectores y luego `t10-finish.mjs` solo para respuesta/revisión pendiente; consultar acta antes de ejecutarlos. No publican credenciales ni arrancan correo, Docker o antivirus.

Los mensajes usan ID/hash de intención y secuencia de servidor; el WebSocket invalida, no confirma un envío. Respetar número/booleano/null en JSON Schema y no convertir cero/false en ausencia. Si se toca 019 después de aplicarla, crear una nueva migración en lugar de reescribir el checksum.

## T11: agenda con verificaciones puntuales

V0.11.0, 020 aplicada; próxima 021. /agenda usa API/web y dev:followup existentes; sin dependencias/servicios nuevos. [Manual](t11-uso-y-operacion.md), [API](api-t11.md), [acta](../evidencias/t11.md). Nueve integraciones y tres unitarias verificadas por ejecución inicial y filtros dirigidos. Reutilizar informes; no repetir suites históricas. Script opt-in tests/manual/t11-visual.mjs, solo localhost/forma y cuentas example.test. Su modo FORMA_T11_FINISH=1 limita continuación a reglas/cancelar/reservar/botón móvil; no ejecutarlo rutinariamente. No envía correo/Push ni genera PDF. Migración 020 aplicada es inmutable; usar 021 para cambios.

## T12: comercio con verificaciones puntuales

V0.12.0 / 021 aplicada, próxima 022. /servicios usa web/API/almacenamiento existentes; dev:followup añade coach_retention_tick con máximo 100 prospectos cerrados por ciclo. Sin pasarela o dependencias nuevas. [Uso](t12-uso-y-operacion.md), [API](api-t12.md), [acta](../evidencias/t12.md).

Nueve casos de integración y dos unitarias nuevos con evidencia aprobada mediante inicial + filtro de resumen; no repetir históricos. tests/manual/t12-visual.mjs es opt-in FORMA_T12_LOCAL_QA=1, requiere fixture local example.test y cierra procesos. Solo datos ficticios, sin envíos/cobros/PDF/restore. Dinero en número JSON entero de unidad mínima; no permitir coerción de cadenas/fracciones. Reportes agregados como cadena para no perder precisión. No editar 021 aplicada: crear 022.

`tests/manual/t12-capture.mjs` es la continuación de solo lectura utilizada tras corregir espaciado: reutiliza contratos ficticios cancelados, sin vender/pagar otra vez. Conserva capturas previas con sufijo `-inicial`. No ejecutar ambos scripts rutinariamente; consultar el acta para reutilizar evidencia.

## T13: coaches independientes y firma

V0.13.0, 022 aplicada; próxima 023. / muestra inicio real owner, /mas agrupa opciones y /informacion es pública. Altas solo kind coach. Esquema heredado se conserva; no iniciar administración multicoach o sedes. [Manual](t13-uso-y-operacion.md), [API](api-t13.md), [acta](../evidencias/t13.md).

Cuatro casos nuevos de backend; únicamente el contador se repitió tras corregir fixture válida de rutina. Sin unitarias de texto o suites históricas. tests/manual/t13-visual.mjs opt-in FORMA_T13_LOCAL_QA=1 usa fixture local example.test, un Chromium y lectura de Inicio/Agenda/Más/Información/registro; no crea cuenta al completar el formulario. No llama al teléfono ni envía mensajes. No PDF, carga, Docker o restore. Consultar acta antes de repetir.

## T14: preparación local y aceptación externa pendiente

V0.14.0, mismas migraciones 001–022; próxima 023. [Acta con resultados y límites](../evidencias/t14.md), [salida paso a paso](t14-salida-y-piloto.md), [ficha pendiente](../piloto/03-salida-independiente.md). No cambian componentes/CSS o navegación; se reutiliza la evidencia visual T13. Sin instalar dependencias, iniciar workers/correo, generar PDF o restaurar para esta tanda.

`release:check` no abre DB por defecto. Comprueba configuración de **producción** y puede devolver salida 1 por el origen HTTP local: es correcto. `--database` solicita únicamente checksums y rol con conexiones explícitas de solo lectura; `--evidence` sobrescribe su informe saneado. No modifica `.env` ni aprueba piloto. Revisar permisos/entorno antes de usarlo fuera del desarrollo.

Tres unitarias nuevas en `tests/unit/release-boundaries.test.ts`; repetir solo el filtro afectado si se cambia configuración/cookies/proxy. La medición opt-in `tests/manual/t14-local.mjs` requiere FORMA_T14_LOCAL_QA=1, localhost/forma y fixture example.test existente; no crea datos de negocio. FORMA_T14_BOUNDARIES_ONLY=1 es la continuación usada para los dos accesos pendientes, sin repetir tiempos o alumno. No ejecutarla otra vez solo para actualizar documentos. La autenticación modifica estado técnico de sesión y lo revoca por API al terminar.

El monitor se leyó una vez y conserva workers/cola/backup pendientes; no consumir la cola antigua hacia un SMTP real. El entorno de piloto debe estar separado y no recibir seed/fixtures/contraseñas compartidas. Los 81 indicadores previstos del backup se conservan, sin restauración T14 nueva.

### Continuación T14 — 0.14.1

[Acta](../evidencias/t14-continuacion.md) y [guía](t14-continuacion-local.md). El empaquetado escribe dist/release-manifest.json y release:check verifica versión, fuentes web/UI/shared y todas las salidas de dist/web. Markdown no fuerza recompilar; .env/datos privados no se leen. La huella presupone fuentes estables y constructor de confianza; no acredita node_modules, variables de compilación o despliegue remoto.

Dos unitarias nuevas de huellas aprobadas, con una repetición solo del caso de artefactos tras ajustar inventario. Tipos servidor y empaquetado web/shell/manifiesto una vez; no se repite vue-tsc de componentes intactos. Caso optativo tests/manual/t14-webkit-account.mjs, FORMA_T14_WEBKIT_QA=1: aprobado en 27,664 s, una página/navegador, sin capturas/trazas/PDF, DB/storage temporales eliminados. Resuelve pago/reintento/comprobante del pendiente funcional local T07; no reejecuta su recorrido histórico completo ni acepta teléfonos/PWA/arranque frío. Consultar evidencia antes de cualquier repetición.
