# Uso local de antropometría T17

**Alcance:** coach independiente y sus alumnos. La demo usa únicamente datos ficticios. La pantalla separa medidas básicas anteriores de evaluaciones antropométricas. Una medición ISAK exige técnica y formación; la app registra datos y detecta inconsistencias, pero no acredita al evaluador.

## Preparar la demo existente

1. Encender PostgreSQL existente: `.\scripts\forma.ps1 run db:local`.
2. Si se actualiza una instalación anterior, aplicar `033` y `034` con `.\scripts\forma.ps1 run db:migrate` y `.\scripts\forma.ps1 exec tsx scripts/manual-demo-migrate.mjs`. Los dos migradores conservan las fichas ficticias. En este PC ya se aplicaron ambas migraciones a `forma` y `forma_manual_demo`.
3. Iniciar `.\scripts\manual-demo.ps1 start` y abrir `http://127.0.0.1:4180/acceso` **en este PC**. Cuentas ficticias: `.local/manual-demo/ACCESOS.md`. No copiar su contraseña a guías o capturas.
4. Para detener solo la web/API usar `.\scripts\manual-demo.ps1 stop`. Los datos quedan guardados.

## Capturar una evaluación

1. Entrar como coach. Abrir **Alumnos → ficha → Antropometría → Nueva evaluación**. La ficha anterior de **Medidas básicas y progreso** continúa accesible.
2. Elegir **Perfil ISAK restringido** para 4 medidas base, 8 pliegues, 6 perímetros y 3 diámetros (21 sitios); **Medidas libres** para nombres propios; o **BIA/DXA externo** si se está transcribiendo un informe de un equipo. La lista no inventa objetivos, diagnósticos ni rutinas del coach.
3. Indicar fecha e instrumento. En BIA/DXA escribir equipo, valor reportado y, si consta, algoritmo. Las lecturas externas no se mezclan con pliegues.
4. En ISAK, avanzar un sitio por pantalla o usar **Ir a sitio**. Registrar 1–3 lecturas en la unidad mostrada; la app recomienda al menos dos para la estimación. Una tercera permite verificar discrepancias. **Guardar borrador** en cualquier punto conserva lo ingresado; una ficha incompleta no genera una cifra de grasa por omisión.
5. En **Revisar evaluación**, opcionalmente completar edad en la fecha medida y grupo de la ecuación si están los cuatro sitios requeridos. Para Durnin–Womersley son bíceps, tríceps, subescapular y cresta ilíaca; el artículo original denomina al último sitio suprailiaco. **Finalizar evaluación** fija una instantánea inmutable y la hace visible al alumno activo.
6. En detalle, revisar lecturas, valores seleccionados, sumas Σ4/Σ8, instrumento, advertencias y método. **Crear corrección** genera otro borrador con motivo; al finalizarlo se anula el anterior sin borrar su historia. También se puede **Anular** con motivo. Un borrador de corrección descartado permite iniciar otro.

## Consultar y exportar

- En la lista, filtrar **Desde/Hasta** hasta un año. La serie de evolución compara solo el mismo sitio o suma dentro del mismo protocolo; instrumentos o algoritmos diferentes bloquean la línea. BIA y DXA tienen opciones de serie separadas.
- **Excel del periodo** descarga evaluaciones finales con sitios, 1–3 lecturas, selección, unidades, sumas y método. **PDF del periodo** abre la impresión del navegador: elegir «Guardar como PDF». Un detalle permite el mismo mecanismo para una evaluación.
- El alumno activo abre **Antropometría** desde su cuenta y ve solo evaluaciones finalizadas; no puede crear ni modificar. Borradores y anuladas quedan en el historial del coach.

## Interpretación de cálculos

ISAK define sitios y precisión de medición, **no una fórmula universal de grasa**: [esquema oficial](https://www.isak.global/FormationSystem/AccreditationScheme). El sistema calcula sumas solo cuando están todos los sitios del conjunto. Para el porcentaje opcional usa los coeficientes de cuatro pliegues y grupo de edad del [artículo original de Durnin y Womersley](https://www.cambridge.org/core/journals/british-journal-of-nutrition/article/body-fat-assessed-from-total-body-density-and-its-estimation-from-skinfold-thickness-measurements-on-481-men-and-women-aged-from-16-to-72-years/DAC8BA25856FCEB30E22F60E0AF80D07): `densidad = c − m × log10(Σ4)`. Convierte con [Siri](https://escholarship.org/uc/item/6mh9f4nf): `% estimado = 495 / densidad − 450`. El grupo del estudio va de 17 a 72 años en hombres y de 16 a 68 en mujeres; fuera de él no se calcula porcentaje.

La tolerancia automática de lecturas es un **indicador propio de revisión**, no un umbral oficial ISAK: 5 % entre pliegues y 1 % en las demás medidas. Con tres lecturas se usa la mediana y se exige que el par más cercano pase esa revisión. Los resultados guardan `anthropometry-v1`, la fuente y las lecturas originales. Una estimación poblacional no es un diagnóstico individual ni un «% correcto» garantizado.

## Límites de esta entrega

El perfil completo ISAK de 43 dimensiones, la técnica anatómica ilustrada por sitio, la validación de error técnico por un antropometrista acreditado, los documentos adjuntos de DXA/BIA y los teléfonos físicos iOS/Android todavía requieren trabajo. La página pública ISAK confirma cantidades y acreditación, pero no sustituye el manual técnico vigente. Ver [estado y pendientes T17](../tandas/17-antropometria-y-densidad-visual.md) y [evidencia local](../evidencias/t17-antropometria-local.md).
