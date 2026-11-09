# Barrido móvil · 26-10-2026

## Alcance y resultado

- Revisión estática de cliente, API, scripts y pruebas: `npm run lint`, `npm run typecheck`, `npm run format:check` y `npm run build` sin errores al cierre. Los avisos de formato previos se resolvieron; no se alteró la lógica al formatear.
- Recorrido de solo lectura con cuentas ficticias: 38 combinaciones de ruta/ancho para coach, alumna y administrador; prioridad 320 y 390 px. Sin errores de JavaScript, API ni archivos `/assets/` 404; sin desbordamiento horizontal ni vistas vacías. [Resultado JSON](mobile-route-audit-2026-10-26.json).
- Acciones críticas: Alimentación, Medidas básicas y progreso y Exportar PDF o Excel abren desde la ficha de Pausa ficticio; el archivo JavaScript de un build anterior sigue disponible durante el nuevo. Se volvió a comprobar después del último build.
- Catálogo: las 56 fichas base conservan zonas y etiquetas; Press de banca muestra la descripción; filtro Cardio devuelve cuatro tarjetas con imágenes cargadas y ancho correcto. [Captura móvil](cardio-art-mobile-2026-10-26.png).

## Correcciones surgidas del barrido

1. El filtro de grupo muscular solo ofrecía opciones creadas por el coach o ejercicios propios. Ahora incluye los grupos del catálogo que ya se cargaron y conserva esas opciones al aplicar el filtro.
2. Se eligieron pares de posturas con grosor más consistente en 14 ejercicios, especialmente cardio, peso muerto y variantes de press. La diferencia máxima de grosor medido **dentro de un mismo par** bajó de 1,80 a 0,65 en la escala de 256 px. [Mediciones de los 156 fotogramas](exercise-art-ink-audit.json) y [pares elegidos](exercise-frame-selection.json).
3. La ilustración de la tarjeta ocupa mejor el espacio disponible en móvil, sin aumentar la altura de la tarjeta.
4. Lint: tipos explícitos para filas de antropometría, excepción documentada para controles XML, y entorno del navegador declarado solo para pruebas manuales.

## Límite de esta verificación

El recorrido de navegador fue local con Chromium y datos ficticios. No sustituye una prueba manual completa en iPhone y Android ni verifica todos los posibles contenidos que un coach pueda crear. Los SVG originales aún tienen diferencias entre ejercicios; se redujeron los contrastes más notorios sin deformar las figuras.
