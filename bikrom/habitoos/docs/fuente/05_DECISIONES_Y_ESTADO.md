# Decisiones cerradas para Bikrom/HabitoOS

- **Marca del proyecto existente:** Bikrom.
- **Nombre de la aplicación:** Bikrom/HabitoOS (capitalización tal cual).
- **Nombre corto en interfaz:** HabitoOS, opcionalmente “by Bikrom”.
- **Producto:** plataforma de hábitos, autorregistro, reflexión y mejora continua, diferenciada por análisis de obstáculos y experimentos.
- **Público:** adultos, uso general (no exclusivamente fitness, nutrición o productividad).
- **Mercado:** global, despliegue por cohortes y jurisdicciones verificadas.
- **Idioma de lanzamiento:** español e inglés.
- **Canal inicial:** web app responsive y PWA.
- **Negocio:** Freemium + Pro, precios de prueba orientativos USD 4.99/mes y USD 39.99/año.
- **Usuarios:** cuentas separadas y datos privados, preparado para roles organizacionales futuros.
- **Enfoque técnico:** inspeccionar Bikrom y reutilizar lo existente; si no hay stack adecuado, monolito modular TypeScript/Next.js/PostgreSQL; no asumir nombre de dominio ni credenciales.
- **MVP:** onboarding, hábitos, metas versionadas, checklist y registro diario, reflexión, indicadores, dashboard de tendencias, identidad, suscripción, privacidad y administración.
- **Fase posterior:** experimentos avanzados, nutrición por equivalentes, PWA offline, notificaciones avanzadas, integraciones de salud, planes familiares/profesionales.
- **Regla conductual:** distinguir no realizado de no registrado; evitar culpa; evaluar resultados y procesos por separado.
- **Regla técnica:** backend valida permisos, datos, cálculos y suscripciones; no pantallas simuladas como producto terminado.

## Pendientes externos

1. Conceder a Claude o al desarrollador acceso real al código/repositorio de Bikrom.
2. Confirmar alojamiento, stack, DNS y base de datos existente.
3. Decidir proveedores de identidad, pagos y hosting tras la auditoría.
4. Validar planes/precios, cobertura fiscal y privacidad por país.
5. Ejecutar una beta y medir activación, retención y conversión antes de escalar.

## Primer encargo sugerido para Claude

> Lee `02_PROMPT_MAESTRO_BIKROM_HABITOOS.md` y `03_PRD_TECNICO_HABITOOS.md`. Audita el repositorio existente de Bikrom. Entrégame: inventario técnico, arquitectura de integración, riesgos, migraciones seguras, mapa de rutas, backlog de la primera fase y pruebas de aceptación. Preserva datos y funcionalidades existentes. Si tienes acceso de escritura, implementa únicamente los componentes no destructivos de la primera fase y explica exactamente qué cambiaste.
