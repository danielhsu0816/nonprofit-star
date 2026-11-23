// Shared HTML renderers for organization cards, events and the map.
// Used by build.mjs (static pages) and app.js (live results in the browser).
import { milesLabel, haversineMiles } from './rank.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const CAUSES = { food: 'Food', animals: 'Animals', education: 'Education', environment: 'Environment', children: 'Children' };
export const WAYS = { Money: 'Financial gifts', Time: 'Volunteer time', Food: 'Food donations', Blankets: 'Blankets' };
export const SITE_NOTE = "Confirm hours and sign-up on the organization's website.";

export const address = (s) => (s.cityOnly ? `${s.city}, ${s.state}` : `${s.street}, ${s.city}, ${s.state} ${s.zip}`);
export const host = (url) => url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
// Local actions go to the Arizona chapter site when there is one.
export const actionUrl = (org) => org.localWebsite || org.website;
export const waysText = (org) => org.ways.map((w) => WAYS[w] || w).join(' · ');
export const localSitesText = (sites) => [...new Set(sites.map((s) => `${s.city}, ${s.state}`))].join(' · ');

// org card. near: { site, miles, count } when the visitor has a location.
export function card(org, { sites = [], near = null, intents = [], featured = false } = {}) {
  const donateOnly = intents.includes('donate') && !intents.includes('volunteer');
  const facts = `<dl class="facts">${donateOnly
    ? `<dt>Ways to give</dt><dd>${esc(waysText(org))}</dd><dt>Program reach</dt><dd>${esc(org.reach)}</dd>`
    : `<dt>Program reach</dt><dd>${esc(org.reach)}</dd><dt>Ways to give</dt><dd>${esc(waysText(org))}</dd>`}${
    !near && sites.length ? `<dt>Local sites</dt><dd>${esc(localSitesText(sites))}</dd>` : ''}</dl>`;
  let nearBlock = '';
  if (near) {
    const s = near.site;
    nearBlock = `<div class="near"><span class="dist">${esc(milesLabel(near.miles))}</span>${near.count > 1 ? ` · nearest of ${near.count} sites` : ''}
<strong>${esc(s.name)}</strong>${s.cityOnly ? `${esc(address(s))} (city center)` : esc(address(s))}
${org.siteNote ? `<br>${esc(org.siteNote)}` : ''}<br>${esc(SITE_NOTE)}${
  org.localWebsite && !s.cityOnly ? `<br>Local chapter: <a href="${esc(org.localWebsite)}" rel="noopener" data-log="outbound" data-org="${esc(org.id)}">${esc(host(org.localWebsite))}</a>` : ''}</div>`;
  }
  const lead = donateOnly ? facts + nearBlock : nearBlock + facts;
  return `<li class="org${featured ? ' is-featured' : ''}" data-org="${esc(org.id)}">
<div class="body">
${featured ? '<img class="feat-star" src="/media/star-featured.svg" alt="" width="44" height="44"><span class="badge-sample">Featured · sample placement</span>' : ''}
<p class="tagline">${esc(org.tagline)}</p>
<h3><a href="/org-${esc(org.id)}.html">${esc(org.name)}</a></h3>
<p class="desc">${esc(org.description)}</p>
${lead}
<p><a class="out" href="${esc(org.website)}" rel="noopener" data-log="outbound" data-org="${esc(org.id)}">${esc(host(org.website))}<span class="visually-hidden">(official website)</span></a></p>
</div>
<div class="foot"><a href="/org-${esc(org.id)}.html">View organization profile</a></div>
</li>`;
}

// ---------- Events ----------
const fmt = (iso, opts) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', ...opts });
export const fmtDate = (iso) => fmt(iso, { weekday: 'short', month: 'short', day: 'numeric' });
export const dateBlock = (iso) => `<time class="date" datetime="${esc(iso)}"><span>${fmt(iso, { weekday: 'short' })}</span><b>${fmt(iso, { day: 'numeric' })}</b></time>`;
export const eventLabel = (e) => (e.sponsored ? 'Sponsored · sample event' : 'Sample event');

export function eventMiles(e, cities, origin) {
  const c = cities.find((c) => c.name === e.city);
  return origin && c ? haversineMiles(origin, c) : null;
}
const distText = (miles) => (miles != null ? ` · ${esc(milesLabel(miles))} (city center)` : '');

// Sponsored spotlight, as in the newsletter.
export function eventCard(e, miles) {
  return `<article class="spot"><div class="top"><span>Spotlight event</span><span class="pill-label">${esc(eventLabel(e))}</span></div>
<p class="when">${esc(fmtDate(e.date))} · ${esc(e.time)} · ${esc(e.city)}</p>
<h3>${esc(e.title)}</h3>
<p class="meta">${esc(e.blurb)}${distText(miles)}</p>
<p class="meta">Organizer: ${esc(e.organizer)} (fictional sample)</p></article>`;
}

export function eventRow(e, miles) {
  return `<li class="ev">${dateBlock(e.date)}<div><strong>${esc(e.title)}</strong>
<span class="meta">${esc(e.organizer)} · ${esc(e.city)} · ${esc(e.time)}${distText(miles)}</span>
<span class="tags">${(e.tags || []).map((t) => `<span>${esc(t)}</span>`).join('')}</span>
<span class="sample">${esc(eventLabel(e))}</span></div></li>`;
}

// Events sorted by date, then distance.
export function sortEvents(events, cities, origin) {
  return events
    .map((e) => ({ e, miles: eventMiles(e, cities, origin) }))
    .sort((a, b) => a.e.date.localeCompare(b.e.date) || (a.miles ?? 0) - (b.miles ?? 0));
}

// ---------- Map ----------
// Flat diagram from real coordinates: no tiles, no library.
const VB = 400, C = VB / 2, RING = 160;
function project(origin, scale, aspect) {
  const kx = 69.17 * Math.cos((origin.lat * Math.PI) / 180);
  return (p) => [C * aspect + (p.lng - origin.lng) * kx * scale, C - (p.lat - origin.lat) * 69 * scale];
}

export function mapSVG({ origin, radius, points = [], others = [], cities = [], you = true, ring = true, title = 'Map', aspect = 1, highlight = null }) {
  const far = points.length ? Math.max(...points.map((p) => haversineMiles(origin, p))) : radius;
  const view = Math.min(radius, Math.max(3, far * 1.2));
  const scale = RING / view;
  const ringPx = RING * (radius / view);
  const W = VB * aspect;
  const xy = project(origin, scale, aspect);
  const inView = ([x, y]) => x > 8 && x < W - 8 && y > 8 && y < VB - 8;
  const cityText = cities.map((c) => ({ c, p: xy(c) })).filter(({ p }) => inView(p))
    .map(({ c, p }) => `<text class="m-city${highlight === c.name ? ' is-on' : ''}" x="${p[0].toFixed(1)}" y="${(p[1] - 14).toFixed(1)}" text-anchor="middle">${esc(c.name)}</text>${points.length ? '' : `<circle class="m-other" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${highlight === c.name ? 7 : 4}"/>`}`).join('');
  const dots = others.map(xy).filter(inView).map(([x, y]) => `<circle class="m-other" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4"/>`).join('');
  const placed = [];
  const pins = points.map((pt) => {
    let [x, y] = xy(pt);
    for (const q of placed) if (Math.hypot(q[0] - x, q[1] - y) < 22) x += 20;
    placed.push([x, y]);
    if (!inView([x, y])) return '';
    return `<g class="m-pin" data-n="${pt.n}"><title>${pt.n}. ${esc(pt.name)}</title><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="12"/><text x="${x.toFixed(1)}" y="${(y + 4.5).toFixed(1)}" text-anchor="middle">${pt.n}</text></g>`;
  }).join('');
  const ringEl = !ring ? '' : ringPx <= C - 4
    ? `<circle class="m-ring" cx="${C * aspect}" cy="${C}" r="${ringPx.toFixed(1)}"/><text class="m-ring-label" x="${C * aspect}" y="${(C - ringPx - 6).toFixed(1)}" text-anchor="middle">${radius} miles</text>`
    : `<text class="m-ring-label" x="12" y="${VB - 12}">All inside ${radius} miles</text>`;
  const bar = Math.max(1, Math.round(view / 3));
  const scaleEl = `<g class="m-scale"><line x1="${W - 16 - bar * scale}" y1="${VB - 18}" x2="${W - 16}" y2="${VB - 18}"/><text x="${W - 16}" y="${VB - 24}" text-anchor="end">${bar} mi</text></g>`;
  const youEl = you ? `<image href="/media/mark-64.png" x="${C * aspect - 17}" y="${C - 17}" width="34" height="34"/><text class="m-you" x="${C * aspect}" y="${C + 30}" text-anchor="middle">You</text>` : '';
  return `<svg class="map" viewBox="0 0 ${W} ${VB}" role="img" aria-label="${esc(title)}">
<rect class="m-bg" width="${W}" height="${VB}"/>${ringEl}${cityText}${dots}${youEl}${pins}${scaleEl}</svg>`;
}

// One volunteer opportunity (a site) in the Volunteer tab, sorted by distance.
export function oppRow(site, org, miles, n) {
  const url = actionUrl(org);
  return `<li class="opp" data-n="${n}" id="o-${n}">
${distCell(miles)}
<div class="opp-body">
<p class="opp-tags"><span class="pin" aria-hidden="true">${n}</span>${esc(CAUSES[org.cause] || org.cause)}${site.cityOnly ? ' · City center only' : ''}</p>
<h3><a href="/org-${esc(org.id)}.html">${esc(org.name)}</a></h3>
<p class="opp-site"><strong>${esc(site.name)}</strong>${site.cityOnly ? ' (street address not listed)' : `<br>${esc(address(site))}`}${miles != null ? `<br><span class="dist">${esc(milesLabel(miles))}</span>` : ''}</p>
${org.siteNote ? `<p class="meta">${esc(org.siteNote)}</p>` : ''}
<p class="meta">${esc(SITE_NOTE)}</p>
<p class="actions"><a class="btn btn-ink" href="${esc(url)}" rel="noopener" data-log="outbound" data-org="${esc(org.id)}">Sign up on ${esc(host(url))}</a><a href="/org-${esc(org.id)}.html">Profile and FAQ</a></p>
</div></li>`;
}

// Big distance number; long numbers (100+ miles) get a smaller size so the column never overflows.
export function distCell(miles) {
  if (miles == null) return '<div class="opp-dist" aria-hidden="true"></div>';
  const m = Math.max(1, Math.round(miles));
  const txt = m.toLocaleString('en-US');
  return `<div class="opp-dist" data-d="${txt.length}" aria-hidden="true"><b>${txt}</b><span>mi</span></div>`;
}

const GIFT = { Money: 'Financial gifts', Food: 'Food donations', Blankets: 'Handmade blankets' };
// One organization on the Donate page. Links go to the organization's own donation page.
export function donateRow(org, near, n) {
  const giftWays = org.ways.filter((w) => GIFT[w]);
  const direct = !!org.donateUrl;
  const url = org.donateUrl || org.website;
  return `<li class="opp don" data-n="${n}">
${distCell(near ? near.miles : null)}
<div class="opp-body">
<p class="opp-tags">${esc(CAUSES[org.cause] || org.cause)} · ${esc(org.tagline)}</p>
<h3><a href="/org-${esc(org.id)}.html">${esc(org.name)}</a></h3>
<p class="desc">${esc(org.description)}</p>
<ul class="ways">${giftWays.map((w) => `<li>${esc(GIFT[w])}</li>`).join('')}</ul>
<p class="meta">Program reach: ${esc(org.reach)}${near ? ` · Nearest site: ${esc(near.site.name)}, ${esc(address(near.site))} (${esc(milesLabel(near.miles))})` : ''}</p>
<p class="actions"><a class="btn btn-ink" href="${esc(url)}" rel="noopener" data-log="outbound" data-org="${esc(org.id)}">${direct ? 'Donate' : 'Give'} on ${esc(host(url).replace(/\/.*$/, ''))}</a><a href="/org-${esc(org.id)}.html">Profile and FAQ</a></p>
<p class="meta">${direct ? "Opens the organization's own donation page." : "Opens the organization's website. We couldn't confirm a direct donation page, so look for its Donate button."}</p>
</div></li>`;
}
