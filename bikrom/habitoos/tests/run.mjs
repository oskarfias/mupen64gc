// Pruebas de aceptación de la fase 1 de Bikrom/HabitoOS. Uso: npm run habitoos:test
// Base temporal y reloj simulado; sin red ni datos reales.
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHabitoos } from '../index.mjs';
import * as H from '../domain/habits.mjs';
import { addDays } from '../lib/tz.mjs';
import { createHmac } from 'node:crypto';
import { resetLimit } from '../../photography/lib/http.mjs';

const dir = mkdtempSync(join(tmpdir(), 'hos-test-'));
let clock = Date.parse('2026-12-01T18:00:00Z'); // 12:00 en Ciudad de México
const env = { NODE_ENV: 'test', APP_SECRET: 'y'.repeat(40), SITE_URL: 'http://localhost', HABITOOS_STRIPE_SECRET_KEY: 'sk_test_local', HABITOOS_STRIPE_WEBHOOK_SECRET: 'whsec_hos_local' };
// CF_SHIM=1: misma prueba sobre la capa de Cloudflare (base del Durable Object)
const cf = process.env.CF_SHIM ? (await import('../../cloudflare/test-shim.mjs')).shim('habitoos') : {};
const { app, handle, runJobs } = createHabitoos({ env, dataDir: dir, now: () => clock, worker: false, ...cf });
const server = createServer(handle).listen(0);
const B = `http://localhost:${server.address().port}/habitoos`;

let passed = 0;
const failures = [];
async function test(name, fn) {
  try { await fn(); passed++; console.log(`✓ ${name}`); } catch (e) { failures.push(name); console.log(`✗ ${name}\n   ${e.stack.split('\n').slice(0, 3).join('\n   ')}`); }
}
const assert = (c, m) => { if (!c) throw new Error(m); };
const eq = (a, b, m) => assert(a === b, `${m}: esperado ${JSON.stringify(b)}, obtenido ${JSON.stringify(a)}`);
const origLog = console.log;

// Cliente HTTP con cookie y CSRF, como un navegador
async function client(email, password = 'contrasena-segura-1', { timezone = 'America/Mexico_City', lang = 'es' } = {}) {
  for (const ip of ['::1', '127.0.0.1', '::ffff:127.0.0.1']) resetLimit(`hos-reg:${ip}`); // el límite por IP se prueba aparte
  console.log = () => {}; // el correo sin proveedor se imprime en desarrollo
  const r = await fetch(`${B}/registro`, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ email, password, terms: '1', lang, timezone }) });
  console.log = origLog;
  assert(r.status === 303, `registro ${r.status}`);
  const cookie = r.headers.get('set-cookie').split(';')[0];
  const page = await (await fetch(`${B}/onboarding`, { headers: { cookie } })).text();
  const csrf = page.match(/name="csrf" content="([^"]+)"/)[1];
  const call = async (method, path, body) => {
    const res = await fetch(`${B}/api/v1${path}`, { method, headers: { cookie, 'X-CSRF': csrf, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  };
  const me = (await call('GET', '/me')).body;
  return { cookie, csrf, call, me, user: () => ({ ...app.db.get('SELECT u.id, p.* FROM users u JOIN profiles p ON p.user_id = u.id WHERE u.id = ?', me.id), id: me.id }) };
}
const habit = (kind, measure, goal, extra = {}) => ({ name: `${kind} ${measure}`, kind, measure, category: 'health', unit: measure === 'duration' ? 'min' : 'u', goal, days: [1, 2, 3, 4, 5, 6, 7], ...extra });

let A, Bc;

await test('Registro → onboarding → primer hábito → Today (ES y EN)', async () => {
  A = await client('ana@ejemplo.mx');
  eq(A.me.timezone, 'America/Mexico_City', 'zona del navegador guardada');
  await A.call('PUT', '/onboarding', { step: 6, categories: ['exercise'], build: ['exercise', 'read'], reduce: ['social'], priority: ['exercise', 'social'], plans: { exercise: { target: 30, days: [1, 2, 3, 4, 5, 6, 7] }, social: { target: 60, days: [1, 2, 3, 4, 5, 6, 7] } } });
  const s = await A.call('GET', '/onboarding');
  eq(s.body.step, 6, 'progreso reanudable');
  const done = await A.call('POST', '/onboarding/complete');
  eq(done.status, 200, 'onboarding completado'); eq(done.body.habits.length, 2, 'dos hábitos creados');
  const again = await A.call('POST', '/onboarding/complete');
  eq(again.body.habits.join(), done.body.habits.join(), 'repetir el paso no duplica hábitos');
  eq(app.db.get('SELECT COUNT(*) n FROM habits WHERE owner_id = ?', A.me.id).n, 2, 'sin duplicados en la base');
  const today = await fetch(`${B}/app/today`, { headers: { cookie: A.cookie } });
  const html = await today.text();
  assert(html.includes('Hacer ejercicio') && html.includes('Al menos 30 min'), 'Today muestra el hábito y su meta');
  const en = await client('bob@example.com', 'another-password-1', { lang: 'en', timezone: 'Europe/Madrid' });
  await en.call('POST', '/habits', habit('build', 'binary', { comparator: 'done' }, { name: 'Read' }));
  const enHtml = await (await fetch(`${B}/app/today`, { headers: { cookie: en.cookie } })).text();
  assert(enHtml.includes('lang="en"') && enHtml.includes('Today') && enHtml.includes('Read'), 'interfaz en inglés');
  Bc = en;
});

await test('El registro persiste tras recargar y desde otra sesión', async () => {
  const [h] = (await A.call('GET', '/habits')).body.habits;
  const d = A.me.today;
  const r = await A.call('PUT', `/habits/${h.id}/log/${d}`, { value: 35, requestId: 'r-1' });
  eq(r.body.status, 'done', '35 ≥ 30 cumplido');
  const login = await fetch(`${B}/entrar`, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ email: 'ana@ejemplo.mx', password: 'contrasena-segura-1' }) });
  const other = login.headers.get('set-cookie').split(';')[0];
  assert(other !== A.cookie, 'segunda sesión');
  const daily = await (await fetch(`${B}/api/v1/daily/${d}`, { headers: { cookie: other } })).json();
  eq(daily.items.find((i) => i.habit_id === h.id).value, 35, 'mismo dato en otro dispositivo');
});

await test('Aislamiento: un usuario no ve ni modifica datos de otro (404)', async () => {
  const [hA] = (await A.call('GET', '/habits')).body.habits;
  eq((await Bc.call('GET', `/habits/${hA.id}`)).status, 404, 'leer hábito ajeno');
  eq((await Bc.call('PATCH', `/habits/${hA.id}`, { name: 'hack' })).status, 404, 'editar hábito ajeno');
  eq((await Bc.call('PUT', `/habits/${hA.id}/log/${A.me.today}`, { value: 1 })).status, 404, 'registrar en hábito ajeno');
  eq((await Bc.call('POST', `/habits/${hA.id}/log/${A.me.today}/undo`)).status, 404, 'deshacer en hábito ajeno');
  const page = await fetch(`${B}/app/habits/${hA.id}`, { headers: { cookie: Bc.cookie } });
  eq(page.status, 404, 'página de hábito ajeno');
  eq(app.db.get('SELECT name FROM habits WHERE id = ?', hA.id).name, 'Hacer ejercicio', 'sin cambios');
  eq((await fetch(`${B}/api/v1/habits`, { method: 'POST', headers: { cookie: A.cookie, 'Content-Type': 'application/json' }, body: '{}' })).status, 403, 'escritura sin CSRF rechazada');
});

await test('Metas versionadas: cambiar 20 → 30 min no reescribe la historia', async () => {
  const u = A.user();
  const start = addDays(H.today(app, u), -12);
  clock -= 12 * 864e5;
  const id = H.createHabit(app, A.user(), habit('build', 'duration', { comparator: '>=', target: 20 }, { name: 'Meditar' }));
  const b2 = null;
  for (let i = 0; i < 9; i++) { H.logOccurrence(app, A.user(), id, addDays(start, i), { value: 25 }); clock += 864e5; }
  clock += 3 * 864e5;
  const change = addDays(start, 9);
  H.changeGoal(app, A.user(), id, { comparator: '>=', target: 30 }, change);
  H.logOccurrence(app, A.user(), id, addDays(start, 9), { value: 25 });
  const before = H.occurrenceView(app, H.ownHabit(app, A.me.id, id), addDays(start, 3));
  const after = H.occurrenceView(app, H.ownHabit(app, A.me.id, id), addDays(start, 9));
  eq(before.status, 'done', 'día 4 sigue cumplido con la meta de 20'); eq(before.goal.target, 20, 'meta histórica');
  eq(after.status, 'partial', 'día 10 se evalúa con la meta de 30'); eq(after.goal.target, 30, 'meta nueva');
  eq(app.db.get('SELECT COUNT(*) n FROM habit_goal_versions WHERE habit_id = ?', id).n, 2, 'dos versiones');
  H.updateHabit(app, A.user(), id, { status: 'archived' });
});

await test('Tres días sin registro = "sin registro", no "no cumplido"', async () => {
  const u = Bc.user();
  const id = H.createHabit(app, u, habit('build', 'binary', { comparator: 'done' }, { name: 'Caminar' }));
  const first = H.today(app, u);
  H.logOccurrence(app, u, id, first, { status: 'done' });
  clock += 4 * 864e5;
  const m = H.metrics(app, Bc.user(), first, H.today(app, Bc.user()), { habitId: id });
  const h = m.habits[0];
  eq(h.counts.done, 1, 'un cumplido'); eq(h.counts.no_data, 3, 'tres sin registro'); eq(h.counts.missed, 0, 'ninguno se convirtió en incumplido');
  eq(h.adherence, 100, 'la adherencia no se castiga por no registrar'); eq(h.adherence_n, 1, 'denominador = evaluables');
  eq(h.coverage, 25, 'la cobertura refleja los días sin registro'); eq(h.coverage_n, 4, 'denominador de cobertura');
});

await test('Descanso, pausa y "no aplica" no penalizan', async () => {
  const u = Bc.user();
  const id = H.createHabit(app, u, habit('build', 'binary', { comparator: 'done' }, { name: 'Estudiar' }));
  const d0 = H.today(app, u);
  H.logOccurrence(app, u, id, d0, { status: 'done' });
  clock += 864e5; H.addRestDay(app, Bc.user(), id, H.today(app, Bc.user()));
  clock += 864e5; H.logOccurrence(app, Bc.user(), id, H.today(app, Bc.user()), { status: 'not_applicable' });
  clock += 864e5; H.logOccurrence(app, Bc.user(), id, H.today(app, Bc.user()), { status: 'missed' });
  const h = H.metrics(app, Bc.user(), d0, H.today(app, Bc.user()), { habitId: id }).habits[0];
  eq(h.counts.paused, 1, 'día de descanso'); eq(h.counts.not_applicable, 1, 'no aplica');
  eq(h.adherence, 50, '1 de 2 evaluables'); eq(h.coverage, 100, 'descanso y no aplica fuera del denominador');
});

await test('Reintento idempotente y deshacer', async () => {
  const u = Bc.user();
  const first = (await Bc.call('GET', '/habits')).body.habits.find((h) => h.status === 'active');
  await Bc.call('PATCH', `/habits/${first.id}`, { status: 'archived' }); // libera un lugar del plan Free
  const id = (await Bc.call('POST', '/habits', habit('reduce', 'duration', { comparator: '<=', target: 60 }, { name: 'Redes' }))).body.id;
  const d = H.today(app, u);
  await Bc.call('PUT', `/habits/${id}/log/${d}`, { value: 50, requestId: 'same-req' });
  await Bc.call('PUT', `/habits/${id}/log/${d}`, { value: 50, requestId: 'same-req' });
  eq(app.db.get('SELECT COUNT(*) n FROM habit_logs l JOIN habit_occurrences o ON o.id = l.occurrence_id WHERE o.habit_id = ?', id).n, 1, 'un solo registro por reintento');
  const r2 = await Bc.call('PUT', `/habits/${id}/log/${d}`, { value: 75, requestId: 'req-2' });
  eq(r2.body.status, 'missed', '75 > 60: no cumplido');
  const undo = await Bc.call('POST', `/habits/${id}/log/${d}/undo`);
  eq(undo.body.value, 50, 'deshacer restaura el valor anterior'); eq(undo.body.status, 'done', 'y su estado');
  const undo2 = await Bc.call('POST', `/habits/${id}/log/${d}/undo`);
  eq(undo2.body.status, 'pending', 'deshacer el primero vuelve a "pendiente"');
});

await test('Zonas horarias: "hoy" según cada usuario; cambiar de zona no mueve el pasado', async () => {
  clock = Date.parse('2026-12-20T05:30:00Z'); // 23:30 del 19 en México; 06:30 del 20 en Madrid
  eq(H.today(app, A.user()), '2026-12-19', 'México'); eq(H.today(app, Bc.user()), '2026-12-20', 'Madrid');
  const [hA] = app.db.all("SELECT * FROM habits WHERE owner_id = ? AND status = 'active' ORDER BY created_at", A.me.id);
  H.logOccurrence(app, A.user(), hA.id, '2026-12-19', { value: hA.measure === 'binary' ? null : 40, status: hA.measure === 'binary' ? 'done' : null });
  let futureRejected = false;
  try { H.logOccurrence(app, A.user(), hA.id, '2026-12-20', { value: 40 }); } catch (e) { futureRejected = e.code === 'invalid_date'; }
  assert(futureRejected, 'no se registra un día que aún no llega en su zona');
  app.db.run("UPDATE profiles SET timezone = 'Asia/Tokyo' WHERE user_id = ?", A.me.id);
  const o = app.db.get("SELECT * FROM habit_occurrences WHERE habit_id = ? AND local_date = '2026-12-19'", hA.id);
  eq(o.timezone, 'America/Mexico_City', 'el registro conserva su fecha y zona originales');
  eq(H.today(app, A.user()), '2026-12-20', 'el día actual usa la zona nueva');
  app.db.run("UPDATE profiles SET timezone = 'America/Mexico_City' WHERE user_id = ?", A.me.id);
});

await test('Límite Free de 3 hábitos activos en el backend', async () => {
  const C = await client('carla@ejemplo.mx');
  for (let i = 1; i <= 3; i++) eq((await C.call('POST', '/habits', habit('build', 'binary', { comparator: 'done' }, { name: `H${i}` }))).status, 201, `hábito ${i}`);
  const fourth = await C.call('POST', '/habits', habit('build', 'binary', { comparator: 'done' }, { name: 'H4' }));
  eq(fourth.status, 402, 'el cuarto se rechaza'); eq(fourth.body.error, 'free_limit', 'código');
  const [h1] = (await C.call('GET', '/habits')).body.habits;
  await C.call('PATCH', `/habits/${h1.id}`, { status: 'archived' });
  eq((await C.call('POST', '/habits', habit('build', 'binary', { comparator: 'done' }, { name: 'H4' }))).status, 201, 'archivando uno se libera el lugar');
  eq((await C.call('PATCH', `/habits/${h1.id}`, { status: 'active' })).status, 402, 'reactivar respeta el límite');
});

await test('Corregir un registro histórico recalcula los indicadores', async () => {
  const u = A.user();
  const id = H.createHabit(app, { ...u, id: A.me.id }, habit('build', 'count', { comparator: '>=', target: 10 }, { name: 'Leer' }));
  const d = H.today(app, A.user());
  H.logOccurrence(app, A.user(), id, d, { value: 5 });
  const before = H.metrics(app, A.user(), d, d, { habitId: id }).habits[0];
  eq(before.counts.partial, 1, 'parcial');
  H.logOccurrence(app, A.user(), id, d, { value: 12 });
  const after = H.metrics(app, A.user(), d, d, { habitId: id }).habits[0];
  eq(after.counts.done, 1, 'tras corregir: cumplido'); eq(after.adherence, 100, 'adherencia recalculada');
});

await test('Exportación completa y eliminación de cuenta', async () => {
  const exp = await fetch(`${B}/api/v1/export`, { headers: { cookie: Bc.cookie } });
  const data = await exp.json();
  assert(data.habits.length >= 3 && data.occurrences.length > 0 && data.goal_versions.length > 0, 'JSON con hábitos, metas y registros');
  assert(data.habits.every((h) => h.owner_id === Bc.me.id), 'solo datos propios');
  const csv = await (await fetch(`${B}/api/v1/export.csv`, { headers: { cookie: Bc.cookie } })).text();
  assert(csv.includes('date,habit,kind'), 'CSV');
  const del = await fetch(`${B}/app/settings/eliminar`, { method: 'POST', redirect: 'manual', headers: { cookie: Bc.cookie, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ _csrf: Bc.csrf, password: 'another-password-1' }) });
  eq(del.status, 303, 'cuenta eliminada');
  eq(app.db.get('SELECT COUNT(*) n FROM habits WHERE owner_id = ?', Bc.me.id).n, 0, 'hábitos borrados');
  eq(app.db.get('SELECT COUNT(*) n FROM habit_occurrences WHERE owner_id = ?', Bc.me.id).n, 0, 'registros borrados');
  eq(app.db.get('SELECT COUNT(*) n FROM audit_events WHERE actor_id = ?', Bc.me.id).n, 0, 'auditoría seudonimizada');
  eq((await fetch(`${B}/api/v1/me`, { headers: { cookie: Bc.cookie } })).status, 401, 'la sesión deja de funcionar');
});

await test('Reflexión opcional: obstáculos por hábito y fecha, cifrada, sin penalizar ni insistir', async () => {
  clock = Date.parse('2026-12-21T18:00:00Z'); // 12:00 en Ciudad de México
  const U = await client('rosa@ejemplo.mx');
  const W = await client('victor@ejemplo.mx');
  const h1 = (await U.call('POST', '/habits', habit('build', 'binary', { comparator: 'done' }))).body.id;
  const h2 = (await U.call('POST', '/habits', habit('build', 'count', { comparator: '>=', target: 10 }, { name: 'Leer' }))).body.id;
  const d = U.me.today;
  const todayHtml = async () => (await fetch(`${B}/app/today`, { headers: { cookie: U.cookie } })).text();
  const form = (body) => fetch(`${B}/app/reflexion`, { method: 'POST', redirect: 'manual', headers: { cookie: U.cookie, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ _csrf: U.csrf, d, ...body }) });
  assert(!(await todayHtml()).includes('reflect-cta'), 'a mediodía y sin tropiezos no se sugiere');
  await U.call('PUT', `/habits/${h1}/log/${d}`, { status: 'missed' });
  assert((await todayHtml()).includes('reflect-cta'), 'tras un no cumplido se sugiere (opcional)');
  const m0 = JSON.stringify((await U.call('GET', '/analytics/adherence')).body.overall);
  eq((await form({ action: 'dismiss' })).status, 303, '"Ahora no"');
  assert(!(await todayHtml()).includes('reflect-cta'), 'tras "Ahora no" ya no insiste');
  eq(JSON.stringify((await U.call('GET', '/analytics/adherence')).body.overall), m0, 'omitir la reflexión no cambia indicadores');
  const r = await U.call('PUT', `/reviews/${d}`, { mood: 2, note: 'Llegué tarde del trabajo', intention_if: 'llego tarde', intention_then: 'hago 5 minutos',
    obstacles: [{ habit_id: h1, key: 'time' }, { habit_id: h1, key: 'energy' }, { habit_id: null, key: 'stress' }, { habit_id: h1, key: 'inventado' }, { habit_id: h1, key: 'time' }] });
  eq(r.status, 200, 'reflexión guardada'); eq(r.body.review.obstacles.length, 3, 'solo claves del catálogo, sin duplicados');
  eq(r.body.review.note, 'Llegué tarde del trabajo', 'nota legible para su dueña');
  const raw = app.db.get('SELECT note_enc, intention_if_enc FROM daily_reviews WHERE owner_id = ?', U.me.id);
  assert(raw.note_enc && !raw.note_enc.includes('tarde') && !raw.intention_if_enc.includes('tarde'), 'nota e intención cifradas en la base');
  eq(JSON.stringify((await U.call('GET', '/analytics/adherence')).body.overall), m0, 'guardar la reflexión no cambia indicadores');
  const st = (await U.call('GET', '/analytics/obstacles')).body;
  eq(st.obstacles_n, 3, 'obstáculos contados'); eq(st.habits[0].habit_id, h1, 'vinculados al hábito'); eq(st.mood_avg, 2, 'ánimo promedio'); eq(st.reviews_n, 1, 'días con reflexión');
  const ins = await (await fetch(`${B}/app/insights`, { headers: { cookie: U.cookie } })).text();
  assert(ins.includes('Obstáculos y ánimo') && ins.includes('Tiempo'), 'Indicadores muestran obstáculos');
  // Aislamiento
  eq((await W.call('PUT', `/reviews/${d}`, { obstacles: [{ habit_id: h1, key: 'time' }] })).status, 404, 'no se vinculan obstáculos a hábitos ajenos');
  eq((await W.call('GET', `/reviews/${d}`)).body.review, null, 'no se ven reflexiones ajenas');
  eq((await W.call('GET', '/analytics/obstacles')).body.obstacles_n, 0, 'estadísticas solo del usuario correcto');
  eq((await U.call('PUT', `/reviews/${addDays(d, 1)}`, { mood: 3 })).status, 400, 'no se reflexiona sobre días futuros');
  eq((await U.call('PUT', `/reviews/${addDays(d, -40)}`, { mood: 3 })).status, 402, 'Free: solo los últimos 30 días');
  // Formulario HTML (ES) y corrección
  const page = await (await fetch(`${B}/app/reflexion`, { headers: { cookie: U.cookie } })).text();
  assert(page.includes('Cierre del día') && page.includes('value="' + h1 + '|time" checked'), 'formulario con lo guardado');
  eq((await form({ action: 'save', mood: '4', 'ob[]': `${h1}|forgetting`, note: '' })).status, 303, 'corrección por formulario');
  const st2 = (await U.call('GET', '/analytics/obstacles')).body;
  eq(st2.obstacles_n, 1, 'la corrección recalcula'); eq(st2.obstacles[0].key, 'forgetting', 'obstáculo actualizado'); eq(st2.mood_avg, 4, 'ánimo actualizado');
  const ex = await (await fetch(`${B}/api/v1/export`, { headers: { cookie: U.cookie } })).json();
  eq(ex.reviews.length, 1, 'la exportación incluye reflexiones');
  // Día cumplido por completo: no insiste
  await U.call('DELETE', `/reviews/${d}`);
  await U.call('PUT', `/habits/${h1}/log/${d}`, { status: 'done' });
  await U.call('PUT', `/habits/${h2}/log/${d}`, { value: 12 });
  const ok = await todayHtml();
  assert(!ok.includes('reflect-cta') && ok.includes('Agregar una nota'), 'éxito total: solo un enlace discreto');
  // Tarde con pendientes: se sugiere
  const saved = clock;
  clock = Date.parse(`${addDays(d, 1)}T01:30:00Z`); // 19:30 en Ciudad de México, mismo día local
  const h3 = (await U.call('POST', '/habits', habit('build', 'binary', { comparator: 'done' }, { name: 'Meditar' }))).body.id;
  assert((await todayHtml()).includes('reflect-cta'), 'por la tarde con pendientes se sugiere');
  clock = saved;
  await U.call('PATCH', `/habits/${h3}`, { status: 'archived' });
  // Eliminar la cuenta borra reflexiones y obstáculos
  const del = await fetch(`${B}/app/settings/eliminar`, { method: 'POST', redirect: 'manual', headers: { cookie: U.cookie, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ _csrf: U.csrf, password: 'contrasena-segura-1' }) });
  eq(del.status, 303, 'cuenta eliminada');
  eq(app.db.get('SELECT COUNT(*) n FROM daily_reviews WHERE owner_id = ?', U.me.id).n, 0, 'reflexiones borradas');
  eq(app.db.get('SELECT COUNT(*) n FROM review_obstacles WHERE owner_id = ?', U.me.id).n, 0, 'obstáculos borrados');
});

await test('Tendencias por semana, línea base y recálculo tras corrección', async () => {
  clock = Date.parse('2027-01-04T18:00:00Z'); // lunes 4 de enero, 12:00 en México
  const U = await client('tendencias@ejemplo.mx');
  const id = (await U.call('POST', '/habits', habit('build', 'duration', { comparator: '>=', target: 20 }, { name: 'Correr' }))).body.id;
  const start = U.me.today;
  // 5 semanas: semanas 1-2 cumple 3 de 7 días (resto no cumplido); semanas 3-5 cumple todos.
  for (let i = 0; i < 35; i++) {
    const d = addDays(start, i);
    const done = i >= 14 || i % 7 < 3;
    H.logOccurrence(app, U.user(), id, d, { value: done ? 25 : 5 });
    clock += 864e5;
  }
  // 35 días después la sesión de 30 días venció: se vuelve a entrar
  const li = await fetch(`${B}/entrar`, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ email: 'tendencias@ejemplo.mx', password: 'contrasena-segura-1' }) });
  U.cookie = li.headers.get('set-cookie').split(';')[0];
  U.csrf = (await (await fetch(`${B}/app/today`, { headers: { cookie: U.cookie } })).text()).match(/name="csrf" content="([^"]+)"/)[1];
  U.call = async (method, path, body) => { const r = await fetch(`${B}/api/v1${path}`, { method, headers: { cookie: U.cookie, 'X-CSRF': U.csrf, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, body: await r.json().catch(() => ({})) }; };
  const tr = (await U.call('GET', `/analytics/trends?from=${start}&to=${addDays(start, 34)}`)).body;
  eq(tr.bucket, 'week', 'agrupado por semana');
  eq(tr.history_limited, true, 'Free: el periodo se recorta a 30 días');
  const pro = app.id();
  app.db.run("INSERT INTO entitlements (id, owner_id, feature, source, valid_until, created_at) VALUES (?, ?, 'pro', 'admin_grant', NULL, ?)", pro, U.me.id, app.iso());
  const t2 = (await U.call('GET', `/analytics/trends?from=${start}&to=${addDays(start, 34)}`)).body;
  eq(t2.history_limited, false, 'Pro: historial completo');
  const h = t2.habits[0];
  eq(h.series.length, 5, 'cinco semanas');
  eq(h.series[0].adherence, 42.9, 'semana 1: 3/7'); eq(h.series[0].adherence_n, 7, 'n semana 1');
  eq(h.series[4].adherence, 100, 'semana 5: 7/7');
  eq(h.series[0].value_avg, Math.round(((3 * 25 + 4 * 5) / 7) * 10) / 10, 'promedio del valor (resultado)');
  eq(h.comparison.available, true, 'comparación disponible');
  eq(h.comparison.baseline.adherence, 42.9, 'línea base = primeros 14 días'); eq(h.comparison.recent.adherence, 100, 'recientes 14 días');
  eq(h.comparison.adherence_diff, 57.1, 'cambio en puntos');
  // Corrección histórica: la semana 1 se recalcula
  H.logOccurrence(app, U.user(), id, addDays(start, 3), { value: 30 });
  const t3 = (await U.call('GET', `/analytics/trends?from=${start}&to=${addDays(start, 34)}`)).body;
  eq(t3.habits[0].series[0].adherence, 57.1, 'la corrección recalcula la tendencia (4/7)');
  const m = (await U.call('GET', `/analytics/trends?from=${start}&to=${addDays(start, 34)}&bucket=month`)).body;
  eq(m.bucket, 'month', 'agrupado por mes'); eq(m.habits[0].series.length, 2, 'enero y febrero');
  const html = await (await fetch(`${B}/app/insights?r=90`, { headers: { cookie: U.cookie } })).text();
  assert(html.includes('<svg') && html.includes('Línea base'), 'Indicadores con gráfica y línea base');
  const V2 = await client('ajeno@ejemplo.mx');
  eq((await V2.call('GET', '/analytics/trends')).body.habits.length, 0, 'tendencias solo del usuario correcto');
});

await test('Pro: consentimiento, precio del servidor, webhook idempotente, cancelación y datos conservados', async () => {
  clock = Date.parse('2027-03-01T18:00:00Z');
  // Stripe de prueba (sin red)
  const subs = new Map();
  let lastCheckout = null;
  app.billing.createCheckout = async (a) => { lastCheckout = a; return { url: `https://checkout.stripe.test/${a.attemptId}`, ref: `cs_${a.attemptId}` }; };
  app.billing.getSubscription = async (id) => subs.get(id);
  app.billing.setCancelAtPeriodEnd = async (id, v) => { const x = { ...subs.get(id), cancel_at_period_end: v }; subs.set(id, x); return x; };
  const hook = (ev, secret = 'whsec_hos_local') => {
    const raw = JSON.stringify(ev); const ts = Math.floor(Date.now() / 1000);
    const sig = createHmac('sha256', secret).update(`${ts}.${raw}`).digest('hex');
    return fetch(`${B}/api/webhooks/stripe`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'stripe-signature': `t=${ts},v1=${sig}` }, body: raw });
  };
  const U = await client('pro@ejemplo.mx');
  for (const n of ['A', 'B', 'C']) await U.call('POST', '/habits', habit('build', 'binary', { comparator: 'done' }, { name: n }));
  eq((await U.call('POST', '/habits', habit('build', 'binary', { comparator: 'done' }, { name: 'D' }))).status, 402, 'Free: 4.º hábito bloqueado');
  const planHtml = await (await fetch(`${B}/app/plan`, { headers: { cookie: U.cookie } })).text();
  assert(planHtml.includes('39.99') && planHtml.includes('4.99') && planHtml.includes('name="consent"'), 'precios configurables y casilla de consentimiento');
  eq((await U.call('POST', '/billing/checkout', { plan: 'pro_yearly' })).status, 400, 'sin consentimiento no hay cobro');
  const form = await fetch(`${B}/app/plan/checkout`, { method: 'POST', redirect: 'manual', headers: { cookie: U.cookie, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ _csrf: U.csrf, plan: 'pro_yearly', consent: '1', amount: '1' }) });
  eq(form.status, 303, 'redirige al pago'); assert(form.headers.get('location').startsWith('https://checkout.stripe.test/'), 'a Stripe');
  eq(lastCheckout.amountCents, 3999, 'el precio sale del servidor, no del navegador'); eq(lastCheckout.interval, 'year', 'anual');
  eq((await U.call('GET', '/billing')).body.pro, false, 'sin webhook no se activa');
  const periodEnd = Math.floor(clock / 1000) + 365 * 86400;
  subs.set('sub_1', { id: 'sub_1', customer: 'cus_1', status: 'active', cancel_at_period_end: false, metadata: { user_id: U.me.id, plan: 'pro_yearly' }, items: { data: [{ current_period_end: periodEnd, price: { unit_amount: 3999, currency: 'usd', recurring: { interval: 'year' } } }] } });
  const ev = { id: 'evt_1', type: 'checkout.session.completed', data: { object: { mode: 'subscription', subscription: 'sub_1', client_reference_id: U.me.id, metadata: { plan: 'pro_yearly' } } } };
  eq((await hook(ev, 'otro_secreto')).status, 400, 'firma inválida rechazada');
  eq((await (await hook(ev)).json()).result, 'processed', 'webhook procesado');
  eq((await (await hook(ev)).json()).result, 'duplicate', 'el mismo evento no se procesa dos veces');
  eq(app.db.get("SELECT COUNT(*) n FROM entitlements WHERE owner_id = ? AND source = 'subscription'", U.me.id).n, 1, 'un solo permiso');
  eq((await U.call('GET', '/billing')).body.pro, true, 'Pro activo');
  eq((await U.call('POST', '/habits', habit('build', 'binary', { comparator: 'done' }, { name: 'D' }))).status, 201, 'Pro: más de 3 hábitos');
  eq((await U.call('POST', '/billing/checkout', { plan: 'pro_monthly', consent: true })).status, 409, 'no se compra dos veces');
  // Cancelar: conserva Pro hasta el final del periodo
  const c = await U.call('POST', '/billing/cancel');
  eq(c.body.subscription.cancel_at_period_end, true, 'cancelación al final del periodo'); eq(c.body.pro, true, 'sigue siendo Pro');
  assert((await (await fetch(`${B}/app/plan`, { headers: { cookie: U.cookie } })).text()).includes('Pro termina el'), 'la página muestra la fecha de fin');
  // Fin del periodo pagado: vuelve a Free sin borrar datos
  clock = (periodEnd + 3600) * 1000;
  eq(H.isPro(app, U.me.id), false, 'tras el periodo pagado ya no es Pro');
  eq(app.db.get('SELECT COUNT(*) n FROM habits WHERE owner_id = ?', U.me.id).n, 4, 'los 4 hábitos se conservan');
  // Aviso final del proveedor
  const del = { id: 'evt_2', type: 'customer.subscription.deleted', data: { object: { ...subs.get('sub_1'), status: 'canceled' } } };
  eq((await (await hook(del)).json()).result, 'processed', 'baja procesada');
  eq(app.db.get('SELECT status FROM subscriptions WHERE provider_subscription_id = ?', 'sub_1').status, 'canceled', 'estado del proveedor guardado');
  // Evento de un usuario inexistente: se ignora sin error
  subs.set('sub_x', { ...subs.get('sub_1'), id: 'sub_x', metadata: { user_id: 'no-existe' } });
  eq((await hook({ id: 'evt_3', type: 'invoice.paid', data: { object: { subscription: 'sub_x' } } })).status, 200, 'usuario inexistente ignorado');
  const ex = await (await fetch(`${B}/api/v1/export`, { headers: { cookie: (await (async () => { const li = await fetch(`${B}/entrar`, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ email: 'pro@ejemplo.mx', password: 'contrasena-segura-1' }) }); return li.headers.get('set-cookie').split(';')[0]; })()) } })).json();
  eq(ex.subscriptions.length, 1, 'la exportación incluye la suscripción');
});

await test('Recordatorios: opt-in, hora local, sin duplicados, nada si ya se registró, baja en un clic', async () => {
  clock = Date.parse('2027-05-03T13:00:00Z'); // 07:00 en México
  const U = await client('recuerda@ejemplo.mx');
  const sent = [];
  const realMail = app.mail;
  app.mail = { configured: true, send: async (m) => { sent.push(m); return 'id'; } };
  try {
  const set = (body) => fetch(`${B}/app/settings/recordatorios`, { method: 'POST', redirect: 'manual', headers: { cookie: U.cookie, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ _csrf: U.csrf, ...body }) });
  eq((await set({ enabled: '1' })).status, 400, 'sin correo verificado no se activan');
  app.db.run('UPDATE users SET email_verified_at = ? WHERE id = ?', app.iso(), U.me.id);
  eq((await set({ enabled: '1', digest_time: '20:00' })).status, 303, 'activados con resumen a las 20:00');
  const a = (await U.call('POST', '/habits', habit('build', 'binary', { comparator: 'done' }, { name: 'Vitaminas', time: '08:00' }))).body.id;
  const b = (await U.call('POST', '/habits', habit('build', 'binary', { comparator: 'done' }, { name: 'Estirar', time: '08:00' }))).body.id;
  const c = (await U.call('POST', '/habits', habit('build', 'binary', { comparator: 'done' }, { name: 'Leer' }))).body.id;
  await runJobs(); eq(sent.length, 0, 'antes de la hora no se envía');
  clock = Date.parse('2027-05-03T14:10:00Z'); // 08:10
  await runJobs(); eq(sent.length, 1, 'un correo para la franja de las 08:00');
  assert(sent[0].subject.includes('2') && sent[0].text.includes('Vitaminas') && sent[0].text.includes('Estirar') && !sent[0].text.includes('Leer'), 'agrupa los hábitos de esa hora');
  assert(sent[0].text.includes('/recordatorios/baja?u='), 'incluye enlace de baja');
  await runJobs(); eq(sent.length, 1, 'sin duplicados en la misma franja');
  clock = Date.parse('2027-05-04T14:05:00Z'); // día siguiente 08:05; "Vitaminas" ya registrado
  await U.call('PUT', `/habits/${a}/log/2027-05-04`, { status: 'done' });
  await runJobs(); eq(sent.length, 2, 'nuevo día, nuevo recordatorio');
  assert(!sent[1].text.includes('Vitaminas') && sent[1].text.includes('Estirar'), 'no recuerda lo ya registrado');
  clock = Date.parse('2027-05-04T16:30:00Z'); // 10:30: fuera de la ventana
  await runJobs(); eq(sent.length, 2, 'fuera de la ventana no se envía tarde');
  clock = Date.parse('2027-05-05T02:15:00Z'); // 20:15 del 4: resumen
  await runJobs(); eq(sent.length, 3, 'resumen diario');
  assert(sent[2].text.includes('Leer') && sent[2].text.includes('Estirar') && !sent[2].text.includes('Vitaminas'), 'resumen solo con pendientes');
  // Baja en un clic
  const link = sent[2].text.match(/(http\S+recordatorios\/baja\S+)/)[1].replace('http://localhost/habitoos', B);
  eq((await fetch(link.replace(/s=[^&]+/, 's=falso'))).status, 200, 'enlace alterado');
  eq(app.db.get('SELECT reminders_email FROM profiles WHERE user_id = ?', U.me.id).reminders_email, 1, 'una firma falsa no da de baja');
  await fetch(link);
  eq(app.db.get('SELECT reminders_email FROM profiles WHERE user_id = ?', U.me.id).reminders_email, 0, 'baja con un clic');
  clock = Date.parse('2027-05-05T14:10:00Z');
  await runJobs(); eq(sent.length, 3, 'tras la baja no llegan más');
  } finally { app.mail = realMail; }
});

await test('Identidad: contraseña incorrecta, recuperación y sesiones revocadas', async () => {
  const bad = await fetch(`${B}/entrar`, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ email: 'ana@ejemplo.mx', password: 'mal' }) });
  eq(bad.status, 401, 'rechazada');
  console.log = () => {};
  const { requestReset, resetPassword } = await import('../domain/auth.mjs');
  // Captura el enlace (sin proveedor de correo, se imprime en desarrollo)
  let link = '';
  console.log = (m) => { link += m; };
  await requestReset(app, 'ana@ejemplo.mx');
  console.log = origLog;
  const token = link.match(/restablecer\?t=([\w-]+)/)[1];
  resetPassword(app, token, 'nueva-contrasena-segura');
  eq((await fetch(`${B}/api/v1/me`, { headers: { cookie: A.cookie } })).status, 401, 'las sesiones anteriores se cierran al restablecer');
  let reused = false;
  try { resetPassword(app, token, 'otra-contrasena-segura'); } catch { reused = true; }
  assert(reused, 'el enlace es de un solo uso');
  const ok = await fetch(`${B}/entrar`, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ email: 'ana@ejemplo.mx', password: 'nueva-contrasena-segura' }) });
  eq(ok.status, 303, 'entra con la contraseña nueva');
});

server.close();
rmSync(dir, { recursive: true, force: true });
console.log(`\n${passed} pruebas superadas${failures.length ? `, ${failures.length} fallidas: ${failures.join('; ')}` : ''}.`);
process.exit(failures.length ? 1 : 0);
