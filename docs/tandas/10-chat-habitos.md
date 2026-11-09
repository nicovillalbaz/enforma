# T10 — Chat, notificaciones, hábitos y check-ins

**Depende de:** T08–T09. **Objetivo:** seguimiento cotidiano sin WhatsApp para las operaciones del producto.

**Corte 22-10-2026:** base funcional implementada en local, v0.10.0, migración 019 aplicada; siguiente 020. [Manual detallado](../runbooks/t10-uso-y-operacion.md), [API](../runbooks/api-t10.md), [ADR 010](../decisiones/010-chat-y-seguimiento-privados.md), [acta y límites](../evidencias/t10.md).

## Base recibida de T09

V0.9.0, migraciones 001–018; siguiente 019. Reutilizar identidad y vínculo profesional-alumno, revisión/idempotencia y políticas de lectura de [T09](09-alimentacion.md), sin heredar consentimiento del diario/fotos como permiso de chat. Mensajes/check-ins necesitan finalidad, retención, control de acceso, límites y preferencias de notificación propios. No habilitar envío externo automático por esta base. Mantener puertas profesionales, físicas, infraestructura y restauración T09 abiertas; solo pruebas puntuales.

## Pasos en orden

1. **T10-01 Conversaciones.** Participantes y alcance por organización/alumno, mensajes ordenados y persistidos, paginación por cursor, leído/no leído y reglas de borrado/retención. Un chat de un alumno no es visible a personal no asignado.
2. **T10-02 Tiempo real.** WebSocket autenticado con revalidación de permisos, reconexión y sondeo alternativo; entregar evento solo después de persistir. Mensajes reintentados tienen ID de cliente único.
3. **T10-03 Adjuntos.** Reutilizar media_assets y ACL de T08; foto/vídeo/audio/documento dentro de cuota. Al revocar acceso, no quedan URL públicas permanentes.
4. **T10-04 Notificaciones.** Bandeja interna, preferencias, no leído y eventos de mensaje, check-in y comentario; sin SMS. Push web opcional después de comprobar compatibilidad por dispositivo, con permiso solicitado por gesto del usuario.
5. **T10-05 Hábitos.** Plantilla/frecuencia, registro simple, sueño/agua/energía opcionales, progreso y revisión del coach. Indicadores no son diagnósticos.
6. **T10-06 Formularios.** Plantillas versionadas con tipos de campo y adjunto, programación semanal/mensual, respuesta editable según regla, avisos y revisión del profesional.
7. **T10-07 QA.** Dos dispositivos, reconexión, mensajes duplicados/fuera de orden, adjunto ajeno, notificación repetida, check-in caducado y controles móviles con teclado abierto.

## Aceptación y evidencia

Alumno consulta su ejercicio, pregunta por chat con vídeo adjunto y recibe respuesta; coach ve su check-in semanal y hábito. Tras desconexión, el mensaje aparece una vez y ningún otro coach puede acceder a conversación o adjunto.

## Resultado por tarea

| Tarea | Resultado local | Puerta conservada |
|---|---|---|
| T10-01 | Pareja alumno/profesional, secuencia transaccional, UUID/hash, paginación, marca de lectura, retirada y retención | Condiciones definitivas y recuperación externa |
| T10-02 | WebSocket autenticado/origen, invalidación tras commit, revalidación, reconexión y HTTP alternativo visible | Proxy HTTPS y dos teléfonos físicos |
| T10-03 | Imagen/vídeo/audio normalizados y PDF con análisis obligatorio; cuota común y rutas privadas; recursos T08 revalidados | Scanner real, formatos nativos y visor físico |
| T10-04 | Bandeja, preferencias, silenciar, deduplicación por conversación, mensaje/check-in/revisión | Push web opcional sin habilitar |
| T10-05 | Documento/frecuencia, asignación, agua/sueño/energía opcionales, cero/ausente y resumen sin diagnóstico | Prueba de uso real con coaches |
| T10-06 | Borrador, publicación inmutable, campos tipados/adjuntos, semana/mes, respuesta CAS, omisión y revisión | Aceptación de formularios con teclado físico |
| T10-07 | Once casos nuevos y tres unitarias, evidencia local dirigida de navegador | Matriz física, accesibilidad real y pendiente WebKit T07 |

## Secuencia concreta realizada

1. Separar permisos de conversación de los de alimentación/progreso y fijar la pareja privada. Modelar trece tablas de dominio, estado operativo, índices y RLS en 019; restringir EXECUTE de helpers.
2. Añadir apertura, envío, secuencia, lectura, preferencias, permisos y retirada con límites e idempotencia. Evitar deduplicar avisos de distintas conversaciones por una secuencia común.
3. Incorporar HTTP y WebSocket; escuchar invalidaciones PostgreSQL y volver a consultar por HTTP. Limitar conexiones, payload, reconexión y sondeo; cerrar conexiones al ocultar/salir y al parar el servidor.
4. Reservar adjuntos con cuota, recibir stream exacto autorizado, procesar y publicar solo resultado listo. Extender medios a audio/PDF sin abrir biblioteca a alumnos ni permitir reutilizar medios de chat como recursos.
5. Crear bandeja y privacidad con consentimiento propio. Mantener Push como puerta opcional, sin añadir envío externo.
6. Implementar hábitos con snapshot, días/unidades y entradas con revisión. Publicar formularios inmutables y programaciones con ajuste de fin de mes; validar respuestas en servidor y bloquear edición tras revisión/cierre.
7. Añadir programador ligero del producto, heartbeat, Compose, operación y trece conteos de backup. Conversiones secuenciales por defecto.
8. Integrar `/seguimiento` en Más opciones/sidebar. Móvil muestra lista o detalle; PC ancho ambos. Campos de 16 px, controles de 44 y borradores protegidos sin cache privada.
9. Verificar solo casos nuevos y correcciones por filtro, compilar, aplicar 019 y registrar evidencia. Actualizar guías y puente T11 sin dar por cerradas puertas externas.

## Continuación

T11 usa v0.10.0/migración 020. Reutilizar el patrón de avisos y jobs sin conceder acceso a conversaciones. No repetir suites históricas ni capturas existentes por cambios documentales. Mantener registrada la [firma NAVZ para más adelante](../pendientes/firma-navz.md).
