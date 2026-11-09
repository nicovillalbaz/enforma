# T03 — Biblioteca de ejercicios, equipos y multimedia

**Depende de:** T02, servicio privado de T01. **Objetivo:** coach publica un ejercicio propio con clip o foto y alumno autorizado lo consulta.

**Corte 21-10-2026:** implementación local v0.3.0. [Acta y límites](../evidencias/t03.md), [uso/operación](../runbooks/t03-uso-y-operacion.md), [API](../runbooks/api-t03.md), [ADR 003](../decisiones/003-biblioteca-y-medios.md). Aceptación en teléfonos físicos pendiente.

| Ticket | Avance local | Evidencia |
|---|---|---|
| T03-01 | Implementado | Cuatro guías globales originales, CRUD propio, filtros, paginación y versiones |
| T03-02 | Implementado | Material, fotos, ubicación/estado y claves compuestas |
| T03-03 | Implementado | Reserva/cupo/idempotencia, stream privado y validación real |
| T03-04 | Implementado | Worker FFmpeg/Sharp, leases, reintentos, límites y mantenimiento |
| T03-05 | Implementado | Biblioteca coach, editor, previsualización, Mis guías y texto alternativo |
| T03-06 | Implementado | GET/HEAD/Range con sesión y permiso por alumno; sin URL pública |
| T03-07 | QA local; puerta física abierta | Integración, navegador, rendimiento, backup y seis capturas; limitación WebKit Windows documentada |

## Pasos en orden

1. **T03-01 Catálogo.** Definir ejercicio global de solo lectura y ejercicio de organización; nombre, instrucciones, músculo, tipo de registro, variaciones, etiquetas y estado. Sembrar catálogo pequeño y revisado, sin copiar vídeos sin licencia.
2. **T03-02 Equipos.** Tabla y pantalla de máquinas/material con foto, ubicación y estado; relacionar ejercicio con equipo de la misma organización, además de etiquetas genéricas.
3. **T03-03 Subida.** Solicitud de carga autorizada, tamaño/duración/tipo/cupo, archivo temporal privado, validación MIME real y limpieza de huérfanos. Rechazar cruces de tenant en toda relación de medios.
4. **T03-04 Procesamiento.** Worker FFmpeg genera vídeo MP4 corto y póster; estados `pending/processing/ready/failed`, reintentos limitados y mensaje de error recuperable. Guardar bytes, duración y versión, con cupos por plan.
5. **T03-05 Interfaz.** Coach crea/edita, busca, filtra, previsualiza y asocia medios/equipo. Alumno reproduce clip con controles y lee texto si vídeo falla; poster y carga diferida en listas.
6. **T03-06 Entrega privada.** URL temporal o streaming tras autorización; impedir descarga con enlace de otro coach/alumno. Registros de uso sin contenido privado.
7. **T03-07 QA.** Probar archivo falso con extensión válida, grande, vídeo corrupto, cola caída, carga cancelada y dos vídeos simultáneos. Medir tiempo de respuesta API mientras transcodifica.

## Decisiones ejecutadas y cierre pendiente

- Se eligió streaming autenticado con cookie y rangos. No hay URLs de acceso público ni originales descargables.
- Compartición de guía publicada a alumnos concretos permite el recorrido completo de T03 antes de implementar asignaciones de rutinas en T04.
- Basic: 512 MiB/30 min; Pro: 2 GiB/120 min. Se reserva espacio y duración antes de subir; los logos conservados también cuentan.
- Worker separado de HTTP/correo, dos slots y una conversión por estudio; restricciones de recursos y healthcheck en Compose. Referencias de WaFlow adaptadas sin introducir Frappe, Redis ni IA.
- Backup y limpieza se coordinan para conservar la coherencia entre snapshot y archivos. Se rechaza una copia con referencias faltantes.
- La puerta iPhone/Android del criterio de aceptación original sigue abierta. En WebKit Windows se verifica el texto de respaldo y la descarga autenticada; reproducción privada solo acreditada en Chromium emulado. No cerrar esta puerta con una captura.

## Aceptación y evidencia

El coach graba/sube un clip de ejercicio, observa su estado, lo asocia a una máquina y el alumno lo reproduce desde iPhone Safari y Android. Otra organización obtiene denegación al reutilizar ID/URL. El backend sigue respondiendo durante dos conversiones. Registrar coste por minuto y almacenamiento de prueba.


## Base disponible al empezar T03

T02 está verificada en local: sesión, pertenencias, `actorTransaction`, RLS, fichas y asignación profesional. Reutilizar estos contratos y el [ADR 002](../decisiones/002-organizaciones-y-acceso.md). No derivar la privacidad de vídeos del endpoint público del logo. Incluir limpieza de versiones de logos y archivos huérfanos con retención y cuotas acumuladas. Mantener pruebas de T01/T02 como regresión y no iniciar datos reales antes de cerrar las puertas externas de T01/T07.
