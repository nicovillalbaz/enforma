# T14-08 — Cierre de código local y gestión de solicitudes de datos

**23-10-2026 · aplicación v0.14.2, migraciones 001–023, próxima 024.** [Decisión](../decisiones/016-cierre-local-y-datos.md), [evidencia](../evidencias/t14-cierre-local.md), [avance](../avances.md).

## Actualización de compatibilidad — T15

El inventario/dossier ahora admite **001–024**, siguiente 025 sujeto a nueva revisión. `coach_field_options` es vocabulario compartido del coach y queda fuera del dossier individual; no se atribuye exclusivamente al alumno. [ADR 017](../decisiones/017-redisenio-y-autoria-coach.md). El resto del alcance y límites se mantiene. No se repitió exportación o restauración en T15; la evidencia original es histórica.

## 1. Qué queda preparado

1. Dossier estructurado **de un alumno de un estudio**, preparado por operador técnico y cifrado en local.
2. Inventario de filas para revisar una solicitud de eliminación, sin ejecutar cambios en la DB.
3. Preparaciones de pruebas antiguas adaptadas a la habilitación explícita del administrador y expectativas de las pantallas actuales.
4. Interfaz móvil/PC existente conservada. Esta entrega no añade una pantalla o dependencia de infraestructura.

No es exportación/borrado integral autoservicio. Los archivos binarios, el contenido compartido que requiere revisión, los respaldos y la política de conservación necesitan el procedimiento humano siguiente. **P03 sigue abierta.**

## 2. Abrir y acotar una solicitud

1. Registrar un ticket con identificador sin datos personales, por ejemplo `SOPORTE-123`. No usar nombre, correo o teléfono en el identificador.
2. Verificar solicitante por canal registrado y autorización para el propósito solicitado; nunca pedir contraseña o token completo. Identificar quién recibirá el resultado.
3. Registrar el UUID del estudio, UUID de la ficha del alumno y UUID del operador responsable activo/superadmin. Corroborar la ficha en el panel. Una misma cuenta puede tener perfiles en dos estudios: no intercambiar sus IDs.
4. Determinar si se solicita copia de datos, cese de acceso, revocación de fotos o eliminación integral. Archivar o pausar conserva historia. El pago del mes no autoriza exportación o borrado.
5. Confirmar canal de entrega y qué información de terceros o contenido compartido necesita revisión. No enviar un backup de plataforma como respuesta.

## 3. Preparar inventario y dossier

Trabajar desde la raíz del proyecto con acceso técnico autorizado a PostgreSQL. La CLI usa `DATABASE_ADMIN_URL` ya configurada. No copiar su valor a tickets, Markdown, consola o capturas. No exponer esta CLI como endpoint público ni distribuir credenciales administrativas al coach.

Ayuda sin abrir la DB:

```powershell
.\scripts\forma.ps1 exec tsx scripts/privacy.ts --help
```

Introducir una frase secreta nueva de **24 caracteres o más** mediante entrada oculta. No pegar la frase en los argumentos ni guardarla en el repositorio. Los UUID entre comillas de este ejemplo se sustituyen por los del ticket validado:

```powershell
$taskPrivacySecret = Read-Host 'Frase para cifrar el expediente' -AsSecureString
try {
  $env:PRIVACY_EXPORT_PASSPHRASE = [System.Net.NetworkCredential]::new('', $taskPrivacySecret).Password

  .\scripts\forma.ps1 exec tsx scripts/privacy.ts plan --organization 'UUID-ESTUDIO' --student 'UUID-ALUMNO' --operator 'UUID-OPERADOR' --ticket 'SOPORTE-123'
  if ($LASTEXITCODE -ne 0) { throw 'Inventario no completado' }

  .\scripts\forma.ps1 exec tsx scripts/privacy.ts export --organization 'UUID-ESTUDIO' --student 'UUID-ALUMNO' --operator 'UUID-OPERADOR' --ticket 'SOPORTE-123'
  if ($LASTEXITCODE -ne 0) { throw 'Dossier no completado' }
} finally {
  Remove-Item Env:PRIVACY_EXPORT_PASSPHRASE -ErrorAction SilentlyContinue
  $taskPrivacySecret.Dispose()
}
```

- Cada ejecución crea un UUID nuevo y un archivo `UUID.formapriv` en `.local/privacy`, con creación exclusiva. No sobrescribe expedientes previos.
- `UUID.audit.json` guarda alcance, ticket, operador, fecha, SHA-256 del archivo cifrado y `deletionExecuted: false`. También es privado y no se adjunta a documentación pública. Es evidencia local editable; conservar su hash/resultado en el registro autorizado del ticket.
- Inventario y exportación toman snapshots independientes de solo lectura: si se usa la app entre ambos, los conteos pueden cambiar. No prometer que son una transacción común.
- Soporta esquema 024 (actualizado en T15) y 1.000 filas por sección/16 MiB de datos. Si falla por tamaño, preparar exportación por lotes con revisión técnica; nunca reducir filtros o asumir que un archivo parcial es completo.
- No imprime filas, secretos o mensajes originales de PostgreSQL. Un fallo requiere revisar localmente permisos, alcance, esquema y tamaño. No habilitar logs de datos sensibles para soporte.

## 4. Contenido y límites del dossier

| Sección | Alcance preparado |
|---|---|
| Identidad | Ficha del alumno e identidad mínima de cuenta; sin sesiones, contraseña o tokens |
| Entrenamiento | Asignaciones/versiones asignadas, sesiones, series, eventos y referencias de medios de sus sesiones |
| Progreso | Mediciones, preferencias, permisos, alertas y metadatos de fotos propias; sin bytes o rutas |
| Alimentación | Asignaciones/versiones, preferencias, diario, comentarios y metadatos de fotos del alumno |
| Seguimiento | Hilos propios, mensajes, hábitos, check-ins y sus respuestas; cuerpo de mensaje retirado omitido |
| Recursos | Recursos sujetos al alumno o en colección propia sin otro sujeto explícito, versiones y permisos concedidos; no todo el catálogo compartido |
| Agenda | Reservas y preferencias/avisos propios; no lista de otros asistentes |
| Negocio | Contratos propios, cuotas, ajustes, pagos/retornos, consumos, prospectos asociados y marcas/eventos mensuales propios |

Los datos se conservan como JSON estructurado con nombres de tabla/campos. No se resuelve todo el contexto compartido o referenciado: plantillas/catálogos generales, ejercicios compartidos, disponibilidad/eventos comunes, auditorías generales, colas y archivos necesitan revisión separada. Las referencias internas no son enlaces de descarga.

El paquete puede contener información sensible de entrenamiento, salud o conversaciones. **Cifrar no decide quién debe recibir cada campo.** Revisar destinatario, autorización, contexto y datos de terceros antes de entregar. La herramienta no decide obligaciones o plazos legales.

## 5. Abrir, revisar y entregar

1. Conservar el archivo cifrado original y su hash. Introducir de nuevo la misma frase en la variable temporal, como en el bloque anterior.
2. Ejecutar, sustituyendo únicamente el nombre real generado:

   ```powershell
   .\scripts\forma.ps1 exec tsx scripts/privacy.ts open --input 'UUID-GENERADO.formapriv'
   ```

3. `open` verifica autenticidad GCM y crea un **nuevo** `UUID.review.json` privado. No imprime contenido. Clave incorrecta/archivo alterado falla; no genera revisión válida. Esta copia queda en texto claro, por lo que necesita custodia y eliminación explícita después de revisar, según la política aprobada.
4. Revisar alcance, conteos, exclusiones, `limitations` y las secciones pendientes. Si faltan archivos o contexto requerido, completar una entrega acotada usando los mecanismos autorizados y permisos vigentes; no recorrer storage o adjuntar un directorio entero. No recuperar fotos/mensajes retirados desde backups.
5. Transferir el resultado únicamente por canal aprobado al destinatario verificado, con la clave por un canal separado. No enviar desde el agente automáticamente. Registrar recepción, alcance efectivamente entregado, exclusiones y responsable.
6. Retirar la variable de entorno y limpiar copias temporales exactas autorizadas. En Windows usar `Remove-Item -LiteralPath` sobre cada archivo concreto, nunca un borrado recursivo del proyecto, storage o backups. La CLI no aplica caducidad automática.

## 6. Solicitud de eliminación: procedimiento preparado y límites

1. Obtener inventario `plan` del alumno y conservarlo cifrado con el ticket. No ejecutar `DELETE`, deshabilitar triggers o modificar hechos inmutables para vaciarlo.
2. Acordar responsable, finalidad, conservación por categoría, tratamiento de identidad compartida, auditoría/finanzas y copias de seguridad. Esos valores aún deben aprobarse; no hay un plazo universal supuesto por el código.
3. Si el solicitante pide detener uso, usar el acceso explícito de la ficha; para fotos, consentimiento/retirada del flujo existente. No confundir esas acciones con eliminación integral. Las guías de [progreso](t06-uso-y-operacion.md), [alimentación](t09-uso-y-operacion.md) y [seguimiento](t10-uso-y-operacion.md) explican revocación/retirada.
4. Revisar datos compartidos y otros perfiles de la cuenta sin incorporarlos a este dossier. Eliminar globalmente `app_users` puede afectar a otro coach; no hacerlo desde una solicitud de una sola ficha.
5. Preparar, una vez aprobada la política, la implementación de eliminación/anonimización por categoría que todavía falta, con revisión de restricciones, prueba sintética de aislamiento y recuperación. No ejecutar código destructivo improvisado contra la base de trabajo.
6. Registrar revocaciones y eliminaciones efectivas en el procedimiento operativo para reconciliarlas antes de reabrir cualquier restauración. Definir caducidad de copias con custodio y responsable; no borrar respaldos generales para resolver un único ticket.
7. Cerrar el ticket solo con resultado real: qué se retiró, qué se conserva y por qué, plazos aprobados, responsable y confirmación al solicitante. Un inventario con `deletionExecuted: false` nunca certifica borrado.

## 7. Preparaciones de pruebas adaptadas

- `tests/helpers/coach-approval.ts`: solo DB `forma_test_<32 hex>` o `forma_media_test_<32 hex>` y owner `@example.test`. Usa `app.manual_configure` con actor sintético de plataforma, revisión e intención. La app no importa este helper.
- Agenda, inicio, negocio, seguimiento, biblioteca, alimentación, organizaciones, rutinas, progreso y recursos preparan un coach explícitamente habilitado.
- Facturación histórica y carga histórica usan `legacy: true` únicamente en DB aislada: reconstruyen un espacio anterior a 023 para conservar esa regresión. No son el flujo actual de alta. La prueba de control mensual conserva el alta pendiente y la aprobación mediante HTTP.
- `tests/e2e/coach-approval.ts`: contexto de admin independiente, cuenta semilla local, owner sintético y API real. Alta por UI espera `/estado`, luego aprobación; cuenta propia usa Mi mensualidad; admin usa Coaches y acceso.
- Adaptados `workout-fixture`, biblioteca, rutinas, marcas/admin, PWA, organizaciones, cuenta y el caso manual WebKit de cuenta. El caso WebKit conserva comprobantes históricos en `/admin/cuenta`; el owner consulta la mensualidad actual.
- No se ejecutó la matriz histórica, FFmpeg, PDF, carga, navegador ni restauración. Las adaptaciones de navegador no son evidencia de ejecución. Scripts manuales T08–T13 conservan su naturaleza histórica y necesitan revisión antes de reutilizarse; no usarlos como smoke actual sin adaptar sus preparaciones.

Comprobación realizada de bajo consumo, seleccionando solo dos casos:

```powershell
.\scripts\forma.ps1 exec vitest run --config vitest.integration.config.ts tests/integration/privacy-data.test.ts tests/integration/coach-start.test.ts -t 'exports one pupil|reports real setup'
```

No repetir este comando por cambios puramente documentales. Si se cambia la UI, repetir solo el recorrido afectado.

## 8. Siguiente recorrido de uso, con cuentas ficticias

1. En PC, registrar un coach y confirmar que queda pendiente. En admin definir precio opcional, cupo y habilitación.
2. En móvil, abrir el coach, crear/invitar un alumno y aceptar en otra sesión.
3. Marcar mensualidad y comprobar que acceso y pago se gestionan por separado. Cambiar de mes y comprobar que no hereda pago.
4. Crear/asignar rutina, completar una sesión y consultar progreso desde coach y alumno.
5. Pausar alumno; confirmar bloqueo. Restaurarlo dentro del cupo. Suspender coach y confirmar bloqueo de ambos; restaurar y comprobar estados individuales.
6. Anotar solo pasos, dispositivo y síntoma de cualquier error, sin datos privados. Corregir y repetir ese paso.

Teléfonos físicos, PWA, HTTPS, correo/scanner/workers reales y una recuperación externa autorizada mantienen sus [puertas](../piloto/00-puertas.md). No hace falta añadir módulos para comenzar este recorrido ficticio.
