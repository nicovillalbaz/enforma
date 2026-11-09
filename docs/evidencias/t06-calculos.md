# T06 — Fixture de cálculo manual

Caso ficticio reproducido por `tests/integration/progress.test.ts`. `D` es hoy en Paraguay. Un programa de cuatro días empieza D−3; cinco series por día: tres de repeticiones, una de tiempo y una de distancia.

| Día / estado inicial | Series realizadas | Volumen computable |
|---|---|---:|
| D−3, finalizada completa | 20 kg × 10; 0 kg × 15; carga no indicada × 12; 60 s; 1500 m | 200 kg·rep |
| D−2, finalizada parcial | 25 kg × 8; otras cuatro pendientes | 200 kg·rep |
| D−1, en curso | 99 kg × 99 | Excluida del progreso oficial |
| D, sin preparar | Ninguna | 0 |

Resultado inicial: **2 sesiones, 1 parcial, 6 series confirmadas computadas, 400 kg·rep, 1 serie sin carga, 4 días exigibles, 2 completados, 1 ausencia anterior y 1 pendiente hoy**. Cumplimiento 2/4 = 50 %. Marca de carga 25 kg × 8; tiempo 60 s; distancia 1500 m. Últimos siete días 400, anteriores cero: porcentaje de cambio sin base, no infinito ni 100 % inventado.

1. Reabrir D−3: queda 1 sesión/1 serie/200 kg·rep. Se conserva su auditoría.
2. Deshacer 20 kg × 10 y cerrar D−3 como parcial: **2 sesiones, 2 parciales, 5 series, 200 kg·rep, 2 días completados**. La serie de carga cero sigue siendo un dato válido.
3. Cambiar el nombre/métrica del ejercicio en catálogo: el historial mantiene nombre/métrica originales. Ejecutar consulta con DB en `Pacific/Kiritimati`: semanas y volumen idénticos porque la fecha base es `DATE` y la actividad explicita Paraguay.
4. Cancelar con fecha D−2: D−3/D−2 conservan hechos completados; D−1/D cancelados. Resultado **2 exigibles, 2 completados, 2 cancelados**. Asignar reemplazo desde D: **3 exigibles, 2 completados, 1 cancelado, 1 pendiente hoy**; no duplica fecha.
5. Añadir 5.000 series sintéticas de 2 kg × 3 al día confirmado D−2: añade 30.000. Resultado **30.200 kg·rep, 5.005 series y 2 sesiones**. El test exige respuesta local inferior a cinco segundos; no constituye un SLA ni ensayo de concurrencia de usuarios reales.

## Mediciones y permisos

Peso propio 70,5 kg: reintentar UUID devuelve mismo ID; cambiar contenido con mismo UUID devuelve conflicto. El profesional no lo ve hasta permiso explícito. Cintura 80 cm creada por profesional autorizado declara origen coach. Anular peso exige motivo y lo excluye de gráfica, conservándolo en historial. Dos valores posteriores 71 y 72 del mismo día dejan una única muestra de tendencia: 72.

Una PNG sintética 600×800 con orientación EXIF 6 produce WebP 800×600 sin EXIF y miniatura 320 de ancho. El owner, otro coach y otro alumno no acceden sin permiso. Al conceder al owner, obtiene 200; al retirar consentimiento ambos pierden acceso, incluso reutilizando URL. Reactivar no recupera fotos borradas. Con 31 días se depuran claves de inventario y archivos. Dos subidas concurrentes con el mismo UUID dejan una sola fila y dos archivos finales. Cuotas conjuntas y limpieza de una subida rechazada se comprueban sin desactivar reglas de planes inmutables.

## Fixture de navegador

Tres series prescritas; solo una realizada 42,5 kg × 10 y sesión parcial finalizada: **425 kg·rep, 1 sesión parcial y 100 % de un día exigible**. Registros 70,5 y 71; anular el último devuelve la gráfica a 70,5. Compartición independiente de mediciones/fotos, PNG sintética, concesión/revocación y petición de la URL anterior completan el recorrido.
