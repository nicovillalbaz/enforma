# T07 — PWA, facturación SaaS y piloto cobrable

**Estado:** base funcional local implementada en v0.7.0. Una repetición final de cuenta WebKit queda pendiente por recursos; el alcance está en el [acta](../evidencias/t07.md). El piloto real T07-07 sigue pendiente.

**Depende de:** T02–T06. **Objetivo:** primera versión comercial utilizable y medición de uso real.

## Base offline disponible desde T05

T05 genera el shell público versionado y guarda intenciones de series en IndexedDB antes de red. Mantener ese contrato y sus límites al añadir manifiesto/iconos/instalación; no introducir una segunda cola ni cachear API o vídeos privados. [ADR 005](../decisiones/005-sesiones-y-sincronizacion.md) y [acta T05](../evidencias/t05.md).

Antes de declarar instalación y reapertura fiables: cerrar la puerta de Safari/iPhone real y Android, incluido reinicio completo, expulsión de caché, actualización con formulario abierto, teclado y cierre de sesión entre cuentas. El diagnóstico WebKit Windows de T05 es una limitación local de verificación, no aceptación de Safari físico.

## Base de seguimiento entregada por T06

`/progreso` utiliza sesiones confirmadas; mediciones/fotos son opcionales, con consentimiento y permisos por profesional. Las fotos no se cachean ni se entregan como medios generales. Mantener [ADR 006](../decisiones/006-progreso-y-privacidad.md), [API](../runbooks/api-t06.md) y [operación/QA](../runbooks/t06-uso-y-operacion.md). Ese corte T06 aplicó 001–013; T07 añade 014–016 y deja 017 como siguiente migración.

La copia/restauración incluye fotos/miniaturas, mediciones, preferencias, compartición y avisos (13 conteos). Concretar retención/exportación/borrado integral y reconciliación de revocaciones al restaurar antes de datos reales; probar HEIC/tamaños/orientación en teléfonos físicos sin convertir un error en confirmación. El límite de 100 registros históricos de fotos por alumno necesita revisión de retención para uso prolongado.

## Pasos de ejecución

1. **T07-01 PWA por marca.** Manifest e iconos por organización, shell offline seguro, actualización controlada, guía de instalación para iPhone/Android, navegación alumno y caché sin fuga entre sesiones/marcas.
2. **T07-02 Pulido visual y móvil.** Ejecutar matriz de `04-experiencia-movil-pwa.md` y la puerta visual de `11-plan-visual.md` en todas las rutas, incluidos temas claro/oscuro, dos marcas, errores, formularios, teclado, rotación y 200 % texto; corregir desbordes, zoom de input y controles ocultos.
3. **T07-03 Facturación.** Migrar periodos, snapshots, uso por alumno, cuenta y pagos; implementar fórmula versionada de `05-negocio-y-facturacion.md`, simulador, cierre idempotente y correcciones auditadas.
4. **T07-04 Superadmin.** Vista de suscripciones, alumnos habilitados, saldo, cuenta emitida, registrar pago manual y acciones de soporte registradas. Coach puede explicar cada cargo desde su panel.
5. **T07-05 Operación.** Términos, privacidad y procedimiento de soporte revisados; restauración probada, monitor de cuota/disco, procedimiento de incidente y presupuesto de coste por 100 alumnos.
6. **T07-06 Pruebas finales.** E2E desde alta de coach hasta serie, gráfico y cuenta SaaS; aislamiento de dos organizaciones y archivo; carga ligera con concurrencia de piloto; regresión de cambio/pausa de alumnos.
7. **T07-07 Piloto.** Incorporar 3–5 coaches reales con consentimiento y soporte; medir activación, primer entrenamiento, uso semanal, tiempo de rutina, fallos y coste. Revisión semanal y lista de defectos priorizada.

## Aceptación y evidencia

Una organización se registra, invita alumno, crea programa, éste entrena en iOS/Android, ambos ven historial y el coach ve su cuenta del mes con detalle por alumno. Ningún fallo crítico de privacidad, pérdida de series o facturación sin explicar. Cerrar piloto solo tras observación de uso real y decisión registrada sobre precio y siguiente tanda.

## Tablero T07 y evidencia

| Tarea | Estado local | Resultado / puerta pendiente |
|---|---|---|
| T07-01 | Implementado; evidencia local disponible | Manifest/iconos por estudio, arranque explícito, guía y worker en espera. Instalación física/orígenes HTTPS por marca pendientes |
| T07-02 | Implementado; pendiente concreto de QA | Cuenta/instalación móvil y PC, campos 16 px, cinco destinos, opciones secundarias y sidebar desplazable. Repetición final de cuenta WebKit aplazada por recursos; zoom/texto/teclado reales pendientes |
| T07-03 | Implementado y verificado | Fórmula entera, días distintos, plan de apertura, mes estimado/emitido, snapshots, idempotencia y correcciones. [Referencia](../evidencias/t07-calculos.md) |
| T07-04 | Implementado y verificado | Cuentas/pagos/reversiones y comprobante privado, resumen agregado de plataforma, permisos y auditoría. [API](../runbooks/api-t07.md) |
| T07-05 | Preparado y probado localmente | Monitor, identidad de backup y restauración ampliada; SMTP/externo/políticas/coste real siguen abiertos |
| T07-06 | Verificado con límites registrados | 23 unitarias y 73 integraciones aprobadas, regresión y ocho casos offline con evidencia. Caso final ampliado de cuenta PC/móvil aprobado; repetición WebKit pendiente por recursos. [Acta](../evidencias/t07.md) |
| T07-07 | Pendiente externo | Cero coaches reales incorporados. [Puertas](../piloto/00-puertas.md), [protocolo](../piloto/01-protocolo.md), [registro](../piloto/02-registro.md) |

## Secuencia reproducible

1. Aplicar 001–016, compilar y arrancar según [manual](../runbooks/t07-uso-y-operacion.md). Mantener pruebas en entorno ficticio separado.
2. Abrir Instalar app y verificar manifest/icono/arranque de dos marcas. Abrir una instalación no hereda el último estudio recordado ni concede pertenencia.
3. Registrar una sesión → consultar gráfico → owner consulta cuenta. Administración revisa simulación, habilita sin retroactividad, emite un mes terminado y contrasta snapshot.
4. Registrar ajuste y pago ya comprobado con referencia/recibo sintético; revertir error mediante asiento nuevo. Owner puede explicar cada día y movimiento, alumno/staff no acceden a cuenta.
5. Ejecutar pruebas unitarias/DB/navegador, carga ligera y monitor. Atender alertas reales de correo/disco/backup sin borrar evidencia ni enviar mensajes sin autorización.
6. Crear/restaurar backup aislado, verificar hashes/referencias y 20 conteos/3 sumas. Registrar resultados y actualizar guías/avances.
7. Ejecutar puertas físicas/externas y piloto real con responsables; no marcar T07 cerrada comercialmente con pruebas locales.

## Puente a T08

Base técnica reutilizable: permisos y medios T03, snapshots T04–T07, cola/worker con límites y entrega privada. La cuenta informativa no se convierte en factura fiscal al imprimir o exportar PDF. Mantener comprobantes fuera de archivos genéricos y respetar retención/auditoría. Exportación/borrado integral de datos y el piloto real siguen abiertos; añadir recursos/PDF no los acredita.
