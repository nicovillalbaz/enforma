# T17 — Primer corte local, 24-10-2026

El usuario encontró dos defectos concretos al probar T16: una página de progreso con campos y botón a distinta altura, y una ficha invitada que abría Alimentación con 403. Se revisó además el `401` de `/v1/auth/me` al abrir la pantalla pública de acceso. Este acta documenta únicamente los arreglos locales; la [antropometría ISAK y otras modalidades](../tandas/17-antropometria-y-densidad-visual.md) siguen planificadas.

## Cambios

- El guard público deja de hacer la consulta de sesión. Las rutas privadas todavía verifican sesión y conservan el control de acceso.
- Alimentación verifica primero la ficha pedida. Si está invitada, pausada o archivada, abre el catálogo del coach sin pedir el menú de ese alumno, muestra su estado y permite regresar a su ficha. No cambia a otro alumno por defecto. La API mantiene el 403 para peticiones directas no autorizadas.
- Editar ficha ya no imprime `>`; Invitación/Gestionar acceso no repiten encabezados; «Mis opciones» tiene estilo y foco. Progreso suprime copy promocional y alinea dos fechas con el botón por una cuadrícula. Se anuló el margen global de 14 px que sobrevivía por precedencia CSS; los tres controles miden 46 px.
- El antiguo registro de medidas sigue siendo **básico**. No se introdujo ni presentó un porcentaje de grasa sin protocolo, sitios, réplicas y fórmula verificada.

## Verificación mínima

- `npm run typecheck`: correcto. `npm run build`: correcto después del ajuste final; manifest local de 152 fuentes y 85 artefactos.
- Un recorrido Chromium en la demo ficticia comprobó: abrir `/acceso` sin cookie da **0** llamadas `/v1/auth/me`; login del coach Aurora; abrir `/alimentacion?studentId=f7125d6f-b197-49d6-947d-843bba43c567` muestra que se puede preparar un menú y **no** pide alimentación con ese ID ni recibe 403.
- En `/progreso` a 1366 px, los dos inputs y el botón tienen **46 px** de alto y la misma coordenada inferior. A 390 px el botón está en la fila inferior y el documento no desborda horizontalmente. La primera ejecución detectó margen residual; se corrigió y solo se repitió ese recorrido.
- Demo activa únicamente en `127.0.0.1:4180` en este PC, con cuentas ficticias conservadas. No se ejecutaron suites completas, migraciones ni pruebas físicas iOS/Android. Tampoco se ha hecho aún la auditoría de todas las filas campo/botón de la app.
