# Registro del piloto

**Corte vigente T14 — 22-10-2026. Estado: no iniciado con personas reales.** Coaches incorporados: **0**. Cobros/transferencias realizados por esta implementación: **0**. La base local contiene fixtures ficticios y no sirve como denominador comercial. Control mensual local v0.14.2/023; [ficha de salida pendiente](03-salida-independiente.md).

## Responsables y entorno

| Campo | Valor |
|---|---|
| Responsable de producto/piloto | Pendiente de asignación |
| Operador y soporte | Pendiente |
| Responsable de privacidad | Pendiente |
| Entorno/dominio de piloto | Pendiente; no desplegado |
| Precio y límites acordados | Hipótesis del plan; pendientes de validación |
| Fecha de inicio/cierre | Sin fijar |

## Matriz de evidencia

| Fecha | Puerta / caso | Dispositivo / versión | Resultado | Incidencia / evidencia | Responsable |
|---|---|---|---|---|---|
| 22-10-2026 | Continuación local T14 | WebKit Windows + Node/PostgreSQL aislado, v0.14.1 | Cuenta con respuesta perdida/reintento/comprobante aprobada en 27,664 s; huellas de build verificadas. Sin aceptación física o piloto | [Acta](../evidencias/t14-continuacion.md), [JSON WebKit](../evidencias/t14-webkit-cuenta.json) | Agente; operador real pendiente |
| 22-10-2026 | Preparación T14, independiente | Node/PostgreSQL local, v0.14.0 | Configuración/proxy/monitor e inventario local; sin aceptación física o piloto | [Acta T14](../evidencias/t14.md), [pasos de salida](../runbooks/t14-salida-y-piloto.md) | Agente, sin asignar operador real |
| 21-10-2026 | Cálculo/cuenta/PWA local | Windows + automatización, v0.7.0 | Base implementada; repetición final de cuenta WebKit pendiente por recursos | [Acta T07](../evidencias/t07.md), 23 unitarias y 73 integraciones aprobadas | Agente, sin aceptación física |
| 22-10-2026 | Alimentación T09 local | Chromium y PostgreSQL, v0.9.0 | Nueve casos/cuatro unitarias, ajustes dirigidos y UI/PDF; revisión profesional/física/restauración pendientes | [Acta T09](../evidencias/t09.md) | Agente |
| 21-10-2026 | Recursos/PDF T08 local | Chromium y PostgreSQL, v0.8.0 | Nueve casos y dos unitarias con evidencia; UI/PDF revisados | [Acta T08](../evidencias/t08.md); antivirus/teléfonos/restauración pendientes | Agente |
| — | P04/P05/P06/P07 | Teléfonos físicos/instalación/zoom | Pendiente | — | Pendiente |

## Control mensual T14-07 — 22-10-2026

Reglas del usuario implementadas en local: admin configura precio/cupo/acceso, coach marca mes y acceso de alumnos, alta pendiente y suspensión de estudio en cascada. Cinco casos nuevos, un filtro SQL y un recorrido Chromium de 11,946 s con fixtures eliminadas. [Acta](../evidencias/t14-control-mensual.md). No hay cobros ni personas reales incorporadas.

## Seguimiento semanal (completar tras inicio)

| Semana | Coaches activos / incorporados | Alumnos activados / invitados | Primera sesión en 7 días | Sesiones/semana | Tiempo observado de rutina | Tickets / 100 alumnos | Coste/egreso | Decisión |
|---|---|---|---|---|---|---|---|---|
| 1 | Sin datos reales | Sin datos reales | Sin datos reales | Sin datos reales | No medido | No medido | No medido | Pendiente |
| 2 | — | — | — | — | — | — | — | — |
| 3 | — | — | — | — | — | — | — | — |
| 4 | — | — | — | — | — | — | — | — |

## Incidencias

| ID anónimo | Fecha/versión | Categoría | Pasos mínimos | Impacto | Estado/solución | Repetición |
|---|---|---|---|---|---|---|
| — | — | — | No introducir fotos, medidas, recibos, correos o tokens reales aquí | — | Sin piloto real | — |

## Decisión de cierre

Pendiente. La implementación local, capturas y pruebas no sustituyen aceptación de coaches, teléfonos ni operación externa. Actualizar [puertas](00-puertas.md) y este registro con cada evidencia real.
