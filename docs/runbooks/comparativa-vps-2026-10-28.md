# Comparativa de alojamiento para Forma — 28 de octubre de 2026

## Qué necesita Forma

La instalación actual de `compose.yml` incluye PostgreSQL, API, web, trabajador de correo, trabajador de medios, trabajador de documentos y seguimiento. Los procesos de medios y documentos tienen límites de 768 MB cada uno. Aún no hay una medición de consumo en un VPS real. Para una prueba privada, **4 GB de RAM es el punto de partida a medir; 8 GB deja más margen**. Un VPS de 1–2 GB exigiría recortar servicios y no representa la instalación completa.

El precio de una VM no cubre necesariamente dominio, correo saliente, copia externa, impuestos, IPv4 o tráfico adicional. Antes de pagar, comprobar el total en el carrito con país de facturación Paraguay y período de **un mes**. Nunca tratar una instantánea local como la única copia de la base de datos.

## Tabla de precios comprobados en páginas oficiales

Los importes son los publicados el día de la revisión, no una cotización de compra. «Desde» significa que ubicación y plazo pueden cambiar el total. EUR y USD se mantienen en su moneda original, sin conversión inventada.

| Proveedor y plan | Recursos | Precio publicado | Condición decisiva para Forma |
| --- | --- | --- | --- |
| [Oracle Always Free A1](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm) | Hasta 2 OCPU/12 GB en la cuenta gratuita | 0, si se crea dentro de límites | El intento en São Paulo falló por falta de capacidad. Una instancia menor puede entrar, sin garantía. |
| [Google Cloud prueba](https://cloud.google.com/signup-faqs) | Crédito para Compute Engine | 300 USD / 90 días para cuentas elegibles | Sin cobro automático al final si no se cambia al plan pagado. No es alojamiento gratis permanente. |
| [AWS Free Plan](https://aws.amazon.com/free/free-tier-faqs/) | Crédito para servicios elegibles | 100 USD iniciales, hasta 100 USD adicionales / hasta 6 meses | Verificar que la VM deseada esté permitida antes de planear la instalación. |
| [Vultr Try250](https://discover.vultr.com/) | Crédito promocional | Hasta 250 USD para nueva cuenta | [Hasta 30 días](https://docs.vultr.com/platform/create-an-account); requiere método de pago. Confirmar crédito aplicado y precio normal antes de crear recursos. |
| [OVHcloud VPS-1](https://us.ovhcloud.com/vps/) | 2 vCore, 4 GB, 40 GB NVMe, copia diaria del día previo | Desde 4,54 USD/mes | Ofrece [contrato mes a mes](https://support.us.ovhcloud.com/hc/en-us/articles/360002306224-Overview-of-Billing-with-OVHcloud-US); confirmar precio de ese plazo y ubicación en carrito. |
| [OVHcloud VPS-2](https://us.ovhcloud.com/vps/) | 4 vCore, 8 GB, 75 GB NVMe, copia diaria del día previo | Desde 8,50 USD/mes | Candidato fuerte si el precio mes a mes se aproxima al anunciado. |
| [Time4VPS Linux 8](https://www.time4vps.com/linux-vps/) | 3 CPU, 8 GB, 100 GB | 10 € primer mes; 19,99 € renovación mensual | Precio de un mes explícito; copias opcionales. Servidor en Lituania. |
| [netcup VPS Lite 1 G12.5s](https://www.netcup.com/en/server/vps-lite) | 2 vCore, 4 GB, 80 GB | Desde 5,86 €/mes con contrato mínimo de 6 meses | No cumple el objetivo de contratar solo un mes. Ubicación europea según disponibilidad. |
| [netcup VPS Lite 2 G12.5s](https://www.netcup.com/en/server/vps-lite) | 4 vCore, 8 GB, 160 GB | Desde 9,50 €/mes con contrato mínimo de 3 meses | Precio atractivo para más tiempo, pero no para una prueba de un mes. |
| [netcup VPS 1000 G12.5](https://www.netcup.com/en/server/vps) | 4 vCore, 8 GB, 128 GB | La portada muestra 14,50 €/mes para 12 meses | Existe selección de 1 mes y ubicación en Manassas, EE. UU.; el total de 1 mes debe comprobarse en el configurador. |
| [Hetzner CX23/CX33](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/) | 4 GB / 8 GB | 5,49 € / 8,49 € al mes sin IPv4 ni impuestos | Precios actuales oficiales, pero la [página de compra](https://www.hetzner.com/cloud/cost-optimized/) mostró ambos como no disponibles. |
| [Contabo Cloud VPS 4](https://contabo.com/en-us/pricing/) | 4 vCPU, 8 GB, 100 GB SSD | 4,40 €/mes con contrato de 24 meses | Existe plazo de [un mes](https://contabo.com/en-us/legal/terms-and-conditions/), pero el precio de ese plazo y recargos por región no se verificaron. |
| [Hostinger KVM 2](https://www.hostinger.com/es/servidor-vps) | 2 vCPU, 8 GB, 100 GB NVMe | 7,79 €/mes anunciado; **186,96 € pagaderos hoy por 24 meses** | Hay plazo de [un mes](https://www.hostinger.com/support/1583589-how-to-pay-for-hostinger-services-in-advance/), sin precio final público comprobado para ese plazo. |
| [IONOS VPS L+](https://www.ionos.com/servers/vps) | 4 vCore, 8 GB, 240 GB NVMe | 8 USD/mes durante 3 meses, con contrato de 1 año; precio normal mostrado 25 USD/mes | La promoción implica compromiso anual. No es la opción para una prueba de un mes. |
| [IONOS Cloud Basic Cube S/M](https://cloud.ionos.com/compute/cloud-cubes) | 4 GB / 8 GB | 10,08 / 18,72 USD por 30 días de VM | Facturación por uso; [IPv4 y salida de datos](https://cloud.ionos.com/prices) tienen cargos separados. |
| [UpCloud Starter](https://upcloud.com/pricing/) | 4 GB/2 CPU/30 GB; 8 GB/2 CPU/40 GB | 12 / 18 €/mes | IPv4 incluido; el disco de 30–40 GB exige controlar medios y copias. Facturación horaria con tope. |
| [AWS Lightsail](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-bundles.html) | 4 GB/2 vCPU/80 GB; 8 GB/2 vCPU/160 GB, IPv4 | 24 / 44 USD/mes | Precio transparente y sin compromiso largo; más caro que los VPS económicos. |
| [DigitalOcean Basic](https://www.digitalocean.com/pricing/droplets) | 4 GB/2 vCPU/80 GB; 8 GB/4 vCPU/160 GB | 24 / 48 USD/mes | IPv4 incluida en el plan empaquetado; copias opcionales con costo adicional. |
| [Akamai/Linode Shared](https://www.akamai.com/cloud/pricing/cpu) | 4 GB/2 CPU/80 GB; 8 GB/4 CPU/160 GB | 24 / 48 USD/mes | Pago por uso con tope mensual; costo superior al grupo económico. |
| [GratisVPS gratis](https://gratisvps.net/) | 2 vCPU, 2 GB, IPv4 compartida, sin copias | 0 USD anunciados | Solo experimento con datos ficticios. Sus [condiciones](https://gratisvps.net/terms.html) permiten suspender sin aviso y excluyen las copias. No se verificó entrega real. |
| [GratisVPS Standard Cloud / PREM2](https://gratisvps.net/) | 6 vCPU, 8 GB; el carrito PREM2 mostrado por el usuario indica 80 GB NVMe | **4,99 USD por un mes, 0 de alta y 4,99 USD a pagar hoy**, según el carrito aportado por el usuario | El precio de ese carrito está claro; siguen sin comprobarse la entrega y el desempeño. La promesa comercial de copias diarias contradice la cláusula general de [no hacer respaldos](https://gratisvps.net/terms.html). Usar primero con datos ficticios y copia externa. |

## Oracle: capacidad preemptible

[Oracle permite A1.Flex preemptible](https://docs.oracle.com/en-us/iaas/Content/Compute/Concepts/preemptible.htm), pero esa instancia se puede terminar en cualquier momento; no se puede detener, reiniciar ni convertir a on-demand. La opción de conservar o borrar el volumen de arranque al ser recuperada cambia el destino de los datos del disco. No hay garantía de que elegir preemptible resuelva el error de falta de capacidad en São Paulo. La documentación de [Always Free](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm) confirma la franquicia A1, pero no confirma expresamente en esa página cómo se aplica a la modalidad preemptible; verificar la estimación de costos y elegibilidad en la cuenta antes de crearla. No usarla como alojamiento estable de Forma.

## Decisión para el piloto

1. **Sin pagar ahora:** si el usuario es elegible, Google Cloud 90 días es la prueba más larga con una VM de 4 GB y sin conversión automática a facturación pagada. Guardar copias externas antes de que venza el crédito.
2. **Con gasto de un solo mes:** verificar primero el total de OVHcloud VPS-1 (4 GB) y VPS-2 (8 GB) con contrato de un mes. Si se aleja mucho del precio anunciado, Time4VPS Linux 8 tiene un primer mes publicado de 10 €, aunque su renovación sube a 19,99 € y su ubicación es lejana para Paraguay.
3. **Para plazo estable después de medir:** reexaminar netcup, Hetzner y OVHcloud según disponibilidad, latencia desde Paraguay y precio final. No contratar 12–24 meses antes de confirmar funcionamiento y uso real.

No hay razones para suponer tráfico alto de Forma al principio. La decisión entre 4 y 8 GB depende del consumo medido con los contenedores y una generación real de PDF/medios, no del número teórico de alumnos. El dominio propio y el correo saliente se presupuestan aparte.
