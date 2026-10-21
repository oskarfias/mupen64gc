// Diagnóstico Empresa 360: 20 afirmaciones sobre prácticas observables, 5 por área.
// Escala: 1 = Totalmente en desacuerdo … 5 = Totalmente de acuerdo.

export const scale = [
  { value: 1, label: 'Totalmente en desacuerdo' },
  { value: 2, label: 'En desacuerdo' },
  { value: 3, label: 'Ni de acuerdo ni en desacuerdo' },
  { value: 4, label: 'De acuerdo' },
  { value: 5, label: 'Totalmente de acuerdo' },
];

// iconArea: área del catálogo cuyo icono (y color) representa a esta área del diagnóstico.
export const diagAreas = [
  { key: 'finanzas', name: 'Finanzas', iconArea: 'finanzas', recommendations: ['flujo-de-efectivo-13-semanas', 'cfo-externo'] },
  { key: 'personas', name: 'Personas', iconArea: 'rh', recommendations: ['nom-035-llave-en-mano', 'estructura-y-sueldos', 'escuela-de-lideres'] },
  { key: 'procesos', name: 'Procesos', iconArea: 'operacion', recommendations: ['mapeo-y-rediseno-de-procesos', 'manual-de-procedimientos'] },
  { key: 'tecnologia', name: 'Tecnología', iconArea: 'automatizacion', recommendations: ['diagnostico-de-automatizacion', 'bot-de-whatsapp'] },
];

export const questions = [
  // Finanzas
  { id: 'f1', area: 'finanzas', text: 'Sé cuánto dinero tendré en caja en las próximas 13 semanas.' },
  { id: 'f2', area: 'finanzas', text: 'Recibo mi estado de resultados del mes en los primeros 10 días del mes siguiente.' },
  { id: 'f3', area: 'finanzas', text: 'Conozco el margen de utilidad de cada producto o servicio que vendo.' },
  { id: 'f4', area: 'finanzas', text: 'Tengo un presupuesto anual y cada mes lo comparo contra lo real.' },
  { id: 'f5', area: 'finanzas', text: 'Las cuentas de la empresa están separadas de mis gastos personales.' },
  // Personas
  { id: 'p1', area: 'personas', text: 'Cada puesto tiene indicadores claros.' },
  { id: 'p2', area: 'personas', text: 'Tenemos organigrama y descriptivos de puesto por escrito y actualizados.' },
  { id: 'p3', area: 'personas', text: 'Los sueldos siguen un tabulador con criterios definidos.' },
  { id: 'p4', area: 'personas', text: 'Evaluamos el desempeño al menos una vez al año con un formato establecido.' },
  { id: 'p5', area: 'personas', text: 'Tenemos la carpeta de evidencias de la NOM-035 completa y al día.' },
  // Procesos
  { id: 'o1', area: 'procesos', text: 'Nuestros procesos clave están documentados y cualquier persona nueva puede seguirlos.' },
  { id: 'o2', area: 'procesos', text: 'Cada proceso tiene un responsable con nombre y apellido.' },
  { id: 'o3', area: 'procesos', text: 'Revisamos indicadores operativos cada semana en una junta corta con acuerdos por escrito.' },
  { id: 'o4', area: 'procesos', text: 'Sé en qué parte de la operación se generan retrasos y retrabajos, y cuánto me cuestan.' },
  { id: 'o5', area: 'procesos', text: 'Llevamos un registro de entradas y salidas de cada persona que podemos consultar en cualquier momento.' },
  // Tecnología
  { id: 't1', area: 'tecnologia', text: 'Las tareas repetitivas, como reportes, recordatorios de cobranza o facturas, se generan sin capturarlas a mano.' },
  { id: 't2', area: 'tecnologia', text: 'Todos los prospectos y clientes están registrados en un solo sistema, no en hojas o teléfonos personales.' },
  { id: 't3', area: 'tecnologia', text: 'Los mensajes de clientes por WhatsApp reciben respuesta aunque sea fuera del horario de oficina.' },
  { id: 't4', area: 'tecnologia', text: 'Mi equipo usa herramientas de inteligencia artificial con reglas de uso por escrito.' },
  { id: 't5', area: 'tecnologia', text: 'Puedo consultar ventas, operación y finanzas en un tablero sin pedir que me armen un reporte.' },
];

export const employeeRanges = ['1 a 9', '10 a 25', '26 a 50', '51 a 100', 'Más de 100'];

// Calcula puntajes (0 a 100) y elige tres recomendaciones:
// dos del área más baja y una de la segunda más baja.
export function scoreDiagnostic(answers, productBySlug) {
  const byArea = diagAreas.map((a) => {
    const qs = questions.filter((q) => q.area === a.key);
    const vals = qs.map((q) => Number(answers[q.id])).filter((v) => v >= 1 && v <= 5);
    const avg = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 1;
    return { key: a.key, name: a.name, iconArea: a.iconArea, score: Math.round(((avg - 1) / 4) * 100) };
  });
  const overall = Math.round(byArea.reduce((s, a) => s + a.score, 0) / byArea.length);
  const order = diagAreas.map((a) => a.key);
  const sorted = [...byArea].sort((x, y) => x.score - y.score || order.indexOf(x.key) - order.indexOf(y.key));
  const pick = [];
  const recsFor = (key) => diagAreas.find((a) => a.key === key).recommendations;
  for (const slug of recsFor(sorted[0].key).slice(0, 2)) pick.push({ slug, area: sorted[0].key });
  pick.push({ slug: recsFor(sorted[1].key)[0], area: sorted[1].key });
  const recommendations = pick.map(({ slug, area }) => {
    const p = productBySlug[slug];
    return { slug, area, name: p.name, promise: p.promise, url: p.href || `/soluciones/${p.slug}/` };
  });
  return { overall, areas: byArea, recommendations };
}

export const answersComplete = (answers) => questions.every((q) => [1, 2, 3, 4, 5].includes(Number(answers?.[q.id])));
