# Prueba manual privada con datos ficticios

**Actualización 26-10-2026 — dieta:** entrar como Coach Aurora → Dieta → Alimentos; buscar «Salmón cocido», «Arroz blanco cocido» o «Pechuga de pollo cocida». Las 80 fichas iniciales no tienen macros ni alérgenos verificados. En Recetas → Nueva receta → «Empezar con un plato conocido», elegir «Ensalada rusa», «Pollo con arroz» u otro ejemplo; cambiar ingredientes, añadir/quitar y escribir los gramos que correspondan antes de guardar. Nada se asigna al alumno hasta que el coach cree un menú, lo publique y lo asigne. [Acta y captura móvil](../evidencias/alimentos-comunes-2026-10-26.md).

**Actualización 26-10-2026 — barrido móvil:** en Ejercicios ya se puede seleccionar «Cardio» aunque el coach no haya creado grupos propios; deben aparecer cuatro ejercicios con dibujos de grosor más parejo. [Captura de referencia](../evidencias/cardio-art-mobile-2026-10-26.png). El [barrido de 38 combinaciones](../evidencias/barrido-movil-2026-10-26.md) no detectó errores de carga ni desbordes en la demo ficticia. Si la pestaña conserva código anterior, recargarla por completo antes de comparar.

**Actualización 26-10-2026 — accesos y catálogo:** si una pestaña abierta antes de la corrección muestra `Failed to fetch dynamically imported module` o 404 en `/assets/`, hacer una recarga completa (`Ctrl+Shift+R`) o cerrar y reabrir la app instalada. Aquellos archivos ya se habían borrado; desde ahora cada build conserva los módulos previos que una pestaña aún puede necesitar. En Coach Aurora → Alumnos → Pausa ficticio, comprobar Alimentación, Medidas básicas y progreso y Exportar PDF o Excel. En Ejercicios, buscar «Press de banca con barra»: se muestran «Pecho» y «Tríceps» y la ficha indica las zonas trabajadas. La migración 035 actualiza los 56 ejercicios base de la demo sin restablecer los datos. La clasificación de zonas es una orientación general; el coach puede crear y editar sus ejercicios propios.

**Actualización 26-10-2026 — secuencia vigente:** en [la demo local](http://127.0.0.1:4180/acceso), abrir Ejercicios → Press de banca, Sentadilla goblet o Jalón al pecho. La ficha alterna **dos posturas cada 1,8 s**, sin botones; la tarjeta conserva una postura fija. Los tres ejercicios base sin ilustración fiel muestran «Sin ilustración» en vez de animar palitos. [Acta y galería](../evidencias/secuencia-ejercicios-2026-10-26.md). Las notas inferiores son históricas.

**Actualización 26-10-2026 — ilustraciones vigentes:** demo local reconstruida en [127.0.0.1:4180/acceso](http://127.0.0.1:4180/acceso). En Ejercicios, abrir «Press de banca con barra», «Press de banca con mancuernas», «Press de pecho en máquina», «Sentadilla goblet» y «Jalón al pecho». La miniatura es fija; dentro de la ficha las tres posturas se alternan solas, sin botones. [Acta y captura móvil](../evidencias/ilustraciones-ejercicios-2026-10-26.md). La nota siguiente describe una entrega anterior.

**Actualización 26-10-2026 — pictogramas:** la demo local muestra dos vistas estáticas por ejercicio en el catálogo; ya no reproduce esquemas animados. Probar Ejercicios → Press de banca con barra, Press de banca con mancuernas, Sentadilla con barra y Dominadas. [Acta y capturas](../evidencias/pictogramas-estaticos-2026-10-26.md).

**Actualización 26-10-2026 — T17:** demo privada disponible en [127.0.0.1:4180/acceso](http://127.0.0.1:4180/acceso) desde este PC. Bases local y ficticia migradas hasta **034** sin reset. Para Antropometría, seguir la [guía específica](t17-antropometria.md); [evidencia](../evidencias/t17-antropometria-local.md). Si la base se detiene al reiniciar Windows, arrancar `scripts/forma.ps1 run db:local` antes de `scripts/manual-demo.ps1 start`. Los cortes T16 debajo son históricos.

**Actualización vigente 24-10-2026 — T16 lista para prueba:** demo **activa** en [127.0.0.1:4180/acceso](http://127.0.0.1:4180/acceso), solo desde este PC. Build final y migración 032 aplicadas a la base ficticia; cuentas y cambios conservados. Hay 56 ejercicios base con esquemas originales. [Resultado y capturas](../evidencias/t16-catalogo-y-prueba.md). Las notas de parada y migración 031 inmediatamente inferiores son históricas. Las credenciales siguen en [.local/manual-demo/ACCESOS.md](../../.local/manual-demo/ACCESOS.md).

**Actualización vigente 24-10-2026 — T16:** demo local **detenida** tras la revisión; datos y cuentas ficticias conservados. Base `forma_manual_demo` migrada hasta 031 y build vigente. Se revisó el recorrido autenticado del coach en ventana móvil de 390 px: [acta y capturas T16](../evidencias/t16-segundo-corte.md). Para retomar, iniciar con los comandos de la sección 4; no ejecutar `manual-demo-prepare.mjs` sobre la base ya lista para intentar regenerar datos. La prueba en teléfono físico sigue pendiente.

**Actualización 24-10-2026 — T15:** demo encendida durante aquella revisión, build y recorrido breve móvil/PC aprobados. [Acta y capturas](../evidencias/t15-revision-local.md), [manual histórico](t15-interfaz-y-contenido.md). No hubo reset; cuentas/datos conservados.

**Actualización 23-10-2026 — T15:** demo detenida por petición del usuario; datos/accesos conservados. 024 aplicada, fuentes v0.15.0. No arrancar o compilar hasta nueva indicación. La interfaz nueva y últimos ajustes de navegación requieren revisión: [manual T15](t15-interfaz-y-contenido.md), [acta](../evidencias/t15-redisenio.md).

**23-10-2026 · aplicación v0.14.2/023 · entorno local preparado.** [Resultado HTTP](../evidencias/t14-demo-privada.json), [comparativa de alojamiento](../piloto/05-alojamiento-privado.md). No es un despliegue ni un piloto con personas reales.

## Objetivo y alcance

**Usuario:** titular del proyecto. **Problema:** necesita recorrer la app con cuentas y contenido ya preparados. **Alternativa:** crear cada ficha manualmente o usar la demo visual sin persistencia real. **Resultado:** entorno persistente separado que permite cambiar estados y guardar entrenamientos ficticios. **Soporte:** PostgreSQL local existente, API y preview del build ya verificado; sin servicios nuevos instalados. **Parada:** sin ampliar infraestructura, incorporar datos reales o publicar sin elegir entorno y protección.

## 1. Abrir y entrar

- URL en **este PC**: [Abrir Forma de prueba](http://127.0.0.1:4180/acceso).
- Usuarios y contraseña ficticia generada: [.local/manual-demo/ACCESOS.md](../../.local/manual-demo/ACCESOS.md). Este archivo es privado y está excluido de Git. No copiar esa contraseña a las guías públicas ni reutilizarla al desplegar.
- La misma contraseña de prueba sirve para las ocho cuentas de este entorno. Cada una tiene su sesión y rol.
- Abrir coach y alumno en navegadores/perfiles distintos o una ventana privada. Pestañas del mismo perfil comparten cookies: entrar como alumno reemplaza la sesión del coach.
- La aplicación no entra automáticamente en el modo de diseño `/demo`: estas cuentas usan PostgreSQL y permisos reales sobre datos sintéticos.

| Perfil ficticio | Usuario | Qué probar |
|---|---|---|
| Administrador | admin.prueba@example.test | Precio, cupo, habilitación y pago mensual de coaches |
| Coach Aurora | coach.aurora@example.test | Alumnos, mensualidades, rutinas y seguimiento |
| Coach Brisa | coach.brisa@example.test | Otro espacio aislado, con su alumna y rutina propias |
| Coach pendiente | coach.pendiente@example.test | Alta sin habilitar, cupo 0; aprobar desde admin |
| Luna, activa/pagado | alumno.luna@example.test | Programa, sesión/historial, progreso y chat |
| Sol, activo/pendiente | alumno.sol@example.test | Sesión nueva y acceso separado de la marca de pago |
| Alumno pausado | alumno.pausa@example.test | Acceso bloqueado aunque el mes esté marcado pagado |
| Mar, del coach Brisa | alumno.mar@example.test | Portal del segundo coach |

Aurora tiene además una ficha invitada `invitado@example.test`, sin cuenta: no es un noveno login. Todos los nombres, correos y contenidos son ficticios.

## 2. Datos ya cargados

- Base `forma_manual_demo`, storage `.local/manual-demo/storage`; no se mezclan con la base de trabajo `forma`.
- Tres coaches independientes; Aurora y Brisa habilitados, tercero pendiente. Precio de ejemplo 125000/95000 PYG y cupos 5/2, modificables desde admin. Son valores sintéticos, no oferta comercial.
- Cuatro alumnos con cuenta y una ficha invitada. Aurora conserva dos activos, uno pausado y uno invitado; Brisa tiene una alumna activa.
- Dos programas publicados de dos semanas, cuatro asignaciones, cuatro ejercicios ficticios sin vídeos/fotos.
- Una sesión de Luna completada parcialmente, tres mediciones ficticias y dos mensajes de chat.
- Marcas del mes **2026-10**: coach Aurora pagado, Brisa pendiente; Luna pagado, Sol pendiente y alumno pausado pagado. Un mes distinto no hereda estas marcas.
- Cero archivos de personas, medios, PDFs, correos enviados o dinero procesado. Cero workers iniciados.

Las rutinas y mediciones sirven para ensayar la interfaz, no son recomendaciones profesionales. El contenido tiene fechas de preparación: si se prueba semanas/meses más tarde, asignar una rutina con fechas vigentes y seleccionar el mes correcto. No cambiar fechas del sistema ni modificar SQL histórico para que aparezca actual.

## 3. Recorrido sugerido, 15–20 minutos

1. **Admin:** entrar, buscar Aurora y cambiar precio/cupo con motivo. Dejar el cupo por encima de sus alumnos activos. Ver que marcar pagado no cambia su acceso.
2. **Coach Aurora:** abrir alumnos y mensualidades. Marcar a Sol pagado y comprobar que solo cambia la marca del mes. Cambiar de mes y volver a 2026-10.
3. **Sol, en otra sesión:** abrir programa, iniciar un día, registrar una serie y finalizar con parcial si corresponde. Volver a entrar y comprobar que sigue guardado.
4. **Luna:** abrir historial/progreso y leer/responder el chat. Sus mediciones no se comparten automáticamente con el coach; usar los permisos específicos si se quiere probar esa consulta.
5. **Coach:** pausar a Sol y refrescar su sesión de alumno; debe quedar bloqueada. Habilitarlo dentro del cupo y volver a comprobar. El alumno pausado inicial muestra otro caso: pagado no equivale a habilitado.
6. **Admin:** suspender Aurora y comprobar bloqueo de coach y alumnos. Restaurar; los alumnos individualmente pausados deben continuar pausados.
7. **Coach Brisa:** confirmar que solo aparecen Mar y sus propios contenidos. El administrador de plataforma no se convierte en coach de esos alumnos.
8. **Coach pendiente:** entrar para observar `/estado`. Desde admin definir cupo/precio y habilitar; usar Comprobar de nuevo en su sesión.

Anotar ruta, paso, dispositivo, resultado esperado y observado. Las pruebas de desconexión empiezan después de preparar la sesión, con el build instalado; no suponer que todos los módulos funcionan sin red.

## 4. Encender y detener sin regenerar datos

El entorno está detenido al cerrar T16. Para volver a abrirlo en este PC, desde la raíz del proyecto:

```powershell
.\scripts\forma.ps1 run db:local
.\scripts\manual-demo.ps1 start
```

Estado y parada de **solo** esta API/web:

```powershell
.\scripts\manual-demo.ps1 status
.\scripts\manual-demo.ps1 stop
```

La parada conserva cambios y no apaga PostgreSQL, porque puede usarlo otro proceso del proyecto. API de la demo en 127.0.0.1:3010, interfaz en 127.0.0.1:4180. Si un puerto está ocupado, revisar el proceso; el arranque no mata servicios ajenos. La parada verifica ID de instancia y proceso registrado antes de terminarlo.

Preparación inicial reproducible en otra instalación **local ya preparada**, sin reinstalar dependencias:

```powershell
.\scripts\forma.ps1 exec tsx scripts/manual-demo-prepare.mjs
.\scripts\manual-demo.ps1 start
```

La preparación crea su propia base y aplica las migraciones disponibles al momento de una **instalación nueva**. Si ya está lista, conserva los cambios y no aplica automáticamente migraciones nuevas: antes de iniciar una versión posterior ejecutar `./scripts/forma.ps1 exec tsx scripts/manual-demo-migrate.mjs` con la base local activa. En este PC ya se aplicaron 001–032. Una base con ese nombre sin perfil propio o una preparación parcial exige revisión técnica, sin borrado automático. Las credenciales de conexión se derivan del entorno local y nunca se escriben en el dossier de acceso. La contraseña de las cuentas ficticias se genera por instalación.

## 5. Límites de esta prueba

- `127.0.0.1` es este PC; abrir esa dirección en el móvil apunta al propio teléfono. Esta instancia escucha solo en loopback, sin regla de firewall o enlace público creado.
- Sirve para probar flujo y tamaño de ventana en PC. No acredita Safari/iPhone/Android físicos, instalación PWA móvil o acceso remoto.
- Vídeos, conversión de adjuntos, PDFs, correo real y automatizaciones necesitan sus workers/infraestructura. No iniciarlos por defecto con recursos limitados; probarlos cuando se prepare expresamente ese módulo. Ningún estado pendiente de cola equivale a un archivo ya procesado.
- Para un teléfono, elegir primero la opción de la [comparativa](../piloto/05-alojamiento-privado.md), configurar un perfil HTTPS separado, origen/cookies/proxy correctos y protección anterior al registro. No basta con reenviar este puerto sin ajustar `APP_ORIGIN`.
- Para web privada, generar nuevas contraseñas y semillas propias del staging autorizado. No publicar `.local`, `.env`, storage o estas cuentas con contraseña compartida. La preparación local bloquea producción y no sirve como seed de producción.

## 6. Evidencia mínima de preparación

Preparación completada una vez, seguida de un recorrido HTTP breve contra la web servida: identidad de instancia, login admin y tres coaches, login coach y cuatro fichas, portal activo, pausa bloqueada y aislamiento del otro coach. [Informe sin credenciales](../evidencias/t14-demo-privada.json). Cero navegadores de prueba, PDFs, correos o suites históricas. No se reconstruyó la web.
