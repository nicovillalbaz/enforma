# 06. Seguridad, privacidad y operaciones

## Seguridad desde T01

- TLS, secretos fuera del repositorio, rotación documentada y entornos separados. La DB no queda expuesta públicamente.
- Contraseñas con Argon2id; sesión opaca revocable en cookie `Secure`, `HttpOnly`, `SameSite` apropiado; protección CSRF en mutaciones, límites de intentos y cierre de todas las sesiones.
- Invitación y recuperación por token aleatorio de un uso, hash en DB, caducidad y respuesta que no revele si existe un email. SMTP configurado; si falla, cola visible y reintento.
- Autorización en caso de uso y en consultas. Pruebas negativas por organización, por profesional y por alumno. Toda descarga de medio/PDF verifica permiso en el momento de acceso.
- Auditoría de cambios de roles, acceso, estado facturable, publicación, exportación, eliminación y soporte administrativo. Logs sin contraseñas, tokens, fotos, contenido de chats ni datos corporales.

## Datos personales y profesionales

La aplicación contendrá medidas, fotos corporales, diarios de comida y posibles datos de salud. Antes de activar cada módulo: finalidad documentada, consentimiento/otra base válida revisada, permisos mínimos, retención, exportación y borrado, acceso de soporte auditado y política para menores. No inferir diagnósticos ni hacer prescripciones médicas automáticas. Revisar legislación paraguaya vigente y contratos con asesor local antes del piloto con datos reales; el documento conceptual previo menciona la Ley 7593/2025, pero sus fechas y obligaciones no deben darse por validadas solo por ese chat.

## Medios y archivos

Cuotas por plan (almacenamiento, minutos y tamaño de subida), MIME real y extensión, nombres seguros, límites de dimensión/duración, escaneo de documentos arbitrarios antes de compartir, transcodificación sin confiar en metadatos del cliente. Subidas incompletas se limpian; borrado respeta referencias y retención. Videos/fotos/PDF privados se entregan con autorización y URL temporal corta o proxy; no hay enlaces públicos persistentes a datos del alumno.

## Backups y recuperación

Desde T01: copia diaria de PostgreSQL y medios cifrada fuera del VPS, retención mínima operativa definida en configuración, alerta si falla y prueba de restauración antes del primer piloto. Objetivos iniciales: RPO ≤ 24 h, RTO ≤ 8 h para piloto; revisar con clientes antes de prometer SLA. Ensayar restauración en entorno aislado sin sobrescribir producción, verificar conteos y un medio descargable. Documentar responsables, claves y cómo cortar acceso si hay incidente.

## Despliegue y observabilidad

Local → staging → producción, con migración revisada, backup anterior al despliegue, health checks y retorno a versión anterior de la aplicación si hay fallo. Migraciones de datos son hacia adelante y compatibles con despliegue gradual; no confiar en rollback destructivo. Capturar errores API/worker, latencia, cola, fallos de vídeo/PDF, uso de disco y backup. Alertas de disco, DB, 5xx y fallos de cola. Actualizaciones de dependencias por ciclos y revisión de vulnerabilidades.

## Costes y capacidad

El VPS único es una estrategia inicial, no un límite arquitectónico. Al piloto registrar CPU, RAM, DB, GB de media, egreso mensual y tareas pesadas. Establecer cuota y compresión antes de aceptar cargas sin límite. Escalar primero el componente que muestre saturación: almacenamiento, worker, DB o API. Nunca sustituir respaldo externo por otra partición del mismo servidor.


## Controles implementados en T06

Mediciones y fotos tienen permiso explícito por profesional; el owner no obtiene acceso automático. Las fotos requieren además consentimiento maestro versionado, se normalizan sin metadatos y no conservan original. API/fotos sin caché, fuera de IndexedDB/CacheStorage. Revocación comprobada reutilizando la misma URL; no retira copias ya recibidas por personas autorizadas.

La eliminación oculta de inmediato, retiene bytes 30 días y los depura mediante mantenimiento coordinado con backup. Copias previas mantienen su retención: antes de restaurar una copia operativa se deben reconciliar revocaciones/borrados posteriores. El ensayo aislado comprueba hashes, referencias y 13 conteos; respaldo externo y política integral de exportación/borrado siguen como puertas del piloto. [Operación T06](runbooks/t06-uso-y-operacion.md).


## Base operativa T07

Cuentas/asientos inmutables, acceso financiero owner/superadmin y comprobantes privados normalizados; las correcciones son nuevos asientos. Monitor local revisa DB/worker/cola/disco y frescura de backup de la misma identidad DB/storage; no acredita una copia de tests como operativa. Restauración compara 20 conteos, tres sumas de dinero, hashes/referencias y saldos autorizados.

El estado local de la cola de correo puede ser alerta; no iniciar envíos reales para ocultarla. Respaldo externo, SMTP, identidad del operador, políticas/retención/exportación/borrado integral y reconciliación de revocaciones siguen pendientes. [Operación T07](runbooks/t07-uso-y-operacion.md), [puertas](piloto/00-puertas.md).


## Recursos y generación T08

Permisos por recurso/alumno, autor/owner y sujeto personal. Cookie HttpOnly temporal por usuario/versión/ruta, sin tokens en URL. Revocación/archivo/pausa/suspensión revalidados por entrega; una copia descargada no puede retirarse del dispositivo. PDF externo requiere ClamAV, no solo extensión; Office/ZIP/HTML no admitidos. Renderer de plantillas propias escapadas, sin JS/red; worker secuencial con cuotas/leases. [Manual](runbooks/t08-uso-y-operacion.md).

Retención 30 días, inventario y bloqueo de respaldo. Cuatro conteos nuevos: 27 indicadores previstos; restauración T08 pendiente, no acreditada con T07. Antivirus de pruebas es un servidor controlado, no motor real. [Límites](evidencias/t08.md).

## Alimentación T09 — permisos propios

Habilitación explícita de owner/coach y vínculo a ficha; alumno decide diario/fotos por profesional con consentimiento `nutrition-v1`, independiente de datos corporales/recursos. Owner sin concesión no lee diario. RLS, snapshots inmutables, revisión optimista, UUID ajeno sin sobrescritura y funciones de escritura acotadas. Valores desconocidos se preservan sin coerción a cero. Fotos recodificadas sin EXIF, autorización/auditoría por lectura y `no-store`; revocación bloquea nuevas lecturas.

Inventario/mantenimiento y monitor incluyen fotos. Backup añade nueve conteos: 36 indicadores previstos, sin restauración T09 ejecutada. Conciliar revocaciones tras recuperación y completar política integral de datos antes del piloto. [Manual](runbooks/t09-uso-y-operacion.md), [acta](evidencias/t09.md), [puerta P15](piloto/00-puertas.md).

## Ampliación T10

Chats por pareja privada; owner sin acceso implícito a otro profesional. Adjuntos requieren sesión/ACL actual y no se pueden reutilizar por la biblioteca. Seguimiento separado de alimentación/fotos corporales y revocable por conversación. WebSocket con Origin y permisos revalidados; no transporta cuerpos de mensajes. Conservación técnica 180 días de contenido, 90 de avisos y 24 horas sin enviar, pendiente de condiciones definitivas. [Decisiones y límites](decisiones/010-chat-y-seguimiento-privados.md).

Programador por lotes y conversiones secuenciales por defecto; scanner real obligatorio para PDF. Monitor añade seguimiento y backup trece conteos, sin una restauración nueva. Mantener puertas de teléfonos, HTTPS/WebSocket, antivirus y recuperación T08–T10 antes del piloto. [Operación](runbooks/t10-uso-y-operacion.md).

## T11 — Agenda y avisos internos

RLS, funciones de dominio, recibos y revisiones; exclusión global de horarios y capacidad transaccional. Owner administra calendario sin acceso implícito al chat. Preview de check-in exige conversación propia/consentimiento; ejecución redacted para otros profesionales. Outbox sin respuestas ni cuerpos privados. Revalidar permiso, preferencia, silencio, límite y vigencia antes de entregar.

Worker followup existente procesa agenda cada minuto en lotes acotados, con lease, deduplicación y reintento limitado. Notificaciones se purgan a 90 días; aprobar retención de historial técnico antes de piloto. Monitor incluye latido/cola interna; no se ha ejecutado un chequeo operativo global con todos los servicios activos. Backup amplía diez conteos a 59 indicadores previstos; recuperación T11 sigue abierta. [Operación y respuesta a incidencias](runbooks/t11-uso-y-operacion.md), [ADR](decisiones/011-agenda-y-avisos-internos.md).

## T12 — Finanzas del coach y CRM

RLS, owner para gestión comercial, alumno solo lectura propia, staff sin concesión implícita. Contratos/snapshots/cuotas y movimientos inmutables con recibos y bloqueo de organización para cupo/saldo. Comprobante autenticado no-store, imagen normalizada, presupuesto comercial 64 MiB por estudio y referencia incorporada al inventario/backup. No mezcla cuenta SaaS o permisos del chat.

CRM redacciona cerrados a 90 días (hasta 100 por ciclo del worker existente) o por borrado explícito; revalida estado/bloqueo. Historial financiero/IDs técnicos conservan política propia pendiente de aprobación. CSV solo agregado numérico/moneda, owner y auditado. Backup previsto: 81 indicadores, sin ensayo T12 acreditado. [Operación](runbooks/t12-uso-y-operacion.md), [acta](evidencias/t12.md).

## T13 — Alcance y ayuda

Alta coach también protegida en función SQL; constructor anterior sin permiso API. Resumen de inicio exige owner del tenant activo, no expone contactos/conversaciones y conserva no-store. Mostrar enlaces por rol no sustituye autorización de destino. Información es pública y no presenta contenido privado; contacto NAVZ identifica creador, no cierra identidad del operador (P01).

Sin nuevas tablas, datos financieros o medios; 81 indicadores de backup previstos siguen sin nuevo ensayo T13. [Decisión](decisiones/013-coaches-independientes.md), [operación](runbooks/t13-uso-y-operacion.md), [plan de piloto T14](tandas/14-escala-lanzamiento.md).

## T14 — Preparación de producción y continuidad

Validación de configuración antes del pool/API, origen exacto/HTTPS de producción y secretos sin marcadores conocidos. Proxy de confianza por IP exacta del peer inmediato y primer salto, puerto API privado; overlay con red edge/IP fija de Caddy. No usar número de saltos ni trustProxy=true. SW de producción no-cache; política de API no-store y cookies seguras conservadas. [ADR](decisiones/014-estabilizacion-y-piloto.md).

`release:check` inventaría versiones/lock/migraciones/build; consulta DB opcional de solo lectura con topes y sin datos de alumnos. Aprobación de piloto siempre falsa; no sustituye RLS/IDOR, derechos de datos, proxy real o recuperación. Monitor incorpora comprobantes del coach y topes/solo lectura. Snapshot local T14 registra servicios/cola/backup pendientes sin corregirlos mediante envíos o tareas pesadas. [Resultados](evidencias/t14.md).

[Guía de salida](runbooks/t14-salida-y-piloto.md) y [ficha de autorización](piloto/03-salida-independiente.md): entorno separado, responsables, correo/scanner, aceptación física, una recuperación externa aislada con 81 indicadores vigentes y revocaciones reconciliadas, RPO/RTO medidos, rollback y soporte. No se ejecutaron esos pasos externos ni se implantó exportación/borrado integral autoservicio. P01–P18 aplicables siguen abiertos.

Continuación 0.14.1: manifiesto fuera de raíz pública con huellas de fuentes/artefactos y comparación de versión; no lee secretos ni certifica constructor/entorno/dependencias/despliegue. Pago/reintento/comprobante WebKit T07 verificado en caso aislado, sin afirmar suite histórica completa o iPhone/PWA físico. [Alcance y límites](evidencias/t14-continuacion.md), [operación](runbooks/t14-continuacion-local.md). Base/storage de prueba eliminados; DB de trabajo y cola antigua intactas.

## T14-07 — Acceso y marca mensual manual

V0.14.2/023. Altas pendientes, aprobación/cupo/precio por operador, marcas mensuales y acceso como decisiones separadas. Funciones/RLS, bloqueo por estudio, revisión e intención, eventos inmutables y usuario deshabilitado sin lectura. Suspender estudio bloquea coach/alumnos; restaurar no reactiva alumnos individualmente pausados. Owner puede leer su mensualidad suspendido sin acceso a alumnos. [ADR](decisiones/015-control-mensual-manual.md), [API](runbooks/api-t14-control.md), [acta](evidencias/t14-control-mensual.md). Backup vigente: 85 indicadores previstos (69 conteos/16 sumas), sin restauración nueva. Historias financieras y configuraciones anteriores conservadas; revisar cada espacio antes del piloto.
