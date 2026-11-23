// Newsletter opt-in: unticked checkbox; the email field appears only after ticking it.
const $ = (id) => document.getElementById(id);
const optin = $('optin');
if (optin) {
  $('optin-check').addEventListener('change', (ev) => {
    $('optin-fields').hidden = !ev.target.checked;
    if (ev.target.checked) $('optin-email').focus(); else $('optin-msg').textContent = '';
  });
  optin.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const email = $('optin-email');
    const msg = $('optin-msg');
    if (!email.value || !email.checkValidity()) { msg.textContent = 'Enter a valid email address.'; email.focus(); return; }
    const area = $('optin-area')?.value || window.__nsArea || 'Arizona'; // region, city or ZIP only
    msg.textContent = 'Saving...';
    try {
      const res = await fetch('/api/subscribe', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: email.value, area }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Server returned ${res.status}`);
      msg.textContent = `Subscribed ${email.value} for events in ${area}. Demo: no email is sent.`;
      optin.querySelector('button[type=submit]').disabled = true;
    } catch (e) {
      msg.textContent = `Could not subscribe: ${e.message}. Check your connection and try again.`;
    }
  });
}
