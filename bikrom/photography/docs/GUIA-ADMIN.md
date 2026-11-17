# Guía breve para administrar el negocio

El panel está en **bikrom.com/photography/admin**. Funciona en celular.

## Todos los días
- **Inicio:** próximas sesiones, apartados por vencer, anticipos, saldos, entregas próximas, galerías por vencer, pedidos pendientes y espacio disponible. Los indicadores no cuentan los registros DEMO.
- **Cotizaciones → Por completar:** solicitudes con algún importe sin definir, como viáticos fuera de Querétaro o Irapuato, horas o fotos adicionales, o negocios. Captura los importes, agrega conceptos y define la duración. Al guardar, el cliente recibe su cotización por correo para aceptarla, elegir fecha y pagar.
- **Mensajes:** el formulario de contacto. Cada mensaje tiene un botón de WhatsApp con un saludo preparado; tú lo envías desde tu teléfono.

## Una reserva, de principio a fin
1. **Cotización y apartado.** El cliente cotiza y acepta. Al elegir fecha y horario, la fecha queda **apartada 24 horas**.
2. **Anticipo.** La reserva se **confirma** solo cuando Stripe o PayPal confirman el anticipo del 50%. Si no paga a tiempo, el apartado **vence** y la fecha se libera.
3. **Seguimiento.** En **Reservas → (cliente)** tienes:
   - Mensajes de WhatsApp preparados: saludo, recordatorio de saldo y logística.
   - Registro de **efectivo** o **ajustes**, con nota.
   - Reprogramación, que verifica la disponibilidad.
   - Fecha de entrega, que en escuelas es la acordada.
   - Cancelación con la resolución que acuerdes. **El sistema no hace reembolsos ni cobra penalizaciones por sí solo.**
4. **Conflictos.** Si un pago llega después de vencer el apartado y el horario ya no está libre, la reserva queda **en conflicto** y recibes un aviso para resolverlo.

## Entregar una galería
1. **Crear.** En **Galerías → Nueva galería**, asóciala a la reserva y escribe el título y un mensaje personal.
   - En escuelas, crea una galería por alumno o familia, más una grupal si corresponde.
   - No pongas nombres completos de menores.
2. **Subir.** Sube los archivos finales. Se guardan los originales sin recompresión y las cargas grandes se reanudan si se corta la conexión.
3. **Publicar.**
   - Si hay saldo pendiente, regístralo (por ejemplo, efectivo) antes de publicar. La galería no se libera con saldo y nunca se marca como pagada en silencio.
   - "Publicar" sin fecha libera de inmediato y envía el correo con el enlace y un código privado. Con fecha, se libera ese día.
4. **Vigencia.**
   - La galería está disponible **3 semanas**, con avisos al cliente antes de vencer. La puedes **ampliar** antes de que venza.
   - Al vencer se revocan los accesos y, tras el periodo de gracia configurado en **Ajustes**, se borran los archivos.
5. **Accesos.** Puedes **generar** códigos adicionales, por ejemplo para los abuelos, y **revocarlos**. El código solo se muestra una vez: cópialo al generarlo.

## Tienda
1. **Activar productos.** En **Tienda**, completa tamaños, medidas, acabados y precios reales antes de **activar** cada producto. Sin precio, nada se vende.
2. **Envíos.** Agrega **reglas de envío** por estado. Los destinos sin regla quedan "envío por cotizar": defines el costo en el pedido, el cliente recibe el aviso y paga.
3. **Producción.** Cobrar no inicia la producción. Actualiza el estado (revisión de diseño, en producción, enviado, entregado), la paquetería y el rastreo; el cliente recibe un aviso en cada cambio.
4. **Archivos.** Desde el pedido descargas los originales para producir, aunque la galería ya haya vencido.

## Precios y contenido
- **Servicios y precios.** Si cambias un paquete que ya se usó, se crea una **nueva versión**: las reservas anteriores conservan su precio.
  - Extras sin precio dejan la cotización pendiente.
  - En viáticos, 0 significa incluido y vacío significa que se cotiza.
  - Desde aquí también creas códigos de promoción con vigencia, límite de usos y servicios.
- **Contenido.** Aquí cambias el logo, las imágenes de cada espacio, los textos en español e inglés, las políticas (marca "revisada" al terminar), los testimonios (solo se ven los autorizados), las preguntas frecuentes y el portafolio (cada imagen requiere su autorización).
- **Correos.** Plantillas por tipo, idioma y servicio, y los días de anticipación de cada recordatorio.
- **Ajustes.** Datos del negocio, anticipo, horario de sesiones (7:00–16:00), tiempos de preparación y traslado, vigencia de galerías, capacidad de almacenamiento y resolución mínima de impresión.
- **Registros.** Estado de las integraciones, tareas con fallos, correos enviados o no enviados y actividad. Exporta reservas, pagos y pedidos en CSV desde **Reservas** y **Pedidos**.
