# ADR 017 — Interfaz compacta y contenido creado por el coach

**Revisión 24-10-2026:** [ADR 018](018-ficha-y-catalogo.md) sustituye la navegación «Más», la prioridad de biblioteca propia y la solución visual de once pictogramas tras la revisión del usuario. El resto queda como historia de T15; no interpretar «aprobada» abajo como aprobación visual actual.

**Fecha:** 23-10-2026. **Estado:** decisión aprobada por la petición del usuario; implementación local en curso, revisión visual pendiente. **Versión de trabajo:** 0.15.0, esquema 024; siguiente 025.

## Usuario, problema y resultado esperado

- **Usuarios:** coach independiente que prepara sus contenidos y alumno que consulta y registra desde el teléfono; administración conserva el control mensual manual.
- **Problema observado:** las dos capturas aportadas muestran un alta de alumno en una ventana sobredimensionada y un constructor dividido en tres columnas estrechas con desplazamientos internos y una barra que tapa el formulario. Textos promocionales, iconos decorativos y opciones de coaching prefijadas añaden fricción.
- **Alternativa actual del usuario:** interrumpir el recorrido, adaptarse a las categorías impuestas o preparar el contenido fuera de la app.
- **Resultado esperado:** crear alumno → ejercicio → rutina con pantallas claras, volver sin perder el borrador durante la navegación interna y definir el vocabulario propio sin contenido deportivo atribuido a la plataforma.
- **Coste de soporte:** actualizar las expectativas visuales de pruebas antiguas, revisar teclados/instalación en teléfonos reales y mantener las instrucciones de medios. No añadir dependencias ni un proveedor de imágenes a cada visita.
- **Criterio de parada:** no incorporar otro módulo de negocio ni ampliar el catálogo visual hasta que el recorrido principal tenga revisión móvil/PC. No declarar el rediseño aceptado por compilar correctamente.

## Decisiones

1. Mantener Vue/TypeScript, PostgreSQL, API y almacenamiento existentes. Cambiar la experiencia sin cambiar de framework.
2. Reducir la escala visual: títulos de trabajo 22 px, secundarios 17 px, texto base 14 px, etiquetas 13 px. Campos de entrada a 16 px y controles táctiles a 44 px en móvil. Conservar zoom accesible y safe areas.
3. Un paso principal por pantalla. Rutinas: **Estructura → Ejercicios → Revisar** en móvil y PC. Eliminar las tres columnas con desplazamiento independiente y la barra flotante del editor.
4. Altas, edición, guías, versiones y cancelaciones se presentan dentro de la página con retorno visible. Sustituir confirmaciones e introducción de motivos de la app por páginas de revisión. Los diálogos propios del navegador al instalar, escoger un archivo o cerrar una pestaña con cambios dependen del sistema.
5. Inicio, Alumnos, Rutinas, Ejercicios y Más forman el núcleo del coach. Más conserva progreso, agenda, alimentación, chat, archivos y negocio según rol. Reducir la barra lateral no elimina estas funciones.
6. Objetivos, categorías/grupos, material y ubicaciones son texto libre. Las opciones guardadas empiezan vacías, pertenecen a un único espacio y se agregan por acción del coach. No cargar una lista de especialidades o prescripciones por defecto.
7. Conservar enumeraciones técnicas: unidad del registro, estados del acceso, fechas, días de la semana y estado de publicación. Estas describen el funcionamiento del sistema. No son objetivos o métodos deportivos.
8. En ejercicios nuevos, la unidad empieza sin seleccionar. En rutinas nuevas no precargar cargas, repeticiones, duración o RPE. Una serie vacía es estructura editable; descanso inicial 0 significa sin temporizador. Las rutinas y versiones anteriores conservan sus datos.
9. Mostrar primero la instalación en una visita móvil compatible sin instalación detectada; permitir continuar en navegador. No intentar instalar automáticamente ni prometer el aviso nativo en iOS. Modo instalado a pantalla completa mediante PWA.
10. Pictogramas SVG originales opcionales con una misma línea y dos poses. No clasificar automáticamente el ejercicio. Once identificadores iniciales no equivalen a un catálogo completo ni a una guía técnica validada. Para cualquier ejercicio, el coach dispone de nombre, instrucciones y medios propios; los vídeos permiten reproducción en bucle y controles.

## Datos y operación

- Migración aditiva `024_coach_choices.sql`: opciones propias con RLS, autoría y guardado idempotente; `visual_key` opcional y congelado en versiones publicadas nuevas.
- No copiar opciones entre coaches, sembrar vocabulario o modificar prescripciones publicadas. La biblioteca propia es el filtro inicial del coach; el catálogo de plataforma anterior permanece como consulta explícita.
- Backup incorpora un conteo adicional: **86 indicadores previstos, 70 conteos y 16 sumas**. No se realizó otra restauración en esta entrega. Validarla antes de uso real del nuevo esquema.
- Dossier individual revisado para esquema 024. El vocabulario compartido del coach no se incluye como dato exclusivo de un alumno. Un esquema posterior sigue deteniendo la exportación hasta revisar su alcance.
- Conservación de pagos manuales, cupos, suspensión y firma **Creado por NAVZ, +595972995557**.

## Fuentes de la decisión sobre instalación y medios

La documentación de [web.dev sobre el aviso de instalación](https://web.dev/learn/pwa/installation-prompt) y la [guía de instalación de MDN](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Installing) describen diferencias de soporte y la intervención del usuario. La primera pantalla propia puede ofrecer el recorrido, no forzar la instalación.

Se examinó [free-exercise-db](https://github.com/yuhonas/free-exercise-db) y su [licencia declarada](https://github.com/yuhonas/free-exercise-db/blob/main/LICENSE.md). No se importaron sus imágenes, categorías o instrucciones: una licencia de repositorio no sustituye la revisión de procedencia de cada medio ni la validación del coach. Se opta por símbolos originales y medios aportados con autorización. La referencia olímpica es de consistencia gráfica; no se copian pictogramas o marcas olímpicas.

## Evidencia y límites

Ver [plan T15](../tandas/15-redisenio-mobile-first.md), [manual](../runbooks/t15-interfaz-y-contenido.md) y [acta](../evidencias/t15-redisenio.md). El usuario pidió apagar la app y detener compilaciones durante el trabajo. Se conserva el código y se aplaza el recorrido visual; no se vuelve a arrancar para obtener capturas.
