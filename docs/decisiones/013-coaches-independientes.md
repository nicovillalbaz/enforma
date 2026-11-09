# ADR 013 — Consolidar el producto para coaches independientes

**Decisión expresa del usuario:** continuar solo con coaches independientes y reorientar T13/T14. **Versión de trabajo:** 0.13.0, migración 022. [Plan T13](../tandas/13-gimnasios.md), [T14](../tandas/14-escala-lanzamiento.md).

## Producto y compatibilidad

La plataforma sirve a muchos coaches independientes con espacios/alumnos aislados. Cada espacio nuevo tiene un coach responsable y su marca. No se desarrollan equipos, recepción, sucursales o colaboración multicoach; se conservan como [ampliación fuera del alcance](../pendientes/gimnasios-futuro.md), sin bloquear piloto o lanzamiento.

Alta pública y creación autenticada solo aceptan kind=coach. La función SQL de creación valida el mismo contrato; el constructor anterior se conserva como función interna sin ejecución por rol API. No se convierten/eliminan organizaciones históricas ni se reescriben migraciones anteriores. Roles/relaciones previos permanecen por compatibilidad y pruebas de aislamiento; no se añade administración pública de staff.

## Inicio y navegación

El owner recibe un resumen de solo lectura del estudio: marca creada, correo verificado, alumnos activos/invitados completos, rutinas publicadas distintas, asignaciones activas no finalizadas a alumnos activos y sus sesiones publicadas en los próximos siete días. La consulta devuelve agregados y fecha/zona, sin contactos, contenido de chat o datos corporales.

Solo owner activo del estudio accede por API/función; alumno, otro coach o owner de otra organización no. Se conserva respuesta privada no-store y contexto/RLS existentes. La guía usa cinco pasos derivados, sin casillas manuales o tabla de onboarding. Marca cuenta como creada al guardar nombre/color en registro; logo es opcional. Asignación futura no finalizada también cuenta y la UI lo explica. Completar guía no equivale a estar aprobado para producción.

Actualizar al abrir, botón y vuelta a pestaña visible; sin temporizador. Contadores no dependen de la primera página de alumnos. Más opciones agrupa por trabajo, acompañamiento, negocio/servicios propios y espacio, según rol; mantienen sus guardas de servidor. Se conservan cinco destinos inferiores. Un único espacio/profesional se presenta como contexto en vez de selector; más de uno conserva selección para compatibilidad/datos existentes.

## Información y firma

Componente compartido con texto exacto **Creado por NAVZ, +595972995557**. Footer dentro del flujo desplazable, firma en acceso/registro y enlace a Información desde Más opciones/sidebar. Información pública permite consultar ayuda/contacto sin acceso activo al estudio y muestra versión de producto, uso por rol y alcance offline.

El enlace del footer abre Información; solo el botón de teléfono usa tel:+595972995557. No llama/envía mensajes por sí solo. La marca del coach conserva jerarquía. Firma identifica creador; no afirma que NAVZ sea operador de datos o responsable de todas las consultas del coach. Ayuda separa pagos del alumno de cuenta SaaS y recuerda confirmación con conexión para reservas/mensajes/pagos.

## Tecnología, recursos y aceptación

Mismo Vue/Fastify/PostgreSQL, CSS/tokens e iconos existentes; sin servicios, bibliotecas, tablas de dominio o archivos privados nuevos. 022 añade funciones/guardas, no cambia los **81 indicadores previstos de backup**. No implica recuperación ensayada.

Reflujo móvil primero, tarjetas/columnas en PC, controles táctiles 44 px y textos fluidos. Sin deshabilitar zoom ni barras fijas adicionales. Solo cuatro casos nuevos de backend y un recorrido acotado de las pantallas afectadas; resultados reales en [acta](../evidencias/t13.md). No repetir suites históricas, PDF, carga o restore para esta entrega.

T14 se mantiene planificada: pruebas físicas, seguridad/operación/recuperación y piloto pequeño de coaches individuales. Pendientes de T07–T12 no desaparecen al reducir alcance.
