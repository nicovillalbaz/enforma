# Acta T15 — Rediseño y contenido propio

**Continuación 24-10-2026:** usuario autorizó volver a probar. Build vigente y revisión dirigida concluidos; [acta con límites y capturas](t15-revision-local.md). Demo encendida para aceptación manual. El contenido siguiente conserva lo efectivamente ejecutado hasta la pausa del 23-10.

**23-10-2026 · implementación local v0.15.0 · migraciones 001–024; próxima 025.** Tanda abierta. [Plan](../tandas/15-redisenio-mobile-first.md), [manual](../runbooks/t15-interfaz-y-contenido.md), [ADR](../decisiones/017-redisenio-y-autoria-coach.md).

## Implementado en fuentes

- Escala compacta, Inter para títulos, espacio reducido, barra lateral simplificada y Más sin eliminar módulos.
- Alta/ficha de alumno en páginas. Biblioteca, guías, versiones, cancelaciones y fotos dejan de usar diálogos de la app.
- Constructor por Estructura/Ejercicios/Revisar en todos los tamaños; desaparecen la composición de tres columnas, sus scrolls verticales y la barra de acciones flotante.
- Objetivo/categoría/material/ubicación libres con opciones guardadas por propietario/espacio; catálogo propio por defecto.
- Serie inicial vacía sin repeticiones/cargas/tiempos/RPE sugeridos; unidad de ejercicio sin selección inicial.
- Creación de ejercicio dentro del constructor conservando el editor montado.
- Once pictogramas originales opcionales con dos poses; clip con controles/bucle. No se importó una biblioteca deportiva externa.
- Entrada móvil de instalación y continuación en navegador.
- Confirmaciones y solicitud de motivo en página. La advertencia de cierre de pestaña y la instalación nativa dependen del navegador.
- Firma NAVZ conservada. Sin cambio del modelo de acceso/cobro mensual manual.

## Evidencia ejecutada

| Comprobación | Resultado y alcance |
|---|---|
| Opciones vacías/guardado idempotente/aislamiento API y SQL/usuario inhabilitado | Un caso nuevo aprobado en la primera ejecución; [informe inicial](t15-opciones-pruebas.json) |
| Ejercicio libre/símbolo congelado/publicación/edición | Fallo inicial de permiso de columna detectado; se añadió `GRANT UPDATE(visual_key)` a 024 antes de aplicarla a bases persistentes. Se repitió **solo ese caso**: 1 aprobado/1 omitido; [informe](t15-simbolos-pruebas.json) |
| Confirmación explícita y rechazo de segunda acción pendiente | Un caso unitario aprobado; [informe](t15-confirmacion-pruebas.json). No acredita todos los flujos asíncronos de la UI |
| Tipos + build | Dos compilaciones terminadas antes de atender la petición de apagado, ambas con tipos aprobados. La última generó 86 assets de shell, 87 artefactos y huella de 146 fuentes. No se volvió a compilar tras la petición |
| Lint dirigido | Primera revisión detectó un import sin usar; corregido. Segunda revisión de los archivos afectados aprobada. Ajustes finales de navegación posteriores separados abajo |
| Ajustes finales estáticos | Lint dirigido de nueve archivos aprobado y sintaxis de marcado de ocho Vue aprobada; sin ejecutar app/build/navegador ni repetir pruebas |
| Migración persistente | 024 aplicada una vez a `forma` y una a `forma_manual_demo`; sin reset o siembra adicional |
| Ejecución | Demo detenida conservando datos; comprobación de listeners sin 3010/4180/3000/5173 activos |

Las dos integraciones se ejecutaron en bases temporales aisladas, ya eliminadas. No se repitió una suite histórica ni una restauración.

## Cambios posteriores al último build

Se sustituyó la navegación implícita por selección de alumno por enlaces/acciones de ruta explícitos; se protegió la carga de ficha contra respuestas tardías; se quitó el progreso duplicado de la ficha; se añadió advertencia al abandonar el alta; se sincroniza el ID guardado de rutina con su navegación y se cancelan revisiones pendientes al cambiar de ruta. También se evita un cambio redundante de paso al añadir un ejercicio.

Estos ajustes de fuentes **no tienen un build final ni un recorrido de navegador posterior**. El usuario pidió seguir programando con app/build apagados. No se intentó reactivar la demo para presentar capturas o validar visualmente el resultado. La huella del build anterior puede quedar desactualizada frente a estas fuentes: reconstruir solo cuando el usuario vuelva a pedir ejecución.

## Pendiente, sin afirmación de cierre

1. Revisión visual móvil/PC y Atrás/Adelante del navegador; pérdidas de borrador, teclado, zoom y desbordes de textos largos.
2. Flujo de crear ejercicio dentro de rutina, cancelar salida y volver a una guía conservando el contexto.
3. Aceptación del diseño por el usuario. **No hay capturas nuevas inspeccionadas de este rediseño.**
4. Instalación y uso en iPhone/Android físicos; vídeo/procesamiento real según puertas de T14.
5. Restauración del esquema 024, cuyo backup prevé 86 indicadores; no se ejecutó otro ensayo.
6. Ampliación de animaciones instructivas solo con revisión del coach y medios autorizados. Once símbolos no cubren todos los ejercicios.
7. Adaptar selectores E2E antiguos a las nuevas páginas antes de elegir el siguiente caso dirigido. No hay nueva acreditación de toda la aplicación.

No hubo despliegue, compra, envío de mensajes/correo, cobros, PDF, descargas masivas, carga o nueva instalación de dependencias. La base local no equivale a piloto real.
