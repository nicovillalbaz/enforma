# Guías de implementación por tandas

**Prioridad vigente 26-10-2026:** [T17 — antropometría verificable y pantallas compactas](17-antropometria-y-densidad-visual.md). Entrega local con perfil ISAK restringido, cálculo opcional, BIA/DXA, historial y exportaciones [verificada puntualmente](../evidencias/t17-antropometria-local.md). Perfil completo, validación profesional y teléfonos físicos pendientes. T16 conserva su entrega técnica pero no la aceptación visual del usuario.

**T16, cierre de desarrollo local 24-10-2026:** [catálogo original y demo lista para probar](../evidencias/t16-catalogo-y-prueba.md), con 56 ejercicios base y recorrido breve autenticado de coach y alumna. La prueba de uso del usuario y los teléfonos físicos siguen pendientes; los estados anteriores debajo son históricos.

**Estado vigente 24-10-2026:** [T16](16-ficha-alumno-y-experiencia.md) tiene un [segundo corte local](../evidencias/t16-segundo-corte.md): código y pruebas dirigidas de planes, mediciones y documentos, más recorrido autenticado del coach a 390 px. La demo quedó detenida; catálogo visual, flujo completo y aceptación física siguen abiertos. Los estados más antiguos debajo son cortes históricos.

**Avance T16 24-10-2026:** [primer corte local](../evidencias/t16-primer-corte.md) de acceso, perfil, navegación y ficha contextual; el estado «solo plan» del párrafo siguiente es histórico. T16 continúa abierta.

**Dirección vigente 24-10-2026:** [T16 — ficha del alumno y experiencia](16-ficha-alumno-y-experiencia.md) es el nuevo plan tras el rechazo visual de T15. Planificado, sin implementación ni aceptación; el corte técnico T15 que sigue abajo es histórico.

**Actualización 24-10-2026:** prueba local reanudada por el usuario. Build vigente y recorrido visual dirigido aprobados; demo encendida para su uso. [Acta](../evidencias/t15-revision-local.md). T15 sigue pendiente de aceptación del usuario y dispositivos reales.

Ejecutar en orden y registrar resultado con la [definición de terminado](../07-gestion-y-criterios.md). Cada guía contiene objetivo, dependencias, tareas secuenciales, pruebas y una demostración de salida. Los identificadores `Txx-nn` sirven para crear tickets. Las reglas de móvil, permisos, auditoría y backups de las guías comunes aplican en **todas** las tandas.

| Etapa | Tanda | Resultado |
|---|---|---|
| Cimientos | [01](01-cimientos.md) | Entornos, seguridad y recuperación |
| Cimientos | [02](02-multiempresa.md) | Marcas, acceso y planes |
| MVP | [03](03-ejercicios-medios.md) | Biblioteca y clips privados |
| MVP | [04](04-rutinas.md) | Programas versionados |
| MVP | [05](05-sesiones.md) | Registro móvil fiable |
| MVP | [06](06-progreso.md) | Historial y seguimiento |
| MVP | [07](07-piloto.md) | PWA y piloto cobrable |
| Superapp | [08](08-archivos-pdf.md) | Recursos y PDF |
| Superapp | [09](09-alimentacion.md) | Menús y diario |
| Superapp | [10](10-chat-habitos.md) | Comunicación y check-ins |
| Operación | [11](11-agenda-automatizaciones.md) | Agenda y reglas |
| Operación | [12](12-negocio-coach.md) | Servicios y pagos del coach |
| Consolidación | [13](13-gimnasios.md) | Coach independiente, inicio real, navegación, Información y NAVZ |
| Piloto | [14](14-escala-lanzamiento.md) | Estabilidad, seguridad, recuperación y piloto independiente |
| Rediseño | [15](15-redisenio-mobile-first.md) | Interfaz compacta, páginas y contenido del coach; revisión visual pendiente |
| Replanteamiento | [16](16-ficha-alumno-y-experiencia.md) | Ficha central, regreso contextual, bibliotecas útiles, alimentación del coach y exportaciones; entrega local en revisión de uso |
| Corrección y profundidad | [17](17-antropometria-y-densidad-visual.md) | Accesos y rieles corregidos; antropometría por protocolo, historial y estimaciones verificadas pendientes |

**Corte vigente 23-10-2026:** T15 en fuentes v0.15.0; 001–024 aplicadas, siguiente 025. App/build apagados por petición del usuario; revisión visual pendiente. [Acta](../evidencias/t15-redisenio.md), [manual](../runbooks/t15-interfaz-y-contenido.md). Los cortes T01–T14 siguientes son históricos.

## Corte histórico — T14 0.14.1 (ver actualización 0.14.2 al final)

V0.14.1, 001–022; siguiente 023. Preparación técnica local ampliada: [acta inicial](../evidencias/t14.md), [huellas de build y cuenta WebKit verificados](../evidencias/t14-continuacion.md), [guía de salida](../runbooks/t14-salida-y-piloto.md), [ficha de responsables/decisión](../piloto/03-salida-independiente.md). Solo coaches independientes, diseño móvil/PC conservado y pruebas dirigidas; aceptación física/externa y piloto real abiertos. Sin suites históricas o restauración nueva. Los cortes siguientes son históricos.

## Corte de ejecución — 21-10-2026

**Actualización T08:** v0.8.0 y migración 017 aplicadas. Recursos/colecciones/versiones/entrega privada y PDF con worker secuencial implementados. [Acta T08](../evidencias/t08.md), [manual](../runbooks/t08-uso-y-operacion.md): nueve casos dirigidos, dos unitarias, revisión UI/PDF en un navegador y regeneración puntual de impresión. Se conservan puertas externas y recuperación; T09 es la siguiente ampliación planificada y la siguiente migración es 018.

**Actualización T07:** v0.7.0 implementada; 23 unitarias y 73 integraciones aprobadas, evidencia de PWA/cuenta, ocho recorridos offline y restauración local. La repetición final del caso ampliado de cuenta WebKit queda pendiente por recursos, con alcance exacto en [acta T07](../evidencias/t07.md). El piloto real sigue abierto. Esta actualización sustituye el estado de QA en cierre del registro anterior. Usar pruebas dirigidas de consumo reducido según [desarrollo](../runbooks/desarrollo.md).

T01: base local verificada con puertas externas pendientes. T02: [acta local](../evidencias/t02.md). T03: biblioteca/medios y [acta](../evidencias/t03.md), con aceptación física abierta. T04: constructor/plantillas/versiones/asignaciones verificados localmente; 77 pruebas acumuladas y siete capturas, [acta T04](../evidencias/t04.md). T05: sesiones, cola local y resultados verificados localmente; 99 pruebas acumuladas y cinco capturas, [acta T05](../evidencias/t05.md). T06: progreso, mediciones y fotos privadas verificados localmente, 117 pruebas acumuladas; [acta T06](../evidencias/t06.md). T07: PWA/cuenta/operación implementadas localmente con QA en cierre y [acta](../evidencias/t07.md); piloto real pendiente en [puertas](../piloto/00-puertas.md). T08 es la siguiente ampliación técnica, sin acreditar cierre comercial de T07. Los pendientes externos deben cerrarse antes del piloto.

## Corte T09 — 22-10-2026

Base 0.9.0, migración 018 aplicada; siguiente 019. Alimentación implementada en local con [manual](../runbooks/t09-uso-y-operacion.md), [API](../runbooks/api-t09.md) y [acta](../evidencias/t09.md). T10 siguiente planificada. Nueve casos/cuatro unitarias y repeticiones individuales por ajustes; reutilizar evidencia y mantener puertas externas, sin repetir suites históricas.

## Corte T10 — 22-10-2026

Base 0.10.0, migración 019 aplicada; siguiente 020. Conversaciones privadas, medios, bandeja, hábitos y check-ins implementados en local. [Manual](../runbooks/t10-uso-y-operacion.md), [API](../runbooks/api-t10.md), [acta](../evidencias/t10.md). Once casos nuevos y tres unitarias; repeticiones por filtro, sin matriz histórica ni restauración nueva. T11 siguiente planificada; puertas físicas, scanner real, recuperación y piloto se conservan.

## Corte vigente — T11, 22-10-2026

V0.11.0, migraciones 001–020; siguiente 021. [T11](11-agenda-automatizaciones.md) implementada en local con agenda/reservas/asistencia y reglas de avisos internos. [Manual](../runbooks/t11-uso-y-operacion.md), [acta](../evidencias/t11.md). Siguiente ampliación: [T12](12-negocio-coach.md), todavía planificada. Se conservan pendientes físicos/externos y [firma NAVZ](../pendientes/firma-navz.md). Verificaciones puntuales; no repetir suites históricas.

## Corte vigente — T12, 22-10-2026

V0.12.0, migraciones 001–021; siguiente 022. [T12](12-negocio-coach.md) entrega negocio del coach separado de factura SaaS: servicios, contratos, cuotas/pagos, paquetes y CRM. [Manual](../runbooks/t12-uso-y-operacion.md), [acta](../evidencias/t12.md). Próxima [T13](13-gimnasios.md), sin implementar. Verificación dirigida; conservar puertas externas y firma NAVZ pendiente.

## Corte vigente — T13 independiente

Decisión expresa: solo coaches independientes. V0.13.0, 001–022; siguiente 023. [T13](13-gimnasios.md) reorientada y entregada localmente; [T14](14-escala-lanzamiento.md) planificada para piloto pequeño. Gimnasios no forman parte de ambas tandas. [Manual](../runbooks/t13-uso-y-operacion.md), [acta](../evidencias/t13.md), [firma implementada](../pendientes/firma-navz.md). Reutilizar evidencia y mantener puertas físicas/externas.

## Actualización vigente T14-07 — 22-10-2026

V0.14.2, 001–023 aplicadas; próxima 024. Control mensual manual de precio/cupo/acceso y marcas de alumnos/coach entregado localmente. [Uso](../runbooks/t14-control-mensual.md), [acta](../evidencias/t14-control-mensual.md). Sin prueba automática, pasarela o suspensiones por mes. Cinco casos nuevos y un filtro SQL, un navegador de 11,946 s. Puertas físicas/externas y piloto abiertos; los cortes 0.14.1 anteriores son históricos.
