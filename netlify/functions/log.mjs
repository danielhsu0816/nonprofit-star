// Demo search/click log on Netlify. Accepts a city or ZIP only and stores nothing.
export default async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'Use POST' }, { status: 405 });
  let b = {};
  try { b = await req.json(); } catch { return Response.json({ error: 'Invalid request' }, { status: 400 }); }
  const area = typeof b.area === 'string' && !/-?\d+\.\d+/.test(b.area) ? b.area.slice(0, 60) : null; // never coordinates
  console.log(JSON.stringify({ kind: String(b.kind || '').slice(0, 20), area, role: b.role || null }));
  return Response.json({ ok: true });
};
export const config = { path: '/api/log' };
