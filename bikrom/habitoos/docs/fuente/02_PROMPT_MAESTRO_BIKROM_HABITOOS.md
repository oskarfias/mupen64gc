# MASTER DEVELOPMENT PROMPT — BIKROM / HABITOOS

**Producto:** Bikrom/HabitoOS  
**Tipo:** web app SaaS multiusuario, responsive y PWA  
**Mercado:** global; distribución por países validados  
**Idiomas:** español e inglés  
**Público:** adultos que quieren desarrollar, mantener, reducir o abandonar hábitos  
**Modelo:** freemium con suscripción Pro

> **Orden de trabajo:** audita primero el proyecto Bikrom existente; después planifica, implementa, prueba y documenta. No sustituyas el proyecto por una maqueta. Conserva datos y funcionalidades, no alteres DNS ni producción de manera destructiva sin permiso.

## 0. Proyecto existente y nombre exacto

Existe un proyecto, sitio o dominio llamado **Bikrom**. Integra una aplicación llamada **Bikrom/HabitoOS**. No uses `HabitOS` como marca principal. El nombre corto dentro de la aplicación puede ser **HabitoOS**, con “by Bikrom” cuando corresponda.

Antes de editar código, inspecciona repositorio, estructura de rutas, componentes, diseños, esquemas de datos, autenticación, integraciones, variables de entorno, tests, pipeline y despliegues. Identifica qué reutilizar. No inventes el dominio ni credenciales. No borres o sobrescribas contenido existente. Usa migraciones reversibles cuando sea posible.

Si Bikrom alberga otras herramientas, usar inicialmente:

- `/habitoos`: página pública
- `/habitoos/login`: login
- `/habitoos/onboarding`: configuración
- `/habitoos/app`: área autenticada
- `/habitoos/app/today`: dashboard diario
- `/habitoos/app/habits`: hábitos
- `/habitoos/app/insights`: estadísticas
- `/habitoos/app/experiments`: experimentos
- `/habitoos/app/settings`: configuración
- `/habitoos/app/billing`: suscripción
- `/admin/habitoos`: administración

Si toda la plataforma actual será exclusivamente HabitoOS, puede adaptarse la raíz conservando redirecciones y compatibilidad.

## 1. Rol de desarrollo

Actúa como equipo de producto, ingeniería senior, UX/UI, ciencia del comportamiento, estadística aplicada, seguridad, privacidad, QA, analítica SaaS y monetización. Construye funcionalidad real: persistencia, autorización, interfaces, reglas de negocio, pagos y pruebas. Evita demos desconectadas presentadas como producto terminado.

## 2. Visión

Bikrom/HabitoOS es un sistema personal de mejora continua: **Definir → Actuar → Registrar → Comprender → Ajustar → Mejorar**. Su promesa: “Build better habits. Understand your behavior. Improve continuously.” Ayuda a usuarios a configurar objetivos, registrar acciones y resultados, comprender barreras y probar pequeños cambios. No busca maximizar tiempo de pantalla ni castigar incumplimientos.

Preguntas que debe responder: ¿qué quiero conseguir?, ¿qué haré diariamente?, ¿qué hice realmente?, ¿qué lo dificultó?, ¿qué haré distinto mañana?

## 3. Marco conductual

Utiliza como guías COM-B (capacidad/oportunidad/motivación), Fogg Behavior Model, self-monitoring, goal setting, implementation intentions («si X, entonces Y»), formación de hábitos y PDCA (Plan–Do–Check–Act). Considera estadística descriptiva y control estadístico cuando sea apropiado. No atribuyas éxito garantizado a una teoría ni afirmes plazos universales como «21 días».

## 4. Navegación

Áreas: Today, My Habits, My Plan, Insights, Experiments, My Account y Billing. Admin por separado. En móvil utiliza navegación accesible de pocas opciones; en escritorio, navegación lateral. La mayoría de registros deben requerir uno o dos toques. Diseñar estados vacíos, errores, carga y confirmación.

## 5. Identidad y cuentas

Ofrecer registro por email, verificación de correo según política, inicio/cierre de sesión, recuperación de contraseña, Google y Apple cuando el entorno lo permita, preferencias, exportación y eliminación de cuenta. Aislar estrictamente datos por usuario. Preparar expansión a organizaciones sin construir toda la funcionalidad B2B en el MVP.

## 6. Onboarding adaptativo

Objetivo de experiencia: primer checklist en menos de cinco minutos para el usuario típico. Flujo:

1. Bienvenida «Welcome to HabitoOS. Small actions. Measurable progress. Meaningful change» y selección de idioma.
2. Categorías: salud, nutrición, ejercicio, sueño, productividad, aprendizaje, relaciones, finanzas, bienestar digital, espiritualidad, estilo de vida, personalizado.
3. Hábitos a desarrollar: ejercicio, caminar, leer, estudiar, verduras, agua, sueño, meditar, orar, ahorrar, planear, familia y personalizados.
4. Hábitos a reducir o abandonar: tabaco, alcohol, redes sociales, azúcar añadida, bebidas azucaradas, procrastinación, compras impulsivas, uso excesivo del teléfono, acostarse tarde y personalizados.
5. Línea base por hábito, aceptando «No lo sé»; ofrecer periodo de observación si es desconocida.
6. Objetivo: numérico, frecuencia, abstinencia, reducción, mantenimiento o plan.
7. Motivación personal opcional.
8. Barreras: tiempo, energía, estrés, olvido, preparación, entorno social, impulsos, recursos y otras.
9. Priorizar uno a tres hábitos inicialmente.
10. Generar plan editable con frecuencia, horario, unidad, objetivo, recordatorio y plan alternativo.

El cuestionario debe ser progresivo, guardable y reanudable; no exigir datos sensibles innecesarios.

## 7. Motor de hábitos

Cada hábito contiene: ID, propietario, nombre, categoría, emoji/icono, tipo (desarrollar/mantener/reducir/abandonar), unidad, línea base, meta versionada, programación, horario, fecha inicial, estado, barreras, motivación, contingencia, relación con resultados y timestamps.

Soportar mediciones binarias, cantidades, duración, frecuencia, mínimos, máximos, rangos, porcentajes, subtareas, abstinencia y reducción progresiva.

Estados obligatorios: **pendiente, cumplido, parcialmente cumplido, no cumplido, omitido justificadamente, no aplicable, sin registro**. No interpretar sin registro como fracaso. Mantener versiones de metas para que un cambio de 20 a 30 minutos no reescriba resultados históricos. Permitir pausas, días libres y edición de registros con trazabilidad.

## 8. Dashboard Today

Mostrar saludo, fecha local, hábitos del día, progreso por hábito, total evaluado, pendientes, acceso al plan y cierre. Cada tarjeta tiene emoji, nombre, meta, progreso y control correspondiente (sí/no, +/−, duración, número, checklist). Guardar automáticamente con opción de deshacer. No construir botones sin comportamiento. Mostrar datos persistentes, no inventados.

Ejemplos: ejercicio 35/45 min; tabaco 0/0 cigarrillos; redes sociales 52/60 min; lectura 20/20 páginas; verduras 4/5 porciones; sueño 7.5/8 horas.

No usar pesos arbitrarios en una puntuación agregada. Diferenciar cobertura de registro y cumplimiento.

## 9. Daily Reflection

Cierre opcional de aproximadamente 30–60 segundos:

1. Revisar cumplido, parcial, no cumplido y sin registrar.
2. Preguntar «How did you feel today?» (excelente/bien/neutral/cansado/estresado/frustrado/otro).
3. Solo si resulta apropiado, preguntar «What got in your way today?» con categorías de obstáculos.
4. Preguntar opcionalmente «What could you do differently tomorrow?».
5. Crear contingencia «Si X, haré Y».
6. Cerrar respetuosamente.

Permitir omitir. Evitar preguntar repetidamente; sin incumplimientos, ofrecer cierre rápido. No utilizar mensajes «fallaste otra vez» ni amenazar rachas. El estado emocional autorreportado no es diagnóstico.

## 10. Dashboard Insights

Separar:

- **Process Measures:** minutos de ejercicio, frecuencia, cigarrillos/día, días sin alcohol, minutos en redes, sueño, porciones, lectura, cumplimiento de plan.
- **Outcome Measures:** peso, cintura, rendimiento, ahorro, tiempo recuperado, libros concluidos, otras metas definidas por usuario.
- **Behavioral Insights:** adherencia, cobertura, consistencia, obstáculos, variabilidad, desempeño por día de semana, recuperación, experimentos.

Filtros 7/30/90 días, 6/12 meses y rango personalizado. Gráficas de línea, barras, calendario, objetivo, línea base, promedios móviles y vínculos procesos-resultados. Las gráficas muestran unidades, periodo, N y cobertura. Correlación no implica causalidad.

## 11. Reglas estadísticas

- **Adherencia** = ocurrencias cumplidas / ocurrencias evaluables × 100. Ocurrencias evaluables incluyen cumplidas, parciales y no cumplidas según reglas documentadas.
- **Cobertura** = ocurrencias programadas con registro válido / ocurrencias programadas × 100, excluyendo de forma explícita pausas y no aplicables según política.
- **Consistencia** = porcentaje de oportunidades programadas completadas (mostrar denominador).
- **Recuperación** = tiempo u oportunidades programadas hasta volver a cumplir después de interrupción (métrica descriptiva propuesta).
- **Cambio** = diferencia absoluta; cambio relativo solo si valor base distinto de cero.
- **Metas numéricas** = operadores >=, <=, = o rango, con clasificación de parcial configurable.
- **Tendencias** = series longitudinales, N, promedios, variabilidad; no afirmar significancia sin pruebas apropiadas.
- **Barreras** = frecuencia observada, nunca causalidad automática.

Los agregados deben poder recalcularse desde datos fuente. Versionar reglas cuando cambien.

## 12. Experiments — motor de mejora continua

Flujo: Observe → Understand → Hypothesize → Experiment → Measure → Learn.

Cada experimento registra hipótesis, intervención, fecha, duración, línea base, métrica primaria, resultado y decisión (mantener/ajustar/abandonar/repetir). Proponer 1–2 experimentos simultáneos como límite predeterminado. No alterar metas sin consentimiento. Empezar con reglas auditables, no exigir IA para estadísticas. IA posterior solo para lenguaje y orientación cuidadosamente verificados.

Ejemplo: «En las últimas semanas cumpliste menos entrenamientos nocturnos. ¿Quieres probar un horario matutino por dos semanas?» El hallazgo debe estar sustentado en registros reales.

## 13. Reducción y abandono de hábitos

Permitir tabaco (cigarrillos, impulsos, desencadenantes, días sin fumar), alcohol (días/unidades claramente definidas, objetivos, situaciones) y redes sociales (minutos, límites, red concreta, registro manual). No prometer integración automática con tiempo de pantalla del sistema operativo sin verificarla. Azúcar: distinguir azúcar añadida, bebidas azucaradas y postres, sin confundir con azúcar natural de frutas/lácteos.

Los episodios no anulan todo el progreso. No diagnosticar ni prescribir tratamientos. Si hay posible dependencia física al alcohol, advertir que suspenderlo bruscamente puede ser peligroso y orientar a apoyo médico.

## 14. Nutrición por equivalentes (fase posterior al MVP)

Plan editable por comidas y horarios. Grupos configurables: 🍳 proteínas/AOA, 🥛 lácteos, 🥬 verduras, 🍎 frutas, 🫘 leguminosas, 🥑 grasas y 🍞 cereales. **Los emojis son etiquetas visuales de grupos, no alimentos específicos ni calorías fijas**. Cada emoji se marca al tocar, actualizando contadores con persistencia; permitir consumos fuera del plan y deshacer. Los cálculos calóricos y de macronutrientes deberán proceder de información alimentaria definida, no del número de emojis. Permitir el módulo sin conteo calórico.

## 15. UX/UI

Aspecto premium, minimalista, accesible y profesional. Identidad Bikrom/HabitoOS. Sugerencia: blanco cálido, carbón, superficies grises, azul petróleo de acción, verde suave en estados apropiados; modo claro/oscuro; tipografía sans serif. En móvil, objetivos legibles y controles cómodos; en escritorio, analítica rica. Cumplir WCAG 2.2 AA como objetivo. Evitar gamificación infantil, culpa, notificaciones invasivas y dashboards saturados. No copiar identidades de apps existentes.

## 16. Modelo de datos

Relacional PostgreSQL (o BD existente compatible). Entidades:

- Identidad: users, profiles, user_preferences, organizations, organization_memberships.
- Hábitos: habits, habit_goal_versions, habit_schedules, habit_occurrences, habit_logs, habit_categories.
- Reflexión: daily_reviews, obstacles, review_obstacles, contingency_plans.
- Resultados: outcome_measures, outcome_logs, habit_outcome_links.
- Mejora: experiments, experiment_interventions, experiment_results, weekly_reviews.
- Nutrición: nutrition_plans, nutrition_meals, nutrition_groups, nutrition_targets, nutrition_logs.
- Comercial: subscription_plans, subscriptions, billing_events, payment_transactions, entitlements.
- Plataforma: notifications, audit_events, feature_flags, admin_events.

Usar UUID, timestamps UTC y zona horaria IANA, claves foráneas, restricciones, índices, migraciones versionadas y separación de datos sensibles. Evitar duplicados en ocurrencias y eventos de pago. Guardar línea base y metas históricas. Agregados reconstruibles.

## 17. Multiusuario y permisos

Aislamiento estricto entre usuarios con autorización backend y RLS donde aplique. Roles iniciales: visitor, registered user, Pro user (como permiso, no necesariamente rol separado) y administrator. Preparar professional y organization admin para el futuro. No confundir roles globales con los de organización. Implementar rate limits, validación, protección CSRF/XSS, cookies y sesiones seguras, cifrado en tránsito, secretos y backups.

## 18. Stack técnico

Auditar primero Bikrom. Si la infraestructura existente es apta, reutilizar. Si no: Next.js + React + TypeScript, Tailwind y componentes accesibles, PostgreSQL, backend TypeScript, autenticación administrada compatible, testing Vitest + Playwright, observabilidad y despliegue compatible. Preferir monolito modular, componentes reutilizables, reglas server-side, documentación, CI/CD y migraciones. No introducir microservicios innecesarios.

## 19. Suscripciones

**Free**: 3 hábitos activos, checklist, reflexión básica, 30 días de historial, estadísticas básicas y recordatorios esenciales.

**Pro**: hábitos ilimitados, historial completo, resultados, analítica avanzada, barreras, experimentos, reflexiones profundas, planes nutricionales cuando estén disponibles, exportaciones analíticas, personalización.

Hipótesis de precios globales: **USD 4.99 mensual** / **USD 39.99 anual**; configurables por país, moneda y pruebas. No exigir tarjeta para Free. Soportar trials opcionales, suscripción/cancelación, renovación, periodos de gracia, fallos, restauración de acceso. El usuario mantiene sus datos al volver a Free. Implementar permisos/entitlements en backend y webhooks firmados e idempotentes. No almacenar tarjetas completas. Respetar reglas fiscales, de cobro y futuras plataformas móviles.

## 20. Admin SaaS

Panel autorizado con usuarios registrados/activos (DAU/WAU/MAU), activación, onboarding, creación y registro de hábitos, uso de reflexiones e insights, retención D7/D30/D90, suscripciones, trial conversion, churn, MRR, ARR, ARPU/ARPPU, cohortes, ingresos por moneda y margen. Mostrar agregados y evitar acceso gratuito a reflexiones privadas o datos sensibles. Instrumentación de eventos sin contenido privado.

## 21. Internacionalización

Español e inglés iniciales; arquitectura lista para traducciones posteriores. Zona horaria configurable, calendario local, medidas métricas/imperiales, monedas/precios regionales, localización de notificaciones y accesibilidad. No activar cobros en países sin validación jurídica, fiscal y comercial.

## 22. Privacidad

Privacidad por defecto: aviso de privacidad, términos, consentimiento válido, minimización, exportación y eliminación, retención, gestión de acceso, respuesta a incidentes, revisión por jurisdicción (incluyendo GDPR/UK GDPR donde corresponda), mecanismos para datos sensibles. No vender datos ni usarlos para anuncios personalizados basados en salud/hábitos sensibles. No enviar reflexiones a proveedores externos de IA sin fundamento legal e información apropiada.

## 23. Notificaciones

Recordatorios de actividad, cierre diario y revisión semanal; configurables por hora/día/canal y zona horaria. PWA web push solo donde lo permitan navegador y sistema, con consentimiento contextual. Email opcional autorizado. Evitar culpa y spam.

## 24. Analítica de producto

Eventos como signup_completed, onboarding_completed, habit_created, habit_logged, daily_review_completed, weekly_insights_viewed, experiment_started/completed, trial_started, subscription_started/cancelled. Documentar evento, usuario seudonimizado, denominador y propósito. KPIs: activación, retención, registros significativos, conversión, churn, MRR, CAC y margen. No optimizar por tiempo de pantalla.

## 25. API de referencia

- POST /api/v1/habits
- GET /api/v1/habits
- PATCH /api/v1/habits/:id
- GET /api/v1/daily/:date
- PUT /api/v1/occurrences/:id/log
- POST /api/v1/daily-reviews
- GET /api/v1/analytics/adherence
- GET /api/v1/analytics/process
- GET /api/v1/analytics/outcomes
- POST /api/v1/experiments
- GET /api/v1/billing/entitlements
- POST /api/v1/billing/checkout
- POST /api/v1/billing/portal
- GET /api/v1/admin/metrics

Adapta rutas a lo que existe. Implementa autorización por recurso, validación, errores coherentes, paginación, idempotencia, documentación y tests.

## 26. Historias de usuario esenciales

US-001 registrarse; US-002 completar onboarding; US-003 crear hábitos de desarrollo/abandono; US-004 definir metas/días; US-005 registrar checklist rápidamente; US-006 registrar cantidades; US-007 registrar incumplimientos sin perder histórico; US-008 cerrar día; US-009 ver obstáculos; US-010 analizar procesos; US-011 registrar resultados; US-012 relacionar hábitos y objetivos; US-013 crear experimentos; US-014 comparar resultados; US-015 pagar Pro; US-016 cancelar; US-017 versionar metas; US-018 exportar/borrar; US-019 admin métricas; US-020 admin configurar planes. Para cada historia: precondiciones, flujo, errores, reglas, aceptación y pruebas.

## 27. Pruebas obligatorias

Probar registro→onboarding→primer hábito→dashboard; persistencia tras recarga; acceso cruzado denegado; metas históricas; sin dato diferente de incumplimiento; pago/webhook/entitlement; cancelación; webhook duplicado; zona horaria; cambio idioma; obstáculos visibles en estadísticas; recálculo tras corrección; restauración de respaldos. No liberar pantallas basadas exclusivamente en datos ficticios.

## 28. Criterios de aceptación MVP

Registro funcional, onboarding, hábitos y metas versionadas, registro diario binario/numérico, no cumplido y sin datos, reflexión, obstáculos, tendencias reales, indicadores de resultado, cobros/cancelación, permisos, aislamiento, interfaz móvil, ES/EN, admin, exportación y eliminación, pruebas y despliegue supervisable.

## 29. Roadmap

Fase 0: auditoría y plan de integración Bikrom. Fase 1: identidad, BD, seguridad, infraestructura, localización. Fase 2: onboarding, hábitos, metas, checklist, Today. Fase 3: reflexiones, obstáculos, analytics. Fase 4: pagos, permisos, admin, privacidad. Fase 5: beta y estabilización. Fase 6: experimentos avanzados, nutrición e integraciones. Mantener backlog y Definition of Done.

## 30. Instrucciones de ejecución

No te limites a describir una solución: si tienes acceso al código y permisos, implementa. Orden: **auditar → planificar → implementar → verificar → informar**. Después de cada etapa, reporta archivos modificados, migraciones, pruebas ejecutadas, hallazgos, pendientes y próximos pasos. No afirmes que un cambio está desplegado sin desplegarlo. No inventes credenciales. No ejecutas cambios destructivos en producción sin autorización. Si falta un proveedor externo, prepara la integración y documenta la acción necesaria.

## 31. Resultado final esperado

Una plataforma **Bikrom/HabitoOS** profesional, comercializable y segura que combina herramienta de disciplina, seguimiento de comportamientos, indicadores, aprendizaje y mejora continua. La app debe facilitar vivir mejor fuera de ella, no incrementar adicción a pantallas.

**Primera acción obligatoria:** inspeccionar Bikrom existente, entregar diagnóstico técnico y ejecutar la primera etapa no destructiva y comprobable. Mantener identidad exacta Bikrom/HabitoOS.
