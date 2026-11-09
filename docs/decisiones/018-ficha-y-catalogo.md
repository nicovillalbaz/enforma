# ADR 018 — Ficha del alumno, navegación y catálogo de referencia

**24-10-2026 · Estado: dirección de T16 en ejecución parcial.** Nace de las dos capturas y las correcciones explícitas del usuario. [Plan operativo](../tandas/16-ficha-alumno-y-experiencia.md); [primer corte](../evidencias/t16-primer-corte.md).

## Decisiones

1. La ficha de alumno es el centro de entrenamiento, alimentación, mediciones, progreso, historial y exportación. Bibliotecas globales sirven para reutilizar contenidos.
2. El coach independiente es autor del plan alimentario; se elimina de su recorrido la elección de un «profesional de alimentación». La privacidad del diario, fotos y datos de salud conserva permisos separados.
3. Menú directo para destinos principales; no «Más». Chat, Agenda, Recursos/PDF y Subir media se ocultan de la navegación. Los datos existentes y permisos de servidor no se eliminan por este cambio.
4. Cada pantalla hija vuelve al padre inmediato, con filtros/borrador preservados. Enlace directo usa padre determinista.
5. Texto libre y contenido propio siguen disponibles. Los objetivos y prescripciones no se precargan. **Sí** puede existir un catálogo de ejercicios de referencia, con medios licenciados por activo y huecos completables por el coach. Esta petición posterior sustituye la prioridad «biblioteca propia primero» de ADR 017 y su límite de once símbolos.
6. Rutinas y dietas publicadas son versiones inmutables; correcciones de mediciones conservan el valor anterior. PDF y XLSX se generan con ACL y rango explícitos, y el alumno ve únicamente documentos propios habilitados.
7. La firma NAVZ permanece accesible en Información/Créditos y un pie discreto; no aparece pegada a un campo de login.

## Efecto en decisiones anteriores

Sustituye los puntos 5 y 10 de [ADR 017](017-redisenio-y-autoria-coach.md) y la preferencia inicial de biblioteca propia del apartado «Datos y operación». Mantiene lo demás cuando no contradice T16: coach crea su vocabulario, sin coaching inventado por la plataforma; formularios como páginas; zoom accesible; pagos mensuales manuales; sin multicoach. La implementación y evidencia T15 permanecen históricas, no aprobadas visualmente por estas nuevas capturas.

## Derechos y límite

No asumir licencia comercial de pictogramas olímpicos ([COI](https://www.olympics.com/ioc/olympic-properties)). wger permite estudiar imágenes con metadatos individuales de licencia/autor ([modelo](https://github.com/wger-project/wger/blob/master/wger/exercises/models/image.py)); esa posibilidad no autoriza una importación total. No liberar imágenes hasta auditoría de procedencia y condiciones de cada archivo. Catálogo amplio más alta propia, sin prometer totalidad literal ni validez técnica automática.
