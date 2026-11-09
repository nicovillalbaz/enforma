# 09. Flujos, menús y pantallas por rol

**Flujo T16 implementado parcialmente (24-10-2026):** coach → ficha → rutina/alimentación/mediciones/historial/exportar; alumno → entrenamiento/alimentación/historial/documentos. Las asignaciones y exportaciones tienen API y permisos; los pasos internos y la descarga PDF completa necesitan recorrido autenticado. [Acta](evidencias/t16-segundo-corte.md), [plan](tandas/16-ficha-alumno-y-experiencia.md). Las descripciones anteriores debajo son históricas.

**Primer corte T16 24-10-2026:** coach abre ficha → Rutinas/Alimentación/Progreso/Historial → vuelve a ficha; Rutinas y Alimentación reciben el alumno de origen. Coach y alumno ven destinos directos y perfil por avatar. [Acta](evidencias/t16-primer-corte.md). Edición completa dentro de ficha, pasos internos y exportación siguen planificados; no confundir enlaces conectados con flujo total terminado.

**Flujos propuestos 24-10-2026:** [T16](tandas/16-ficha-alumno-y-experiencia.md) sustituye los menús y recorridos T15 descritos abajo: coach → Alumnos → ficha → entrenamiento/alimentación/mediciones/historial/exportar; alumno → Hoy/Entrenar/Alimentación/Mi historial. Regreso al padre inmediato, sin «Más»; perfil coach y firma reubicada; coach autor de alimentación. Las pantallas anteriores siguen documentadas como historial, no como aceptación. [Decisión 018](decisiones/018-ficha-y-catalogo.md).

**Actualización 24-10-2026:** [revisión local de T15](evidencias/t15-revision-local.md) aprobada en el alcance indicado. Demo encendida para aceptación manual del usuario; no acredita aún teléfonos ni publicación/guardados de todos los flujos.

## Flujos vigentes tras T15 (23-10-2026)

[Plan completo](tandas/15-redisenio-mobile-first.md) y [manual](runbooks/t15-interfaz-y-contenido.md). Código en curso, aceptación visual pendiente; app apagada por petición del usuario.

1. Primera visita móvil → instalación o continuar en navegador → acceso. Sin instalación forzada.
2. Coach: Inicio · Alumnos · Rutinas · Ejercicios · Más. Alumno: Hoy · Mi plan · Entrenar · Progreso · Más. Más reúne las demás funciones según rol.
3. Alumnos → Nuevo alumno/ficha como páginas. Objetivo libre, opciones propias vacías inicialmente; enlaces a historial y progreso.
4. Rutinas → Estructura → Ejercicios → Revisar. Crear ejercicio desde el mismo recorrido, volver sin desmontar el borrador. Guardar sigue siendo explícito.
5. Biblioteca → ejercicio/equipo/guía en página; no abrir modales. Objetivo, grupo y material son contenido del coach, no listas inventadas.
6. Administración aprueba coach y define mensualidad/cupo/acceso; el coach decide pago/acceso de alumnos. No hay prueba automática o elección autónoma de plan al darse de alta.

Estos flujos sustituyen las opciones de prueba/facturación y composición de paneles que contradigan lo siguiente, conservado como planificación original.

## Mapa inicial de navegación

| Rol | Navegación móvil | Panel amplio | Primera entrega |
|---|---|---|---|
| Alumno | Inicio · Entrenar · Progreso · Mensajes · Más | Mismo contenido con más espacio | Inicio/Entrenar/Progreso T02–T07; Mensajes T10; Más crece por módulo |
| Coach | Inicio · Alumnos · Programas · Biblioteca · Más | Barra lateral: Dashboard, Alumnos, Programas, Ejercicios, Archivos, Nutrición, Mensajes, Agenda, Negocio, Marca | Núcleo T02–T07; resto por tanda |
| Superadmin | Inicio · Organizaciones · Planes · Cobros · Soporte | Tablas con filtros y detalle | T02 y T07 |

Cada menú se genera desde módulos habilitados y permisos efectivos. Una sección no instalada no deja un botón vacío. Las rutas directas también se protegen en servidor. El coach puede previsualizar la experiencia del alumno sin convertirse en él; toda acción simulada se marca como preview y no crea registros reales.

## Flujo F1 — Coach nuevo a primer alumno

1. Abrir subdominio central, registrar email y contraseña, confirmar correo mediante enlace.
2. Crear marca: nombre, logo opcional, colores accesibles y texto de bienvenida. Vista previa 320/390 px.
3. Elegir plan de prueba y ver cómo se cuentan los alumnos habilitados; no solicitar pago automático.
4. Crear ficha de alumno con datos mínimos, enviar invitación de un uso, ver estado `invited`.
5. Alumno acepta desde su teléfono, define contraseña y ve su marca y pantalla vacía con siguiente paso.
6. Coach activa acceso; sistema abre intervalo facturable y muestra cambio de conteo.

**Estados de error:** email ya usado, enlace vencido, logo inválido, cupo agotado, SMTP fallido, alumno duplicado. **Evidencia:** completar sin soporte humano en iPhone y Android.

## Flujo F2 — Prescribir y ejecutar entrenamiento

1. Coach busca ejercicio o crea uno propio, añade clip/foto y equipo; contenido en proceso tiene estado visible.
2. Arma programa por semanas/días, configura series, carga, descanso, tiempo/RPE y vista previa móvil.
3. Publica versión y asigna a alumno con fecha de inicio. Alumno ve «Hoy» y la prescripción exacta.
4. Alumno inicia sesión, consulta instrucciones/vídeo, registra series, modifica valores reales y usa descanso.
5. Al perder red, eventos quedan pendientes visibles; al reconectar se sincronizan una sola vez.
6. Alumno finaliza, ve resumen; coach recibe resultado y gráfico. Versión publicada permanece intacta.

**Estados de error:** vídeo fallido, día sin ejercicios, carga inválida, reintento duplicado, conflicto entre dispositivos. **Evidencia:** ensayo con modo avión y dos organizaciones.

## Flujo F3 — Entregar plan alimentario y revisarlo

1. Profesional autorizado arma receta/menú de siete días con fuentes nutricionales identificadas.
2. Publica versión, asigna a alumno y opcionalmente genera PDF con marca.
3. Alumno consulta menú, marca comida y adjunta foto/nota; calorías son opcionales.
4. Profesional ve adherencia y comentario; alumno responde mediante chat/check-in si está habilitado.

**Estados de error:** ingrediente sin macros, menú modificado, foto sin permiso, profesional sin asignación. **Evidencia:** ninguna cifra inventada y privacidad por rol.

## Flujo F4 — Archivo, consulta y seguimiento

1. Coach sube un documento a carpeta privada y elige alumno destinatario.
2. Alumno lo abre desde la app; coach puede revocar acceso.
3. Alumno pregunta en chat y adjunta un vídeo propio; coach contesta.
4. El check-in semanal solicita datos mínimos y produce una tarea de revisión.

**Estados de error:** archivo demasiado grande, permiso revocado, chat sin conexión, formulario vencido. **Evidencia:** no necesita Drive/WhatsApp para este caso y ningún enlace privado queda público.

## Diseño de las pantallas principales

- **Inicio alumno:** próxima sesión como acción principal, progreso reciente, aviso de sincronización, mensajes y plan de comidas si activo. Priorizar una acción por bloque.
- **Entrenar:** tarjeta de ejercicio, prescripción y registro real separados visualmente; campos grandes y teclado numérico; vídeo plegable; controles alcanzables con una mano.
- **Progreso:** periodo, gráfico con resumen textual y detalle de sesiones. Evitar mostrar «0» como progreso cuando faltan datos.
- **Ficha coach:** nombre/estado, acciones de invitar/pausar, programa, actividad, mediciones y mensajes según permiso. Datos sensibles en sección cerrada.
- **Constructor:** en móvil edición por pasos y tarjetas; en escritorio vista de semanas/días con panel de detalle. No exigir arrastrar para ordenar: botones accesibles de mover.
- **Superadmin:** cifras agregadas y tablas paginadas; abrir detalle antes de una acción destructiva. Acceso de soporte a datos de alumno solo con causa registrada.

Todas estas pantallas respetan la [matriz móvil](04-experiencia-movil-pwa.md), muestran carga/vacío/error y tienen títulos/rutas que permiten volver sin perder contexto.

## Rutas ejecutables de T02

`/registro`, `/crear-estudio`, `/estudio/:slug`, `/acceso`, `/recuperar`, `/verificar`, `/invitar`, `/privacidad`, `/alumnos`, `/marca`, `/plan`, `/admin`, `/alumno`, `/mi-perfil`, `/estado`. Las rutas privadas verifican sesión y rol y la API repite los permisos. `/demo` es una entrada explícita a los ejemplos de entrenamiento que aún no están conectados. [Recorrido detallado](runbooks/t02-uso-y-soporte.md).

## Recorrido ejecutable T03

Coach → `/ejercicios` → Equipos → foto/ubicación → Ejercicios → crear/copiar base → instrucciones/equipo/clip → guardar borrador → procesamiento → publicar → abrir guía → compartir con alumno activo. Medios muestra uso, estados, errores y reintento/cancelación/eliminación sin referencias.

Alumno → `/biblioteca` (Mis guías) → catálogo base y publicadas compartidas → abrir → texto/equipo/póster y vídeo con controles. Si falla el medio, permanecen instrucciones. Retirar permiso impide nuevas consultas/descargas. [Manual](runbooks/t03-uso-y-operacion.md).

La vista se recrea al cambiar de estudio para evitar conservar listas del anterior. Formularios en diálogo desplazable y columnas adaptables desde 320 px. Sin autoplay ni bloqueo de zoom. Safari/iPhone y Android físicos pendientes; límite WebKit Windows en el [acta](evidencias/t03.md).

## Recorrido ejecutable T04

Coach → `/rutinas` → Nuevo programa → estructura/semanas → día/ejercicios/series → guardar borrador → preview → publicar versión → Versiones y asignar → fecha/alumnos activos → Asignaciones. Duplicación independiente y orden por botones; en móvil tres pasos, PC ancho tres columnas. Edición con revisión y aviso antes de descartar cambios.

Alumno → inicio o **Mi plan** (`/mi-programa`) → Consultar programa → semana/día/fecha → snapshot de instrucciones, equipo, medio y series objetivo. Publicar v2 no cambia su asignación v1. Cancelación del coach retira nuevas consultas. El calendario usa días 1–7 desde el inicio, no lunes–domingo fijos. [Manual T04](runbooks/t04-uso-y-operacion.md).

T05 sustituirá el aviso de planificación por el flujo real de registro, con cola local y sincronización diferenciadas de la confirmación del servidor.


## Recorrido implementado T05

**Alumno:** Hoy → Mi plan → elegir día → Preparar este entrenamiento → `/entrenar` → iniciar → registrar serie → descanso → guardar notas → cerrar (confirmar parcial si corresponde) → `/historial`. Se distingue objetivo, guardado local y confirmación servidor. Seleccionar otra serie permite consultar/corregir; deshacer deja auditoría. Historial ofrece reapertura con motivo durante siete días.

**Offline:** preparar con conexión en el dispositivo → desconectar → registrar → recargar/reabrir shell compilado → reconectar y verificar una sola copia. Conflicto detiene la cola y muestra valores; acceso revocado conserva/exporta pendientes. Cerrar sesión con pendientes pide confirmar borrado; no se transfieren a otra cuenta.

**Coach:** Alumnos → ficha → Ver entrenamientos y resultados → `/historial?studentId=…` → detalle de objetivos y valores confirmados. El coach no ve la cola del teléfono ni modifica los hechos del alumno. [Guía T05](runbooks/t05-uso-y-operacion.md).


## Recorrido implementado T06

**Alumno:** Hoy o navegación Progreso → periodo → resumen/semanas → ejercicio/marca → tabla equivalente. Historial sigue accesible desde el panel, con filtros de fecha/estado. Mediciones → tipo/valor/fecha → confirmación → anular con motivo si corresponde. Privacidad → permisos individuales → guardar → Fotos opcionales → selección/fecha → subida privada. Retirar permiso bloquea futuras peticiones; retirar consentimiento elimina activas sin resurrección al reactivarlo.

**Coach:** Progreso → búsqueda/listado paginado → alumno → adherencia/volumen/último cierre → aviso propio de inactividad. Alumnos → ficha ofrece el mismo resumen y enlace. Mediciones/Fotos requieren autorización del alumno, también para el responsable del estudio. [Guía T06](runbooks/t06-uso-y-operacion.md).


## Recorrido implementado T07

**Instalación:** Más opciones → Instalar app → instrucciones por navegador/manifest de marca → icono → `/abrir/slug` → verificar cuenta/seleccionar estudio. Una sesión de otra marca no cambia el destino de ese arranque. Las actualizaciones esperan al cierre de todas las ventanas; no descartan formularios automáticamente.

**Owner:** Mi plan/Mi cuenta → mes → precio/días por alumno → cuenta emitida → ajustes/pagos/comprobantes → saldo. Mes actual estimado, sin deuda automática. **Superadmin:** Administración → Cuenta y pagos → habilitar desde ahora/fin de prueba → emitir mes terminado → ajuste o pago ya comprobado → revertir con motivo si corresponde.

**Móvil:** cinco destinos prioritarios y opciones secundarias desplegables; sidebar de PC desplazable en ventanas bajas, formularios 16 px y cuenta en tarjetas. [Manual](runbooks/t07-uso-y-operacion.md).


## Recorrido T08 — Material y documentos

Coach: Más opciones → Recursos y PDF → colección → recurso → medio / PDF analizado / solicitar documento → actualizar → conceder acceso. Relación con ficha/programa no comparte; nueva versión conserva la anterior y los formularios avisan antes de descartar cambios.

Alumno: tarjeta permitida → versión → preparar acceso privado → abrir/descargar. Revocar impide nuevas aperturas; vínculo vencido se prepara de nuevo. PC con lista/detalle y móvil con Volver. [Capturas](evidencias/t08.md).

## Recorrido T09 — Alimentación

1. Owner → Profesionales: comprobar/habilitar capacidad, incluso propia. Ficha/vínculo sigue en T02.
2. Profesional → Alimentos con fuente → Recetas/rendimiento → Menú por día → Guardar → Publicar.
3. Versiones / asignar → alumno/periodo hasta 84 días; sin solapamiento activo; semana por día de la semana.
4. Alumno → Mi menú/fecha; Privacidad para diario/fotos y profesionales elegidos; registrar comida con cantidad opcional y foto propia.
5. Seguimiento profesional → alumno/fecha → solo datos concedidos → comentario compartido. Revocar desde alumno bloquea nuevas consultas.
6. Preparar PDF privado de asignación → Recursos y PDF → estado listo → compartir explícitamente con su alumno.

Una columna móvil y dos/tres en PC, sin añadir destinos a la barra principal. [Guía paso a paso](runbooks/t09-uso-y-operacion.md), [plan visual](11-plan-visual.md).

## Flujo T10 — Chat y seguimiento

Más opciones/sidebar → `/seguimiento` → contacto vinculado → conversación. Móvil alterna listado/detalle con Volver; PC ancho muestra ambos. Mensaje → adjunto listo opcional → Enviar → Guardado/Visto; anteriores y retorno a recientes. Privacidad separa silenciar y permiso de hábitos/check-ins.

Profesional → Hábitos y check-ins → asignar hábito o crear borrador → publicar versión → programar semana/mes. Alumno → permiso propio → registro opcional/respuesta u omisión → profesional revisa y cierra edición. Bandeja interna por categorías; sin nuevo destino en barra móvil ni solicitud Push. [Pasos de uso](runbooks/t10-uso-y-operacion.md), [diseño](11-plan-visual.md), [acta](evidencias/t10.md).

## Flujos T11 entregados

Coach: Agenda → Disponibilidad → Nuevo bloque → Sesiones → Nueva sesión → publicar → abrir inscritos → editar/cancelar/asistencia. Alumno: Más opciones → Agenda → sesión → reservar → estado/plazo → cancelar. PC muestra lista y detalle juntos; móvil alterna ambos con Volver. Solo propios o vinculados según rol.

Owner: Reglas → elegir tipo → publicar configuración → vista previa → pausar o revisar ejecución → reintentar únicamente fallo técnico vigente. Persona: Mis avisos → categorías/silencio/límite → bandeja → ver sesión o seguimiento autorizado. [Pasos detallados](runbooks/t11-uso-y-operacion.md). No convierte una reserva en pago o consumo de membresía.

## Flujos T12 entregados

Owner: Servicios → Nuevo servicio → Ventas → Nueva venta → elegir alumno/vigencia → cuotas → confirmar → abrir detalle → pago parcial/comprobante → devolución/corrección o ajuste. Renovar propone contrato nuevo con precio actual; cancelar conserva deuda y reservas.

Paquetes: Agenda → confirmar presente → Servicios → paquete → descontar asistencia con motivo → restaurar error sin borrar. Alumno: Más opciones → Mis servicios → vigencia/cuotas/pagos/comprobante propios. CRM: Prospectos → etapa/origen/acción → convertir por correo o eliminar datos. Resumen: rango → moneda → CSV numérico. [Pasos detallados](runbooks/t12-uso-y-operacion.md).

## T13 — Recorrido individual consolidado

Registro coach → Inicio con estado real → correo → alumno activo → rutina publicada/asignada. Más opciones agrupa módulos por rol; alumno no encuentra CRM o cuenta SaaS. Información pública accesible desde grupos/footer/acceso, con firma NAVZ y teléfono explícito. Contexto fijo cuando no existe elección. [Guía](runbooks/t13-uso-y-operacion.md). Equipos/sedes/gimnasios quedan aplazados fuera de T13/T14.
