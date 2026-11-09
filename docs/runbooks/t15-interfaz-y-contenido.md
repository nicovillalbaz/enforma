# T15 — Uso y continuidad del rediseño

**23-10-2026 · código v0.15.0 · DB 024.** [Plan visual y tareas](../tandas/15-redisenio-mobile-first.md), [decisión](../decisiones/017-redisenio-y-autoria-coach.md), [evidencia](../evidencias/t15-redisenio.md).

## Estado de ejecución

**24-10-2026:** el usuario pidió volver a probar, revocando la pausa del día anterior. La demo está encendida en http://127.0.0.1:4180/acceso y el build ya incluye los últimos ajustes. Tipos y recorrido dirigido aprobados; [acta y capturas](../evidencias/t15-revision-local.md). Sin procesos de build o pruebas automáticas en marcha. La aceptación manual y los teléfonos físicos siguen pendientes.

Si se reinicia el PC y PostgreSQL está apagado, arrancar primero la base local existente con `.\scripts\forma.ps1 run db:local`, después `.\scripts\manual-demo.ps1 start`. No volver a preparar o resetear datos para encender la demo.
Los datos ficticios persistentes se conservan en `forma_manual_demo`, separados de `forma`. Ambas bases recibieron la migración aditiva 024; no se reseteó ni volvió a sembrar ninguna. Los accesos locales siguen en `.local/manual-demo/ACCESOS.md` y no se copian a este documento.

## Recorrido previsto del coach

1. Alumnos → Nuevo alumno. Se abre una página; escribir nombre y correo. Objetivo es opcional y empieza vacío.
2. Escribir un objetivo propio. Guardar opción para reutilizar es una acción separada y explícita. Mis opciones solo contiene respuestas guardadas en este espacio.
3. Abrir ficha para datos, invitación o acceso. Progreso e historial tienen enlaces a sus páginas; no duplicar el panel entero dentro de la ficha.
4. Ejercicios → Nuevo ejercicio. Nombre, instrucciones y grupo/categoría los escribe el coach. Seleccionar expresamente la unidad de registro.
5. Material, variaciones y etiquetas son propios; equipo asociado se elige entre los equipos creados en el espacio. No hace falta asociar uno.
6. Opcionalmente elegir un símbolo, adjuntar imagen/clip autorizado o usar solo texto. El símbolo no determina instrucciones, categoría o repeticiones.
7. Rutinas → Crear → Estructura. Nombrar programa, semanas y días. Ejercicios → seleccionar de biblioteca propia o Crear ejercicio y añadirlo.
8. Introducir la prescripción. Los campos deportivos nuevos no contienen recomendaciones de la plataforma. Revisar → guardar/publicar → versiones/asignación.
9. Guardar borrador antes de recargar o cerrar. Cambiar de paso no guarda automáticamente en servidor. Ante salida con cambios, Volver en la revisión permite continuar editando.
10. Más reúne acompañamiento, negocio, instalación, perfil e información según permisos. Precios, cupos y pago mensual continúan definidos manualmente en sus paneles.

## Instalación móvil

- Primera visita con pantalla móvil/táctil: bienvenida de instalación antes del acceso. Continuar en navegador permite usar la app y omite esa bienvenida durante la sesión de navegador.
- Android compatible: el botón nativo aparece cuando el navegador lo ofrece; si todavía no lo ofrece, se muestran instrucciones de su menú.
- iOS: compartir → Añadir a pantalla de inicio → Añadir. La interfaz no puede forzar la instalación. Usar Safari para el ensayo físico.
- Una PWA detectada como instalada abre el contenido directamente. El modo instalado y las safe areas requieren ensayo físico; no hay una prueba real de instalación en esta entrega.
- La URL `127.0.0.1` solo funciona en este PC. La prueba desde el teléfono requiere el acceso HTTPS privado descrito en la guía T14, aún sin desplegar.

## Símbolos y vídeo

Los once SVG son identificadores originales con dos poses opcionales, no un curso de técnica. Respetan reducción de movimiento. El vídeo propio conserva controles y puede repetirse en bucle; no hay reproducción automática ni descarga masiva de medios externos. Las prescripciones y la corrección profesional corresponden al coach.

## API y datos

| Operación | Ruta / comportamiento |
|---|---|
| Leer opciones | `GET /v1/organizations/:organizationId/field-options` — propietario activo, solo su espacio |
| Guardar opción | `POST` a la misma ruta con `field` y `value`; devuelve `option`, reutiliza duplicado equivalente |
| Campos admitidos | `student_goal`, `exercise_group`, `equipment_tag`, `equipment_location` |
| Límites | 300 opciones por campo; objetivo 300 caracteres, ubicación 100, categoría/material 60 |
| Símbolo | `visualKey` opcional/nulo en ejercicio; selección explícita entre once claves |
| Versiones | Publicaciones nuevas congelan `visualKey`; cambiar biblioteca no altera una versión anterior |

La migración añade tabla con RLS y función de escritura restringida. Ningún alumno puede guardar opciones del coach ni consultar las de otro espacio. El dossier individual soporta 024 y omite el vocabulario compartido; una futura 025 requiere nueva revisión del inventario. Backup prevé 86 indicadores; su restauración del nuevo esquema queda pendiente antes de uso real.

## Continuar la prueba autorizada el 24-10-2026

1. Revisar el [acta vigente](../evidencias/t15-revision-local.md). Build y recorrido dirigido ya realizados: no repetirlos para cada acceso manual.
2. Probar el build vigente. Solo volver a compilar si un cambio concreto lo necesita. No instalar dependencias ni repetir las suites históricas.
3. La demo queda encendida para el usuario. Si está detenida, arrancar la existente con `scripts/manual-demo.ps1 start`; no volver a preparar/resetear datos.
4. Seguir el recorrido breve de T15-10, con una vista móvil y otra PC. Inspeccionar las capturas antes de dar por bueno el diseño.
5. Si existe un defecto, corregir y verificar solamente su caso. Mantener pendientes los ensayos físicos y externos que no se ejecutaron.
6. Detener con `scripts/manual-demo.ps1 stop`. Los cambios ficticios se conservan.

Las pruebas E2E antiguas que buscan títulos de modal o copy anterior necesitan adaptar sus selectores. No se ejecutaron ni se afirma que pasen con estas pantallas. La firma sigue siendo **Creado por NAVZ, +595972995557**.
