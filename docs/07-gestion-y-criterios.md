# 07. Gestión de tareas y definición de terminado

## Estructura del tablero

Un epic por tanda, tareas pequeñas con identificador `Txx-nn`, y estados `Backlog → Preparado → En desarrollo → Revisión → QA → Aceptado → Desplegado`. Cada tarea tiene propietario, dependencia, riesgo, contrato API/datos, pantallas, criterios de aceptación y evidencia. Si no hay gestor externo, usar un archivo Markdown por tanda y `docs/avances.md` durante la ejecución.

## Plantilla de ticket

```md
### T04-03 Publicar versión de programa
Usuario/valor: como coach, publico una rutina sin alterar asignaciones previas.
Dependencias: T04-01 y T04-02.
Datos/API: tablas afectadas, endpoint y esquema de respuesta.
UI: estados, error, vacío, móvil 320 px y escritorio.
Permisos: propietario/coach autorizado; otro tenant denegado.
Aceptación: casos Given/When/Then observables.
Pruebas: unitarias de reglas, integración DB, E2E de flujo.
Evidencia: PR, migración, captura/registro en dispositivo, demo staging.
```

## Definición de terminado por tarea

1. Caso de uso y permisos revisados; contrato y migración si corresponde.
2. Código, tipos y validaciones implementados; manejo de errores, carga y vacío.
3. Interfaz comprobada en tamaños de la [matriz móvil](04-experiencia-movil-pwa.md) si la tarea tiene pantalla.
   También cumple la [puerta de aprobación visual](11-plan-visual.md) y usa componentes/tokens compartidos.
4. Pruebas de reglas de negocio y negativas de autorización; E2E si cruza módulos.
5. Logs/auditoría/telemetría sin datos sensibles; documentación de decisión y operación actualizada.
6. Despliegue a staging, demo con datos falsos, revisión del responsable de producto y cierre de hallazgos críticos.

## Presupuesto de verificación acordado

Desde el 21-10-2026, el usuario solicita consumo reducido: un proceso de pruebas a la vez, verificaciones del cambio concreto y reutilización de evidencia previa. No ejecutar otra suite completa, carga, restauración o serie masiva de capturas solo para reafirmar un resultado ya conocido. Registrar cualquier comprobación aplazada por recursos con su alcance, resultado anterior y único siguiente paso necesario. No marcarla aprobada ni convertirla en una automatización. Este criterio no elimina los controles de permisos y reglas de negocio; permite conservar un pendiente explícito cuando la herramienta local resulta costosa.

## Puerta de salida por tanda

Revisar todas las tareas marcadas, ejecutar migración desde la versión anterior en staging, correr las verificaciones necesarias según el presupuesto acordado y pruebas manuales críticas, demostrar el flujo del entregable, registrar métricas y fallos, confirmar restauración si cambió infraestructura o datos sensibles, y anotar decisión «pasar / corregir». Una tanda incompleta permanece abierta con tareas visibles.

## Reparto sugerido de trabajo

Con 2–3 personas: (A) DB/API/seguridad, (B) panel coach/diseño, (C) experiencia alumno/PWA/E2E. Comparten contratos OpenAPI y tokens visuales. PRs pequeños y revisión cruzada en cambios de permisos, SQL y facturación. Un solo responsable integra migraciones. Si trabaja una sola persona, se conserva el mismo orden y las mismas puertas de salida.

## Informe semanal

Publicar: tanda actual, tareas cerradas, demo verificable, cambios de alcance, riesgos, decisiones, costos medidos y siguiente hito. Los indicadores del piloto están en [negocio](05-negocio-y-facturacion.md). Ninguna fecha se reporta como cierta sin capacidad y evidencia.
