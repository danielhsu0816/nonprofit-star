// Local dev server: serves dist/ and a small /api/* backed by Node's built-in SQLite.
// Nothing here sends email or takes payments.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { extname, normalize } from 'node:path';
import { PORT } from './config.mjs';

const DIST = new URL('./dist/', import.meta.url);
const db = new DatabaseSync(new URL('./local.sqlite', import.meta.url).pathname);
db.exec(`
CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY, at TEXT, kind TEXT, area TEXT, org TEXT, intents TEXT, causes TEXT);
CREATE TABLE IF NOT EXISTS subscribers (id INTEGER PRIMARY KEY, at TEXT, email TEXT UNIQUE, area TEXT);
`);
try { db.exec('ALTER TABLE events ADD COLUMN role TEXT'); } catch { /* column exists */ }

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml' };

const json = (res, code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
// Area must be a city name or a ZIP. Anything that looks like coordinates is rejected.
const cleanArea = (a) => {
  if (typeof a !== 'string') return null;
  const s = a.trim().slice(0, 60);
  return /-?\d+\.\d+/.test(s) ? null : s;
};
const list = (v) => Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, 10).join(',') : '';

async function body(req) {
  let raw = '';
  for await (const chunk of req) { raw += chunk; if (raw.length > 4096) throw new Error('too large'); }
  return JSON.parse(raw || '{}');
}

async function api(req, res, path) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Use POST' });
  let b;
  try { b = await body(req); } catch { return json(res, 400, { error: 'Invalid request' }); }
  const now = new Date().toISOString();
  if (path === '/api/log') {
    const role = ['supporter', 'nonprofit', 'guest'].includes(b.role) ? b.role : null;
    db.prepare('INSERT INTO events (at, kind, area, org, intents, causes, role) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(now, String(b.kind || '').slice(0, 20), cleanArea(b.area), typeof b.org === 'string' ? b.org.slice(0, 60) : null, list(b.intents), list(b.causes), role);
    return json(res, 200, { ok: true });
  }
  if (path === '/api/subscribe' || path === '/api/profile') {
    const email = String(b.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) return json(res, 400, { error: 'That email address looks incomplete' });
    db.prepare('INSERT INTO subscribers (at, email, area) VALUES (?, ?, ?) ON CONFLICT(email) DO UPDATE SET area = excluded.area')
      .run(now, email, cleanArea(b.area));
    return json(res, 200, { ok: true, sent: false });
  }
  return json(res, 404, { error: 'Unknown endpoint' });
}

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let path = decodeURIComponent(url.pathname);
  if (path.startsWith('/api/')) return api(req, res, path);
  if (path.endsWith('/')) path += 'index.html';
  path = normalize(path).replace(/^(\.\.[/\\])+/, '');
  try {
    const file = await readFile(new URL('.' + path, DIST));
    res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' });
    res.end(file);
  } catch {
    res.writeHead(404, { 'content-type': TYPES['.html'] });
    res.end(await readFile(new URL('./404.html', DIST)).catch(() => 'Not found'));
  }
}).listen(PORT, () => console.log(`Nonprofit Star running at http://localhost:${PORT}`));
