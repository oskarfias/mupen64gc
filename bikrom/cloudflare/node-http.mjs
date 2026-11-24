// Puente entre la API Fetch de Cloudflare y los manejadores estilo Node (req, res) del sitio.
// req: flujo legible con method, url, headers y socket. res: flujo escribible con writeHead/setHeader/end.
// La respuesta se envía en flujo (sirve para descargas grandes y ZIP) en cuanto se conocen los encabezados.
import { Readable, Writable } from 'node:stream';

export async function toNodeRequest(request, ip) {
  const url = new URL(request.url);
  const body = request.body ? Buffer.from(await request.arrayBuffer()) : null;
  const req = Readable.from(body && body.length ? [body] : []);
  req.method = request.method;
  req.url = url.pathname + url.search;
  req.headers = {};
  for (const [k, v] of request.headers) req.headers[k] = v;
  req.socket = { remoteAddress: ip || '' };
  req.connection = req.socket;
  return req;
}

export function nodeResponse(method) {
  let resolve;
  const ready = new Promise((r) => { resolve = r; });
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  let headers = {};
  let started = false;
  let noBody = false;

  const res = new Writable({
    write(chunk, _enc, cb) {
      start();
      if (noBody) return cb();
      writer.write(typeof chunk === 'string' ? new TextEncoder().encode(chunk) : new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength)).then(() => cb(), cb);
    },
    final(cb) {
      start();
      if (noBody) return cb();
      writer.close().then(() => cb(), cb);
    },
    destroy(err, cb) {
      writer.abort(err).catch(() => {});
      start();
      cb(err);
    },
  });
  res.statusCode = 200;
  res.headersSent = false;
  res.setHeader = (k, v) => { headers[k.toLowerCase()] = v; return res; };
  res.getHeader = (k) => headers[k.toLowerCase()];
  res.removeHeader = (k) => { delete headers[k.toLowerCase()]; };
  res.writeHead = (status, a, b) => {
    const h = typeof a === 'object' && a ? a : b || {};
    res.statusCode = status;
    for (const [k, v] of Object.entries(h)) res.setHeader(k, v);
    res.headersSent = true;
    return res;
  };
  const origEnd = res.end.bind(res);
  res.end = (chunk, enc, cb) => {
    if (!res.headersSent) res.headersSent = true;
    return origEnd(chunk ?? undefined, enc, cb);
  };

  function start() {
    if (started) return;
    started = true;
    res.headersSent = true;
    const h = new Headers();
    for (const [k, v] of Object.entries(headers)) {
      if (v == null) continue;
      if (Array.isArray(v)) v.forEach((x) => h.append(k, String(x)));
      else h.set(k, String(v));
    }
    const status = res.statusCode;
    noBody = method === 'HEAD' || status === 204 || status === 304;
    resolve(new Response(noBody ? null : readable, { status, headers: h }));
  }
  return { res, ready, start };
}

// Ejecuta un manejador (req, res) y devuelve un Response.
export async function runNode(handler, request, ip) {
  const req = await toNodeRequest(request, ip);
  const { res, ready, start } = nodeResponse(request.method);
  const done = Promise.resolve(handler(req, res)).catch((e) => {
    console.error(e);
    if (!res.headersSent) { res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Error del servidor'); }
  });
  // Si el manejador termina sin escribir nada (o solo con encabezados), se cierra la respuesta.
  done.then(() => setTimeout(() => { if (!res.writableEnded && !res.destroyed && !res.headersSent) { res.statusCode = 404; res.end(); } }, 0));
  return Promise.race([ready, done.then(() => ready)]);
}
