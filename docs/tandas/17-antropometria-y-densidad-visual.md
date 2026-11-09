# T17 — Antropometría verificable y pantallas compactas

**Estado 26-10-2026:** cortes A–E implementados en alcance local reducido y verificados puntualmente. La captura ISAK restringida, las modalidades libres/BIA/DXA, el cálculo opcional, el historial y la exportación están disponibles en la demo privada. [Evidencia de esta entrega](../evidencias/t17-antropometria-local.md) · [guía de uso](../runbooks/t17-antropometria.md). **T17 sigue abierta** por perfil ISAK completo de 43 dimensiones, revisión profesional del protocolo, adjuntos de informes y aceptación física iOS/Android. El [primer corte de interfaz](../evidencias/t17-primer-corte.md) queda como antecedente. Alcance: coach independiente y alumno, primero móvil y luego escritorio; administración y cobro mensual manual conservados.

**Barrido previo a prueba del 26-10-2026:** revisadas las pantallas principales de coach, alumno, administración y acceso, con correcciones de densidad, navegación y tamaños. [Acta y capturas](../evidencias/ux-code-audit-2026-10-26.md). Cero desbordamientos en la comprobación focalizada a 320/390/1366 px; aceptación del usuario y teléfonos físicos siguen abiertos.

## 1. Qué se observó y cómo se resuelve

| Síntoma | Causa comprobada | Resultado exigido |
|---|---|---|
| `GET /v1/auth/me` devuelve 401 al abrir acceso público sin sesión | El guard de rutas llamaba `initialize()` antes de comprobar `meta.public` | La pantalla pública no consulta `/auth/me`. Una sesión caducada en ruta privada redirige a Acceso; el 401 de esa verificación sigue siendo una respuesta legítima de la API. |
| Dieta abierta desde ficha con invitación pendiente devuelve 403 y «No puedes consultar este menú» | La URL incluía `studentId` de una ficha `invited`; `app.nutrition_manage` permite el menú por alumno solo si `students.status='active'` | Resolver el estado de la ficha antes de pedir alimentación. Para invitado/pausado/archivado: abrir catálogo de menús, indicar el estado y volver a su ficha; nunca consultar su menú ni cambiar silenciosamente a otro alumno. La API conserva el 403 frente a accesos directos no permitidos. |
| Texto y espacios excesivos; renglón de fechas y botón desalineados | Títulos promocionales, flex sin un riel común y botón de opciones sin estilo | Densidad funcional, rieles iguales, objetivo táctil ≥44 px, inputs ≥16 px en móvil, sin desbordes a 320/390/1366 px. |
| «Mediciones» solo acepta peso/altura/perímetros y muestra una gráfica aislada | El modelo actual guarda valores independientes, sin sesión, sitio anatómico, instrumento, réplicas ni método de cálculo | Nueva evaluación antropométrica versionada. El registro básico previo permanece como histórico y se etiqueta como «Medidas básicas». |
| Mensajes, títulos o información duplicados en ficha | Secciones colapsables que repiten encabezado y copys | Una etiqueta por acción, estados y consecuencias cerca del control; ninguna línea decorativa. |

## 2. Decisión científica de producto

**ISAK es un protocolo de medición, no una ecuación única de porcentaje graso.** Su nivel 1 evalúa 4 medidas básicas, 8 pliegues, 6 perímetros y 3 diámetros; el nivel 2 añade más perímetros, longitudes y diámetros. El sitio, la técnica, la capacitación y el error técnico de medición importan. Fuente oficial: [esquema de acreditación ISAK](https://www.isak.global/FormationSystem/AccreditationScheme).

La primera salida calculada de la app será el **valor bruto por sitio y la suma de pliegues definidos**, con fecha y protocolo; es útil para observar la evolución de una misma persona cuando la técnica es comparable. Como referencia de los ocho sitios habituales en estudios ISAK: bíceps, tríceps, subescapular, cresta ilíaca/suprailiaco, supraespinal, abdominal, muslo anterior y pantorrilla medial. No deben confundirse nombres de sitios que parecen equivalentes. Fuente: [estudio original de perfiles ISAK](https://pmc.ncbi.nlm.nih.gov/articles/PMC10975034/).

El **% de grasa solo podrá aparecer como «estimación»** después de elegir una ecuación publicada, verificar sus coeficientes en la fuente original, reunir exactamente los sitios y variables requeridos, identificar su población de validación y mostrar el método/versiones en pantalla y exportación. Durnin–Womersley usa cuatro sitios (bíceps, tríceps, subescapular y suprailiaco), suma en milímetros y `log10` para estimar densidad corporal con coeficientes por edad y sexo de la población investigada. La conversión habitual de densidad a estimación porcentual con el modelo bicompartimental de Siri es `%MG = 495 / densidad − 450`. La implementación no copiará coeficientes de una tabla secundaria: habrá que cotejar la tabla original y casos calculados a mano antes de activar el resultado. Fuentes originales: [Durnin y Womersley](https://www.cambridge.org/core/journals/british-journal-of-nutrition/article/body-fat-assessed-from-total-body-density-and-its-estimation-from-skinfold-thickness-measurements-on-481-men-and-women-aged-from-16-to-72-years/DAC8BA25856FCEB30E22F60E0AF80D07), [Siri](https://escholarship.org/uc/item/6mh9f4nf).

No prometer un «% correcto» individual. Incluso una ecuación nueva contrastada contra un modelo de cinco componentes informa límites de concordancia individuales amplios (±8,6 puntos porcentuales en su validación). No redondear, recortar a 0–100 ni presentar zonas de salud inventadas para esconder estimaciones incoherentes; revisar la entrada, ecuación y pertinencia de población. [Validación original de 2021](https://pubmed.ncbi.nlm.nih.gov/34310492/). Un método BIA o DXA aporta su propio valor y metadatos; no reemplaza ni se fusiona con el estimado por pliegues.

## 3. T17-A — Reparación inmediata de navegación y presentación

1. Ruta pública: comprobar `meta.public` antes de inicializar sesión. Con login abierto sin cookie, **cero** solicitudes `/auth/me`; en ruta privada con cookie vencida, redirección coherente a `/acceso`.
2. Alimentación desde ficha: consultar el estado de ese alumno con permiso del coach; si no es `active`, omitir `studentId` de la petición de menú, mostrar estado concreto y una acción de vuelta a ficha. Dejar la creación de menús en catálogo; la asignación queda pendiente de acceso activo. No reducir las ACL del servidor para silenciar el 403.
3. Eliminar el carácter suelto en Editar ficha, encabezados duplicados, copys de relleno y estilo nativo de «Mis opciones». El control de opciones reutilizables debe poderse usar con teclado y foco.
4. Poner Desde, Hasta y Aplicar periodo en una cuadrícula con alturas coherentes; en móvil el botón ocupa su renglón a ancho completo. Repetir la misma regla con otros pares «campo + acción», especialmente mensualidad y filtros de alumnos.
5. Hacer una auditoría de las rutas coach y alumno: anchos 320, 390, 768 y 1366 px, 200% de texto, teclado virtual, orientación, área segura, modo oscuro, carga/vacío/error. Anotar cada defecto en una lista corta con ruta, ancho, causa y corrección. Un solo barrido visual dirigido; repetir únicamente la ruta modificada.

**Aceptación:** desde una ficha invitada, Dieta no hace una llamada 403 con su ID ni muestra datos de otro alumno; en una ficha activa sí carga su menú. El 401 desaparece en acceso público sin sesión. Inputs y botón de fechas alinean en PC y se apilan sin zoom/scroll horizontal en teléfono. El regreso del aviso lleva al padre inmediato.

## 4. T17-B — Modelo de evaluación antropométrica

Crear migración **aditiva**, sin migrar automáticamente las medidas básicas a un protocolo que nunca tuvieron. Entidades propuestas:

- `anthropometry_assessments`: `organization_id`, `student_id`, `id`, `protocol_id`, `protocol_version`, `assessed_on`, `assessed_at`, `time_zone`, `assessor_user_id`, competencia/acreditación declarada (opcional), `instrument_id`/modelo/calibración declarada, notas libres, estado `draft|final|void`, revisión, motivo de corrección, fechas y autoría.
- `anthropometry_observations`: evaluación, código de sitio **versionado**, dimensión (`base`, `skinfold`, `girth`, `breadth`, `length`), lado si procede, unidad original, valores de las réplicas, valor seleccionado y regla aplicada, indicador de calidad/medida imposible, autor y tiempo. Milímetros para pliegues, centímetros para perímetros/longitudes, kilogramos para masa; conversión explícita al guardar.
- `anthropometry_methods`: identificador estable de ecuación, cita/DOI, versión de coeficientes, sitios requeridos, variables de entrada, unidades, rango poblacional validado, transformaciones y política de ausencia de datos. Las fórmulas se implementan en TypeScript compartido **y se recalculan en servidor** para evitar resultados manipulados en exportaciones.
- `anthropometry_results`: instantánea del método y de observaciones usadas, suma bruta, densidad estimada cuando aplique, porcentaje estimado cuando aplique, advertencia de pertinencia y versión del motor. Un cambio de método produce resultado nuevo; jamás reescribe el anterior.

RLS por organización y alumno, permisos de coach propietario, alumno solo lectura de resultados finalizados/compartidos. El historial de correcciones es inmutable y auditable. Consentimiento y visibilidad de composición corporal se separan de fotos, diario de alimentación y peso básico. Una ficha pausada/invitada puede tener borradores preparados por el coach si el permiso de trabajo lo autoriza, pero no se muestra al alumno antes de su activación; diseñar esta excepción en ACL de evaluación, sin ampliar la del diario nutricional. Evitar fecha de nacimiento, sexo de ecuación u otra variable sensible si solo se necesita suma bruta; solicitar variables adicionales cuando el coach opta por un método que las requiere.

**Aceptación:** crear una evaluación incompleta no fabrica resultado; otra organización no puede leerla; anular conserva originales; alumno no ve borradores; una nueva medición no modifica el valor histórico.

## 5. T17-C — Flujo de captura móvil y parámetros

1. Ficha → Mediciones muestra tarjetas compactas: **Básicas**, **Evaluaciones**, **Tendencias**. Acción primaria «Nueva evaluación»; las medidas básicas antiguas siguen disponibles y claramente diferenciadas.
2. Al crear: elegir protocolo **ISAK perfil restringido**, **ISAK perfil completo** o **Registro libre**. El coach elige lo que midió; la app no impone una rutina ni interpreta el resultado. Cada protocolo fija nombres, unidades y sitios; el libre permite agregar etiquetas propias, pero no reclama conformidad ISAK ni habilita fórmulas que exigen sitios normalizados.
3. Pantalla de captura: un sitio por vez o lista compacta, teclado numérico, réplicas 1/2 y tercera si la regla del protocolo la exige; guardar borrador y volver al punto anterior sin perder datos. Validar no negativos, valores físicamente absurdos, unidades, duplicados y fecha futura; permitir corregir con motivo. Mostrar barra de completitud real `x/y`, sin formularios o textos gigantes.
4. Resumen previo a finalizar: valor seleccionado por sitio, réplicas, instrumento, medidas faltantes, calidad y suma de pliegues. El coach confirma la finalización desde página, no modal. La app no decide automáticamente si una medición fue hecha con calidad ISAK: registra evidencia y detecta inconsistencias.
5. Gráficas: misma persona, misma suma de sitios, mismo protocolo y comparabilidad explícita. Serie temporal por sitio o suma, y al tocar un punto mostrar evaluación e instrumento. Si cambian sitios, protocolo o ecuación, se marca «no comparable» y se ofrece ver series separadas.

Antes de fijar la regla automática de réplicas, verificarla con la edición vigente del manual ISAK o con un antropometrista acreditado; el [esquema oficial](https://www.isak.global/FormationSystem/AccreditationScheme) exige precisión y error técnico, pero su página pública no define todos los umbrales operativos por sitio. Referencia abierta complementaria para prácticas de calibración: [manual NHANES de antropometría](https://www.cdc.gov/nchs/data/nhanes/nhanes_11_12/Anthropometry_Procedures_Manual.pdf); no etiquetar NHANES como ISAK.

**Aceptación:** completar y revisar 8 pliegues con 2–3 lecturas en móvil sin desplazamiento horizontal; el borrador sobrevive al regreso; ninguna casilla vacía se convierte en cero; el coach puede añadir observaciones propias sin activar cálculos incorrectos.

## 6. T17-D — Cálculo, modalidades y exportación

1. Implementar sumas con conjuntos **nombrados** de sitios (por ejemplo suma de los 8 ISAK); no sumar «los que haya» bajo un nombre fijo. Propagar unidad, medición seleccionada y fecha.
2. Registrar Durnin–Womersley como primera **estimación opcional** solo tras cotejo de la publicación original, casos de referencia y límites demográficos; obtener edad en fecha de evaluación y el parámetro de población que exige el artículo mediante dato explícito. Si falta un sitio, el parámetro o el rango validado, mostrar «no calculable» con motivo. Mostrar densidad, fórmula, método y versión en un panel de detalle.
3. Evaluar Jackson–Pollock/Ward, Carter–Heath y otras fórmulas como **métodos distintos**, cada uno con fuente primaria, sitios, población y resultado propios. Somatotipo no es porcentaje graso. Ninguna fórmula se activa porque la app tenga ocho pliegues sin confirmar compatibilidad exacta.
4. Permitir incorporar informes **DXA** y lecturas **BIA** como modalidad externa/manual con dispositivo, fecha, fuente, algoritmo reportado y documento privado cuando exista. Se grafican en líneas separadas de pliegues; diferencias entre métodos no se anuncian como cambio corporal.
5. PDF/XLSX privado por rango: tabla de sitios, réplicas seleccionadas, sumas, método de estimación y limitaciones, fecha, autor, correcciones y comparación solo de métodos iguales. En PDF evitar la afirmación «% correcto»; en XLSX conservar unidades y fuentes, proteger fórmulas de contenido libre.

**Aceptación:** cálculos unitarios contra ejemplos del artículo original y cálculo manual independiente; cambios de coeficientes/versiones no alteran informes emitidos; faltantes y población no compatible bloquean solo la estimación, no el registro; PDF y XLSX coinciden con pantalla.

## 7. Orden y avances exigidos

| Corte | Entregable | Verificación de bajo consumo | Estado |
|---|---|---|---|
| A | 401 público, navegación a Dieta de invitado, limpieza visible y riel de fechas | Build y recorrido Chromium dirigido, 390/1366 px; barrido posterior de 32 combinaciones | Corregido localmente; aceptación de uso y teléfono físico pendientes |
| B | Esquema, ACL, API de evaluación e historial | Propietario/otro coach/alumno, corrección y migraciones 033–034 en ambas bases | Hecho local; revisó borrador/final y corrección abandonada |
| C | Captura ISAK/libre y resumen responsive | Captura por sitio a 390 px; lista a 320/390/1366 px | ISAK restringido de 21 sitios y libre hechos; perfil completo de 43 pendiente |
| D | Motor de sumas y estimación documentada | Cuatro unitarias dirigidas y cálculo `Σ4=40 mm → 16,2 %` | Hecho local con Durnin–Womersley/Siri; revisión profesional pendiente |
| E | DXA/BIA, series separadas, PDF/XLSX | BIA externo, separación de series, XLSX y PDF de navegador | Disponible local; adjuntos de informes, comparación avanzada y PDF de servidor pendientes |
| F | Revisión con usuario y antropometrista, teléfono físico | Flujos reales en iOS/Android y PC | Pendiente de validación externa y aceptación del usuario |

La implementación usa una tabla de evaluaciones con observaciones y resultados JSON versionados e instantánea calculada por el servidor. Conserva correcciones mediante nuevas filas. Esta decisión reduce tablas para el alcance de un coach independiente; si se añaden varios motores de fórmulas o el perfil completo, separar catálogos versionados será una migración aditiva posterior. La señal de concordancia de réplicas es una regla conservadora de interfaz, **no un error técnico ISAK acreditado**. La opción PDF usa impresión del navegador, no un archivo emitido por el worker.

No cerrar T17 por un `typecheck` o por mostrar una cifra calculada. Ya pasó una ficha ficticia de principio a fin con permisos y exportación. La aceptación final requiere revisión de sitios/técnica/umbrales por un antropometrista acreditado, perfil completo sin inventar nombres o fórmulas, comprobación de comparabilidad longitudinal y evaluación de uso en iOS/Android físicos y PC. No hace falta una suscripción ni servidor público para completar la siguiente verificación local.
