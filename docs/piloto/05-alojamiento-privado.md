# Alojamiento para probar Forma en una web privada

**Investigado el 23-10-2026 con documentación oficial.** No se creó cuenta externa, servidor, dominio, túnel o gasto. [Prueba local lista](../runbooks/t14-prueba-privada.md). Precios de referencia en moneda original; impuestos, región, disponibilidad, egreso, backups y otros servicios pueden añadir coste. Verificar el presupuesto final al contratar.

## 1. Qué necesita esta aplicación

Forma contiene web Vue estática/PWA, API Fastify/Node, PostgreSQL con roles/RLS/funciones, WebSocket y procesos de correo, medios, documentos y seguimiento. El Compose actual comparte un volumen privado entre API y workers. No es solo una página estática.

Para una prueba completa hay que conservar DB y archivos al reiniciar/redeplegar. Que un proveedor soporte Node o publique una URL gratis no demuestra compatibilidad de todo el programa. Un entorno de prueba acotado puede empezar sin medios/PDF/correo, con esas limitaciones expresas; no se presenta como aceptación de esos módulos.

## 2. Comparativa

Los comentarios de encaje son **evaluación técnica del repositorio**, no garantías del proveedor o mediciones de capacidad.

| Opción | Referencia publicada | Encaje con Forma y trabajo pendiente |
|---|---|---|
| **Railway** | Hobby tiene mínimo de USD 5/mes con USD 5 de consumo incluidos; el exceso se cobra. No es una tarifa plana para todo el sistema. [Precio](https://railway.com/pricing) y [facturación](https://docs.railway.com/pricing/understanding-your-bill). | Candidata para subir una prueba sin administrar un VPS. Hay que presupuestar app, DB, almacenamiento y workers y definir su empaquetado. Ofrece URL de plataforma y HTTPS, por lo que no exige comprar dominio para empezar. [Red](https://docs.railway.com/networking/public-networking). |
| **Render** | Web gratuita duerme después de 15 minutos sin tráfico; DB gratuita caduca a los 30 días. Los archivos locales son efímeros; disco persistente requiere servicio de pago. [Límites](https://render.com/docs/free). | Puede servir para un ensayo acotado, con datos prescindibles y fecha de caducidad controlada. Para conservar contenido necesita configuración y presupuesto de pago; no propongo el gratuito como alojamiento duradero de Forma. |
| **Hetzner Cloud, VPS** | Tabla oficial actualizada desde junio de 2026: CX23 Europa, EUR 5,49/mes **sin IPv4 ni IVA**. El modelo anuncia 2 vCPU/4 GB RAM/40 GB; disponibilidad por zona pendiente de comprobar. [Precio](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/) y [modelo](https://www.hetzner.com/cloud/cost-optimized/). | Encaje alto con Compose y volumen compartido actuales; menos cambios de aplicación. Requiere administrar Linux, actualizaciones, firewall, backup y monitorización. 4 GB es un candidato de partida para ensayo reducido, no capacidad comercial validada; PDF/antivirus/medios deben medirse con concurrencia limitada. |
| **DigitalOcean, VPS** | Basic Regular: 2 GB/1 vCPU USD 12/mes; 4 GB/2 vCPU USD 24/mes. [Tabla oficial](https://www.digitalocean.com/pricing/droplets). | Mismo encaje de arquitectura que otro VPS; cuesta más en esas referencias. DB/disco locales no sustituyen backup externo y mantenimiento. No usar el precio mínimo de 512 MiB como presupuesto de toda Forma. |
| **Fly.io** | Consumo por máquinas/volúmenes/red; volumen USD 0,15/GB/mes. La prueba publicada se limita a 2 horas de máquina o 7 días. [Precios](https://fly.io/pricing/) y [trial](https://fly.io/docs/about/free-trial/). | Flexible para contenedores, pero exige diseño de volúmenes, DB, regiones y presupuesto conjunto. No lo elegiría por una supuesta gratuidad permanente; para esta primera prueba añade decisiones operativas. |
| **Supabase** | Free: 500 MB de DB y 1 GB de archivos; pausa después de una semana sin actividad. Pro desde USD 25/mes. [Precios oficiales](https://supabase.com/pricing). | Es candidato para PostgreSQL/archivos, **no sustituye por sí solo** la API y workers actuales. Verificar roles/extensiones/migraciones; usar su Storage requiere adaptar el acceso a archivos. No sustituir nuestra autenticación/RLS solo para alojar la demo. |
| **Vercel** | Hobby gratuito limitado a uso personal/no comercial; protección con autenticación Vercel disponible según el plan. [Plan](https://vercel.com/docs/plans/hobby). | Buena candidata para el frontend; alojar todo el backend actual requiere adaptación o servicios adicionales. Separar frontend/API obliga a resolver mismo origen, cookies, CSRF y WebSocket. Para este producto no asumir que Hobby será admisible por ser una prueba ni que un deploy del frontend incluye DB/workers/archivos. |

### El detalle de archivos que cambia la decisión

Render documenta que el disco de un servicio no puede ser accedido por otro servicio. Railway documenta un volumen por servicio y limitaciones de réplicas. No se debe trasladar automáticamente el volumen compartido de Compose a servicios separados de esas plataformas. [Render discos](https://render.com/docs/disks), [Railway volúmenes](https://docs.railway.com/volumes/reference).

Alternativas técnicas a diseñar/verificar: servicio compuesto con procesos supervisados y volumen común, almacenamiento de objetos con adaptación de código o VPS con Compose. La elección influye en coste, reinicio de workers y recuperación. No se implementó ninguna de estas adaptaciones en esta investigación.

## 3. Probar desde el móvil usando el PC

Estas opciones conectan al equipo; no proporcionan por sí solas un servidor donde ejecutar Forma. El PC debe continuar encendido y conectado.

| Opción | Qué aporta | Qué falta |
|---|---|---|
| **Tailscale Serve** | Comparte un servicio local por HTTPS dentro de la red privada de dispositivos autorizados; puede dar nombre `*.ts.net` sin comprar dominio. [Serve](https://tailscale.com/docs/features/tailscale-serve). | Instalar/configurar en PC y teléfono, revisar condiciones del plan, fijar origen HTTPS y verificar cookies/CSRF/PWA. Personal anuncia gratuidad y hasta 6 usuarios para uso no comercial; no asumir elegibilidad de este proyecto comercial. [Planes](https://tailscale.com/pricing). Usar Serve privado; Funnel hace publicación y no se propone aquí. |
| **Cloudflare Tunnel + Access** | Conector desde el PC y barrera de identidad antes de entrar en la app. Access anuncia plan Free de hasta 50 usuarios. [Tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/), [Access](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/), [planes](https://www.cloudflare.com/plans/). | Requiere cuenta, conector, política que permita solo al titular y, para el flujo de hostname publicado descrito, dominio propio configurado. No se ha comprado uno. Un enlace aleatorio/Quick Tunnel no equivale a Access privado. |

No se instaló ni activó un conector. El servidor local preparado continúa solo en `127.0.0.1:4180`. Antes de cualquier proxy HTTPS se debe crear un perfil separado con `APP_ORIGIN`, cookies y proxy coherentes; el perfil HTTP local no se expone tal cual.

## 4. Recomendación para este proyecto

1. **Ahora, sin contratar:** usar la prueba local preparada para revisar admin → coach → alumno y anotar fallos. No necesita rebuild, carga o nuevos workers.
2. **Para probar solo tú desde el móvil con el PC encendido:** estudiar primero Serve privado y la elegibilidad del plan; si no encaja o se prefiere acceso por navegador sin cliente VPN, valorar Access/Tunnel con dominio. Ambos requieren configuración nueva y ensayo de PWA; no son una URL ya disponible.
3. **Para tener una web independiente del PC:** mis finalistas son **VPS pequeño** por su encaje con Compose/archivos y **Railway** por facilidad operativa, sujeto a resolver almacenamiento/procesos y coste. La preferencia técnica para conservar la arquitectura es VPS; el proveedor se elige tras confirmar presupuesto, disponibilidad y red desde Paraguay.
4. Mantener Render como alternativa administrada con las mismas reservas de persistencia. No dividir inicialmente entre Vercel, Supabase y otro backend sin una necesidad que compense la adaptación y varios proveedores.

Estas decisiones son provisionales. No se midió latencia desde Paraguay o coste de consumo de la app en esos servicios. No se compró ni desplegó nada.

## 5. Cómo montar la prueba privada cuando se elija destino

1. Confirmar presupuesto máximo, si el PC puede permanecer encendido, quién administra el entorno y si se requiere probar vídeos/PDF/correo.
2. Elegir cuenta/proyecto exclusivo de Forma y región disponible. Estimar **total** de app, DB, workers, persistencia, backup/egreso e impuestos; configurar los controles de presupuesto del proveedor.
3. Preparar staging separado con secretos nuevos y cuentas ficticias individuales. No subir `.env`, `.local`, los archivos de esta demo local, un dump de trabajo o contraseñas compartidas.
4. Resolver roles y migraciones PostgreSQL, permisos de storage y procesos. Mantener DB y servicios internos sin exposición pública directa. Si un módulo se excluye de la prueba alojada, hacerlo inaccesible expresamente y anotarlo.
5. Publicar solo la entrada HTTPS protegida. **Permitir únicamente al titular** antes de cargar la app, incluyendo API, WebSocket y registro; impedir que una URL alternativa del backend evite esa protección. Un login normal de la app o un nombre difícil de adivinar no restringen por sí solos todo el staging.
6. Mantener frontend/API bajo el mismo origen o diseñar y verificar la alternativa. No desactivar CSRF ni relajar cookies como atajo. Configurar la confianza en el proxy real; el overlay de Caddy con IP fija no se traslada sin revisión a otro proveedor.
7. Probar una vez acceso autorizado y denegado, sesión, conservación tras reinicio y una copia/restauración de esa DB/storage aislados. Guardar evidencia mínima sin secretos. La recuperación de demo no aprueba operación con datos reales.
8. Abrir desde iPhone/Android, verificar teclado/zoom, instalación, arranque frío, cambio de versión y guardado/reconexión. Las barreras externas de acceso pueden afectar el arranque instalado y deben incluirse en ese recorrido.
9. Retirar o rotar cuentas de prueba y acordar el paso siguiente. Continúan abiertas las puertas de privacidad, contenido, operación y piloto real; tener una URL HTTPS no las cierra.

## 6. Decisiones para continuar

- ¿Prueba desde el PC encendido o alojamiento autónomo?
- Presupuesto mensual máximo, incluyendo backups y dominio si corresponde.
- Cuenta del proveedor y acceso mediante el mecanismo autorizado; no enviar contraseñas o claves privadas por este chat.

Se puede decidir con esta comparación sin contratar varios servicios para ensayarlos ni instalar herramientas nuevas en este equipo.
