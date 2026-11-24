# Bikrom/HabitoOS

Plataforma de hábitos y mejora continua. Vive en **bikrom.com/habitoos**, dentro del servidor de Bikrom, con su propia base de datos.

- **Requisitos:** `docs/fuente/` (prompt maestro, PRD, backlog).
- **Diagnóstico y plan:** `docs/FASE-0-AUDITORIA.md`.

## Estado: fase 1 (fundación y núcleo)
| Hecho y probado | Pendiente (siguientes fases del PRD) |
|---|---|
| Registro, entrada y salida, verificación de correo, recuperación de contraseña, sesiones revocables (hash en base), CSRF y límites de intentos | Google y Apple Sign-In |
| Onboarding de 8 pasos, guardable y reanudable, idempotente | |
| Hábitos para desarrollar, mantener, reducir y abandonar; medición sí/no, cantidad, duración o rango | Panel administrativo SaaS (B12) |
| Metas y programación **versionadas**: cambiar una meta no reescribe la historia | Notificaciones push en el teléfono |
| Today: registro en 1–2 toques, autoguardado idempotente, deshacer, 7 estados ("sin registro" ≠ "no cumplido") | Experimentos y revisión semanal (B15) |
| Pausas, días de descanso y "no aplica" sin penalización | Nutrición (B16), PWA sin conexión (B17) |
| Adherencia, cobertura y recuperación con denominador visible; límite Free de 3 hábitos y 30 días aplicado en el backend | |
| Exportación JSON y CSV; eliminación de cuenta con auditoría seudonimizada | |
| ES/EN, zona horaria IANA por usuario, modo claro y oscuro, PWA instalable (manifest y service worker de recursos estáticos) | |
| Tendencias (B10): adherencia por semana o mes en gráficas SVG accesibles (con tabla), promedio del valor registrado, comparación con la línea base (primeros 14 días vs. últimos 14) con n y aviso de poca evidencia; se recalculan tras correcciones | |
| Plan Pro (B11): Stripe Checkout en modo suscripción, precios por entorno, consentimiento explícito, activación solo por webhook firmado e idempotente, cancelación al final del periodo pagado, perder Pro no borra datos | |
| Recordatorios por correo (B18): opt-in con correo verificado, a la hora de cada hábito pendiente y resumen diario opcional, según la zona horaria del usuario, sin duplicados, baja en un clic | |
| Reflexión diaria opcional (B09): ánimo, obstáculos por hábito y fecha, nota e intención "si X, entonces Y" cifradas; solo se sugiere tras tropiezos o por la tarde; omitirla no penaliza; frecuencias de obstáculos y ánimo en Indicadores | |

## Ejecutar y probar
```bash
cd bikrom
npm start                 # http://localhost:3000/habitoos
npm run habitoos:test     # 12 pruebas de aceptación de la fase 1
npm test                  # Bikrom + Fotografía + HabitoOS
```

## Configuración
| Variable | Uso |
|---|---|
| `APP_SECRET` | Firma de los tokens CSRF. Ya existe en Render. |
| `DATA_DIR` | Base de datos en `DATA_DIR/habitoos/habitoos.db`. En Render: `/var/data`. |
| `RESEND_API_KEY` + `HABITOOS_EMAIL_FROM` | Correos de verificación y recuperación. **Sin ellas no se envía ningún correo:** en desarrollo, el enlace se imprime en el registro del servidor. |

## Reglas de medición (PRD §5)
- **Adherencia** = cumplidas ÷ (cumplidas + parciales + no cumplidas). Los días pendientes y sin registro no cuentan.
- **Cobertura** = (cumplidas + parciales + no cumplidas + omitidas) ÷ (programadas − pausas − "no aplica" − pendientes de hoy).
- **Recuperación** = oportunidades programadas, en promedio, hasta volver a cumplir después de una no cumplida. Es una métrica descriptiva.
- Todo se recalcula desde los registros fuente; corregir un registro actualiza los indicadores.

## Seguridad
- **Aislamiento:** cada consulta filtra por `owner_id` mediante `ownHabit()`. Un recurso ajeno responde **404**; hay pruebas que intentan manipular identificadores.
- **Contraseñas:** se guardan con scrypt. Los tokens de sesión, verificación y recuperación se guardan como hash SHA-256 y los enlaces son de un solo uso. Restablecer la contraseña cierra todas las sesiones.
- **Administración:** el panel (fase B12) mostrará solo métricas agregadas. Las notas e intenciones de la reflexión se guardan cifradas (AES-256-GCM con `APP_SECRET`; si se cambia `APP_SECRET` dejan de poder leerse).

## Configuración de cobro y correo (variables de entorno)

| Variable | Para qué |
|---|---|
| `HABITOOS_STRIPE_SECRET_KEY` | Clave secreta de Stripe de HabitoOS (independiente de Fotografía y del sitio) |
| `HABITOOS_STRIPE_WEBHOOK_SECRET` | Secreto del webhook `https://bikrom.com/habitoos/api/webhooks/stripe` (eventos: `checkout.session.completed`, `customer.subscription.*`, `invoice.paid`, `invoice.payment_failed`) |
| `HABITOOS_PRICE_MONTHLY_CENTS` / `HABITOOS_PRICE_YEARLY_CENTS` | Precios en centavos (por defecto 499 y 3999) |
| `HABITOOS_CURRENCY` | Moneda (por defecto `usd`) |
| `RESEND_API_KEY` + `HABITOOS_EMAIL_FROM` | Envío de verificación, recuperación y recordatorios |

Sin las claves de Stripe la página de Plan muestra "disponible muy pronto" y no se cobra ni se simula nada.
