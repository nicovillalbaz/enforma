# Forma — Plataforma para coaches independientes

**Estado actual (09-11-2026):** proyecto local en revisión visual. La demo y el servidor están apagados; todavía no hay despliegue público. La revisión de las rutas públicas y ficticias a 320/390 px está documentada en [el barrido visual](docs/evidencias/barrido-visual-2026-11-09.md). Las notas fechadas a continuación son hitos históricos y los enlaces a `127.0.0.1` solo funcionan cuando se inicia la demo local.

**Ideas contrastadas con proyectos abiertos:** [investigación de repositorios e issues de GitHub](docs/investigacion-github-2026-11-09.md), con decisiones y tareas priorizadas para Forma.

**Preparación de servidor de pruebas (26-10-2026):** [auditoría de código, API, base de datos, PWA y despliegue](docs/evidencias/auditoria-staging-2026-10-26.md). Los fallos locales detectados se corrigieron y verificaron; siguen pendientes el motor Docker, dominio/HTTPS, SMTP y validación en teléfonos reales. No hay despliegue público todavía.

**T17 · antropometría en prueba local (26-10-2026):** el coach ya puede registrar evaluaciones ISAK restringidas, medidas propias y datos BIA/DXA; el alumno ve las finalizadas. Historial, estimación opcional y exportación PDF/Excel verificados con datos ficticios, build y recorrido dirigido a 320/390/1366 px. [Abrir demo privada](http://127.0.0.1:4180/acceso) en este PC y consultar [cuentas ficticias](.local/manual-demo/ACCESOS.md), [guía](docs/runbooks/t17-antropometria.md) y [límites pendientes](docs/tandas/17-antropometria-y-densidad-visual.md). Las notas T16 siguientes son históricas.

**T16 · demo local lista para probar (24-10-2026):** 56 ejercicios base con 25 esquemas originales, coach y alumno recorridos con cuentas ficticias, build aprobada y demo activa solo en este PC: [Abrir acceso](http://127.0.0.1:4180/acceso). Las credenciales están en [.local/manual-demo/ACCESOS.md](.local/manual-demo/ACCESOS.md). [Acta final local](docs/evidencias/t16-catalogo-y-prueba.md) · [Guía de prueba](docs/runbooks/t14-prueba-privada.md). Falta la aceptación en teléfonos reales y de los flujos que el usuario ensaye; los estados anteriores de abajo son históricos.

**T16, segundo corte local (24-10-2026):** planes escritos por el coach, mediciones con corrección histórica, Excel/PDF privados, ficha contextual y demo compacta. Migraciones 025–031, pruebas dirigidas 14/14 y 9/9 y build aprobados; recorrido autenticado del coach revisado a 390 px. La demo quedó detenida con datos ficticios conservados. Faltan catálogo visual con licencias, recorrido completo coach/alumno y aceptación en teléfonos reales. [Evidencia y pendientes](docs/evidencias/t16-segundo-corte.md) · [Plan por tarea](docs/tandas/16-ficha-alumno-y-experiencia.md). Las notas anteriores a continuación conservan su fecha histórica.

**T16 en curso, 24-10-2026:** [primer corte de código](docs/evidencias/t16-primer-corte.md) en acceso, perfil, navegación y ficha contextual; tipos del frontend aprobados. Catálogo, alimentación sin selector de profesional, exportación XLSX y aceptación visual siguen pendientes. [Plan y estado por tarea](docs/tandas/16-ficha-alumno-y-experiencia.md). Las notas anteriores debajo son históricas.

**Nueva dirección 24-10-2026:** el usuario rechazó la experiencia visual T15 tras probarla. La [propuesta T16](docs/tandas/16-ficha-alumno-y-experiencia.md) organiza el trabajo alrededor de la ficha del alumno, navegación con regreso inmediato, perfiles útiles, alimentación escrita por el coach, ejercicios con medios licenciados y exportación directa. [Decisión](docs/decisiones/018-ficha-y-catalogo.md). Es un plan, sin código T16 ni aceptación visual. Las notas de demo y T15 de abajo son cortes históricos y no acreditan el nuevo diseño.

**Actualización 24-10-2026:** el usuario autorizó volver a probar. Demo encendida en http://127.0.0.1:4180/acceso con datos conservados; build vigente y revisión dirigida móvil/PC aprobados. [Acta y capturas](docs/evidencias/t15-revision-local.md). Aceptación del usuario y pruebas físicas pendientes. Esta actualización sustituye la pausa indicada más abajo.

**Estado:** rediseño T15 en fuentes v0.15.0, migraciones 001–024; siguiente 025. **Fecha:** 23-10-2026. App detenida por petición del usuario; revisión visual y build de los últimos ajustes pendientes. [Plan T15](docs/tandas/15-redisenio-mobile-first.md), [acta y límites](docs/evidencias/t15-redisenio.md). Solo coaches independientes, móvil y PC. Admin define precio/cupo/acceso; coach decide pago mensual y acceso de alumnos. Altas pendientes, sin prueba automática. Huellas verificadas. Piloto real sin iniciar: teléfonos, responsables, infraestructura y recuperación externa pendientes. Pruebas puntuales de bajo consumo.

## Alcance actual aprobado

Un coach independiente responsable de su espacio y sus alumnos, con su propia marca. La plataforma puede alojar múltiples coaches independientes con datos aislados. Gimnasios, sedes, recepción y equipos multicoach quedan fuera del alcance actual y no bloquean el lanzamiento. [Decisión](docs/decisiones/013-coaches-independientes.md), [ampliación aplazada](docs/pendientes/gimnasios-futuro.md).

Una aplicación web responsive/PWA para iPhone, Android y PC. Entrenamiento, seguimiento y negocio del coach están conectados; las comprobaciones en dispositivos reales siguen pendientes. No se bloquea el zoom accesible ni se promete funcionamiento offline de todos los módulos.

## Rediseño en curso

Interfaz compacta, formularios como páginas, rutinas por pasos, opciones propias del coach y bienvenida móvil de instalación. [Uso y continuidad](docs/runbooks/t15-interfaz-y-contenido.md). Once pictogramas originales opcionales; texto y medios propios permiten cualquier variante. No hay catálogo completo de animaciones instructivas ni aceptación gráfica acreditada. La demo con cuentas ficticias está apagada; sus datos se conservan. No arrancar o compilar hasta nueva indicación del usuario.

## Qué está implementado

| Entrega | Uso | Guía / evidencia |
|---|---|---|
| T01–T02 | Cuenta, marca, alumnos, invitaciones, roles internos y aislamiento | [Desarrollo](docs/runbooks/desarrollo.md), [uso T02](docs/runbooks/t02-uso-y-soporte.md), [acta](docs/evidencias/t02.md) |
| T03 | Biblioteca, ejercicios, equipos y clips/fotos privados | [Manual](docs/runbooks/t03-uso-y-operacion.md), [acta](docs/evidencias/t03.md) |
| T04 | Constructor de rutinas, versiones y asignación | [Manual](docs/runbooks/t04-uso-y-operacion.md), [acta](docs/evidencias/t04.md) |
| T05–T06 | Entrenamiento/sincronización, historial, progreso y fotos opcionales | [Sesiones](docs/runbooks/t05-uso-y-operacion.md), [progreso](docs/runbooks/t06-uso-y-operacion.md) |
| T07 | PWA y cuenta SaaS manual | [Manual](docs/runbooks/t07-uso-y-operacion.md), [acta histórica](docs/evidencias/t07.md), [continuación funcional WebKit](docs/evidencias/t14-continuacion.md) |
| T08–T10 | Recursos/PDF, alimentación, chat y check-ins privados | [T08](docs/runbooks/t08-uso-y-operacion.md), [T09](docs/runbooks/t09-uso-y-operacion.md), [T10](docs/runbooks/t10-uso-y-operacion.md) |
| T11 | Agenda, citas/clases, reservas, asistencia y avisos internos | [Manual](docs/runbooks/t11-uso-y-operacion.md), [acta](docs/evidencias/t11.md) |
| T12 | Servicios, membresías/paquetes, cuotas/pagos, CRM y resumen por moneda | [Manual](docs/runbooks/t12-uso-y-operacion.md), [acta](docs/evidencias/t12.md) |
| T13 | Alta solo coach, inicio con avance real, Más opciones por rol, Información y firma NAVZ | [Manual](docs/runbooks/t13-uso-y-operacion.md), [API](docs/runbooks/api-t13.md), [acta/capturas](docs/evidencias/t13.md) |
| T15 en curso | Rediseño compacto, navegación sin modales, autoría y opciones propias; revisión visual pendiente | [Plan](docs/tandas/15-redisenio-mobile-first.md), [manual](docs/runbooks/t15-interfaz-y-contenido.md), [acta](docs/evidencias/t15-redisenio.md) |
| T14 local | Configuración/proxy/PWA/monitor, inventario con huellas y cuenta WebKit acotada | [Guía de salida](docs/runbooks/t14-salida-y-piloto.md), [continuación y evidencia](docs/evidencias/t14-continuacion.md), [ficha de piloto](docs/piloto/03-salida-independiente.md) |

Aplicación local: acceso en http://127.0.0.1:5173/acceso, registro en /registro y demo explícita en /demo. Inicio del coach en /, Más opciones en /mas e Información pública en /informacion. [Arranque y cuentas ficticias](docs/runbooks/desarrollo.md). No hay despliegue externo acreditado.

[Control mensual: uso y reglas](docs/runbooks/t14-control-mensual.md) · [Entrega y capturas 0.14.2](docs/evidencias/t14-control-mensual.md). Importes, cupos y habilitación se definen en el panel; no falta otra cifra fija para continuar.

## Cierre local del 23-10-2026

Dossier cifrado por alumno, inventario de revisión y preparaciones de pruebas adaptadas: [guía T14-08](docs/runbooks/t14-cierre-local.md), [evidencia](docs/evidencias/t14-cierre-local.md). Aplicación v0.14.2/023 conservada; sin migración, build o cambio visual adicional. Exportación y borrado integrales siguen pendientes de completar su alcance y política.

## Probar con cuentas ficticias

[Prueba privada local preparada](docs/runbooks/t14-prueba-privada.md): http://127.0.0.1:4180/acceso, base y archivos separados, admin/coaches/alumnos con rutinas y estados de pago/acceso. [Accesos privados de esta instalación](.local/manual-demo/ACCESOS.md), excluidos de Git. Encendido/estado/parada con `scripts/manual-demo.ps1`; sin workers por defecto. No es una URL accesible desde el teléfono.

[Opciones de alojamiento y acceso privado](docs/piloto/05-alojamiento-privado.md), investigadas el 23-10-2026; sin dominio, contratación o despliegue realizados.

## Siguiente paso

Primero cerrar la revisión de [T15](docs/tandas/15-redisenio-mobile-first.md) cuando el usuario permita ejecutar. [T14 — Estabilización y piloto independiente](docs/tandas/14-escala-lanzamiento.md) continúa con la aceptación física/externa y el piloto de 3–5 coaches. La [guía de salida](docs/runbooks/t14-salida-y-piloto.md) y la [ficha con responsables y orden](docs/piloto/03-salida-independiente.md) detallan cómo avanzar. Reutilizar evidencia y repetir solo el caso afectado. Teléfonos, HTTPS, scanner real, recuperación y condiciones definitivas conservan sus [puertas](docs/piloto/00-puertas.md); no hay lanzamiento ni piloto real aprobado.

La firma **Creado por NAVZ, +595972995557** está implementada en Información y firma compartida de footer/acceso/registro. Teléfono solo por acción del usuario. [Entrega de la firma](docs/pendientes/firma-navz.md). El contacto del creador no sustituye la identidad del operador que debe definirse antes del piloto.

## Plan y seguimiento

1. [Alcance y decisiones](docs/01-alcance-y-decisiones.md).
2. [Hoja de ruta](docs/02-hoja-de-ruta.md) y [tandas 01–15](docs/tandas/README.md).
3. [Arquitectura y datos](docs/03-arquitectura-y-datos.md), [seguridad/operación](docs/06-seguridad-operaciones.md).
4. [Experiencia móvil/PWA](docs/04-experiencia-movil-pwa.md), [plan visual](docs/11-plan-visual.md), [flujos](docs/09-flujos-y-pantallas.md).
5. [Negocio SaaS](docs/05-negocio-y-facturacion.md), [catálogo funcional](docs/08-catalogo-funcional.md), [validación comercial](docs/10-validacion-y-salida-comercial.md).
6. [Criterios de ejecución](docs/07-gestion-y-criterios.md), [avances](docs/avances.md), [protocolo](docs/piloto/01-protocolo.md) y [registro del piloto](docs/piloto/02-registro.md).

Stack existente: Vue/TypeScript/Vite, Fastify/Node, PostgreSQL/SQL y workers limitados. No IA, OTP/SMS, pasarela/cobro automático, comunidad o servicios externos nuevos. Backup: 85 indicadores previstos desde T14-07 (69 conteos/16 sumas); tres tablas de control mensual nuevas, sin archivos privados nuevos. Esto no acredita un nuevo ensayo de restauración. `release:check` prepara un inventario de salida, siempre sin aprobar el piloto.

## Antecedentes

El chat inicial se contrastó con Texto pegado.txt. [Plan maestro original](plan_maestro_superapp_coaching.md), [SQL original](esquema_inicial_coaching.sql) y [ZIP original](paquete_inicio_superapp_coaching.zip) son antecedentes; la decisión vigente independiente está en docs/. No ejecutar el SQL inicial como migración de producción. No se eliminan datos o roles históricos al reducir el alcance.
