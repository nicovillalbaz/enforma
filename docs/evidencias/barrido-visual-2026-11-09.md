# Barrido visual · 09-11-2026

## Alcance

Se inventariaron las 36 vistas Vue del router y se inspeccionaron sus componentes principales, navegación, estados de demostración y estilos compartidos. El recorrido de navegador cubrió 18 rutas públicas y ficticias a 320 y 390 px; los resultados y capturas están en [visual-2026-11-09](visual-2026-11-09/resultados.json). Ese recorrido inicial no registró errores de página ni desbordamiento horizontal.

## Ajustes

- Navegación del coach: retirados accesos y rótulos duplicados; las opciones activas permanecen visibles.
- Inicio real: sustituidos el saludo y los bloques decorativos por métricas y acción útiles.
- Entrenamiento y alimentación: reducidos títulos, explicaciones y metadatos repetidos. El detalle técnico de nutrición queda disponible bajo demanda.
- Demo de rutinas y ejercicios: retiradas las ilustraciones genéricas gigantes. Los ejercicios emplean la simbología existente y dos posturas cuando hay guía.
- Demo del alumno: retirada la cabecera gigante; sesión y acciones ocupan menos espacio vertical.
- Perfil ficticio: ocultados nombre y correo inexistentes, que confundían al usuario.
- Rutas sin organización: entrenamiento, historial, programas, biblioteca, documentos y exportación muestran un estado navegable.

## Pendiente para aceptación

Las 36 vistas están inventariadas, pero el recorrido visual en navegador aún no cubre todas las pantallas autenticadas de coach, alumno y administración, ni sus estados de carga, error, teclado y modo oscuro. Hace falta comprobar la experiencia en iPhone y Android físicos. Los textos de condiciones y privacidad deben revisarse frente al modelo actual de mensualidad manual antes de una publicación real. Las capturas de la demo se actualizaron después de los ajustes; no sustituyen la aceptación en dispositivos físicos.

Se hicieron comprobaciones dirigidas de formato, tipos y lint. No se ejecutó el build ni la suite completa para conservar recursos.
