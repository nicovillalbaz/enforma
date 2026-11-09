# ADR 001 — Cimientos y primera interfaz

**Fecha:** 20-10-2026. **Estado:** implementado en local, con límites de infraestructura pendientes.

Se conserva Vue 3 + Fastify + PostgreSQL y el monorepo aprobado. Se eligió npm workspaces con lockfile para que la instalación no requiera un gestor global extra. Node 24 LTS es el runtime objetivo; el launcher Windows puede usar el runtime de Codex disponible en este equipo. Los scripts y CI exigen Node 24.

Las tipografías Inter y Onest se autohospedan desde paquetes con licencia OFL-1.1; solo se cargan sus archivos latinos. Iconos de `@lucide/vue`, CSS propio con tokens, funciones de contraste y variantes claro/oscuro. No hay imágenes externas ni llamadas a servicios de diseño al utilizar la app.

Como Docker no inició su motor Linux, se utiliza una instancia independiente de PostgreSQL 16.11 de los binarios ya instalados, con archivos exclusivamente en `.local/postgres`. No se cambió otro servicio PostgreSQL. El objetivo de contenedores sigue en PostgreSQL 18; migraciones probadas en 16 y pendientes de una ejecución adicional en 18.

La parte visual permite validar navegación y tareas con datos ficticios del navegador. No se presenta como multiempresa comercial implementada. El modelo de cuentas, sesiones y membresías mínimo permite probar la protección por organización antes de desarrollar alumnos y marca persistida en T02.

La instalación inicial notificó avisos de dependencias; se actualizaron el runner de pruebas, el correo y las herramientas y se sustituyó el paquete obsoleto de iconos. La consulta remota de auditoría quedó sin ejecutar: el control automático rechazó enviar el inventario del proyecto al registro npm. Las instalaciones posteriores usaron `--no-audit`; no se afirma que exista una auditoría final sin hallazgos. La revisión autorizada de dependencias forma parte de la preparación para producción.
