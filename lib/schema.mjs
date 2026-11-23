// schema.org JSON-LD builders. All URLs are absolute (SITE_ORIGIN).
import { SITE_ORIGIN, SITE_NAME } from '../config.mjs';
import { actionUrl } from '../src/js/render.js';

const abs = (p) => SITE_ORIGIN + p;
const ctx = (graph) => ({ '@context': 'https://schema.org', '@graph': graph });

export const siteOrg = () => ({
  '@type': 'Organization',
  '@id': abs('/#organization'),
  name: SITE_NAME,
  url: abs('/'),
  logo: abs('/media/star.svg'),
  description: 'Free directory that matches people with nonprofits they can volunteer for or donate to, filtered by area and cause.',
  knowsAbout: ['Volunteering', 'Charitable giving', 'Nonprofit organizations in the Phoenix area'],
});

export const website = () => ({
  '@type': 'WebSite',
  '@id': abs('/#website'),
  name: SITE_NAME,
  url: abs('/'),
  publisher: { '@id': abs('/#organization') },
  potentialAction: {
    '@type': 'SearchAction',
    target: { '@type': 'EntryPoint', urlTemplate: abs('/?q={search_term_string}') },
    'query-input': 'required name=search_term_string',
  },
});

export const postal = (s) => ({
  '@type': 'PostalAddress',
  ...(s.street ? { streetAddress: s.street } : {}),
  addressLocality: s.city,
  addressRegion: s.state,
  ...(s.zip ? { postalCode: s.zip } : {}),
  addressCountry: 'US',
});

export const place = (s) => ({
  '@type': 'Place',
  name: s.name,
  address: postal(s),
  geo: { '@type': 'GeoCoordinates', latitude: s.lat, longitude: s.lng },
});

export const orgId = (org) => abs(`/org-${org.id}.html#org`);

// NGO node with a location per site, areaServed, and actions.
// schema.org has no "VolunteerAction" type; volunteering is modelled as JoinAction.
export function ngo(org, sites) {
  const url = actionUrl(org);
  const actions = sites.filter((s) => s.volunteer).map((s) => ({
    '@type': 'JoinAction',
    name: `Volunteer at ${s.name}`,
    location: place(s),
    target: url,
  }));
  if (org.ways.includes('Money') || org.ways.includes('Food')) {
    actions.push({ '@type': 'DonateAction', name: `Give to ${org.name}`, recipient: { '@id': orgId(org) }, target: url });
  }
  const areas = [...new Set(sites.map((s) => s.city))];
  return {
    '@type': 'NGO',
    '@id': orgId(org),
    name: org.name,
    url: org.website,
    description: org.description,
    sameAs: [org.website, org.localWebsite].filter(Boolean),
    ...(org.chapter ? { department: { '@type': 'NGO', name: org.chapter, url: org.localWebsite } } : {}),
    areaServed: areas.length
      ? areas.map((c) => ({ '@type': 'City', name: `${c}, AZ` }))
      : { '@type': 'Country', name: 'United States' },
    location: sites.map(place),
    potentialAction: actions,
  };
}

export const breadcrumbs = (items) => ({
  '@type': 'BreadcrumbList',
  itemListElement: items.map(([href, name], i) => ({ '@type': 'ListItem', position: i + 1, name, item: abs(href) })),
});

export const faqPage = (qas) => ({
  '@type': 'FAQPage',
  mainEntity: qas.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
});

export const webPage = (type, path, name, description, extra = {}) => ({
  '@type': type,
  '@id': abs(path + '#page'),
  url: abs(path),
  name,
  description,
  isPartOf: { '@id': abs('/#website') },
  ...extra,
});

// Sample events: the visible page labels each one "Sample event".
export function sampleEvent(e, cities) {
  const c = cities.find((x) => x.name === e.city);
  return {
    '@type': 'Event',
    name: `Sample event: ${e.title}`,
    description: `Illustrative sample event, not a real listing. ${e.blurb}`,
    startDate: `${e.date}T${e.start}:00-07:00`,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    location: {
      '@type': 'Place',
      name: `${e.city}, AZ`,
      address: { '@type': 'PostalAddress', addressLocality: e.city, addressRegion: 'AZ', addressCountry: 'US' },
      ...(c ? { geo: { '@type': 'GeoCoordinates', latitude: c.lat, longitude: c.lng } } : {}),
    },
    organizer: { '@type': 'Organization', name: `${e.organizer} (fictional sample organizer)` },
    isAccessibleForFree: true,
  };
}

export { ctx, abs };
