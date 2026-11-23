// One place for the site origin. Set SITE_ORIGIN when deploying,
// e.g. SITE_ORIGIN=https://nonprofit-star.example npm run build
// On Netlify, URL is the site's main address; SITE_ORIGIN overrides it.
export const SITE_ORIGIN = (process.env.SITE_ORIGIN || process.env.URL || 'http://localhost:8787').replace(/\/$/, '');
export const SITE_NAME = 'Nonprofit Star';
export const PORT = Number(process.env.PORT || 8787);
export const IRS_TEOS = 'https://apps.irs.gov/app/eos/';
// Short tax note from the business plan.
export const TAX_NOTE = 'From tax year 2026, people who take the standard deduction can deduct up to $1,000 in cash gifts to qualifying charities ($2,000 for married couples filing jointly). Gifts to donor-advised funds and supporting organizations do not qualify for this deduction. Itemizers deduct as before, above a floor of 0.5% of income. This is general information, not tax advice.';

// Google Maps on the newsletter page. Set GOOGLE_MAPS_EMBED_KEY (a Maps Embed API key restricted to your
// domain) to use the official Embed API. Without a key we fall back to Google's keyless embed URL.
// The key is read from the environment at build time and is never committed.
export const GOOGLE_MAPS_EMBED_KEY = process.env.GOOGLE_MAPS_EMBED_KEY || '';
export const mapsEmbedBase = () => (GOOGLE_MAPS_EMBED_KEY
  ? `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(GOOGLE_MAPS_EMBED_KEY)}&language=en&zoom=11&q=`
  : 'https://maps.google.com/maps?hl=en&z=11&output=embed&q=');
