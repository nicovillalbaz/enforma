# T07 — Instalación, cuenta mensual y operación

**0.7.0, implementación local.** [API](api-t07.md), [decisiones](../decisiones/007-pwa-y-cuenta-saas.md), [cálculos](../evidencias/t07-calculos.md). El [registro del piloto](../piloto/02-registro.md) conserva las puertas físicas/externas y los pasos humanos pendientes.

## 1. Preparar y arrancar

1. Seguir [desarrollo](desarrollo.md), Node 24, PostgreSQL y variables privadas; nunca publicar `.env`.
2. Aplicar migraciones 001–016 en orden. No editar las anteriores. La siguiente migración empieza en 017.
3. Compilar con `scripts/forma.ps1 run build`; genera iconos genéricos, manifest y service worker con hash de todos los recursos públicos. Ejecutar web/API/worker de medios de desarrollo, o preview 4173 con API 3002 según T05.
4. Usar solo cuentas/contenido ficticios en local. El entorno conserva muchos casos de pruebas; sus métricas y volumen no representan demanda real del mercado.

## 2. Instalar por marca

1. Entrar en el estudio correcto y abrir **Instalar app**. Su manifest usa identidad estable por UUID y arranque `/abrir/slug`; no reutiliza el estudio recordado de otra instalación.
2. iPhone/iPad: Safari → enlace del estudio → Compartir → Añadir a pantalla de inicio; revisar nombre y, si aparece, Abrir como app. Confirmar y abrir icono. Los nombres del menú pueden variar por versión.
3. Android/PC: botón Instalar aplicación cuando el navegador lo ofrezca, o su menú Instalar/Añadir a pantalla de inicio. La pantalla explica el procedimiento sin prometer un prompt universal.
4. Verificar nombre/icono y cuenta al abrir. Si no hay sesión, entrar con la cuenta invitada a ese estudio. Otra cuenta sin pertenencia no hereda el acceso anterior. Si hay varios estudios, el enlace elige el de su slug.
5. Preparar un entrenamiento conectado antes de necesitarlo offline; comprobar confirmación del servidor y luego continuidad T05. Fotos, mediciones, vídeos y cuentas no se descargan para offline.
6. Producción requiere HTTPS y origen por estudio, como prevé arquitectura. Local comparte scope `/`: no demuestra asociación de iconos de varias instalaciones en un sistema operativo real. Cerrar esa puerta en teléfonos antes del piloto.

Fuentes de instalación: [WebKit sobre Home Screen](https://webkit.org/blog/13878/) y [Safari 26](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/). No equivalen a prueba física de esta aplicación.

### Actualizar

1. Abrir Instalar app → Comprobar actualizaciones con conexión.
2. Si hay versión preparada, guardar formularios y confirmar cambios de entrenamiento.
3. Cerrar **todas** las ventanas/pestañas controladas de Forma, también otra marca en el host compartido local.
4. Abrir de nuevo desde icono. El worker no recibe skipWaiting ni recarga una ventana con un formulario abierto.
5. Si no cambia la versión, comprobar otras pestañas abiertas y conexión. No borrar almacenamiento como primera medida: exportar/resolver pendientes T05 antes de cualquier limpieza.

## 3. Owner: explicar la cuenta

1. Mi plan → **Mi cuenta mensual y pagos**, o Mi cuenta en navegación secundaria.
2. Elegir mes. El actual es estimación hasta ahora, sin emisión ni deuda automática. Meses sin habilitación/cobro muestran cero y explicación.
3. Revisar precio de apertura del mes, días del calendario y alumnos. Abrir Ver días incluidos: son fechas distintas con acceso, posteriores a habilitación y fin de prueba.
4. Ver importe por alumno y total. Cambio de precio a mitad de mes se aplica el mes siguiente; cupos/funciones pueden cambiar inmediatamente. Invitaciones sin activar no crean intervalos facturables.
5. Abrir una cuenta emitida: snapshot original separado de ajustes, pagos y reversiones. Saldo = base + ajustes − pagos no revertidos.
6. Un responsable puede consultar su cuenta con estudio suspendido; eso no restaura entrenamientos. Coach asignado/alumno no ven información financiera del estudio.
7. Contactar a administración con mes/ID corto y motivo si hay discrepancia. No pedir que se modifique una cuenta emitida ni enviar contraseñas/fotos del alumno para justificar un cobro.

## 4. Superadmin: habilitar, emitir y registrar

1. Entrar como administrador de plataforma → Organizaciones → **Cuenta y pagos** del estudio.
2. Antes de habilitar cuentas reales, completar acuerdo/precio y puertas de piloto con responsables humanos. La habilitación registra actor, motivo y hora actual; no permite cobrar meses previos.
3. Elegir mes terminado. Revisar días/plan/total y confirmar Emitir cuenta del mes. Repetir devuelve misma cuenta; el mes actual permanece abierto.
4. Para corregir, abrir cuenta → movimiento Ajuste con signo → importe entero y motivo de al menos diez caracteres. Negativo abona; positivo añade cargo explicado. No reduce saldo por debajo de cero ni de pagos ya confirmados.
5. Para un pago **ya comprobado**: elegir Pago confirmado, importe, referencia, fecha e imagen opcional. El botón registra un asiento; no inicia transferencia. No aceptar sobrepago; resolver diferencias antes de guardar.
6. Comprobante PNG/JPEG/WebP hasta 2 MB y 8 MP, sin animación. Se guarda WebP privado normalizado sin metadatos/original. Solo responsable/superadmin pueden descargar. No mezclar con biblioteca ni fotos de progreso. PDF queda para T08.
7. Ante respuesta de red perdida, repetir la misma intención sin cambiar valores: UUID evita duplicado. Se conservan importe, referencia e imagen ante ese error; tras una confirmación se vacía también el selector de archivo. Si se cambian valores y el servidor indica conflicto, consultar primero la cuenta y reconciliar el resultado.
8. Un pago erróneo se revierte con motivo; queda el asiento original y su reversión. Registrar después el pago correcto, sin borrar evidencia.
9. Límites técnicos: 5.000 líneas por cuenta, 10¹² PYG por total/movimiento, 1.000 pagos/ajustes por cuenta y 64 MiB de comprobantes por estudio. No son recargos de almacenamiento del coach.

## 5. Operación y alertas

1. Ejecutar `scripts/forma.ps1 run ops:check`. Es lectura local de PostgreSQL/disco/backups; no envía datos ni programa tareas por sí solo.
2. Revisar DB, espacio libre (mínimo mayor entre 2 GiB y 10 %), heartbeat de medios (30 s), trabajos listos vencidos hace más de 15 min o leases de ejecución vencidos y backup de esta **misma base y almacenamiento** de menos de 24 h.
3. El informe agrupa cola por tipo, sin payload/correos. Un worker de medios sano no acredita entrega SMTP. Si correos están atrasados, no marcar operación lista ni arrancar envíos reales sin autorización/configuración; consultar [puertas](../piloto/00-puertas.md).
4. Si no reconoce backup: generar uno nuevo. Solo acredita archivos con sidecar `.enc.meta.json`, identidad de DB/storage coincidente, tamaño final y fecha válidos (edad desde inicio de snapshot, no desde final de copia). Los backups de bases aisladas de tests no sirven para cubrir la base de trabajo. El sidecar no acredita integridad ni restauración por sí solo.
5. Ante disco bajo: detener nuevas cargas desde operación, revisar cuotas/retención y backups; no borrar archivos privados manualmente. Usar mantenimiento con bloqueo de respaldo y referencias.
6. Ante cuota de comprobantes: conservar registros; revisión de retención con el operador antes de ampliar. No purgar asientos para liberar espacio.

### Coste por 100 alumnos

Introducir solo importes reales en `COST_VPS_MONTHLY_PYG`, `COST_BACKUP_MONTHLY_PYG`, `COST_SUPPORT_100_MONTHLY_PYG`. Vacío produce desconocido. El monitor suma esos tres para escenario de 100 alumnos y estima bytes por 100 desde el uso observado. Registrar aparte dominio/impuestos/egreso/crecimiento de medios y horas de soporte; no tratar una suma parcial como margen o tarifa validada. El uso sintético local no valida capacidad ni coste comercial.

## 6. Backup y restauración

1. Crear backup cifrado con el procedimiento existente y clave fuera del repo. Inventario incluye comprobantes de pagos, incluso revertidos, junto a fotos/miniaturas/medios retenidos.
2. Copiar archivo cifrado y sidecar al destino operativo; la copia externa y alertas requieren configuración humana, no están acreditadas por una segunda carpeta local.
3. Restaurar en DB y directorio nuevos; verificar hashes, referencias privadas y **20 conteos + 3 sumas de dinero** (23 indicadores). Incluye habilitaciones, cuentas, ajustes, pagos, reversiones, auditoría de plataforma e historial de planes.
4. El ensayo comprueba además cada saldo emitido frente a una suma independiente de base/ajustes/pagos/reversiones. Comparar una cuenta y saldo, un comprobante autorizado y denegación a alumno. Reconciliar revocaciones/borrados posteriores al snapshot antes de reabrir un entorno operativo.
5. Registrar fecha, versión, archivo, responsable y resultado. No sobrescribir una base activa para ensayar.

## 7. Soporte y piloto

Seguir [protocolo](../piloto/01-protocolo.md) y [registro](../piloto/02-registro.md). El resumen de administración es agregado del entorno: separar staging de la base de piloto y no ejecutar fixtures de prueba contra usuarios reales. Tiempo activo de creación de rutina, tickets, egreso/coste y disposición a pagar se observan manualmente; no se inventan a partir de timestamps o almacenamiento local.
