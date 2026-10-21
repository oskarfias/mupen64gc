// Información de ejemplo para la VISTA PREVIA (config.preview = true).
// Cada marcador se sustituye por un texto neutral mientras no tenga dato real.
// Cuando llenes un dato en config.js o en el contenido, el dato real tiene prioridad.
// No contiene datos legales, números de teléfono ni personas inventadas.

export const mockConfig = {
  email: 'hola@bikrom.com',
};

export const mockText = {
  '[CORREO]': mockConfig.email,
  '[DOMINIO]': 'bikrom.com',
  '[RAZÓN SOCIAL]': 'Bikrom',
  '[RFC DE BIKROM]': 'por definir',
  '[DOMICILIO]': 'por definir',
  '[FECHA DE ÚLTIMA ACTUALIZACIÓN]': 'versión preliminar',
  '[REDES SOCIALES]': 'Próximamente',

  '[DEFINE TU GARANTÍA, por ejemplo reembolso si el diagnóstico no te da al menos tres acciones útiles]':
    'Si algo no sale como esperabas, escríbenos y lo resolvemos contigo',
  '[DEFINE LA DURACIÓN]': 'Se define en la propuesta según el tamaño de tu empresa',
  '[DEFINE LA DURACIÓN DE CADA SESIÓN]': 'duración por sesión según la propuesta',
  '[DEFINE EL PLAZO MÍNIMO DE CONTRATACIÓN]': 'Mensual; las condiciones se definen en la propuesta',
  '[DEFINE EL MONTO DE LA MENSUALIDAD]': 'según la propuesta',
  '[DEFINE TU POLÍTICA DE CANCELACIÓN]': 'condiciones al suscribirte',
  '[DEFINE TU POLÍTICA DE CANCELACIÓN DE LA MEMBRESÍA]': 'Las condiciones de cancelación se informan al suscribirte',
  '[DEFINE TU ESQUEMA DE PAGO DE PROYECTOS, por ejemplo anticipo y pagos por entregable]': 'se acuerdan en la propuesta',
  '[DEFINE TIEMPOS TÍPICOS POR TIPO DE PROYECTO]': 'te lo confirmamos en la llamada',
  '[PLAZO DE ENVÍO DE LA FACTURA]': 'cuanto se confirme tu pago',
  '[TIEMPO DE RESPUESTA]': 'poco tiempo',
  '[DÍA Y HORA DE LA SESIÓN GRUPAL MENSUAL]': 'El calendario de sesiones se comparte al suscribirte',
  '[PLATAFORMA DE VIDEOLLAMADA]': 'videollamada',
  '[PLATAFORMA DE LA COMUNIDAD]': 'una plataforma privada',
  '[PLATAFORMA DE CURSOS]': 'nuestra plataforma de cursos',

  '[FECHA DE PUBLICACIÓN]': 'Próximamente',
  '[DETALLE DE OBLIGACIONES — VALIDAR CON LA NORMA OFICIAL]': 'te explicamos el detalle para tu caso en una llamada.',
  '[VERIFICA LAS FUENTES OFICIALES Y AGREGA LOS ENLACES ANTES DE PUBLICAR]': '',
  '[TRADUCCIÓN AL INGLÉS PENDIENTE]': '',
  '[VALIDA CON TU CONTADOR LOS REGÍMENES Y USOS DEL CFDI QUE ACEPTAS]': '',

  // Textos legales (borradores)
  '[CONFIRMA FINALIDADES SECUNDARIAS]': '',
  '[LISTA DEFINITIVA DE PROVEEDORES]': '',
  '[PROCEDIMIENTO Y PLAZOS DE RESPUESTA]': '',
  '[DEFINE LOS ALCANCES DE LA LICENCIA]': '',
  '[CONDICIONES DE PROYECTOS: anticipos, cambios de alcance, confidencialidad]': 'Las condiciones particulares se establecen en cada propuesta.',
  '[PLAZO Y CONDICIONES PARA SOLICITAR FACTURA]': '',
  '[DEFINE LEGISLACIÓN APLICABLE Y JURISDICCIÓN]': 'Por definir.',
  '[DEFINE SI HAY REEMBOLSO EN DESCARGABLES, por ejemplo solo si el archivo está dañado o no corresponde a la descripción]': 'Por definir.',
  '[DEFINE PLAZO Y CONDICIONES DE REEMBOLSO DE CURSOS]': 'Por definir.',
  '[DEFINE CONDICIONES DE CANCELACIÓN Y REEMBOLSO DE PROYECTOS, por ejemplo según entregables completados]': 'Por definir.',
  '[PLAZO DE RESPUESTA Y FORMA DE DEVOLUCIÓN]': '',
};
