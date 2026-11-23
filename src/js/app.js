// Home page: onboarding, directory filters, location, ranking and results.
// Exact coordinates stay in memory in this tab. They are never sent to /api/* or stored.
import { rank, RANKING, haversineMiles, matchesIntent } from './rank.js';
import { card, eventCard, eventRow, sortEvents, esc, CAUSES } from './render.js';
import { openOnboarding, storedAnswers } from './onboarding.js';

const $ = (id) => document.getElementById(id);
const form = $('finder');
const state = { q: '', causes: [], reach: '', way: '', origin: null, label: '', area: null, radius: RANKING.defaultRadius, radiusTouched: false, answers: null };
let DATA = null;
let PLACES = [];

const intents = () => (state.way ? [state.way] : []);
const sitesOf = (id) => DATA.sites.filter((s) => s.org === id);
function setStatus(text, note = '') { $('status').textContent = text; $('status-note').innerHTML = note; }
const notice = (html) => `<div class="notice" role="alert">${html}</div>`;
function phrase(n) {
  const noun = n === 1 ? 'place' : 'places';
  if (state.way === 'volunteer') return `${n} ${noun} to volunteer`;
  if (state.way === 'donate') return `${n} ${noun} to give`;
  return `${n} ${noun} to volunteer or give`;
}
function log(kind, extra = {}) {
  // City or ZIP only, never coordinates.
  const body = JSON.stringify({ kind, area: state.area, intents: intents(), causes: state.causes, ...extra });
  fetch('/api/log', { method: 'POST', headers: { 'content-type': 'application/json' }, body }).catch(() => {});
}

function pool() {
  const q = state.q.trim().toLowerCase();
  return DATA.orgs.filter((o) =>
    (!q || `${o.name} ${o.tagline} ${o.description} ${o.cause}`.toLowerCase().includes(q)) &&
    (!state.causes.length || state.causes.includes(o.cause)) &&
    (!state.reach || o.reach === state.reach));
}

// Returns a short summary used by the onboarding "finding" screen.
function render() {
  if (!DATA) return { count: 0 };
  window.__nsArea = state.area;
  const it = intents();
  const orgs = pool();
  let count;
  let reveal = 0;
  if (!state.origin) {
    const matched = orgs.filter((o) => matchesIntent(o, it));
    const featured = matched.filter((o) => RANKING.sampleFeatured.includes(o.id)).slice(0, RANKING.featuredMax);
    const fIds = new Set(featured.map((o) => o.id));
    $('featured').innerHTML = featured.map((o) => card(o, { sites: sitesOf(o.id), featured: true, intents: it })).join('');
    $('featured-wrap').hidden = !featured.length;
    $('list').innerHTML = matched.filter((o) => !fIds.has(o.id)).map((o) => card(o, { sites: sitesOf(o.id), intents: it })).join('');
    $('list-title').textContent = 'All organizations';
    $('remote-wrap').hidden = true;
    count = matched.length;
    setStatus(`${count} organization${count === 1 ? '' : 's'}`, count ? '' : notice('<p>No organization matches these filters.</p><button type="reset" form="finder" class="btn">Reset filters</button>'));
  } else {
    const r = rank({ orgs, sites: DATA.sites, origin: state.origin, intents: it, causes: state.causes, radius: state.radiusTouched ? state.radius : null });
    $('f-radius').value = String(r.radius);
    state.radius = r.radius;
    const near = (x) => ({ site: x.site, miles: x.miles, count: x.siteCount });
    $('featured').innerHTML = r.featured.map((x) => card(x.org, { near: near(x), featured: true, intents: it })).join('');
    $('featured-wrap').hidden = !r.featured.length;
    $('list').innerHTML = r.local.map((x) => card(x.org, { near: near(x), intents: it })).join('');
    $('list-title').textContent = r.local.length ? 'More matches nearby' : '';
    $('remote').innerHTML = r.remote.map((x) => card(x.org, { sites: [], intents: it })).join('');
    $('remote-wrap').hidden = !r.remote.length;
    count = r.featured.length + r.local.length;
    if (!count) {
      const wider = RANKING.radii.filter((x) => x > r.radius);
      setStatus(`No places within ${r.radius} miles of ${state.label}`, notice(`<p>${wider.length ? 'Try a wider radius:' : 'Try another city or clear the filters.'}</p>${wider.map((w) => `<button type="button" class="btn" data-radius="${w}">${w} miles</button>`).join('')}`));
    } else {
      setStatus(`${phrase(count)} within ${r.radius} miles of ${state.label}`,
        r.widened ? `Fewer than ${RANKING.minResults} places are within ${RANKING.defaultRadius} miles, so we widened the search to ${r.radius} miles.` : '');
    }
  }
  document.querySelectorAll('#results .org').forEach((el, i) => { if (i < 9) el.style.setProperty('--i', i); reveal++; });
  const origin = state.origin || DATA.cities.find((c) => c.name === 'Phoenix');
  $('sponsored').innerHTML = sortEvents(DATA.events.filter((e) => e.sponsored), DATA.cities, origin)
    .sort((a, b) => a.miles - b.miles).slice(0, 3).map(({ e, miles }) => eventCard(e, miles)).join('');
  $('vol-events').innerHTML = sortEvents(DATA.events.filter((e) => e.kind === 'volunteer'), DATA.cities, origin)
    .map(({ e, miles }) => eventRow(e, miles)).join('');
  renderPrefs();
  return { count, radius: state.radius };
}

// "Your answers" line above the results.
const ROLE = { supporter: 'Volunteer or donor', nonprofit: 'Nonprofit', guest: 'Guest' };
const WAYS = { Time: 'volunteer time', Money: 'give money', Food: 'donate food or items' };
function renderPrefs() {
  const a = state.answers;
  const line = $('prefs-line');
  if (!a || a.skipped) { line.innerHTML = 'Want results that fit you? <button type="button" class="btn-link" data-edit-answers>Answer 4 quick questions</button>'; line.hidden = false; return; }
  const bits = [ROLE[a.role] || 'Guest'];
  if (a.causes?.length) bits.push(a.causes.map((c) => CAUSES[c]).join(', '));
  if (a.role !== 'nonprofit' && a.ways?.length) bits.push(a.ways.map((w) => WAYS[w]).join(', '));
  bits.push(state.origin ? `near ${state.label}` : 'anywhere');
  line.innerHTML = `<span>Showing results for: <strong>${esc(bits.join(' · '))}</strong></span> <button type="button" class="btn-link" data-edit-answers>Edit answers</button>`;
  line.hidden = false;
  const np = $('np-banner');
  if (a.role === 'nonprofit') {
    const g = a.goals || [];
    const tips = [
      g.includes('listing') || !g.length ? '<a class="btn btn-ink" href="/pricing.html">Request a free listing</a>' : '',
      g.includes('featured') ? '<a class="btn" href="/pricing.html">See Featured placement</a>' : '',
      g.includes('analytics') ? '<a class="btn" href="/dashboard.html">Preview the Premium dashboard</a>' : '',
      g.includes('event') ? '<a class="btn" href="/arizona-issue-01.html">See how event promotion looks</a>' : '',
    ].join('');
    np.innerHTML = `<div><p class="eyebrow">For your organization</p><p>Below is what visitors see in ${a.causes?.length ? esc(a.causes.map((c) => CAUSES[c]).join(', ')) : 'your causes'}. Here's where to start:</p></div><div class="np-actions">${tips}</div>`;
    np.hidden = false;
  } else np.hidden = true;
}

// City name, "City, ST" or ZIP -> point.
function resolve(text) {
  const raw = text.trim();
  if (!raw) return { error: 'Type a city or 5-digit ZIP, or choose Phoenix, AZ.' };
  if (/^\d{5}$/.test(raw)) {
    const s = DATA.sites.find((x) => x.zip === raw);
    return s ? { point: { lat: s.lat, lng: s.lng }, label: `${raw} (${s.city})`, area: raw, nearLabel: raw }
      : { error: `We don't have ZIP ${esc(raw)} yet. Try a city name such as Phoenix, Tempe, Scottsdale or Surprise.` };
  }
  const q = raw.toLowerCase().replace(/\s+/g, ' ');
  const p = PLACES.find((c) => `${c.name}, ${c.state}`.toLowerCase() === q || c.name.toLowerCase() === q.replace(/,?\s*(az|arizona)$/, ''));
  if (p) return { point: { lat: p.lat, lng: p.lng }, label: `${p.name}, ${p.state}`, area: `${p.name}, ${p.state}`, nearLabel: `${p.name}, ${p.state}` };
  return { error: `We don't have "${esc(raw)}" yet. Try Phoenix, Tempe, Scottsdale, Surprise, Mesa or Glendale, or a ZIP code.` };
}
function nearestPlace(p) {
  let best = null;
  for (const c of PLACES) { const d = haversineMiles(p, c); if (!best || d < best.d) best = { c, d }; }
  return best ? `${best.c.name}, ${best.c.state}` : null;
}
function geolocate() {
  return new Promise((resolveP, reject) => {
    if (!('geolocation' in navigator)) { reject(new Error('Your browser cannot share a location.')); return; }
    navigator.geolocation.getCurrentPosition((pos) => {
      const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      const n = nearestPlace(p);
      resolveP({ point: p, label: 'your location', area: n ? `near ${n}` : null, nearLabel: n });
    }, (err) => reject(new Error(err.code === 1 ? 'Location access is blocked.' : err.code === 3 ? 'Finding your location took too long.' : 'We could not get your location.')),
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 });
  });
}
function setPlace(place) {
  if (place) { state.origin = place.point; state.label = place.label; state.area = place.area; }
  else { state.origin = null; state.label = ''; state.area = null; }
}
const goToResults = (instant) => $('match').scrollIntoView({ behavior: instant ? 'instant' : 'smooth', block: 'start' });

// Apply onboarding answers to the filters.
function applyAnswers(a, place) {
  state.answers = a;
  if (a && !a.skipped) {
    state.causes = a.causes || [];
    const ways = a.role === 'nonprofit' ? [] : a.ways || [];
    const time = ways.includes('Time'), give = ways.includes('Money') || ways.includes('Food');
    state.way = time && !give ? 'volunteer' : give && !time ? 'donate' : '';
    if (place) setPlace(place);
    else if (a.near) { const r = resolve(a.near); setPlace(r.error ? null : r); }
    else setPlace(null);
  }
  syncForm();
}
function syncForm() {
  const sel = $('f-cause');
  sel.querySelector('option[value="__mine"]')?.remove();
  if (state.causes.length > 1) {
    sel.insertAdjacentHTML('beforeend', `<option value="__mine">Your causes: ${esc(state.causes.map((c) => CAUSES[c]).join(', '))}</option>`);
    sel.value = '__mine';
  } else sel.value = state.causes[0] || '';
  $('f-way').value = state.way;
  $('f-near').value = state.origin && state.label !== 'your location' ? state.label.replace(/ \(.*\)$/, '') : '';
}

function startOnboarding(prefill = null) {
  openOnboarding({
    resolve, geolocate, prefill,
    onDone(answers, place) {
      applyAnswers(answers, place);
      const { count, radius } = render();
      goToResults(true);
      if (answers.skipped) return { headline: '', text: '' };
      log('onboarding', { role: answers.role });
      if (answers.role === 'nonprofit') return { headline: 'Here is what visitors will see.', text: 'Next, we will show your options for getting found.' };
      const where = state.origin ? ` within ${radius} miles of ${state.label}` : '';
      return { headline: count ? `We found ${phrase(count)}${where}.` : 'Nothing matches yet.', text: count ? 'Taking you there now.' : 'We will show you everything instead. You can widen your search anytime.' };
    },
  });
}

// ---- Filters ----
form.addEventListener('submit', (ev) => {
  ev.preventDefault();
  const nearText = $('f-near').value;
  if (!nearText.trim()) { setPlace(null); render(); return; }
  const res = resolve(nearText);
  if (res.error) { setStatus('Check the place you typed', notice(`<p>${res.error}</p><button type="button" class="btn" data-preset="Phoenix, AZ">Use Phoenix, AZ</button>`)); $('f-near').focus(); return; }
  setPlace(res); render(); log('search');
});
form.addEventListener('change', (ev) => {
  const t = ev.target;
  if (t.id === 'f-cause') { if (t.value !== '__mine') state.causes = t.value ? [t.value] : []; }
  else if (t.id === 'f-reach') state.reach = t.value;
  else if (t.id === 'f-way') state.way = t.value;
  else if (t.id === 'f-radius') { state.radius = Number(t.value); state.radiusTouched = true; }
  else if (t.id === 'f-near') { form.requestSubmit(); return; }
  else return;
  render();
});
let qTimer;
$('f-q').addEventListener('input', (ev) => { clearTimeout(qTimer); qTimer = setTimeout(() => { state.q = ev.target.value; render(); }, 150); });
form.addEventListener('reset', () => setTimeout(() => {
  Object.assign(state, { q: '', causes: [], reach: '', way: '', origin: null, label: '', area: null, radius: RANKING.defaultRadius, radiusTouched: false });
  syncForm(); render();
}));
$('hero-search').addEventListener('submit', (ev) => {
  ev.preventDefault();
  state.q = $('hero-q').value; $('f-q').value = state.q; render(); goToResults();
});
document.addEventListener('click', async (ev) => {
  if (ev.target.closest('[data-edit-answers]')) { startOnboarding(state.answers && !state.answers.skipped ? state.answers : null); return; }
  const geo = ev.target.closest('[data-geo]');
  if (geo) {
    goToResults(); setStatus('Finding your location...');
    document.querySelectorAll('[data-geo]').forEach((b) => { b.disabled = true; });
    try { setPlace(await geolocate()); syncForm(); render(); log('search'); }
    catch (e) { setStatus('Location not available', notice(`<p>${e.message} Type a city or ZIP in "Near", or use Phoenix, AZ.</p><button type="button" class="btn" data-preset="Phoenix, AZ">Use Phoenix, AZ</button>`)); $('f-near').focus(); }
    finally { document.querySelectorAll('[data-geo]').forEach((b) => { b.disabled = false; }); }
    return;
  }
  const preset = ev.target.closest('[data-preset]');
  if (preset) { $('f-near').value = preset.dataset.preset; form.requestSubmit(); goToResults(); return; }
  const r = ev.target.closest('[data-radius]');
  if (r) { state.radius = Number(r.dataset.radius); state.radiusTouched = true; render(); }
});

(async function start() {
  try {
    const res = await fetch('/data/directory.json');
    if (!res.ok) throw new Error(res.status);
    DATA = await res.json();
  } catch {
    setStatus('The directory did not load', notice('<p>The list below is the saved copy. Reload the page to filter or search by location.</p>'));
    return;
  }
  const seen = new Set();
  PLACES = [...DATA.cities, ...DATA.sites.filter((s) => s.cityOnly).map((s) => ({ name: s.city, state: s.state, lat: s.lat, lng: s.lng }))]
    .filter((p) => { const k = `${p.name},${p.state}`; if (seen.has(k)) return false; seen.add(k); return true; });
  const saved = storedAnswers();
  if (saved) { applyAnswers(saved, null); render(); }
  else { render(); startOnboarding(); }
})();
