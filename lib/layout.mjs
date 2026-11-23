import { SITE_ORIGIN, SITE_NAME } from '../config.mjs';
import { esc } from '../src/js/render.js';

const NAV = [
  ['/', 'Home'],
  ['/volunteer.html', 'Volunteer'],
  ['/donate.html', 'Donate'],
  ['/about.html', 'About Us'],
];
// For nonprofits that want to buy our services: kept in one quiet menu.
const VENDOR = [
  ['/pricing.html', 'Premiere plans', 'Free, Featured and Premium listings'],
  ['/advertise.html', 'Advertise an event', '$50 per issue, email and homepage'],
  ['/arizona-issue-01.html', 'Newsletter', 'See the Arizona Weekly sample issue'],
  ['/dashboard.html', 'Dashboard preview', 'What Premium members see'],
  ['/account.html', 'Vendor log in', 'Create an account or log in'],
];
const VENDOR_PATHS = VENDOR.map(([h]) => h);

export function crumbs(items) {
  return `<nav class="crumbs" aria-label="Breadcrumb"><ol>${items.map(([href, name], i) =>
    i === items.length - 1 ? `<li aria-current="page">${esc(name)}</li>` : `<li><a href="${href}">${esc(name)}</a></li>`).join('')}</ol></nav>`;
}

export function layout({ path, title, description, body, jsonld = [], scripts = [], bare = false }) {
  const canonical = SITE_ORIGIN + (path === '/index.html' ? '/' : path);
  const ld = jsonld.map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`).join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:image" content="${SITE_ORIGIN}/media/og.png">
<link rel="icon" href="/media/mark-32.png" type="image/png">
<link rel="apple-touch-icon" href="/media/mark-180.png">
<link rel="stylesheet" href="/css/atlas.css">
${ld}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site-head"><div class="wrap rule">
<a class="brand" href="/"><img src="/media/logo.png" width="187" height="40" alt="Nonprofit Star, home"></a>
<nav class="site-nav" aria-label="Main">${NAV.map(([h, t]) => `<a href="${h}"${h === path || (h === '/' && path === '/index.html') ? ' aria-current="page"' : ''}>${t}</a>`).join('')}
<details class="vendor"><summary class="btn btn-ink"${VENDOR_PATHS.includes(path) ? ' data-current' : ''}>I am a vendor</summary>
<div class="vendor-menu"><p class="eyebrow">For nonprofits</p>${VENDOR.map(([h, t, d]) => `<a href="${h}"${h === path ? ' aria-current="page"' : ''}><b>${t}</b><span>${d}</span></a>`).join('')}</div></details></nav>
</div></header>
<main id="main" class="wrap${bare ? '' : ' page'}">
${body}
</main>
<footer class="site-foot"><div class="wrap rule">
<a href="/"><img src="/media/logo.png" width="150" height="32" alt="Nonprofit Star"></a>
<nav aria-label="Footer"><a href="/volunteer.html">Volunteer near you</a><a href="/donate.html">Ways to donate</a><a href="/giving-guide.html">Giving guide</a><a href="/places.html">Places by city</a><a href="/pricing.html">For nonprofits</a><a href="/privacy.html">Privacy</a><a href="/llms.txt">llms.txt</a></nav>
<p class="fine">We link to each nonprofit's own website and never handle donations or sign-ups. Featured placements and events are labeled samples in this demo. Photos by Pexels contributors.</p>
</div></footer>
<script type="module" src="/js/account.js"></script>
${scripts.map((s) => `<script type="module" src="${s}"></script>`).join('\n')}
</body>
</html>
`;
}
