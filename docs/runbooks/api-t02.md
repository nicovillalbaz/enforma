# API de T02 — contratos y comprobación

Base local: `http://127.0.0.1:3001`; el frontend usa `/v1` por el proxy de Vite. Contrato OpenAPI en `/v1/docs` solo en desarrollo. Ejemplos y pruebas ejecutables: `tests/integration/organizations.test.ts`.

## Reglas comunes

1. Hacer GET `/v1/security/csrf`; conservar la cookie firmada HttpOnly y el `token` devuelto.
2. Toda mutación envía `X-CSRF-Token` y JSON cuando tiene body. Origin debe coincidir con `APP_ORIGIN` o con un subdominio aprobado que coincida con el host.
3. Login/registro/aceptación emiten una cookie de sesión opaca; no se devuelven JWT para `localStorage`.
4. Endpoints privados verifican identidad, pertenencia, rol y estado. La base vuelve a limitar las filas por RLS. No aceptar `organization_id` arbitrario del body.
5. Errores seguros: `code`, `message`, `request_id`; no se devuelven SQL ni credenciales. 401 sesión/credenciales, 403 permiso/estado, 404 recurso oculto, 409 conflicto/cupo, 400 datos/token inválido, 429 límite.
6. La ficha incluye `version`. Las actualizaciones envían la versión leída para evitar pisar otro cambio.

## Identidad y entradas públicas

| Método/ruta | Contenido y resultado |
|---|---|
| GET `/v1/plans` | Básico/Pro y última versión, precio PYG, cupo y 14 días de prueba |
| POST `/v1/auth/register-coach` | `fullName,email,password,name,slug,kind,accent,plan,privacyAccepted:true`; 201 con `organizationId` y verificación en cola |
| POST `/v1/auth/login` | `email,password,studioSlug?`; la marca opcional debe pertenecer al usuario |
| GET `/v1/auth/me` | Identidad, confirmación de correo, tema y flag de superadmin |
| POST `/v1/auth/logout` | Revoca sesión y borra cookie |
| POST `/v1/auth/verification-email` | Reenvío de confirmación para la cuenta conectada |
| POST `/v1/auth/verify-email` | `token`; un uso, 24 h |
| POST `/v1/auth/password-reset` | `email`; respuesta genérica y trabajo en cola si corresponde |
| POST `/v1/auth/password-reset/confirm` | `token,password`; un uso, 30 min; revoca sesiones anteriores |
| PUT `/v1/auth/preferences` | `theme:light/dark`; preferencia de cuenta |
| GET `/v1/public/studios/:slug` | Marca publicada; no devuelve alumnos ni rutas internas de almacenamiento |
| GET `/v1/public/studios/:slug/logo` | WebP público normalizado; URL con versión para invalidar caché |
| POST `/v1/invitations/inspect` | `token`; datos mínimos para aceptar; no consume el token |
| POST `/v1/invitations/accept` | `token,fullName,goal,privacyAccepted:true,password?`; contraseña requerida para usuario nuevo o existente sin sesión coincidente |
| GET `/v1/development/emails` | Solo desarrollo autenticado; últimos mensajes de confirmación/recuperación de esa identidad |

## Organizaciones y alumnos

Usar `:org` como UUID devuelto por `/v1/organizations`, nunca como prueba de permiso.

| Método/ruta | Permiso y contrato |
|---|---|
| GET `/v1/organizations` | Lista segura de pertenencias propias, rol y estado |
| POST `/v1/organizations` | Usuario conectado; `name,slug,kind,accent,plan`; crea otro owner/estudio |
| GET `/v1/organizations/:org` | Miembro/alumno activo: organización y marca |
| PUT `/v1/organizations/:org/branding` | Owner; `name,accent,welcomeMessage,biography,contactEmail` (nullable) |
| POST `/v1/organizations/:org/branding/logo` | Owner; `dataUrl` base64 PNG/JPEG/WebP, entrada <=256 KB y <=4.194.304 píxeles |
| DELETE `/v1/organizations/:org/branding/logo` | Owner; retira logo público |
| GET `/v1/organizations/:org/students?limit=50&cursor=UUID` | Owner/coach; solo fichas autorizadas; `students,nextCursor` |
| POST `/v1/organizations/:org/students` | Owner/coach; `displayName,email,goal`; crea invitado y asigna al profesional creador |
| GET `/v1/organizations/:org/students/:id` | Owner o profesional asignado |
| PUT `/v1/organizations/:org/students/:id` | `displayName,goal,version`; el correo de acceso no se edita desde aquí |
| PATCH `/v1/organizations/:org/students/:id/state` | `status,version,reason`; transición y actualización de intervalo atómicas |
| POST `/v1/organizations/:org/students/:id/invitation` | Profesional autorizado con email verificado; devuelve `url,expiresAt,delivery:queued` solo al prepararla |
| GET `/v1/organizations/:org/subscription` | Owner; snapshot de plan/versión/contador y últimos 100 intervalos |
| GET `/v1/organizations/:org/portal` | Alumno activo: solo su ficha; staff puede abrir preview sin alumno vinculado |
| PUT `/v1/organizations/:org/portal/profile` | Alumno activo: `displayName,goal` de su propia ficha |

## Plataforma

| Método/ruta | Contrato |
|---|---|
| GET `/v1/admin/organizations` | Solo superadmin; listado de organizaciones/planes/contadores; consulta auditada |
| PATCH `/v1/admin/organizations/:org/state` | `status:suspended/resume,reason` (10–500 caracteres); suspende/restaura e intervalos |
| PATCH `/v1/admin/organizations/:org/plan` | `plan:basic/pro,reason`; comprueba cupo y registra versión anterior/nueva |

No hay endpoint de autoasignación de privilegios. Usar la [guía de soporte](t02-uso-y-soporte.md) para bootstrap controlado y límites operativos.
