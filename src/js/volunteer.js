// Volunteer tab: every volunteer site sorted by distance. Coordinates stay in this tab.
import { haversineMiles, milesLabel } from './rank.js';
import { oppRow, mapSVG, eventRow, sortEvents, esc } from './render.js';
import { load } from './store.js';

const $ = (id) => document.getElementById(id);
let DATA, PLACES = [];
const state = { origin: null, label: 'Phoenix, AZ', area: 'Phoenix, AZ', radius: null, cause: '' };

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
  const o = state.origin;
  let rows = DATA.sites.filter((s) => s.volunteer)
    .map((s) => ({ site: s, org: DATA.orgs.find((x) => x.id === s.org), miles: haversineMiles(o, s) }))
    .filter((x) => !state.cause || x.org.cause === state.cause)
    .sort((a, b) => a.miles - b.miles);
  const total = rows.length;
  if (state.radius) rows = rows.filter((x) => x.miles <= state.radius);
  $('opps').innerHTML = rows.map((x, i) => oppRow(x.site, x.org, x.miles, i + 1)).join('');
  const within = state.radius ? ` within ${state.radius} miles of ${state.label}` : `, closest to ${state.label} first`;
  $('v-status').textContent = `${rows.length} place${rows.length === 1 ? '' : 's'} to volunteer${within}`;
  if (!rows.length) {
    $('v-note').innerHTML = `<div class="notice" role="alert"><p>Nothing within ${state.radius} miles. ${total} places are listed farther away.</p><button type="button" class="btn" data-vradius="">Show all distances</button></div>`;
  } else $('v-note').textContent = '';
  const pts = rows.filter((x) => !x.site.cityOnly && x.miles < 120).map((x) => ({ n: rows.indexOf(x) + 1, id: x.org.id, name: `${x.org.name}, ${x.site.name}`, lat: x.site.lat, lng: x.site.lng }));
  $('v-map').innerHTML = mapSVG({ origin: o, radius: state.radius || 50, points: pts, cities: DATA.cities, title: `Map of places to volunteer near ${state.label}` });
  $('v-events').innerHTML = sortEvents(DATA.events.filter((e) => e.kind === 'volunteer'), DATA.cities, o).map(({ e, miles }) => eventRow(e, miles)).join('');
  window.__nsArea = state.area;
}

function setPlace(r) { state.origin = { lat: r.point.lat, lng: r.point.lng }; state.label = r.label; state.area = r.area; render(); }

$('vfinder').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const v = $('v-near').value;
  if (!v.trim()) { render(); return; }
  const r = resolve(v);
  if (r.error) { $('v-note').innerHTML = `<div class="notice" role="alert"><p>${r.error}</p></div>`; $('v-near').focus(); return; }
  setPlace(r);
});
$('v-radius').addEventListener('change', (e) => { state.radius = e.target.value ? Number(e.target.value) : null; render(); });
$('v-cause').addEventListener('change', (e) => { state.cause = e.target.value; render(); });
$('v-near').addEventListener('change', () => $('vfinder').requestSubmit());
document.addEventListener('click', (ev) => {
  const p = ev.target.closest('[data-vpreset]');
  if (p) { $('v-near').value = p.dataset.vpreset; $('vfinder').requestSubmit(); }
  const r = ev.target.closest('[data-vradius]');
  if (r) { $('v-radius').value = ''; state.radius = null; render(); }
});
$('v-geo').addEventListener('click', () => {
  const btn = $('v-geo');
  if (!('geolocation' in navigator)) { $('v-note').innerHTML = '<div class="notice" role="alert"><p>Your browser cannot share a location. Type a city or ZIP instead.</p></div>'; return; }
  btn.disabled = true; btn.textContent = 'Finding your location...';
  navigator.geolocation.getCurrentPosition((pos) => {
    btn.disabled = false; btn.textContent = 'Use my location';
    const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    let best = null; for (const c of PLACES) { const d = haversineMiles(p, c); if (!best || d < best.d) best = { c, d }; }
    state.origin = p; state.label = 'your location'; state.area = best ? `near ${best.c.name}, ${best.c.state}` : null;
    $('v-near').value = ''; render();
  }, (err) => {
    btn.disabled = false; btn.textContent = 'Use my location';
    $('v-note').innerHTML = `<div class="notice" role="alert"><p>${err.code === 1 ? 'Location access is blocked.' : 'We could not get your location.'} Type a city or ZIP, or use Phoenix, AZ.</p></div>`;
    $('v-near').focus();
  }, { timeout: 10000, maximumAge: 600000 });
});

(async function start() {
  try { DATA = await (await fetch('/data/directory.json')).json(); } catch { return; }
  const seen = new Set();
  PLACES = [...DATA.cities, ...DATA.sites.filter((s) => s.cityOnly).map((s) => ({ name: s.city, state: s.state, lat: s.lat, lng: s.lng }))]
    .filter((p) => { const k = `${p.name},${p.state}`; if (seen.has(k)) return false; seen.add(k); return true; });
  state.origin = DATA.cities.find((c) => c.name === 'Phoenix');
  // Start from the place answered in the first-visit questions, if any.
  const a = load('ns:onboard');
  if (a?.near) { const r = resolve(a.near); if (!r.error) { $('v-near').value = r.label.replace(/ \(.*\)$/, ''); setPlace(r); return; } }
})();
