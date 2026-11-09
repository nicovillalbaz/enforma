# 11. Plan visual: app de coaching inspirada en WaFlow

**Revisión local final T16, 24-10-2026:** [catálogo de esquemas originales](evidencias/t16-catalogo-y-prueba.md) y portal del alumno revisados con cuentas ficticias. El detalle del ejercicio no desborda a 320/390/1366 px; Hoy/Programa/Historial/Documentos del alumno no desbordan a 390 px. La animación es identificativa y respeta movimiento reducido. Queda la revisión estética del usuario y el uso en teléfonos físicos. Lo anterior debajo es historial de diseño.

**Revisión T16 24-10-2026:** acceso e instalación móvil más compactos y demo sin hero promocional. [Capturas locales y límites](evidencias/t16-segundo-corte.md): 390 px acceso/instalación, 1366 px demo, comprobación de ancho a 320 px y recorrido del coach autenticado a 390 px por Inicio, Alumnos, ficha, Rutinas, Alimentación y Exportar. Faltan rutas autenticadas a 320/1366, cuenta del alumno, teclado/zoom y dispositivos iOS/Android; ninguna captura acredita aprobación estética del usuario.

**Implementación parcial 24-10-2026:** acceso de una columna, firma bajo el formulario, mensualidad alineada, perfil con contenido, inicios compactos y acciones de ficha en [primer corte T16](evidencias/t16-primer-corte.md). CSS y tipos comprobados; aspecto real a 320/390/desktop, PWA instalada y teléfonos pendientes de revisar. La dirección y los criterios siguen en [T16](tandas/16-ficha-alumno-y-experiencia.md).

**Dirección visual nueva 24-10-2026:** [T16](tandas/16-ficha-alumno-y-experiencia.md), apartado 6, sustituye la escala y composición T15 tras dos capturas rechazadas. Acceso sin hero desproporcionado ni firma junto a contraseña; campos y botones de igual altura; perfil útil; ficha del alumno como centro; navegación directa sin «Más»; símbolos específicos con medios cuya licencia esté revisada. En móvil, una columna, 16 px en entradas, controles de al menos 44 px, safe areas y zoom accesible; en PC, densidad y ancho legible sin huecos gigantes. Pendiente de prototipo, implementación y aprobación del usuario. El resto de este documento es referencia histórica.

**Actualización 24-10-2026:** hay [capturas nuevas inspeccionadas y recorrido local](evidencias/t15-revision-local.md). Build vigente, sin desbordes en los anchos comprobados ni scroll vertical interno en el constructor. Demo reactivada; aceptación del usuario pendiente. Las menciones de apagado o ausencia de capturas del 23-10 conservan su fecha histórica.

## Dirección vigente — T15, 23-10-2026

El usuario rechazó la escala, las ventanas y el constructor de tres columnas tras probarlos. La dirección actual está en el [plan T15](tandas/15-redisenio-mobile-first.md), con [decisión](decisiones/017-redisenio-y-autoria-coach.md), [manual](runbooks/t15-interfaz-y-contenido.md) y [evidencia](evidencias/t15-redisenio.md).

- Inter para trabajo: H1 22 px, H2 17 px, cuerpo 14 px, etiquetas 13 px; campos 16 px y objetivos táctiles de 44 px en móvil.
- Un paso principal visible, anchura útil y un desplazamiento principal. Rutinas: Estructura → Ejercicios → Revisar en móvil/PC; acciones dentro del flujo.
- Altas/edición/guías como páginas con retorno; revisión de acciones dentro de página. Sin ornamentación grande o mensajes genéricos de ánimo.
- Objetivos, grupos/categorías, material y ubicaciones los define el coach; listas guardadas vacías al inicio. Conservar unidades y estados técnicos del sistema.
- Instalación al entrar desde móvil con continuación en navegador; safe areas y zoom accesible. Once SVG originales opcionales; medios propios para demostraciones, sin prescripción automática.

**Implementado en fuentes, pendiente de aceptación visual.** App apagada por petición del usuario; no hay revisión/capturas nuevas. Lo siguiente conserva la referencia inicial y no prevalece sobre T15 en tipografía, hero, ventanas o columnas del constructor.

## Referencia y plan inicial conservado

**Estado histórico:** base visual y pantallas de ejemplo implementadas en T01; ver [evidencia](evidencias/t01.md). **Prioridad:** alumno y coach en teléfono, después escritorio. Complementa [experiencia móvil](04-experiencia-movil-pwa.md), [flujos](09-flujos-y-pantallas.md) y las 14 tandas.

## 1. Referencia examinada y traducción al producto

Se revisaron `C:\Users\info\Documents\WaFlow\waflow-react\src\components\Hero.tsx`, `Navbar.tsx`, `waflow-react\src\index.css`, `waflow-wp\assets\css\style.css`, el contexto de diseño de WaFlow y el mockup `Assets\mockup_waflow_ghl_1_720_compr_edit.png`. Es una referencia de **landing y panel comercial**, así que sus recursos se adaptan al uso diario de una app de entrenamiento.

| Patrón visible en WaFlow | Uso en esta app |
|---|---|
| Fondo gris muy claro, paneles blancos y títulos azul noche | Superficie tranquila para registros, cifras y formularios; el contenido del alumno destaca antes que la decoración. |
| Azul `#2AA8FF`, cian `#19E7D0`, oro `#F3C241` | Azul/cian como acentos de marca de plataforma; oro solo para logros o hitos. Los estados de salud, error y cobro tienen colores semánticos propios. |
| Titulares Onest, cuerpo Inter/sistema, jerarquía amplia | Títulos breves y legibles, cuerpo cómodo de 16 px en móvil; números de series/cargas visibles a distancia. |
| Tarjetas de radios 10–20 px, sombra suave, bordes sutiles | Cards de sesión, ejercicio, alumno y métricas con profundidad discreta y separación clara. |
| Navegación compacta y pastillas activas | Tabs del alumno y filtros del coach; estados seleccionados reconocibles también por texto/forma. |
| Composición de panel con columna central y KPIs laterales | En escritorio: lista/contenido/detalle o contenido/asistencia. En móvil: una sola columna con acción principal. |
| Grillas que se repliegan y ancho de contenido controlado | Componentes adaptables por contenedor; no miniaturizar un dashboard de PC para teléfono. |

El efecto visual buscado es **premium, deportivo y sereno**. Las animaciones decorativas de una landing se reservan para acceso/onboarding; entrenando, la interfaz responde rápido y sin distracciones. No reutilizar el logo ni las imágenes de WaFlow para el producto fitness.

## 2. Sistema de diseño inicial

### Paleta base de la plataforma

| Token | Valor propuesto | Uso |
|---|---|---|
| `ink-950` | `#071022` | Fondo oscuro destacado, texto sobre acento luminoso |
| `ink-900` | `#0D0E1A` | Texto principal |
| `ink-600` | `#475467` | Texto secundario; contrastar sobre superficie |
| `surface-0` | `#FFFFFF` | Tarjetas, formularios, modal |
| `surface-50` | `#F8F9FA` | Secciones suaves |
| `surface-100` | `#F4F5F7` | Fondo general |
| `line` | `#D8DEE7` | Borde de campos y tarjetas |
| `accent-blue` | `#2AA8FF` | Gráfico/selección/halo, con texto azul noche |
| `accent-cyan` | `#19E7D0` | Progreso y detalle positivo, con texto azul noche |
| `accent-gold` | `#F3C241` | Logros y aviso no crítico, con texto azul noche |
| `action-blue` | `#005EA8` | Acción primaria accesible con texto blanco |

El azul de WaFlow con blanco da aprox. **2,58:1**; por ello un botón sólido `#2AA8FF` lleva texto oscuro (aprox. **7,36:1**) o se usa `#005EA8` con blanco (aprox. **6,63:1**). Verificar cada combinación real con WCAG al implementarla. El gradiente cian→azul funciona como línea, fondo decorativo o botón con texto oscuro y contraste comprobado en ambos extremos; no como superficie universal para texto blanco.

El **tema claro es predeterminado** por legibilidad exterior. Tema oscuro a entregar en T07: fondo `#071022`, superficies `#101C34`/`#16243F`, texto principal `#F7F9FC`, secundario `#C4D0DF`, bordes `#2A3A56`; acento luminoso con texto oscuro. El usuario elige claro/oscuro/sistema y la preferencia viaja con su cuenta. `error`, `success`, `warning` e `info` tienen token de fondo, borde, texto e icono en ambos temas; nunca se distinguen solo por color. La selección de color del coach se adapta por tema.

### Tipografía, ritmo y formas

- **Fuente:** Onest para títulos y cifras principales, Inter para UI y texto; autohospedarlas tras comprobar licencia. Fallback `system-ui, -apple-system, Segoe UI, sans-serif` para carga rápida.
- **Escala móvil:** título de pantalla 26–30/32 px; sección 20–22/28; tarjeta 17–18/24; cuerpo 16/24; etiqueta 14/20; microtexto solo secundario 12–13 px. Entradas numéricas ≥ 16 px para evitar zoom al enfocar en iOS.
- **Escala escritorio:** título 30–36 px; sección 22–26 px; contenido 15–16 px. La densidad aumenta por columnas y contexto visible, no reduciendo a 11 px el texto.
- **Espaciado:** base 4 px; escala 4, 8, 12, 16, 24, 32, 48. Margen exterior móvil 16 px (12 px solo a 320 con prueba), tablet 24 px, escritorio 32–40 px. Separar grupos con 24–32 px.
- **Radio:** control 10 px, card 16 px, panel grande 20 px, pill 999 px. Borde de 1 px con sombra sutil; evitar tarjetas anidadas en exceso.
- **Iconos:** una familia coherente de trazos de 20–24 px con etiquetas en navegación. Estados importantes combinan icono, texto y color.
- **Movimiento:** transiciones 120–200 ms en foco, aparición y cambio de estado; respetar `prefers-reduced-motion`. Las métricas no saltan con animación continua durante una sesión.

Los tokens se publican como variables CSS semánticas (`--surface-page`, `--surface-card`, `--text-primary`, `--brand-action`, `--focus-ring`, etc.), no como hexadecimales repetidos por pantalla. Los componentes reciben los tokens del tema y de la organización; una prueba visual automática muestra dos marcas extremas en ambos temas.

### Marca blanca del coach

La plataforma proporciona layout, tipografía, componentes y colores semánticos. Cada organización configura **logo, nombre, color primario y opcional color secundario/portada**. Esos colores afectan botones, selección, chips, gráficos de marca y pantalla de acceso; no alteran rojo de error, verde de guardado, indicadores de privacidad ni texto base. Antes de guardar, generar versiones claras/oscuras del acento y seleccionar texto con contraste suficiente. Si falla, sugerir ajuste automático visible en preview; ofrecer paletas prediseñadas. Logo dentro de caja definida con `object-fit: contain`, fondo claro/oscuro alternativo y fallback de iniciales. No usar fotos enormes como fondo detrás de formularios.

## 3. Reglas de layout por ancho y contenedor

| Contexto | Estructura | Medidas orientativas |
|---|---|---|
| 320–359 CSS px | Una columna; navegación inferior de 4–5 items con texto corto; CTA ancho completo | Padding 12–16; cards gap 12; campos/botones altura ≥ 44; ningún panel fijo más ancho que viewport. |
| 360–599 | Una columna cómoda; cards relacionadas apiladas; acciones secundarias en menú | Padding 16; gap 16; barra inferior respeta safe area. |
| 600–899 | Una o dos columnas según contenido; navegación lateral compacta si cabe | Padding 24; constructor puede dividir lista y detalle. |
| 900–1199 | Sidebar 224–240 px + área central; panel de detalle opcional | Contenido principal `minmax(0,1fr)`, tablas paginadas. |
| ≥1200 | Sidebar + área 760–900 px + rail contextual 280–320 px cuando aporte valor | Ancho general máximo aprox. 1440–1600 px; espacio libre sin estirar formularios. |

Los puntos de cambio son hipótesis de diseño, no reglas globales rígidas. Usar *container queries* para cards, métricas y constructor; media queries para el shell y navegación. Ningún bloque de app depende de `100vw` dentro de un contenedor con padding. La navegación inferior se coloca sobre `safe-area-inset-bottom`; una CTA fija deja espacio para el teclado o se vuelve parte del flujo al abrirlo.

## 4. Shell por rol

### Alumno — móvil primero

```text
┌ Marca del coach ────────── Avisos ┐
│ Hola, Ana                        │
│ [Próximo entrenamiento]          │
│ [Comenzar sesión]                │
│ Progreso breve  ·  Comidas hoy   │
│ Mensaje/check-in pendiente       │
├ Inicio Entrenar Progreso Chat Más ┤
└ zona segura del teléfono ────────┘
```

La pantalla inicial responde «¿qué hago hoy?». Entrenar es la acción visual dominante. El alumno ve solo módulos habilitados; si Chat aún no existe, su puesto se asigna a otro destino y la barra mantiene como máximo cinco. Las herramientas secundarias viven en Más y mantienen breadcrumb al abrirse.

**Sesión activa en teléfono:**

```text
┌ Volver   Día 2 / Piernas    3 de 6 ┐
│ Sentadilla en máquina             │
│ [Póster ▶ vídeo]  Ver técnica     │
│ Objetivo  4 × 10 · descanso 90 s  │
│ Última vez  55 kg × 10            │
│ Serie 2 de 4                       │
│ [ 60 kg ] [ 10 rep ] [ RPE 8 ]    │
│ [ Guardar serie ]                 │
│ ● guardada / ◌ pendiente          │
├ Entrenar  Historial  Notas ───────┤
└ safe area y teclado ──────────────┘
```

La tarjeta de serie ocupa el foco visual; el vídeo y los datos de referencia acompañan sin competir. Tras guardar, la acción siguiente y el temporizador aparecen cerca del pulgar. El indicador de sincronización dice si el dato está solo en el teléfono o en el servidor.

### Coach — teléfono y escritorio

En teléfono: encabezado con marca y búsqueda, resumen de alumnos pendientes, botón «Crear» contextual, lista de alumnos con estado/última actividad, pestañas compactas. El constructor de rutinas usa pasos claros: estructura → ejercicios → series → vista previa → publicar. En escritorio: sidebar permanente, área principal y panel derecho para detalles/actividad; filtros visibles encima de listas. El coach nunca necesita una tabla de diez columnas en móvil: cada fila se convierte en tarjeta con nombre, estado, dato clave y menú de acciones.

**Panel coach en escritorio:**

```text
┌ Sidebar 232 ┬ Contenido flexible ──────────────┬ Contexto 300 ┐
│ Marca       │ Buenos días, María               │ Hoy          │
│ Inicio      │ [Activos] [Revisar] [Sesiones]    │ Tareas       │
│ Alumnos     │ Alumnos que requieren atención    │ Mensajes     │
│ Programas   │ buscar · filtros · ordenar        │ Próximas     │
│ Ejercicios  │ lista con estado y próxima acción │ citas        │
│ Progreso    │                                  │              │
└─────────────┴──────────────────────────────────┴──────────────┘
```

El rail derecho desaparece antes que la lista se estreche; en tablet pasa bajo el contenido o a pestaña «Actividad». En móvil el sidebar se transforma en navegación corta y la lista en cards. Los filtros se abren en una hoja inferior con botón «Aplicar» visible.

### Superadministrador

Estética compatible pero más sobria: números de organizaciones, alumnos habilitados, cuentas pendientes e incidentes, con tablas y filtros. Acciones sobre facturación/roles exigen contexto y motivo. En móvil se consulta y atienden tareas simples; cierres masivos se diseñan para escritorio, pero se pueden revisar sin desbordes en teléfono.

## 5. Pantallas prioritarias: composición visual

| Pantalla | Móvil | Escritorio | Detalle de calidad |
|---|---|---|---|
| Acceso del alumno | Logo + saludo + 2 campos + CTA, sin imagen que tape teclado | Formulario de 400–440 px y panel de bienvenida de marca | Confianza y marca, errores junto a campo. |
| Hoy | Card grande de próxima sesión, avance y avisos pequeños | Card principal + rail de progreso/comidas/mensajes | Acción del día visible sin scroll inicial en teléfono común. |
| Sesión activa | Ejercicio actual, objetivo, registro real, serie siguiente, descanso; vídeo plegable | Lista de ejercicios a la izquierda, registro en centro, historial/ayuda a la derecha | Número grande, pocos toques y estado local/servidor explícito. |
| Programa coach | Pasos y cards por día; reordenar con botones | Lista semana/día + editor + vista previa | Diferenciar borrador/publicado y guardar sin pérdida. |
| Ficha alumno | Cabecera y tabs: Resumen, Rutina, Progreso, Archivos | Columna de datos y panel de actividad | Fotos/medidas tras control de permiso. |
| Progreso | 1 métrica por card, gráfico simple con texto equivalente | 2–3 cards + gráfico principal + tabla histórica | No confundir objetivo con dato ejecutado. |
| Biblioteca ejercicios | Búsqueda, filtros en sheet, cards con miniatura | Filtros laterales, grilla/lista, detalle | Reproducir vídeo solo al pedirlo. |
| Chat | Lista → conversación a pantalla completa; input sobre teclado | Lista de chats + conversación + contexto de alumno | Adjuntos privados y envío/entrega visibles. |
| Comida/menú | Día actual, comidas y foto opcional | Semana y detalle/receta | El registro rápido no obliga a macros. |
| Cobro SaaS | Resumen y detalle por alumno en cards | KPIs, tabla, cálculo y acciones | Importe/periodo/días explicables. |

## 6. Componentes que se diseñan una vez

`AppShell`, `TopBar`, `BottomNav`, `SideNav`, `PageHeader`, `PrimaryAction`, `Card`, `MetricCard`, `StatusBadge`, `SearchFilter`, `FormField`, `NumberField`, `Stepper`, `Modal`, `BottomSheet`, `Toast`, `EmptyState`, `ErrorState`, `Skeleton`, `MediaPlayer`, `ExerciseCard`, `SetRow`, `WorkoutTimeline`, `ProgressChart`, `StudentCard`, `DataList`, `BillingBreakdown`.

Cada componente tiene variantes claro/oscuro, marca por coach cuando aplique, foco visible, disabled/loading/error, tamaños de 320 px y contenido largo en español. Definir contratos en `packages/ui`: tokens, API de props, ejemplos, estados y capturas. La librería de componentes se valida en una página interna de muestras con marcas y nombres largos.

## 7. Trabajo de diseño por tanda

| Momento | Entregable visual requerido |
|---|---|
| Antes de T01 | Moodboard extraído de WaFlow, 3 exploraciones de acento, prototipo de 5 flujos clave en 320/390/1280 px, prueba con coaches/alumnos. |
| T01 | Tokens, tipografía, grids, componentes base, estados, shell y página de muestras; presupuesto visual de carga. |
| T02 | Acceso, onboarding coach/alumno, marca blanca, alumno vacío y tabla/cards; preview por marca. |
| T03 | Biblioteca, carga/estado de clip, ficha de ejercicio/máquina y reproductor. |
| T04 | Constructor por pasos móvil + editor de tres zonas escritorio, preview y publicación. |
| T05 | Sesión activa como pantalla de mayor prioridad; pruebas de mano/teclado, offline y confirmación de guardado. |
| T06 | Sistema de gráficos, métricas y ficha alumno; representación sin datos y accesibilidad textual. |
| T07 | Auditoría visual total de rutas en matriz iOS/Android/PC, iconos/manifest por marca y cierre del piloto. |
| T08–T10 | Archivos/PDF, nutrición y chat se integran en el mismo sistema de navegación/tokens. |
| T11–T14 | Agenda/negocio del coach, consolidación individual y piloto; sin gimnasios o sedes. |

## 8. Puerta de aprobación visual por pantalla

1. Diseño de 320, 390 y 1280 px y reglas de reflujo entre ellos; revisión de 768 px.
2. Estado normal, vacío, carga, error, sin conexión, permiso denegado y texto largo con logo/color de dos coaches muy distintos.
3. Input ≥ 16 px en móvil, targets cómodos, foco visible, contraste medido, 200 % texto, 400 % zoom de escritorio y `prefers-reduced-motion`.
4. Comprobación en Safari iPhone, PWA iPhone, Chrome Android y PC; sin scroll horizontal del documento ni CTA tapada por teclado/safe area.
5. Prueba con un coach y un alumno de los recorridos principales: encontrar la acción, completar sin instrucciones y explicar qué se guardó. Registrar problemas y corregirlos antes de aceptar la pantalla.

La estética se evalúa junto con legibilidad y velocidad: una pantalla bonita que hace difícil registrar una serie no está terminada.


## 9. Resultado visual implementado hasta T02

- Acceso con marca pública por slug, logo y acento propio; registro de tres pasos; invitación personal y confirmación de correo con acción explícita.
- Shell móvil con selector de estudio, accesos a plan/crear estudio, cierre de sesión y navegación inferior. PC conserva sidebar y contenido flexible.
- Inicio real con contadores del servidor y bienvenida azul noche/cian; no inventa sesiones completadas. Estados útiles para alumno sin programa y cuenta pausada/suspendida.
- Ficha en diálogo nativo con edición, preparación de enlace y cambio de estado con motivo. El formulario cerrado no permanece en el DOM.
- Marca: nombre, seis acentos, bienvenida, descripción, contacto, carga de logo normalizada y preview etiquetado como ejemplo visual.
- Plan/uso y superadmin reordenan contenido a 320 px. La tabla de intervalos tiene desplazamiento propio; el documento no lo tiene.
- Evidencias revisadas: [coach PC](evidencias/t02-coach-pc.png), [coach móvil](evidencias/t02-coach-movil.png), [registro móvil](evidencias/t02-registro-movil.png), [marca](evidencias/t02-marca-movil.png), [bienvenida del alumno](evidencias/t02-alumno-movil.png).
- QA automatizado en Chromium de PC/móvil y WebKit, tamaños 320/390/768/1280. Las pruebas verifican dos marcas con logos distintos y mantienen el zoom accesible. Teclado/safe areas en teléfonos físicos, 200 % de texto, 400 % de zoom real y sesiones con coaches/alumnos siguen como pruebas de salida del piloto.

## 10. Resultado visual T03 — 21-10-2026

- Biblioteca con cabecera clara, bloque azul noche/cian, pestañas Ejercicios/Equipos/Medios, búsqueda y filtros. Tarjetas de ancho flexible: una columna móvil y más columnas en PC; textos y acciones reordenados sin desbordar el documento.
- Póster/imagen con proporción estable y estado visible. Las listas no descargan vídeos completos. El diseño conserva tarjetas útiles cuando no hay medio o falla su carga.
- Editor de ejercicio/equipo en diálogo nativo desplazable, campos y selectores de 16 px en móvil, grupos que pasan a una columna y acciones accesibles. No hay drag obligatorio ni bloqueo del zoom.
- Reproductor integrado con controles, póster, texto paso a paso y material. La compartición al alumno es una acción separada de publicar y su resultado se anuncia.
- Mis guías usa el shell de alumno y solo presenta contenido autorizado. Medios muestra cuota/cola/estado real del procesador y acciones recuperables sin fingir éxito.
- [Biblioteca PC](evidencias/t03-biblioteca-pc.png), [biblioteca móvil](evidencias/t03-biblioteca-movil.png), [equipos](evidencias/t03-equipos-movil.png), [medios](evidencias/t03-medios-movil.png), [alumno](evidencias/t03-alumno-movil.png) y [guía](evidencias/t03-guia-movil.png). Material gráfico original de demostración, sin vídeos externos.
- Pruebas de reflujo 320/390/768/1280 en Chromium/WebKit; 21 recorridos de navegador aprobados. Reproducción privada aprobada en Chromium emulado; WebKit Windows verifica descarga autenticada/texto alternativo. Dispositivos físicos siguen pendientes: [acta](evidencias/t03.md).

## 11. Resultado visual T04 — 21-10-2026

- Programas con tarjetas de acento azul noche/cian, semanas, estado de borrador/publicación y acciones de edición/versiones/copia/archivo. Listado y asignaciones se adaptan a una columna en móvil y varias en PC.
- Constructor móvil con pasos **Estructura → Ejercicios → Revisar** y una acción por bloque. PC desde 1360 px muestra estructura, editor y revisión en tres columnas; tamaños intermedios mantienen los pasos sin comprimir formularios.
- Semanas/días y ejercicios se duplican/ordenan con botones. La tira de días tiene scroll propio; no se necesita arrastrar. Series como fieldsets con número, unidades y campos que pasan de dos a tres columnas cuando hay espacio.
- Inputs/selects de 16 px en móvil y controles de 44 px; barra de guardar/publicar por encima de navegación inferior, indicador de cambios y aviso antes de descartar. No se bloquea el zoom accesible.
- Preview y versión usan el mismo lector que el alumno. Semana/día, fechas relativas, instrucciones, material y series objetivo; el vídeo sigue siendo opcional y las instrucciones permanecen legibles. La vista declara planificación y no muestra progreso inventado.
- Diálogo de versiones/asignación con fecha, lista paginada de alumnos activos y selección múltiple; cancelación con motivo en diálogo separado.
- Evidencia: [programas PC](evidencias/t04-programas-pc.png), [constructor PC](evidencias/t04-constructor-pc.png), [constructor móvil](evidencias/t04-constructor-movil.png), [series móvil](evidencias/t04-series-movil.png), [asignar](evidencias/t04-asignar-movil.png), [alumno móvil](evidencias/t04-alumno-movil.png), [alumno PC](evidencias/t04-alumno-pc.png).
- Recorrido de ocho semanas/dos alumnos y reflujo del constructor/portal aprobado en Chromium PC/móvil y WebKit, 320–1440 px. Pruebas físicas/teclado/zoom real permanecen abiertas en el [acta](evidencias/t04.md). T05 prioriza la sesión activa a una mano y la confirmación clara del guardado.


## 12. Resultado visual T05 — 21-10-2026

- Entrenar usa una columna móvil: cabecera breve, estado local/servidor, selector horizontal de series, ejercicio actual, objetivo separado de realización y descanso. PC desde 900 px distribuye lista lateral y área de trabajo, sin comprimir campos.
- Controles numéricos/decimales de 16 px, unidades explícitas, botones de al menos 44 px y guardar por encima de navegación inferior. Se preserva el zoom accesible; el teclado y las safe areas necesitan aceptación física.
- Confirmación de guardado local antes de avanzar; carga cero distinguida de vacío. Una pérdida de espacio no borra los campos ni anuncia guardado. Descanso basado en fecha límite persistida, sin animaciones distractoras ni permisos de sonido.
- Conflicto muestra los valores del servidor y el cambio del alumno con acciones explícitas. Historial conserva la versión y enfrenta objetivos con realizados, notas y duración declarada; no inventa gráficos ni marcas personales de T06.
- Estados preparado, en curso, finalizado, parcial, pendiente, sin red, sin espacio y acceso revocado. Vídeo privado sigue siendo opcional y necesita red; las instrucciones del día están disponibles offline.
- Capturas y límites en [acta T05](evidencias/t05.md). Pruebas físicas de mano, teclado, bloqueo de pantalla, zoom y persistencia iOS/Android continúan abiertas antes del piloto.


## 13. Resultado visual T06 — 21-10-2026

- Progreso mantiene tokens de Forma y la dirección WaFlow: azul profundo/cian, superficies claras u oscuras, tipografía Onest/Inter y jerarquía breve. Navegación móvil conserva cinco destinos; Progreso agrupa seguimiento e historial.
- Móvil: métricas en una columna, filtros flexibles, pestañas de 44 px, gráficos con ancho observado y etiquetas SVG legibles, tablas equivalentes desplegables. Mediciones/fotos/privacidad priorizan su propio formulario y ocultan el resumen de entrenamiento; sin desplazamiento horizontal del documento.
- PC: tres métricas y comparación semanal a dos columnas, selector por ejercicio y marca realizada. Cohorte del coach en tarjetas con búsqueda y acceso a ficha individual. Mediciones/fotos declaran unidades, origen y permiso.
- Inputs/selects de 16 px, calendario y selector de archivo nativos; zoom accesible habilitado. Datos faltantes no se dibujan como marcas falsas; eje adaptado se declara y volumen semanal empieza en cero. Gráficos son consultables mediante tabla, sin depender del color ni del hover.
- Privacidad separa consentimiento maestro de fotos y acceso de cada profesional. Fotos privadas tienen miniatura, diálogo con cierre accesible y eliminación solo del alumno. Estados sin datos/sin permiso/error explican el siguiente paso.
- [Capturas y verificación](evidencias/t06.md), [manual](runbooks/t06-uso-y-operacion.md). Aceptación física de teléfonos, teclado, safe areas y zoom real se conserva para T07.


## 14. Resultado visual T07 — 21-10-2026

La evidencia existente se conserva y se reutiliza. Por presupuesto de recursos no se repetirán capturas de todas las pantallas en cada edición. El caso final de cuenta WebKit queda identificado en el [acta](evidencias/t07.md); su fixture prepara capturas a escala CSS y un contexto PC de densidad 1 para reducir coste.

- Cuenta con mes, estado estimado/emitido, precio de apertura y desglose por alumno. Móvil en tarjetas; PC con métricas paralelas y cuenta detallada. Los ajustes/pagos están separados del cálculo histórico y el saldo tiene prioridad visual.
- Administración mantiene el mismo panel de cuenta con formulario adicional y permisos de servidor. Comprobante como enlace privado; motivo/referencia visibles, sin presentar el registro como transferencia. Se ocultan nombres técnicos de fórmula en el recorrido del coach.
- Instalar app usa bloques breves de continuidad e instrucciones por dispositivo; actualizaciones anuncian espera y no recargan formularios. Nombre/icono por estudio, sin imágenes externas nuevas.
- Navegación móvil real con cinco destinos; marca/cuenta/instalación en Más opciones. Sidebar de escritorio admite scroll propio para no perder logout en ventanas bajas. Campos de 16 px, controles de 44 y zoom accesible; reflujo 320–1440.
- [Capturas y límites](evidencias/t07.md). Teléfonos, teclado, 200 % texto/zoom real y dos iconos instalados de marca mantienen puerta física; no se infieren desde emulación.


## 15. Resultado visual T08 — Recursos y PDF

- Tarjetas con tipo, nombre, descripción y versión; búsqueda/colección en controles nativos de 16 px. Detalle prioritario en móvil con Volver, PC desde 1180 px presenta listado y panel paralelo. Controles de 44 px y reflujo 320–1440 comprobados.
- Recursos y PDF vive en navegación secundaria; la barra principal conserva cinco destinos. Alumno ve material autorizado y acciones de apertura/descarga; gestión y concesiones quedan en staff autorizado.
- Misma tipografía, marca blanca, superficies, espaciado y temas de Forma/WaFlow. Versiones, cola/cuarentena/error y revocación se explican con texto, sin estados de éxito fingidos.
- PDF A4: portada con marca/logo, fecha de Paraguay y alumno; tablas con cabeceras repetidas, ejercicio agrupado con su tabla, pie/paginación y tipografía local. Pantalla responsive y documento imprimible tienen funciones distintas; el visor conserva ampliación nativa.
- [Acta y capturas](evidencias/t08.md), [paginación de muestra](evidencias/t08-pdf-contacto.png). No se repitieron capturas por la corrección de impresión. Teléfonos/visores físicos siguen pendientes.

## 16. Resultado visual T09 — Alimentación (22-10-2026)

- Misma dirección Forma/WaFlow: marca azul/cian, superficies y temas existentes, Onest/Inter, jerarquía breve y espacios generosos. Alimentación vive en navegación secundaria; cinco destinos móviles conservados.
- Móvil: una columna; pestañas desplazables dentro de su contenedor, editor de un día, tarjetas de comidas y formularios cortos. Selector de fecha nativo, porciones opcionales sin valor prefijado y acciones explícitas. Controles de 16 px y áreas de toque de 44 px; zoom accesible disponible.
- PC: catálogo de dos/tres columnas según espacio y seguimiento con dos tarjetas de comida desde 1180 px. Editor con campos relacionados en dos columnas y macros en cuatro, manteniendo `minmax(0,1fr)` y límites de ancho. No comprimir el formulario móvil para imitar una tabla de escritorio.
- Constructor: alimento → receta → siete días → guardar → publicar → asignar. Copia de día confirmada, alternativas por comida, versión/revisión visibles, barra de guardado por encima de navegación móvil y aviso de cambios en editor/diario/privacidad.
- Alumno: menú previsto, registro declarado, permisos y fotos separados. Alérgenos/fuentes desplegables, estados sin menú/sin permiso/datos incompletos/guardando/error. Privado no se presenta como cero, ni cantidad prevista como comida realizada.
- PDF `forma-menu-v1`: portada, un día por página en la muestra, tablas, alternativas contrastadas, compras/fuentes y pie numerado. Español/guaraní revisados; el visor conserva zoom nativo. No incluye fotos ni comentarios del diario.
- [Acta/capturas](evidencias/t09.md) y [contacto PDF](evidencias/t09-pdf-contacto.png). Dos sesiones secuenciales por correcciones concretas, un PDF; constructor conservado, capturas de datos corregidas. Teléfonos/cámara/HEIC/teclado/zoom y accesibilidad manual siguen pendientes.

## 17. Resultado visual T10 — Chat y seguimiento (22-10-2026)

- Sigue tokens Forma/WaFlow, superficies claras/oscuras y tipografía local. Chat y seguimiento se añade a Más opciones/sidebar, conservando cinco destinos principales.
- Móvil: lista o conversación con Volver, cabecera breve, pestañas flexibles Mensajes / Hábitos y check-ins / Privacidad. Compositor dentro del flujo; no añade una barra fija sobre el teclado ni bloquea zoom.
- PC desde 1100 px: listado y conversación en dos columnas con minmax(0,1fr); anchos intermedios mantienen lectura prioritaria. Se muestra una página de 40 mensajes y controles para anteriores/recientes.
- Campos de 16 px, acciones de al menos 44, texto largo con reflujo y medios limitados al ancho del panel. Vídeo inline, audio con controles y sin autoplay. Adjuntos pendientes declaran estado; el borrador se conserva ante fallo de envío.
- Hábitos muestran unidad, fechas, referencia opcional y ausencia de datos diferenciada. Formularios agrupados por tarjeta, preguntas con etiqueta, estado/ventana explícitos y revisión compartida. No se usan puntuaciones de diagnóstico ni animaciones de recompensa.
- Consentimiento propio por profesional y silenciar en Privacidad; bandeja interna con categorías y lectura. No se presenta Push como habilitado.
- [Acta y capturas](evidencias/t10.md). Reflujo de chat 320/390/768/1440 observado; teclado, safe areas, zoom real, audio/vídeo y dos teléfonos físicos siguen pendientes.

## 18. Resultado visual T11 — Agenda y reglas (22-10-2026)

- Mantiene tokens Forma/WaFlow, tipografía local, tarjetas, superficies claras/oscuras y cinco destinos móviles. Agenda se abre desde Más opciones/sidebar.
- Móvil: semana como lista de días, filtros apilados, abrir detalle con Volver. Fecha y zona visibles; la reserva se confirma con estado escrito y plazo de cancelación. Nunca se exige una cuadrícula de siete columnas en teléfono.
- PC desde 1100 px: lista y detalle en dos columnas minmax(0,1fr); disponibilidad/formulario y reglas siguen el mismo sistema. Campos relacionados pasan a dos columnas desde 640 px; reglas en tarjetas adaptables.
- Inputs/selects/textarea de 16 px, acciones de al menos 44, textos largos con reflujo y botón Volver sin partir palabras. No se bloquea zoom ni se añaden barras fijas sobre teclado.
- Preferencias agrupan categorías/silencio/límite. Reglas muestran estado/versión, vista previa y ejecuciones; avisos indican estado sin prometer Push. Cambios no guardados protegen cambio de contexto/navegación.
- [Acta y capturas](evidencias/t11.md): reflujo observado en 320/390/768/1440; permisos/horarios comprobados por casos dirigidos. iPhone/Android físicos, teclado, safe areas y zoom real siguen pendientes. Firma NAVZ documentada para una entrega posterior.

## 19. Resultado visual T12 — Servicios y pagos (22-10-2026)

- Mantiene tokens Forma/WaFlow, superficies claras/oscuras, tipografía local y cinco destinos móviles. Servicios y pagos / Mis servicios se añade a Más opciones/sidebar según rol.
- Móvil: tarjetas de servicio/venta, lista o detalle con Volver, venta en dos pasos y cuotas apiladas; formulario de movimiento en flujo normal, sin modal estrecho ni barra fija nueva.
- PC desde 1100 px: lista/detalle en dos columnas minmax(0,fr), resumen con tres monedas separadas. Servicios/prospectos pasan a dos columnas desde 640 px; formularios relacionados también. Nunca comprimir varias monedas en una cifra única.
- Inputs/selects/textarea de 16 px y acciones mínimas 44 px. Estado próximo/vigente/vencido/cancelado y saldo explícitos; precio original, cuota pendiente y motivo no dependen solo de color.
- CRM con etapas y acción próxima, conversión/borrado confirmados y notas comerciales; no tablero horizontal obligatorio en móvil. Resumen explica efectivo frente a compromiso y saldo actual. Campos de dinero aceptan decimal sin separadores de miles y no redondean.
- [Acta y capturas](evidencias/t12.md) registra anchuras y alcance observado. Teclado/safe areas/zoom y dos teléfonos físicos siguen pendientes. Firma NAVZ continúa documentada para más tarde.

## 20. T13 — Inicio y navegación del coach independiente

- Inicio con saludo, siguiente paso real, progreso de cinco tareas y tres tarjetas de contadores; tarjetas de guía en una columna móvil y acciones en columna adicional en PC. No se muestran pasos completados ficticios.
- Más opciones es una página agrupada por rol, con filas de al menos 64 px, texto descriptivo y dos columnas desde 640 px. Móvil conserva cinco destinos; no añade otra barra fija o submenú horizontal complejo.
- Un estudio muestra contexto legible y evita selector redundante; Agenda muestra coach fijo si solo hay uno. Registro elimina tipo gimnasio y explica marca propia/coach independiente.
- Firma NAVZ exacta en componente de footer/acceso/registro, legible y con objetivo táctil de 44 px. Footer flex con reflujo y separación de navegación inferior; marca del coach mantiene jerarquía.
- Información pública con guía por rol, conexión/sincronización, versión y teléfono solo por acción. Tarjetas con padding, minmax(0,1fr), temas existentes y zoom nativo conservado. [Acta y capturas](evidencias/t13.md) registra lo observado; aceptación física sigue abierta.

## 21. T14 — Conservar el diseño y preparar aceptación física

- Misma interfaz móvil primero, tarjetas/columnas en PC, cinco destinos móviles, firma NAVZ y temas. No cambia componentes, CSS, tamaños o zoom; se reutiliza la evidencia T13 de 320/390/768/1440 y sus límites. No generar otra matriz de capturas por cambios de configuración.
- La guía de salida es documentación del operador, sin panel técnico nuevo para coach/alumno. El inventario/errores de configuración no añaden pasos a su navegación.
- [Recorrido físico paso a paso](runbooks/t14-salida-y-piloto.md): teclado decimal y guardar visible, safe areas, orientación, texto al 200 %, zoom y lector de pantalla, instalación/actualización con trabajo pendiente. Dos iPhones, Android de gama baja y PC; registrar modelo/OS/red y repetir solo defectos corregidos.
- Selección/cámara nativa, HEIC, audio y visor requieren observación en teléfono; no se declara grabadora de micrófono ni aceptación física por probar un header. [Acta T14](evidencias/t14.md), [ficha de evidencia](piloto/03-salida-independiente.md).

### Continuación T14, v0.14.1

Sin cambios de componentes/CSS, navegación, firma o jerarquía. Un caso WebKit de cuenta aislado verificó owner sin formulario administrativo, ausencia de desborde a 320/1440 px, campo de mes 16 px y viewport sin bloqueo de zoom; cero errores de página. No genera nuevas capturas ni repite toda la matriz visual. [Alcance y evidencia](evidencias/t14-continuacion.md). El resultado no acredita zoom/teclado/safe areas/lector de pantalla o iPhone físico, que conservan sus puertas.

## T14-07 — Controles mensuales manuales (v0.14.2)

Admin con tarjetas de coach, mes/búsqueda y formulario de precio/cupo/acceso/motivo. Coach con tarjetas de alumnos por mes, pago y acceso escritos y acciones separadas. Cuenta propia readonly incluso suspendido; registro explica aprobación manual, sin precio público o prueba automática. Rejilla minmax(0,1fr), una columna móvil y hasta tres en PC; inputs 16 px y acciones 44 px. Sin nueva barra fija ni bloqueo de zoom; temas/tokens, cinco destinos y firma NAVZ conservados.

Un Chromium de 11,946 s, reflujo 320/1440 y captura 390, dos imágenes inspeccionadas y cero errores. [Acta/capturas](evidencias/t14-control-mensual.md), [manual](runbooks/t14-control-mensual.md). No se repite matriz histórica ni aceptación física de teclado/safe areas/zoom.
