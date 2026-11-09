# ADR 007 — Instalación por marca y cuenta SaaS auditable

**21-10-2026 · T07 implementada en local, v0.7.0.** Se conservan Vue, Fastify, PostgreSQL, Sharp y la cola de T05; sin pasarela ni pagos automáticos. [Evidencia y pendiente de QA por recursos](../evidencias/t07.md); piloto real abierto.

## Cuenta comercial

- PYG entero; mes calendario `[inicio, siguiente inicio)` en America/Asuncion. Un alumno cuenta una vez por fecha con cualquier acceso habilitado; intervalos de fin exclusivo y días distintos evitan duplicados por pausa/reactivación/profesionales.
- Fórmula v1: redondear HALF_UP `precio mensual × días / días del mes` por alumno y sumar. Base/incluidos/mínimo/tope son 0/0/0/null en esta versión; no se añaden cargos implícitos.
- La emisión requiere habilitación explícita del administrador de plataforma. Comienza como máximo desde esa habilitación y fin de prueba, sin cobrar intervalos anteriores. La habilitación también activa la suscripción/cupos de forma transaccional; no deja al estudio bloqueado al vencer la prueba, y el inicio del cálculo sigue respetando ese fin. Un estudio nuevo no se incorpora automáticamente a cuentas cobrables. Esto no sustituye acuerdo comercial/políticas revisadas del piloto.
- El precio mensual usa la versión al abrir el mes (o al habilitar la primera cuenta a mitad de mes). Cambiar plan modifica cupos/funciones inmediatamente según T02; el precio nuevo comienza el siguiente mes. La vista explica ambos. Historial de cambios y snapshot congelan el criterio; pruebas incluyen cambio a mitad de mes.
- El mes actual es estimación hasta ahora, no deuda emitida. Solo se emiten meses terminados; unicidad estudio/mes y bloqueo del estudio hacen el cierre idempotente. La cuenta conserva nombres, días, plan, fórmula, precio, zona e importe; no se recalcula silenciosamente.
- Pagos manuales con referencia, fecha, actor y comprobante privado opcional de imagen normalizada. No admitir sobrepago; un error se revierte con un asiento nuevo y motivo. Ajustes con signo y motivo, sin reducir total por debajo de cero o pagos ya confirmados. No se modifica ni elimina el asiento original.
- Owner y superadmin pueden consultar; alumnos/coaches no ven la cuenta. Escritura financiera solo superadmin activo, mediante funciones acotadas y auditoría. Cuenta informativa, no factura fiscal; revisión tributaria y precio del piloto siguen pendientes.

## Instalación y actualización

Manifest público e iconos PNG por slug, identidad estable por estudio y arranque en su enlace. Icono con logo normalizado o inicial segura, fondo y margen para recorte. No contiene datos de alumnos ni tokens. Scope de rutas compartido en desarrollo; aislamiento de marca/datos lo realiza autorización, no el manifest. En producción usar origen por estudio previsto en arquitectura.

El arranque de una instalación elige explícitamente su estudio si la cuenta pertenece a él; no hereda otro estudio recordado. Login conserva contexto y no cambia identidad por instalar. El shell offline sigue siendo público; API, comprobantes, fotos y vídeos fuera de CacheStorage. Una actualización espera a que se cierren todas las ventanas controladas. La interfaz avisa y ofrece comprobar versiones; no se fuerza skipWaiting ni recarga con formularios/series pendientes.

Fuentes técnicas consultadas: [identidad del manifest](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/id), [start_url](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/start_url), [scope](https://developer.mozilla.org/docs/Web/Progressive_web_apps/Manifest/Reference/scope), [WebKit: aplicaciones de inicio](https://webkit.org/blog/13878/), [WebKit Safari 26](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/). Las guías de instalación se comprobarán en teléfonos reales; no se declara instalación física aprobada desde Windows.

## Operación y salida

Monitor local de DB, worker, cola, disco, cuotas y edad de backup; estimación de coste por 100 alumnos con entradas reales, sin inventar tarifas. Métricas agregadas del piloto excluyen medidas/fotos/notas. Preparar guías y registro de puertas; T07-07 sigue pendiente hasta incorporar coaches reales con autorización y observar uso. No enviar invitaciones ni mensajes reales como parte de estas pruebas locales.
