// Checks the built site: JSON-LD parses, one h1, unique titles and descriptions,
// palette unchanged, sitemap covers every page, banned words absent.
import { readdirSync, readFileSync } from 'node:fs';
const dist = new URL('./dist/', import.meta.url);
const files = readdirSync(dist).filter((f) => f.endsWith('.html'));
const errors = [];
const titles = new Map(), descs = new Map();
let blocks = 0;
for (const f of files) {
  const html = readFileSync(new URL(f, dist), 'utf8');
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { JSON.parse(m[1]); blocks++; } catch (e) { errors.push(`${f}: JSON-LD does not parse (${e.message})`); }
  }
  const h1 = (html.match(/<h1[\s>]/g) || []).length;
  if (h1 !== 1) errors.push(`${f}: ${h1} h1 elements`);
  const levels = [...html.matchAll(/<h([1-6])[\s>]/g)].map((m) => +m[1]);
  levels.forEach((l, i) => { if (i && l > levels[i - 1] + 1) errors.push(`${f}: heading jumps h${levels[i - 1]} to h${l}`); });
  const t = html.match(/<title>(.*?)<\/title>/)?.[1]; const d = html.match(/<meta name="description" content="(.*?)">/)?.[1];
  if (titles.has(t)) errors.push(`${f}: duplicate title with ${titles.get(t)}`); titles.set(t, f);
  if (descs.has(d)) errors.push(`${f}: duplicate description with ${descs.get(d)}`); descs.set(d, f);
  const text = html.replace(/<script[\s\S]*?<\/script>/g, '');
  if (/\b(jobs?|careers?|hiring)\b/i.test(text)) errors.push(`${f}: job-related copy`);
  if (/\p{Extended_Pictographic}/u.test(text)) errors.push(`${f}: emoji`);
  if (/class="badge"[^]*?tax-deductible[^]*?<\/p>/.test(text.match(/<p class="badge">[\s\S]*?<\/p>/)?.[0] || '')) errors.push(`${f}: tax-deductible on badge`);
  if (/seamless|empower|revolutioni|elevate|unlock/i.test(text)) errors.push(`${f}: banned marketing word`);
}
const css = readFileSync(new URL('./css/atlas.css', dist), 'utf8');
for (const [k, v] of Object.entries({ white: '#FFFFFF', black: '#000000', aqua: '#7BC8C8', lagoon: '#75B2B8', ocean: '#498995' }))
  if (!css.includes(`--${k}: ${v};`)) errors.push(`palette token --${k} changed`);
const hexes = [...css.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0].toUpperCase());
const extra = hexes.filter((h) => !['#FFFFFF', '#000000', '#7BC8C8', '#75B2B8', '#498995'].includes(h));
if (extra.length) errors.push(`atlas.css has non-palette hex: ${extra.join(', ')}`);
if (/gradient/i.test(css)) errors.push('atlas.css uses a gradient');
const sitemap = readFileSync(new URL('./sitemap.xml', dist), 'utf8');
for (const f of files) if (f !== '404.html' && !sitemap.includes(f === 'index.html' ? '/</loc>' : `/${f}</loc>`)) errors.push(`sitemap missing ${f}`);
console.log(`${files.length} pages, ${blocks} JSON-LD blocks parsed`);
if (errors.length) { console.log(errors.join('\n')); process.exit(1); }
console.log('All checks passed');
