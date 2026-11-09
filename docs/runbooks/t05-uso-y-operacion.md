# T05 — Entrenar, recuperar pendientes y consultar resultados

**Entrega local v0.5.0.** [API](api-t05.md), [decisiones](../decisiones/005-sesiones-y-sincronizacion.md), [acta](../evidencias/t05.md). Datos de demostración ficticios. Mantener pendientes físicos y externos de T01/T03/T07.

## Alumno: preparar e iniciar

1. Con conexión, entrar con la cuenta de alumno y abrir **Mi plan**.
2. Consultar el programa asignado; elegir semana/día y comprobar fecha, versión, indicaciones y equipo.
3. Pulsar **Preparar este entrenamiento**. Solo se permiten días entre 30 anteriores y siete posteriores a hoy. La sesión y sus indicaciones quedan en IndexedDB del navegador/dispositivo actual.
4. Pulsar **Iniciar sesión**. El indicador explica si el inicio está guardado localmente o confirmado por el servidor. Reabrir el mismo día recupera la misma sesión.
5. Mantener este navegador/perfil para entrenar sin red; preparar en el PC no descarga el día en el teléfono. Antes de un uso offline prolongado, comprobar la preparación desde el propio teléfono.

## Registrar series

1. Seleccionar una serie. Consultar su **objetivo del coach**; los campos inferiores son lo realizado y empiezan vacíos.
2. Introducir repeticiones, segundos o metros según corresponda. Carga y esfuerzo son opcionales; cero kg se conserva como cero, vacío como no indicado.
3. Añadir una nota si hace falta y pulsar **Guardar serie**. Esperar el cambio de estado. El botón se bloquea mientras se confirma la escritura local; si falta espacio se conserva el formulario y se muestra que no se guardó.
4. La serie queda registrada en el dispositivo y se selecciona la siguiente pendiente. El descanso empieza desde una fecha límite guardada; al volver de otra app o recargar se recalcula el tiempo restante.
5. Una serie registrada se puede actualizar o **Deshacer**. Deshacer conserva su auditoría; la realización actual vuelve a estar vacía.
6. Guardar las notas de sesión con su botón. Navegar o cambiar contexto con campos sin guardar pide confirmar descarte; una cola ya persistida puede quedar pendiente al navegar.

## Finalizar y corregir

1. Revisar series realizadas frente al total y notas.
2. Pulsar **Finalizar sesión**; requiere al menos una serie. Si quedan otras pendientes se pide confirmar el cierre parcial.
3. Comprobar el indicador de sincronización. Un cierre local pendiente todavía no aparece al coach.
4. **Historial** muestra objetivos, valores reales, notas y duración declarada. Los nombres/objetivos pertenecen a la versión original, aunque cambie el programa o el equipo.
5. Durante siete días desde el cierre, **Corregir registro con motivo** reabre la sesión. Explicar el cambio, corregir y finalizar de nuevo. La corrección no elimina hechos anteriores.

## Sin conexión y reintentos

1. La reapertura offline requiere la compilación servida con el shell instalado. En local usar dos terminales: `scripts/forma.ps1 run preview:api` y, después de `scripts/forma.ps1 run build`, `scripts/forma.ps1 run preview`. Abrir `http://127.0.0.1:4173`. La API separada en 3002 mantiene la comprobación de origen para 4173; la de desarrollo en 3001 sigue usando 5173.
2. Vite de desarrollo en 5173 permite guardar series cuando se corta la red con la página abierta; **no precarga el shell** para un arranque frío offline.
3. Preparar el día e iniciar con conexión. Esperar la confirmación; desconectar. Guardar dos series y verificar el contador pendiente.
4. Recargar o cerrar/abrir una pestaña; entrar en **Entrenar**. El contexto offline dura 24 horas; después se necesita red para verificar identidad. La UI no obtiene permisos nuevos desde caché.
5. Reconectar, mantener Entrenar abierto y esperar sincronización o pulsar **Reintentar**. También se intenta al recuperar visibilidad y cada 15 segundos. La app cerrada no sincroniza en segundo plano. Después de un arranque offline, pulsar **Actualizar acceso** con red para recuperar el resto de las secciones. Los avisos de conexión anteriores se retiran al completar la sincronización.
6. Las indicaciones textuales están disponibles offline. Los medios privados no se guardan en CacheStorage y requieren conexión; no confundir un vídeo reproducido previamente con una descarga garantizada.

## Conflictos y acceso revocado

| Situación | Acción |
|---|---|
| Misma serie modificada desde dos dispositivos | Comparar servidor y cambio local. Descartar solo el cambio en conflicto o confirmar aplicar el propio contra la revisión actual. Los demás pendientes siguen en cola. |
| Estado/cierre cambió en otro dispositivo | Revisar la sesión antes de decidir. No editar una finalizada sin reabrir con motivo. |
| Cuenta no autenticada o alumno pausado | Conservar pendientes, iniciar la misma cuenta y usar **Volver a verificar acceso** cuando el coach reactive el perfil. |
| Asignación cancelada | El historial confirmado sigue disponible. Descargar pendientes y consultar al coach; no se transfieren a otra asignación. |
| Error de red/API | Conservar navegador/perfil y reintentar; no repetir cambiando UUID manualmente. |
| Almacenamiento sin espacio | No se reconoce ni envía el registro. Mantener los campos, liberar espacio y guardar de nuevo. No borrar datos del sitio con pendientes. |

**Descargar registros pendientes** genera un JSON privado para revisión/soporte. No es una importación automática ni una confirmación del servidor. Tratarlo como información del alumno, compartirlo solo por un canal acordado y retirarlo del equipo cuando deje de hacer falta.

## Cerrar sesión y equipo compartido

- Con pendientes se pide confirmar antes de borrarlos. Cancelar permite sincronizar o descargar primero.
- Si falla el logout online, se conserva el contexto y los datos. Logout offline limpia la cuenta local y deja revocación pendiente; al reconectar se revoca la cookie antes de restaurar identidad.
- Se comunica el cierre a otras pestañas; una respuesta atrasada no recrea la sesión eliminada. Iniciar otra cuenta no sincroniza los hechos de la anterior.
- La caché confirmada expira después de siete días sin uso. Los pendientes no caducan por esa limpieza. No se promete supervivencia frente a expulsión del almacenamiento del navegador: probarla en teléfonos reales antes del piloto.

## Coach y operación

1. Abrir **Alumnos**, ficha y **Ver entrenamientos y resultados**.
2. Revisar fecha/versión, estado, series, notas y detalle de objetivos frente a realización. Los pendientes del teléfono no aparecen hasta ser aceptados.
3. Conservar el motivo de cancelación de asignación; los días ejecutados y sus medios históricos siguen siendo registros privados autorizados.
4. Migrar 009/010 antes de arrancar API v0.5.0. No modificar migraciones ya aplicadas.
5. Ejecutar backup cifrado y ensayo de restauración: ahora se contrastan ocho conteos (usuarios, auditoría, programas, versiones, asignaciones, sesiones, series, eventos), además de hashes y referencias privadas. No borrar medios usados por versiones o sesiones.
6. No registrar notas, cargas ni payloads completos en logs operativos. Para soporte usar IDs/recibos y el JSON compartido voluntariamente por el alumno.

## Puerta física antes del piloto

En iPhone/Safari real y Android de gama baja: preparar, desconectar dos series, alternar apps, bloquear pantalla, cerrar/abrir la PWA cuando T07 permita instalarla, reconectar y comparar una sola copia de cada valor en coach. Probar teclado numérico, 320 px, landscape, zoom accesible, expulsión de caché y cierre de sesión compartido. Registrar dispositivo/OS/navegador/resultado. La emulación de navegador en Windows no cierra esta puerta.
