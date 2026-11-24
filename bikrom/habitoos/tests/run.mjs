// Pruebas de aceptación de la fase 1 de Bikrom/HabitoOS. Uso: npm run habitoos:test
// Base temporal y reloj simulado; sin red ni datos reales.
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHabitoos } from '../index.mjs';
import * as H from '../domain/habits.mjs';
import { addDays } from '../lib/tz.mjs';

const dir = mkdtempSync(join(tmpdir(), 'hos-test-'));
let clock = Date.parse('2026-12-01T18:00:00Z'); // 12:00 en Ciudad de México
const env = { NODE_ENV: 'test', APP_SECRET: 'y'.repeat(40), SITE_URL: 'http://localhost' };
// CF_SHIM=1: misma prueba sobre la capa de Cloudflare (base del Durable Object)
const cf = process.env.CF_SHIM ? (await import('../../cloudflare/test-shim.mjs')).shim('habitoos') : {};
const { app, handle } = createHabitoos({ env, dataDir: dir, now: () => clock, ...cf });
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
