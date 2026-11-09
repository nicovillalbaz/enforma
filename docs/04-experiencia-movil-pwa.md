# 04. Experiencia móvil, PWA y pruebas de pantalla

## Contrato de producto

La app debe abrirse y funcionar en Safari de iPhone, Chrome Android y sus modos instalados, con los mismos datos y flujos principales. En escritorio, el coach usa más densidad de información; en teléfono, la navegación y los formularios se reorganizan. «100 % responsive» se verificará en todas las rutas, estados vacíos, errores, modales, teclado abierto y medios, no solo en la portada.

La dirección estética, tokens, variantes de marca y layouts por rol se detallan en el [plan visual](11-plan-visual.md).

## Reglas de diseño e implementación

1. `meta viewport` con `width=device-width, initial-scale=1, viewport-fit=cover`; permitir zoom. La meta de «sin zoom raro» se resuelve con tamaños legibles, campos de al menos 16 px de texto en iOS y diseño refluido. No usar `user-scalable=no` ni `maximum-scale=1`: perjudican accesibilidad ([MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/name/viewport)).
2. Base de una columna a 320–430 CSS px, 2 columnas cuando el contenido y espacio lo justifiquen y panel amplio en escritorio. Usar Grid/Flex con `minmax(0,1fr)`, `min-width:0` en hijos y `max-width:100%` en imágenes, vídeo y tablas. Ningún ancho fijo de escritorio en móvil.
3. Navegación alumno con hasta cinco destinos prioritarios: Inicio, Entrenar, Progreso, Mensajes y Más; otras secciones dentro de Más. El coach tiene navegación compacta móvil y lateral en escritorio. Respetar áreas seguras con `env(safe-area-inset-*)` y evitar controles bajo la barra del sistema.
4. Formularios con `inputmode`, `autocomplete`, etiquetas visibles, validación junto al campo y teclado adecuado; botones de 44×44 CSS px como meta de diseño. Guardar borradores de sesión mientras se escribe.
5. Evitar `100vh` rígido en pantallas con barras dinámicas y teclado; preferir `100dvh` con fallback, scroll del contenido y control de foco. Probar modales y hojas inferiores con teclado abierto.
6. Texto ampliable hasta 200 %, reflujo equivalente a 320 CSS px y sin scroll horizontal general. Tablas complejas pueden ofrecer tarjetas o scroll local etiquetado, nunca ensanchar todo el documento. [WCAG 2.2 Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html).
7. Vídeo con póster, controles nativos, subtítulo o texto de instrucciones; no reproducir automáticamente con sonido. Fotos con miniaturas y carga diferida. GIF aceptado como carga, convertido para entrega a vídeo corto cuando proceda.
8. `manifest` por marca, iconos y `display: standalone`; service worker con shell y recursos no sensibles cacheados. La instalación en iOS y el Web Push dependen del navegador/versión; los avisos internos funcionan siempre con la app abierta. [WebKit sobre apps de inicio](https://webkit.org/blog/13878/) y [cambios de iOS 26](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/).

## Matriz obligatoria de QA

| Contexto | Anchuras / dispositivo | Flujos mínimos |
|---|---|---|
| iPhone Safari | 320, 375, 390, 430 CSS px; al menos dos iPhone reales, uno pequeño | Acceso, invitación, rutina, vídeo, serie, historial, chat/archivos cuando existan, teclado, rotación, volver atrás. |
| iPhone PWA instalada | mismos dispositivos | Apertura desde icono, navegación, sesión persistente, actualización del service worker, reconexión. |
| Android Chrome | 360, 412, 430 CSS px; al menos un teléfono de gama baja real | Igual que iPhone; instalación y consumo de datos. |
| Tablet y escritorio | 768, 1024, 1280, 1440 CSS px | Panel coach, constructor, tablas, PDF; teclado físico y foco. |
| Accesibilidad | 200 % texto, 400 % zoom en escritorio, lector de pantalla, contraste y modo oscuro si existe | Reflujo, foco, botones, etiquetas, mensajes de error. |

En todas las rutas probar: `document.documentElement.scrollWidth <= innerWidth` salvo área local con scroll intencional; sin texto cortado ni botones fuera de pantalla; no salto/zoom involuntario al enfocar inputs; sin pérdida de datos al rotar o cambiar de app. Capturar evidencias por flujo y dispositivo, no solo capturas bonitas.

## Rendimiento y offline

- Fijar en T01 presupuestos iniciales revisables: paquete JS inicial objetivo ≤ 250 KB comprimido por ruta crítica, imágenes bajo tamaño declarado, primera pantalla útil en red móvil de prueba ≤ 3 s y respuesta de registro de serie perceptible inmediata. Medir en móvil real de gama media/baja; registrar LCP, INP, CLS y transferencia. Los umbrales se ajustan con línea base del piloto.
- T05: guardar eventos de series en IndexedDB antes de enviarlos, indicar pendiente/sincronizado/error y reintentar por `client_event_id`. No confirmar «guardado en servidor» si solo existe borrador local.
- T14: resolver conflictos de edición y ampliar offline donde el beneficio justifique el coste. El almacenamiento del navegador puede perderse; exportación, respaldos y fuente de verdad siguen en servidor.
- Cachear shell y medios públicos/frecuentes con versión; no cachear respuestas privadas de otros usuarios ni servir datos de una marca al cambiar de cuenta. Al cerrar sesión, borrar datos locales sensibles.

## Criterio de aceptación transversal

### Implementación local T05

`/entrenar` reconoce una serie solo después del commit en IndexedDB y distingue pendiente local de confirmación servidor. Los campos todavía escritos requieren **Guardar serie/Guardar notas**; antes de salir se avisa si no se han persistido. La cola durable, el timer y las indicaciones sobreviven a recarga; la expulsión del almacenamiento y las interrupciones físicas siguen como pruebas de campo.

Shell offline compilado, contexto de alumno de 24 horas, caché confirmada de siete días y pendientes conservados hasta sincronizar/descartar expresamente. Los medios privados requieren red. Pruebas locales y limitaciones de WebKit Windows en [acta T05](evidencias/t05.md). Manifiesto/instalación y validación de dispositivos siguen en T07.

Una tanda con interfaz móvil solo cierra si su flujo principal pasa en iPhone Safari, iPhone PWA instalada y Android Chrome reales, además de pruebas automatizadas de 320/390/768/1280 px. El usuario puede completar el flujo sin girar el teléfono, usar zoom de página para reparar diseño ni recurrir a otra app.


## Base instalable T07

Manifest e iconos por estudio y enlace de arranque explícito; PWA preparada bajo HTTPS/localhost. Pantalla Instalar app con instrucciones y actualización en espera hasta cerrar todas las ventanas. Shell de recursos públicos; datos privados y financieros requieren conexión/autorización. [Guía](runbooks/t07-uso-y-operacion.md), [acta](evidencias/t07.md). El host compartido local no acredita dos instalaciones de marcas en teléfonos físicos; probar en orígenes de estudio de staging.


## Recursos móviles T08

/recursos usa tarjetas y detalle prioritario en móvil, lista/panel en PC, campos de 16 px y controles de 44 px. Entrada secundaria sin sexto destino inferior. Reflujo 320/390/768/1440 comprobado con un Chromium; sin matriz histórica repetida. [Acta](evidencias/t08.md).

Archivo/PDF requiere red y permiso; fuera de CacheStorage/IndexedDB. El A4 utiliza ampliación del visor; la pantalla conserva reflujo y zoom accesible. Safari/iPhone/Android físicos y descarga nativa mantienen puerta abierta.

## Alimentación móvil T09

Una columna móvil, pestañas internas, constructor por día, entradas de 16 px y controles táctiles de 44 px, sin bloquear zoom. PC amplía a catálogo/seguimiento por columnas. El alumno registra porciones opcionales y fotos solo con sus permisos; menús/diario/fotos necesitan red y no se almacenan en caché offline. El PDF imprimible no sustituye al portal adaptable. [Acta T09](evidencias/t09.md): 320/390/768/1440 px, temas, fuente ausente y revocación. Cámara/HEIC/teclado/zoom/Safari/Android físicos pendientes; no repetir toda la matriz por esta entrega.

## T13 independiente

Inicio y Más opciones mantienen móvil primero y PC, cinco destinos inferiores, tarjetas con reflujo y objetivos táctiles. Firma NAVZ en footer desplazable y ayuda pública; no impide zoom ni abre teléfono automáticamente. Selector único reemplazado por contexto. [Acta](evidencias/t13.md). T14 completa teléfonos reales, teclado/safe areas/zoom e instalación, con verificaciones puntuales y sin repetir matrices históricas por rutina.
