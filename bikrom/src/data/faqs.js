import { config } from '../config.js';

// Preguntas frecuentes generales (Inicio). Las respuestas con marcadores deben completarse.
export const homeFaqs = [
  {
    q: '¿Trabajan con empresas de mi tamaño?',
    a: 'Sí. Trabajamos con pymes mexicanas de 10 a 100 empleados y ajustamos el alcance y el precio de cada proyecto al tamaño de tu empresa.',
  },
  {
    q: '¿Cómo se paga?',
    a: 'Los descargables, cursos y la membresía se pagan en línea con tarjeta, OXXO o transferencia. Los proyectos se pagan según el calendario de la propuesta: [DEFINE TU ESQUEMA DE PAGO DE PROYECTOS, por ejemplo anticipo y pagos por entregable].',
  },
  {
    q: '¿Facturan?',
    a: 'Sí. Al pagar capturas tus datos fiscales (RFC, razón social, régimen fiscal, código postal fiscal y uso del CFDI) y te enviamos tu factura por correo en [PLAZO DE ENVÍO DE LA FACTURA].',
  },
  {
    q: '¿Trabajan en línea o presencial?',
    a: `Presencial en ${config.contact.city} y en línea en todo México.`,
  },
  {
    q: '¿Cuánto tarda un proyecto?',
    a: 'Depende del alcance y del tamaño de tu empresa; el tiempo queda por escrito en la propuesta, junto con el precio. Referencia general: [DEFINE TIEMPOS TÍPICOS POR TIPO DE PROYECTO].',
  },
  {
    q: '¿Qué pasa si no quedo satisfecho?',
    a: `${config.legal.guarantee}. Consulta los detalles en la Política de reembolsos.`,
  },
];

// Preguntas frecuentes de la plantilla de producto (se ajustan según el tipo).
export function productFaqs(p) {
  const out = [];
  const hasBuy = p.pricing.options.some((o) => o.kind === 'buy');
  const hasRange = p.pricing.options.some((o) => o.kind === 'range' || o.kind === 'percent' || o.kind === 'quote');
  const hasDownload = p.pricing.options.some((o) => o.delivery === 'download');
  const hasCourse = p.pricing.options.some((o) => o.delivery === 'course');
  if (hasRange) {
    out.push({
      q: '¿Cómo se define el precio final?',
      a: 'En una llamada de 30 minutos revisamos tu caso y te enviamos una propuesta con alcance, tiempos y precio fijo antes de empezar. El precio nunca cambia a mitad del proyecto sin tu autorización por escrito.',
    });
  }
  if (hasDownload) {
    out.push({
      q: '¿Cómo recibo el descargable?',
      a: 'En cuanto se confirma tu pago recibes un correo con tu enlace personal de descarga. Con tarjeta es inmediato; con OXXO o transferencia, al acreditarse el pago.',
    });
  }
  if (hasCourse) {
    out.push({
      q: '¿Cómo accedo al curso?',
      a: 'Al confirmarse tu pago te enviamos por correo tus datos de acceso a la plataforma del curso: [PLATAFORMA DE CURSOS].',
    });
  }
  if (hasBuy) {
    out.push({
      q: '¿Qué formas de pago aceptan?',
      a: 'Tarjeta de crédito o débito, pago en efectivo en OXXO y transferencia. Todos los precios son más IVA.',
    });
  }
  out.push({
    q: '¿Me dan factura?',
    a: 'Sí. Captura tus datos fiscales al pagar o envíalos al aceptar la propuesta y te enviamos tu CFDI por correo.',
  });
  out.push({
    q: '¿Trabajan en línea o presencial?',
    a: `Presencial en ${config.contact.city} y en línea en todo México.`,
  });
  return out;
}
