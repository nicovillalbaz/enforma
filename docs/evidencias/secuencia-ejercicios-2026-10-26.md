# Secuencia y trazo de ejercicios · 26-10-2026

## Resultado

- Se compararon las tres posturas de cada una de las **52 series ilustradas** del catálogo. [Galería completa](exercise-art-contact-all.png), [comparación por posturas](exercise-frame-sheet-normalized.png) y [selección registrada](exercise-frame-selection.json).
- Las tres imágenes fuente de cada serie comparten ahora un mismo encuadre, calculado a partir del espacio que ocupa el dibujo completo. Los trazos más finos se reforzaron de manera medida. Se conservó la anatomía y el aparato de la ilustración; no se introdujeron nuevas posturas.
- La ficha muestra **dos posturas elegidas** para cada ejercicio ilustrado. El ciclo automático dura **1,8 segundos**, frente a los 4,8 segundos anteriores para tres posturas. No hay botones de reproducción. Con movimiento reducido, queda una postura estática.
- Hay ilustración específica para **53 de los 56 ejercicios base**: varias fichas comparten una serie cuando representan el mismo movimiento. Sentadilla a una silla, crunch en máquina y caminata guiada no tienen una imagen fiel en esta colección y muestran un estado neutro. Ningún ejercicio base alterna ya dibujos de palitos. Los símbolos seleccionados por un coach para ejercicios propios permanecen estáticos.
- La precarga sin conexión incluye solo las dos posturas elegidas: **194 activos públicos** en total, frente a 239 de la entrega anterior. Las ilustraciones conservan [créditos y licencia](../../apps/web/public/exercise-art/ATTRIBUTION.md).

## Comprobación puntual

- `vue-tsc` y build de Vite completados.
- Tres variantes de press en la demo local a 390 px: dos imágenes cargadas por ficha, duración CSS de 1,8 s, cero controles de animación, cero desbordamientos y cero errores de página. [Resultado](exercise-art-review.json) y [captura](exercise-art-mobile.png).
- No se corrió una suite completa ni se modificaron datos de negocio.
