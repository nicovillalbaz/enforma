# Alimentos comunes y recetas editables · 26-10-2026

## Entrega local

- Migración 036 aplicada a la base de trabajo y a la demo ficticia, sin reiniciar cuentas ni reemplazar alimentos propios. Cada coach recibe 80 nombres comunes editables: carnes, pescado, huevos, legumbres, arroz y otros cereales, verduras, frutas, lácteos, grasas y condimentos. Los identificadores son distintos por organización. El mismo catálogo se inicializa al crear un nuevo coach propietario.
- **Solo se precargan nombres.** Energía, proteínas, carbohidratos y grasas quedan `null`; alérgenos no verificados; no hay gramajes, calorías, prescripciones ni porciones sugeridas. Una ficha con valores o alérgenos añadidos exige cambiar la procedencia genérica por fuente, referencia y licencia/procedencia propias, también en la API.
- 22 puntos de partida para recetas/platos, entre ellos porción de pollo, porción de arroz, pollo con arroz, salmón con quinoa, ensalada verde, mixta y rusa. La plantilla solo elige nombres de ingredientes; el coach puede añadir, quitar o cambiar ingredientes y debe completar gramos antes de guardar. Ninguna plantilla se publica ni asigna automáticamente.
- En móvil, el catálogo se busca por nombre y muestra 24 fichas por bloque; «Mostrar más» conserva acceso a todas. La edición de ingredientes usa nombres completos, controles táctiles de 44 px y una fila compacta por dato.

## Verificación dirigida

- Build, tipos, lint y formato aprobados; sin suite completa.
- Recorrido autenticado con Aurora y Brisa: 80 fichas comunes separadas para cada una, sin valores nutricionales, búsqueda de salmón, plantilla «Ensalada rusa» con cuatro ingredientes, alta/baja de ingrediente y gramos editables. A 320 y 390 px no hubo desborde.
- Intento de guardar calorías en ficha genérica sin fuente rechazado por la API con `FOOD_SOURCE_REQUIRED` y estado 400; no se guardó ningún dato de esa prueba.
- [Captura del editor móvil](ensalada-rusa-editor-2026-10-26.png). La variante de ensalada rusa es un ejemplo editable con papa, zanahoria, arvejas y mayonesa; [referencia regional](https://www.cocinar.com.py/recetas/ensalada-rusa-paraguaya).

## Límites

El catálogo no pretende abarcar todos los alimentos ni aportar datos certificados. El coach puede crear otros y editar los comunes. La base actual limita cada espacio a 200 fichas de alimento; tras 80 precargadas quedan hasta 120 altas propias si no había fichas anteriores. Ampliar este límite requiere una migración y paginación de API antes de un catálogo mucho mayor. La aceptación final en teléfonos físicos queda pendiente.
