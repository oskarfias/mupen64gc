import { POLICIES } from './policies.mjs';

// Datos iniciales. Solo se insertan si la base está vacía; después todo se edita desde el panel.
// Los conceptos sin dato definido quedan en NULL (no se cobran) o en borrador.

export const DEFAULT_SETTINGS = {
  business: {
    name: 'Estefanía Torres Fotografía',
    phone: '442 322 6174',
    whatsapp: 'https://wa.me/524423226174',
    instagram: 'https://www.instagram.com/estefaniatorresfotografia/',
    address: ['Camino de la Ronda #225', 'Residencial San Antonio de Ayala', 'Irapuato, Guanajuato, México'],
    cities: ['Querétaro', 'Irapuato'],
    email: null,          // correo comercial: se configura después
    domain: null,         // dominio propio: se configura después
    logo_media_id: null,  // logo definitivo: se carga desde el panel
    admin_alert_email: null,
  },
  booking: {
    deposit_percent: 50,
    hold_hours: 24,
    session_window: { start: '07:00', end: '16:00' },
    slot_step_min: 30,
    prep_min: 0,          // tiempo de preparación antes de cada servicio (configurable)
    travel_min: 0,        // traslado antes y después (configurable)
    min_notice_hours: 0,
    horizon_days: 365,
  },
  delivery: { default_days: 14, warn_before_days: 3 },
  gallery: {
    validity_days: 21,
    reminder_days_before: [7, 2],
    auto_delete: { enabled: true, grace_days: 7 },
    zip_batch_mb: 2048,
  },
  storage: { quota_gb: 15, warn_percent: [80, 95] },
  shop: { dpi_min: 150, dpi_good: 300, order_file_retention_days: 30 },
  cancellation: {
    es: 'Para cancelaciones, avisa con al menos 72 horas de anticipación. Las cancelaciones con menos de 72 horas no tienen reembolso.',
    en: 'To cancel, please give at least 72 hours’ notice. Cancellations with less than 72 hours’ notice are not refundable.',
    // Resolución de cancelaciones con más de 72 horas y reprogramaciones: por definir (se resuelven manualmente).
    resolution_rule: null,
  },
  reminders: { prep_days_before: 7, poses_days_before: 5, logistics_days_before: 2 },
};

const C = (es, en) => ({ es, en });

export const DEFAULT_CONTENT = {
  hero_title: C('Fotografía única, cuidada en cada detalle.', 'Unique photography, cared for in every detail.'),
  hero_sub: C('Retratos, familias, eventos y bodas en Querétaro e Irapuato, con calidad en todo el servicio.', 'Portraits, families, events and weddings in Querétaro and Irapuato, with quality throughout the whole service.'),
  intro_title: C('Imágenes que se sienten como tú', 'Images that feel like you'),
  intro_body: C(
    'Cada sesión se prepara con calma y atención personal: desde la primera conversación hasta la entrega de tu galería. Busco luz natural, gestos sinceros y encuadres cuidados para que tus fotografías se conserven y se miren por muchos años.',
    'Every session is prepared calmly and with personal attention, from our first conversation to the delivery of your gallery. I look for natural light, honest gestures and careful framing so your photographs are kept and enjoyed for years.'
  ),
  how_title: C('Cómo reservar', 'How to book'),
  how_steps: C(
    'Elige tu servicio y cuéntame los detalles.|Recibe tu cotización con el desglose completo.|Elige fecha y horario disponibles; la fecha queda apartada 24 horas.|Confirma con el 50% de anticipo. El saldo se cubre antes o el día de la sesión.',
    'Choose your service and tell me the details.|Get your quote with a full breakdown.|Choose an available date and time; it is held for 24 hours.|Confirm with a 50% deposit. The balance is paid before or on the day of the session.'
  ),
  products_title: C('Tus fotografías, para tenerlas cerca', 'Your photographs, close at hand'),
  products_body: C(
    'Impresiones, ampliaciones, cuadros y fotolibros hechos a partir de las fotografías de tu sesión. Se eligen y personalizan desde tu galería privada.',
    'Prints, enlargements, frames and photobooks made from the photographs of your session. They are chosen and personalised from your private gallery.'
  ),
  my_session_title: C('Mi sesión', 'My session'),
  my_session_body: C('Tus fotografías te esperan en una galería privada, fácil de ver y descargar desde cualquier dispositivo.', 'Your photographs are waiting in a private gallery, easy to view and download on any device.'),
  about_title: C('Hola, soy Estefanía', 'Hi, I’m Estefanía'),
  about_body: C(
    'Texto provisional. Aquí irá tu historia: por qué fotografías, qué buscas en cada sesión y cómo acompañas a las familias, parejas y negocios con los que trabajas.',
    'Placeholder text. Your story goes here: why you photograph, what you look for in each session and how you accompany the families, couples and businesses you work with.'
  ),
  schools_title: C('Fotografía escolar con atención a cada alumno', 'School photography with care for every student'),
  schools_body: C(
    'Una propuesta pensada para directoras y directores de escuelas privadas: organización por grupos, entregas separadas por alumno o familia y cuidado especial de la privacidad de niñas y niños.',
    'A proposal designed for private school principals: organisation by group, deliveries separated by student or family and special care for children’s privacy.'
  ),
  business_title: C('Fotografía y contenido para tu negocio', 'Photography and content for your business'),
  business_body: C(
    'Imágenes y video con la calidez de tu marca: tu equipo, tus espacios y tus productos. Cuéntame qué necesitas y preparo una cotización personalizada.',
    'Images and video with the warmth of your brand: your team, your spaces and your products. Tell me what you need and I will prepare a custom quote.'
  ),
  tesoro_title: C('Videos Tesoro', 'Tesoro videos'),
  tesoro_body: C(
    'Hay voces que queremos volver a escuchar. Un video Tesoro conserva las historias, la risa y los recuerdos de tus familiares queridos a través de preguntas y entrevistas, para que sigan acompañando a quienes vienen después.',
    'Some voices we want to hear again. A Tesoro video keeps the stories, the laughter and the memories of your loved ones through questions and interviews, so they stay with those who come after.'
  ),
  contact_title: C('Hablemos', 'Let’s talk'),
  contact_body: C('Escríbeme por WhatsApp o déjame tus datos y te respondo personalmente.', 'Message me on WhatsApp or leave your details and I will reply personally.'),
  travel_note: C(
    'Trabajo en Querétaro e Irapuato. Puedo trasladarme a otros destinos con viáticos adicionales, que se incluyen en tu cotización.',
    'I work in Querétaro and Irapuato. I can travel to other destinations with additional travel expenses, included in your quote.'
  ),
  general_conditions: C(
    'Cambios de ropa incluidos cuando correspondan al servicio y dentro del tiempo contratado.|Entrega digital de la selección final editada incluida en tu contratación.|Plazo previsto de entrega: dos semanas después de la sesión o evento.|La entrega no incluye archivos RAW, material descartado ni todo lo capturado.|No hay etapa de selección o aprobación de pruebas.|Las fotografías adicionales se acuerdan y cobran desde la cotización inicial; no se ofrecen después de pactar la entrega.',
    'Outfit changes included when they apply to the service and within the booked time.|Digital delivery of the final edited selection included in your booking.|Expected delivery: two weeks after the session or event.|Delivery does not include RAW files, discarded material or everything captured.|There is no proofing or approval stage.|Additional photos are agreed and charged in the initial quote; they are not offered after delivery is agreed.'
  ),
};

const field = (name, type, es, en, extra = {}) => ({ name, type, label_es: es, label_en: en, ...extra });

export const SERVICES = [
  {
    slug: 'sesion-express', kind: 'session', name: C('Sesión express', 'Express session'),
    summary: C('Retratos, familia o pareja en una sesión breve y cuidada.', 'Portraits, family or couple in a short, careful session.'),
    packages: [{ key: 'express', name: C('Sesión express', 'Express session'), pricing: 'fixed', price: 250000, duration: 60, photos: 30, delivery: 14 }],
    fields: [
      field('people', 'number', 'Cantidad de personas', 'Number of people', { required: true, min: 1 }),
      field('has_kids', 'select', '¿Participan niñas o niños?', 'Will children take part?', { options: [['no', 'No', 'No'], ['si', 'Sí', 'Yes']] }),
      field('kids_ages', 'text', 'Edades de niñas y niños', "Children's ages", { showIf: ['has_kids', 'si'] }),
      field('goal', 'textarea', 'Objetivo de la sesión', 'Purpose of the session', { required: true }),
      field('extra_photos', 'number', 'Fotografías adicionales (opcional)', 'Additional photos (optional)', { min: 0, extra: 'extra_photos' }),
      field('date', 'date', 'Fecha deseada', 'Preferred date', { required: true }),
    ],
  },
  {
    slug: 'eventos-sociales', kind: 'event', name: C('Eventos sociales', 'Social events'),
    summary: C('Cumpleaños, bautizos, aniversarios y celebraciones familiares.', 'Birthdays, christenings, anniversaries and family celebrations.'),
    packages: [{ key: 'evento', name: C('Evento social', 'Social event'), pricing: 'fixed', price: 350000, duration: 120, photos: 60, delivery: 14 }],
    fields: [
      field('event_type', 'text', 'Tipo de evento', 'Type of event', { required: true }),
      field('people', 'number', 'Invitados aproximados', 'Approximate guests', { min: 1 }),
      field('date', 'date', 'Fecha del evento', 'Event date', { required: true }),
      field('start_time', 'time', 'Hora real de inicio de la cobertura', 'Actual coverage start time', { required: true }),
      field('coverage_hours', 'number', 'Horas de cobertura (incluye 2)', 'Coverage hours (2 included)', { required: true, min: 2, default: 2, extra: 'extra_hour', included: 2 }),
      field('extra_photos', 'number', 'Fotografías adicionales (opcional)', 'Additional photos (optional)', { min: 0, extra: 'extra_photos' }),
      field('goal', 'textarea', 'Momentos importantes para ti', 'Key moments for you'),
    ],
  },
  {
    slug: 'bodas', kind: 'wedding', name: C('Bodas', 'Weddings'),
    summary: C('Cobertura de tu boda con mirada editorial y cercana.', 'Wedding coverage with an editorial and personal eye.'),
    packages: [{ key: 'boda', name: C('Boda', 'Wedding'), pricing: 'fixed', price: 1500000, duration: 360, photos: 120, delivery: 14 }],
    fields: [
      field('date', 'date', 'Fecha de la boda', 'Wedding date', { required: true }),
      field('start_time', 'time', 'Hora de inicio de la cobertura', 'Coverage start time', { required: true }),
      field('coverage_hours', 'number', 'Horas de cobertura (incluye 6)', 'Coverage hours (6 included)', { required: true, min: 6, default: 6, extra: 'extra_hour', included: 6 }),
      field('venues', 'textarea', 'Lugares (ceremonia, recepción, preparación)', 'Venues (ceremony, reception, getting ready)', { required: true }),
      field('logistics', 'textarea', 'Logística y horarios importantes', 'Logistics and key times'),
      field('people', 'number', 'Invitados aproximados', 'Approximate guests', { min: 1 }),
      field('extra_photos', 'number', 'Fotografías adicionales (opcional)', 'Additional photos (optional)', { min: 0, extra: 'extra_photos' }),
    ],
  },
  {
    slug: 'escuelas', kind: 'school', name: C('Escuelas', 'Schools'),
    summary: C('Fotografía escolar por grupo y por alumno.', 'School photography by group and by student.'),
    packages: [
      { key: 'escuela-basico', name: C('Paquete básico', 'Basic package'), pricing: 'per_unit', price: 25000, unit: C('por alumno', 'per student'), duration: null, photos: null, delivery: null, includesPending: true },
      { key: 'escuela-premium', name: C('Paquete premium', 'Premium package'), pricing: 'per_unit', price: 35000, unit: C('por alumno', 'per student'), duration: null, photos: null, delivery: null, includesPending: true },
    ],
    fields: [
      field('school_name', 'text', 'Nombre de la escuela', 'School name', { required: true }),
      field('groups', 'groups', 'Grupos y alumnos', 'Groups and students', { required: true }),
      field('date', 'date', 'Fecha propuesta', 'Proposed date', { required: true }),
      field('delivery_agreement', 'text', 'Fecha de entrega deseada', 'Desired delivery date'),
      field('logistics', 'textarea', 'Logística (horarios, espacios, contacto en la escuela)', 'Logistics (times, spaces, school contact)'),
    ],
  },
  {
    slug: 'negocios', kind: 'business', name: C('Negocios', 'Business'),
    summary: C('Fotografía y video para pequeños y medianos negocios.', 'Photography and video for small and medium businesses.'),
    packages: [{ key: 'negocio', name: C('Contenido para negocio', 'Business content'), pricing: 'quote', price: null, duration: null, photos: null, delivery: null }],
    fields: [
      field('business_name', 'text', 'Nombre del negocio', 'Business name', { required: true }),
      field('business_type', 'text', 'Giro', 'Industry', { required: true }),
      field('content_types', 'checkboxes', 'Tipo de contenido', 'Type of content', { required: true, options: [
        ['producto', 'Fotografía de producto', 'Product photography'], ['equipo', 'Retratos del equipo', 'Team portraits'],
        ['espacios', 'Espacios', 'Spaces'], ['video', 'Video', 'Video'], ['redes', 'Contenido para redes', 'Social media content'],
      ] }),
      field('needs', 'textarea', '¿Qué necesitas y para qué lo usarás?', 'What do you need and how will you use it?', { required: true }),
      field('frequency', 'select', 'Frecuencia', 'Frequency', { options: [['una', 'Una vez', 'One time'], ['mensual', 'Mensual', 'Monthly'], ['temporada', 'Por temporada', 'Seasonal']] }),
      field('date', 'date', 'Fecha tentativa', 'Tentative date'),
    ],
  },
  {
    slug: 'tesoro', kind: 'tesoro', name: C('Video Tesoro', 'Tesoro video'),
    summary: C('Voces, historias y recuerdos de tus familiares queridos.', 'Voices, stories and memories of your loved ones.'),
    packages: [{ key: 'tesoro', name: C('Video Tesoro', 'Tesoro video'), pricing: 'fixed', price: 600000, duration: null, photos: null, videoMinutes: 5, delivery: 14,
      includes: [C('Video final de 5 minutos', '5-minute final video'), C('Preguntas y entrevistas a familiares queridos', 'Questions and interviews with loved ones')] }],
    fields: [
      field('relatives', 'textarea', 'Familiares que participarían', 'Relatives who would take part', { required: true }),
      field('goal', 'textarea', '¿Qué recuerdo quieres conservar?', 'What memory would you like to keep?', { required: true }),
      field('date', 'date', 'Fecha tentativa', 'Tentative date'),
    ],
  },
];

const T = (subject, body) => ({ subject, body });

// Plantillas de correo: {{variables}} se reemplazan. Párrafos separados por línea en blanco.
export const TEMPLATES = [
  { key: 'quote_ready', lang: 'es', ...T('Tu cotización está lista', 'Hola {{nombre}}:\n\nPreparé tu cotización para {{servicio}}. Total: {{total}}. Anticipo para confirmar: {{anticipo}}.\n\nPuedes revisarla, aceptarla y elegir fecha aquí:\n{{enlace}}') },
  { key: 'quote_ready', lang: 'en', ...T('Your quote is ready', 'Hi {{nombre}},\n\nI prepared your quote for {{servicio}}. Total: {{total}}. Deposit to confirm: {{anticipo}}.\n\nYou can review it, accept it and choose a date here:\n{{enlace}}') },
  { key: 'hold_received', lang: 'es', ...T('Tu fecha está apartada', 'Hola {{nombre}}:\n\nTu fecha para {{servicio}} quedó apartada: {{fecha}}.\n\nPara confirmar, paga el anticipo de {{anticipo}} antes de {{vence}}. Si no se recibe a tiempo, el apartado vence y la fecha se libera.\n\nPagar anticipo: {{enlace}}\n\n{{cancelacion}}') },
  { key: 'hold_received', lang: 'en', ...T('Your date is on hold', 'Hi {{nombre}},\n\nYour date for {{servicio}} is on hold: {{fecha}}.\n\nTo confirm, pay the {{anticipo}} deposit before {{vence}}. If it is not received in time, the hold expires and the date is released.\n\nPay deposit: {{enlace}}\n\n{{cancelacion}}') },
  { key: 'booking_confirmed', lang: 'es', ...T('Reserva confirmada', 'Hola {{nombre}}:\n\nRecibí tu anticipo de {{pagado}}. Tu reserva para {{servicio}} está confirmada: {{fecha}}.\n\nSaldo pendiente: {{saldo}}. Puedes cubrirlo con tarjeta, PayPal o en efectivo el día de la sesión o evento.\n\nDetalles de tu reserva: {{enlace}}') },
  { key: 'booking_confirmed', lang: 'en', ...T('Booking confirmed', 'Hi {{nombre}},\n\nI received your {{pagado}} deposit. Your booking for {{servicio}} is confirmed: {{fecha}}.\n\nRemaining balance: {{saldo}}. You can pay it by card, PayPal or in cash on the day of the session or event.\n\nBooking details: {{enlace}}') },
  { key: 'hold_expired', lang: 'es', ...T('Tu apartado venció', 'Hola {{nombre}}:\n\nNo se recibió el anticipo a tiempo y el apartado de {{fecha}} venció, por lo que la fecha se liberó.\n\nSi aún te interesa, puedes elegir una nueva fecha aquí: {{enlace}}') },
  { key: 'hold_expired', lang: 'en', ...T('Your hold expired', 'Hi {{nombre}},\n\nThe deposit was not received in time, so the hold for {{fecha}} expired and the date was released.\n\nIf you are still interested, you can choose a new date here: {{enlace}}') },
  { key: 'payment_received', lang: 'es', ...T('Recibí tu pago', 'Hola {{nombre}}:\n\nRecibí tu pago. Total pagado: {{pagado}}. Saldo pendiente: {{saldo}}.\n\nDetalles: {{enlace}}') },
  { key: 'payment_received', lang: 'en', ...T('Payment received', 'Hi {{nombre}},\n\nI received your payment. Total paid: {{pagado}}. Remaining balance: {{saldo}}.\n\nDetails: {{enlace}}') },
  { key: 'booking_conflict', lang: 'es', ...T('Recibí tu pago: revisaré tu fecha', 'Hola {{nombre}}:\n\nRecibí tu pago, pero tu apartado había vencido y el horario ya no estaba disponible. Me pondré en contacto contigo para resolverlo personalmente.') },
  { key: 'booking_conflict', lang: 'en', ...T('Payment received: I will review your date', 'Hi {{nombre}},\n\nI received your payment, but your hold had expired and the time was no longer available. I will contact you personally to sort it out.') },
  { key: 'prep_recommendations', lang: 'es', service_kind: 'session', offset: 7, ...T('Cómo prepararte para tu sesión', 'Hola {{nombre}}:\n\nFaltan pocos días para tu sesión ({{fecha}}). Algunas recomendaciones:\n\n• Elige ropa en tonos neutros o cálidos, sin logotipos grandes.\n• Si cambiarás de ropa, prepara las opciones con anticipación.\n• Descansa e hidrátate; llega con tiempo y sin prisas.\n\nTexto editable desde el panel.') },
  { key: 'prep_recommendations', lang: 'en', service_kind: 'session', offset: 7, ...T('How to prepare for your session', 'Hi {{nombre}},\n\nYour session is coming up ({{fecha}}). A few tips:\n\n• Choose neutral or warm tones, without large logos.\n• If you will change outfits, prepare the options in advance.\n• Rest, stay hydrated and arrive early and relaxed.\n\nEditable from the admin panel.') },
  { key: 'prep_recommendations', lang: 'es', service_kind: 'wedding', offset: 7, ...T('Preparativos para tu boda', 'Hola {{nombre}}:\n\nTu boda se acerca ({{fecha}}). Para que la cobertura fluya, compárteme el programa del día, los nombres de las personas clave y cualquier momento que no quieras que me pierda.\n\nTexto editable desde el panel.') },
  { key: 'prep_recommendations', lang: 'en', service_kind: 'wedding', offset: 7, ...T('Getting ready for your wedding', 'Hi {{nombre}},\n\nYour wedding is coming up ({{fecha}}). So the coverage flows, please share the schedule, the names of key people and any moment I should not miss.\n\nEditable from the admin panel.') },
  { key: 'poses', lang: 'es', service_kind: 'session', offset: 5, ...T('Ideas para tu sesión', 'Hola {{nombre}}:\n\nTe comparto algunas ideas de poses y momentos para tu sesión. No te preocupes: durante la sesión te guiaré con calma.\n\nTexto e imágenes editables desde el panel.') },
  { key: 'poses', lang: 'en', service_kind: 'session', offset: 5, ...T('Ideas for your session', 'Hi {{nombre}},\n\nHere are a few pose and moment ideas for your session. Don’t worry: I will guide you calmly during the session.\n\nEditable from the admin panel.') },
  { key: 'logistics', lang: 'es', offset: 2, ...T('Logística de tu {{servicio}}', 'Hola {{nombre}}:\n\nTe confirmo los detalles: {{fecha}}, en {{lugar}}.\n\nSaldo pendiente: {{saldo}}.\n\nSi algo cambió, escríbeme por WhatsApp.') },
  { key: 'logistics', lang: 'en', offset: 2, ...T('Logistics for your {{servicio}}', 'Hi {{nombre}},\n\nConfirming the details: {{fecha}}, at {{lugar}}.\n\nRemaining balance: {{saldo}}.\n\nIf anything changed, message me on WhatsApp.') },
  { key: 'gallery_delivery', lang: 'es', ...T('Tu galería está lista', 'Hola {{nombre}}:\n\nTu galería «{{galeria}}» ya está disponible.\n\nEntra aquí: {{enlace}}\nTu código privado: {{codigo}}\n\nQuien tenga el enlace y el código podrá ver y descargar la galería mientras esté vigente. Está disponible hasta {{vence}}: descarga y guarda tus archivos, porque después se eliminan.') },
  { key: 'gallery_delivery', lang: 'en', ...T('Your gallery is ready', 'Hi {{nombre}},\n\nYour gallery “{{galeria}}” is now available.\n\nOpen it here: {{enlace}}\nYour private code: {{codigo}}\n\nAnyone with the link and the code can view and download the gallery while it is available. It is available until {{vence}}: download and keep your files, as they are deleted afterwards.') },
  { key: 'gallery_expiry_reminder', lang: 'es', ...T('Tu galería vence pronto', 'Hola {{nombre}}:\n\nTu galería «{{galeria}}» estará disponible hasta {{vence}}. Si aún no descargas tus archivos, hazlo antes de esa fecha: {{enlace}}') },
  { key: 'gallery_expiry_reminder', lang: 'en', ...T('Your gallery expires soon', 'Hi {{nombre}},\n\nYour gallery “{{galeria}}” is available until {{vence}}. If you haven’t downloaded your files yet, please do so before then: {{enlace}}') },
  { key: 'order_confirmed', lang: 'es', ...T('Recibí tu pedido', 'Hola {{nombre}}:\n\nRecibí el pago de tu pedido {{pedido}} por {{total}}. Te avisaré cuando entre a producción y cuando se envíe.\n\nSeguimiento: {{enlace}}') },
  { key: 'order_confirmed', lang: 'en', ...T('Order received', 'Hi {{nombre}},\n\nI received the payment for your order {{pedido}} ({{total}}). I will let you know when it goes into production and when it ships.\n\nTracking: {{enlace}}') },
  { key: 'order_shipping_quote', lang: 'es', ...T('Costo de envío de tu pedido', 'Hola {{nombre}}:\n\nEl envío de tu pedido {{pedido}} cuesta {{envio}}. Total: {{total}}.\n\nCompleta tu pago aquí: {{enlace}}') },
  { key: 'order_shipping_quote', lang: 'en', ...T('Shipping cost for your order', 'Hi {{nombre}},\n\nShipping for your order {{pedido}} costs {{envio}}. Total: {{total}}.\n\nComplete your payment here: {{enlace}}') },
  { key: 'order_update', lang: 'es', ...T('Actualización de tu pedido', 'Hola {{nombre}}:\n\nTu pedido {{pedido}} cambió a: {{estado}}.{{rastreo}}\n\nSeguimiento: {{enlace}}') },
  { key: 'order_update', lang: 'en', ...T('Order update', 'Hi {{nombre}},\n\nYour order {{pedido}} is now: {{estado}}.{{rastreo}}\n\nTracking: {{enlace}}') },
];

export const FAQS = [
  ['¿Cuándo recibo mis fotografías?', 'El plazo previsto es de dos semanas después de la sesión o evento. Para escuelas, la fecha se acuerda en la cotización.', 'When will I receive my photos?', 'Expected delivery is two weeks after the session or event. For schools, the date is agreed in the quote.'],
  ['¿Recibo todas las fotos que se tomaron?', 'Recibes la selección final editada incluida en tu contratación. No se entregan archivos RAW, material descartado ni todo lo capturado.', 'Do I get every photo taken?', 'You receive the final edited selection included in your booking. RAW files, discarded material or everything captured are not delivered.'],
  ['¿Puedo pedir fotografías adicionales después?', 'Las fotografías adicionales se acuerdan y cobran desde la cotización inicial. No se ofrecen después de pactar la entrega.', 'Can I request additional photos later?', 'Additional photos are agreed and charged in the initial quote. They are not offered after delivery is agreed.'],
  ['¿Cómo aparto mi fecha?', 'Al aceptar tu cotización eliges fecha y horario; la fecha queda apartada 24 horas. Se confirma con el 50% de anticipo y el saldo se cubre antes o el día de la sesión.', 'How do I hold my date?', 'When you accept your quote you choose a date and time; it is held for 24 hours. It is confirmed with a 50% deposit and the balance is paid before or on the day.'],
  ['¿Qué formas de pago aceptas?', 'Tarjeta y PayPal en línea. El saldo final también puede pagarse en efectivo el día de la sesión o evento.', 'Which payment methods do you accept?', 'Card and PayPal online. The final balance can also be paid in cash on the day of the session or event.'],
  ['¿Qué pasa si necesito cancelar?', 'Para cancelaciones, avisa con al menos 72 horas de anticipación. Las cancelaciones con menos de 72 horas no tienen reembolso.', 'What if I need to cancel?', 'To cancel, please give at least 72 hours’ notice. Cancellations with less than 72 hours’ notice are not refundable.'],
  ['¿Viajas a otras ciudades?', 'Trabajo en Querétaro e Irapuato. Puedo trasladarme a otros destinos con viáticos adicionales, que se incluyen en tu cotización.', 'Do you travel?', 'I work in Querétaro and Irapuato. I can travel to other destinations with additional travel expenses, included in your quote.'],
  ['¿Cuánto tiempo está disponible mi galería?', 'Tres semanas a partir de la fecha en que se libera. Descarga y guarda tus archivos antes de que venza.', 'How long is my gallery available?', 'Three weeks from the date it is released. Download and keep your files before it expires.'],
];

export const PRODUCTS = [
  { slug: 'impresiones', kind: 'print', name: C('Impresiones', 'Prints'), description: C('Impresiones de tus fotografías favoritas.', 'Prints of your favourite photographs.'), min: 1, max: 1, review: 0 },
  { slug: 'ampliaciones', kind: 'enlargement', name: C('Ampliaciones', 'Enlargements'), description: C('Fotografías en gran formato.', 'Large-format photographs.'), min: 1, max: 1, review: 0 },
  { slug: 'cuadros', kind: 'frame', name: C('Cuadros', 'Frames'), description: C('Tus fotografías listas para colgar.', 'Your photographs ready to hang.'), min: 1, max: 1, review: 0 },
  { slug: 'fotolibros', kind: 'photobook', name: C('Fotolibros', 'Photobooks'), description: C('Tu historia, página por página.', 'Your story, page by page.'), min: 1, max: 200, review: 1 },
];

export const PORTFOLIO_CATEGORIES = [
  ['familias', 'Familias', 'Families'], ['parejas', 'Parejas', 'Couples'], ['eventos', 'Eventos', 'Events'],
  ['bodas', 'Bodas', 'Weddings'], ['escuelas', 'Escuelas', 'Schools'], ['negocios', 'Negocios', 'Business'],
];

// Espacios de imagen reemplazables. Sin archivo: se muestra un marco cálido identificado como pendiente.
export const MEDIA_SLOTS = [
  ['hero', 'Fotografía principal de portada', 'Main cover photograph'],
  ['intro', 'Retrato editorial de presentación', 'Editorial introduction portrait'],
  ['about', 'Retrato de Estefanía', 'Portrait of Estefanía'],
  ['my-session', 'Imagen de la sección Mi sesión', 'My session section image'],
  ['products', 'Fotolibro o impresiones', 'Photobook or prints'],
  ['schools', 'Fotografía escolar', 'School photography'],
  ['business', 'Fotografía para negocio', 'Business photography'],
  ['tesoro', 'Retrato familiar para Tesoro', 'Family portrait for Tesoro'],
  ...SERVICES.map((s) => [`service:${s.slug}`, s.name.es, s.name.en]),
];

export function seed(db) {
  if (db.get('SELECT 1 FROM services LIMIT 1')) return false;
  const now = Date.now();
  db.tx(() => {
    for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) db.run('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)', k, JSON.stringify(v), now);
    for (const [k, v] of Object.entries({ ...DEFAULT_CONTENT, ...POLICIES })) for (const lang of ['es', 'en']) db.run('INSERT INTO content (key, lang, value, updated_at) VALUES (?, ?, ?, ?)', k, lang, v[lang], now);
    SERVICES.forEach((s, i) => {
      const { lastInsertRowid: sid } = db.run(
        'INSERT INTO services (slug, kind, name_es, name_en, summary_es, summary_en, sort) VALUES (?, ?, ?, ?, ?, ?, ?)',
        s.slug, s.kind, s.name.es, s.name.en, s.summary.es, s.summary.en, i
      );
      for (const p of s.packages) {
        const includes = p.includes || [];
        const inc = (lang) => JSON.stringify([
          ...includes.map((x) => x[lang]),
          ...(p.duration ? [lang === 'es' ? `${p.duration >= 120 ? p.duration / 60 + ' horas de cobertura' : p.duration + ' minutos'}` : `${p.duration >= 120 ? p.duration / 60 + ' hours of coverage' : p.duration + ' minutes'}`] : []),
          ...(p.photos ? [lang === 'es' ? `${p.photos} fotografías digitales finales` : `${p.photos} final edited digital photos`] : []),
        ]);
        db.run(
          `INSERT INTO package_versions (service_id, package_key, version, is_current, name_es, name_en, pricing, price_cents, unit_es, unit_en,
             duration_min, photos_included, video_minutes, includes_es, includes_en, delivery_days, notes_es, notes_en, created_at)
           VALUES (?, ?, 1, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          sid, p.key, p.name.es, p.name.en, p.pricing, p.price ?? null, p.unit?.es ?? null, p.unit?.en ?? null,
          p.duration ?? null, p.photos ?? null, p.videoMinutes ?? null, inc('es'), inc('en'), p.delivery ?? null,
          p.includesPending ? 'Contenido específico del paquete por definir.' : null,
          p.includesPending ? 'Specific package contents to be defined.' : null, now
        );
      }
      db.run('INSERT INTO questionnaires (service_id, version, is_current, fields, created_at) VALUES (?, 1, 1, ?, ?)', sid, JSON.stringify(s.fields), now);
    });
    // Extras sin precio: quedan pendientes de cotización si el cliente los solicita.
    db.run(`INSERT INTO extras (key, service_kinds, name_es, name_en, unit, price_cents) VALUES ('extra_photos', NULL, 'Fotografías adicionales', 'Additional photos', 'per_unit', NULL)`);
    db.run(`INSERT INTO extras (key, service_kinds, name_es, name_en, unit, price_cents) VALUES ('extra_hour', '["event","wedding"]', 'Hora adicional de cobertura', 'Additional coverage hour', 'per_hour', NULL)`);
    db.run(`INSERT INTO travel_zones (name, cities, price_cents, is_base) VALUES ('Querétaro', '["queretaro","santiago de queretaro"]', 0, 1)`);
    db.run(`INSERT INTO travel_zones (name, cities, price_cents, is_base) VALUES ('Irapuato', '["irapuato"]', 0, 1)`);
    for (const tpl of TEMPLATES) {
      db.run('INSERT INTO email_templates (key, lang, service_kind, subject, body, offset_days, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        tpl.key, tpl.lang, tpl.service_kind || null, tpl.subject, tpl.body, tpl.offset ?? null, now);
    }
    FAQS.forEach(([qe, ae, qn, an], i) => db.run('INSERT INTO faqs (q_es, a_es, q_en, a_en, sort) VALUES (?, ?, ?, ?, ?)', qe, ae, qn, an, i));
    PRODUCTS.forEach((p, i) => db.run(
      `INSERT INTO products (slug, kind, name_es, name_en, description_es, description_en, min_photos, max_photos, requires_design_review, status, sort)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)`, p.slug, p.kind, p.name.es, p.name.en, p.description.es, p.description.en, p.min, p.max, p.review, i));
    PORTFOLIO_CATEGORIES.forEach(([slug, es, en], i) => db.run('INSERT INTO portfolio_categories (slug, name_es, name_en, sort) VALUES (?, ?, ?, ?)', slug, es, en, i));
    for (const [slot, es, en] of MEDIA_SLOTS) db.run('INSERT INTO media (slot, alt_es, alt_en, is_demo, created_at) VALUES (?, ?, ?, 0, ?)', slot, es, en, now);
  });
  return true;
}
