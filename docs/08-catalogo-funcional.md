# 08. Catálogo funcional y destino de los 33 módulos del chat

Este índice preserva la visión completa y asigna cada necesidad a una tanda. «Posterior» significa idea evaluable fuera de las 14 tandas, no compromiso oculto.

| Módulo de la conversación | Función que debe ofrecer | Entrega |
|---|---|---|
| 01 Marca blanca | Logo, colores, nombre, acceso y documentos por coach; dominios propios después de subdominios. | T02, T07, T08 |
| 02 Registro/accesos | Coach, invitación y credenciales privadas de alumno, sesión y recuperación. | T02 |
| 03 Ficha 360/CRM alumno | Datos, estado, objetivos y vista unificada de actividad con permisos. | T02, T06, T12 |
| 04 Biblioteca de ejercicios | Ejercicios globales y propios, músculos, equipamiento, filtros. | T03 |
| 05 Fotos/vídeo/GIF/máquinas | Clips propios, miniaturas, instrucciones y equipo del gimnasio. | T03 |
| 06 Constructor de rutinas | Plantillas, semanas, días, prescripciones, publicación/asignación. | T04 |
| 07 Periodización | Bloques y progresión básica; métodos complejos según pilotos. | T04; avanzada posterior |
| 08 Ejecución alumno | Series, cargas, repeticiones, tiempo, esfuerzo, descanso y notas. | T05 |
| 09 Cardio/libres | Actividad por tiempo/distancia y sesión libre. | T05–T06 tras flujo principal |
| 10 Estadísticas | Historial, volumen, frecuencia, marcas y cumplimiento. | T06 |
| 11 Medidas/fotos | Medición y foto privada con consentimiento. | T06 |
| 12 Alimentos | Catálogo con fuente y macronutrientes cuando sean fiables. | T09 |
| 13 Menús/recetas | Recetas, menú semanal versionado y asignación. | T09 |
| 14 Diario alimentario | Foto, cantidad, nota y comparación cualitativa/cuanti. | T09 |
| 15 Hábitos/bienestar | Sueño, agua, recuperación y hábitos configurables no diagnósticos. | T10 |
| 16 Formularios/check-ins | Plantillas, respuestas periódicas y revisión del coach. | T10 |
| 17 Chat | Conversación privada, adjuntos, leído/no leído y avisos internos. | T10 |
| 18 Nube privada | Carpetas, permisos y compartición con alumnos. | T08 |
| 19 PDF | Rutinas, menús e informes con marca; entrega dentro del portal. | T08–T09 |
| 20 Agenda/clases | Disponibilidad, reservas, asistencia y recordatorios. | T11 |
| 21 Servicios/cobros coach | Paquetes, vencimientos y pagos manuales del alumno. | T12 |
| 22 Automatizaciones | Reglas internas por evento con límites y registro. | T11 |
| 23 Biblioteca educativa | Material educativo privado/cursos simples. | T08; cursos completos posterior |
| 24 Comunidad/retos | Retos privados/grupos, moderación y métricas. | Posterior, tras validar demanda |
| 25 IA | Generación/recomendación automática. | Excluida por decisión del usuario |
| 26 Gimnasios/sucursales | Staff compartido, sedes y permisos de equipo. | Fuera del alcance actual; sin fecha ni dependencia de T13/T14 |
| 27 CRM comercial | Prospectos y embudo sencillo. | T12 |
| 28 Finanzas del coach | Ventas, renovaciones, deudas y reportes básicos. | T12 |
| 29 Superadmin | Organizaciones, planes, consumo, cobros y soporte auditado. | T02, T07, T14 |
| 30 Integraciones/API | API interna documentada; pagos/wearables externos según demanda. | OpenAPI T01; externas posterior |
| 31 Rendimiento/offline | PWA rápida, registro local idempotente, sincronización. | T05, T07, T14 |
| 32 Privacidad/seguridad | Consentimiento, aislamiento, auditoría, exportación/retención. | Transversal; refuerzo T14 |
| 33 Ayuda/soporte | Guías, estados de error, Información y firma NAVZ; operación de soporte. | T02, T07, T13–T14 |

La prioridad es completar recorridos enteros con estas piezas conectadas. Los extras del catálogo no adelantan T13 o T14 por sí solos; necesitan validación, diseño y una nueva tanda aprobada.

## Corte de implementación T03

Ejercicios globales/propios, material del estudio, fotos/clips privados, procesamiento asíncrono, cupos, biblioteca móvil/PC y guías explícitas por alumno conectados. [Uso T03](runbooks/t03-uso-y-operacion.md) y [acta](evidencias/t03.md). Publicar una guía no crea una rutina ni una sesión; T04 conecta las rutinas y T05 añadirá ejecución. Reproducción en teléfonos físicos pendiente, sin sustituirla por emulación.

## Corte de implementación T04

Constructor móvil/PC, borradores/plantillas, copia/archivo, snapshots inmutables, preview, asignación a varios alumnos, calendario relativo y cancelación conectados. Portal alumno por versión asignada e instrucciones/equipo/medios históricos. [Uso T04](runbooks/t04-uso-y-operacion.md), [API](runbooks/api-t04.md) y [acta](evidencias/t04.md). La planificación no acredita entrenamientos realizados; sesiones/offline/progreso siguen en T05/T06.

### Referencia anterior: T02

Marca, accesos, ficha básica, estados, planes/consumo y superadmin básico están conectados en local. Los alcances futuros indicados en la tabla siguen pendientes. El texto de privacidad y soporte inicial está implementado; las políticas y módulos completos requieren las tandas posteriores. [Estado y evidencia](evidencias/t02.md).


## Estado de sesiones al cerrar T05

Entrenamiento real en `/entrenar`, historial básico en `/historial` y resultados en ficha coach: preparación idempotente, objetivos/realizados separados, series, notas, deshacer, cierre parcial y reapertura auditada. Cola IndexedDB y shell público permiten continuidad local con revalidación de acceso; no hay sincronización con app cerrada ni descarga de vídeos privados. [Uso](runbooks/t05-uso-y-operacion.md), [ADR](decisiones/005-sesiones-y-sincronizacion.md), [QA](evidencias/t05.md). Métricas/gráficos/mediciones siguen en T06 e instalación/piloto en T07.


## Estado de seguimiento al cerrar T06

Progreso individual y cohorte del coach, frecuencia, cumplimiento, volumen semanal, marcas por ejercicio y avisos de inactividad conectados a hechos confirmados. Mediciones peso/perímetros con origen y anulación, fotos privadas opcionales con consentimiento y permisos separados/revocables. [Uso](runbooks/t06-uso-y-operacion.md), [fórmulas](decisiones/006-progreso-y-privacidad.md), [QA](evidencias/t06.md). Instalación, políticas definitivas y piloto siguen en T07.


## Estado al preparar piloto T07

Instalación por marca y cuenta mensual informativa, snapshot/prorrateo por alumno, pagos manuales/reversiones/recibos privados, resumen agregado y monitor/recuperación locales disponibles. Sin pasarela ni factura fiscal. [Uso](runbooks/t07-uso-y-operacion.md), [QA](evidencias/t07.md). Piloto con personas, instalación física, infraestructura y políticas siguen abiertos en [registro](piloto/02-registro.md). Recursos/PDF siguen en T08.


## Estado T08 local

Colecciones/ficha/programa, búsqueda/lotes, recursos/versiones, edición/movimiento/archivo, medios reutilizados, PDF en cuarentena, rutina/historial/informe y entrega privada con revocación implementados. [Uso](runbooks/t08-uso-y-operacion.md), [QA](evidencias/t08.md). Antivirus real, teléfonos, restauración y piloto pendientes. Cursos/grupos formales fuera de esta entrega; T09 sigue planificada.

## Estado T09 local

Alimentos con fuente/preparación, recetas/rendimiento, menús de siete días, alternativa, compras, publicación/versión/asignación, diario opcional con cantidad real, fotos propias y comentarios compartidos implementados en `/alimentacion`. PDF de menú con marca usa T08 sin incluir diario/fotos. No hay importación masiva, recomendación clínica, calorías obligatorias ni permiso implícito por ser coach. [Tanda T09](tandas/09-alimentacion.md), [acta](evidencias/t09.md). T10 sigue planificada.

## Corte de alcance T13

Se consolida exclusivamente coach independiente y sus alumnos. T13 entrega inicio real, navegación agrupada e Información/firma; T14 prepara piloto y operación de ese producto. La visión original de gimnasio se aplaza fuera del plan. [Decisión](decisiones/013-coaches-independientes.md).
