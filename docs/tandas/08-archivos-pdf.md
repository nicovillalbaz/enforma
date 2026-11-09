# T08 — Archivos privados, recursos y PDF

**Estado 21-10-2026:** base implementada en local, v0.8.0, migración 017 aplicada. [Uso y operación](../runbooks/t08-uso-y-operacion.md), [API](../runbooks/api-t08.md), [ADR 008](../decisiones/008-recursos-y-pdf.md), [acta](../evidencias/t08.md). Se conserva el presupuesto de pruebas puntuales. Antivirus real, teléfonos, contenedor y restauración con documentos nuevos siguen como puertas externas.

**Depende de:** T07 y servicio de medios T03. **Objetivo:** compartir materiales e informes dentro del portal sin Drive.

## Base técnica y puertas al entrar desde T07

PWA/cuenta SaaS locales en v0.7.0, migraciones 001–016; siguiente 017. Reutilizar almacenamiento/worker/entrega privada T03 y snapshots T04–T07. [ADR 007](../decisiones/007-pwa-y-cuenta-saas.md) y [operación](../runbooks/t07-uso-y-operacion.md).

Comprobantes financieros están fuera de biblioteca general, con acceso owner/superadmin y auditoría inmutable. No convertir un PDF de cuenta comercial en factura fiscal ni permitir que compartir recursos educativos exponga recibos o fotos de progreso. Mantener inventario de backups, cuotas y bloqueo de mantenimiento.

Piloto real, teléfonos, SMTP/TLS/externo y política integral de datos siguen abiertos en [puertas](../piloto/00-puertas.md). T08 puede prepararse técnicamente sin declarar aceptación comercial de T07; archivos/PDF no cierran esas puertas.

## Pasos en orden

1. **T08-01 Permisos de carpeta/archivo.** Definir propietario, ámbito organización/alumno/grupo, lectura, carga y revocación. Migrar carpetas, entradas, relaciones de compartición y versiones; no inferir permiso solo por `organization_id`.
2. **T08-02 Biblioteca.** Subir documento/foto/vídeo dentro de cuota, organizar/mover/renombrar, buscar, previsualizar y compartir con alumno. Validar MIME real, escanear archivos arbitrarios y registrar acceso/descarga sensible.
3. **T08-03 Material educativo.** Colecciones simples de recursos del coach enlazables a programa o ficha; reutilizar mismo medio sin copiar bytes. No construir curso completo todavía.
4. **T08-04 Motor PDF.** Plantillas versionadas HTML/CSS para rutina, historial e informe; logo/colores del coach y zona/fecha correctas. Worker genera, guarda estado y archivo privado; reintentos y cuota por plan.
5. **T08-05 Entrega.** Alumno abre/descarga desde portal; enlace autorizado temporal. Revocar compartición bloquea nuevas descargas aun con ID conocido.
6. **T08-06 QA.** Archivo grande/corrupto, PDF largo, caracteres españoles/guaraníes, cambio de marca, cola caída, enlace revocado, usuario de otro tenant. Revisar visualmente PDF en móvil y escritorio.

## Aceptación y evidencia

Coach comparte un manual, genera PDF de rutina con marca y alumno lo consulta en iPhone sin enlace público ni Drive. Coach B y alumno no asignado no pueden abrir el recurso. El historial del PDF conserva la plantilla/version usada.

## Tablero de ejecución

| Tarea | Resultado local | Pendiente específico |
|---|---|---|
| T08-01 | Colecciones, recursos/versiones, autor/owner, permisos por alumno y RLS; compartir lote actual atómicamente | Grupos formales en T13; políticas integrales antes de datos reales |
| T08-02 | Búsqueda/lotes, alta/edición/movimiento/archivo, medios reutilizados y PDF en cuarentena | Servicio ClamAV real; no admitir formatos adicionales por extensión |
| T08-03 | Colecciones con descripción y relación a ficha/versión, sin copiar medios ni conceder permiso por asociación | Cursos completos fuera del alcance |
| T08-04 | Rutina/historial/informe, snapshot/plantilla/marca, worker secuencial, cuota, reintento y cancelación | Contenedor de producción y muestras visuales específicas de historial/informe |
| T08-05 | Vínculo de cinco minutos con sesión/cookie HttpOnly, permiso revalidado por archivo/rango, revocación probada | Visor y descarga de iPhone/Android físicos; copia externa no revocable |
| T08-06 | Nueve casos dirigidos, dos unitarias, una revisión UI de 13 s y PDF final de siete páginas | Aceptación física y restauración T08 no ejecutadas; no repetir suites por rutina |

## Secuencia de demostración y operación

1. Aplicar 001–017; arrancar web/API y worker documental cuando se necesite. Mantener un proceso documental y no iniciar antivirus pesado en este equipo.
2. Crear colección → recurso → añadir medio listo o solicitar PDF de una asignación. Subida de PDF propio solo con escáner real configurado.
3. Actualizar estado → abrir versión ready → revisar muestra/plan/fecha/marca. El mes y cuota son del estudio; no se mezclan con pagos SaaS.
4. Compartir con un alumno administrable → alumno prepara vínculo → abre/descarga → responsable revoca → enlace anterior denegado.
5. Archivar retira acceso; mantenimiento cumple 30 días y coordina referencias/bloqueos con backup. Conservar auditoría y versión histórica.
6. Reutilizar [evidencia](../evidencias/t08.md). Ante un cambio puntual ejecutar solo el caso afectado; no lanzar la matriz T01–T07 ni otra restauración para obtener el mismo resultado.

## Puente a T09

Siguiente migración: 018. Reutilizar patrón de versión/snapshot y motor PDF con una plantilla nueva para menús, sin modificar una plantilla publicada. Diario/fotos de alimentación necesitan su modelo y permisos de T09; no convertirlos automáticamente en recursos educativos compartidos. Mantener las puertas de T07 y las pendientes de T08.



## Actualización de alcance T13

La decisión vigente limita el producto a coaches independientes. Cualquier referencia previa a equipos, sedes, recepción o grupos formales como entrega T13 queda sustituida por [consolidación individual](../tandas/13-gimnasios.md); [multicoach se aplaza](../pendientes/gimnasios-futuro.md) fuera de las tandas actuales.

