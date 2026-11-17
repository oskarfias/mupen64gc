// Configuración del negocio: servicios y paquetes (versionados), cuestionarios, extras, viáticos, descuentos,
// tienda, contenido e imágenes, testimonios, preguntas frecuentes, portafolio, correos y ajustes.
import { json as jparse } from '../../db.mjs';
import { A, table, csrfField, pesos, input, textarea, select, checkbox, statusTag, STATUS, mxn, esc, when } from './ui.mjs';
import { pesosToCents } from '../../lib/money.mjs';
import { zonedToUtc, isDate, formatDateTime, localDate } from '../../lib/time.mjs';
import { DEFAULT_SETTINGS, DEFAULT_CONTENT } from '../../seed.mjs';
import { POLICIES } from '../../policies.mjs';

const lines = (s) => String(s || '').split('\n').map((x) => x.trim()).filter(Boolean);
const csvList = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);
const num = (v) => (v === '' || v == null ? null : Number.isFinite(Number(v)) ? Number(v) : null);
const KINDS = [['session', 'Sesión'], ['event', 'Evento'], ['wedding', 'Boda'], ['school', 'Escuela'], ['business', 'Negocio'], ['tesoro', 'Tesoro']];

// ───────────── Servicios y paquetes ─────────────
function catalog({ app, render, csrf }) {
  const services = app.db.all('SELECT * FROM services ORDER BY sort');
  const extras = app.db.all('SELECT * FROM extras ORDER BY id');
  const zones = app.db.all('SELECT * FROM travel_zones ORDER BY id');
  const discounts = app.db.all('SELECT * FROM discounts ORDER BY created_at DESC');
  const body = `${services.map((s) => {
    const pk = app.db.all('SELECT * FROM package_versions WHERE service_id = ? AND is_current = 1 ORDER BY id', s.id);
    return `<div class="a-card"><h2>${esc(s.name_es)} ${s.active ? '' : '<span class="tag">Inactivo</span>'}</h2>
      ${table([['Paquete', (p) => `<a href="${A(app, `/catalogo/paquetes/${p.id}`)}">${esc(p.name_es)}</a> <small>v${p.version}</small>`], ['Precio', (p) => p.pricing === 'quote' ? 'Cotización' : `${mxn(p.price_cents)}${p.unit_es ? ' ' + esc(p.unit_es) : ''}`],
        ['Duración', (p) => (p.duration_min ? `${p.duration_min} min` : '<em>Por definir</em>')], ['Fotos', (p) => p.photos_included ?? '—'], ['Entrega', (p) => (p.delivery_days ? `${p.delivery_days} días` : 'Acordada')]], pk)}
      <p class="a-row"><a class="btn" href="${A(app, `/catalogo/servicios/${s.id}`)}">Editar servicio y cuestionario</a><a class="btn" href="${A(app, `/catalogo/paquetes/nuevo?servicio=${s.id}`)}">Agregar paquete</a></p></div>`;
  }).join('')}
  <div class="a-card" id="extras"><h2>Extras</h2><p class="small muted">Sin precio, un extra solicitado deja la cotización pendiente y nunca se cobra automáticamente.</p>
    <form method="post" action="${A(app, '/catalogo/extras')}" class="a-form">${csrfField(csrf)}
    ${extras.map((e) => `<div class="a-inline"><strong>${esc(e.name_es)}</strong> <small>(${e.unit === 'per_hour' ? 'por hora' : e.unit === 'per_unit' ? 'por unidad' : 'fijo'})</small>${pesos(`price_${e.id}`, e.price_cents, { label: 'Precio' })}${checkbox(`active_${e.id}`, e.active, { label: 'Activo' })}</div>`).join('')}
    <button class="btn btn--solid">Guardar extras</button></form></div>
  <div class="a-card" id="viaticos"><h2>Viáticos por zona</h2><p class="small muted">Precio 0 = incluido (ciudad base). Vacío = se cotiza manualmente. Ciudades fuera de toda zona también se cotizan.</p>
    ${table([['Zona', (z) => esc(z.name)], ['Ciudades', (z) => esc(jparse(z.cities, []).join(', '))], ['Precio', (z) => (z.price_cents == null ? 'Por cotizar' : z.price_cents === 0 ? 'Incluido' : mxn(z.price_cents))],
      ['', (z) => `<details><summary>Editar</summary><form method="post" action="${A(app, `/catalogo/viaticos/${z.id}`)}" class="a-form">${csrfField(csrf)}${input('name', z.name, { label: 'Nombre' })}${input('cities', jparse(z.cities, []).join(', '), { label: 'Ciudades (separadas por coma)' })}${pesos('price', z.price_cents, { label: 'Precio' })}${checkbox('active', z.active, { label: 'Activa' })}<button class="btn">Guardar</button></form></details>`]], zones)}
    <details><summary>Agregar zona</summary><form method="post" action="${A(app, '/catalogo/viaticos/nueva')}" class="a-form">${csrfField(csrf)}${input('name', '', { label: 'Nombre', required: true })}${input('cities', '', { label: 'Ciudades (separadas por coma)', required: true })}${pesos('price', null, { label: 'Precio' })}<button class="btn btn--solid">Agregar</button></form></details></div>
  <div class="a-card" id="descuentos"><h2>Promociones y códigos</h2>
    ${table([['Código', (d) => esc(d.code)], ['Descuento', (d) => (d.kind === 'percent' ? `${d.value}%` : mxn(d.value))], ['Vigencia', (d) => `${d.valid_from ? localDate(d.valid_from) : '—'} a ${d.valid_to ? localDate(d.valid_to) : '—'}`], ['Usos', (d) => `${d.uses}${d.max_uses != null ? ' / ' + d.max_uses : ''}`], ['Activo', (d) => (d.active ? 'Sí' : 'No')],
      ['', (d) => `<form method="post" action="${A(app, `/catalogo/descuentos/${d.id}/alternar`)}">${csrfField(csrf)}<button class="btn">${d.active ? 'Desactivar' : 'Activar'}</button></form>`]], discounts, { empty: 'Sin códigos.' })}
    <details><summary>Crear código</summary><form method="post" action="${A(app, '/catalogo/descuentos')}" class="a-form">${csrfField(csrf)}
      <div class="a-inline">${input('code', '', { label: 'Código', required: true })}${select('kind', 'percent', [['percent', 'Porcentaje'], ['fixed', 'Importe fijo']], { label: 'Tipo' })}${input('value', '', { label: 'Valor (% o pesos)', required: true })}</div>
      <div class="a-inline">${input('from', '', { label: 'Desde', type: 'date' })}${input('to', '', { label: 'Hasta', type: 'date' })}${input('max_uses', '', { label: 'Usos máximos', type: 'number' })}${pesos('min_subtotal', null, { label: 'Subtotal mínimo' })}</div>
      <fieldset><legend class="small">Servicios (vacío = todos)</legend>${KINDS.map(([k, l]) => checkbox(`kind_${k}`, false, { label: l })).join('')}</fieldset>
      <button class="btn btn--solid">Crear</button></form></details></div>`;
  return render('Servicios y precios', body);
}

function serviceEdit({ app, render, params, csrf }) {
  const s = app.db.get('SELECT * FROM services WHERE id = ?', Number(params[0]));
  const q = app.db.get('SELECT * FROM questionnaires WHERE service_id = ? AND is_current = 1', s.id);
  const body = `<form method="post" action="${A(app, `/catalogo/servicios/${s.id}`)}" class="a-form a-card">${csrfField(csrf)}
    <div class="a-cols"><div>${input('name_es', s.name_es, { label: 'Nombre' })}${textarea('summary_es', s.summary_es, { label: 'Resumen', rows: 2 })}</div>
    <div>${input('name_en', s.name_en, { label: 'Nombre (inglés)' })}${textarea('summary_en', s.summary_en, { label: 'Resumen (inglés)', rows: 2 })}</div></div>
    <div class="a-inline">${input('sort', s.sort, { label: 'Orden', type: 'number' })}${checkbox('active', s.active, { label: 'Visible y reservable' })}</div>
    <button class="btn btn--solid">Guardar servicio</button></form>
  <form method="post" action="${A(app, `/catalogo/servicios/${s.id}/cuestionario`)}" class="a-form a-card">${csrfField(csrf)}<h2>Cuestionario (versión ${q?.version || 1})</h2>
    <p class="small muted">Lista JSON de campos. Tipos: text, textarea, number, date, time, select, checkboxes, groups. Opcionales: required, min, default, options [[valor, etiqueta, label]], showIf [campo, valor], extra (clave de extra) e included (unidades incluidas).
    Guardar crea una nueva versión; las cotizaciones anteriores conservan sus respuestas.</p>
    <textarea name="fields" rows="18" class="a-input" style="font-family:ui-monospace,monospace;font-size:.85rem">${esc(JSON.stringify(jparse(q?.fields, []), null, 2))}</textarea>
    <button class="btn btn--solid">Guardar nueva versión</button></form>`;
  return render(s.name_es, body, { path: '/catalogo' });
}

function packageForm({ app, render, params, csrf, url }) {
  const p = params[0] === 'nuevo' ? null : app.db.get('SELECT * FROM package_versions WHERE id = ?', Number(params[0]));
  const serviceId = p?.service_id || Number(url.searchParams.get('servicio'));
  const s = app.db.get('SELECT * FROM services WHERE id = ?', serviceId);
  const used = p ? app.db.get('SELECT COUNT(*) n FROM quotes WHERE package_version_id = ?', p.id).n : 0;
  const history = p ? app.db.all('SELECT * FROM package_versions WHERE package_key = ? ORDER BY version DESC', p.package_key) : [];
  const body = `<form method="post" action="${A(app, `/catalogo/paquetes/${p ? p.id : 'nuevo'}`)}" class="a-form a-card">${csrfField(csrf)}<input type="hidden" name="service_id" value="${serviceId}">
    ${when(used, `<p class="a-flash">Esta versión ya se usó en ${used} cotización(es). Al guardar se crea la versión ${p?.version + 1}; las reservas existentes conservan sus precios.</p>`)}
    <div class="a-cols"><div>${input('name_es', p?.name_es, { label: 'Nombre', required: true })}${input('unit_es', p?.unit_es, { label: 'Unidad (p. ej. “por alumno”)' })}${textarea('includes_es', jparse(p?.includes_es, []).join('\n'), { label: 'Qué incluye (uno por línea)', rows: 5 })}${textarea('notes_es', p?.notes_es, { label: 'Notas', rows: 2 })}</div>
    <div>${input('name_en', p?.name_en, { label: 'Nombre (inglés)', required: true })}${input('unit_en', p?.unit_en, { label: 'Unidad (inglés)' })}${textarea('includes_en', jparse(p?.includes_en, []).join('\n'), { label: 'Qué incluye (inglés)', rows: 5 })}${textarea('notes_en', p?.notes_en, { label: 'Notas (inglés)', rows: 2 })}</div></div>
    <div class="a-inline">${select('pricing', p?.pricing || 'fixed', [['fixed', 'Precio fijo'], ['per_unit', 'Por unidad'], ['quote', 'Cotización personalizada']], { label: 'Tipo de precio' })}
      ${pesos('price', p?.price_cents ?? null, { label: 'Precio' })}${input('duration_min', p?.duration_min ?? '', { label: 'Duración (minutos)', type: 'number', help: 'Vacío = por definir (la cotización queda pendiente).' })}</div>
    <div class="a-inline">${input('photos_included', p?.photos_included ?? '', { label: 'Fotografías finales', type: 'number' })}${input('video_minutes', p?.video_minutes ?? '', { label: 'Minutos de video final', type: 'number' })}${input('delivery_days', p?.delivery_days ?? '', { label: 'Entrega (días)', type: 'number', help: 'Vacío = fecha acordada.' })}</div>
    <div class="a-row"><button class="btn btn--solid">Guardar</button>${p ? `<button class="btn btn--danger" name="retire" value="1" data-confirm="¿Retirar este paquete? Ya no se ofrecerá; las reservas existentes no cambian.">Retirar paquete</button>` : ''}</div></form>
  ${when(history.length > 1, `<div class="a-card"><h2>Historial de versiones</h2>${table([['Versión', (h) => h.version], ['Precio', (h) => mxn(h.price_cents)], ['Duración', (h) => h.duration_min ?? '—'], ['Creada', (h) => formatDateTime(h.created_at)], ['Actual', (h) => (h.is_current ? 'Sí' : '')]], history)}</div>`)}`;
  return render(p ? `Paquete: ${p.name_es}` : `Nuevo paquete · ${s.name_es}`, body, { path: '/catalogo' });
}

function packageSave({ app, form, params, back }) {
  const id = params[0] === 'nuevo' ? null : Number(params[0]);
  const prev = id ? app.db.get('SELECT * FROM package_versions WHERE id = ?', id) : null;
  if (prev && form.retire === '1') {
    app.db.run('UPDATE package_versions SET is_current = 0 WHERE id = ?', id);
    app.log('admin', 'paquete_retirado', { details: prev.name_es });
    return back('/catalogo', 'Paquete retirado.');
  }
  const data = {
    name_es: String(form.name_es || '').trim(), name_en: String(form.name_en || '').trim(),
    pricing: ['fixed', 'per_unit', 'quote'].includes(form.pricing) ? form.pricing : 'fixed', price_cents: pesosToCents(form.price),
    unit_es: form.unit_es || null, unit_en: form.unit_en || null, duration_min: num(form.duration_min), photos_included: num(form.photos_included), video_minutes: num(form.video_minutes),
    includes_es: JSON.stringify(lines(form.includes_es)), includes_en: JSON.stringify(lines(form.includes_en)), delivery_days: num(form.delivery_days), notes_es: form.notes_es || null, notes_en: form.notes_en || null,
  };
  if (!data.name_es || !data.name_en) throw new Error('El nombre en ambos idiomas es obligatorio.');
  const used = prev && app.db.get('SELECT 1 FROM quotes WHERE package_version_id = ?', prev.id);
  const cols = Object.keys(data);
  app.db.tx(() => {
    if (prev && !used) {
      app.db.run(`UPDATE package_versions SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, ...cols.map((c) => data[c]), prev.id);
    } else {
      const key = prev?.package_key || `p${Date.now().toString(36)}`;
      const version = prev ? (app.db.get('SELECT MAX(version) v FROM package_versions WHERE package_key = ?', key).v || 0) + 1 : 1;
      if (prev) app.db.run('UPDATE package_versions SET is_current = 0 WHERE package_key = ?', key);
      app.db.run(`INSERT INTO package_versions (service_id, package_key, version, is_current, ${cols.join(', ')}, created_at) VALUES (?, ?, ?, 1, ${cols.map(() => '?').join(', ')}, ?)`,
        Number(form.service_id), key, version, ...cols.map((c) => data[c]), app.now());
    }
  });
  app.log('admin', 'paquete_guardado', { details: `${data.name_es} ${mxn(data.price_cents)}` });
  return back('/catalogo', 'Paquete guardado.');
}

function questionnaireSave({ app, form, params, back }) {
  let fields;
  try { fields = JSON.parse(form.fields); } catch { throw new Error('El cuestionario no es un JSON válido.'); }
  const types = ['text', 'textarea', 'number', 'date', 'time', 'select', 'checkboxes', 'groups'];
  if (!Array.isArray(fields) || fields.some((f) => !f || !/^[a-z_]{1,40}$/.test(f.name) || !types.includes(f.type) || !f.label_es)) throw new Error('Cada campo necesita name (minúsculas y guion bajo), type válido y label_es.');
  const sid = Number(params[0]);
  app.db.tx(() => {
    const v = (app.db.get('SELECT MAX(version) v FROM questionnaires WHERE service_id = ?', sid).v || 0) + 1;
    app.db.run('UPDATE questionnaires SET is_current = 0 WHERE service_id = ?', sid);
    app.db.run('INSERT INTO questionnaires (service_id, version, is_current, fields, created_at) VALUES (?, ?, 1, ?, ?)', sid, v, JSON.stringify(fields), app.now());
  });
  app.log('admin', 'cuestionario_guardado', { details: `servicio ${sid}` });
  return back(`/catalogo/servicios/${sid}`, 'Nueva versión del cuestionario guardada.');
}

// ───────────── Tienda ─────────────
function shop({ app, render, csrf }) {
  const products = app.db.all('SELECT * FROM products ORDER BY sort');
  const rules = app.db.all('SELECT * FROM shipping_rules ORDER BY id');
  const body = `<p class="small muted">Un producto solo se muestra en las galerías cuando está activo y tiene al menos una variante con precio. Completa tamaños, materiales, precios y proveedores reales antes de activarlo.</p>
  ${products.map((p) => {
    const vs = app.db.all('SELECT * FROM product_variants WHERE product_id = ? ORDER BY id', p.id);
    return `<div class="a-card"><h2>${esc(p.name_es)} ${statusTag(p.status, STATUS)}</h2>
    <form method="post" action="${A(app, `/tienda/productos/${p.id}`)}" class="a-form">${csrfField(csrf)}
      <div class="a-cols"><div>${input('name_es', p.name_es, { label: 'Nombre' })}${textarea('description_es', p.description_es, { label: 'Descripción', rows: 2 })}</div><div>${input('name_en', p.name_en, { label: 'Nombre (inglés)' })}${textarea('description_en', p.description_en, { label: 'Descripción (inglés)', rows: 2 })}</div></div>
      <div class="a-inline">${input('min_photos', p.min_photos, { label: 'Fotos mínimas', type: 'number' })}${input('max_photos', p.max_photos, { label: 'Fotos máximas', type: 'number' })}${select('status', p.status, [['draft', 'Borrador'], ['active', 'Activo'], ['archived', 'Archivado']], { label: 'Estado' })}${checkbox('review', p.requires_design_review, { label: 'Incluye revisión de diseño antes de producir' })}</div>
      <button class="btn btn--solid">Guardar producto</button></form>
    <h3 class="small">Variantes</h3>
    ${table([['Tamaño', (v) => esc(v.size_label)], ['Medidas', (v) => (v.width_cm ? `${v.width_cm}×${v.height_cm} cm` : '—')], ['Acabado', (v) => esc(v.finish_es || '')], ['Precio', (v) => (v.price_cents == null ? '<em>Sin precio</em>' : mxn(v.price_cents))], ['Activa', (v) => (v.active ? 'Sí' : 'No')],
      ['', (v) => `<details><summary>Editar</summary><form method="post" action="${A(app, `/tienda/variantes/${v.id}`)}" class="a-form">${csrfField(csrf)}${variantFields(v)}<button class="btn">Guardar</button></form></details>`]], vs, { empty: 'Sin variantes.' })}
    <details><summary>Agregar variante</summary><form method="post" action="${A(app, `/tienda/productos/${p.id}/variantes`)}" class="a-form">${csrfField(csrf)}${variantFields({ active: 1 })}<button class="btn btn--solid">Agregar</button></form></details></div>`;
  }).join('')}
  <div class="a-card"><h2>Reglas de envío</h2><p class="small muted">Si un destino no coincide con ninguna regla, el pedido queda “envío por cotizar” y no se cobra hasta que definas el costo. Usa * para “cualquier estado”.</p>
    ${table([['Nombre', (r) => esc(r.name)], ['Estados', (r) => esc(jparse(r.states, []).join(', '))], ['Precio', (r) => mxn(r.price_cents)], ['Activa', (r) => (r.active ? 'Sí' : 'No')],
      ['', (r) => `<form method="post" action="${A(app, `/tienda/envios/${r.id}/alternar`)}">${csrfField(csrf)}<button class="btn">${r.active ? 'Desactivar' : 'Activar'}</button></form>`]], rules, { empty: 'Sin reglas: todos los envíos se cotizan manualmente.' })}
    <details><summary>Agregar regla</summary><form method="post" action="${A(app, '/tienda/envios')}" class="a-form">${csrfField(csrf)}${input('name', '', { label: 'Nombre', required: true })}${input('states', '', { label: 'Estados (separados por coma) o *', required: true })}${pesos('price', null, { label: 'Precio', required: true })}<button class="btn btn--solid">Agregar</button></form></details></div>`;
  return render('Tienda', body);
}

const variantFields = (v) => `<div class="a-inline">${input('size_label', v.size_label, { label: 'Tamaño', required: true })}${input('width_cm', v.width_cm ?? '', { label: 'Ancho (cm)', attrs: 'inputmode="decimal"' })}${input('height_cm', v.height_cm ?? '', { label: 'Alto (cm)', attrs: 'inputmode="decimal"' })}</div>
  <div class="a-inline">${input('finish_es', v.finish_es, { label: 'Acabado' })}${input('finish_en', v.finish_en, { label: 'Acabado (inglés)' })}${pesos('price', v.price_cents ?? null, { label: 'Precio' })}${checkbox('active', v.active, { label: 'Activa' })}</div>`;

function variantData(form) {
  if (!String(form.size_label || '').trim()) throw new Error('Indica el tamaño.');
  return [String(form.size_label).trim(), num(form.width_cm), num(form.height_cm), form.finish_es || null, form.finish_en || null, pesosToCents(form.price), form.active === '1' ? 1 : 0];
}

// ───────────── Contenido ─────────────
function content({ app, render, csrf }) {
  const keys = Object.keys({ ...DEFAULT_CONTENT });
  const get = (k, l) => app.db.get('SELECT value FROM content WHERE key = ? AND lang = ?', k, l)?.value || '';
  const media = app.db.all("SELECT * FROM media WHERE slot != 'portfolio' AND slot NOT LIKE 'product:%' ORDER BY id");
  const biz = app.setting('business');
  const testimonials = app.db.all('SELECT * FROM testimonials ORDER BY sort, id');
  const faqs = app.db.all('SELECT * FROM faqs ORDER BY sort, id');
  const cats = app.db.all('SELECT * FROM portfolio_categories ORDER BY sort');
  const portfolio = app.db.all('SELECT i.*, m.storage_key FROM portfolio_items i JOIN media m ON m.id = i.media_id ORDER BY i.sort, i.id');
  const reviewed = app.setting('policies_reviewed') || {};
  const LABELS = { hero_title: 'Portada: título', hero_sub: 'Portada: frase', intro_title: 'Presentación: título', intro_body: 'Presentación: texto', how_title: 'Cómo reservar: título', how_steps: 'Cómo reservar: pasos (separados por |)', products_title: 'Productos: título', products_body: 'Productos: texto', my_session_title: 'Mi sesión: título', my_session_body: 'Mi sesión: texto', about_title: 'Sobre mí: título', about_body: 'Sobre mí: biografía', schools_title: 'Escuelas: título', schools_body: 'Escuelas: texto', business_title: 'Negocios: título', business_body: 'Negocios: texto', tesoro_title: 'Tesoro: título', tesoro_body: 'Tesoro: texto', contact_title: 'Contacto: título', contact_body: 'Contacto: texto', travel_note: 'Nota de desplazamientos', general_conditions: 'Condiciones generales (separadas por |)' };
  const body = `<div class="a-card"><h2>Logo</h2>
    <p>${biz.logo_media_id ? `<img src="${app.base}/m/${biz.logo_media_id}" alt="Logo" style="max-height:60px">` : 'Se usa el logotipo tipográfico provisional.'}</p>
    <input type="file" accept="image/png,image/svg+xml,image/webp,image/jpeg" data-media-upload data-slot="logo" data-keep-original="1"> <span class="small muted">PNG o SVG con fondo transparente, de preferencia.</span>
    ${when(biz.logo_media_id, `<form method="post" action="${A(app, '/contenido/logo/quitar')}">${csrfField(csrf)}<button class="a-link">Volver al logotipo tipográfico</button></form>`)}</div>
  <div class="a-card"><h2>Imágenes del sitio</h2><p class="small muted">Reemplaza los espacios con fotografías propias. Si usas un recurso de demostración, márcalo y anota su permiso de uso; nunca se presenta como trabajo tuyo.</p>
    ${table([['Espacio', (m) => esc(m.alt_es || m.slot)], ['Imagen', (m) => (m.storage_key ? `<img src="${app.base}/m/${m.id}" alt="" style="width:90px;height:60px;object-fit:cover">` : '<em>Vacío</em>')],
      ['Subir', (m) => `<input type="file" accept="image/*" data-media-upload data-media="${m.id}">`],
      ['Datos', (m) => `<details><summary>Editar</summary><form method="post" action="${A(app, `/contenido/imagenes/${m.id}`)}" class="a-form">${csrfField(csrf)}${input('alt_es', m.alt_es, { label: 'Texto alternativo' })}${input('alt_en', m.alt_en, { label: 'Texto alternativo (inglés)' })}${checkbox('is_demo', m.is_demo, { label: 'Recurso de demostración' })}${input('license_note', m.license_note, { label: 'Permiso de uso / fuente' })}<button class="btn">Guardar</button></form></details>${m.is_demo ? ' <span class="tag">DEMO</span>' : ''}`]], media)}</div>
  <form method="post" action="${A(app, '/contenido/textos')}" class="a-card a-form">${csrfField(csrf)}<h2>Textos</h2><p class="small muted">Textos provisionales: reemplázalos con tu voz. No agregues premios, trayectoria ni garantías que no puedas sostener.</p>
    ${keys.map((k) => `<fieldset class="a-cols"><div>${textarea(`es:${k}`, get(k, 'es'), { label: LABELS[k] || k, rows: k.endsWith('body') || k === 'general_conditions' || k === 'how_steps' ? 4 : 2 })}</div><div>${textarea(`en:${k}`, get(k, 'en'), { label: `${LABELS[k] || k} (inglés)`, rows: k.endsWith('body') || k === 'general_conditions' || k === 'how_steps' ? 4 : 2 })}</div></fieldset>`).join('')}
    <button class="btn btn--solid">Guardar textos</button></form>
  <form method="post" action="${A(app, '/contenido/politicas')}" class="a-card a-form">${csrfField(csrf)}<h2>Políticas (borradores)</h2>
    <p class="small muted">Revisa con asesoría legal. Las marcas [REVISAR: …] señalan lo que falta definir. Mientras no marques “revisada”, la página muestra “Versión preliminar en revisión”.</p>
    ${Object.keys(POLICIES).map((k) => `<fieldset><legend><strong>${{ policy_privacy: 'Privacidad', policy_bookings: 'Reservas y cancelaciones', policy_purchases: 'Compras y envíos', policy_image: 'Uso de imagen' }[k]}</strong></legend>
      <div class="a-cols"><div>${textarea(`es:${k}`, get(k, 'es'), { label: 'Español', rows: 10 })}</div><div>${textarea(`en:${k}`, get(k, 'en'), { label: 'Inglés', rows: 10 })}</div></div>${checkbox(`reviewed:${k}`, reviewed[k], { label: 'Revisada y lista para publicarse' })}</fieldset>`).join('')}
    <button class="btn btn--solid">Guardar políticas</button></form>
  <div class="a-card"><h2>Testimonios</h2><p class="small muted">Solo se muestran los marcados como autorizados y visibles. Sin testimonios, la sección no aparece.</p>
    ${table([['Texto', (t) => esc(t.quote_es || '')], ['Autor', (t) => esc(t.author || '')], ['Estado', (t) => `${t.authorized ? 'Autorizado' : 'Sin autorización'} · ${t.visible ? 'Visible' : 'Oculto'}`],
      ['', (t) => `<details><summary>Editar</summary>${testimonialForm(app, csrf, t)}</details>`]], testimonials, { empty: 'Sin testimonios.' })}
    <details><summary>Agregar testimonio</summary>${testimonialForm(app, csrf, {})}</details></div>
  <div class="a-card"><h2>Preguntas frecuentes</h2>
    ${table([['Pregunta', (f) => esc(f.q_es)], ['Visible', (f) => (f.visible ? 'Sí' : 'No')], ['', (f) => `<details><summary>Editar</summary>${faqForm(app, csrf, f)}</details>`]], faqs)}
    <details><summary>Agregar pregunta</summary>${faqForm(app, csrf, { visible: 1, sort: faqs.length })}</details></div>
  <div class="a-card"><h2>Portafolio</h2><p class="small muted">Publicar requiere autorización independiente de las personas fotografiadas (y de madre, padre o tutor en el caso de menores). Contratar nunca está condicionado a autorizarla. No uses nombres de menores.</p>
    ${table([['Imagen', (i) => `<img src="${app.base}/m/${i.media_id}" alt="" style="width:80px;height:60px;object-fit:cover">`], ['Categoría', (i) => esc(cats.find((c) => c.id === i.category_id)?.name_es || '')], ['Autorización', (i) => esc(i.authorization_note || '') + (i.authorized ? ' ✓' : ' — pendiente')], ['Visible', (i) => (i.visible ? 'Sí' : 'No')],
      ['', (i) => `<details><summary>Editar</summary><form method="post" action="${A(app, `/contenido/portafolio/${i.id}`)}" class="a-form">${csrfField(csrf)}${select('category_id', i.category_id, cats.map((c) => [c.id, c.name_es]), { label: 'Categoría' })}${input('title_es', i.title_es, { label: 'Título / texto alternativo' })}${input('title_en', i.title_en, { label: 'Título (inglés)' })}${input('authorization_note', i.authorization_note, { label: 'Autorización (quién, cuándo, cómo)' })}${checkbox('authorized', i.authorized, { label: 'Cuento con autorización por escrito' })}${checkbox('visible', i.visible, { label: 'Visible (requiere autorización)' })}<button class="btn">Guardar</button> <button class="btn btn--danger" name="delete" value="1">Quitar</button></form></details>`]], portfolio, { empty: 'Sin imágenes: el portafolio público muestra un mensaje y enlaza a Instagram.' })}
    <p>Agregar imagen al portafolio: <input type="file" accept="image/*" data-media-upload data-slot="portfolio"></p></div>`;
  return render('Contenido', body, { scripts: ['js/admin-upload.js'] });
}

const testimonialForm = (app, csrf, t) => `<form method="post" action="${A(app, `/contenido/testimonios/${t.id || 'nuevo'}`)}" class="a-form">${csrfField(csrf)}
  <div class="a-cols">${textarea('quote_es', t.quote_es, { label: 'Testimonio', rows: 3 })}${textarea('quote_en', t.quote_en, { label: 'Testimonio (inglés)', rows: 3 })}</div>
  ${input('author', t.author, { label: 'Autor (como autorizó que aparezca)' })}${checkbox('authorized', t.authorized, { label: 'Autorizado por escrito' })}${checkbox('visible', t.visible, { label: 'Visible' })}
  <button class="btn">Guardar</button>${t.id ? ' <button class="btn btn--danger" name="delete" value="1">Eliminar</button>' : ''}</form>`;

const faqForm = (app, csrf, f) => `<form method="post" action="${A(app, `/contenido/faq/${f.id || 'nueva'}`)}" class="a-form">${csrfField(csrf)}
  <div class="a-cols"><div>${input('q_es', f.q_es, { label: 'Pregunta', required: true })}${textarea('a_es', f.a_es, { label: 'Respuesta', rows: 3 })}</div><div>${input('q_en', f.q_en, { label: 'Pregunta (inglés)' })}${textarea('a_en', f.a_en, { label: 'Respuesta (inglés)', rows: 3 })}</div></div>
  <div class="a-inline">${input('sort', f.sort ?? 0, { label: 'Orden', type: 'number' })}${checkbox('visible', f.visible, { label: 'Visible' })}</div>
  <button class="btn">Guardar</button>${f.id ? ' <button class="btn btn--danger" name="delete" value="1">Eliminar</button>' : ''}</form>`;

// ───────────── Correos ─────────────
const TPL_LABELS = {
  quote_ready: 'Cotización lista', hold_received: 'Apartado recibido (importe y plazo)', booking_confirmed: 'Reserva confirmada', hold_expired: 'Apartado vencido',
  payment_received: 'Pago recibido', booking_conflict: 'Pago tardío en revisión', prep_recommendations: 'Recomendaciones previas', poses: 'Poses y preparación', logistics: 'Agenda de logística',
  gallery_delivery: 'Entrega de galería', gallery_expiry_reminder: 'Recordatorio de vencimiento de galería', order_confirmed: 'Pedido confirmado', order_shipping_quote: 'Costo de envío', order_update: 'Seguimiento de pedido',
};
function emails({ app, render, csrf }) {
  const rows = app.db.all('SELECT * FROM email_templates ORDER BY key, service_kind, lang');
  const r = app.setting('reminders');
  const body = `<p class="small muted">Variables disponibles: {{nombre}}, {{servicio}}, {{fecha}}, {{vence}}, {{anticipo}}, {{pagado}}, {{saldo}}, {{lugar}}, {{enlace}}, {{cancelacion}}, {{galeria}}, {{codigo}}, {{pedido}}, {{total}}, {{envio}}, {{estado}}, {{rastreo}}.
    Las recomendaciones y poses solo se envían a servicios con plantilla propia (por ejemplo, no se envían poses a escuelas). Los mensajes por WhatsApp los envías tú desde cada reserva.</p>
  <form method="post" action="${A(app, '/correos/tiempos')}" class="a-card a-inline">${csrfField(csrf)}
    ${input('prep', r.prep_days_before ?? '', { label: 'Recomendaciones: días antes', type: 'number' })}${input('poses', r.poses_days_before ?? '', { label: 'Poses: días antes', type: 'number' })}${input('logistics', r.logistics_days_before ?? '', { label: 'Logística: días antes', type: 'number' })}
    ${input('gallery', (app.setting('gallery').reminder_days_before || []).join(', '), { label: 'Vencimiento de galería: días antes' })}<button class="btn btn--solid">Guardar tiempos</button></form>
  ${table([['Plantilla', (t) => `<a href="${A(app, `/correos/${t.id}`)}">${esc(TPL_LABELS[t.key] || t.key)}</a>`], ['Servicio', (t) => esc(KINDS.find((k) => k[0] === t.service_kind)?.[1] || 'General')], ['Idioma', (t) => t.lang.toUpperCase()], ['Activa', (t) => (t.active ? 'Sí' : 'No')]], rows)}
  <details class="a-card"><summary>Nueva plantilla específica por servicio</summary><form method="post" action="${A(app, '/correos/nueva')}" class="a-form">${csrfField(csrf)}
    ${select('key', 'prep_recommendations', Object.entries(TPL_LABELS), { label: 'Tipo' })}${select('service_kind', '', [['', 'General'], ...KINDS], { label: 'Servicio' })}${select('lang', 'es', [['es', 'Español'], ['en', 'Inglés']], { label: 'Idioma' })}
    ${input('subject', '', { label: 'Asunto', required: true })}${textarea('body', '', { label: 'Mensaje', rows: 8 })}<button class="btn btn--solid">Crear</button></form></details>`;
  return render('Correos', body);
}

function emailEdit({ app, render, params, csrf }) {
  const t = app.db.get('SELECT * FROM email_templates WHERE id = ?', Number(params[0]));
  const body = `<form method="post" action="${A(app, `/correos/${t.id}`)}" class="a-form a-card">${csrfField(csrf)}
    <p>${esc(TPL_LABELS[t.key] || t.key)} · ${t.lang.toUpperCase()} · ${esc(KINDS.find((k) => k[0] === t.service_kind)?.[1] || 'General')}</p>
    ${input('subject', t.subject, { label: 'Asunto', required: true })}${textarea('body', t.body, { label: 'Mensaje (separa párrafos con una línea en blanco)', rows: 14 })}
    ${checkbox('active', t.active, { label: 'Activa' })}<button class="btn btn--solid">Guardar</button></form>`;
  return render('Plantilla de correo', body, { path: '/correos' });
}

// ───────────── Ajustes ─────────────
const SETTING_LABELS = {
  business: 'Datos del negocio', booking: 'Reservas y agenda', delivery: 'Entregas', gallery: 'Galerías', storage: 'Almacenamiento', shop: 'Tienda', cancellation: 'Cancelaciones',
};
const FIELD_LABELS = {
  name: 'Nombre comercial', phone: 'Teléfono', whatsapp: 'Enlace de WhatsApp', instagram: 'Instagram', address: 'Dirección (líneas separadas por coma)', cities: 'Ciudades base', email: 'Correo comercial', domain: 'Dominio', admin_alert_email: 'Correo para avisos internos',
  deposit_percent: 'Anticipo (%)', hold_hours: 'Vigencia del apartado (horas)', 'session_window.start': 'Inicio del horario de sesiones', 'session_window.end': 'Fin del horario de sesiones', slot_step_min: 'Intervalo entre horarios (min)', prep_min: 'Preparación antes de cada servicio (min)', travel_min: 'Traslado antes y después (min)', min_notice_hours: 'Anticipación mínima para reservar (horas)', horizon_days: 'Días hacia adelante disponibles',
  default_days: 'Entrega prevista (días después)', warn_before_days: 'Avisarme antes de la entrega (días)', validity_days: 'Vigencia de galerías (días)', reminder_days_before: 'Recordatorios de vencimiento (días antes)', 'auto_delete.enabled': 'Eliminar archivos automáticamente al vencer', 'auto_delete.grace_days': 'Días de gracia antes de eliminar', zip_batch_mb: 'Tamaño máximo de cada parte de descarga (MB)',
  quota_gb: 'Capacidad total (GB)', warn_percent: 'Avisar al llegar a (%)', dpi_min: 'Resolución mínima para imprimir (ppp)', dpi_good: 'Resolución recomendada (ppp)', order_file_retention_days: 'Conservar archivos de pedidos (días tras completar)',
  es: 'Texto (español)', en: 'Texto (inglés)', resolution_rule: 'Regla para cancelaciones con más de 72 h y reprogramaciones (por definir)',
};
function flatten(obj, prefix = '') {
  return Object.entries(obj || {}).flatMap(([k, v]) => (v && typeof v === 'object' && !Array.isArray(v) ? flatten(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v]]));
}
function settings({ app, render, csrf }) {
  const body = Object.keys(SETTING_LABELS).map((key) => {
    const value = { ...DEFAULT_SETTINGS[key], ...app.setting(key) };
    const fields = flatten(value).filter(([k]) => k !== 'logo_media_id');
    return `<form method="post" action="${A(app, `/ajustes/${key}`)}" class="a-card a-form">${csrfField(csrf)}<h2>${SETTING_LABELS[key]}</h2>
      ${fields.map(([k, v]) => typeof v === 'boolean' ? checkbox(k, v, { label: FIELD_LABELS[k] || k })
        : Array.isArray(v) ? input(k, v.join(', '), { label: FIELD_LABELS[k] || k })
        : (k === 'es' || k === 'en' || k === 'resolution_rule') ? textarea(k, v ?? '', { label: FIELD_LABELS[k] || k, rows: 2 })
        : input(k, v ?? '', { label: FIELD_LABELS[k] || k, type: typeof DEFAULT_SETTINGS[key]?.[k] === 'number' ? 'number' : 'text' })).join('')}
      ${key === 'storage' ? '<p class="small muted">Aumentar la capacidad aquí no amplía tu almacenamiento real: hazlo también en tu proveedor (puede tener costo).</p>' : ''}
      <button class="btn btn--solid">Guardar</button></form>`;
  }).join('');
  return render('Ajustes', body);
}

function settingsSave({ app, form, params, back }) {
  const key = params[0];
  if (!SETTING_LABELS[key]) throw new Error('Sección desconocida');
  const current = { ...DEFAULT_SETTINGS[key], ...app.setting(key) };
  const next = structuredClone(current);
  for (const [path, oldValue] of flatten(current)) {
    if (path === 'logo_media_id') continue;
    const raw = form[path];
    const parts = path.split('.');
    let target = next;
    for (const p of parts.slice(0, -1)) target = target[p];
    const leaf = parts.at(-1);
    if (typeof oldValue === 'boolean') target[leaf] = raw === '1';
    else if (Array.isArray(oldValue)) target[leaf] = csvList(raw).map((x) => (typeof oldValue[0] === 'number' && Number.isFinite(Number(x)) ? Number(x) : x));
    else if (typeof oldValue === 'number' || ['deposit_percent', 'hold_hours'].includes(leaf)) {
      if (raw === '' || raw == null) continue;
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) throw new Error(`Valor inválido en ${FIELD_LABELS[path] || path}.`);
      target[leaf] = n;
    } else target[leaf] = raw === '' ? null : raw ?? oldValue;
  }
  if (key === 'booking' && (next.deposit_percent <= 0 || next.deposit_percent > 100)) throw new Error('El anticipo debe estar entre 1 y 100%.');
  if (key === 'gallery' && next.zip_batch_mb > 3500) next.zip_batch_mb = 3500;
  app.setSetting(key, next);
  app.log('admin', 'ajustes_guardados', { details: key });
  return back('/ajustes', 'Ajustes guardados.');
}

const R = (re, h) => [re, h];
export const routes = [
  R(/^\/catalogo$/, { GET: catalog }),
  R(/^\/catalogo\/servicios\/(\d+)$/, { GET: serviceEdit, POST: ({ app, form, params, back }) => {
    app.db.run('UPDATE services SET name_es = ?, name_en = ?, summary_es = ?, summary_en = ?, sort = ?, active = ? WHERE id = ?', form.name_es, form.name_en, form.summary_es, form.summary_en, Number(form.sort) || 0, form.active === '1' ? 1 : 0, Number(params[0]));
    app.log('admin', 'servicio_guardado', { details: form.name_es });
    return back('/catalogo', 'Servicio guardado.');
  } }),
  R(/^\/catalogo\/servicios\/(\d+)\/cuestionario$/, { POST: questionnaireSave }),
  R(/^\/catalogo\/paquetes\/(nuevo|\d+)$/, { GET: packageForm, POST: packageSave }),
  R(/^\/catalogo\/extras$/, { POST: ({ app, form, back }) => {
    for (const e of app.db.all('SELECT id FROM extras')) app.db.run('UPDATE extras SET price_cents = ?, active = ? WHERE id = ?', pesosToCents(form[`price_${e.id}`]), form[`active_${e.id}`] === '1' ? 1 : 0, e.id);
    app.log('admin', 'extras_guardados'); return back('/catalogo#extras', 'Extras guardados.');
  } }),
  R(/^\/catalogo\/viaticos\/(nueva|\d+)$/, { POST: ({ app, form, params, back }) => {
    const cities = JSON.stringify(csvList(form.cities));
    if (params[0] === 'nueva') app.db.run('INSERT INTO travel_zones (name, cities, price_cents) VALUES (?, ?, ?)', form.name, cities, pesosToCents(form.price));
    else app.db.run('UPDATE travel_zones SET name = ?, cities = ?, price_cents = ?, active = ? WHERE id = ?', form.name, cities, pesosToCents(form.price), form.active === '1' ? 1 : 0, Number(params[0]));
    app.log('admin', 'viaticos_guardados', { details: form.name }); return back('/catalogo#viaticos', 'Viáticos guardados.');
  } }),
  R(/^\/catalogo\/descuentos$/, { POST: ({ app, form, back }) => {
    const value = form.kind === 'percent' ? Math.round(Number(form.value)) : pesosToCents(form.value);
    if (!String(form.code || '').trim() || !(value > 0) || (form.kind === 'percent' && value > 100)) throw new Error('Revisa el código y el valor.');
    const kinds = KINDS.map(([k]) => k).filter((k) => form[`kind_${k}`] === '1');
    app.db.run('INSERT INTO discounts (code, kind, value, valid_from, valid_to, max_uses, min_subtotal_cents, service_kinds, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      String(form.code).trim().toUpperCase(), form.kind === 'fixed' ? 'fixed' : 'percent', value, isDate(form.from) ? zonedToUtc(form.from) : null, isDate(form.to) ? zonedToUtc(form.to, '23:59') : null,
      num(form.max_uses), pesosToCents(form.min_subtotal), kinds.length ? JSON.stringify(kinds) : null, app.now());
    app.log('admin', 'descuento_creado', { details: form.code }); return back('/catalogo#descuentos', 'Código creado.');
  } }),
  R(/^\/catalogo\/descuentos\/(\d+)\/alternar$/, { POST: ({ app, params, back }) => { app.db.run('UPDATE discounts SET active = 1 - active WHERE id = ?', Number(params[0])); return back('/catalogo#descuentos', 'Código actualizado.'); } }),
  R(/^\/tienda$/, { GET: shop }),
  R(/^\/tienda\/productos\/(\d+)$/, { POST: ({ app, form, params, back }) => {
    const id = Number(params[0]);
    let status = ['draft', 'active', 'archived'].includes(form.status) ? form.status : 'draft';
    if (status === 'active' && !app.db.get('SELECT 1 FROM product_variants WHERE product_id = ? AND active = 1 AND price_cents IS NOT NULL', id)) throw new Error('Para activar el producto agrega al menos una variante activa con precio.');
    app.db.run('UPDATE products SET name_es = ?, name_en = ?, description_es = ?, description_en = ?, min_photos = ?, max_photos = ?, requires_design_review = ?, status = ? WHERE id = ?',
      form.name_es, form.name_en, form.description_es, form.description_en, Math.max(1, Number(form.min_photos) || 1), Math.max(1, Number(form.max_photos) || 1), form.review === '1' ? 1 : 0, status, id);
    app.log('admin', 'producto_guardado', { details: `${form.name_es} (${status})` }); return back('/tienda', 'Producto guardado.');
  } }),
  R(/^\/tienda\/productos\/(\d+)\/variantes$/, { POST: ({ app, form, params, back }) => { app.db.run('INSERT INTO product_variants (product_id, size_label, width_cm, height_cm, finish_es, finish_en, price_cents, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', Number(params[0]), ...variantData(form)); return back('/tienda', 'Variante agregada.'); } }),
  R(/^\/tienda\/variantes\/(\d+)$/, { POST: ({ app, form, params, back }) => { app.db.run('UPDATE product_variants SET size_label = ?, width_cm = ?, height_cm = ?, finish_es = ?, finish_en = ?, price_cents = ?, active = ? WHERE id = ?', ...variantData(form), Number(params[0])); return back('/tienda', 'Variante guardada.'); } }),
  R(/^\/tienda\/envios$/, { POST: ({ app, form, back }) => { const c = pesosToCents(form.price); if (c == null) throw new Error('Indica el precio.'); app.db.run('INSERT INTO shipping_rules (name, states, price_cents) VALUES (?, ?, ?)', form.name, JSON.stringify(csvList(form.states)), c); return back('/tienda', 'Regla agregada.'); } }),
  R(/^\/tienda\/envios\/(\d+)\/alternar$/, { POST: ({ app, params, back }) => { app.db.run('UPDATE shipping_rules SET active = 1 - active WHERE id = ?', Number(params[0])); return back('/tienda', 'Regla actualizada.'); } }),
  R(/^\/contenido$/, { GET: content }),
  R(/^\/contenido\/textos$/, { POST: ({ app, form, back }) => {
    for (const [k, v] of Object.entries(form)) {
      const m = k.match(/^(es|en):(\w+)$/);
      if (m && m[2] in DEFAULT_CONTENT) app.db.run('INSERT INTO content (key, lang, value, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(key, lang) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at', m[2], m[1], String(v).slice(0, 20000), app.now());
    }
    app.log('admin', 'textos_guardados'); return back('/contenido', 'Textos guardados.');
  } }),
  R(/^\/contenido\/politicas$/, { POST: ({ app, form, back }) => {
    const reviewed = {};
    for (const k of Object.keys(POLICIES)) {
      for (const l of ['es', 'en']) if (form[`${l}:${k}`] != null) app.db.run('INSERT INTO content (key, lang, value, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(key, lang) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at', k, l, String(form[`${l}:${k}`]).slice(0, 50000), app.now());
      reviewed[k] = form[`reviewed:${k}`] === '1';
    }
    app.setSetting('policies_reviewed', reviewed);
    app.log('admin', 'politicas_guardadas'); return back('/contenido', 'Políticas guardadas.');
  } }),
  R(/^\/contenido\/imagenes\/(\d+)$/, { POST: ({ app, form, params, back }) => { app.db.run('UPDATE media SET alt_es = ?, alt_en = ?, is_demo = ?, license_note = ? WHERE id = ?', form.alt_es, form.alt_en, form.is_demo === '1' ? 1 : 0, form.license_note || null, Number(params[0])); return back('/contenido', 'Imagen actualizada.'); } }),
  // Crea un registro de imagen para subir (logo, portafolio o producto)
  R(/^\/api\/media$/, { POST: ({ app, form, json }) => {
    const slot = String(form.slot || '');
    if (!['logo', 'portfolio'].includes(slot) && !/^product:\d+$/.test(slot)) return json(400, { error: 'slot' });
    const id = Number(app.db.run('INSERT INTO media (slot, mime, alt_es, alt_en, created_at) VALUES (?, ?, ?, ?, ?)', slot, String(form.mime || '').slice(0, 60), slot === 'logo' ? 'Logo' : '', slot === 'logo' ? 'Logo' : '', app.now()).lastInsertRowid);
    if (slot === 'logo') app.setSetting('business', { ...app.setting('business'), logo_media_id: id });
    if (slot === 'portfolio') {
      const cat = app.db.get('SELECT id FROM portfolio_categories ORDER BY sort LIMIT 1');
      app.db.run('INSERT INTO portfolio_items (category_id, media_id, authorized, visible) VALUES (?, ?, 0, 0)', cat?.id ?? null, id);
    }
    return json(200, { id });
  } }),
  R(/^\/contenido\/logo\/quitar$/, { POST: ({ app, back }) => { app.setSetting('business', { ...app.setting('business'), logo_media_id: null }); return back('/contenido', 'Se usará el logotipo tipográfico.'); } }),
  R(/^\/contenido\/testimonios\/(nuevo|\d+)$/, { POST: ({ app, form, params, back }) => {
    if (form.delete === '1') app.db.run('DELETE FROM testimonials WHERE id = ?', Number(params[0]));
    else {
      const visible = form.visible === '1' && form.authorized === '1' ? 1 : 0;
      if (params[0] === 'nuevo') app.db.run('INSERT INTO testimonials (quote_es, quote_en, author, authorized, visible) VALUES (?, ?, ?, ?, ?)', form.quote_es, form.quote_en, form.author, form.authorized === '1' ? 1 : 0, visible);
      else app.db.run('UPDATE testimonials SET quote_es = ?, quote_en = ?, author = ?, authorized = ?, visible = ? WHERE id = ?', form.quote_es, form.quote_en, form.author, form.authorized === '1' ? 1 : 0, visible, Number(params[0]));
    }
    return back('/contenido', 'Testimonios actualizados.');
  } }),
  R(/^\/contenido\/faq\/(nueva|\d+)$/, { POST: ({ app, form, params, back }) => {
    if (form.delete === '1') app.db.run('DELETE FROM faqs WHERE id = ?', Number(params[0]));
    else if (params[0] === 'nueva') app.db.run('INSERT INTO faqs (q_es, a_es, q_en, a_en, visible, sort) VALUES (?, ?, ?, ?, ?, ?)', form.q_es, form.a_es, form.q_en, form.a_en, form.visible === '1' ? 1 : 0, Number(form.sort) || 0);
    else app.db.run('UPDATE faqs SET q_es = ?, a_es = ?, q_en = ?, a_en = ?, visible = ?, sort = ? WHERE id = ?', form.q_es, form.a_es, form.q_en, form.a_en, form.visible === '1' ? 1 : 0, Number(form.sort) || 0, Number(params[0]));
    return back('/contenido', 'Preguntas actualizadas.');
  } }),
  R(/^\/contenido\/portafolio\/(\d+)$/, { POST: async ({ app, form, params, back }) => {
    const id = Number(params[0]);
    if (form.delete === '1') {
      const it = app.db.get('SELECT * FROM portfolio_items WHERE id = ?', id);
      const m = it && app.db.get('SELECT * FROM media WHERE id = ?', it.media_id);
      if (m?.storage_key) await app.storage.remove(m.storage_key).catch(() => {});
      app.db.run('DELETE FROM portfolio_items WHERE id = ?', id);
      if (m) app.db.run('DELETE FROM media WHERE id = ?', m.id);
      return back('/contenido', 'Imagen retirada del portafolio.');
    }
    const authorized = form.authorized === '1' ? 1 : 0;
    app.db.run('UPDATE portfolio_items SET category_id = ?, title_es = ?, title_en = ?, authorization_note = ?, authorized = ?, visible = ? WHERE id = ?',
      Number(form.category_id) || null, form.title_es, form.title_en, form.authorization_note, authorized, authorized && form.visible === '1' ? 1 : 0, id);
    app.log('admin', 'portafolio_actualizado', { details: `#${id} ${authorized ? 'autorizado' : 'sin autorización'}` });
    return back('/contenido', authorized || form.visible !== '1' ? 'Portafolio actualizado.' : 'Guardado como oculto: falta la autorización.');
  } }),
  R(/^\/correos$/, { GET: emails }),
  R(/^\/correos\/tiempos$/, { POST: ({ app, form, back }) => {
    app.setSetting('reminders', { prep_days_before: num(form.prep), poses_days_before: num(form.poses), logistics_days_before: num(form.logistics) });
    app.setSetting('gallery', { ...app.setting('gallery'), reminder_days_before: csvList(form.gallery).map(Number).filter((n) => n > 0) });
    return back('/correos', 'Tiempos guardados (aplican a reservas y galerías nuevas).');
  } }),
  R(/^\/correos\/nueva$/, { POST: ({ app, form, back }) => {
    app.db.run('INSERT INTO email_templates (key, lang, service_kind, subject, body, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(key, lang, service_kind) DO UPDATE SET subject = excluded.subject, body = excluded.body, updated_at = excluded.updated_at',
      form.key, form.lang === 'en' ? 'en' : 'es', form.service_kind || null, form.subject, form.body, app.now());
    return back('/correos', 'Plantilla guardada.');
  } }),
  R(/^\/correos\/(\d+)$/, { GET: emailEdit, POST: ({ app, form, params, back }) => {
    app.db.run('UPDATE email_templates SET subject = ?, body = ?, active = ?, updated_at = ? WHERE id = ?', form.subject, form.body, form.active === '1' ? 1 : 0, app.now(), Number(params[0]));
    app.log('admin', 'plantilla_guardada', { details: `#${params[0]}` }); return back('/correos', 'Plantilla guardada.');
  } }),
  R(/^\/ajustes$/, { GET: settings }),
  R(/^\/ajustes\/(\w+)$/, { POST: settingsSave }),
];
