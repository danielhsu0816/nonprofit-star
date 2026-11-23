// Demo newsletter opt-in on Netlify. Validates the email and stores nothing; no email is sent.
export default async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'Use POST' }, { status: 405 });
  let b = {};
  try { b = await req.json(); } catch { return Response.json({ error: 'Invalid request' }, { status: 400 }); }
  const email = String(b.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) return Response.json({ error: 'That email address looks incomplete' }, { status: 400 });
  return Response.json({ ok: true, sent: false, stored: false });
};
export const config = { path: ['/api/subscribe', '/api/profile'] };
