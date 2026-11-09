# T02 — Uso del estudio y soporte de cuentas

**Versión:** 0.2 local · 20-10-2026. Solo datos ficticios hasta completar las puertas de salida de T01 y T07.

## 1. Iniciar y elegir un acceso

1. Ejecutar los pasos de [desarrollo](desarrollo.md), incluyendo `db:migrate` y `db:seed`.
2. Abrir `http://127.0.0.1:5173/acceso` para usar cuentas guardadas en PostgreSQL.
3. Coach de desarrollo: `coach@forma.local` / `Forma-demo-2026!`.
4. Superadmin de desarrollo: `admin@forma.local` / `Forma-demo-2026!`; entra en `/admin`. El seed no funciona en producción.
5. `/demo` activa el prototipo con datos del navegador. «Salir del ejemplo» vuelve al acceso real. La etiqueta Ejemplo identifica ese modo.
6. No usar las cuentas sembradas ni estas contraseñas en un despliegue público.

## 2. Crear el estudio de un coach

1. Abrir `/registro` y completar nombre, correo y contraseña de al menos 12 caracteres.
2. En «Tu estudio», elegir nombre, dirección de 3–40 caracteres (minúsculas, números y guiones), coach/gimnasio y color. Una dirección ya ocupada o reservada se rechaza.
3. Elegir Básico o Pro. Leer el aviso inicial de privacidad y marcar su aceptación.
4. Crear el estudio. Se guarda el usuario, la membresía owner, la marca y una prueba de 14 días en una transacción; la contraseña se guarda como hash Argon2id.
5. Confirmar el correo desde el enlace. Vence en 24 horas y se consume una vez. La página requiere pulsar «Verificar mi correo»; abrir el enlace no ejecuta la confirmación por sí solo.
6. En desarrollo se puede usar «Abrir correo de desarrollo». Solo muestra mensajes propios de confirmación/recuperación; está desactivado en producción. No muestra invitaciones de otros usuarios.
7. Personalizar logo y perfil desde «Mi marca». El asistente pide una identidad inicial; los detalles se completan en esta pantalla.
8. Los alumnos pueden crearse antes de confirmar correo, pero no se pueden preparar invitaciones hasta confirmarlo.

## 3. Personalizar y compartir la marca

1. Abrir «Mi marca» con una cuenta owner.
2. Editar nombre, color, bienvenida, descripción y correo de contacto opcional. Estos campos y el logo son públicos por decisión del propietario.
3. Guardar y comprobar el nombre de la pestaña, el color de botones y el acceso `/estudio/tu-direccion`.
4. Para el logo, seleccionar PNG, JPEG o WebP de hasta 256 KB. Límite real de entrada: 4.194.304 píxeles en total. Se valida el formato leído por Sharp, se normaliza la orientación, se reduce a un máximo de 512 × 512 y se convierte a WebP sin metadatos de origen.
5. «Quitar logo» elimina su referencia pública. La limpieza de versiones antiguas y huérfanos se hará junto con la retención de medios en T03; no borrar archivos manualmente.
6. El preview de entrenamientos en «Mi marca» es un ejemplo visual etiquetado. Los entrenamientos reales se implementan en T04–T05.
7. El tema claro/oscuro se guarda por usuario. No se guarda información de alumnos reales en `localStorage`.

## 4. Alta e invitación de un alumno

1. Ir a «Alumnos» → «Nuevo alumno». Escribir nombre, correo personal y objetivo. El correo no puede repetirse dentro del mismo estudio.
2. La ficha queda como **Invitado**, sin usuario vinculado, sin plaza habilitada y sin intervalo de uso.
3. Abrir su ficha → «Preparar invitación». Se genera un token aleatorio de un uso y se guarda su hash; el mensaje queda en cola.
4. Copiar el enlace privado y compartirlo con ese alumno por un canal autorizado. La aplicación muestra «correo en cola», no confirma entrega.
5. Cada nuevo enlace revoca el anterior. Vence en 72 horas; archivar la ficha también lo invalida.
6. El alumno abre el enlace, revisa el estudio/correo, completa nombre/objetivo y acepta el aviso inicial. Si es nuevo, crea una contraseña de al menos 12 caracteres; si ya tiene cuenta usa su contraseña actual o su sesión coincidente.
7. Si está conectado con otra cuenta, debe cerrar esa sesión antes de aceptar. No se cambia el correo de una identidad mediante una invitación.
8. Al aceptar se comprueban de nuevo el token y el cupo, se consume el enlace, se vincula el usuario, se activa la ficha y se abre un intervalo en la misma transacción. Si no hay cupo, no se consume el enlace ni se crea un usuario incompleto.
9. El alumno entra en «Hoy» y puede editar exclusivamente su perfil de ese estudio. Ve un inicio vacío hasta que su coach publique programas.
10. Una identidad puede aceptar invitaciones de varios estudios. Cada uno conserva su ficha y objetivo separados.

## 5. Pausar, reactivar y archivar

1. Abrir la ficha y seleccionar el nuevo estado en «Acceso al estudio».
2. Escribir un motivo de al menos 3 caracteres. La modificación queda auditada con el actor.
3. **Activo → Pausado/Archivado:** corta el acceso al portal y cierra el intervalo abierto.
4. **Pausado/Archivado vinculado → Activo:** comprueba cupo y suscripción, abre un nuevo intervalo y restablece acceso.
5. **Invitado → Activo** se realiza aceptando una invitación; no se puede activar una ficha sin cuenta.
6. **Invitado → Archivado:** revoca las invitaciones. Desde la ficha se puede volver a Invitado si aún no tiene cuenta y preparar una nueva invitación.
7. Alumnos con cuenta no vuelven al estado Invitado. Archivar conserva historial; no es una eliminación de datos.
8. Dos solicitudes iguales de activación no abren dos intervalos. Las escrituras con una versión antigua de ficha se rechazan: recargar antes de repetir otro cambio.
9. El cupo se valida al activar, incluso con solicitudes simultáneas. No se cobra por cada profesional que acompaña a una misma ficha.

## 6. Planes y uso

| Plan versión 1 | Precio de prueba por alumno/mes | Cupo habilitado |
|---|---|---|
| Básico | G. 10.000 | 25 |
| Pro | G. 15.000 | 100 |

Los precios son hipótesis del piloto. En T02 no hay factura, prorrateo de importe, cargo ni pago automático. Se registran intervalos para el cálculo futuro de T07. Las versiones de plan son inmutables; cambiar una versión requiere insertar otra. El cambio de plan de una organización genera un evento con la versión anterior y la nueva.

1. Abrir «Mi plan» como owner para ver precio/versionado, cupo, estado y fin de prueba.
2. Revisar los últimos 100 intervalos; las fechas se muestran en la configuración del navegador. La base usa `timestamptz` y la organización declara `America/Asuncion`.
3. Al vencer la prueba se impide habilitar nuevas plazas; el acceso a la información existente permanece hasta la política comercial de T07.
4. Para cambiar plan, un superadmin debe justificarlo. No puede reducir a un cupo menor que los alumnos activos.
5. Los flags de funcionalidades son la base de futuras tandas: no significan que un módulo futuro esté implementado.

## 7. Cambiar de estudio

1. Usar «Mi estudio» en el sidebar de PC o el selector superior en móvil.
2. Al cambiar se vacían inmediatamente marca, alumnos, ficha abierta y enlace de invitación anterior. Las respuestas atrasadas de otra organización no se aplican al nuevo contexto.
3. Un owner ve todos los alumnos de su estudio. Un coach ve los asignados. El alumno ve solo su ficha activa.
4. «Crear otro estudio» reutiliza la misma identidad y crea otro owner/plan/marca. Límite inicial: 10 estudios propios.
5. La gestión gráfica del equipo, sedes y asignaciones de profesionales corresponde a T13. El modelo y las restricciones ya soportan dos profesionales para una misma ficha y están probados por API/DB.

## 8. Superadministración

1. Entrar con `admin@forma.local` en desarrollo. Una cuenta normal recibe denegación aunque intente llamar directamente a la API.
2. En `/admin`, buscar por nombre/dirección y pulsar «Gestionar».
3. Elegir suspensión, restauración, Básico o Pro; registrar motivo de al menos 10 caracteres y aplicar.
4. Suspender bloquea los recursos privados del estudio y cierra sus intervalos. Restaurar recupera su estado previo y vuelve a abrir intervalos para las fichas activas.
5. Las acciones y las consultas del listado se registran en `platform_audit_logs`. El panel lista organizaciones/uso; no permite leer datos corporales ni mensajes.
6. No existe endpoint para concederse superadmin. Para el primer operador de producción, un administrador de base debe identificar una cuenta propia activa y con correo verificado, registrar el ticket/motivo de alta, actualizar únicamente `is_superadmin` de ese UUID en una transacción e insertar el evento `superadmin.bootstrap` con ese actor en `platform_audit_logs`. Revisar el UUID/correo antes de confirmar. Repetir el control y el evento para revocar.
7. La credencial de migración/admin no se entrega al proceso web. El alta de operadores posteriores requiere procedimiento controlado; no reutilizar el seed.

## 9. Recuperación de cuenta y soporte

### El usuario conserva el correo

1. Abrir `/recuperar`, escribir correo y enviar. La respuesta es genérica para no revelar si existe.
2. El worker entrega un enlace que vence en 30 minutos. Si SMTP no está disponible, revisar la cola; no prometer entrega inmediata.
3. Abrir el enlace y crear contraseña de al menos 12 caracteres. La recuperación consume el token y revoca las sesiones anteriores.
4. Volver al acceso del estudio y comprobar la pertenencia. Restablecer la contraseña no reactiva una ficha pausada ni un estudio suspendido.

### El usuario perdió acceso al correo

1. Registrar una solicitud privada con el responsable del estudio, sin pedir contraseñas, enlaces de recuperación ni datos corporales.
2. Verificar identidad y titularidad por un canal previamente acordado. No aceptar únicamente una captura, un nombre de alumno o un ID conocido.
3. Un coach no puede cambiar el correo de acceso global de un alumno desde su ficha.
4. En esta versión no se automatiza la sustitución del correo ni la transferencia de propiedad. Escalar al operador, registrar evidencia y motivo y resolver con procedimiento de mantenimiento aprobado y auditado antes del piloto.
5. Si no se acredita titularidad, mantener el acceso bloqueado. Los plazos y el canal real de soporte deben acordarse antes de admitir personas reales.

### Privacidad y borrado

El aviso técnico inicial está en `/privacidad`, versión `2026-10-t02`. Se registra la aceptación en cuenta/ficha según el flujo. Explica información tratada, alcance por estudio y contacto con el responsable. No sustituye la revisión legal, contratos, retención ni política de menores previa al piloto. Exportación y eliminación se atienden por solicitud al responsable; todavía no hay botones automáticos. No prometer anonimización o borrado ejecutado si solo se archivó una ficha.

## 10. Correo y subdominios externos

1. Configurar `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` y `SMTP_FROM` para el worker. Usar las credenciales del proveedor mediante secretos del entorno.
2. Arrancar `dev:worker` en local con Mailpit o SMTP de pruebas. La cola usa leases y reintentos; un envío puede repetirse si el proveedor recibió el mensaje y el worker se interrumpió antes de confirmar. El Message-ID estable ayuda, pero no garantiza entrega exactamente una vez.
3. Verificar recepción real de confirmación, invitación y recuperación, incluido spam; revisar SPF/DKIM/DMARC con el proveedor antes del piloto. No se verificó entregabilidad externa en esta tanda.
4. Los enlaces funcionan en local por `/estudio/:slug`. Para subdominios, definir `TENANT_BASE_DOMAIN` y configurar DNS, enrutado y TLS para cada host. La API comprueba que el host reconocido coincida con la organización y rechaza cruces; la prueba automatizada simula ese host.
5. El Caddy de producción actual sirve el dominio principal. El wildcard/TLS y la selección inicial de marca basada únicamente en hostname requieren integración de despliegue; no están presentados como publicados.
6. No compartir cookies entre todos los subdominios: las sesiones son del host y cada host requiere su acceso. Los enlaces de correo actuales usan `APP_ORIGIN` central.
7. Antes de publicar, resolver también el proxy de confianza/limitación por IP detrás de Caddy. En local: límite global 1000/min y login 50/15 min; producción conserva 100/min y login 5/15 min. Los límites de registro, aceptación y recuperación siguen vigentes en local.
