// Áreas de servicio. El color se usa EXCLUSIVAMENTE en los iconos.

export const areas = [
  {
    key: 'finanzas',
    name: 'Finanzas',
    color: '#16A34A',
    problem: 'Vendes, pero no sabes si el dinero te va a alcanzar el próximo mes.',
  },
  {
    key: 'rh',
    name: 'Recursos humanos',
    color: '#2563EB',
    problem: 'Nadie tiene claro qué hace, cuánto debe ganar ni cómo se le evalúa.',
  },
  {
    key: 'liderazgo',
    name: 'Liderazgo y dirección',
    color: '#7C3AED',
    problem: 'Todo pasa por ti porque tus jefes todavía no saben delegar.',
  },
  {
    key: 'reconocimiento',
    name: 'Reconocimiento y cultura',
    color: '#F59E0B',
    problem: 'Tu mejor gente se va y nadie sabe exactamente por qué.',
  },
  {
    key: 'operacion',
    name: 'Operación y eficiencia',
    color: '#EA580C',
    problem: 'Cada quien hace las cosas a su manera y los errores se repiten.',
  },
  {
    key: 'automatizacion',
    name: 'Automatización e IA',
    color: '#0891B2',
    problem: 'Tu equipo pasa horas copiando datos entre Excel, correo y WhatsApp.',
  },
];

// Grupo adicional del catálogo (no es un área): su icono va en negro.
export const packagesGroup = {
  key: 'paquetes',
  name: 'Paquetes y membresía',
  color: '#0A0A0A',
  problem: 'Combinaciones y suscripciones para avanzar en varias áreas a la vez.',
};

export const catalogGroups = [...areas, packagesGroup];

export const areaByKey = Object.fromEntries(catalogGroups.map((a) => [a.key, a]));

export const types = [
  { key: 'descargable', name: 'Descargable' },
  { key: 'curso', name: 'Curso' },
  { key: 'servicio', name: 'Servicio' },
  { key: 'mensual', name: 'Mensual' },
];
