# Product Requirements Document (PRD) — Bikrom/HabitoOS

**Versión:** 1.0  
**Mercado:** global por cohortes  
**Plataforma inicial:** web responsive y PWA  
**Modelo:** SaaS B2C freemium + Pro  
**Usuarios:** adultos, público general  
**Idiomas:** español e inglés  
**Condición técnica:** integrar en el proyecto Bikrom existente antes de crear un proyecto nuevo

## 1. Visión y diferenciación

Ayudar a usuarios a definir hábitos, ejecutarlos, registrar resultados, reflexionar ante obstáculos y mejorar mediante pequeños experimentos. Motor de producto: **Definir → Ejecutar → Registrar → Medir → Aprender → Ajustar**. Diferenciación: distinguir proceso y resultado, identificar barreras y promover recuperación en vez de obsesión por rachas.

## 2. Objetivos del MVP

- Autenticación y almacenamiento privado de cada cuenta.
- Onboarding adaptativo en español e inglés.
- Hábitos positivos/negativos con metas y programas versionados.
- Checklist diario con estado binario, numérico o duración.
- Reflexión de cierre breve y opcional.
- Dashboards de proceso y resultado con tendencias reales.
- Suscripción Pro, permisos, cancelación.
- Panel administrativo con indicadores comerciales agregados.
- Exportación y eliminación de datos.

No objetivos MVP: IA generativa obligatoria, soporte offline completo, apps nativas, coaching profesional, nutrición avanzada y análisis estadístico causal.

## 3. Usuarios y principales jobs-to-be-done

**Nuevo usuario:** comprender valor, seleccionar 1–3 hábitos, crear plan y registrar primer día en menos de 5 minutos (objetivo de experiencia).

**Usuario recurrente:** registrar progreso diario en menos de 45 segundos (objetivo, medir durante beta).

**Usuario con obstáculos:** identificar situación, estado emocional opcional, barrera y un ajuste para mañana sin culpa.

**Usuario analítico:** comparar acciones ejecutadas vs resultados, tendencias, cobertura y experimentos.

**Suscriptor Pro:** acceder a historial completo, análisis de barreras, métricas avanzadas y experimentos.

**Administrador:** gestionar planes, observar actividad/ingresos y monitorear incidentes sin leer por defecto datos sensibles.

## 4. Requisitos funcionales y aceptación

### FR-01 Identidad

Correo y OAuth cuando sea viable, sesiones, recuperación, cierre, exportación y eliminación. Aceptación: sesiones seguras, aislamiento en backend, restauración de datos correctos al volver a entrar.

### FR-02 Onboarding

Categoría → hábitos a ganar/perder → línea base → meta → obstáculos → plan → Today. Reanudable, privacidad por defecto, preguntas opcionales. Aceptación: no duplicación de hábitos al repetir paso; localización ES/EN; inicio rápido.

### FR-03 Hábitos

Tipo (desarrollar, mantener, reducir, abandonar), unidad (sí/no, número, duración, frecuencia, rango), programa (días/horario/zona horaria), estado, metas versionadas. Aceptación: editar meta no altera evaluación histórica; pausa/desactivación conservan registros.

### FR-04 Ocurrencias y registros

Estados: pendiente, cumplido, parcial, no cumplido, no aplicable, omitido, sin datos. Autoguardado, idempotencia, deshacer. Aceptación: recarga no pierde cambios; ausencia de registro no equivale a no cumplido; cada registro pertenece al usuario autenticado.

### FR-05 Today

Lista de hábitos programados del día, progreso individual, pendiente, cumplimiento evaluable, cobertura, acceso a cierre. Aceptación: interfaz móvil y teclado accesible, datos reales, 1–2 interacciones para registros simples.

### FR-06 Daily Reflection

Estado emocional opcional, barreras, reflexión libre opcional, intención Si-X-entonces-Y. Aceptación: se puede omitir sin penalización; no se insiste ante éxito total; obstáculos se vinculan con hábitos, fechas y estadísticas.

### FR-07 Insights

Process Measures y Outcome Measures, filtros temporales, línea base, promedio, cobertura, denominador, recuperación y frecuencia de barreras. Aceptación: las series se recalculan tras correcciones; se muestran N y advertencias por poca evidencia; no se inventan conclusiones.

### FR-08 Experimentos (MVP opcional / P2)

Hipótesis, intervención, fechas, línea base, indicador, revisión. Aceptación: no cambian metas sin consentimiento; no se atribuyen efectos causales automáticamente.

### FR-09 Billing

Free y Pro, pagos web, cancelación, renovación, webhooks idempotentes, permisos efectivos backend. Aceptación: compra activada una vez; pérdida de plan no borra datos; cancelación respeta periodo pagado.

### FR-10 Administración

Usuarios agregados, activación, retención, MRR, churn, suscripciones, errores. Aceptación: rol admin validado servidor; no exponer reflexiones o consumo personal.

### FR-11 Privacidad

Consentimientos, aviso, exportación, eliminación, retención y auditoría. Aceptación: el usuario puede iniciar solicitud y se gestiona según política; controles y procedimientos documentados.

## 5. Definiciones de medición

**Adherencia:** 100 × ocurrencias cumplidas / ocurrencias evaluables. Evaluables = cumplidas + parciales + no cumplidas, según política y sin pendientes. No contar días no programados.

**Cobertura:** 100 × ocurrencias programadas con registro válido / ocurrencias programadas elegibles. Mostrar diferencia entre sin registro, omisión y no aplica.

**Recuperación:** número de oportunidades programadas hasta completar un hábito después de una interrupción.

**Cambio relativo:** (actual − base) / |base| × 100 si base ≠ 0. Si base = 0, mostrar absoluto.

**Cumplimiento numérico:** reglas versionadas `>=`, `<=`, `=`, rango, con umbrales parciales explícitos.

**Tendencia:** agregados por periodo, datos fuente, N, cobertura, promedios y variabilidad; no inferencia causal.

## 6. Arquitectura

**Patrón:** monolito modular más workers y base de datos relacional. No microservicios en el lanzamiento salvo necesidad real.

```text
PWA Next.js (Today/Habits/Insights/Experiments/Billing)
          |
      API TypeScript
       /     |      \
PostgreSQL  Workers  Billing Provider
    |         |            |
   RLS      Jobs        Webhooks
    |
 Audit/Event Aggregates  --> Admin
```

**Stack:** reutilizar Bikrom existente si es viable; en caso contrario Next.js, React, TypeScript, PostgreSQL, autenticación administrada, Tailwind, Zod, ORM compatible, tests Vitest/Playwright, observabilidad. Separar reglas de negocio de UI y mantener API versionada.

**SLO orientativos:** 99.9% disponibilidad mensual después de beta; lecturas API principales p95 <500 ms excluyendo red de cliente; LCP p75 <2.5 s en condiciones de referencia; WCAG 2.2 AA como objetivo. Backup y pruebas de restauración; RPO/RTO negociados para primera salida.

## 7. Modelo de datos

| Tabla | Claves / campos principales | Propósito |
|---|---|---|
| users | id, email, status | Identidad |
| profiles | user_id, locale, timezone | Preferencias |
| organizations | id, name, type | Futuro B2B |
| memberships | user_id, organization_id, role | Roles por tenant |
| habits | id, owner_id, type, unit, status | Definición |
| habit_goal_versions | habit_id, comparator, target, from/to | Evaluación histórica |
| habit_schedules | habit_id, recurrence, local_time, timezone | Programación |
| habit_occurrences | habit_id, local_date, scheduled_at, status | Instancias |
| habit_logs | occurrence_id, recorded_value, source, timestamp | Registro |
| daily_reviews | owner_id, local_date, mood, note | Reflexión |
| obstacles | id, label, category | Catálogo |
| review_obstacles | review_id, habit_id, obstacle_id | Barreras |
| outcome_measures | id, owner_id, name, unit | Resultados |
| outcome_logs | measure_id, value, observed_at | Mediciones |
| habit_outcome_links | habit_id, measure_id | Asociación |
| experiments | id, owner_id, hypothesis, dates, status | Experimento |
| experiment_results | experiment_id, metric, baseline, result | Evaluación |
| subscription_plans | id, price, currency, interval | Catálogo |
| subscriptions | owner_id, plan_id, provider_status | Billing |
| entitlements | owner_id, feature, valid_until | Permisos |
| billing_events | provider_event_id, processed_at | Idempotencia |
| audit_events | actor, action, resource, timestamp | Auditoría |

Para nutrición futura: nutrition_plans, nutrition_groups, nutrition_meals, nutrition_targets, nutrition_logs.

**Restricciones:** UUID; claves foráneas; índices `(owner_id, date)`; timestamps UTC; zona horaria IANA; meta versionada sin superposiciones; idempotencia de webhooks; políticas RLS y autorización server-side; datos derivables del source-of-truth. No almacenar tarjetas.

## 8. API inicial

```http
POST /v1/habits
GET /v1/habits
PATCH /v1/habits/:id
GET /v1/daily/:date
PUT /v1/occurrences/:id/log
POST /v1/daily-reviews
GET /v1/analytics/adherence
GET /v1/analytics/process
GET /v1/analytics/outcomes
POST /v1/experiments
GET /v1/billing/entitlements
POST /v1/billing/checkout
POST /v1/billing/portal
GET /v1/admin/metrics
```

Validación, autorización por recurso, formatos coherentes, protección CSRF donde aplique, rate limit, paginación, idempotencia y logs estructurados.

## 9. Comercialización

**Free:** 3 hábitos activos, checklist, reflexión básica, 30 días de historial visible, estadísticas básicas y recordatorios.

**Pro:** hábitos ilimitados, histórico completo, proceso/resultados avanzados, barreras, experimentos, exportaciones analíticas y nutrición cuando esté disponible.

**Hipótesis de precio:** USD 4.99 mensual / USD 39.99 anual; pruebas regionales y precios configurables, no hardcodeados. Proveedor web compatible por región. No cobrar sin consentimiento. Suscripción puede pasar a Free sin borrar registros.

**KPIs comerciales:** usuarios registrados, activación, DAU/WAU/MAU, retención D7/D30/D90, conversión, churn, MRR/ARR, ARPPU, CAC, margen de contribución y cohortes. Aclarar impuestos y comisiones al calcular ingresos netos.

## 10. Diseño y navegación

Mobile-first, marca **Bikrom/HabitoOS**, nombre corto **HabitoOS**. Vista Today con tarjetas y progreso; Habits con edición; My Plan; Insights con gráficos filtrables; Daily Reflection breve; Settings; Billing; administración separada. Minimalismo premium: blanco cálido, carbón, azul petróleo, estados accesibles y modo oscuro. Controles amigables, no culpabilizar.

## 11. Historias de usuario principales

| ID | Historia | Criterio verificable |
|---|---|---|
| US-001 | Registrarme | Cuenta y sesión funcional |
| US-002 | Configurar hábitos iniciales | Onboarding guarda datos sin duplicar |
| US-003 | Registrar día | Auto-guardado y recarga correcta |
| US-004 | Reducir redes | Minutos y límite con comparador <= |
| US-005 | Registrar tabaco | Cantidad, meta y barreras |
| US-006 | Cambiar meta | Historia no reescrita |
| US-007 | Registrar obstáculo | Se vincula a fecha/hábito |
| US-008 | Ver adherencia | Fórmula y denominador correctos |
| US-009 | Crear resultado | Indicador y serie persistentes |
| US-010 | Probar experimento | Hipótesis/fechas/métrica guardadas |
| US-011 | Comprar Pro | Billing confirmado y entitlement |
| US-012 | Cancelar | Fecha de fin correcta, datos intactos |
| US-013 | Exportar datos | Formato interoperable |
| US-014 | Borrar cuenta | Proceso conforme a política |
| US-015 | Admin ingresos | Métricas agregadas y acceso restringido |
| US-016 | Cambiar idioma | ES/EN sin pérdida de datos |
| US-017 | Usar otro dispositivo | Estado sincronizado |
| US-018 | Día de descanso | No penaliza adherencia |

## 12. Pruebas críticas

1. Usuario nuevo completa onboarding y ve su primer checklist.
2. Registro persiste al recargar o cambiar dispositivo.
3. Intentar consultar recurso ajeno devuelve denegación incluso manipulando URL.
4. Cambiar meta conserva y evalúa correctamente historia anterior.
5. No abrir app tres días produce sin datos, no incumplimiento automático.
6. Pago confirmado activa Pro; webhook duplicado no crea doble beneficio.
7. Cancelar preserva acceso hasta fecha pagada.
8. Zonas horarias mantienen calendario y eventos correctos.
9. ES/EN traduce experiencia principal.
10. Reflexión y obstáculos alimentan estadísticas del usuario correcto.
11. Corrección histórica recalcula agregados.
12. Se prueban backups y restauración.

## 13. Backlog priorizado

Ver `04_BACKLOG_PRIORIZADO.csv` para importar tareas P0–P3. P0: arquitectura, autenticación/RLS, esquema, hábitos, registro, pruebas. P1: onboarding, dashboards, reflexión, analítica, billing, admin, privacidad, lanzamiento. P2: experimentos, nutrición, offline, notificaciones. P3: salud, organizaciones. Puntos son complejidad relativa, no horas.

## 14. Plan de ejecución orientativo

| Periodo | Meta |
|---|---|
| Semanas 1–2 | Auditoría Bikrom, prototipos, seguridad, esquema, integración |
| Semanas 3–6 | Autenticación, usuarios, onboarding, hábitos, metas, registros |
| Semanas 7–10 | Dashboard, reflexión, indicadores, gráficos |
| Semanas 11–14 | Billing, permisos Pro, administración, privacidad |
| Semanas 15–18 | Pruebas, QA, beta cerrada, correcciones |
| Semanas 19–22 | Contingencia y estabilización según hallazgos |

Es una estimación dependiente del equipo, no promesa de entrega. Equipo mínimo sugerido: Product Owner parcial, full-stack senior, otro frontend/full-stack, UX parcial, QA parcial, seguridad/privacidad por hitos.

## 15. Métricas de validación de beta (hipótesis)

- Finalización onboarding >=70%.
- Registro de primer hábito en 24 h >=60%.
- Retención D7 >=35%.
- Retención D30 >=20%.
- Usuarios activos que registran 3+ veces/semana >=50%.
- Tiempo mediano de registro diario <=45 s.

No son benchmarks garantizados; revisar por cohorte y después de observar datos reales.

## 16. Compliance y seguridad

Privacidad por diseño, minimización de datos, avisos y consentimiento, retención, eliminación/exportación, legislación por jurisdicción, controles para datos sensibles (salud, adicciones, emociones). No publicidad dirigida con datos sensibles ni venta de datos. No sugerir suspensión brusca de alcohol ante dependencia potencial. No presentar el producto como tratamiento médico. Usuarios inicialmente adultos.

## 17. Definition of Done

- [ ] Funciones críticas E2E reales, sin depender de mock data.
- [ ] Autenticación y aislamiento entre usuarios probados.
- [ ] Métricas reproducibles y correctas.
- [ ] Billing y cancelaciones verificados.
- [ ] Exportación y eliminación implementadas.
- [ ] Responsive, localización ES/EN, accesibilidad revisada.
- [ ] Sin duplicados de logs o webhooks.
- [ ] Backups y procedimiento de restauración.
- [ ] Sin vulnerabilidades críticas abiertas.
- [ ] Observabilidad y soporte mínimo.
- [ ] Evidencia de utilidad/retención de beta antes de ampliar mercado.

## 18. Instrucción inmediata para agente Claude

1. Inspecciona el código existente de Bikrom.
2. Documenta arquitectura, dependencias, datos, rutas y riesgos de integración.
3. Entrega diagrama y plan de cambios por fases.
4. Implementa primero fundamentos no destructivos y módulo de hábitos.
5. Ejecuta tests y muestra resultados verificables.
6. Solicita autorización antes de cambios destructivos, cobros reales o despliegues de producción.
