# Barrido de código e interfaz · 26-10-2026

## Alcance

Revisión estática del cliente web (123 archivos fuente), rutas, componentes, estilos, textos visibles y controles. Revisión autenticada sin escrituras de negocio con cuentas ficticias de coach, alumna y administración, más acceso público. El barrido general midió 32 combinaciones de ruta/ancho; la revisión final focalizada midió 12 combinaciones a 320, 390 y 1366 px. Los recorridos no sustituyen una prueba funcional completa con personas y teléfonos reales.

## Hallazgos corregidos

| Hallazgo | Corrección |
|---|---|
| `/rutinas` desbordaba a 390 px (documento de 400 px); el título de ruta se repetía en la barra superior móvil | Título de ruta oculto solo en barra móvil; el título principal permanece. Objetivos táctiles superiores y colores de marca a 44 px. |
| Búsqueda de rutinas con recarga aislada, estados confusos y acciones solo con icono | Búsqueda automática, etiqueta de publicación coherente, singular/plural correcto y acciones Duplicar/Archivar/Eliminar con nombre. Menor separación entre filtros y tarjetas. |
| Selector de alumno en Alimentación ocupaba tres controles incluso con un alumno ya elegido | Se muestra nombre y Cambiar; la búsqueda se abre cuando hace falta. Crear plan queda junto al contexto, con ancho natural en PC. Título y huecos reducidos. |
| Historial, Marca y Progreso incluían frases decorativas que ocultaban la información útil | Encabezados directos, filtros del historial plegables y acceso visible al progreso. |
| Panel de administración con cuatro datos desiguales, mes repetido en tarjeta y controles apretados | Cuadrícula 2×2, mes único en filtro superior, botón de consulta alineado y enlace de historial compacto. |
| Inicio del alumno con opciones útiles escondidas, flechas redundantes y tarjetas muy altas | Seis accesos directos en cuadrícula móvil de dos columnas y PC de tres; Medidas y Documentos visibles, sin flechas decorativas. Fechas del programa en formato legible. |
| Antropometría y progreso básico usaban el mismo símbolo en la ficha | Símbolo de regla para antropometría; progreso conserva su propio símbolo. |

## Comprobaciones

- Build de producción y comprobación de tipos completos aprobados durante el barrido; el paquete web se regeneró tras las últimas correcciones.
- ESLint dirigido sobre los componentes modificados: aprobado. Formato aplicado solo a archivos tocados.
- Barrido general: 32 combinaciones, cero errores JavaScript, cero respuestas API de error, cero desbordamientos tras la primera corrección. Antes de ella se detectó un desbordamiento a 390 px en Rutinas.
- Comprobación focalizada del paquete: 12 combinaciones, cero errores JavaScript/API, cero desbordamientos y cero controles visibles menores de 40 px. Capturas de coach, alumna y administración a 390/1366 px en este directorio (`ux-final-*`).
- El aviso de conexión observado al bloquear service workers en el acceso público era una condición artificial de esa medición: el acceso público con service worker habilitado cargó sin alertas a 390 px.

## Límites honestos

Se revisaron los recorridos principales y la estructura del código, pero no todos los estados posibles de cada formulario. No se ejecutó la suite completa ni se tocaron datos reales. Quedan la aceptación manual del usuario, iPhone/Android físicos y las puertas científicas/externas de T17. Hay estilos y rutas heredadas ocultas de funcionalidades anteriores; eliminarlas de forma masiva requiere una tarea separada con revisión de dependencias para no romper enlaces o datos históricos.
