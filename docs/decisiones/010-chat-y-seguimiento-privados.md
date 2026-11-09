# ADR 010 — Chat y seguimiento privados

**Fecha:** 22-10-2026. **Ámbito:** T10, v0.10.0 y migración 019. **Estado:** implementado en local; aceptación física y operación externa abiertas.

## Decisiones

1. Mantener Vue 3, Fastify y PostgreSQL. Añadir `@fastify/websocket` 11.3.4, `ws` 8.22.0 y tipos 8.18.2, fijados en el lockfile. El [plugin oficial](https://github.com/fastify/fastify-websocket) admite los hooks de autenticación de Fastify; se registra antes de las rutas y sus listeners se adjuntan sin esperar operaciones asíncronas.
2. Una conversación privada por organización, alumno y profesional vinculado. El owner no puede leer conversaciones de otro profesional por su cargo. Crear otro vínculo produce otro espacio; no mezcla historiales. El alumno puede consultar su historial permitido tras retirar el vínculo, pero no enviar más mensajes en esa conversación.
3. Persistir por HTTP en una transacción, con secuencia por conversación y UUID de cliente más hash de intención. Repetir la misma intención devuelve el mismo recibo; reutilizar su ID con otro contenido produce conflicto. Los avisos de PostgreSQL llegan después del commit.
4. El WebSocket transmite únicamente invalidaciones. Cada entrega y heartbeat vuelve a comprobar sesión y permisos; HTTP proporciona el contenido autorizado. Origin obligatorio, hasta 3 conexiones por usuario y 100 por proceso, TTL de 15 minutos, mensajes entrantes rechazados y sin compresión. Un listener PostgreSQL por proceso, con reconexión y recuperación de estado por HTTP. No se incorpora Redis ni un servicio externo.
5. La página se reconecta con espera creciente hasta 30 segundos y consulta cada 30 segundos si el socket no está disponible y la página está visible. Al volver de segundo plano vuelve a consultar. El chat y los formularios necesitan red y quedan fuera de IndexedDB, service worker y cache pública.
6. Adjuntos propios clasificados como privados de seguimiento en `media_assets`. Se conservan los permisos de biblioteca de T03 y la entrega de recursos de T08. La biblioteca y el envoltorio de recursos rechazan medios de chat incluso si se conoce su UUID. Un recurso T08 solo puede referenciarse si lo creó el profesional de esa conversación y ya está compartido explícitamente con ese alumno; se comprueba otra vez al descargar.
7. Imagen normalizada a WebP, vídeo H.264/AAC en MP4 y audio AAC mono en MP4. Sin reproducción automática. PDF propio requiere análisis ClamAV con resultado limpio; un scanner ausente o no disponible bloquea la entrega. No se instalan servicios ni se descarga un navegador para este flujo.
8. Bandeja y preferencias internas por organización/usuario, con eventos deduplicados por conversación. Silenciar no elimina mensajes ni su contador. Push web continúa opcional y pendiente de aceptación física. No se solicita permiso ni se envían correos, SMS o mensajes externos en T10.
9. El alumno concede un permiso de seguimiento por conversación. Retirarlo oculta al profesional los registros y respuestas, conservando la consulta propia del alumno durante la retención. No deriva de permisos de alimentación, fotos corporales ni recursos.
10. Hábitos asignados como documento congelado con días de semana y periodo. Agua, sueño y energía opcionales, sin referencias automáticas. `null` significa sin dato y `0` es un valor registrado; no se considera incumplimiento un día sin datos. No se generan diagnósticos.
11. Formularios de hasta 12 campos con borrador y versiones publicadas inmutables. Tipos texto, número, escala, opción, booleano y adjunto. Frecuencia semanal o mensual; un día mensual inexistente usa el último día del mes. Las respuestas admiten edición durante su ventana hasta revisión del profesional. Omitir voluntariamente no exige consentimiento.
12. El programador de check-ins ejecuta lotes de hasta 100 programaciones por minuto. Materializa 14 días anteriores y 31 siguientes; la consulta de seguimiento también materializa y los avisos son únicos. Se añade un proceso pequeño del producto; no es una automatización de Codex.

## Límites y conservación técnica

| Elemento | Límite |
|---|---|
| Mensaje | 4.000 caracteres, 3 adjuntos, 20 mensajes/minuto por emisor/conversación y 300/día por conversación |
| Imagen/audio/PDF | Entrada de hasta 5 MiB; vídeo hasta 20 MiB |
| Audio/vídeo | Máximo 60 segundos; consumen duración compartida del plan |
| Cargas | 4 medios pendientes por organización; una subida por proceso API; 10 adjuntos sin enviar por usuario/conversación |
| Hábitos | 20 activos por conversación; hasta 366 días de asignación; registro hasta 14 días anteriores |
| Plantillas | 50 por profesional, 50 versiones por plantilla, 12 campos por versión |
| Programaciones | 10 activas por conversación, periodo máximo 366 días, ventana 1–14 días |
| Lecturas | 30 conversaciones/avisos por página, 40 mensajes por página; UI mantiene una página de mensajes |
| Conservación | Contenido de mensajes/respuestas/registros 180 días; avisos 90 días; cargas sin enviar 24 horas |
| Retirada | Autor puede retirar un mensaje durante 15 minutos; se revoca inmediatamente la descarga de sus adjuntos |

El mantenimiento posterior retira archivos cancelados/eliminados siguiendo T03 (umbral de un minuto), además de limpiar contenido vencido. Se mantienen identificadores, secuencias y hashes necesarios para idempotencia; un reintento no revive el contenido retirado. El plazo técnico requiere aprobación de finalidad y condiciones antes del piloto; no acredita cumplimiento legal.

## Datos y recuperación

Trece tablas de dominio más el heartbeat operativo `followup_worker_state`. SELECT con RLS; escrituras únicamente por funciones acotadas. Helpers privilegiados sin EXECUTE para el rol API. Auditoría de identificadores y acciones, sin copiar mensajes o respuestas a logs.

Los medios usan el inventario privado existente y la cuota compartida. El backup añade trece conteos: **49 indicadores previstos = 46 conteos + 3 sumas financieras**. No se ejecutó una restauración nueva en esta tanda; continúa la puerta de recuperación externa y de la ampliación T08–T10.

## Consecuencias y puertas pendientes

El contenido necesita conexión; los borradores son de memoria y avisan antes de salir. Los mensajes se leen por páginas con regreso a recientes; una invalidación no reemplaza el borrador de un check-in. El estado «Visto» refleja una marca de lectura de la conversación, no comprensión ni atención inmediata.

Antes del piloto: iPhone/Android físicos, teclado y safe areas, vídeo/audio reales del dispositivo, HTTPS y proxy WebSocket, scanner real, recuperación, revisión de privacidad y entrevista con coaches. Mantener el pendiente WebKit de T07. [Acta y alcance de QA](../evidencias/t10.md), [manual](../runbooks/t10-uso-y-operacion.md), [contrato](../runbooks/api-t10.md).
