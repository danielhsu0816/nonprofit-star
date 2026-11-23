// Static site generator. Writes every page into dist/ at build time.
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync } from 'node:fs';
import { SITE_ORIGIN, SITE_NAME, IRS_TEOS, TAX_NOTE, mapsEmbedBase } from './config.mjs';
import { layout, crumbs } from './lib/layout.mjs';
import * as S from './lib/schema.mjs';
import { rank, RANKING, haversineMiles } from './src/js/rank.js';
import { esc, card, CAUSES, WAYS, SITE_NOTE, address, actionUrl, host, waysText, eventCard, eventRow, sortEvents, fmtDate, mapSVG, oppRow, donateRow } from './src/js/render.js';

const read = (f) => JSON.parse(readFileSync(new URL(f, import.meta.url)));
const TODAY = new Date().toLocaleDateString('en-CA'); // local YYYY-MM-DD
const orgs = read('./data/orgs.json').map((o) => ({ ...o, updated: TODAY })).sort((a, b) => a.name.localeCompare(b.name));
const sites = read('./data/sites.json');
const { cities } = read('./data/places.json');
const EV = read('./data/events.json');
const { issue, events } = EV;

const OUT = new URL('./dist/', import.meta.url);
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const pages = [];
function emit(path, html, meta) {
  writeFileSync(new URL('.' + path, OUT), html);
  if (meta) pages.push({ path, ...meta });
}
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const sitesOf = (org) => sites.filter((s) => s.org === org.id);
const azSites = sites.filter((s) => !s.cityOnly); // street-address sites from the address table
const orgById = Object.fromEntries(orgs.map((o) => [o.id, o]));
const list = (arr) => arr.length <= 1 ? arr.join('') : arr.slice(0, -1).join(', ') + (arr.length > 2 ? ',' : '') + ' and ' + arr.at(-1);
const siteCities = [...new Set(azSites.map((s) => s.city))];
const PHOENIX = cities.find((c) => c.name === 'Phoenix');
const lastUpdated = `<p class="meta">Last updated <time datetime="${TODAY}">${fmtDate(TODAY)}, ${TODAY.slice(0, 4)}</time>.</p>`;
const clip = (s, n = 155) => (s.length > n ? s.slice(0, n - 3).replace(/\s+\S*$/, '') + '...' : s);
const waysLower = (org) => waysText(org).toLowerCase().replace(/ · /g, ', ');

function faqBlock(qas) {
  return `<section aria-labelledby="faq"><h2 id="faq">Questions</h2><dl class="faq">${qas.map(([q, a]) => `<dt>${esc(q)}</dt><dd>${esc(a)}</dd>`).join('')}</dl></section>`;
}
const verifyBadge = (org) => `<div class="badge"><strong>501(c)(3) status: Verification preview</strong>We have not checked ${esc(org.name)}'s EIN yet. <a href="${IRS_TEOS}" rel="noopener">Look it up in the IRS Tax Exempt Organization Search</a></div>`;
const taxNote = `<p class="taxnote"><strong>Giving in 2026.</strong> ${esc(TAX_NOTE)}</p>`;
const siteLi = (s, org, n) => `<li><span class="pin" aria-hidden="true">${n}</span><div><p><strong>${esc(s.name)}</strong></p><p>${esc(address(s))}${s.cityOnly ? ' (city center; street address not listed)' : ''}</p>${org.siteNote ? `<p class="meta">${esc(org.siteNote)}</p>` : ''}<p class="meta">${esc(SITE_NOTE)}</p></div></li>`;

function areaMap(points, title) {
  if (!points.length) return '';
  const origin = { lat: points.reduce((a, p) => a + p.lat, 0) / points.length, lng: points.reduce((a, p) => a + p.lng, 0) / points.length };
  const far = Math.max(...points.map((p) => haversineMiles(origin, p)));
  if (far > 80) return '';
  return mapSVG({ origin, radius: Math.max(4, Math.ceil(far * 1.35)), points, cities, you: false, ring: false, title });
}
const causeCount = (c) => orgs.filter((o) => o.cause === c).length;

// Newer, sharper photos for some cause tiles; the rest keep the original site images.
const TILE_IMG = { food: 'cause-food-2.jpg', animals: 'cause-animals-2.jpg', environment: 'cause-environment-2.jpg' };
const headPhoto = (src, alt, pos = '50% 50%') => `<figure class="head-photo"><img src="/media/${src}" alt="${alt}" width="1400" height="1050" style="object-position:${pos}" fetchpriority="high"></figure>`;

// ---------- Home ----------
function home() {
  const sponsored = sortEvents(events.filter((e) => e.sponsored), cities, PHOENIX);
  const volunteerEvents = sortEvents(events.filter((e) => e.kind === 'volunteer'), cities, PHOENIX);
  const def = rank({ orgs, sites, origin: PHOENIX, intents: [], causes: [] });
  const featured = def.featured;
  const featuredIds = new Set(featured.map((x) => x.org.id));
  const reaches = [...new Set(orgs.map((o) => o.reach))].sort();
  const nearOptions = [...new Set(sites.map((s) => `${s.city}, ${s.state}`))].sort();
  const body = `
<section class="panel" aria-labelledby="hero-title" style="margin-top:var(--s-6)">
<div class="hero" style="margin-top:0">
<div>
<p class="eyebrow">Nonprofit Star / Nonprofit directory</p>
<h1 id="hero-title">Find a nonprofit you care about.</h1>
<p class="lede">Discover nonprofits working on hunger, animal welfare, education, the environment and children's well-being. Choose where and how you want to help.</p>
<form id="hero-search" role="search">
<label for="hero-q">Search by organization or mission</label>
<div class="search-row"><input type="search" id="hero-q" placeholder="Try food rescue or classroom supplies"><button class="btn btn-ink" type="submit">Search directory</button></div>
</form>
<p class="near-row"><span>Looking nearby?</span><button type="button" class="btn" data-geo>Use my location</button><button type="button" class="btn" data-preset="Phoenix, AZ">Phoenix, AZ</button></p>
<div class="hero-count"><p><b>${orgs.length}</b> nonprofits currently listed</p><p class="meta">We welcome new nonprofits across all five causes. <a href="/pricing.html">Apply for a free listing</a></p></div>
</div>
<div class="collage">
<figure class="c-tall"><img src="/media/home-basket.jpg" alt="A woman in a sun helmet lifts a yellow basket from the surf" width="700" height="1050" fetchpriority="high"></figure>
<figure class="c-wide"><img src="/media/home-aid.jpg" alt="Volunteers pack food and aid boxes on a table behind a van for neighbors" width="1400" height="1013"><figcaption>Food</figcaption></figure>
<figure class="c-wide"><img src="/media/home-beach.jpg" alt="A volunteer in gloves picks up litter on a beach next to a bucket" width="900" height="599"><figcaption>Environment</figcaption></figure>
</div>
</div>
</section>

<h2>Explore by cause</h2>
<div class="tiles">${Object.entries(CAUSES).map(([k, v]) => `<a class="tile" href="/${k}.html"><img src="/media/${TILE_IMG[k] || `cause-${k}.jpg`}" alt="" width="180" height="116" loading="lazy"><span><small>${causeCount(k)} organizations</small><b>${v}</b></span></a>`).join('')}</div>

<h2>This week near you</h2>
<div class="week">
<section aria-labelledby="sp-title"><h3 id="sp-title" class="visually-hidden">Sponsored events near you</h3><div id="sponsored">${sponsored.map(({ e, miles }) => eventCard(e, miles)).join('')}</div>
<p class="meta" style="margin-top:var(--s-2)">Sponsored events near you. Sample events, shown the same way they appear in the <a href="/arizona-issue-01.html">Arizona Weekly sample issue</a>.</p></section>
<section aria-labelledby="ve-title" class="box">
<h3 id="ve-title" style="font-size:var(--fs-2)">Volunteer events near you</h3>
<p class="meta">Sample events, sorted by date and distance.</p>
<ul class="ev-list" id="vol-events">${volunteerEvents.map(({ e, miles }) => eventRow(e, miles)).join('')}</ul>
<form class="optin" id="optin" novalidate>
<label class="check"><input type="checkbox" id="optin-check"> Send me upcoming volunteer events near me.</label>
<div class="email-row" id="optin-fields" hidden><div><label for="optin-email">Email</label><input type="email" id="optin-email" autocomplete="email" required></div><button type="submit" class="btn btn-ink">Subscribe</button></div>
<p class="meta" id="optin-msg" role="status"></p>
<p class="meta" style="margin:0">Matched by area only. Demo: no email is sent. <a href="/privacy.html">Privacy</a></p>
</form>
</section>
</div>

<h2 id="match">Find your giving match</h2>
<form class="filters" id="finder" novalidate>
<div><label for="f-q">Search</label><input type="search" id="f-q" name="q" placeholder="Name or mission"></div>
<div><label for="f-cause">Cause</label><select id="f-cause" name="cause"><option value="">All causes</option>${Object.entries(CAUSES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
<div><label for="f-reach">Program reach</label><select id="f-reach" name="reach"><option value="">All regions</option>${reaches.map((r) => `<option>${esc(r)}</option>`).join('')}</select></div>
<div><label for="f-way">Way to give</label><select id="f-way" name="way"><option value="">All ways to give</option><option value="volunteer">Volunteer time</option><option value="donate">Money or food</option></select></div>
<div><label for="f-near">Near (city or ZIP)</label><input type="text" id="f-near" name="near" list="near-list" placeholder="Tempe, AZ or 85281" autocomplete="postal-code"><datalist id="near-list">${nearOptions.map((c) => `<option value="${esc(c)}">`).join('')}</datalist></div>
<div><label for="f-radius">Within</label><select id="f-radius" name="radius">${RANKING.radii.map((r) => `<option value="${r}"${r === RANKING.defaultRadius ? ' selected' : ''}>${r} miles</option>`).join('')}</select></div>
<div class="actions"><button type="submit" class="btn btn-ink">Search</button><button type="button" class="btn btn-black" data-geo>Use my location</button><button type="button" class="btn" data-preset="Phoenix, AZ">Phoenix, AZ</button><button type="reset" class="btn">Reset</button></div>
</form>
<p class="near-hint">Your exact location stays in this browser. We only use it to measure distances.</p>
<div id="prefs-line" class="prefs-line" hidden></div>
<div id="np-banner" class="np-banner" hidden></div>
<div id="results" aria-live="polite">
<p class="status" id="status">${orgs.length} organizations</p>
<div class="status-note" id="status-note"></div>
<div id="featured-wrap"${featured.length ? '' : ' hidden'}><h3 class="group-title" style="margin-top:0">Featured</h3><p class="meta">Sample placements that show how paid listings look. These organizations are not paying customers.</p><ul class="grid" id="featured">${featured.map((x) => card(x.org, { sites: sitesOf(x.org), featured: true })).join('')}</ul></div>
<h3 class="group-title" id="list-title">All organizations</h3>
<ul class="grid" id="list">${orgs.filter((o) => !featuredIds.has(o.id)).map((o) => card(o, { sites: sitesOf(o) })).join('')}</ul>
<div id="remote-wrap" hidden><h3 class="group-title">Nationwide and online</h3><p class="meta">No listed site within your radius. You can still give or help online.</p><ul class="grid" id="remote"></ul></div>
</div>

<dialog id="onb" class="onb" aria-labelledby="onb-q">
<div class="onb-side">
<div class="onb-slides" aria-hidden="true"><img src="/media/onb-1.jpg" alt="A woman in a sun helmet lifts a basket of fish from the surf" width="1000" height="1500" class="is-on" decoding="async"><img src="/media/onb-2.jpg" alt="Five volunteers with garbage bags and gloves in a green field" width="1000" height="1500" loading="lazy" decoding="async"><img src="/media/onb-3.jpg" alt="Volunteers in matching shirts pour water and pack boxes" width="1000" height="1500" loading="lazy" decoding="async"><img src="/media/onb-4.jpg" alt="A volunteer in a blue shirt holds a potted plant" width="1000" height="1500" loading="lazy" decoding="async"><img src="/media/onb-5.jpg" alt="Cupped hands hold a paper heart half" width="1000" height="1500" loading="lazy" decoding="async"><img src="/media/onb-6.jpg" alt="Two puppies look through an open blue wooden door" width="1000" height="1500" loading="lazy" decoding="async"></div>
<div class="onb-card">
<img class="onb-logo" src="/media/logo.png" alt="Nonprofit Star" width="187" height="40">
<div class="onb-progress" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
<p class="onb-count" id="onb-count">Question 1 of 4</p>
<p class="onb-tag">Four quick questions, then we'll show you places that fit. Your answers stay in this browser.</p>
<button type="button" class="btn-link onb-skip" data-onb="skip">Skip the survey</button>
</div>
</div>
<form class="onb-main" id="onb-form" novalidate>
<fieldset class="onb-step" data-step="1">
<legend><h2 id="onb-q" tabindex="-1">Who are you?</h2></legend>
<p class="onb-hint">This helps us show the right things first.</p>
<div class="onb-choices">
<label class="choice"><input type="radio" name="role" value="supporter"><span><b>A volunteer or donor</b>I want to give my time or money to a cause.</span></label>
<label class="choice"><input type="radio" name="role" value="nonprofit"><span><b>A nonprofit</b>I represent an organization that wants to be found.</span></label>
<label class="choice"><input type="radio" name="role" value="guest"><span><b>A guest</b>I'm just exploring for now.</span></label>
</div>
<p class="onb-skip-row"><button type="button" class="btn" data-onb="skip">Skip the survey</button> <span class="meta">You can answer later from the results page.</span></p>
</fieldset>
<fieldset class="onb-step" data-step="2" hidden>
<legend><h2 tabindex="-1" data-q-supporter="Which causes do you care about most?" data-q-nonprofit="Which fields does your organization work in?">Which causes do you care about most?</h2></legend>
<p class="onb-hint">Pick as many as you like.</p>
<div class="onb-choices onb-causes">
${Object.entries(CAUSES).map(([k, v]) => `<label class="choice choice-img"><input type="checkbox" name="cause" value="${k}"><span><img src="/media/cause-${k}.jpg" alt="" width="72" height="48"><b>${v}</b></span></label>`).join('')}
</div>
</fieldset>
<fieldset class="onb-step" data-step="3" hidden>
<legend><h2 tabindex="-1" data-q-supporter="How would you like to help?" data-q-nonprofit="What would help your organization most?">How would you like to help?</h2></legend>
<p class="onb-hint">Pick one or more.</p>
<div class="onb-choices" data-for="person">
<label class="choice"><input type="checkbox" name="way" value="Time"><span><b>Volunteer my time</b>Show places that take volunteers.</span></label>
<label class="choice"><input type="checkbox" name="way" value="Money"><span><b>Give money</b>Show organizations that accept financial gifts.</span></label>
<label class="choice"><input type="checkbox" name="way" value="Food"><span><b>Donate food or items</b>Show food and item drives.</span></label>
</div>
<div class="onb-choices" data-for="nonprofit" hidden>
<label class="choice"><input type="checkbox" name="goal" value="listing"><span><b>Get listed for free</b>A verified profile in search and filters.</span></label>
<label class="choice"><input type="checkbox" name="goal" value="featured"><span><b>Be featured in our area</b>A labeled spot on the first page, $29/month.</span></label>
<label class="choice"><input type="checkbox" name="goal" value="analytics"><span><b>See who finds us</b>Views, clicks and visitor ZIP codes, $79/month.</span></label>
<label class="choice"><input type="checkbox" name="goal" value="event"><span><b>Promote an event</b>The weekly email and homepage, $50 per issue.</span></label>
</div>
</fieldset>
<fieldset class="onb-step" data-step="4" hidden>
<legend><h2 tabindex="-1">Where should we look?</h2></legend>
<p class="onb-hint">We use this only to measure distances. Exact locations never leave your browser.</p>
<div class="onb-where">
<button type="button" class="btn btn-ink" data-onb="geo">Use my location</button>
<div class="onb-or"><label for="onb-near">City or ZIP</label><div class="search-row"><input type="text" id="onb-near" list="near-list" placeholder="Tempe, AZ or 85281" autocomplete="postal-code" enterkeyhint="go"><button type="submit" class="btn btn-ink" id="onb-go">Use this place</button></div></div>
<div class="onb-quick"><button type="button" class="btn" data-onb-place="Phoenix, AZ">Phoenix, AZ</button><button type="button" class="btn" data-onb-place="">Anywhere, including online</button></div>
<p class="onb-msg" id="onb-msg" role="status"></p>
</div>
</fieldset>
<div class="onb-done" data-step="5" hidden>
<img class="onb-star" src="/media/mark-128.png" alt="" width="96" height="96">
<h2 tabindex="-1" id="onb-done-title">Finding places for you...</h2>
<p id="onb-done-text"></p>
</div>
<div class="onb-nav">
<button type="button" class="btn" data-onb="back" hidden>Back</button>
<button type="button" class="btn btn-ink" id="onb-next" hidden>Next</button>
</div>
</form>
</dialog>`;
  const title = 'Find a nonprofit to volunteer with or donate to near you | Nonprofit Star';
  const description = `Search ${orgs.length} nonprofits by cause, location and way to give. See places to volunteer near you in Phoenix, Tempe, Scottsdale and Surprise.`;
  const graph = [
    S.siteOrg(), S.website(),
    S.webPage('CollectionPage', '/', title, description, {
      mainEntity: { '@type': 'ItemList', numberOfItems: orgs.length, itemListElement: orgs.map((o, i) => ({ '@type': 'ListItem', position: i + 1, url: S.abs(`/org-${o.id}.html`), name: o.name })) },
    }),
    ...events.map((e) => S.sampleEvent(e, cities)),
  ];
  emit('/index.html', layout({ path: '/index.html', title, description, body, jsonld: [S.ctx(graph)], scripts: ['/js/app.js', '/js/optin.js'], bare: true }), { title: 'Find a nonprofit you care about', priority: '1.0' });
}

// ---------- Organization profiles ----------
function orgPage(org) {
  const ss = sitesOf(org);
  const local = ss.filter((s) => !s.cityOnly);
  const cityOnly = ss.filter((s) => s.cityOnly);
  const cityList = list([...new Set(cityOnly.map((s) => `${s.city}, ${s.state}`))]);
  const path = `/org-${org.id}.html`;
  const url = actionUrl(org);
  const vol = local.filter((s) => s.volunteer);
  let answer;
  if (vol.length) answer = `${org.name} takes volunteers at ${list(vol.map((s) => `${s.name}, ${address(s)}`))}.` + (cityOnly.length ? ` It also lists sites in ${cityList}.` : '');
  else if (cityOnly.length) answer = `${org.name} lists volunteer sites in ${cityList}. Ways to give: ${waysLower(org)}.`;
  else answer = `${org.name} is a nonprofit with ${org.reach.toLowerCase()} program reach. You can support it with ${waysLower(org)} through ${host(org.website)}.`;
  const qas = [
    [`Where can I volunteer with ${org.name}?`, vol.length ? `At ${list(vol.map((s) => `${s.name} (${address(s)})`))}. ${org.siteNote ? org.siteNote + ' ' : ''}${SITE_NOTE}` : org.ways.includes('Time') ? `${org.name} lists volunteer time as a way to help. Check ${host(org.website)} for current opportunities.` : `${org.name} does not list volunteer time as a way to help in our directory.`],
    [`How can I give to ${org.name}?`, `Ways to give listed for ${org.name}: ${waysLower(org)}. Use ${host(url)} to give or sign up.`],
    [`Are donations to ${org.name} tax-deductible?`, `We have not verified ${org.name}'s 501(c)(3) status yet. You can check it in the IRS Tax Exempt Organization Search. ${TAX_NOTE}`],
    [`Does ${SITE_NAME} handle donations or volunteer sign-ups?`, `No. ${SITE_NAME} links to ${org.name}'s own website. We do not process money or applications.`],
  ];
  const cr = [['/', 'Home'], [`/${org.cause}.html`, CAUSES[org.cause]], [path, org.name]];
  const pts = local.map((st, i) => ({ n: i + 1, id: org.id, name: st.name, lat: st.lat, lng: st.lng }));
  const map = areaMap(pts, `Map of ${org.name} sites in Arizona`);
  const body = `${crumbs(cr)}
<header class="page-head">
<p class="eyebrow">${esc(org.tagline)} · ${esc(CAUSES[org.cause])}</p>
<h1>${esc(org.name)}</h1>
<p class="answer">${esc(answer)}</p>
</header>
<div class="two">
<article>
<p>${esc(org.description)} ${org.chapter ? `Arizona sites are run by the local chapter, ${esc(org.chapter)}.` : ''}</p>
<h2>Where to volunteer</h2>
${ss.length ? `<ul class="sites">${ss.map((st, i) => siteLi(st, org, i + 1)).join('')}</ul>` : `<p>No local site is listed. Program reach: ${esc(org.reach)}.</p>`}
<h2>Ways to give</h2>
<ul class="ways">${org.ways.map((w) => `<li>${esc(WAYS[w])}</li>`).join('')}</ul>
<p>Program reach: ${esc(org.reach)}</p>
${taxNote}
${faqBlock(qas)}
${lastUpdated}
</article>
<aside class="side"><div class="box">
${map ? `${map}<p class="map-cap">Numbers match the site list. Positions are approximate.</p>` : ''}
<div class="inner">
${org.donateUrl ? `<a class="btn btn-ink btn-wide" href="${esc(org.donateUrl)}" rel="noopener" data-log="outbound" data-org="${esc(org.id)}">Donate on ${esc(host(org.donateUrl).replace(/\/.*$/, ''))}</a>` : ''}
${org.ways.includes('Time') || !org.donateUrl ? `<a class="btn btn-wide" style="margin-top:var(--s-2)" href="${esc(url)}" rel="noopener" data-log="outbound" data-org="${esc(org.id)}">${org.ways.includes('Time') ? 'Volunteer' : 'Give'} on ${esc(host(url))}</a>` : ''}
${verifyBadge(org)}
<p class="meta" style="margin:0">Official website: <a href="${esc(org.website)}" rel="noopener">${esc(host(org.website))}</a>${org.localWebsite ? `<br>Arizona chapter: <a href="${esc(org.localWebsite)}" rel="noopener">${esc(host(org.localWebsite))}</a>` : ''}</p>
</div></div></aside>
</div>`;
  const title = `${org.name}: where to volunteer and how to give | Nonprofit Star`;
  const description = clip(answer);
  emit(path, layout({ path, title, description, body, jsonld: [S.ctx([
    S.webPage('ProfilePage', path, title, description, { mainEntity: { '@id': S.orgId(org) }, dateModified: TODAY }),
    S.ngo(org, ss), S.breadcrumbs(cr), S.faqPage(qas),
  ])] }), { title: `${org.name}: where to volunteer and how to give`, priority: '0.8' });
}

// ---------- Listing pages ----------
const CAUSE_PHRASE = {
  food: (c) => `Volunteer at a food bank or meal program in ${c}`,
  animals: (c) => `Volunteer with animals in ${c}`,
  environment: (c) => `Volunteer for cleanups in ${c}`,
  children: (c) => `Volunteer with children's charities in ${c}`,
  education: (c) => `Volunteer in education in ${c}`,
};

function listingPage({ path, h1, title, answer, rows, intent, cr, extraQ = [], eyebrow }) {
  const qas = [
    ...extraQ,
    ['How do I sign up?', `Sign up on each organization's own website. ${SITE_NAME} links to it and does not handle sign-ups or donations.`],
    ['Are hours listed?', `No. ${SITE_NOTE}`],
    ['Are donations to these organizations tax-deductible?', `We have not verified 501(c)(3) status for these listings yet. You can check each one in the IRS Tax Exempt Organization Search. ${TAX_NOTE}`],
  ];
  const items = rows.map(({ org, site }) => card(org, { sites: site ? [site] : sitesOf(org), intents: intent ? [intent] : [] })).join('');
  const localRows = rows.filter((r) => r.site && !r.site.cityOnly);
  const pts = localRows.map(({ org, site }, i) => ({ n: i + 1, id: org.id, name: `${org.name}, ${site.name}`, lat: site.lat, lng: site.lng }));
  const map = pts.length ? areaMap(pts, `Map of ${h1}`) : '';
  const siteList = localRows.map(({ org, site }, i) => `<li><span class="pin" aria-hidden="true">${i + 1}</span><div><p><strong>${esc(org.name)}</strong>, ${esc(site.name)}</p><p>${esc(address(site))}</p></div></li>`).join('');
  const body = `${crumbs(cr)}
<header class="page-head">
${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>` : ''}
<h1>${esc(h1)}</h1>
<p class="answer">${esc(answer)}</p>
<p><a class="btn btn-ink" href="/#match">Sort by distance from your location</a></p>
</header>
<div class="${map ? 'two' : ''}">
<div>
<h2 class="group-title" style="margin-top:0">${rows.length} ${rows.length === 1 ? 'listing' : 'listings'}</h2>
<ul class="grid"${map ? ' style="grid-template-columns:repeat(auto-fill,minmax(260px,1fr))"' : ''}>${items}</ul>
<div style="margin-top:var(--s-6)">${taxNote}</div>
${faqBlock(qas)}
${lastUpdated}
</div>
${map ? `<aside class="side"><div class="box">${map}<p class="map-cap">Numbers match the site list. Positions are approximate.</p><div class="inner"><ul class="sites" style="margin:0">${siteList}</ul></div></div></aside>` : ''}
</div>`;
  const description = clip(`${h1}: ${answer}`);
  const uniq = [...new Map(rows.map(({ org }) => [org.id, org])).values()];
  emit(path, layout({ path, title: `${title} | Nonprofit Star`, description, body, jsonld: [S.ctx([
    S.webPage('CollectionPage', path, title, description, { dateModified: TODAY,
      mainEntity: { '@type': 'ItemList', itemListElement: uniq.map((org, i) => ({ '@type': 'ListItem', position: i + 1, url: S.abs(`/org-${org.id}.html`), name: org.name })) } }),
    ...(pts.length ? [...new Map(localRows.map(({ org }) => [org.id, org])).values()].map((o) => S.ngo(o, sitesOf(o))) : []), S.breadcrumbs(cr), S.faqPage(qas),
  ])] }), { title, priority: '0.7' });
}

function causePages() {
  for (const [cause, label] of Object.entries(CAUSES)) {
    const os = orgs.filter((o) => o.cause === cause);
    if (!os.length) continue;
    const localRows = os.flatMap((o) => sitesOf(o).filter((s) => !s.cityOnly).map((s) => ({ org: o, site: s })));
    const answer = localRows.length
      ? `${os.length} ${label.toLowerCase()} nonprofits are listed. In the Phoenix area you can volunteer at ${list(localRows.slice(0, 3).map(({ org, site }) => `${org.name}'s ${site.name}, ${address(site)}`))}.`
      : `${os.length} ${label.toLowerCase()} nonprofits are listed, including ${list(os.slice(0, 3).map((o) => o.name))}. None lists an Arizona volunteer site yet, so you can give or help online.`;
    listingPage({ path: `/${cause}.html`, h1: `${label} nonprofits`, title: `${label} nonprofits to volunteer with or donate to`, answer, eyebrow: `${os.length} organizations`,
      rows: os.map((o) => ({ org: o, site: localRows.find((r) => r.org === o)?.site })), cr: [['/', 'Home'], [`/${cause}.html`, label]] });
  }
}

const cityPages = [];
function cityPagesAll() {
  for (const city of siteCities) {
    const cs = azSites.filter((s) => s.city === city);
    const citySlug = slug(city);
    for (const cause of Object.keys(CAUSES)) {
      const rows = cs.filter((s) => orgById[s.org].cause === cause && s.volunteer).map((s) => ({ org: orgById[s.org], site: s }));
      if (!rows.length) continue;
      const h1 = CAUSE_PHRASE[cause](city);
      const path = `/${cause}-${citySlug}.html`;
      const answer = `You can volunteer at ${list(rows.map(({ org, site }) => `${org.name}'s ${site.name}, ${address(site)}`))}.`;
      listingPage({ path, h1, title: h1, answer, rows, intent: 'volunteer', eyebrow: `${CAUSES[cause]} · ${city}, AZ`,
        cr: [['/', 'Home'], [`/volunteer-${citySlug}.html`, city], [path, CAUSES[cause]]],
        extraQ: [[`Where can I ${h1.charAt(0).toLowerCase() + h1.slice(1).replace(` in ${city}`, '')} in ${city}?`, answer.replace('You can volunteer at ', 'At ')]] });
      cityPages.push({ city, path, h1 });
    }
    const vol = cs.filter((s) => s.volunteer).map((s) => ({ org: orgById[s.org], site: s }));
    if (vol.length) {
      const path = `/volunteer-${citySlug}.html`;
      const h1 = `Where to volunteer in ${city}`;
      const answer = `You can volunteer at ${list(vol.slice(0, 3).map(({ org, site }) => `${org.name}'s ${site.name}, ${address(site)}`))}${vol.length > 3 ? `, plus ${vol.length - 3} more listed below` : ''}.`;
      listingPage({ path, h1, title: `${h1}, AZ`, answer, rows: vol, intent: 'volunteer', eyebrow: `${city}, AZ`, cr: [['/', 'Home'], ['/places.html', 'By city'], [path, city]],
        extraQ: [[`Where can I volunteer in ${city}?`, `${list(vol.map(({ org, site }) => `${org.name} at ${address(site)}`))}.`]] });
      cityPages.push({ city, path, h1 });
    }
    const don = cs.filter((s) => orgById[s.org].ways.some((w) => RANKING.intentWays.donate.includes(w))).map((s) => ({ org: orgById[s.org], site: s }));
    if (don.length) {
      const path = `/donate-${citySlug}.html`;
      const h1 = `Where to donate in ${city}`;
      const answer = `You can give to ${list(don.slice(0, 3).map(({ org, site }) => `${org.name} (${site.name}, ${address(site)})`))}${don.length > 3 ? ` and ${don.length - 3} more listed below` : ''}.`;
      listingPage({ path, h1, title: `${h1}, AZ`, answer, rows: don, intent: 'donate', eyebrow: `${city}, AZ`, cr: [['/', 'Home'], ['/places.html', 'By city'], [path, `Donate in ${city}`]],
        extraQ: [[`Which nonprofits with a site in ${city} accept donations?`, `${list([...new Set(don.map(({ org }) => org.name))])}.`]] });
      cityPages.push({ city, path, h1 });
    }
  }
  const body = `${crumbs([['/', 'Home'], ['/places.html', 'By city']])}
<header class="page-head"><h1>Places to volunteer and give, by city</h1>
<p class="answer">We list ${azSites.length} Arizona volunteer sites from ${new Set(azSites.map((s) => s.org)).size} nonprofits in ${list(siteCities)}.</p></header>
${siteCities.map((c) => `<h2>${esc(c)}</h2><ul class="link-cols">${cityPages.filter((p) => p.city === c).map((p) => `<li><a href="${p.path}">${esc(p.h1)}</a></li>`).join('')}</ul>`).join('')}`;
  const d = `Volunteer and donation pages for ${list(siteCities)}, Arizona.`;
  emit('/places.html', layout({ path: '/places.html', title: 'Places to volunteer and give by city | Nonprofit Star', description: d, body,
    jsonld: [S.ctx([S.webPage('CollectionPage', '/places.html', 'Places by city', d), S.breadcrumbs([['/', 'Home'], ['/places.html', 'By city']])])] }), { title: 'Places to volunteer and give, by city', priority: '0.6' });
}

// ---------- About ----------
function about() {
  const body = `<header class="page-head"><h1>About Nonprofit Star</h1>
<p class="lede">We help people discover organizations that fit the causes and communities they care about.</p></header>
<section class="panel" aria-labelledby="purpose">
<p class="eyebrow">Our purpose</p>
<h2 id="purpose" style="margin-top:0">What brings us together</h2>
<div class="trio">
<div><h3>Our vision</h3><p>A world where anyone who wants to help can find a community that needs them.</p></div>
<div><h3>Our mission</h3><p>Connect people and businesses with nonprofits through clear program information, thoughtful matching and direct links to nonprofit programs.</p></div>
<div><h3>Our goal</h3><p>Help more visitors take a meaningful first step. We track visits to nonprofit websites and interest in local causes.</p></div>
</div>
</section>
<figure class="band"><img src="/media/about-daisies.jpg" alt="White daisies with yellow centers growing in green grass" width="1800" height="1200" loading="lazy"></figure>
<h2>Meet the team</h2>
<div class="team">${[['paula', 'Paula'], ['bonnie', 'Bonnie'], ['daniel', 'Daniel']].map(([k, n]) => `<figure class="member"><img src="/media/team-${k}.jpg" alt="Illustrated star character for ${n}" width="300" height="297"><figcaption><b>${n}</b><span>Founder</span></figcaption></figure>`).join('')}</div>`;
  const d = 'Nonprofit Star helps people discover organizations that fit the causes and communities they care about. Meet the founding team.';
  emit('/about.html', layout({ path: '/about.html', title: 'About Nonprofit Star', description: d, body,
    jsonld: [S.ctx([S.siteOrg(), S.webPage('AboutPage', '/about.html', 'About Nonprofit Star', d), S.breadcrumbs([['/', 'Home'], ['/about.html', 'About Us']])])] }), { title: 'About Nonprofit Star', priority: '0.4' });
}

// ---------- Account ----------
function account() {
  const body = `<header class="page-head"><h1>Your Nonprofit Star account</h1>
<p class="lede">Browse freely as a guest or save your newsletter region and account preferences.</p>
<p><a href="/">Continue as a guest</a></p></header>
<div class="panels-2">
<section class="box"><h2 style="margin-top:0;font-size:var(--fs-3)">Create account</h2><p>Choose a donor or nonprofit profile. We will show you a private login code to save.</p><button type="button" class="btn btn-black" data-open-account>Create account</button></section>
<section class="box"><h2 style="margin-top:0;font-size:var(--fs-3)">Log in</h2><form id="login-form" novalidate><label for="code">Private login code</label><input type="text" id="code" autocomplete="one-time-code"><p style="margin-top:var(--s-3)"><button type="submit" class="btn btn-black btn-wide">Log in</button></p><p class="meta" id="login-msg" role="status"></p></form></section>
</div>
<dialog id="account" aria-labelledby="account-title">
<form method="dialog" id="account-form" novalidate>
<p class="eyebrow">Your giving profile</p>
<h2 id="account-title">Welcome to the grove.</h2>
<p>Tell us a little about yourself, or explore as a guest.</p>
<div class="field"><label for="acc-name">Your name</label><input type="text" id="acc-name" name="name" autocomplete="name"></div>
<div class="field"><label for="acc-email">Email address</label><input type="email" id="acc-email" name="email" autocomplete="email" required></div>
<div class="field"><label for="acc-role">I am here as</label><select id="acc-role" name="role"><option>A donor</option><option>A volunteer</option><option>A nonprofit</option></select></div>
<label class="check" style="margin-bottom:var(--s-2)"><input type="checkbox" name="agree"> <span>I agree to the <a href="/privacy.html">privacy policy</a>.</span></label>
<label class="check"><input type="checkbox" name="news"> <span>Send me weekly nonprofit events in my region (optional).</span></label>
<p class="meta" id="account-msg" role="status"></p>
<div class="row"><button type="submit" class="btn btn-black">Save preferences</button><button type="button" class="btn" data-close>Explore as a guest</button></div>
</form>
</dialog>`;
  const d = 'Create a Nonprofit Star account or log in to save your newsletter region and preferences. Browsing as a guest is always free.';
  emit('/account.html', layout({ path: '/account.html', title: 'Your account | Nonprofit Star', description: d, body,
    jsonld: [S.ctx([S.webPage('WebPage', '/account.html', 'Your account', d)])] }), { title: 'Your Nonprofit Star account', priority: '0.2' });
}

// ---------- Premiere (pricing) ----------
function pricing() {
  const body = `<header class="page-head has-photo"><div><p class="eyebrow">Nonprofit plans</p><h1>Premiere for nonprofits</h1>
<p class="lede">Listing on ${SITE_NAME} is free. Featured placement is $29 a month, Premium with analytics is $79 a month, and event promotion is $50 per issue. Visitors always browse for free, and ${SITE_NAME} takes no share of donations.</p>
<a class="btn btn-black" href="/dashboard.html">Explore the dashboard preview</a></div>
${headPhoto('head-premiere.jpg', 'A volunteer in a blue shirt holds a small potted plant', '50% 62%')}
</header>
<div class="plans">
<section class="plan"><h2>Basic</h2><p class="price">Free</p><p>Submit a profile for verification, appear in cause and area filters, and link to official giving and volunteering pages.</p><a class="btn btn-black btn-wide" href="/account.html">Request Basic</a></section>
<section class="plan is-mid"><h2>Featured</h2><p class="price">$29/month</p><p>Everything in Basic, plus labeled placement on matching area and cause pages. Up to three featured spots per page.</p><a class="btn btn-black btn-wide" href="/account.html">Request Featured</a></section>
<section class="plan"><h2>Premium</h2><p class="price">$79/month</p><p>Everything in Featured, plus private aggregate analytics (profile views, volunteer and donate clicks, pop-up choices, visitor ZIP codes) and a monthly AEO/GEO report with concrete improvements for your website.</p><a class="btn btn-black btn-wide" href="/account.html">Request Premium</a></section>
</div>
<section class="box" style="margin-bottom:var(--s-5)"><h2 style="margin-top:0;font-size:var(--fs-3)">Launch offer</h2><p>New nonprofits joining during launch receive their first month of Premium free. Proposed ongoing price: $79 per month.</p><a href="/dashboard.html">See a sample Premium dashboard</a></section>
<section class="dark"><p class="eyebrow">Available with any plan</p><h2>Event promotion · $50 per issue</h2><p class="lede">One region, one issue, one week. Your event appears in the weekly email to opted-in readers in that region and in a labeled sponsored space on its homepage.</p><a class="btn btn-aqua" href="/account.html">Request event promotion</a></section>
<p class="meta" style="margin-top:var(--s-5)">Proposed prices in USD. Applications are reviewed before activation. No payment is collected in this prototype.</p>
<p class="meta"><a href="/arizona-issue-01.html">Explore the weekly newsletter</a></p>`;
  const qas = [['How much does it cost to list a nonprofit?', 'Basic listing is free. Featured is $29/month and Premium is $79/month.'], ['How much is event promotion?', '$50 per issue, for one week in one region, covering the newsletter and the homepage.']];
  const d = 'Premiere plans for nonprofits: free Basic listing, $29/month Featured, $79/month Premium with analytics, and $50 per issue event promotion.';
  emit('/pricing.html', layout({ path: '/pricing.html', title: 'Premiere for nonprofits: plans and pricing | Nonprofit Star', description: d, body: body + faqBlock(qas),
    jsonld: [S.ctx([S.webPage('WebPage', '/pricing.html', 'Premiere for nonprofits', d), S.breadcrumbs([['/', 'Home'], ['/pricing.html', 'Premiere']]), S.faqPage(qas)])] }), { title: 'Premiere for nonprofits: plans and pricing', priority: '0.5' });
}

// ---------- Dashboard ----------
function dashboard() {
  const zips = [['85281', 'Tempe', 38], ['85008', 'Phoenix', 26], ['85004', 'Phoenix', 19], ['85251', 'Scottsdale', 14], ['85283', 'Tempe', 11]];
  const body = `<header class="page-head"><p class="eyebrow">Nonprofit Star Premium</p><h1>See how people find your cause.</h1>
<p class="lede">$79 per month · First month free for new nonprofits during launch.</p><p><a href="/pricing.html">Compare all plans</a></p></header>
<section class="panel" aria-labelledby="dash-title">
<div class="chart-head"><div style="flex:2 1 300px"><p class="eyebrow">Premium dashboard preview</p><h2 id="dash-title" style="margin:0">Community Food Network</h2></div>
<div><label for="period">Reporting period</label><select id="period"><option value="30">Last 30 days</option><option value="14">Last 14 days</option><option value="7">Last 7 days</option></select></div></div>
<p class="meta" style="margin-top:var(--s-3)">Illustrative numbers from a fictional nonprofit. Change the period or inspect a day.</p>
<div class="kpis" id="kpis"></div>
<div class="chart-box">
<div class="chart-head"><h3>Daily activity</h3><div><label for="metric">Metric</label><select id="metric"><option value="views">Profile views</option><option value="volunteer">Volunteer clicks</option><option value="donate">Donate clicks</option></select></div></div>
<div id="chart"></div>
<p class="meta" id="range"></p>
<label for="day">Inspect a day</label><input type="range" id="day" min="0" max="29" value="25">
<p class="meta" id="day-out" role="status"></p>
</div>
<div class="panels-2" style="margin-bottom:var(--s-4)">
<div class="chart-box" style="margin:0"><h3 style="font-size:var(--fs-2)">What visitors told us in the 4 questions</h3>
<table><thead><tr><th scope="col">Answer</th><th scope="col">Share</th><th scope="col" style="width:45%"><span class="visually-hidden">Bar</span></th></tr></thead><tbody>
<tr><th scope="row" colspan="3">Who are you?</th></tr>
${[['Volunteer or donor', 71], ['Nonprofit', 9], ['Guest', 20]].map(([k, v]) => `<tr><td>${k}</td><td>${v}%</td><td><div class="bar" style="width:${v}%"></div></td></tr>`).join('')}
<tr><th scope="row" colspan="3">How would you like to help?</th></tr>
${[['Volunteer my time', 64], ['Give money', 41], ['Donate food or items', 23]].map(([k, v]) => `<tr><td>${k}</td><td>${v}%</td><td><div class="bar" style="width:${v}%"></div></td></tr>`).join('')}
</tbody></table><p class="meta" style="margin:var(--s-2) 0 0">Visitors can pick more than one way to help, so those shares add up to more than 100%.</p></div>
<div class="chart-box" style="margin:0"><h3 style="font-size:var(--fs-2)">Visitor ZIP codes</h3>
<table><thead><tr><th scope="col">ZIP</th><th scope="col">City</th><th scope="col">Visitors</th><th scope="col" style="width:35%"><span class="visually-hidden">Bar</span></th></tr></thead><tbody>
${zips.map(([z, c, n]) => `<tr><td>${z}</td><td>${c}</td><td>${n}</td><td><div class="bar" style="width:${Math.round((n / zips[0][2]) * 100)}%"></div></td></tr>`).join('')}
</tbody></table><p class="meta" style="margin:var(--s-2) 0 0">We store a city or ZIP per search, never exact coordinates, names or emails.</p></div>
</div>
<details><summary>View daily data</summary><div id="daily-table" style="margin-top:var(--s-3);overflow-x:auto"></div></details>
</section>
<section class="box" style="margin-top:var(--s-5)"><h2 style="margin-top:0;font-size:var(--fs-3)">Request a plan or event promotion</h2><p>Organizations can sign in to request plans or access member tools. <a href="/account.html">Account options</a></p><p class="meta" style="margin:0">No payment is collected in this prototype.</p></section>`;
  const d = 'Sample Premium dashboard with illustrative numbers: profile views, volunteer and donate clicks, pop-up choices and visitor ZIP codes.';
  emit('/dashboard.html', layout({ path: '/dashboard.html', title: 'See how people find your cause: Premium dashboard | Nonprofit Star', description: d, body, scripts: ['/js/dashboard.js'],
    jsonld: [S.ctx([S.webPage('WebPage', '/dashboard.html', 'Premium dashboard preview', d), S.breadcrumbs([['/', 'Home'], ['/pricing.html', 'Premiere'], ['/dashboard.html', 'Dashboard preview']])])] }), { title: 'Premium dashboard preview', priority: '0.4' });
}

// ---------- Newsletter ----------
function newsletter() {
  const sorted = sortEvents(events, cities, null);
  const spot = sorted.find(({ e }) => e.sponsored)?.e;
  const rest = sorted.filter(({ e }) => !e.sponsored);
  const azCities = cities.filter((c) => c.state === 'AZ');
  const cu = EV.comingUp;
  const cuDay = new Date(cu.date + 'T00:00:00Z');
  const body = `<header class="page-head has-photo"><div><p class="eyebrow">Regional events</p><h1>What's happening near you?</h1>
<p class="lede">Choose your region to opt in to a weekly issue covering local nonprofit events across all causes. Sponsored events are labeled.</p>
<a class="btn btn-black" href="#prefs">Choose newsletter preferences</a></div>
${headPhoto('head-newsletter.jpg', 'A woman in a straw hat carries a red basket along the beach at golden hour')}
</header>
<section class="box" aria-labelledby="explore"><h2 id="explore" style="margin-top:0;font-size:var(--fs-3)">Explore Arizona</h2>
<p class="meta">Explore the cities featured in ${esc(issue.title)}. Event listings in this issue are illustrative.</p>
<label for="city-pick">Choose a city</label><select id="city-pick" style="max-width:360px">${azCities.map((c) => `<option${c.name === 'Phoenix' ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
<div class="gmap" id="az-map" data-base="${esc(mapsEmbedBase())}"><iframe title="Google map of Phoenix, AZ" src="${esc(mapsEmbedBase() + encodeURIComponent('Phoenix, AZ'))}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe></div>
<p class="meta" style="margin:var(--s-2) 0 0">Map data from Google. Loading the map shares your IP address with Google.</p>
<p class="meta" style="margin:var(--s-2) 0 0"><a id="gmaps" href="https://www.google.com/maps/search/?api=1&amp;query=Phoenix%2C%20AZ" rel="noopener">Open Phoenix in Google Maps</a></p>
</section>
<p class="meta" style="text-align:center;margin-top:var(--s-6)">Sample issue · Events and organizers are illustrative.</p>
<div class="issue-wrap"><article class="issue" aria-labelledby="issue-title">
<header class="issue-head"><div class="row"><span>Nonprofit Star</span><span>Issue #${String(issue.number).padStart(2, '0')}</span></div>
<p class="kicker">${esc(issue.title)} · ${esc(issue.weekLabel)}</p><h2 id="issue-title">${esc(issue.headline)}</h2></header>
<div class="issue-body">
<p>Hi neighbor! This is the busiest week of the year for local nonprofits. Food banks need packers, shelters need coats, and the river needs a cleanup crew. Pick one thing, bring a friend, and shine where you live.</p>
${spot ? eventCard(spot, null) : ''}
<h3>This week near you</h3>
<ul class="ev-list">${rest.map(({ e }) => eventRow(e, null)).join('')}</ul>
<div class="coming"><div class="circle"><small>${cuDay.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })}</small>${cuDay.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}</div><p><b>Coming up: ${esc(cu.title)}</b>${esc(cu.text)}</p></div>
<div class="taxnote"><strong>Tax tip: give before Dec 31.</strong> ${esc(TAX_NOTE)} Check an organization's status in the <a href="${IRS_TEOS}" rel="noopener">IRS Tax Exempt Organization Search</a>.</div>
<div class="promo"><div><strong>Run a nonprofit in Arizona?</strong><br>Put your next event in front of local supporters, in this email and on our homepage, for $50.</div><a class="btn btn-ink" href="/pricing.html">Promote an event</a></div>
</div>
<footer class="issue-foot"><b>Shine where you live.</b>You're getting ${esc(issue.title)} because you chose Arizona and asked for upcoming events on Nonprofit Star. Sponsored spots are paid placements by nonprofits.<br><a href="#prefs">Change my area</a> · <a href="#prefs">Unsubscribe</a><br>Demo issue: events and organizers shown are sample content.</footer>
</article></div>
<section class="box" id="prefs" style="margin-top:var(--s-6)" aria-labelledby="prefs-title"><h2 id="prefs-title" style="margin-top:0;font-size:var(--fs-3)">Newsletter preferences</h2>
<form class="optin" id="optin" novalidate style="margin:0">
<label for="optin-area">Region</label><select id="optin-area" style="max-width:320px"><option>Arizona</option></select>
<p style="margin-top:var(--s-3)"><label class="check"><input type="checkbox" id="optin-check"> Send me upcoming volunteer events near me.</label></p>
<div class="email-row" id="optin-fields" hidden><div><label for="optin-email">Email</label><input type="email" id="optin-email" autocomplete="email" required></div><button type="submit" class="btn btn-ink">Subscribe</button></div>
<p class="meta" id="optin-msg" role="status"></p><p class="meta" style="margin:0">Matched by area only. Every issue has an unsubscribe link. Demo: no email is sent.</p>
</form></section>
<section class="box" style="margin-top:var(--s-5)"><h2 style="margin-top:0;font-size:var(--fs-3)">For nonprofit teams</h2><p>Explore the trends behind profile visits and clicks to your website.</p><a class="btn btn-black" href="/dashboard.html">Preview the Premium dashboard</a></section>`;
  const d = `${issue.title} is a free weekly email of volunteer days, drives and cleanups in Arizona. See the sample issue for ${issue.weekLabel}.`;
  emit('/arizona-issue-01.html', layout({ path: '/arizona-issue-01.html', title: `${issue.title} newsletter: what's happening near you | Nonprofit Star`, description: d, body, scripts: ['/js/newsletter.js', '/js/optin.js'],
    jsonld: [S.ctx([S.webPage('WebPage', '/arizona-issue-01.html', `${issue.title} sample issue`, d), S.breadcrumbs([['/', 'Home'], ['/arizona-issue-01.html', 'Newsletter']]), ...events.map((e) => S.sampleEvent(e, cities))])] }),
    { title: `${issue.title} newsletter sample issue`, priority: '0.5' });
}

// ---------- Volunteer tab: every volunteer site, sorted by distance ----------
function volunteerTab() {
  const opps = sites.filter((s) => s.volunteer).map((s) => ({ site: s, org: orgById[s.org], miles: haversineMiles(PHOENIX, s) }))
    .sort((a, b) => a.miles - b.miles);
  const noSite = orgs.filter((o) => o.ways.includes('Time') && !sitesOf(o).length);
  const pts = opps.filter((x) => !x.site.cityOnly).map((x, i) => ({ n: i + 1, id: x.org.id, name: `${x.org.name}, ${x.site.name}`, lat: x.site.lat, lng: x.site.lng }));
  const first = opps.slice(0, 3);
  const answer = `${opps.length} places to volunteer are listed. Closest to downtown Phoenix: ${list(first.map((x) => `${x.org.name}'s ${x.site.name}, ${address(x.site)}`))}.`;
  const volEvents = sortEvents(events.filter((e) => e.kind === 'volunteer'), cities, PHOENIX);
  const qas = [
    ['Where can I volunteer near Phoenix?', `${list(first.map((x) => `${x.org.name} at ${address(x.site)}`))} are the closest listed sites to downtown Phoenix.`],
    ['How do I sign up?', `Sign up on each organization's own website. ${SITE_NAME} links to it and does not handle sign-ups.`],
    ['Are hours listed?', `No. ${SITE_NOTE}`],
  ];
  const cr = [['/', 'Home'], ['/volunteer.html', 'Volunteer']];
  const body = `${crumbs(cr)}
<header class="page-head has-photo"><div><p class="eyebrow">Volunteer</p><h1>Places to volunteer near you</h1>
<p class="answer">${esc(answer)}</p></div>
${headPhoto('head-volunteer.jpg', 'Two volunteers in white shirts pick up plastic litter among tall grass at sunset')}
</header>
<form class="filters" id="vfinder" novalidate>
<div><label for="v-near">Near (city or ZIP)</label><input type="text" id="v-near" list="v-near-list" placeholder="Tempe, AZ or 85281" autocomplete="postal-code"><datalist id="v-near-list">${[...new Set(sites.map((s) => `${s.city}, ${s.state}`))].sort().map((c) => `<option value="${esc(c)}">`).join('')}</datalist></div>
<div><label for="v-radius">Within</label><select id="v-radius"><option value="">Any distance</option>${RANKING.radii.map((r) => `<option value="${r}">${r} miles</option>`).join('')}</select></div>
<div><label for="v-cause">Cause</label><select id="v-cause"><option value="">All causes</option>${Object.entries(CAUSES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
<div class="actions"><button type="submit" class="btn btn-ink">Sort by distance</button><button type="button" class="btn btn-black" id="v-geo">Use my location</button><button type="button" class="btn" data-vpreset="Phoenix, AZ">Phoenix, AZ</button></div>
</form>
<p class="near-hint">Your exact location stays in this browser. We only use it to measure distances.</p>
<p class="status" id="v-status">${opps.length} places to volunteer, closest to Phoenix, AZ first</p>
<div class="status-note" id="v-note"></div>
<div class="two">
<section aria-labelledby="opps-title"><h2 id="opps-title" class="visually-hidden">All places to volunteer</h2>
<ol class="opps" id="opps">${opps.map((x, i) => oppRow(x.site, x.org, x.miles, i + 1)).join('')}</ol></section>
<aside class="side"><div class="box"><div id="v-map">${mapSVG({ origin: PHOENIX, radius: 50, points: pts, cities: cities.filter((c) => c.state === 'AZ'), title: 'Map of places to volunteer near Phoenix' })}</div><p class="map-cap">Numbers match the list. Positions are approximate.</p></div></aside>
</div>
<h2>Volunteer events this week</h2>
<p class="meta">Sample events from the <a href="/arizona-issue-01.html">Arizona Weekly sample issue</a>, sorted by date and distance. Organizers are fictional.</p>
<ul class="ev-list box" id="v-events">${volEvents.map(({ e, miles }) => eventRow(e, miles)).join('')}</ul>
<h2>Volunteer without a local site</h2>
<p>These organizations list volunteer time as a way to help but have no site in our directory yet. Check their websites for programs near you.</p>
<ul class="link-cols">${noSite.map((o) => `<li><a href="/org-${o.id}.html">${esc(o.name)}</a> <span class="meta">· ${esc(o.tagline)} · ${esc(o.reach)}</span></li>`).join('')}</ul>
${faqBlock(qas)}
${lastUpdated}`;
  const title = 'Places to volunteer near you, sorted by distance';
  const d = clip(answer);
  emit('/volunteer.html', layout({ path: '/volunteer.html', title: `${title} | Nonprofit Star`, description: d, body, scripts: ['/js/volunteer.js'],
    jsonld: [S.ctx([S.webPage('CollectionPage', '/volunteer.html', title, d, { dateModified: TODAY,
      mainEntity: { '@type': 'ItemList', itemListElement: opps.map((x, i) => ({ '@type': 'ListItem', position: i + 1, url: S.abs(`/org-${x.org.id}.html`), name: `${x.org.name}, ${x.site.name}` })) } }),
      S.breadcrumbs(cr), S.faqPage(qas)])] }), { title, priority: '0.9' });
}

// ---------- Donate tab: every organization that accepts gifts; links go to their own donation pages ----------
const GIFT_WAYS = ['Money', 'Food', 'Blankets'];
function donateOrder(list, origin, nearMax = 60) {
  const withNear = list.map((org) => {
    let best = null;
    for (const s of sites.filter((x) => x.org === org.id)) { const m = haversineMiles(origin, s); if (!best || m < best.miles) best = { site: s, miles: m }; }
    return { org, near: best && best.miles <= nearMax ? best : null };
  });
  const local = withNear.filter((x) => x.near).sort((a, b) => a.near.miles - b.near.miles);
  const rest = withNear.filter((x) => !x.near).sort((a, b) => a.org.name.localeCompare(b.org.name));
  return { local, rest };
}
function donateTab() {
  const givers = orgs.filter((o) => o.ways.some((w) => GIFT_WAYS.includes(w)));
  const { local, rest } = donateOrder(givers, PHOENIX);
  const direct = givers.filter((o) => o.donateUrl).length;
  const answer = `${givers.length} nonprofits accept donations. Near Phoenix you can give to ${list(local.slice(0, 3).map((x) => `${x.org.name} (${waysLower(x.org).replace('volunteer time, ', '').replace(', volunteer time', '')})`))}. Every button opens the organization's own donation page; ${SITE_NAME} never handles money.`;
  const drives = sortEvents(events.filter((e) => e.kind === 'donate'), cities, PHOENIX);
  const qas = [
    ['Can I donate through Nonprofit Star?', `No. ${SITE_NAME} links to each organization's own donation page and never handles money, so your gift goes straight to them.`],
    ['Where can I donate food near Phoenix?', `${list(givers.filter((o) => o.ways.includes('Food') && sitesOf(o).some((s) => !s.cityOnly)).map((o) => o.name))} lists food donations as a way to give. Check its website for drop-off hours.`],
    ['Are donations tax-deductible?', `We have not verified 501(c)(3) status for these listings yet. Check each organization in the IRS Tax Exempt Organization Search. ${TAX_NOTE}`],
  ];
  const cr = [['/', 'Home'], ['/donate.html', 'Donate']];
  const n0 = local.length;
  const body = `${crumbs(cr)}
<header class="page-head has-photo"><div><p class="eyebrow">Donate</p><h1>Ways to donate to nonprofits</h1>
<p class="answer">${esc(answer)}</p></div>
${headPhoto('head-donate.jpg', 'Two pairs of cupped hands hold a paper heart against a pink background', '50% 72%')}
</header>
<div class="panels-2" style="margin-bottom:var(--s-5)">
<div class="box"><strong>You give on their website, not ours.</strong><p class="meta" style="margin:var(--s-1) 0 0">${direct} of ${givers.length} buttons open a donation page we checked on ${fmtDate(TODAY)}. The rest open the organization's homepage. We take no share of donations.</p></div>
<p class="taxnote" style="margin:0"><strong>Giving in 2026.</strong> ${esc(TAX_NOTE)} <a href="/giving-guide.html">Giving guide</a></p>
</div>
<form class="filters" id="dfinder" novalidate>
<div><label for="d-q">Search</label><input type="search" id="d-q" placeholder="Name or mission"></div>
<div><label for="d-cause">Cause</label><select id="d-cause"><option value="">All causes</option>${Object.entries(CAUSES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
<div><label for="d-way">Way to give</label><select id="d-way"><option value="">All ways to give</option><option value="Money">Financial gifts</option><option value="Food">Food donations</option><option value="Blankets">Handmade blankets</option></select></div>
<div><label for="d-near">Near (city or ZIP)</label><input type="text" id="d-near" list="d-near-list" placeholder="Tempe, AZ or 85281" autocomplete="postal-code"><datalist id="d-near-list">${[...new Set(sites.map((s) => `${s.city}, ${s.state}`))].sort().map((c) => `<option value="${esc(c)}">`).join('')}</datalist></div>
<div class="actions"><button type="submit" class="btn btn-ink">Sort by distance</button><button type="button" class="btn btn-black" id="d-geo">Use my location</button><button type="button" class="btn" data-dpreset="Phoenix, AZ">Phoenix, AZ</button></div>
</form>
<p class="near-hint">Your exact location stays in this browser. We only use it to measure distances.</p>
<div class="status-note" id="d-note"></div>
<section aria-labelledby="d-local-title"><h2 class="group-title" id="d-local-title">Near Phoenix, AZ</h2>
<ol class="opps" id="d-local">${local.map((x, i) => donateRow(x.org, x.near, i + 1)).join('')}</ol></section>
<section aria-labelledby="d-rest-title"><h2 class="group-title" id="d-rest-title">Nationwide and international</h2>
<ol class="opps" id="d-rest">${rest.map((x, i) => donateRow(x.org, null, n0 + i + 1)).join('')}</ol></section>
<h2>Donation drives this week</h2>
<p class="meta">Sample events from the <a href="/arizona-issue-01.html">Arizona Weekly sample issue</a>. Organizers are fictional.</p>
<ul class="ev-list box" id="d-events">${drives.map(({ e, miles }) => eventRow(e, miles)).join('')}</ul>
${faqBlock(qas)}
${lastUpdated}`;
  const title = 'Ways to donate to nonprofits near you';
  const d = clip(answer);
  emit('/donate.html', layout({ path: '/donate.html', title: `${title} | Nonprofit Star`, description: d, body, scripts: ['/js/donate.js'],
    jsonld: [S.ctx([S.webPage('CollectionPage', '/donate.html', title, d, { dateModified: TODAY,
      mainEntity: { '@type': 'ItemList', itemListElement: [...local, ...rest].map((x, i) => ({ '@type': 'ListItem', position: i + 1, url: S.abs(`/org-${x.org.id}.html`), name: x.org.name })) } }),
      S.breadcrumbs(cr), S.faqPage(qas)])] }), { title, priority: '0.9' });
}

// ---------- Advertise an event (vendors) ----------
function advertise() {
  const spot = events.find((e) => e.sponsored);
  const qas = [
    ['How much does event promotion cost?', '$50 per issue: one week, one region. It covers a spot in that week\'s regional email and a labeled sponsored spot on the homepage for visitors in that region.'],
    ['How many sponsored spots are there?', 'Each issue has 3 to 5 sponsored spots, always labeled. Unpaid listings that match well still show right below.'],
    ['Do I need a paid plan?', 'No. Event promotion is available with any plan, including the free Basic listing.'],
  ];
  const cr = [['/', 'Home'], ['/pricing.html', 'For nonprofits'], ['/advertise.html', 'Advertise an event']];
  const body = `${crumbs(cr)}
<header class="page-head"><p class="eyebrow">For nonprofits</p><h1>Advertise an event</h1>
<p class="answer">Promote an upcoming volunteer day, drive or fundraiser for $50 per issue. Your event goes into one week's regional email and a labeled sponsored spot on our homepage for visitors in that region.</p>
<a class="btn btn-black" href="/account.html">Request event promotion</a></header>
<div class="panels-2">
<section class="box"><h2 style="margin-top:0;font-size:var(--fs-3)">What you get for $50</h2>
<ul class="ways" style="flex-direction:column;align-items:flex-start"><li>A spot in that week's regional email, sent only to opted-in readers in your area</li><li>A labeled "Sponsored" spot on the homepage for visitors in that area, the same week</li><li>Date, place, a short description and your sign-up link</li></ul>
<p class="meta">One region, one issue, one week. Each issue has 3 to 5 sponsored spots. No payment is collected in this prototype.</p></section>
<section><p class="eyebrow">How it looks</p>${spot ? eventCard(spot, null) : ''}<p class="meta" style="margin-top:var(--s-2)">Sample placement. The organizer shown is fictional.</p></section>
</div>
${faqBlock(qas)}
<section class="dark" style="margin-top:var(--s-6)"><h2>Want more than one event?</h2><p class="lede">Featured placement ($29/month) and Premium analytics ($79/month) keep your organization at the top of matching pages all month.</p><a class="btn btn-aqua" href="/pricing.html">See Premiere plans</a></section>`;
  const d = 'Promote a nonprofit event for $50 per issue: one week in the regional email and a labeled sponsored spot on the Nonprofit Star homepage.';
  emit('/advertise.html', layout({ path: '/advertise.html', title: 'Advertise an event: $50 per issue | Nonprofit Star', description: d, body,
    jsonld: [S.ctx([S.webPage('WebPage', '/advertise.html', 'Advertise an event', d), S.breadcrumbs(cr), S.faqPage(qas)])] }), { title: 'Advertise a nonprofit event', priority: '0.4' });
}

// ---------- Giving guide, privacy, 404 ----------
function givingGuide() {
  const qas = [
    ['Can I deduct charitable gifts if I take the standard deduction?', TAX_NOTE],
    ['How do I check whether a nonprofit is a 501(c)(3)?', `Search its name or EIN in the IRS Tax Exempt Organization Search (${IRS_TEOS}). ${SITE_NAME} shows a "Verification preview" badge until we have checked an EIN.`],
    ['Does Nonprofit Star take a share of donations?', 'No. We link to each nonprofit\'s own website and never handle money.'],
  ];
  const body = `${crumbs([['/', 'Home'], ['/giving-guide.html', 'Giving guide']])}
<header class="page-head"><h1>Giving guide</h1><p class="answer">From tax year 2026, people who take the standard deduction can deduct up to $1,000 in cash gifts to qualifying charities, or $2,000 for married couples filing jointly. This page is general information, not tax advice.</p></header>
${taxNote}
${faqBlock(qas)}
${lastUpdated}`;
  const d = 'How the 2026 charitable deduction works for people who take the standard deduction, and how to check a nonprofit\'s 501(c)(3) status. Not tax advice.';
  emit('/giving-guide.html', layout({ path: '/giving-guide.html', title: 'Giving guide: the 2026 charitable deduction | Nonprofit Star', description: d, body,
    jsonld: [S.ctx([S.webPage('WebPage', '/giving-guide.html', 'Giving guide', d, { dateModified: TODAY }), S.breadcrumbs([['/', 'Home'], ['/giving-guide.html', 'Giving guide']]), S.faqPage(qas)])] }), { title: 'Giving guide: the 2026 charitable deduction', priority: '0.5' });
}

function privacy() {
  const body = `<header class="page-head"><h1>Privacy</h1>
<p class="answer">${SITE_NAME} keeps your exact location in your browser and never sends it to our server. Searches are logged by city or ZIP only.</p></header>
<div class="lede"><h2>What stays in your browser</h2><p>Your pop-up choice (volunteer, donate or skipped) and your coordinates if you press "Use my location". Coordinates are used to measure distances and are not stored.</p>
<h2>What we record</h2><p>The city or ZIP you searched, the causes and ways to give you picked, and which organization links you clicked. Nonprofits only see aggregated counts.</p>
<h2>Maps</h2><p>The newsletter page shows a Google map. Loading it sends your IP address to Google under Google's privacy policy. Other pages use our own maps, which load nothing from third parties.</p>
<h2>Newsletter</h2><p>Opt-in only, with an unchecked box. We store your email and area. Every issue has an unsubscribe link. In this demo, no email is sent.</p></div>`;
  const d = 'How Nonprofit Star handles location, search logs and newsletter sign-ups.';
  emit('/privacy.html', layout({ path: '/privacy.html', title: 'Privacy | Nonprofit Star', description: d, body, jsonld: [S.ctx([S.webPage('WebPage', '/privacy.html', 'Privacy', d)])] }), { title: 'Privacy', priority: '0.2' });
}

function notFound() {
  emit('/404.html', layout({ path: '/404.html', title: 'Page not found | Nonprofit Star', description: 'This page does not exist.', body: '<h1>Page not found</h1><p>This address does not match a page. <a href="/">Find a nonprofit you care about</a> or <a href="/places.html">browse by city</a>.</p>' }));
}

// ---------- Crawl files ----------
function crawlFiles() {
  const byPrefix = (f) => pages.filter((p) => f(p.path));
  const line = (p) => `- [${p.title}](${SITE_ORIGIN}${p.path === '/index.html' ? '/' : p.path})`;
  const llms = `# ${SITE_NAME}

> Free directory of ${orgs.length} nonprofits you can volunteer with or donate to, with local volunteer sites in the Phoenix area (Phoenix, Tempe, Scottsdale and Surprise, Arizona). Each page opens with a direct answer naming the organization, the site and its street address. We link to each nonprofit's own website and never handle donations or sign-ups.

Facts come from each organization's public website. Coordinates are approximate (about a mile). 501(c)(3) status has not been verified yet; pages say "Verification preview". Events and Featured placements are labeled as samples.

## Start here
${byPrefix((p) => p === '/volunteer.html' || p === '/donate.html').map(line).join('\n')}

## Volunteer and donate by city
${byPrefix((p) => /^\/(volunteer|donate)-/.test(p)).map(line).join('\n')}

## By city and cause
${byPrefix((p) => /^\/(food|animals|environment|children|education)-/.test(p)).map(line).join('\n')}

## By cause
${byPrefix((p) => /^\/(food|animals|environment|children|education)\.html$/.test(p)).map(line).join('\n')}

## Organizations
${byPrefix((p) => p.startsWith('/org-')).map(line).join('\n')}

## Optional
${byPrefix((p) => ['/advertise.html', '/giving-guide.html', '/pricing.html', '/dashboard.html', '/arizona-issue-01.html', '/places.html', '/about.html', '/privacy.html'].includes(p)).map(line).join('\n')}
`;
  writeFileSync(new URL('./llms.txt', OUT), llms);
  writeFileSync(new URL('./robots.txt', OUT), `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`);
  writeFileSync(new URL('./sitemap.xml', OUT), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((p) => `<url><loc>${SITE_ORIGIN}${p.path === '/index.html' ? '/' : p.path}</loc><lastmod>${TODAY}</lastmod><priority>${p.priority}</priority></url>`).join('\n')}
</urlset>
`);
}

function assets() {
  cpSync(new URL('./src/css/', import.meta.url), new URL('./css/', OUT), { recursive: true });
  cpSync(new URL('./src/js/', import.meta.url), new URL('./js/', OUT), { recursive: true });
  cpSync(new URL('./src/media/', import.meta.url), new URL('./media/', OUT), { recursive: true });
  mkdirSync(new URL('./data/', OUT), { recursive: true });
  writeFileSync(new URL('./data/directory.json', OUT), JSON.stringify({ orgs, sites, cities, events }));
}

home();
orgs.forEach(orgPage);
causePages();
cityPagesAll();
volunteerTab();
donateTab();
advertise();
about();
account();
pricing();
dashboard();
newsletter();
givingGuide();
privacy();
notFound();
crawlFiles();
assets();
console.log(`Built ${pages.length} pages into dist/ (origin ${SITE_ORIGIN})`);
