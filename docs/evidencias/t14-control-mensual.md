# Acta T14-07 — Control mensual manual, v0.14.2

**22-10-2026 · implementado y verificado en local.** Migración 023 aplicada; próxima 024. Solo coaches independientes. Usuario decidió precio/cupo/acceso desde admin, acceso de alumnos desde coach, todo mensual y suspensión de coach con bloqueo de alumnos. Sin procesamiento de dinero. [Guía de uso](../runbooks/t14-control-mensual.md), [ADR](../decisiones/015-control-mensual-manual.md).

## Entrega

- /admin: **Coaches y acceso**, mes/búsqueda, precio mensual fijo PYG opcional, cupo 0–5000 y acceso explícito con motivo/revisión. Marcar pago del mes es una acción separada de habilitar/suspender. Sin comprobante o emisión obligatorios.
- Altas nuevas quedan suspendidas, cupo 0 y precio sin definir, sin prueba automática. El registro lo explica y dirige a estado de acceso. El operador decide cuándo habilitar; fecha histórica de trial no controla suscripciones ya configuradas manualmente.
- /mensualidades: owner activo consulta alumnos por mes, búsqueda y páginas de 50; Pagado/Pendiente y Habilitar/Pausar separados. Invitado sin cuenta necesita invitación; aceptación/reactivación valida cupo bajo bloqueo del estudio.
- /cuenta y acceso compatible /plan: mensualidad propia de lectura, precio/cupo/acceso actuales y marca del mes. Owner suspendido puede consultarla sin recuperar entrenamiento o alumnos. Alumno/otro owner no accede.
- Cambio de mes no copia marcas o cambia acceso. Corrección conserva eventos. Revisiones e intenciones idempotentes protegen datos frente a otra sesión o respuesta perdida. La interfaz evita reutilizar la marca/revisión de un mes aún no consultado.
- Cupo no puede bajar de alumnos conservados activos, incluso con estudio suspendido. Suspender estudio conserva estados individuales/historia; restaurar solo recupera a los individualmente activos.
- Espacios anteriores conservan estados y datos hasta configuración explícita del operador. Se identifican como configuración anterior para revisar antes de piloto. Cuentas/movimientos T07/T12 conservados; no se borran tablas/historia al simplificar.
- RLS y funciones: solo operador configura y marca pago del coach; solo owner activo marca alumnos propios. Alumno, otro coach y administración sin pertenencia owner no gestionan pagos privados de alumnos. Usuario deshabilitado no lee marcas por SQL. Constructor anterior interno y escritura directa sin permisos.
- Contenido de ruta se reinicia al cambiar de organización, para no conservar listas de otro contexto. Cinco destinos inferiores, tokens, temas y firma NAVZ conservados.

## Verificaciones de consumo reducido

| Acción | Resultado observado |
|---|---|
| Cinco casos nuevos de integración | **5 aprobados, 0 fallidos** en inicial; [JSON](t14-control-pruebas.json) |
| Solo caso SQL reforzado | **1 aprobado, 4 omitidos**; control positivo de visibilidad, otra organización y usuario deshabilitado; [JSON](t14-control-sql-pruebas.json) |
| Tipos/build | vue-tsc y tsc aprobados una vez; Vite 13,38 s; shell 77 assets/78 artefactos, 134 entradas de huella |
| Migración de trabajo | 023 aplicada tras prueba en DB aislada; anteriores 001–022 sin reescribir |
| Inventario final | Siete manifiestos/lock, 23 checksums aplicados, rol API, build y huellas aprobados; [JSON](t14-control-preparacion.json). Global needs-attention por HTTP local, correctamente |
| Revisión visual/funcional | **11.946 ms**, un Chromium/una página, dos capturas, cero errores, cero PDFs; [JSON](t14-control-visual.json) |
| Lint/enlaces | Dirigidos a cambios y guías; [cierre saneado](t14-control-cierre.json) |

Cinco casos únicos, sin presentar el filtro SQL como un caso nuevo ni reejecutar suites históricas. Incluyen alta bloqueada, aprobación/admin/configuración, repetición y revisión obsoleta, cupo en invitación, correcciones mensuales, mes siguiente independiente, acceso separado del pago, suspensión en cascada, alumno pausado que no se reactiva al restaurar estudio y límites SQL/RLS con datos realmente presentes.

## Revisión de las pantallas

El caso usa DB/storage propios y cuentas sintéticas. Admin define precio 125000/cupo 2 solo en esa fixture, habilita y marca mes. Owner marca alumno; servidor confirma pero se simula pérdida de respuesta, reintento conserva UUID y produce **un solo evento mensual**. Pausar alumno bloquea su portal; consultar otro mes no copia pago. Cuenta propia sin botones de autoaprobación; registro sin promesa de 14 días.

- Reflujo comprobado a 320/1440, captura móvil 390; campos visibles ≥16 px, acciones medidas ≥44 px. CSS fluido y zoom nativo conservados; sin nueva barra fija.
- [Admin PC](t14-control-admin-pc.png): formulario explícito de precio/cupo/acceso/motivo; continuación vertical normal para guardar.
- [Mensualidades móvil](t14-control-alumnos-movil.png): estado escrito por mes y acceso, acciones separadas y navegación inferior conservada.
- Dos imágenes inspeccionadas; no se repite captura por documentación. Temas heredan tokens existentes; no nueva matriz de temas/navegadores.
- Browser/API/preview/conexiones cerrados; DB y storage temporales eliminados mediante ruta/nombre validados. Cero mutaciones de negocio en base de trabajo; solo se aplicó esquema 023. No envíos, pagos reales o workers iniciados.

## Datos y continuidad

Nuevas tablas: manual_coach_controls, monthly_payment_marks y manual_monthly_events. Eventos append-only con actor/fecha/motivo/intención; marcas actuales revisables con historia preservada. Sin archivos privados nuevos o dependencias. Precio sin definir es distinto de cero; precio/cupo visibles son actuales, no reconstrucción histórica del mes seleccionado.

Backup añade **3 conteos + 1 suma de precios configurados**, total **85 indicadores previstos (69 conteos/16 sumas)**. La suma de precios no es ingreso/cobro. No se ejecuta backup/restore nuevo por esta entrega; la recuperación externa sigue pendiente y debe usar indicadores de la versión vigente.

No se ejecutaron suites históricas, carga, Docker, antivirus real, SMTP, PDFs o restauraciones. Los fixtures antiguos de alta/prueba/planes necesitan habilitación explícita para el contrato nuevo antes de volver a usarlos; no se afirma una pasada general verde o compatibilidad de sus expectativas antiguas de UI.

**Actualización posterior 23-10-2026:** las preparaciones de integración y navegador se adaptaron en [T14-08](t14-cierre-local.md), con dos casos puntuales aprobados. No se reejecutó la matriz histórica; el párrafo anterior conserva lo que se verificó el 22-10-2026.

## Pendientes conservados

T14-07 queda entregada en local; las tres reglas solicitadas al usuario ya están resueltas. Importes, cupos y accesos se eligen en el panel, no necesitan otra cifra fija para continuar.

Siguen pendientes operador/soporte y documentos definitivos, derechos integrales de datos, contenido permitido, teléfonos físicos/PWA/zoom/teclado/safe areas, entorno real HTTPS/SMTP/scanner/alertas/costes, una recuperación externa autorizada y piloto observado con acuerdos. [Ficha vigente](../piloto/03-salida-independiente.md), [puertas](../piloto/00-puertas.md). No hay lanzamiento ni coaches reales incorporados.
