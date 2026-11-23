// Account page dialog (opens only from the "Create account" button) and outbound click logging.
const dlg = document.getElementById('account');
const form = document.getElementById('account-form');
const msg = document.getElementById('account-msg');
document.querySelectorAll('[data-open-account]').forEach((b) => b.addEventListener('click', () => { if (msg) msg.textContent = ''; dlg?.showModal(); }));
document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog')?.close()));
form?.addEventListener('submit', (ev) => {
  ev.preventDefault();
  const email = form.elements.email;
  if (!email.value || !email.checkValidity()) { msg.textContent = 'Enter a valid email address.'; email.focus(); return; }
  if (!form.elements.agree.checked) { msg.textContent = 'Tick the privacy policy box to continue.'; form.elements.agree.focus(); return; }
  msg.textContent = 'Saved in preview only. Accounts are not live in this demo, so nothing was sent or stored.';
});
const login = document.getElementById('login-form');
login?.addEventListener('submit', (ev) => {
  ev.preventDefault();
  document.getElementById('login-msg').textContent = 'Log in is a preview in this demo. Nothing was sent.';
});
// Log outbound clicks by organization only (city or ZIP if set; never coordinates).
document.addEventListener('click', (ev) => {
  const a = ev.target.closest('a[data-log="outbound"]');
  if (!a) return;
  const body = JSON.stringify({ kind: 'outbound', org: a.dataset.org, area: window.__nsArea || null });
  try { navigator.sendBeacon?.('/api/log', new Blob([body], { type: 'application/json' })); } catch { /* ignore */ }
});
// Vendor menu: close on outside click or Escape.
const vendor = document.querySelector('details.vendor');
if (vendor) {
  document.addEventListener('click', (ev) => { if (vendor.open && !vendor.contains(ev.target)) vendor.open = false; });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && vendor.open) { vendor.open = false; vendor.querySelector('summary').focus(); } });
}
