// Catálogo del onboarding: categorías, plantillas de hábitos y barreras. Todo es editable por el usuario después.
const T = (es, en) => ({ es, en });

export const CATEGORIES = [
  ['health', T('Salud', 'Health'), '🩺'], ['nutrition', T('Nutrición', 'Nutrition'), '🥗'], ['exercise', T('Ejercicio', 'Exercise'), '🏃'],
  ['sleep', T('Sueño', 'Sleep'), '😴'], ['productivity', T('Productividad', 'Productivity'), '🗂️'], ['learning', T('Aprendizaje', 'Learning'), '📚'],
  ['relationships', T('Relaciones', 'Relationships'), '🤝'], ['finance', T('Finanzas', 'Finance'), '💰'], ['digital', T('Bienestar digital', 'Digital wellbeing'), '📱'],
  ['spirituality', T('Espiritualidad', 'Spirituality'), '🕊️'], ['lifestyle', T('Estilo de vida', 'Lifestyle'), '🌿'], ['custom', T('Personalizado', 'Custom'), '✨'],
];

// measure: binary | count | duration | range ; comparator según tipo
export const TEMPLATES = [
  // Desarrollar
  { key: 'exercise', kind: 'build', category: 'exercise', emoji: '🏋️', name: T('Hacer ejercicio', 'Exercise'), measure: 'duration', unit: T('min', 'min'), comparator: '>=', target: 30 },
  { key: 'walk', kind: 'build', category: 'exercise', emoji: '🚶', name: T('Caminar', 'Walk'), measure: 'count', unit: T('pasos', 'steps'), comparator: '>=', target: 7000 },
  { key: 'read', kind: 'build', category: 'learning', emoji: '📖', name: T('Leer', 'Read'), measure: 'count', unit: T('páginas', 'pages'), comparator: '>=', target: 15 },
  { key: 'study', kind: 'build', category: 'learning', emoji: '🎓', name: T('Estudiar', 'Study'), measure: 'duration', unit: T('min', 'min'), comparator: '>=', target: 30 },
  { key: 'vegetables', kind: 'build', category: 'nutrition', emoji: '🥬', name: T('Comer verduras', 'Eat vegetables'), measure: 'count', unit: T('porciones', 'servings'), comparator: '>=', target: 3 },
  { key: 'water', kind: 'build', category: 'health', emoji: '💧', name: T('Tomar agua', 'Drink water'), measure: 'count', unit: T('vasos', 'glasses'), comparator: '>=', target: 8 },
  { key: 'sleep', kind: 'build', category: 'sleep', emoji: '🌙', name: T('Dormir lo suficiente', 'Sleep enough'), measure: 'count', unit: T('horas', 'hours'), comparator: '>=', target: 7.5 },
  { key: 'meditate', kind: 'build', category: 'spirituality', emoji: '🧘', name: T('Meditar', 'Meditate'), measure: 'duration', unit: T('min', 'min'), comparator: '>=', target: 10 },
  { key: 'pray', kind: 'build', category: 'spirituality', emoji: '🙏', name: T('Orar', 'Pray'), measure: 'binary', comparator: 'done' },
  { key: 'save', kind: 'build', category: 'finance', emoji: '🐷', name: T('Ahorrar', 'Save money'), measure: 'binary', comparator: 'done' },
  { key: 'plan', kind: 'build', category: 'productivity', emoji: '🗓️', name: T('Planear el día', 'Plan the day'), measure: 'binary', comparator: 'done' },
  { key: 'family', kind: 'build', category: 'relationships', emoji: '👨‍👩‍👧', name: T('Tiempo en familia', 'Family time'), measure: 'duration', unit: T('min', 'min'), comparator: '>=', target: 30 },
  // Reducir o abandonar
  { key: 'smoking', kind: 'quit', category: 'health', emoji: '🚭', name: T('Dejar de fumar', 'Quit smoking'), measure: 'count', unit: T('cigarrillos', 'cigarettes'), comparator: '<=', target: 0 },
  { key: 'alcohol', kind: 'reduce', category: 'health', emoji: '🍷', name: T('Reducir alcohol', 'Reduce alcohol'), measure: 'count', unit: T('bebidas', 'drinks'), comparator: '<=', target: 1, safety: 'alcohol' },
  { key: 'social', kind: 'reduce', category: 'digital', emoji: '📵', name: T('Menos redes sociales', 'Less social media'), measure: 'duration', unit: T('min', 'min'), comparator: '<=', target: 60 },
  { key: 'added_sugar', kind: 'reduce', category: 'nutrition', emoji: '🍬', name: T('Menos azúcar añadida', 'Less added sugar'), measure: 'binary', comparator: 'done', hint: T('Cuenta solo azúcar añadida y postres; no fruta ni lácteos naturales.', 'Count only added sugar and desserts, not fruit or plain dairy.') },
  { key: 'sugary_drinks', kind: 'quit', category: 'nutrition', emoji: '🥤', name: T('Sin bebidas azucaradas', 'No sugary drinks'), measure: 'count', unit: T('bebidas', 'drinks'), comparator: '<=', target: 0 },
  { key: 'procrastination', kind: 'reduce', category: 'productivity', emoji: '⏳', name: T('Empezar la tarea importante', 'Start the key task'), measure: 'binary', comparator: 'done' },
  { key: 'impulse_buying', kind: 'reduce', category: 'finance', emoji: '🛍️', name: T('Sin compras impulsivas', 'No impulse purchases'), measure: 'count', unit: T('compras', 'purchases'), comparator: '<=', target: 0 },
  { key: 'phone', kind: 'reduce', category: 'digital', emoji: '📱', name: T('Menos tiempo de pantalla', 'Less screen time'), measure: 'duration', unit: T('min', 'min'), comparator: '<=', target: 120 },
  { key: 'late_bed', kind: 'reduce', category: 'sleep', emoji: '🛏️', name: T('Acostarme a tiempo', 'Go to bed on time'), measure: 'binary', comparator: 'done' },
];

export const BARRIERS = [
  ['time', T('Tiempo', 'Time')], ['energy', T('Energía', 'Energy')], ['stress', T('Estrés', 'Stress')], ['forgetting', T('Olvido', 'Forgetting')],
  ['preparation', T('Preparación', 'Preparation')], ['social', T('Entorno social', 'Social environment')], ['urges', T('Impulsos', 'Urges')],
  ['resources', T('Recursos', 'Resources')], ['other', T('Otra', 'Other')],
];

export const templateByKey = Object.fromEntries(TEMPLATES.map((t) => [t.key, t]));
export const categoryKeys = CATEGORIES.map((c) => c[0]);
export const barrierKeys = BARRIERS.map((b) => b[0]);

// Aviso de seguridad (sin diagnóstico ni prescripción)
export const SAFETY = {
  alcohol: T(
    'Si bebes a diario o en cantidades altas, suspender el alcohol de golpe puede ser peligroso. Habla con un profesional de la salud antes de dejarlo por completo.',
    'If you drink daily or heavily, stopping alcohol abruptly can be dangerous. Talk to a health professional before stopping completely.'
  ),
};
