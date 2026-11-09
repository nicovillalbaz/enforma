# T17 — revisión local de antropometría

**26-10-2026.** Entrega de código local para coach independiente. Los datos usados son ficticios y están aislados en `forma_manual_demo`. Se conservaron las cuentas y se aplicaron migraciones aditivas `033` y `034` también a `forma`, sin reinicializar bases. La demo está encendida solo en `127.0.0.1:4180` para revisión del usuario.

## Entregado

- API, RLS y vista para evaluación ISAK restringida de 21 sitios, medidas libres y transcripción de BIA/DXA; borrador, finalización, corrección y anulación con historial. El alumno solo lee las finalizadas; otro coach no accede.
- Sumas nombradas Σ4/Σ8, réplicas con selección y señal de revisión, ecuación opcional Durnin–Womersley/Siri con los grupos etarios del estudio original. La fecha se normaliza en API antes de finalizar; el caso real detectó y resolvió un `date` de PostgreSQL convertido erróneamente a texto.
- Lista y captura por pasos para móvil, filtro por fechas, evolución separada por método/instrumento, Excel privado por periodo y PDF mediante «Guardar como PDF» del navegador. El detalle enseña lecturas, fuente, instrumento, fórmula y versión.
- Corrección `034`: una corrección en borrador que se anula deja iniciar otra, sin reescribir el registro final anterior.

## Verificación dirigida de bajo consumo

- `vitest run tests/unit/anthropometry.test.ts`: **4 casos** aprobados, incluyendo suma de cuatro y ocho pliegues, ejemplo numérico `Σ4=40 mm → densidad 1,06185 → 16,2 % estimado`, incompletos, réplicas discordantes, límites de población y BIA externa.
- `npm run build`: tipos de web/API y build aprobados. Migraciones `033` y `034` aplicadas a dos bases existentes.
- [Recorrido autenticado](t17-anthro-review.json): el borrador no se mostró al alumno; finalización calculó en servidor; alumno pudo leer el final pero no escribir; otro coach fue rechazado; descarga XLSX privada respondió bien; PDF de navegador produjo 116226 bytes; captura por sitio funcionó. **320, 390 y 1366 px** sin desbordamiento del documento, con inputs visibles de 16 px. Se corrigieron 16 px de expansión inicial a 320 px en el encabezado y shell.
- [Correcciones](t17-correction-review.json): un final rechazó edición directa; borrador de corrección anulado dejó crear y finalizar otra corrección; original quedó anulado en historial.
- Capturas: [móvil 390](t17-anthro-390.png) y [PC 1366](t17-anthro-1366.png). La prueba fue Chromium emulado; no certifica comportamiento en hardware físico.

## Límites abiertos

La integración completa de 43 dimensiones ISAK, la revisión de técnica y umbrales por un profesional acreditado, el adjunto documental BIA/DXA y la prueba física iOS/Android no se hicieron. Tampoco se repitió una batería general de T01–T16. La estimación se presenta como poblacional; no se afirma exactitud clínica individual. [Manual de uso](../runbooks/t17-antropometria.md) · [plan y estado](../tandas/17-antropometria-y-densidad-visual.md).
