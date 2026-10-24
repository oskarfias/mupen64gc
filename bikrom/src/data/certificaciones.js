// Certificaciones disponibles.
// available: false → se muestra "Próximamente" y la inscripción queda deshabilitada (también en el servidor).
// Cambia a true solo cuando se cuente con la acreditación o alianza que la opción requiere.
// icon: área cuyo icono (y color) representa la opción.

export const DC3_NOTE =
  'Las constancias DC-3 acreditan la capacitación laboral de quien aprueba el curso; no certifican el cumplimiento de una NOM por parte de la empresa.';

export const certificaciones = [
  {
    slug: 'cert-nom-035',
    title: 'Riesgos psicosociales y ambiente laboral',
    norms: 'NOM-035',
    icon: 'rh',
    description:
      'Capacitación en prevención de riesgos psicosociales, violencia laboral y promoción de un entorno organizacional favorable.',
    document: 'Constancia de habilidades laborales DC-3, conforme a los requisitos aplicables.',
    dc3: true,
    available: true,
  },
  {
    slug: 'cert-seguridad-y-salud',
    title: 'Seguridad y salud en el trabajo',
    norms: 'NOM-019, NOM-030 y NOM-002',
    icon: 'operacion',
    description:
      'Capacitación en comisiones de seguridad e higiene, servicios preventivos y prevención y protección contra incendios.',
    document: 'Constancia DC-3 por curso aprobado, conforme a los requisitos aplicables.',
    dc3: true,
    available: true,
  },
  {
    slug: 'cert-ergonomia-epp-teletrabajo',
    title: 'Ergonomía, equipo de protección personal y teletrabajo',
    norms: 'NOM-036-1, NOM-017 y NOM-037',
    icon: 'operacion',
    description:
      'Capacitación en manejo manual de cargas, selección y uso de equipo de protección personal y condiciones seguras de teletrabajo.',
    document: 'Constancia DC-3 por curso aprobado, conforme a los requisitos aplicables.',
    dc3: true,
    available: true,
  },
  {
    slug: 'cert-lean-six-sigma',
    title: 'Lean Six Sigma',
    norms: 'Yellow Belt y Green Belt',
    icon: 'operacion',
    description: 'Formación en mejora continua, reducción de desperdicios y solución de problemas.',
    document:
      'Certificación externa sujeta a evaluación y a la disponibilidad de una alianza con el organismo certificador correspondiente.',
    dc3: false,
    available: false, // Pendiente: alianza con el organismo certificador
  },
  {
    slug: 'cert-conocer',
    title: 'Competencias laborales',
    norms: 'CONOCER',
    icon: 'rh',
    description:
      'Formación y evaluación en funciones como ventas, atención al cliente y formación de instructores, según los estándares habilitados.',
    document: 'Certificado oficial de competencia mediante un prestador acreditado, sujeto a evaluación.',
    dc3: false,
    available: false, // Pendiente: prestador acreditado
  },
];

export const certBySlug = Object.fromEntries(certificaciones.map((c) => [c.slug, c]));
