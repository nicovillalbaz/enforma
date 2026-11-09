# ADR 014 — Preparación de salida y piloto independiente

**22-10-2026 · v0.14.0 · sin migración nueva.** Alcance: un coach responsable por espacio y sus alumnos; múltiples negocios aislados en la plataforma. No se añaden equipos/gimnasios ni una nueva arquitectura.

## Decisiones técnicas

1. Conservar Vue/Fastify/PostgreSQL, los workers y la interfaz de T13. No añadir telemetría externa, servicios, dependencias, conversiones o datos ficticios nuevos para preparar la salida.
2. Validar configuración antes de abrir la API: origen exacto sin ruta, HTTPS en producción, secreto de al menos 32 caracteres sin marcadores conocidos y URL PostgreSQL explícita sin los nombres administrativos habituales. Esto no demuestra entropía ni todos los privilegios; el inventario optativo consulta el rol real.
3. Confiar cabeceras reenviadas solo cuando el peer inmediato coincida con `TRUSTED_PROXY_IP` y sea el primer salto. Vacío significa conexión directa sin confianza. El overlay asigna a Caddy una IP fija en una red edge, compartida solo con API; el puerto API no se publica. Cambiar subred/IP conjuntamente si hay conflicto. Un CDN/proxy adicional exige revisar el diseño antes de habilitarlo.
4. No usar confianza por número de saltos: Fastify 5.12.7 la rechaza. Una prueba dirigida lo detectó y se repitió solo ese caso después de corregirlo. [Contrato oficial](https://fastify.dev/docs/latest/Reference/Server/#trustproxy).
5. Añadir `Cache-Control: no-cache` a `/sw.js` en Caddy de producción, igual que en local. El shell mantiene la exclusión de API/medios privados. No cambiar el alcance offline ni forzar activación mientras hay trabajo sin guardar. [Directiva oficial de cabeceras](https://caddyserver.com/docs/caddyfile/directives/header).
6. Conservar la política de cámara/micrófono del proxy: el flujo actual adjunta archivos, no ofrece grabación con `getUserMedia`. La selección/cámara nativa del teléfono requiere aceptación física; no se afirma que el cambio de un header la pruebe.
7. Incluir comprobantes del coach en almacenamiento del monitor. Añadir conexión/consulta acotadas y sesión de solo lectura al chequeo operativo. Un worker parado o backup antiguo debe permanecer visible como pendiente, sin arrancar tareas para obtener un resultado verde.
8. `release:check` inventaría versiones/lock/migraciones y presencia del build; comprueba configuración de producción sin desplegar. `--database` consulta únicamente checksums y rol con conexiones de solo lectura. No migra ni instala ni accede a tablas de alumnos. `--evidence` guarda un informe saneado con `pilotApproved: false`.

## Verificación y límites

Tres casos unitarios nuevos de fronteras de producción, una repetición del caso de proxy y una medición local acotada; detalle real en [acta](../evidencias/t14.md). Reutilizar aislamiento/negocio/visual de T01–T13, sin sumar sus casos como nuevas pruebas T14. No inferir p95 ni capacidad de concurrencia con muestras pequeñas.

La versión inicial del inventario no comprobaba frescura del build; la continuación 0.14.1 añade comparación de huellas, con los límites descritos abajo. No certifica entropía de secretos, ausencia de todos los errores de permisos ni infraestructura externa. No determina identidad del operador, aprobación de privacidad/precio o satisfacción de usuarios. [Puertas](../piloto/00-puertas.md), [ejecución](../runbooks/t14-salida-y-piloto.md) y [ficha pendiente](../piloto/03-salida-independiente.md) conservan estos límites.

Sin nuevas tablas, almacenamiento privado, cron o servicios. Migraciones 001–022 conservadas; próxima 023. Backup conserva 81 indicadores previstos (66 conteos/15 sumas); no se ejecuta restauración nueva como rutina de T14.

## Continuación local 0.14.1 — procedencia del build y WebKit acotado

**Usuario:** operador que prepara una versión. **Problema observado:** archivos presentes en dist no prueban que correspondan a las fuentes actuales; la repetición final WebKit T07 era costosa por su recorrido/capturas. **Alternativa actual:** inspección manual de fechas y repetir el caso histórico completo. **Resultado esperado:** detectar cambios de fuentes/artefactos y comprobar únicamente pérdida de respuesta/reintento/comprobante en WebKit con fixtures aisladas. **Soporte:** un fichero de manifiesto, dos casos de huellas y un script optativo; sin dependencias o tareas residentes. **Parada:** si se supera el presupuesto breve o falta el navegador local, registrar el resultado y no entrar en bucle de instalaciones/reintentos.

1. El final del empaquetado escribe `dist/release-manifest.json`, fuera de la raíz pública `dist/web`. Incluye versión, fecha/Node, SHA-256 y conteos de entradas web y salidas. No incorpora secretos, contenido privado o rutas personales.
2. Entradas: apps/web, packages/ui y packages/shared; package.json/lock/tsconfig base y scripts de shell/procedencia. Excluye Markdown, .env, node_modules, cachés y directorios privados. Salidas: todos los archivos regulares de dist/web, incluido sw.js. Los enlaces simbólicos no son entradas admitidas.
3. `release:check` compara versión, huella de fuentes y huella de artefactos. Manifiesto ausente/ilegible, fuente modificada o salida alterada da fallo de `webBuildCurrent`. Documentación en docs o Markdown de guías no obliga a compilar otra vez.
4. Esto detecta divergencia local tras un build de confianza; no firma ni acredita autenticidad del constructor, dependencias instaladas, variables de entorno de compilación o que los archivos desplegados sean los mismos. No incluye API/workers en la huella web. No afirma construcción atómica si alguien edita fuentes mientras se empaqueta: mantenerlas estables.
5. El caso WebKit usa una DB temporal forma_test_* y storage propio, un navegador/una página, sin capturas, trazas, medios de entrenamiento, SMTP o workers. El presupuesto de trabajo es 45 s con acciones individuales de 6 s; se cierra/elimina exclusivamente el entorno creado por ese caso.
6. Se reutiliza evidencia de pasos anteriores T07 y se registra el alcance nuevo por separado. Un caso acotado no convierte la suite histórica completa en una pasada final verde ni acredita Safari/iPhone físico. [Resultados de continuación](../evidencias/t14-continuacion.md), [uso](../runbooks/t14-continuacion-local.md).
