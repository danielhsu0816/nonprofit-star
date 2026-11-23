// First-visit setup: four questions, then a smooth handoff into the results.
// Single-choice questions advance on pick; multi-pick questions show "Next" only after a pick.
// Answers are stored in this browser only. Exact coordinates are never stored.
import { load, save } from './store.js';
export const OKEY = 'ns:onboard';

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms) => new Promise((r) => setTimeout(r, reduced() ? 0 : ms));

export function storedAnswers() { return load(OKEY); }

// Warm, slow crossfade between the photos on the left.
function startSlides(dlg) {
  const imgs = [...dlg.querySelectorAll('.onb-slides img')];
  if (imgs.length < 2 || reduced()) return () => {};
  let i = imgs.findIndex((im) => im.classList.contains('is-on'));
  const t = setInterval(() => {
    imgs[i].classList.remove('is-on');
    i = (i + 1) % imgs.length;
    imgs[i].classList.add('is-on');
  }, 5500);
  return () => clearInterval(t);
}

// resolve(text) -> { point, label, area } | { error }
// geolocate() -> Promise<{ point, label, area, nearLabel }>
// onDone(answers, place) -> { headline, text } for the "finding" screen
export function openOnboarding({ resolve, geolocate, onDone, prefill = null }) {
  const dlg = document.getElementById('onb');
  const form = document.getElementById('onb-form');
  if (!dlg?.showModal) return;
  const steps = [...form.querySelectorAll('[data-step]')];
  const back = form.querySelector('[data-onb="back"]');
  const next = document.getElementById('onb-next');
  const msg = document.getElementById('onb-msg');
  const near = document.getElementById('onb-near');
  const bars = [...dlg.querySelectorAll('.onb-progress span')];
  let step = 1;
  let place = null;
  let anywhere = false;
  let busy = false;
  const stopSlides = startSlides(dlg);

  const role = () => form.querySelector('input[name=role]:checked')?.value || 'guest';
  const checked = (name) => [...form.querySelectorAll(`input[name=${name}]:checked`)].map((i) => i.value);
  const isNp = () => role() === 'nonprofit';

  if (prefill) {
    form.querySelectorAll('input').forEach((i) => {
      if (i.name === 'role') i.checked = i.value === prefill.role;
      if (i.name === 'cause') i.checked = (prefill.causes || []).includes(i.value);
      if (i.name === 'way') i.checked = (prefill.ways || []).includes(i.value);
      if (i.name === 'goal') i.checked = (prefill.goals || []).includes(i.value);
    });
    near.value = prefill.near || '';
  }

  // "Next" appears on multi-pick questions once at least one option is picked.
  function updateNext() {
    const picks = step === 2 ? checked('cause') : step === 3 ? checked(isNp() ? 'goal' : 'way') : [];
    next.hidden = !(step === 2 || step === 3) || picks.length === 0;
    next.parentElement.hidden = next.hidden && back.hidden; // no empty button bar
  }

  function show(n, dir = 1) {
    step = n;
    steps.forEach((s) => {
      const on = Number(s.dataset.step) === n;
      s.hidden = !on;
      if (on) { s.classList.remove('in-back', 'in-fwd'); void s.offsetWidth; s.classList.add(dir > 0 ? 'in-fwd' : 'in-back'); }
    });
    form.querySelectorAll('[data-q-supporter]').forEach((h) => { h.textContent = isNp() ? h.dataset.qNonprofit : h.dataset.qSupporter; });
    form.querySelector('[data-for="person"]').hidden = isNp();
    form.querySelector('[data-for="nonprofit"]').hidden = !isNp();
    bars.forEach((b, i) => { b.className = i < n - 1 ? 'is-done' : i === n - 1 ? 'is-now' : ''; });
    document.getElementById('onb-count').textContent = n <= 4 ? `Question ${n} of 4` : 'All set';
    back.hidden = n === 1 || n > 4;
    msg.textContent = '';
    updateNext();
    form.closest('.onb-main')?.scrollTo(0, 0);
    steps.find((s) => Number(s.dataset.step) === n)?.querySelector('h2')?.focus({ preventScroll: true });
  }

  async function finish(skipped = false) {
    if (busy) return;
    busy = true;
    const answers = skipped ? { skipped: true } : {
      role: role(), causes: checked('cause'), ways: checked('way'), goals: checked('goal'),
      near: anywhere ? '' : (place ? place.nearLabel || near.value.trim() : near.value.trim()),
    };
    save(OKEY, answers); // no coordinates
    if (!skipped) {
      show(5);
      const summary = onDone(answers, anywhere ? null : place);
      document.getElementById('onb-done-title').textContent = summary.headline;
      document.getElementById('onb-done-text').textContent = summary.text;
      await wait(1300);
    } else {
      onDone(answers, null);
    }
    stopSlides();
    if (reduced()) { dlg.close(); return; }
    dlg.classList.add('is-leaving');
    await wait(800);
    dlg.close();
    dlg.classList.remove('is-leaving');
    document.body.classList.add('onb-reveal');
    setTimeout(() => document.body.classList.remove('onb-reveal'), 1600);
  }

  // Question 1: advance as soon as a role is picked.
  form.querySelectorAll('input[name=role]').forEach((r) => {
    r.onchange = async () => { await wait(380); if (step === 1) show(2, 1); };
  });
  form.querySelectorAll('input[name=cause], input[name=way], input[name=goal]').forEach((c) => { c.onchange = updateNext; });
  next.onclick = () => { if (step === 2 || step === 3) show(step + 1, 1); };

  // Question 4: Enter or "Use this place" resolves the typed city or ZIP.
  form.onsubmit = (ev) => {
    ev.preventDefault();
    if (step !== 4) return;
    if (!near.value.trim()) { msg.textContent = 'Type a city or ZIP, or pick one of the options above.'; near.focus(); return; }
    const r = resolve(near.value);
    if (r.error) { msg.innerHTML = r.error; near.focus(); return; }
    place = r; anywhere = false;
    finish();
  };
  back.onclick = () => show(step - 1, -1);
  dlg.querySelectorAll('[data-onb="skip"]').forEach((b) => { b.onclick = () => finish(true); });
  dlg.oncancel = (ev) => { ev.preventDefault(); finish(true); };
  form.querySelector('[data-onb="geo"]').onclick = async (ev) => {
    const btn = ev.currentTarget;
    btn.disabled = true; btn.textContent = 'Finding your location...'; msg.textContent = '';
    try {
      place = await geolocate();
      anywhere = false; near.value = '';
      msg.textContent = `Got it${place.nearLabel ? `: near ${place.nearLabel}` : ''}.`;
      await wait(600);
      finish();
    } catch (e) {
      msg.textContent = `${e.message} Type a city or ZIP, or choose Phoenix, AZ.`;
      near.focus();
    } finally { btn.disabled = false; btn.textContent = 'Use my location'; }
  };
  form.querySelectorAll('[data-onb-place]').forEach((b) => {
    b.onclick = () => {
      const v = b.dataset.onbPlace;
      if (v) { const r = resolve(v); place = r.error ? null : r; anywhere = false; near.value = v; }
      else { place = null; anywhere = true; near.value = ''; }
      finish();
    };
  });

  busy = false;
  dlg.showModal();
  show(1); // after showModal, so focus starts on the question, not the skip link
}
