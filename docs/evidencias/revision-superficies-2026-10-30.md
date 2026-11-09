# Revisión de superficies y densidad · 30-10-2026

## Alcance

Se inventariaron las 36 vistas Vue y se inspeccionaron las hojas de estilo compartidas y los componentes principales de coach, alumno, administración, acceso y registro. El patrón común era `--page` gris claro con `UiCard` blanca, borde y radio en múltiples secciones. En inicio, ficha, nutrición, progreso, antropometría y mensualidades se repetía incluso en listas y datos breves.

## Cambios

- La superficie de trabajo ahora es continua en claro y oscuro. `UiCard` dentro de la app usa separador inferior y no crea una tarjeta flotante. Se conservan campos, pestañas, avisos de estado y botones con límites reconocibles.
- Listas de alumnos, accesos de ficha, enlaces de perfil, acciones de inicio, métricas y mensualidades pasan a filas o bloques separados por línea. En móvil se mantiene entrada táctil y campos de 16 px para evitar zoom en iOS.
- Nutrición deja de fijar el bloque de guardado sobre el contenido. Sus ingredientes y edición de comidas usan secciones planas. También se aplanan las filas antropométricas y el contenedor del constructor de rutinas.
- El registro deja de aparecer como tarjeta sobre fondo gris. Se quitaron el panel decorativo largo del acceso, un botón de técnica ficticio sin guía real y textos repetidos en registro, demo de alumno, inicio real, información y mensualidades de alumnos. Las páginas públicas de información, términos y apertura de app comparten la superficie plana.
- La métrica de sesiones futuras salió del inicio del coach porque la agenda no forma parte de la navegación principal actual. El menú persistente concentra los accesos principales.

## Comprobación y límite

Se comprobaron tipos Vue tras los cambios principales, y ESLint y formato de los archivos tocados al final. Esta fue una revisión de código y estilos; no se hizo build ni se levantó navegador o servidor, de acuerdo con la indicación previa de detener builds. Por ello **no se declara aceptación visual de las 36 vistas**. Queda un recorrido visual breve en móvil real o navegador a 320/390 px cuando se vuelva a ejecutar la app, especialmente para textos largos, modo oscuro y vistas con datos reales. Las pantallas heredadas de agenda, chat, servicios y facturación siguen existiendo en rutas antiguas y requieren decisión de producto antes de retirarlas. La página legal aún describe la facturación anterior y debe revisarse antes del piloto.

## Segunda pasada de pantallas activas

- Marca: se sustituyó el teléfono ficticio con sesión y métricas inventadas por una muestra compacta del logo, nombre y color reales del formulario.
- Rutinas: los programas muestran nombre, estado, semanas y descripción solo cuando existe; se quitaron el bloque visual gigante y la revisión repetida. El constructor y las asignaciones comparten la superficie plana.
- Inicio del coach y del alumno: se retiraron atajos que repetían el menú persistente. Se conservaron solo acciones de contexto de la ficha y del día.
- Dieta, antropometría y progreso: mensajes de estado más breves, método de cálculo desplegable y métricas con tipografía y espaciado reducidos. Las advertencias clínicas y de privacidad siguen visibles donde cambian una decisión.
- Biblioteca: estados vacíos directos, sin iconos decorativos ni frases aspiracionales. Una ubicación o descripción inexistente ya no genera texto de relleno.
- Instalación: pasos cortos por plataforma; conexión y actualización quedan en detalles disponibles cuando se necesitan. Exportación conserva los controles de rango, contenido, PDF y Excel, con menos texto repetido.

La segunda pasada se verificó con Prettier, `vue-tsc --noEmit` del cliente y ESLint dirigido a los 14 componentes/vistas tocados; todos terminaron sin errores. No se ejecutó build, servidor ni prueba de navegador. El estado visual sigue pendiente de revisión en dispositivo y con contenido real. Tampoco se validaron exhaustivamente todas las combinaciones de rutas, permisos o datos en esta pasada.

## Estado del barrido visual

| Área | Código y estilos | Revisión visual posterior a estos cambios |
| --- | --- | --- |
| Coach: inicio, alumnos, rutinas, ejercicios, dieta, marca, perfil, mensualidad | Inventariados y corregidos en las pasadas de superficie y texto | Pendiente en 320/390 px con datos cortos y largos |
| Alumno: hoy, entrenar, programa, comidas, historial, progreso, documentos y perfil | Inventariados; corregidos inicio, progreso, programa y documentos | Pendiente en iOS/Android y en modo oscuro |
| Admin: coaches, cupo, pago y acceso | Inventariado; superficie y filas aplanadas | Pendiente con varios coaches y estados de pago/acceso |
| Acceso público: registro, invitación, verificación, apertura e instalación | Inventariado; textos y superficie reducidos | Pendiente con teclado móvil y estados de error |
| Rutas antiguas y legales: agenda, servicios, seguimiento, recursos, sistema, condiciones y privacidad | Identificadas; no todas forman parte de la navegación principal. Condiciones y privacidad aún necesitan revisión de contenido del modelo manual | Pendiente decidir su exposición y hacer revisión legal antes del piloto |

**No está cerrado el barrido visual.** El inventario de 36 vistas es estático; no equivale a haber recorrido y aceptado cada pantalla en un navegador. Para cerrar el trabajo visual hacen falta capturas o recorrido funcional de coach, alumno y admin con datos realistas a 320/390 px, estados vacíos y llenos, textos largos, modo oscuro y teclado móvil. No se ejecutó ese recorrido porque el usuario pidió detener el build; tampoco hay aceptación en teléfonos físicos.

## Tercera pasada puntual

La apertura de la PWA, la verificación de correo, la lista secundaria de progreso y los documentos del alumno tenían encabezados o estados vacíos decorativos. Se redujeron a título, estado y acción. Prettier, tipos Vue y ESLint de los cuatro archivos terminaron sin errores; no hubo build ni navegador.
