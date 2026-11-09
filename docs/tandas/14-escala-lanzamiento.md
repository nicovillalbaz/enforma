# T14 — Estabilización y piloto de coaches independientes

**Actualización 24-10-2026:** [revisión local T15](../evidencias/t15-revision-local.md) disponible. Demo reactivada por el usuario, build vigente y controles dirigidos aprobados; aceptación manual/física y piloto real pendientes.

**Depende de:** T01–T13 reorientada. **Estado:** control mensual y preparación local v0.14.2/023; aceptación física/externa y piloto real abiertos. **Objetivo:** preparar un piloto pequeño con coaches independientes, validar los flujos principales y cerrar las puertas necesarias antes de incorporar datos/clientes reales. No desarrollar gimnasios, sedes o equipos multicoach.

## Actualización tras revisión del usuario — 23-10-2026

[Rediseño T15](15-redisenio-mobile-first.md) en fuentes v0.15.0, 024 aplicada, siguiente 025. Escala compacta, páginas y opciones propias del coach. La app está apagada; revisión visual/build de los últimos ajustes pendientes. T14-02 requiere ahora revisar la interfaz nueva: las capturas antiguas no acreditan su aceptación. [Acta T15](../evidencias/t15-redisenio.md). El resto de pendientes físicos/externos y piloto se mantiene.

## Entrega y trabajo restante

| Ticket | Entrega local | Pendiente para cerrar |
|---|---|---|
| T14-01 | Inventario `release:check`, versiones/checksums y [ficha](../piloto/03-salida-independiente.md) | Responsables, dominio, presupuesto y volumen reales |
| T14-02 | Flujos/visual T01–T13 reutilizados; pago/reintento/comprobante WebKit T07 verificado en caso aislado, sin cambios UI/CSS | Teléfonos/zoom/teclado, PWA/arranque frío y límites de vídeo/CacheStorage |
| T14-03 | Configuración de producción validada antes de abrir API, proxy por peer explícito y comprobaciones dirigidas | Privacidad/derechos de datos y aceptación en entorno real |
| T14-04 | Medición acotada de cinco rutas sobre fixtures, sin navegador/carga | Rendimiento en red/dispositivos de la cohorte; no hay capacidad comercial medida |
| T14-05 | SW de producción no-cache, monitor con comprobantes coach y topes/solo lectura, overlay validable | Ejecutar staging/SMTP/scanner/alertas y una recuperación externa autorizada |
| T14-08 | [Dossier cifrado e inventario por alumno](../runbooks/t14-cierre-local.md), preparaciones de pruebas adaptadas | Archivos/contexto compartido, retención/borrado integral y aceptación real |
| T14-06 | [Guía detallada de salida](../runbooks/t14-salida-y-piloto.md), ficha de decisión y soporte | Seleccionar/acordar con coaches, iniciar/observar cuatro semanas y decidir |

Resultados efectivos y límites en [acta T14 inicial](../evidencias/t14.md) y [continuación 0.14.1](../evidencias/t14-continuacion.md); [ADR](../decisiones/014-estabilizacion-y-piloto.md). La continuación añade huellas de build para cerrar la comprobación pendiente de fuentes/salidas; [uso](../runbooks/t14-continuacion-local.md). No se marca completado el piloto por terminar la preparación local.

## Política de consumo y ejecución

**Actualización de alcance:** pagos fuera de la app y control manual por período. **T14-07 entregada en local:** Pagado/Pendiente, precio/cupo/acceso desde admin y acceso de alumnos desde coach, sin pasarela. [Pasos, prioridades y reglas resueltas](../piloto/04-pendientes-y-control-manual.md). Reglas respondidas y código v0.14.2/023 verificado. [Uso](../runbooks/t14-control-mensual.md), [acta](../evidencias/t14-control-mensual.md). Próxima migración 024.

Reutilizar evidencia vigente de T01–T13. Un proceso pesado a la vez, filtros concretos y mediciones con tope explícito. No ejecutar suites históricas, carga extensa, PDF o restauraciones como rutina. Una verificación necesaria de recuperación se programa una vez en entorno aislado al preparar operación real; no se sustituye por conteos previstos ni se repite por documentación.

## T14-01 — Lista de salida y alcance

1. Revisar [avances](../avances.md), actas y [puertas](../piloto/00-puertas.md). Separar defecto de código, verificación física y decisión del responsable.
2. Registrar versión/migraciones reales, alcance de un coach por espacio, recursos disponibles y volumen esperado del piloto. No presentar volumen ficticio como capacidad comercial.
3. Priorizar bloqueos de acceso, pérdida de datos y privacidad. Mantener extras futuros fuera del lanzamiento.

## T14-02 — Recorridos esenciales y móvil

1. Registro/marca → invitar/activar alumno → publicar/asignar rutina → registrar/sincronizar sesión → consultar progreso.
2. Comprobar solo módulos adicionales incluidos en el piloto: chat, recursos, alimentación, agenda y pagos manuales, con cuentas ficticias autorizadas.
3. Completar iPhone/Safari/PWA y Android reales: teclado, safe areas, fechas/moneda, cámara/visores, orientación, texto ampliado y zoom accesible. Registrar dispositivo/pasos/incidencia; corregir y repetir únicamente el caso afectado.
4. Pago/reintento/comprobante WebKit T07 ya verificado en [caso acotado 0.14.1](../evidencias/t14-continuacion.md). Repetir solo ante cambio afectado, sin matriz histórica; teléfonos/PWA/vídeo/CacheStorage mantienen sus puertas.

## T14-03 — Seguridad y datos

1. Revisar autenticación/sesión/CSRF, IDOR/RLS y acceso por organización: coach A no lee B; alumno A no lee otro alumno ni finanzas/CRM del coach.
2. Revisar descargas/adjuntos/comprobantes/PDF y revocación de acceso. No conceder permisos de chat o fotos por gestionar agenda.
3. Aprobar finalidad/retención, exportación/borrado y política de menores con responsable. La firma NAVZ identifica creador y no sustituye identidad/contacto del operador.

## T14-04 — Rendimiento medido

1. Medir entrada y hasta cinco rutas críticas con datos representativos pequeños. Registrar tamaño, tiempos y límites del equipo; percentiles solo con muestras suficientes, sin cifras inventadas.
2. Investigar consulta/render concretos si existe lentitud; aplicar índice/paginación únicamente con evidencia y repetir esa medición.
3. Si el piloto necesita concurrencia, acordar ensayo breve con tope de actores/peticiones/duración y corte por errores. Sin estrés sostenido, particionado o servicios adicionales sin necesidad medida.

## T14-05 — Continuidad operativa

1. Configurar dominio/HTTPS, PWA, correo real y scanner real para los flujos que los necesitan; no habilitar subidas inseguras por ausencia de scanner.
2. Configurar workers/latidos/monitor, presupuesto, límites y alertas del operador. Verificar instalación/actualización sin cachear datos privados.
3. Ensayar una recuperación autorizada DB+archivos con indicadores vigentes (85 previstos desde T14-07), comprobantes y permisos, en entorno aislado. Medir RPO/RTO reales y custodiar clave/copia externa.
4. Ensayar rollback compatible y fallo puntual de worker/API si es necesario. Reservas/pagos no deben aparentar confirmación sin respuesta del servidor.
5. Mantener offline centrado en entrenamiento ya implementado. Solo ampliar ante necesidad del piloto y plan explícito.

## T14-06 — Piloto pequeño y soporte

1. Seleccionar 3–5 coaches independientes con consentimiento y responsables claros; sin contactos/envíos automáticos por el agente.
2. Completar identidad del operador, precios/límites, términos y guía de soporte/instalación. Confirmar módulos incluidos y puertas abiertas.
3. Observar hasta cuatro semanas: primera rutina, sesión completada, errores, uso, soporte y comprensión de precio. Registrar métricas reales y entrevistas.
4. Resolver bloqueos, documentar límites/costes observados y decidir mantener/corregir/ampliar. Multicoach solo se reconsidera ante demanda y nueva aprobación.

## Aceptación

Flujos acordados pasan en dispositivos reales, sin defectos críticos abiertos de acceso/pérdida de datos, aislamiento y recuperación demostrados y operación/soporte con responsable. El piloto conserva trazabilidad de versión, dispositivos y resultados. La prueba local o una guía no equivale a lanzamiento comercial aprobado.

## Base técnica recibida

T13 local v0.13.0, migraciones 001–022; próxima 023. [Manual](../runbooks/t13-uso-y-operacion.md), [acta](../evidencias/t13.md). Firma NAVZ entregada. T14-07 entrega v0.14.2 con 023 aplicada, próxima 024; ningún pendiente externo se marca completo por la reducción de alcance o el caso acotado de navegador.

## T14-08 — Cierres de código que pueden hacerse en local

**23-10-2026 · entregada con límites.** [Guía y pasos](../runbooks/t14-cierre-local.md), [acta](../evidencias/t14-cierre-local.md), [ADR 016](../decisiones/016-cierre-local-y-datos.md). Dossier estructurado cifrado y revisión de borrado por alumno, con límites/exclusiones explícitos. Preparaciones de integración y navegador adaptadas a aprobación manual, sin reejecutar matriz histórica. Dos casos puntuales aprobados. Aplicación v0.14.2/esquema 023 y diseño móvil/PC conservados; sin nuevo build/migración. No cierra P03 o recuperación: eliminación integral, archivos/contexto, plazos/condiciones y operación requieren completar su procedimiento antes de datos reales.

## T14-09 — Prueba persistente de uso y destino de alojamiento

**23-10-2026 · local disponible.** [Guía de prueba](../runbooks/t14-prueba-privada.md), [informe HTTP](../evidencias/t14-demo-privada.json), [investigación de alojamiento](../piloto/05-alojamiento-privado.md). Demo persistente en DB/storage propios, sin reset automático; cuentas con estados distintos y rutinas. API/web solo loopback, sin workers por defecto. No cambia versión, esquema de trabajo o build. Hosting/túnel/dominio siguen por elegir; ninguna contratación, exposición externa o puerta del piloto real se da por aprobada.
