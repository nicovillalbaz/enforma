# T14 — Continuación local: build y cuenta WebKit

**Referencia:** v0.14.1; 001–022 conservadas, próxima 023. Solo coaches independientes. [Acta](../evidencias/t14-continuacion.md), [decisión](../decisiones/014-estabilizacion-y-piloto.md), [salida general](t14-salida-y-piloto.md).

## 1. Comprobar que el build corresponde a las fuentes

1. Mantener fuentes estables mientras se empaqueta. Conservar la orden de build del proyecto para una instalación nueva; no reinstalar dependencias ni repetir matrices para documentación.
2. El último paso del build crea `dist/release-manifest.json`. Entregar este fichero junto con dist/web cuando el operador lleve el artefacto a otro entorno. El servidor web publica solo dist/web; el manifiesto permanece fuera de esa raíz.
3. Ejecutar una sola vez `release:check`. Sin `--database` no abre DB. El chequeo de configuración sigue evaluando producción, de modo que HTTP local conserva un resultado global needs-attention aunque la huella sea correcta.

```powershell
.\scripts\forma.ps1 run release:check
```

4. Leer por separado `checks.webBuildPresent` y `checks.webBuildCurrent`. El segundo exige manifiesto válido, versión coincidente, fuentes actuales y artefactos íntegros. No confundirlo con `productionConfig`, puertas externas o aprobación de piloto.
5. Si no hay manifiesto, se entrega una versión antigua o cambia una fuente web/compartida/lock/build: reconstruir una vez y comprobar el caso. No editar el manifiesto ni ejecutar solo el paso que lo escribe para dar apariencia de build fresco.
6. Si solo cambió documentación Markdown, reutilizar el build existente: las guías no participan en la huella. Si se alteró una salida, reconstruir desde fuentes de confianza y comparar; copiar un manifiesto ajeno no soluciona el origen del problema.
7. Mantener copia privada/versionada del artefacto aprobado con su imagen/digest si se despliega. La comparación local no demuestra TLS, autenticidad del constructor, node_modules, variables de compilación o integridad del despliegue remoto.
8. La huella incluye web/UI/shared y sus scripts de empaquetado; API/workers conservan inventario/versiones propios. No usar ese resultado para afirmar que se validaron todos los servicios.

## 2. Caso WebKit de bajo consumo

El script es optativo para cambios que afecten al pendiente concreto de cuenta. Consultar primero [evidencia](../evidencias/t14-continuacion.md); no ejecutarlo otra vez para editar guías.

1. Requiere Node 24, PostgreSQL local preparado, navegador WebKit **ya instalado** y build vigente. No descarga navegador ni arranca Docker, correo, antivirus o workers.
2. Comprobar puertos 3008/5185 libres. Las conexiones base deben ser de localhost/forma; el script genera DB temporal con nombre aleatorio propio y storage dentro de .local/test-storage. No apuntarlo a datos reales.
3. Solo si el caso necesita repetirse por un cambio concreto:

```powershell
$env:FORMA_T14_WEBKIT_QA='1'
node --import tsx tests/manual/t14-webkit-account.mjs
Remove-Item Env:FORMA_T14_WEBKIT_QA
```

Usar Node 24 seleccionado por scripts/forma.ps1 o la ruta del runtime documentada en desarrollo. El comando no es un paso rutinario de arranque.

4. Preparación sintética: coach/alumno/admin en DB nueva, un mes terminado, quince días y abono ficticio. Se reutiliza la lógica real de cuenta; no se generan rutinas/vídeos/PDF para probar pagos.
5. Una página WebKit móvil: seleccionar comprobante → servidor confirma pago pero se pierde respuesta → error conserva importe/referencia/archivo → reintento con el mismo ID → un solo pago y saldo cero → selector nativo vacío.
6. Comprobar URL privada con owner (permitido) y alumno (denegado). Abrir la cuenta como owner, sin formulario de movimientos; revisar 320/1440, campo 16 px, ausencia de desborde y viewport sin bloqueo de zoom.
7. Presupuesto de trabajo 45 s, acciones UI 6 s. Si falla, conservar fase y resultado; no repetir el recorrido completo, capturas o fixture de entrenamiento por inercia. El informe no contiene credenciales, correos, tokens o cuerpos privados.
8. El finally cierra browser/API/preview/conexiones, elimina exclusivamente su DB aleatoria y su directorio validado, y guarda el informe. No borra ficheros de trabajo ni purga la cola antigua. Si la herramienta es interrumpida a la fuerza, comprobar el cierre antes de volver a lanzarla.
9. Alcance: pago/reintento/comprobante y lectura de cuenta en WebKit Windows. El recorrido histórico completo T07 conserva su resultado original; este caso puede aportar evidencia para su pendiente funcional sin ejecutar toda aquella matriz. No acredita iPhone/Safari real, service worker, instalación o arranque frío; el caso bloquea SW para centrar recursos en cuenta.

## 3. Qué requiere otros medios o una decisión humana

| Pendiente | Qué está disponible en local | Qué falta |
|---|---|---|
| P03 derechos de datos | Flujos de revocación/retirada, referencias de operación, ficha con responsables | Decidir finalidad/retención/menores y aprobar/verificar exportación/borrado integral; no existe autoservicio integral |
| P04–P07 dispositivos y PWA | Layout y pruebas acotadas de navegador | Dos iPhones, Android de gama baja, zoom/lector/teclado/safe areas e instalaciones reales |
| P07/P08/P12 infraestructura | Código/overlay/configuración y manifiesto local | Dominio/DNS/HTTPS, SMTP autorizado, motor/PG objetivo, identidad/soporte |
| P09/P14–P18 recuperación | Backup/indicadores previstos y procedimiento | Una recuperación externa aislada, custodia, revocaciones, RPO/RTO y permisos observados |
| P10 operación/coste | Snapshot histórico que muestra alertas | Workers/alertas del entorno real y facturas/volumen real; fixtures no son usuarios |
| P11/P15 contenido | Muestras técnicas sintéticas | Autoría/licencia/fuentes/competencias y consentimiento de contenido real |
| P02/P13 piloto | Guía, registro y ficha preparados | Acuerdos de 3–5 coaches, cuatro semanas observadas y decisión humana |

No cerrar estas puertas mediante un build o un test local. No trasladar la cola/seed del desarrollo a staging ni contactar usuarios desde el agente sin autorización expresa.
