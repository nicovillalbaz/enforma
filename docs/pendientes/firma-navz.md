# Firma del creador — NAVZ

**Solicitado por el usuario:** 22-10-2026. **Prioridad:** importante. **Estado:** implementada en T13 (v0.13.0) en Información, footer, acceso y registro. Comprobación visual local puntual; teléfonos físicos pendientes.

## Texto aprobado como referencia

> Creado por NAVZ, +595972995557

Presentación propuesta:

**Creado por NAVZ · +595 972 995 557**

Conservar el nombre NAVZ y el número exacto `+595972995557`. Los espacios son solo de presentación.

## Ubicación y diseño propuestos

1. Incorporar una sección **Información de la aplicación** accesible desde Más opciones, tanto para coach como para alumno. Mostrar allí la firma y el contacto legibles.
2. Incluir una firma discreta en el footer de las pantallas donde resulte adecuado, con acceso a esa información. Mantener la marca del coach como identidad principal de la aplicación de marca blanca.
3. En móvil, colocarla dentro del contenido desplazable, con separación de la navegación inferior y de las safe areas. No crear una barra fija adicional ni reducir el espacio de los formularios.
4. En PC, integrar la firma en el footer o información secundaria usando los tokens y temas existentes.
5. El teléfono podrá ser un enlace `tel:+595972995557` activado por el usuario. No abrir llamadas, enviar mensajes o iniciar conversaciones automáticamente.

## Tareas entregadas en T13

- [x] **NAVZ-01** Revisar las pantallas de información/footer existentes y elegir la ubicación compartida.
- [x] **NAVZ-02** Añadir el texto y el contacto con un componente reutilizable.
- [x] **NAVZ-03** Enlazar Información desde Más opciones para coach y alumno.
- [x] **NAVZ-04** Comprobar lectura, contraste y espacio en móvil/PC y temas claro/oscuro, sin desbordamiento ni interferir con la navegación.
- [x] **NAVZ-05** Verificar el nombre y los dígitos del teléfono; actualizar guías y avances como implementado solo después de añadirlo a la app.

## Criterio de aceptación

La firma y el contacto pueden encontrarse fácilmente desde la aplicación en móvil y PC. La marca del coach mantiene su jerarquía; la firma no tapa contenido ni crea zoom o desplazamiento horizontal. Usar una comprobación visual puntual, sin repetir suites históricas por este cambio.

Entregada en T13 por aprobación expresa del usuario al reorientar las tandas. [Manual](../runbooks/t13-uso-y-operacion.md), [acta/capturas](../evidencias/t13.md). El teléfono conserva los dígitos exactos y no se ha llamado ni enviado mensajes. No hay recordatorio automático.
