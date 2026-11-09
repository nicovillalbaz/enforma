# T16 — Segundo corte local: planes, mediciones y exportación

**24-10-2026. Estado: implementación local parcial, sin aceptación en teléfonos físicos ni piloto con datos reales.** Continúa el [primer corte](t16-primer-corte.md) y el [plan T16](../tandas/16-ficha-alumno-y-experiencia.md). Además de la demo de composición, se recorrió una cuenta ficticia autenticada con permisos reales.

## Código entregado

1. **Entrenamiento:** el editor admite indicaciones escritas sin ejercicio obligatorio; la biblioteca abre el catálogo disponible completo y permite crear ejercicio propio. El constructor usa un paso visible en escritorio y móvil, sin tres paneles con desplazamiento interno. Un borrador nunca publicado se puede eliminar con revisión dentro de la página; una versión publicada se conserva y se archiva. Migraciones 027 y 031.
2. **Alimentación del coach independiente:** el dueño puede escribir y publicar planes sin registrar otro profesional. El borrador empieza con días vacíos, notas libres y comidas opcionales; se puede crear desde la ficha del alumno y asignar con vigencia de día, semana o mes. Los diarios y fotos previos conservan su privacidad; el alumno debe expresar de nuevo el consentimiento para compartirlos con el coach. Migraciones 025 y 028. El PDF de menú admite las notas del día.
3. **Mediciones:** altura se registra como hecho fechado junto a peso y otras medidas. La corrección crea otro registro, anula el original con motivo y mantiene el vínculo `correctionOf`; el original permanece en historial. El coach ve las mediciones que registró y los hechos del alumno solo si éste los comparte. Migraciones 026 y 030.
4. **Ficha y documentos:** resumen del periodo, accesos a rutinas/alimentación/mediciones/historial/exportación, descarga XLSX por tipo y fechas, solicitud de PDF privado y lista de documentos compartidos en la cuenta del alumno. La ruta de exportación vuelve a verificar organización, alumno y permisos; limita el rango a 90 días y audita la descarga. Las cadenas en XLSX son celdas de texto, aunque empiecen por `=`. El PDF de progreso incorpora mediciones visibles bajo sus permisos (migración 029).
5. **Experiencia:** corregidos el fin de mes de la vigencia mensual, la invalidez de la vista previa al cambiar filtros y la etiqueta «Sin demostración» cuando un ejercicio solo tiene símbolo. La demo de inicio ahora muestra accesos y alumnos en lugar del hero y las métricas promocionales antiguas. El acceso y la pantalla de instalación móvil se compactaron; la firma NAVZ queda en un pie separado.

## Verificación puntual

- Migraciones 025–031 aplicadas a la base local, la base sintética `forma_manual_demo` y las bases aisladas de integración, sin editar sus archivos tras aplicarlas.
- `tests/integration/progress.test.ts`: **14/14**; incluye aislamiento entre alumnos, Excel, privacidad y corrección idempotente de mediciones.
- `tests/integration/nutrition.test.ts`: **9/9**; actualizado al coach independiente, consentimiento v2 y PDF privado.
- XLSX pequeño abierto por `openpyxl 3.1.5`: número correcto y `=2+2` conservado como texto.
- `npm run build`: **aprobado** tras cambiar el paso del manifiesto PWA a `tsx`, compatible con el Node local. Incluye chequeo de tipos, Vite y shell offline. La vista previa se detuvo al acabar la revisión.
- Capturas locales: [acceso 390](t16-login-390.png), [instalación 390](t16-install-390.png), [demo 390](t16-demo-390.png) y [demo 1366](t16-demo-1366.png). El ancho del documento coincidió con 320, 390 y 1366 px en las pantallas observadas. No se ensayó teclado, 200 % de texto ni PWA instalada en dispositivo.
- Con coach Aurora autenticado y datos ficticios: [Inicio](t16-coach-home-390.png), [Alumnos](t16-coach-students-390.png), [ficha de Luna](t16-coach-student-390.png), [Rutinas](t16-coach-routines-390.png), [Alimentación](t16-coach-nutrition-390.png) y [Exportar](t16-coach-export-390.png), a 390 px. En esas rutas el documento midió 390 px, `/record` respondió 200 y el retroceso del navegador desde Rutinas y Alimentación devolvió a la misma ficha. Es una comprobación de navegación y composición, no acredita aún creación/publicación/descarga de extremo a extremo.

## Pendientes de aceptación y alcance

| ID | Estado al cierre de este corte | Siguiente comprobación |
|---|---|---|
| T16-01/02 | Composición y acceso revisados en navegador local; coach autenticado revisado a 390 px. Falta recorrido visual completo en otros anchos. | Revisar rutas restantes a 320/1366 y luego iOS/Android físicos. |
| T16-03/04 | Ficha contextual; retroceso de Rutinas y Alimentación a la misma ficha comprobado con coach. Editores aún viven en sus páginas y hay confirmaciones globales heredadas. | Recorrer padre inmediato y borradores sin guardar en cada paso, también como alumno. |
| T16-05 | Texto libre, publicación/archivo y borrado seguro de borrador disponibles. | Probar creación/asignación/edición y consulta del alumno de punta a punta. |
| T16-06 | 11 símbolos originales y creación de ejercicios propios; catálogo base pequeño. | Auditar licencias por imagen/clip y validar técnica con un coach antes de importar un catálogo amplio. No se incorporaron medios externos sin permiso verificable. |
| T16-07 | Autoría del coach, borrador flexible y permisos implementados; 9 pruebas de integración. | Verificar editor móvil, menú publicado, asignación y PDF resultante con la cuenta del alumno. |
| T16-08 | Altura y corrección histórica implementadas; prueba dirigida. | Revisar los rótulos, unidades y retorno desde cada medición en móvil. |
| T16-09 | XLSX privado y PDF mediante documentos existentes; límites y permisos en API. | Descargar ambos formatos desde dos cuentas reales sintéticas y comprobar revocación después de compartir. |
| T16-10 | Capturas locales y build, sin aceptación física. | Prueba de uso en iPhone/Android, conexión intermitente, instalación y zoom accesible; cerrar puertas del piloto. |

**No se declara T16 al 100 %.** Faltan el catálogo visual con derechos auditados, el recorrido completo de creación y consulta con ambas cuentas, la revisión de navegación restante y la aceptación en dispositivos reales. El coach define su propio contenido; la plataforma no aporta prescripciones técnicas ni valores dietéticos inventados.
