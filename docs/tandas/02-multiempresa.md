# T02 — Multiempresa, marca blanca, alumnos y planes

**Depende de:** T01. **Objetivo:** dos coaches operan en el mismo sistema sin ver datos mutuos. **Salida:** onboarding completo coach/alumno y conteo de plazas habilitadas.

## Pasos en orden

1. **T02-01 Modelo.** Migrar usuarios, organizaciones, marca, membresías, perfiles de alumno, invitaciones, sesiones, planes y versiones de plan, suscripciones e intervalos facturables. Claves compuestas, índices por `organization_id`, RLS y estados con transiciones permitidas.
2. **T02-02 Auth.** Registro coach, verificación de email si SMTP está listo, login, logout, sesión revocable, recuperación; alta por invitación de un uso para alumno. Nunca enviar contraseña en texto ni reutilizar enlace consumido.
3. **T02-03 Contexto y permisos.** Resolver marca por subdominio/slug, validar pertenencia/rol en API y RLS; permitir un usuario en varias organizaciones con selector explícito. Superadmin con rutas y auditoría separadas.
4. **T02-04 Onboarding.** Asistente del coach: nombre, logo, colores, perfil, primer alumno; preview móvil del acceso. Portal del alumno: aceptar invitación, crear contraseña, completar perfil básico, ver inicio vacío útil.
5. **T02-05 Ciclo alumno.** Alta, invitado, activo/habilitado, pausado, reactivado, archivado; registro de actor y motivo. Al habilitar/pausar crear/cerrar intervalo facturable atómicamente; impedir solapamiento y doble alta.
6. **T02-06 Planes.** Sembrar Básico/Pro con precios de prueba configurables y límites, sin cobrarlos aún; mostrar plan, alumnos habilitados y cupo. Superadmin puede suspender organización y ver eventos auditados.
7. **T02-07 QA.** Fixtures de Coach A, Coach B, alumno A/B y usuario con dos membresías; probar cambio de IDs, enlaces, subdominios y tokens, incluyendo medios futuros simulados. Probar concurrencia al pausar/reactivar.

## Aceptación y evidencia

- Dos marcas distintas muestran login, color y logo correctos en 320/390/1280 px.
- Coach A no puede leer/escribir alumno B ni por API, URL, ID conocido o consulta SQL como rol API. Alumno A solo ve su perfil.
- Invitación expirada/consumida falla; pausa corta el intervalo; dos coaches del mismo gimnasio no crean dos alumnos facturables.
- Demo: registrar dos coaches, invitar alumnos, cambiar estado y comprobar conteo/suscripción.

**No cerrar sin:** política de soporte para recuperación de cuenta y texto de privacidad inicial.


## Implementación local — 20-10-2026

**Estado:** completada funcionalmente en local. El pase a un piloto público sigue condicionado por las puertas externas de T01/T07. No se marca SMTP, TLS, teléfonos físicos ni revisión legal como verificados.

| Ticket | Estado | Implementación y comprobación |
|---|---|---|
| T02-01 Modelo | Hecho local | Migración `002_organizations.sql` aplicada: RLS, claves compuestas, usuarios/fichas separados, branding, invitaciones, planes versionados e intervalos no solapados |
| T02-02 Auth | Hecho local | Registro, confirmación 24 h, invitación 72 h, sesión nueva/existente y recuperación de T01; plantillas y cola SMTP conectadas |
| T02-03 Contexto | Hecho local | Selector de organización, permisos API/RLS, host simulado y circuito superadmin separado; subdominio público real pendiente de despliegue |
| T02-04 Onboarding | Hecho local | Cuenta → estudio → plan; marca/logo y primer alumno desde panel; aceptación y perfil del alumno, inicio vacío útil |
| T02-05 Ciclo | Hecho local | Invitado/activo/pausado/archivado, motivo, control de versión, activación/cierre transaccionales, concurrencia verificada |
| T02-06 Planes | Hecho local | Básico/Pro, versión inmutable, trial/cupos, cambio de plan y suspensión auditados; sin cobros ni facturas |
| T02-07 QA | Hecho local | 40 pruebas aprobadas acumuladas (7 unitarias, 15 DB/API, 18 navegador); resultados, alcance y límites en el acta |

### Demostración reproducible

1. Seguir [uso y soporte](../runbooks/t02-uso-y-soporte.md), crear un coach y confirmar su correo desde la bandeja local propia.
2. Configurar nombre, color, logo y bienvenida; abrir `/estudio/:slug` y comprobar persistencia después de recargar.
3. Crear alumno → abrir ficha → preparar enlace. Abrirlo en otra sesión del navegador y aceptar.
4. Comprobar que el alumno ve solo su perfil y que una plaza queda habilitada.
5. Pausar desde el coach: alumno sin portal, intervalo cerrado y cupo liberado. Reactivar: nuevo intervalo, una plaza.
6. Crear otro estudio con el mismo usuario; cambiar el selector y comprobar que no aparecen los alumnos del anterior.
7. Entrar con el superadmin ficticio, suspender solo una organización de prueba y restaurarla con motivo. Revisar auditoría y continuidad del otro estudio.

### Documentos de salida

- [Acta, pruebas y capturas](../evidencias/t02.md).
- [Guía de usuario y soporte, recuperación y privacidad inicial](../runbooks/t02-uso-y-soporte.md).
- [Contratos API](../runbooks/api-t02.md).
- [ADR 002: decisiones e invariantes](../decisiones/002-organizaciones-y-acceso.md).
- El aviso inicial funciona en `/privacidad`; las políticas comerciales/legales finales y la validación con personas reales se completan antes de T07.

### Entrega a T03

Reutilizar `actorTransaction`, sesión, contexto/roles y referencias compuestas. El logo es un recurso público deliberado; los vídeos/fotos de alumnos nunca deben heredar ese endpoint público. Añadir cuotas acumuladas, limpieza de logos antiguos/huérfanos, formatos y transcodificación. La administración gráfica de profesionales/sedes queda en T13; el modelo ya evita duplicar plazas.



## Actualización de alcance T13

La decisión vigente limita el producto a coaches independientes. Cualquier referencia previa a equipos, sedes, recepción o grupos formales como entrega T13 queda sustituida por [consolidación individual](../tandas/13-gimnasios.md); [multicoach se aplaza](../pendientes/gimnasios-futuro.md) fuera de las tandas actuales.

