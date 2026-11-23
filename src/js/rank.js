// Shared ranking code. Runs in the browser (served as /js/rank.js) and in
// build.mjs (to pre-render the default Phoenix results into static HTML).

// All ranking knobs live here.
export const RANKING = {
  weights: { distance: 0.4, cause: 0.3, timeliness: 0.2, completeness: 0.1 },
  radii: [5, 10, 25, 50],
  defaultRadius: 10,
  widenSteps: [10, 25, 50], // used only when the visitor has not picked a radius
  minResults: 10,
  featuredMax: 3,
  // Sample placements only. These organizations are not paying customers.
  sampleFeatured: ['stmarysfoodbank', 'azhumane', 'keeptempebeautiful'],
  intentWays: { volunteer: ['Time'], donate: ['Money', 'Food'] },
  freshDays: 90, // profiles updated within this many days score full timeliness
};

const R = 3958.8; // Earth radius in miles
const rad = (d) => (d * Math.PI) / 180;

export function haversineMiles(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// "About N miles away". Coordinates are good to about a mile, so no decimals.
export function milesLabel(m) {
  const n = Math.max(1, Math.round(m));
  return `About ${n} mile${n === 1 ? '' : 's'} away`;
}

export function matchesIntent(org, intents) {
  if (!intents || intents.length === 0) return true;
  return intents.some((i) => (RANKING.intentWays[i] || []).some((w) => org.ways.includes(w)));
}

export function completeness(org, sites) {
  const checks = [org.description, org.website, org.ways?.length, org.cause, sites.length, org.reach];
  return checks.filter(Boolean).length / checks.length;
}

function timeliness(org, now) {
  if (!org.updated) return 0;
  const days = (now - Date.parse(org.updated)) / 86400000;
  return days <= RANKING.freshDays ? 1 : Math.max(0, 1 - (days - RANKING.freshDays) / 365);
}

// Returns { radius, widened, featured, local, remote }.
// local: orgs with a site inside the radius, each with its nearest site.
// remote: orgs with no local site (Nationwide / Online), listed after local.
export function rank({ orgs, sites, origin, intents = [], causes = [], radius = null, now = Date.now() }) {
  const W = RANKING.weights;
  const pool = orgs.filter((o) => matchesIntent(o, intents));

  const withSites = [];
  const remote = [];
  for (const org of pool) {
    let orgSites = sites.filter((s) => s.org === org.id);
    if (intents.length === 1 && intents[0] === 'volunteer') orgSites = orgSites.filter((s) => s.volunteer);
    if (orgSites.length === 0) { remote.push({ org }); continue; }
    let best = null;
    for (const s of orgSites) {
      const miles = haversineMiles(origin, s);
      if (!best || miles < best.miles) best = { site: s, miles };
    }
    withSites.push({ org, ...best, siteCount: orgSites.length });
  }

  const steps = radius ? [radius] : RANKING.widenSteps;
  let r = steps[0];
  let inside = [];
  for (const step of steps) {
    r = step;
    inside = withSites.filter((x) => x.miles <= step);
    if (inside.length >= RANKING.minResults) break;
  }

  const scored = inside.map((x) => {
    const causeScore = causes.length === 0 ? 1 : causes.includes(x.org.cause) ? 1 : 0;
    const parts = {
      distance: 1 - x.miles / r,
      cause: causeScore,
      timeliness: timeliness(x.org, now),
      completeness: completeness(x.org, sites.filter((s) => s.org === x.org.id)),
    };
    const score = Object.keys(W).reduce((sum, k) => sum + W[k] * parts[k], 0);
    return { ...x, score, causeMatch: causeScore === 1 };
  }).sort((a, b) => b.score - a.score || a.miles - b.miles);

  // Featured: sample placements that already match (and match the cause, if one is chosen).
  const featured = scored
    .filter((x) => RANKING.sampleFeatured.includes(x.org.id) && x.causeMatch)
    .slice(0, RANKING.featuredMax);
  const featuredIds = new Set(featured.map((x) => x.org.id));
  const local = scored.filter((x) => !featuredIds.has(x.org.id));

  const remoteSorted = remote
    .map((x) => ({ ...x, causeMatch: causes.length === 0 || causes.includes(x.org.cause) }))
    .sort((a, b) => Number(b.causeMatch) - Number(a.causeMatch));

  return { radius: r, widened: !radius && r !== steps[0], featured, local, remote: remoteSorted };
}
