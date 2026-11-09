# T13 — Uso de la versión para coach independiente

**v0.13.0.** [Decisiones](../decisiones/013-coaches-independientes.md), [API](api-t13.md), [acta](../evidencias/t13.md), [plan](../tandas/13-gimnasios.md).

## 1. Crear el espacio del coach

1. Abrir Registro y completar cuenta, nombre/dirección del espacio, color y plan. Ya no hay selector de gimnasio: el producto se centra en coach independiente y sus alumnos.
2. Revisar el aviso de prueba/precio y privacidad existentes antes de crear. El registro sigue siendo por correo/contraseña, sin OTP.
3. Con cuenta abierta, entrar en Inicio. La marca aparece como creada porque nombre/color ya se guardaron; logo y presentación se pueden completar desde Mi marca.
4. Verificar correo mediante el flujo de cuenta antes de enviar invitaciones. La guía de inicio lo refleja al actualizar.
5. Cada coach trabaja en su espacio; no se invita staff ni se crean sedes en esta versión. Los datos de otros coaches permanecen aislados.

## 2. Usar Inicio

1. Revisar los cinco pasos: marca, correo, primer alumno con acceso, una rutina publicada y rutina asignada.
2. **Gestionar alumnos:** crear ficha, preparar invitación y comprobar que el alumno acepta. Ficha invitada y acceso activo son estados diferentes; solo activo completa el paso.
3. **Abrir rutinas:** guardar y publicar una versión. Dos versiones del mismo programa cuentan como una rutina publicada. Archivada deja de contarse.
4. **Revisar asignaciones:** asignar a alumno activo con periodo vigente o próximo no finalizado. Un alumno pausado o una asignación terminada no completa ese paso.
5. Los contadores muestran todo el estudio, no solo la página de alumnos abierta. Las próximas sesiones son las publicadas del propio coach dentro de siete días.
6. **Actualizar inicio** consulta cambios; también se actualiza al regresar a la pestaña visible. No hay sondeo constante. Si falla, se muestra error sin marcar falsamente pasos completos.
7. Cinco pasos preparados indican uso esencial del espacio, no aprobación del piloto, seguridad o despliegue.

## 3. Navegar en móvil y PC

1. Móvil conserva cinco destinos inferiores. **Más opciones** abre una página agrupada, en vez de una lista extensa desplegada.
2. Coach: Mi trabajo → Alumnos/Rutinas/Ejercicios; Acompañamiento → Agenda/Chat/Alimentación/Recursos; Mi negocio → Servicios y pagos/Cuenta de plataforma/Mi plan; Mi espacio → Marca/Instalar/Perfil/Información.
3. Alumno: Mi entrenamiento, Acompañamiento, Mis servicios y Mi espacio. No se ofrecen CRM, facturación SaaS o gestión comercial.
4. **Servicios y pagos** registra lo vendido/cobrado a alumnos. **Cuenta de plataforma** es la suscripción del coach a Forma. No confundir deudas o comprobantes de ambos apartados.
5. Con un solo estudio se muestra su nombre sin selector. Si ya participas en más de uno, permanece selector con las guardas de cambios sin guardar.
6. Agenda oculta filtro/selector de profesional si hay una sola opción; el formulario sigue utilizando su ID y muestra contexto. Si hay datos heredados con más de un profesional, conserva selección y permisos anteriores, sin prometer producto multicoach.
7. PC mantiene sidebar y tarjetas/columnas adaptadas; los mismos apartados también están disponibles en Más opciones. Superadmin conserva administración autorizada.

## 4. Información y firma NAVZ

1. Desde Más opciones o sidebar, abrir **Información y ayuda**. También se accede pulsando la firma del footer, acceso o registro.
2. Consultar guía rápida de coach/alumno, alcance de guardado local y versión para soporte. Es página pública: funciona sin sesión y no revela datos del estudio.
3. Firma exacta: **Creado por NAVZ, +595972995557**. El teléfono abre tel:+595972995557 solo al pulsarlo; nunca inicia una llamada o mensaje automáticamente.
4. Rutinas, pagos y acceso del alumno se consultan con su coach. El contacto del creador no sustituye al responsable operativo o de privacidad que se defina para el piloto.
5. Firma dentro del contenido desplazable, sin nueva barra fija; comprobarla con scroll hasta el footer y no confundir la superposición de una captura de página completa con la posición del viewport real.

## 5. Operación y continuidad

1. Arranque habitual según [desarrollo](desarrollo.md). No hay procesos/dependencias nuevas. Migración 022 añade guardas y resumen, sin tablas o medios nuevos; próxima 023 una vez aplicada.
2. El esquema conserva roles/datos anteriores. No modificar organizaciones existentes o borrar relaciones para aplicar el enfoque independiente.
3. Backend nuevo solo admite altas coach y resumen owner. Un contacto adicional en UI no concede permisos de chat, datos corporales, CRM o pagos.
4. Backup conserva **81 indicadores previstos**; no se ensaya otro restore en T13. Scanner real, PWA/HTTPS, teléfonos, recuperación/operador y piloto siguen en las puertas existentes.
5. Reutilizar evidencia y ejecutar únicamente caso afectado ante corrección. Revisar [acta](../evidencias/t13.md) antes de lanzar scripts; no repetir históricos o capturas masivas.
6. Continuar [T14](../tandas/14-escala-lanzamiento.md) con piloto de coaches individuales. [Gimnasios](../pendientes/gimnasios-futuro.md) quedan fuera del alcance actual, sin fecha comprometida.
