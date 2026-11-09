# T14-07 — Precio, cupo, mensualidad y acceso manual

**V0.14.2 · migración 023 · coaches independientes.** Dinero fuera de la app. El operador decide desde su panel; no hay prueba, renovación, cobro o suspensión automática al cambiar de mes. [Decisión](../decisiones/015-control-mensual-manual.md), [resultados](../evidencias/t14-control-mensual.md).

## 1. Operador: habilitar un coach y definir sus condiciones

1. Entrar como administrador y abrir **Coaches y acceso** en /admin. Buscar por nombre si hace falta.
2. Un alta nueva queda **Suspendido**, cupo 0 y precio **Sin definir**, hasta tu decisión. El alta crea cuenta/espacio, no acceso de trabajo ni prueba automática.
3. Pulsar **Configurar coach**. Definir **Precio mensual (PYG, opcional)**: entero sin separadores; vacío significa no acordado, 0 significa precio cero. Es una mensualidad fija del coach, no un precio por alumno ni cobro bancario.
4. Definir **Cupo de alumnos habilitados**, entre 0 y 5000. Solo alumnos activos ocupan plaza; invitados, pausados y archivados no. Puedes habilitar al coach con cupo 0 para preparar contenido sin activar alumnos.
5. Elegir explícitamente **Habilitar acceso del coach** y escribir motivo de 10–500 caracteres. Guardar y esperar confirmación del servidor.
6. Suspender bloquea al coach y a todos los alumnos del estudio; conserva sesiones, programas y estados individuales. Restaurar recupera únicamente los alumnos que seguían activos: no reactiva los que su coach pausó o archivó.
7. El cupo no puede ser menor que el número de alumnos conservados como activos, aunque el estudio esté suspendido. Para reducirlo, coordinar con el coach la pausa/archivo de alumnos antes de fijar el cupo inferior; no se expulsan personas automáticamente.
8. Precio, cupo y acceso tienen revisión. Si otra sesión cambió la configuración, actualizar y revisar antes de guardar; no sobrescribir a ciegas.

## 2. Operador: registrar si el coach pagó el mes

1. Elegir **Mes de pago** y **Actualizar**. El período es un mes calendario; la zona de uso es Paraguay para el panel de operador.
2. Verificar fuera de la app el acuerdo/pago del coach. Pulsar **Marcar pagado** solo después de comprobarlo. No se requiere imagen, referencia bancaria o emitir una cuenta.
3. Si fue un error, **Marcar pendiente** registra una corrección y conserva eventos anteriores. No borra el registro previo.
4. **Marcar pago no cambia acceso.** Si quieres habilitar o suspender, hacerlo mediante Configurar coach. Un pago confirmado no debe levantar por sí solo una suspensión por otra causa.
5. El mes siguiente aparece pendiente si no existe una marca de ese mes; no se copia el pago anterior ni se suspende automáticamente. Puedes consultar y registrar períodos dentro de la ventana técnica de cinco años anteriores y un año posterior.
6. **Historial anterior de cuentas** conserva acceso autorizado a los registros T07 anteriores. No se exige ese flujo para la nueva mensualidad manual. Los cambios de precio actual no reescriben cuentas históricas ni reconstruyen el precio de cada mes pasado.

## 3. Coach: mensualidades y acceso de alumnos

1. Abrir **Mensualidades de alumnos** desde Más opciones/sidebar. Solo el owner activo del estudio puede gestionarlas; alumno u otro coach no pueden cambiar esas marcas.
2. Elegir **Mes**, buscar alumno opcionalmente y pulsar **Consultar**. Se muestran 50 fichas y **Cargar más** si hay más. No consultar todo el historial de chat, fotos o finanzas para esta lista.
3. Verificar el pago fuera de la app y pulsar **Marcar pagado**; para corregir, **Marcar pendiente**. El mes se guarda sin importe/comprobante obligatorio y sin ejecutar una transferencia.
4. Decidir por separado **Habilitar acceso** o **Pausar acceso**, confirmar el aviso y esperar confirmación. El estado del mes no cambia al pausar acceso; marcar pagado tampoco lo habilita automáticamente.
5. Un invitado sin cuenta necesita completar la invitación antes de habilitarse. Usar el enlace **Preparar invitación** para ir a Alumnos y compartir el enlace privado por el procedimiento existente.
6. La aceptación de invitación o reactivación comprueba cupo en servidor y bajo bloqueo del estudio. Cuando no hay plaza, no se concede acceso parcial ni se cobra automáticamente.
7. Pausar/archivar conserva historia. Cambiar de mes no borra pagos ni entrenamientos. No usar eliminación de filas de DB para corregir marcas o saldos.
8. Si hay pérdida de respuesta, repetir la misma acción: la intención se conserva para evitar duplicados. Si otra persona modificó el registro, actualizar primero y comprobar el estado. Consultar el mes seleccionado antes de marcar; no reutilizar revisiones de otro mes.

## 4. Coach: consultar su propia mensualidad

1. Abrir **Mi mensualidad** (/cuenta; /plan conserva un acceso compatible). Elegir mes y consultar.
2. Ver pago del período, precio mensual **actual**, cupo **actual** y acceso **actual**. El selector de mes no reconstruye precios/cupos antiguos.
3. No hay botones para que el coach marque su propio pago o se habilite. Solicitar al operador la revisión correspondiente fuera de la app.
4. Owner suspendido puede consultar esta cuenta sin recuperar acceso al entrenamiento/alumnos. Otros roles o propietarios no pueden consultar la cuenta de ese estudio.

## 5. Compatibilidad y continuidad

- Espacios anteriores a 023 conservan estados/configuración previos hasta que el operador guarde el control manual. Se muestran para revisión; antes del piloto comprobar y configurar cada uno. No se aprueban retrospectivamente ni se eliminan datos.
- La configuración manual convierte la suscripción técnica a active/paused según acceso decidido, por lo que la fecha histórica de prueba deja de controlar esas operaciones. Tiers técnicos heredados se conservan para límites de medios/recursos; no fijan el cupo manual o la mensualidad nueva.
- Tablas de control, marcas mensuales y eventos conservan permisos propios. La gestión de plataforma no concede acceso a las marcas privadas de los alumnos. No escribir datos sensibles en motivos.
- Backup añade tres conteos y una suma de configuración: **85 indicadores previstos** (69 conteos/16 sumas). La suma de precios configurados no es ingreso ni cobro. No se ejecuta restauración nueva por implementar esta interfaz.
- Mantener fuentes/artefactos y checksums identificados, una sola revisión visual acotada y pruebas por caso afectado. Los tests históricos de alta/prueba/plan necesitan fixtures con habilitación explícita para el nuevo contrato; no ejecutar sus matrices antiguas sin revisarlos.
- Piloto real, derechos integrales de datos, teléfonos físicos, correo/scanner/HTTPS, operación y recuperación externa conservan sus puertas. [Ficha de salida](../piloto/03-salida-independiente.md).
