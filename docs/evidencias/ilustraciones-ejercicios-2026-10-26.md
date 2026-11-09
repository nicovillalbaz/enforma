# Ilustraciones de ejercicios · revisión del 26-10-2026

**Archivo histórico:** la [revisión posterior](secuencia-ejercicios-2026-10-26.md) igualó el encuadre y el grosor de trazo, eligió dos posturas por ejercicio y aceleró la secuencia. Las cifras y capturas de abajo corresponden al corte anterior.

## Entrega

- El catálogo base ahora distingue 50 ejercicios por nombre y material con ilustraciones concretas de [Workout Guide](https://github.com/bryllim/workout-guide). Cada uno tiene tres SVG locales. Los otros seis ejercicios base (incluidos cuatro anteriores a la ampliación) conservan su dibujo original o un medio propio cuando exista. No se asigna la imagen de una técnica diferente por semejanza de nombre.
- El detalle muestra automáticamente las tres posturas en un único espacio, sin botones de iniciar, pausar ni expandir. La tarjeta usa una sola postura fija. Con la preferencia de movimiento reducido se muestra la primera postura sin animación.
- Banco, barra, mancuernas, polea y máquinas tienen siluetas diferentes en las ilustraciones. La etiqueta de la tarjeta usa el material como señal útil y un color distinto por categoría, en lugar de repetir «Catálogo base». Los dibujos propios de reserva también separan cuerpo, aparato, carga y suelo por color; se añadieron variantes específicas para press en máquina e inclinado, goblet, apertura en polea, remo en máquina y curl femoral sentado.
- Los 150 SVG se sirven desde la aplicación, sin petición a la web de terceros durante el uso. El conjunto pesa 3,57 MB sin comprimir. La atribución y los cambios de color constan en [ATTRIBUTION.md](../../apps/web/public/exercise-art/ATTRIBUTION.md) y debajo de la ilustración en la ficha. Son ilustraciones de Everkinetic y Bryl Lim bajo CC BY-SA 4.0; no son pictogramas oficiales olímpicos ni una certificación técnica.

## Revisión puntual

- [Galería de ocho ejercicios y materiales](exercise-art-gallery.png) inspeccionada visualmente: barra, mancuernas, máquina, polea y prensa no comparten figura.
- Demo ficticia local: tres variantes de press a 390 px; tres fotogramas cargados por ficha, ningún control de animación, cero desbordamientos y cero errores JavaScript. [Datos de revisión](exercise-art-review.json) y [captura móvil](exercise-art-mobile.png).
- `vue-tsc` y build de Vite aprobados. Shell offline reconstruido con 239 activos públicos. No se ejecutó una suite completa ni se modificó la base de datos.

## Pendiente

Queda la aceptación visual y técnica del coach en un teléfono real. Las ilustraciones muestran posturas orientativas; las indicaciones y adaptaciones siguen siendo responsabilidad del coach. Un ejercicio personalizado sin coincidencia exacta usa el esquema original o un medio cargado por el coach.
