// Donate tab: organizations that accept gifts, nearest first. Coordinates stay in this tab.
import { haversineMiles } from './rank.js';
import { donateRow, eventRow, sortEvents, esc } from './render.js';
import { load } from './store.js';

const $ = (id) => document.getElementById(id);
const GIFT_WAYS = ['Money', 'Food', 'Blankets'];
const NEAR_MAX = 60; // miles: closer than this counts as "near you"
let DATA, PLACES = [];
const state = { origin: null, label: 'Phoenix, AZ', q: '', cause: '', way: '' };

function resolve(text) {
  const raw = text.trim();
  if (/^\d{5}$/.test(raw)) {
    const s = DATA.sites.find((x) => x.zip === raw);
    return s ? { point: s, label: `${raw} (${s.city})`, area: raw } : { error: `We don't have ZIP ${esc(raw)} yet. Try a city name.` };
  }
  const q = raw.toLowerCase();
  const p = PLACES.find((c) => `${c.name}, ${c.state}`.toLowerCase() === q || c.name.toLowerCase() === q.replace(/,?\s*(az|arizona)$/, ''));
  return p ? { point: p, label: `${p.name}, ${p.state}`, area: `${p.name}, ${p.state}` }
    : { error: `We don't have "${esc(raw)}" yet. Try Phoenix, Tempe, Scottsdale, Surprise, Mesa or Glendale.` };
}

function render() {
  const q = state.q.trim().toLowerCase();
  const givers = DATA.orgs.filter((o) => o.ways.some((w) => GIFT_WAYS.includes(w)))
    .filter((o) => !q || `${o.name} ${o.tagline} ${o.description}`.toLowerCase().includes(q))
    .filter((o) => !state.cause || o.cause === state.cause)
    .filter((o) => !state.way || o.ways.includes(state.way));
  const rows = givers.map((org) => {
    let best = null;
    for (const s of DATA.sites.filter((x) => x.org === org.id)) { const m = haversineMiles(state.origin, s); if (!best || m < best.miles) best = { site: s, miles: m }; }
    return { org, near: best && best.miles <= NEAR_MAX ? best : null };
  });
  const local = rows.filter((x) => x.near).sort((a, b) => a.near.miles - b.near.miles);
  const rest = rows.filter((x) => !x.near).sort((a, b) => a.org.name.localeCompare(b.org.name));
  $('d-local-title').textContent = local.length ? `Near ${state.label}` : `Nothing within ${NEAR_MAX} miles of ${state.label}`;
  $('d-local').innerHTML = local.map((x, i) => donateRow(x.org, x.near, i + 1)).join('');
  $('d-rest').innerHTML = rest.map((x, i) => donateRow(x.org, null, local.length + i + 1)).join('');
  $('d-rest-title').hidden = !rest.length;
  $('d-note').innerHTML = rows.length ? '' : '<div class="notice" role="alert"><p>No organization matches these filters.</p></div>';
  $('d-events').innerHTML = sortEvents(DATA.events.filter((e) => e.kind === 'donate'), DATA.cities, state.origin).map(({ e, miles }) => eventRow(e, miles)).join('');
}

function setPlace(r) { state.origin = { lat: r.point.lat, lng: r.point.lng }; state.label = r.label; window.__nsArea = r.area; render(); }

$('dfinder').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const v = $('d-near').value;
  if (!v.trim()) { render(); return; }
  const r = resolve(v);
  if (r.error) { $('d-note').innerHTML = `<div class="notice" role="alert"><p>${r.error}</p></div>`; $('d-near').focus(); return; }
  setPlace(r);
});
let t;
$('d-q').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => { state.q = e.target.value; render(); }, 150); });
$('d-cause').addEventListener('change', (e) => { state.cause = e.target.value; render(); });
$('d-way').addEventListener('change', (e) => { state.way = e.target.value; render(); });
$('d-near').addEventListener('change', () => $('dfinder').requestSubmit());
document.addEventListener('click', (ev) => {
  const p = ev.target.closest('[data-dpreset]');
  if (p) { $('d-near').value = p.dataset.dpreset; $('dfinder').requestSubmit(); }
});
$('d-geo').addEventListener('click', () => {
  const btn = $('d-geo');
  if (!('geolocation' in navigator)) { $('d-note').innerHTML = '<div class="notice" role="alert"><p>Your browser cannot share a location. Type a city or ZIP instead.</p></div>'; return; }
  btn.disabled = true; btn.textContent = 'Finding your location...';
  navigator.geolocation.getCurrentPosition((pos) => {
    btn.disabled = false; btn.textContent = 'Use my location';
    const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    let best = null; for (const c of PLACES) { const d = haversineMiles(p, c); if (!best || d < best.d) best = { c, d }; }
    state.origin = p; state.label = 'your location'; window.__nsArea = best ? `near ${best.c.name}, ${best.c.state}` : null;
    $('d-near').value = ''; render();
  }, (err) => {
    btn.disabled = false; btn.textContent = 'Use my location';
    $('d-note').innerHTML = `<div class="notice" role="alert"><p>${err.code === 1 ? 'Location access is blocked.' : 'We could not get your location.'} Type a city or ZIP, or use Phoenix, AZ.</p></div>`;
    $('d-near').focus();
  }, { timeout: 10000, maximumAge: 600000 });
});

(async function start() {
  try { DATA = await (await fetch('/data/directory.json')).json(); } catch { return; }
  const seen = new Set();
  PLACES = [...DATA.cities, ...DATA.sites.filter((s) => s.cityOnly).map((s) => ({ name: s.city, state: s.state, lat: s.lat, lng: s.lng }))]
    .filter((p) => { const k = `${p.name},${p.state}`; if (seen.has(k)) return false; seen.add(k); return true; });
  state.origin = DATA.cities.find((c) => c.name === 'Phoenix');
  const a = load('ns:onboard');
  if (a?.near) { const r = resolve(a.near); if (!r.error) { $('d-near').value = r.label.replace(/ \(.*\)$/, ''); setPlace(r); } }
})();
