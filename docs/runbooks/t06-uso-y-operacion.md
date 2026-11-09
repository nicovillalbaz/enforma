# T06 — Uso y operación del seguimiento

**Entrega local 0.6.0.** [Decisiones](../decisiones/006-progreso-y-privacidad.md), [contratos](api-t06.md), [cálculos](../evidencias/t06-calculos.md) y [acta](../evidencias/t06.md).

## 1. Preparación local

1. Seguir [desarrollo](desarrollo.md): PostgreSQL local, `.env` y servicios. No compartir credenciales ni subir `.env` al repositorio.
2. Ejecutar `npm run db:migrate` con Node 24; PowerShell puede usar `./scripts/forma.ps1 run db:migrate`. Aplicar 001–013 en orden. No modificar migraciones ya aplicadas; la siguiente empieza en 014.
3. Abrir `http://127.0.0.1:5173/acceso` y entrar con una cuenta ficticia del manual. Mantener API, web y worker de medios activos.
4. Preparar un entrenamiento asignado, registrar al menos una serie y finalizar. Una sesión en curso no genera volumen oficial; una parcial finalizada sí. No introducir datos de personas reales en esta instalación de prueba.

## 2. Alumno: entrenamiento y gráfico

1. En navegación inferior elegir **Progreso**. También hay acceso desde Hoy. **Historial de sesiones** sigue disponible dentro de Progreso y Entrenar.
2. Elegir Desde/Hasta y aplicar (máximo 366 días, sin futuro). Revisar días finalizados/exigibles, sesiones parciales y volumen conocido.
3. Abrir **Ver tabla de volumen por semana** para consultar exactamente los valores graficados; semanas sin realización muestran cero. La comparación indica cuándo no hay base anterior.
4. Elegir un ejercicio: consultar carga máxima realizada y repeticiones de esa serie, o tiempo/distancia máximos registrados. Una marca programada no acredita realización.
5. Si no coincide con el teléfono, revisar entrenamiento: cambios locales pendientes no están en el servidor. Sincronizar T05 y volver a Progreso. Reabrir una sesión la retira de métricas hasta cerrarla de nuevo.
6. Para revisar cada serie, abrir Historial y filtrar fecha/estado. Se conserva la versión histórica y el detalle objetivo frente a realizado.

## 3. Mediciones opcionales

1. Abrir **Mediciones** y elegir Peso/Cintura/Cadera/Pecho/Brazo/Muslo. La unidad se fija automáticamente; peso en kg, perímetros en cm.
2. Introducir valor positivo y fecha, pulsar **Guardar medición** y esperar confirmación. Ante error de red se conserva el formulario; reintentar la misma intención no duplica el registro.
3. Consultar gráfico y tabla: último valor válido de cada fecha. El historial conserva todos los registros y su origen, incluso anulados.
4. Para corregir, pulsar **Anular con motivo**, explicar el error y añadir el valor correcto como nueva medición. No existe edición silenciosa del pasado.
5. Estas mediciones se consultan con conexión. No entran en IndexedDB ni en la caché offline del entrenamiento.

## 4. Privacidad y fotos

1. Abrir **Privacidad**. Las mediciones son propias; un profesional no obtiene permiso por ser dueño del estudio.
2. Marcar Mediciones para cada profesional con quien se quieran compartir. Le permite consultar y registrar, identificando su origen. Guardar privacidad y comprobar que desaparece el aviso de cambios.
3. Para fotos, activar consentimiento maestro y guardar. Se puede activar sin compartirlas con ningún profesional. Fotos sigue siendo opcional para todas las demás funciones.
4. Abrir **Fotos**, escoger PNG/JPEG/WebP de hasta 2 MB y 8 MP (no HEIC/animación), fecha y descripción opcional. Guardar y esperar miniatura confirmada. No se almacena el original; se normaliza orientación y se eliminan metadatos.
5. Para compartir, volver a Privacidad, marcar Fotos por profesional y guardar. Solo responsables/coaches activos elegibles aparecen en la lista.
6. Para retirar acceso a un profesional, desmarcar y guardar. Las peticiones posteriores a la misma URL quedan denegadas; al volver a la pestaña se revalida. No se pueden retirar copias ya descargadas por alguien autorizado.
7. Eliminar una foto o retirar el consentimiento maestro oculta las fotos inmediatamente. Retirar el consentimiento elimina todas las activas; reactivarlo no las restaura. Reintentar una subida antigua devuelve conflicto y tampoco las restaura. Los bytes se depuran después de 30 días; copias históricas mantienen su propia retención.
8. Los cambios de privacidad sin guardar piden confirmación al salir/cambiar estudio/cerrar sesión. Si otra pantalla guardó antes, actualizar ante conflicto de revisión y revisar las casillas.

## 5. Coach: seguimiento y ficha

1. Abrir **Progreso**: tarjetas de alumnos gestionables con sesiones/volumen de 28 días y último cierre. Coach ve asignados; responsable ve los que puede gestionar.
2. Buscar por nombre y usar Cargar más. Abrir Ver progreso para el panel individual; también desde Alumnos → ficha → Abrir progreso y mediciones. La ficha incluye resumen confirmado.
3. Revisar adherencia y días anteriores sin finalizar, pendientes hoy y cancelaciones. Una ausencia no identifica por sí sola su causa; comprobar planificación con contexto.
4. Ajustar aviso de inactividad entre 7 y 90 días o desactivarlo. Se guarda para ese profesional/alumno; no envía mensajes ni cambia acceso.
5. Mediciones/Fotos muestran explicación privada si no hay permiso. Tras concesión se puede consultar; el profesional solo puede anular mediciones que él creó. No puede subir ni eliminar fotos del alumno.

## 6. Operación, cuotas y recuperación

1. Revisar cuota de biblioteca: incluye bytes de fotos sin mostrar datos privados a personal sin permiso. Reservas de medios, logos y fotos comparten presupuesto, protegido por bloqueo de estudio. No liberar cuota antes de depurar bytes retenidos.
2. Ejecutar mantenimiento habitual `npm run media:maintenance`; usa el mismo bloqueo exclusivo que la coordinación de backups y limpia fotos eliminadas de más de 30 días. Auditoría conserva filas sin claves/bytes; no reaparecen en la interfaz.
3. Ante fallo de subida, no declarar éxito. La transacción revalida consentimiento/cuota y elimina archivos nuevos si falla o si un duplicado reutiliza el registro existente. Huérfanos de una caída se limpian con el mantenimiento de T03, después de 24 horas y fuera de una copia en curso.
4. Crear backup cifrado con el procedimiento existente; la clave se gestiona fuera del repo. El inventario incluye versión normalizada y miniatura de fotos, también retenidas hasta depuración.
5. Ensayar restauración en DB y directorio nuevos, verificar hashes/referencias y **13 conteos**: usuarios, auditoría, programas, versiones, asignaciones, sesiones, series, eventos, mediciones, fotos, privacidad, compartición y avisos. No restaurar sobre una instalación activa ni reactivar consentimientos desde una copia antigua sin reconciliar revocaciones posteriores.
6. Antes del piloto, concretar retención/exportación/borrado integral y política de menores con la revisión prevista en T07. T06 no acredita políticas legales ni despliegue, respaldo externo o aceptación física.

## 7. Lista de QA para continuar en T07

- iPhone/Safari y Android reales: teclado decimal, fechas, rotación, texto ampliado, safe areas, selector de archivos y fotos con orientación; error comprensible ante HEIC/gran tamaño.
- Dos cuentas/estudios: no aparecen medidas/fotos cruzadas, revalidación al volver del fondo, cierre de sesión limpia vista; API y fotos ausentes de CacheStorage.
- Revisión de tablas/gráficos con lector de pantalla y zoom real; inputs de 16 px evitan ampliaciones de foco habituales sin bloquear zoom accesible.
- Instalación y arranque frío de T07 mantienen solo shell público; las fotos/mediciones siguen requiriendo red/autorización. Conservar los límites WebKit Windows documentados en T03/T05.
