# Ficha de salida — coaches independientes

**23-10-2026 · referencia técnica v0.14.2/001–023. Estado: NO AUTORIZADO para piloto real.** Esta ficha es un formulario pendiente; no constituye consentimiento, contrato, aprobación profesional o prueba física. [Pasos](../runbooks/t14-salida-y-piloto.md), [continuación local comprobada](../evidencias/t14-continuacion.md), [puertas](00-puertas.md), [registro](02-registro.md).

## Responsables y decisiones previas

**Control de pagos confirmado:** alumno→coach y coach→operador se pagan fuera de la app. Registro manual por período y acceso del coach decidido por operador. [Pendientes priorizados y datos necesarios](04-pendientes-y-control-manual.md); interfaz manual entregada en v0.14.2. Precio/cupo/acceso se eligen en el panel; alta nueva sin prueba automática y suspensión de coach también bloquea alumnos.

| Dato | Valor actual | Quién debe completarlo |
|---|---|---|
| Operador / identidad y canal de soporte | Pendiente | Titular del servicio |
| Responsable de privacidad y revisión local | Pendiente | Titular y asesor competente |
| Dominio/staging/producción | Pendiente; no desplegado | Operador |
| Responsable técnico, suplente y horario | Pendiente | Operador |
| Precio/moneda/impuestos/límites y condiciones | Regla mensual configurable por coach resuelta; registrar acuerdos/valores de la cohorte | Producto/operador |
| Coaches / alumnos previstos | Objetivo 3–5 coaches; volumen de alumnos sin acordar | Responsable de piloto |
| Módulos autorizados y contenido licenciado | Pendiente | Producto/coaches responsables |
| Política menores, finalidades y permisos | Pendiente | Responsable de privacidad |
| Exportación/borrado/retención/backups | [Dossier cifrado e inventario locales](../runbooks/t14-cierre-local.md); bytes/contexto, política y borrado integrales pendientes | Responsable de privacidad/técnico |
| Presupuesto mensual/tope y alertas | Costes reales sin introducir | Operador |
| Fecha y duración | Sin fecha; observación hasta cuatro semanas | Responsable de piloto |

La firma **Creado por NAVZ, +595972995557** identifica creador y ya está implementada; no asigna estos cargos ni autoriza contactar a nadie.

## Orden de cierre (sin repetir trabajo ya acreditado)

| Orden | Trabajo pendiente | Evidencia que se debe guardar | Puertas |
|---|---|---|---|
| 1 | Identidad, privacidad/derechos de datos y precio | Responsable, versión de documentos/acuerdo y revisión | P01–P03 |
| 2 | Staging/HTTPS y versión real | Imagen/commit disponible, checksums 001–023, versión PG/Docker, proxy y rollback | P07/P12 |
| 3 | SMTP/scanner/workers/monitor y límites | Ensayos controlados saneados, presupuesto/alertas con responsable | P08/P10/P14 |
| 4 | Una recuperación externa aislada | 85 indicadores vigentes, archivos/permisos/revocaciones, RPO/RTO medidos | P09/P14–P18 |
| 5 | Dispositivos y módulos de la cohorte | Casos en teléfonos/PC y aceptación sin críticos; pago/reintento/comprobante WebKit local ya verificado, sin acreditar PWA o teléfonos | P04–P07/P14–P18 |
| 6 | Contenido/fuentes/competencias aplicables | Origen/licencia, consentimientos y responsables de módulos | P11/P15 |
| 7 | Inicio autorizado y cuatro semanas observadas | Acuerdos de 3–5 coaches, registro semanal y decisión final | P02/P13 |

Los módulos adicionales exigen sus puertas P14–P18. Si se decide excluir uno, documentar cómo se impide efectivamente acceder y cómo se comunica; no cerrar su puerta marcando una casilla sin ejecutar.

## Ficha mínima de caso físico (copiar por dispositivo/caso)

```text
ID anónimo / puerta:
Fecha / responsable:
Modelo / OS / navegador / modo instalado:
Versión de Forma / entorno / red:
Caso y pasos mínimos:
Esperado / observado:
Texto 200 % / zoom / teclado / safe areas / orientación (si aplican):
Resultado: pendiente | aprobado | incidencia
Incidencia / severidad / evidencia saneada:
Corrección / versión / única repetición afectada:
```

## Ficha de despliegue y recuperación (pendiente de ejecutar)

```text
Versión de imagen / fuente identificable / digest:
Migraciones/checksums / PostgreSQL y Compose:
Fecha de build y comprobación de frescura:
Proxy inmediato / puerto API no público / HTTPS / SW no-cache / API no-store:
Monitor/alertas / responsable / coste real conocido:
Copia externa / fecha / custodios de copia y clave (sin secretos):
Destino aislado de restauración:
Indicadores comparados / archivos / referencias / permisos / revocaciones:
RPO observado / RTO observado:
Versión anterior / compatibilidad / resultado de rollback acordado:
Incidencias abiertas / decisión de reapertura:
Responsable / fecha / enlace privado a evidencia sensible si fuera necesaria:
```

## Decisión humana de entrada

| Campo | Estado |
|---|---|
| Puertas aplicables con evidencia/fecha | Pendiente |
| Incidentes críticos abiertos | No evaluado en entorno real |
| Aceptación de coaches/condiciones | No iniciada |
| Decisión: no iniciar / iniciar / corregir / pausar | **No iniciar con datos reales** hasta completar requisitos |
| Responsable / fecha / alcance autorizado | Pendiente |
| Primera revisión / canal de soporte | Pendiente |

La comprobación local `release:check` siempre conserva `pilotApproved: false`. Su resultado no modifica esta decisión ni las puertas automáticamente.
