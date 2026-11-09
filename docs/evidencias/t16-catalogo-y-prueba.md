# T16 — Catálogo original y demo lista para revisión

**24-10-2026. Estado: desarrollo local listo para prueba manual; aceptación de uso y de dispositivos pendiente.** Continúa el [segundo corte](t16-segundo-corte.md). La demo privada quedó encendida en este PC con las cuentas ficticias y sus cambios conservados.

## Entrega

- Migración 032: 52 ejercicios de referencia nuevos y los cuatro iniciales, **56 entradas base** en total; nombres conocidos de gimnasio, categoría, material, unidad y símbolo. Los coaches siguen pudiendo crear cualquier ejercicio adicional y escribir sus propias indicaciones. El catálogo no impone objetivos, series, carga ni dieta.
- Catorce esquemas vectoriales animados originales añadidos a los once existentes: **25 símbolos** en total. El detalle anima el esquema automáticamente, permite pausarlo y respeta la preferencia de movimiento reducido. Cada dibujo es una ayuda de identificación, no una demostración técnica validada ni un GIF de terceros.
- No se importaron imágenes, clips ni pictogramas de la web. Así el material entregado no depende de una licencia ajena o una URL externa. Si se incorporan medios después, la procedencia y el permiso deben registrarse por archivo.
- Migración 032 aplicada tanto a `forma` como a `forma_manual_demo`, sin reset ni modificación de las credenciales ficticias. Se añadió `scripts/manual-demo-migrate.mjs` para futuras migraciones controladas de la demo.

## Comprobación de bajo consumo

- Una build local pasó tipos, Vite y shell PWA.
- Con el coach Aurora autenticado, la biblioteca mostró **58 tarjetas**: 56 del catálogo base y dos fichas propias de la demo. Se abrió «Press de banca con barra» y el control «Pausar esquema» estuvo disponible. [Captura a 390 px](t16-catalogo-390.png).
- El ancho del documento coincidió con el viewport en 320, 390 y 1366 px en ese detalle. La cuenta ficticia de Luna abrió Hoy, Mi programa, Historial y Mis documentos; no hubo desborde a 390 px, ni en documentos a 320 px. [Captura de Hoy](t16-alumno-hoy-390.png).
- Las pruebas dirigidas de contratos y privacidad del corte anterior siguen documentadas allí; este corte no repitió suites completas.

## Cómo probar

Abrir [la demo local](http://127.0.0.1:4180/acceso) **en este PC**. Los usuarios ficticios y la contraseña están en el archivo privado [.local/manual-demo/ACCESOS.md](../../.local/manual-demo/ACCESOS.md); no se copian a documentación pública. Entrar como coach Aurora para probar Alumnos → ficha de Luna → Rutinas, Alimentación, Mediciones y Exportar. Abrir la cuenta de Luna en otro perfil o ventana privada para comprobar lo publicado. La guía operativa es [Prueba manual privada](../runbooks/t14-prueba-privada.md).

Esta URL solo escucha en `127.0.0.1`; desde un teléfono apuntaría al propio teléfono. La aceptación en iPhone/Android, teclado móvil, instalación y descargas reales siguen siendo una prueba separada. No usar datos reales ni considerar completado un despliegue público por este resultado local.
