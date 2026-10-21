// Base de datos sencilla en archivos JSON (data/<colección>.json).
// Suficiente para el volumen de una consultoría; para crecer, reemplaza este módulo por Postgres/SQLite
// manteniendo la misma interfaz (insert, update, find, all, findBy).
import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export const COLLECTIONS = {
  diagnosticos: 'Prospectos del diagnóstico',
  solicitudes: 'Solicitudes de propuesta',
  pedidos: 'Compras',
  suscripciones: 'Suscripciones',
  boletin: 'Boletín',
  eventos: 'Eventos (llamadas agendadas)',
  correos: 'Correos enviados',
};

export function createStore(dir) {
  mkdirSync(dir, { recursive: true });
  const cache = {};
  const file = (col) => join(dir, `${col}.json`);

  function load(col) {
    if (!cache[col]) cache[col] = existsSync(file(col)) ? JSON.parse(readFileSync(file(col), 'utf8')) : [];
    return cache[col];
  }
  function save(col) {
    const tmp = file(col) + '.tmp';
    writeFileSync(tmp, JSON.stringify(cache[col], null, 2));
    renameSync(tmp, file(col)); // escritura atómica
  }

  return {
    all: (col) => [...load(col)].reverse(),
    find: (col, id) => load(col).find((r) => r.id === id) || null,
    findBy: (col, fn) => load(col).find(fn) || null,
    insert(col, data, id = randomUUID().slice(0, 8).toUpperCase()) {
      const row = { id, creado: new Date().toISOString(), ...data };
      load(col).push(row);
      save(col);
      return row;
    },
    update(col, id, patch) {
      const row = load(col).find((r) => r.id === id);
      if (!row) return null;
      Object.assign(row, patch, { actualizado: new Date().toISOString() });
      save(col);
      return row;
    },
  };
}
