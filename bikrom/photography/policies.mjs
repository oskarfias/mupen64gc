// Borradores de políticas (editables desde el panel). Marcados para revisión: no afirman cumplimiento legal.
// Formato: "## " inicia un subtítulo; líneas en blanco separan párrafos; [REVISAR: …] señala lo que debe definirse.
const C = (es, en) => ({ es, en });

export const POLICIES = {
  policy_privacy: C(
`## Responsable
Estefanía Torres Fotografía, con domicilio en Camino de la Ronda #225, Residencial San Antonio de Ayala, Irapuato, Guanajuato, México. [REVISAR: nombre o razón social del responsable y correo de contacto para privacidad.]

## Datos que recabamos
Nombre, teléfono, correo electrónico y los datos necesarios para cotizar y realizar tu servicio (fecha, lugar, número de personas y, solo si aplica, edades de niñas y niños). Para pedidos de productos, la dirección de envío. Los pagos con tarjeta o PayPal los procesan directamente esos proveedores: no almacenamos datos de tarjetas.

## Para qué los usamos
Para cotizar, reservar, cobrar, coordinar la sesión o evento, entregar tus fotografías en una galería privada y producir y enviar tus pedidos.

## Fotografías y menores
Las galerías son privadas y se acceden con un código. Las fotografías de niñas y niños no se publican sin autorización expresa de madre, padre o tutor. En escuelas, las entregas pueden separarse por alumno o familia.

## Conservación
Las galerías están disponibles tres semanas desde su liberación; después se eliminan sus archivos. Los archivos usados en pedidos pagados se conservan solo durante su producción y un periodo de retención posterior. [REVISAR: plazos de conservación de datos de contacto y facturación.]

## Tus derechos
Puedes solicitar acceso, rectificación, cancelación u oposición al tratamiento de tus datos. [REVISAR: medio y plazo de atención de solicitudes.]

Borrador para revisión legal antes de publicar.`,
`## Controller
Estefanía Torres Fotografía, Camino de la Ronda #225, Residencial San Antonio de Ayala, Irapuato, Guanajuato, Mexico. [REVIEW: legal name and privacy contact email.]

## Data we collect
Name, phone, email and what is needed to quote and deliver your service (date, place, number of people and, only if applicable, children's ages). For product orders, the shipping address. Card and PayPal payments are processed directly by those providers: we do not store card data.

## How we use it
To quote, book, charge, coordinate your session or event, deliver your photographs in a private gallery and produce and ship your orders.

## Photographs and minors
Galleries are private and accessed with a code. Photographs of children are never published without express authorisation from a parent or guardian. For schools, deliveries can be separated by student or family.

## Retention
Galleries are available for three weeks from release; their files are deleted afterwards. Files used in paid orders are kept only during production and a retention period afterwards. [REVIEW: retention periods for contact and billing data.]

## Your rights
You may request access, correction, deletion or objection to the processing of your data. [REVIEW: channel and response time.]

Draft for legal review before publishing.`),

  policy_bookings: C(
`## Cotización
Cada cotización muestra el desglose, el total, el anticipo y el saldo. Los precios aceptados se conservan aunque después cambien las tarifas. Si la cotización cambia después de aceptarla, se pide una nueva aceptación.

## Apartado y anticipo
Al elegir fecha y horario, la fecha queda apartada hasta 24 horas. La reserva se confirma cuando el proveedor de pago confirma el anticipo del 50%. Si no se recibe a tiempo, el apartado vence y la fecha se libera.

## Saldo
El 50% restante se paga con tarjeta, PayPal o en efectivo el día de la sesión o evento. La galería se libera cuando el saldo está liquidado.

## Cancelaciones
Para cancelaciones, avisa con al menos 72 horas de anticipación. Las cancelaciones con menos de 72 horas no tienen reembolso.

[REVISAR: cómo se resuelven las cancelaciones con más de 72 horas de aviso y las reprogramaciones.]

## Entrega
Entrega digital de la selección final editada incluida en tu contratación, con plazo previsto de dos semanas después de la sesión o evento (en escuelas, la fecha acordada). No incluye archivos RAW, material descartado ni todo lo capturado. No hay etapa de selección o aprobación de pruebas. Las fotografías adicionales se acuerdan y cobran desde la cotización inicial; no se ofrecen después de pactar la entrega.

## Desplazamientos
Trabajo en Querétaro e Irapuato. Otros destinos incluyen viáticos adicionales en la cotización.

Borrador para revisión antes de publicar.`,
`## Quote
Each quote shows the breakdown, total, deposit and balance. Accepted prices are kept even if rates change later. If a quote changes after acceptance, a new acceptance is required.

## Hold and deposit
When you choose a date and time, it is held for up to 24 hours. The booking is confirmed when the payment provider confirms the 50% deposit. If it is not received in time, the hold expires and the date is released.

## Balance
The remaining 50% is paid by card, PayPal or in cash on the day of the session or event. The gallery is released once the balance is settled.

## Cancellations
To cancel, please give at least 72 hours’ notice. Cancellations with less than 72 hours’ notice are not refundable.

[REVIEW: how cancellations with more than 72 hours’ notice and rescheduling are handled.]

## Delivery
Digital delivery of the final edited selection included in your booking, expected two weeks after the session or event (for schools, the agreed date). It does not include RAW files, discarded material or everything captured. There is no proofing or approval stage. Additional photos are agreed and charged in the initial quote; they are not offered after delivery is agreed.

## Travel
I work in Querétaro and Irapuato. Other destinations include additional travel expenses in the quote.

Draft for review before publishing.`),

  policy_purchases: C(
`## Productos
Impresiones, ampliaciones, cuadros y fotolibros se piden desde la galería privada, con fotografías de tu sesión. Los productos y precios disponibles se muestran al personalizar el pedido.

## Pago
Los pedidos se pagan completos al ordenar, de forma independiente al saldo de la sesión.

## Envíos
El costo de envío se calcula con las tarifas configuradas. Si tu destino no tiene tarifa, recibirás la cotización del envío por correo y podrás pagar después: no se cobra un pedido con envío sin definir.

## Producción y revisión de diseño
Algunos productos, como los fotolibros, incluyen una revisión del diseño antes de producir. Esto no es una aprobación de las fotografías entregadas.

[REVISAR: proveedores de producción, tiempos de producción y entrega, cambios, devoluciones y productos dañados.]

Borrador para revisión antes de publicar.`,
`## Products
Prints, enlargements, frames and photobooks are ordered from your private gallery using photographs from your session. Available products and prices are shown while personalising the order.

## Payment
Orders are paid in full when placed, independently from the session balance.

## Shipping
Shipping is calculated with the configured rates. If your destination has no rate, you will receive a shipping quote by email and can pay afterwards: an order is never charged with undefined shipping.

## Production and design review
Some products, such as photobooks, include a design review before production. This is not an approval of the delivered photographs.

[REVIEW: production providers, production and delivery times, changes, returns and damaged products.]

Draft for review before publishing.`),

  policy_image: C(
`## Autorización independiente
Publicar fotografías en el portafolio, redes sociales o materiales promocionales requiere una autorización independiente y expresa. Contratar un servicio nunca está condicionado a autorizar el uso publicitario de tu imagen.

## Menores de edad
Las fotografías de niñas y niños solo se publican con autorización de madre, padre o tutor. Nunca se publican sus nombres ni datos personales.

## Escuelas
Las fotografías escolares se entregan de forma privada por alumno, familia o grupo, según lo acordado con la escuela. No se publican sin las autorizaciones correspondientes.

## Revocación
Puedes retirar tu autorización en cualquier momento para usos futuros. [REVISAR: medio para solicitarlo y plazo de retiro de publicaciones.]

Borrador para revisión legal antes de publicar.`,
`## Separate authorisation
Publishing photographs in the portfolio, social media or promotional materials requires a separate, express authorisation. Booking a service is never conditional on authorising promotional use of your image.

## Minors
Photographs of children are only published with authorisation from a parent or guardian. Their names or personal data are never published.

## Schools
School photographs are delivered privately by student, family or group, as agreed with the school. They are not published without the corresponding authorisations.

## Withdrawal
You may withdraw your authorisation at any time for future uses. [REVIEW: how to request it and how quickly posts are removed.]

Draft for legal review before publishing.`),
};
