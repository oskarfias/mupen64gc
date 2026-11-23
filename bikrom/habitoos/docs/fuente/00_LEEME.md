# Bikrom / HabitoOS — paquete de contexto para Claude

## Qué contiene

1. `01_CONVERSACION_HABITOOS.md` — reconstrucción cronológica del hilo de diseño de HabitoOS: preguntas del usuario citadas literalmente, principales decisiones y resúmenes de las respuestas del asistente. **No es una exportación literal de todos los mensajes de ChatGPT.**
2. `02_PROMPT_MAESTRO_BIKROM_HABITOOS.md` — prompt de implementación completo y autocontenido para un agente de desarrollo con acceso al proyecto existente de Bikrom.
3. `03_PRD_TECNICO_HABITOOS.md` — documento de requisitos técnicos, datos, arquitectura, métricas y criterios de aceptación.
4. `04_BACKLOG_PRIORIZADO.csv` — backlog importable en Excel, Google Sheets o una herramienta de proyectos.
5. `05_DECISIONES_Y_ESTADO.md` — decisiones del producto y próximos pasos.

## Cómo utilizarlo con Claude

- Carga este ZIP si la interfaz de Claude admite archivos comprimidos; si no lo admite, adjunta los archivos Markdown de manera individual.
- Comienza con `02_PROMPT_MAESTRO_BIKROM_HABITOOS.md` y `03_PRD_TECNICO_HABITOOS.md`.
- Comparte también el código o repositorio de **Bikrom**. El prompt no concede por sí solo acceso al proyecto.
- Pide primero una auditoría técnica y una propuesta de integración sin alterar datos o despliegues existentes.

## Nota sobre la conversación

El historial está organizado como documento de transferencia de contexto para Claude. Los mensajes del usuario están conservados en la medida en que aparecen en el hilo visible, y las respuestas largas se sintetizan, con referencia a los documentos detallados. Para obtener una transcripción absolutamente literal de toda la conversación, utiliza la función de exportación de datos de ChatGPT.

Fecha del paquete: 23 de noviembre de 2026.
