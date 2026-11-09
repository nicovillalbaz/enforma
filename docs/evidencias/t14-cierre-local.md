# Acta T14-08 — Cierres de código posibles en local

**23-10-2026 · implementación y comprobación local.** Aplicación v0.14.2, migraciones 001–023 sin cambios, próxima 024. [Guía paso a paso](../runbooks/t14-cierre-local.md), [ADR 016](../decisiones/016-cierre-local-y-datos.md).

## Entregado

1. `scripts/privacy-data.ts` y `scripts/privacy.ts`: inventario de revisión (`plan`), dossier estructurado por alumno (`export`) y apertura privada (`open`). Snapshot de solo lectura, organización/alumno explícitos, operador responsable activo/superadmin, límites 1.000 filas/sección y 16 MiB, rechazo de esquema posterior a 023.
2. Cifrado AES-256-GCM con sal/scrypt e IV aleatorios; frase temporal de 24+ caracteres. Archivos exclusivos y manifiesto local de alcance/ticket/operador/SHA-256, fuera de Git. No imprime filas o credenciales ni habilita endpoint HTTP. El manifiesto no es auditoría remota inmutable; la custodia administrativa y validación del solicitante siguen siendo responsabilidad del operador.
3. Selectores por alumno en entrenamiento, progreso, alimentación, seguimiento, agenda, recursos propios y negocio. Identidad mínima de cuenta compartida; no trae su perfil en otro estudio. Excluye autenticación, rutas de archivos y cuerpos de mensajes retirados.
4. Preparaciones de doce suites de integración adaptadas. La aprobación usa la función real de plataforma dentro de DB temporal validada y owner sintético. Solo regresiones históricas de facturación/carga reconstruyen pre-023; no se cambia el alta real, que sigue pendiente.
5. Preparaciones de navegador y expectativas de registro, cuenta y admin actualizadas: sesión administrativa separada y API real, owner sintético/servidor local. Caso manual de cuenta WebKit actualizado, sin ejecutarlo de nuevo. Scripts manuales de tandas antiguas conservan evidencia histórica y necesitan revisión de preparación antes de reutilizarlos.
6. Guías, índice, protocolo, tanda, puertas y avances actualizados. El protocolo de incorporación explica mensualidad fija/cupo configurables y pagos/acceso separados; ya no prescribe prorrateo o prueba automática al coach nuevo.

## Verificación acotada

| Comprobación | Resultado | Límite |
|---|---|---|
| Dossier nuevo de datos | **1 caso aprobado** | Dos estudios, dos fichas con misma cuenta, otro alumno del mismo estudio, hilos propios/ajenos y fotos ficticias |
| Inicio del coach con preparación adaptada | **1 caso existente aprobado** | Solo `reports real setup...`; no suite completa |
| Selección total | **2 aprobados, 0 fallidos, 3 omitidos** | [JSON de selección](t14-cierre-local-pruebas.json); DB temporales eliminadas al finalizar |
| Tipos servidor/scripts/integración | **Aprobados una vez** | `tsc --noEmit -p tsconfig.server.json`; no nuevo build |
| Lint | **Aprobado sobre archivos cambiados** | No lint global del repositorio |
| Descubrimiento Playwright | **21 combinaciones listadas en 6 archivos** | Importación/descubrimiento estáticos; cero casos ejecutados, cero navegadores/workers iniciados |
| CLI ayuda | **Aprobada** | No ejecuta exportación de datos de trabajo ni abre la DB |
| Huellas del build anterior | **verified** | v0.14.2, 134 fuentes y 78 artefactos intactos; build original del 22-10-2026 conservado |

El caso nuevo comprueba operador ordinario rechazado, estudio/alumno incompatibles rechazados, datos positivos realmente presentes, otro alumno/estudio excluidos, contraseña/rutas/cuerpo retirado ausentes, inventario sin datos, descifrado correcto, clave incorrecta y manipulación rechazadas, registros originales conservados y futura migración desconocida rechazada. La cuenta compartida no dispara borrado global.

Primer intento: sandbox bloqueó PostgreSQL local con `EACCES` antes de ejecutar casos. Se repitió únicamente la selección de dos casos con permiso para conectar al PostgreSQL local; esa ejecución pasó. No se presentan dos ejecuciones exitosas ni se computan casos omitidos como aprobados.

No se ejecutaron suites históricas completas, navegador, PDF, FFmpeg, SMTP, scanner, carga o backup/restore. No se instalaron paquetes o servicios, no se aplicó migración a la base de trabajo, no se exportaron personas/datos reales y no hubo mensajes, pagos reales o despliegue. No se rehicieron capturas por un cambio de herramientas y documentación.

## Pendientes que no se declaran resueltos

- **P03 continúa abierta:** dossier estructurado no equivale a portabilidad integral; faltan bytes/contexto compartido y aprobación del procedimiento completo. El inventario no ejecuta ni certifica eliminación. Conservación, identidad compartida, hechos inmutables y backups requieren decisión responsable e implementación posterior de eliminación/anonimización por categoría.
- `open` crea texto claro privado que debe custodiarse y retirarse según política. Entrega y caducidad no son automáticas. La CLI completa con archivos del sistema no se ejecutó contra la base de trabajo; se probaron colector/cifrado en fixture y ayuda sin DB.
- Preparaciones de navegador se adaptaron y se descubrieron estáticamente; no se afirma que toda la matriz histórica o los dispositivos físicos pasen.
- iPhone/Android físicos, teclado/zoom/PWA, dominio/HTTPS, correo/scanner/workers/alertas reales y una recuperación externa de versión vigente mantienen sus puertas.
- Backup previsto **85 indicadores (69 conteos/16 sumas)** sin cambio. No hay nuevo ensayo de recuperación ni piloto aprobado.

**Siguiente acción:** recorrido manual móvil/PC con cuentas ficticias según la sección 8 de la guía, corrigiendo y repitiendo solo el paso afectado.
