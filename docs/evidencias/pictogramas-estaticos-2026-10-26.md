# Pictogramas estáticos de ejercicios · 26-10-2026

**Archivo histórico:** esta entrega fue sustituida por [las ilustraciones específicas y la secuencia automática](ilustraciones-ejercicios-2026-10-26.md) tras la revisión visual del usuario.

## Cambio

- Eliminada la alternancia automática de posturas y el control «Animar/Pausar esquema».
- El detalle de ejercicio muestra dos láminas estáticas, lado a lado en móvil y PC, con etiquetas cortas que identifican las fases. La tarjeta del catálogo muestra un solo pictograma compacto.
- Las 25 familias visuales conservan una línea común: silueta oscura, aparato en color de marca y fondo claro. Se redibujaron especialmente press en banco, sentadilla, bisagra, remo, press vertical, zancada, dominada, curl, jalón, apertura, plancha, empuje de cadera y elevación de talones. Para las demás familias, la postura previa se convirtió en una silueta estática de trazo grueso y cabeza sólida.
- Barra y mancuernas tienen símbolos de material distintos cuando el nombre del ejercicio permite identificarlos. El título y el material de la ficha siguen distinguiendo las variantes que comparten familia visual.
- El texto genérico de «seguir las indicaciones del coach» se oculta en las fichas base; las instrucciones reales escritas por un coach se conservan.

Los pictogramas son originales del proyecto e identifican movimiento y material. **No son pictogramas oficiales olímpicos ni una guía biomecánica certificada.** El coach sigue definiendo técnica, carga y adaptaciones.

## Verificación puntual

- Galería visual de las 25 familias revisada en [contacto](pictogram-gallery.png).
- Coach ficticio: press de banca con barra, press con mancuernas, sentadilla con barra y dominadas a 390 y 1366 px. Dos símbolos visibles por ficha, ningún botón de animación, cero desbordamientos, errores JavaScript o respuestas API de error. [Resultado](static-symbol-review.json) y capturas `symbol-*.png`.
- `vue-tsc`, Vite y ESLint dirigido aprobados; shell offline actualizado. Sin suite completa ni cambios de base de datos.

## Pendiente de uso real

La aceptación visual y técnica del coach. Para ejercicios no cubiertos por las 25 familias, el coach puede crear su propia ficha con medio e indicaciones; el pictograma genérico no pretende ilustrar todos los ejercicios posibles. Si la precisión de una técnica concreta es esencial, se debe usar una imagen o vídeo propio del coach y revisado por él.
