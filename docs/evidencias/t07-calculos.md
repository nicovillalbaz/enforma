# T07 — Cálculo de referencia

Datos exclusivamente ficticios en `tests/integration/billing.test.ts` y `tests/e2e/billing.spec.ts`. Las fechas históricas se preparan con la conexión administrativa en fixtures; la API de habilitación no permite retroceder el inicio de cobro.

## Prorrateo y días

| Caso | Referencia |
|---|---:|
| Pro 15.000, 15/30 días | 7.500 |
| 1 PYG, 14/28 días, empate exacto | 1 PYG |
| Básico 10.000, 1/31 días | 323 |
| Pro 15.000, 1/29 días | 517 |
| Mes completo de 28/29/30/31 días | Precio completo |
| Sin días cobrables | 0 |

La suma se hace después del redondeo por alumno. Las unitarias usan división entera BigInt; DB usa `round(numeric)`. No se multiplica dinero en coma flotante para decidir el cargo.

### Septiembre de 2026 (30 días)

1. Habilitación sintética desde enero de 2024, prueba finalizada el 15 de enero. Plan inicial Básico, 10.000.
2. Alumna A: `[1 sep 00:00,16 sep 00:00)` son 15 días. Dos intervalos adicionales no solapados el día 16 añaden un solo día: **16 días**, `round(10000×16/30)=5333`.
3. Alumno B: `[30 sep 23:59:59,1 oct 00:00)` aporta solo el 30: **1 día**, `round(10000/30)=333`.
4. Total **5666 PYG**. Fin exacto a medianoche no cuenta el día siguiente.
5. Cambio a Pro a mitad de septiembre: septiembre mantiene 10.000 y octubre abre con 15.000. Cambiar nombre de un alumno después de emitir no modifica el nombre congelado.
6. Dos cierres concurrentes devuelven el mismo ID. Intentar editar el total emitido es rechazado por DB. Octubre actual no se puede emitir.

### Prueba y calendario

Intervalo del 1 de enero al 1 de febrero de 2024, con prueba hasta el 15 de enero a medianoche: **17 días cobrables**, 5.484 PYG. Los días previos quedan fuera. Se prueban febrero de 2024 (29), febrero de 2025 (28), abril (30) y julio (31). Cambiar la zona de sesión DB a Kiritimati conserva las líneas y total: límites expresados en America/Asuncion.

## Libro de movimientos

Cuenta septiembre 5666 → ajuste −666 = **5000**. Repetir UUID no crea otro ajuste; cambiar el importe con el mismo UUID entra en conflicto. Pago 3000 deja **2000**, sobrepago 3000 adicional se rechaza. Revertir el primer pago crea asiento nuevo y vuelve a **5000**. Pago final 5000 con comprobante privado deja **0**, con el original revertido visible. Dos subidas simultáneas iguales reutilizan pago/comprobante.

Cuenta abril por un día a 10.000: **333**. Dos pagos independientes concurrentes de 300: solo uno se acepta, el otro devolvería sobrepago; saldo **33**. No se admiten null/string/decimales ni escritura por owner.

## Recorrido de navegador

Estudio nuevo y alumno aceptado → programa → serie 42,5×10 → sesión parcial → gráfico **425 kg·rep**. Fixture crea 15 días cobrables del mes anterior. Administración consulta/emitir → ajuste −100 → pago por saldo con PNG sintética. Se pierde deliberadamente la respuesta de pago después del commit: el formulario conserva importe/referencia/imagen, el reintento usa el mismo UUID y SQL confirma un único asiento. Owner ve cálculo, movimientos y cuenta saldada; alumno recibe denegación del comprobante. No se mueve dinero ni se contacta con personas reales.
