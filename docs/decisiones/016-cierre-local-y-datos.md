# ADR 016 — Cierre local, dossier por alumno y preparación de pruebas

**23-10-2026 · T14-08 · implementación local sobre v0.14.2/023.** No cambia la versión de la aplicación, el esquema o sus pantallas. Próxima migración 024. [Guía](../runbooks/t14-cierre-local.md).

## Necesidad y límite de la iniciativa

- **Usuario:** operador técnico que atiende una solicitud identificada de un alumno de un coach independiente.
- **Problema observado:** faltaba una herramienta reproducible para reunir sus datos sin entregar un dump de plataforma. Las preparaciones de pruebas anteriores también daban por habilitado al coach recién registrado.
- **Alternativa actual:** consultas manuales de soporte y evidencia histórica de pruebas anteriores al control mensual.
- **Resultado esperado:** dossier estructurado cifrado por organización/alumno e inventario de revisión; preparaciones de pruebas con habilitación explícita. Mantener separadas implementación local, aceptación física y operación real.
- **Coste de soporte:** CLI existente de Node/PostgreSQL, una conexión, sin dependencias, servicios, workers, migraciones ni pantalla adicional. Revisar los selectores cuando cambie el esquema.
- **Criterio de parada:** no crear un sistema de tickets, autoservicio integral, entrega automática de archivos o borrado masivo. Detener exportación ante esquema desconocido, permisos insuficientes o volumen que requiera lotes.

## Decisión

1. `scripts/privacy.ts` ofrece `plan`, `export` y `open`; **no tiene comando de borrado**. Opera con credenciales administrativas custodiadas, fuera de HTTP. El ID de operador activo/superadmin identifica al responsable declarado; no sustituye la autenticación de quien posee esas credenciales ni demuestra consentimiento.
2. Selectores cerrados filtran siempre organización y alumno, incluidos descendientes de sesiones, chat, check-ins y contratos. La cuenta compartida aporta solo identidad mínima, sin traer sus perfiles de otros estudios.
3. Snapshot PostgreSQL de solo lectura, timeout por consulta, 1.000 filas por sección y 16 MiB de datos estructurados. Exceso falla completo, sin truncar un dossier aparentando éxito. Esquema soportado: las 23 migraciones hasta 023; una siguiente migración exige revisión del inventario.
4. Salida en `.local/privacy`, excluida de Git, con creación exclusiva y permisos privados donde el sistema los aplica. Dossier e inventario se cifran con AES-256-GCM, sal/scrypt e IV aleatorios. Clave por variable de entorno temporal, nunca en argumentos o documentación. Manifiesto local con IDs de alcance, responsable, ticket y SHA-256; no es un registro remoto inmutable.
5. Excluir hashes de autenticación, tokens y rutas de almacenamiento. Mensajes retirados no exportan su cuerpo. No copiar bytes privados, archivos revocados o backups. El responsable revisa contexto/archivos compartidos y entrega antes de considerar completa una solicitud.
6. La eliminación integral requiere decidir retención y tratamiento de hechos inmutables y respaldos. El inventario ayuda a revisar alcance; no es un motor de borrado ni certificado de cumplimiento. La identidad global puede pertenecer a varios estudios.
7. Preparaciones de integración habilitan al coach mediante la función real de administración en una DB temporal validada y con identidad sintética. Solo regresiones históricas de facturación/carga reconstruyen el estado anterior a 023, expresamente; el registro real continúa suspendido/cupo 0.
8. Preparaciones de navegador usan sesión independiente de administrador y la API real de configuración, con servidor local y propietario sintético. Actualizar expectativas de registro/cuenta/admin; no declarar toda la matriz aprobada sin ejecutarla.

## Consecuencias

Hay una herramienta local útil para preparar una respuesta por alumno y revisar datos antes de definir una eliminación. **La portabilidad integral, los bytes de archivos, la política de retención, el borrado integral y P03 siguen abiertos.** Los límites y pasos humanos son visibles en la salida y en la guía. Las pantallas móvil/PC y la evidencia visual vigente se conservan.
