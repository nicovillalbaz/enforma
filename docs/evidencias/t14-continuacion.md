# T14 — Continuación local, v0.14.1

**22-10-2026 · solo coaches independientes · 001–022 conservadas, próxima 023.** Preparación local ampliada con comparación de fuentes/artefactos del build y caso funcional WebKit de cuenta. La [entrega inicial 0.14.0](t14.md) conserva su evidencia histórica. No hay lanzamiento ni piloto real aprobado.

## 1. Build actualizado: pendiente local resuelto

Antes release:check solo comprobaba presencia/tamaños. Ahora el final del empaquetado escribe `dist/release-manifest.json`, fuera de la raíz pública, y el inventario compara versión, SHA-256 y conteos de fuentes y salidas web.

- **128 entradas:** apps/web, packages/ui/shared, manifiestos/lock/tsconfig base y scripts de shell/procedencia. Markdown, .env, node_modules, cachés y datos privados excluidos.
- **73 artefactos** en dist/web, incluido sw.js. El shell mantiene 72 assets, excluyendo API/medios privados; el manifiesto no se publica ni precachea.
- Fuente modificada, salida alterada incluso con igual longitud o manifiesto ausente hacen fallar webBuildCurrent. Documentación Markdown no obliga a compilar otra vez.
- La comparación presupone constructor de confianza y fuentes estables durante empaquetado; no firma ni acredita node_modules, variables de compilación, autenticidad del constructor o despliegue remoto. API/workers no están incluidos en la huella web.

[Inventario actual](t14-continuacion-preparacion.json): webBuildPresent/webBuildCurrent/versión/fuentes/artefactos **aprobados**. Resultado global needs-attention/salida 1 por APP_ORIGIN HTTP del desarrollo, correctamente: no se altera .env para simular producción. DB no solicitada en esta lectura (checks null); se reutiliza [verificación inicial](t14-preparacion.json) de 22 checksums/rol, sin cambios de SQL del producto.

## 2. Cuenta WebKit: pendiente funcional local resuelto

[Resultado](t14-webkit-cuenta.json): **aprobado en una ejecución de 27.664 ms**, incluyendo preparación, navegador y limpieza. Un WebKit/una página, sin capturas/trazas y service worker bloqueado para centrar el caso en cuenta. DB/storage aislados nuevos; cero mutaciones de negocio en la base de trabajo.

1. Coach/alumno/admin sintéticos, mes terminado, quince días y abono ficticio; cuenta emitida por API real, sin preparar entrenamientos/vídeos.
2. WebKit selecciona PNG y envía pago; el servidor confirma pero se simula pérdida de respuesta. El error conserva importe, referencia y archivo del selector nativo.
3. Reintento con el mismo ID de intención: **un solo pago** en DB, **saldo cero** y selector nativo vacío tras confirmación.
4. Comprobante privado permitido al owner (200) y denegado al alumno (404).
5. Owner consulta la cuenta sin formulario administrativo; **320/1440 px** sin desborde, campo de mes **16 px** y viewport sin bloqueo de zoom. **Cero errores de página**.
6. Browser/API/preview/conexiones cerrados, DB temporal eliminada y storage propio eliminado tras verificar ruta absoluta bajo .local/test-storage y nombre aleatorio permitido.

Se resuelve el pendiente funcional local T07 de **pago con respuesta perdida/reintento/limpieza del comprobante en WebKit**, reutilizando pasos anteriores ya acreditados. **No se reejecutó ni se declara de nuevo aprobado el recorrido histórico completo billing.spec.ts**; no sumar casos históricos como nuevos. No acredita Safari/iPhone físico, arranque frío, instalación o service worker.

## 3. Verificaciones y consumo

| Acción | Resultado | Alcance |
|---|---|---|
| Dos unitarias nuevas de huellas | 2 aprobadas, 0 fallidas | [JSON](t14-continuacion-build-pruebas.json): fuente compartida modificada, documentación, salida de igual longitud y manifiesto ausente |
| Filtro de artefactos tras ampliar inventario de salidas | 1 aprobado, 1 omitido | [JSON](t14-continuacion-artefactos-pruebas.json), sin repetir caso de fuentes |
| Tipos servidor | Aprobados una vez | tsc/tsconfig.server.json incluye nuevo código/tests TS; no se repite vue-tsc para componentes sin cambios |
| Empaquetado web/shell/manifiesto | Aprobado una vez | Vite 18,47 s, 72 assets de shell y 73 artefactos; sin instalar |
| WebKit acotado | Aprobado una vez, 27,664 s total | Un navegador/una página, cero capturas/trazas/PDF |
| Inventario actual | Huellas/versión aprobadas; HTTP local pendiente para producción | Sin DB, workers, SMTP, scanner, Docker o recuperación |
| Lint/enlaces | Dirigidos a cambios | Scripts/tests y enlaces de guías; [resumen de cierre](t14-continuacion-cierre.json) |

**Dos casos unitarios únicos nuevos**, con una repetición solo del filtro afectado. Siete manifiestos/lock/dependencias internas en 0.14.1, sin nuevas dependencias, migraciones o tablas de producto. No se ejecutan suites históricas, carga, restauración, escaneo real o correo. El snapshot operativo/cola anterior conserva su fecha; no se afirma salud actual sin volver a leerlos.

## 4. Diseño y continuación

Componentes, CSS, navegación móvil/PC y firma NAVZ conservados; solo versión visible 0.14.1. Se complementa [visual T13](t13.md) con la cuenta WebKit acotada, sin nueva matriz completa. Native zoom permitido no equivale a aceptación física de zoom/teclado/lector.

[Guía reproducible](../runbooks/t14-continuacion-local.md), [salida general](../runbooks/t14-salida-y-piloto.md), [ficha de responsables](../piloto/03-salida-independiente.md). Siguen pendientes:

- Operador/soporte, precio/acuerdos, privacidad/retención/menores y procedimiento integral de derechos de datos. No existe exportación/borrado integral autoservicio.
- Teléfonos/teclado/safe areas/zoom/lector/HEIC/visores, instalación y arranque frío por marca. Límites de vídeo/CacheStorage WebKit Windows T03/T05 conservados; este caso de cuenta no los valida.
- Staging, HTTPS/DNS, SMTP autorizado, scanner, PostgreSQL de contenedor, workers/alertas/costes reales.
- Una recuperación externa DB+archivos autorizada, **81 indicadores previstos**, referencias/permisos/revocaciones y RPO/RTO observados.
- Acuerdos con 3–5 coaches y cuatro semanas observadas. Coaches reales incorporados: **0**.

T14 mantiene abiertas aceptación física/externa y piloto. No se añade una ampliación multicoach ni otra tanda por defecto.
