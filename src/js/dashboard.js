// Sample Premium dashboard: illustrative numbers for a fictional nonprofit.
const $ = (id) => document.getElementById(id);
// Deterministic sample series (60 days so the "prior period" comparison works).
const N = 60;
const end = new Date(Date.UTC(2026, 10, 23));
const days = Array.from({ length: N }, (_, i) => {
  const d = new Date(end); d.setUTCDate(end.getUTCDate() - (N - 1 - i));
  const wave = Math.sin(i / 3.2) * 9 + Math.sin(i / 7) * 6;
  const views = Math.round(62 + i * 0.25 + wave);
  return { d, views, volunteer: Math.round(views * 0.14 + Math.cos(i / 2.5) * 2), donate: Math.round(views * 0.09 + Math.sin(i / 4) * 1.5) };
});
const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const LABEL = { views: 'Profile views', volunteer: 'Volunteer clicks', donate: 'Donate clicks' };

function render() {
  const period = Number($('period').value);
  const metric = $('metric').value;
  const cur = days.slice(-period);
  const prev = days.slice(-2 * period, -period);
  const sum = (arr, k) => arr.reduce((a, x) => a + x[k], 0);
  const pct = (a, b) => `${a >= b ? '+' : ''}${(((a - b) / b) * 100).toFixed(1)}% vs prior period`;
  const v = sum(cur, 'views'), c = sum(cur, 'volunteer') + sum(cur, 'donate');
  const pv = sum(prev, 'views'), pc = sum(prev, 'volunteer') + sum(prev, 'donate');
  $('kpis').innerHTML = `
<div class="kpi">Profile views<b>${v.toLocaleString('en-US')}</b>${pct(v, pv)}</div>
<div class="kpi">Website clicks<b>${c.toLocaleString('en-US')}</b>${pct(c, pc)}</div>
<div class="kpi">Clicks per 100 views<b>${((c / v) * 100).toFixed(1)}</b>Outbound clicks ÷ profile views × 100</div>`;
  const W = 640, H = 160, P = 8;
  const vals = cur.map((x) => x[metric]);
  const max = Math.max(...vals) * 1.1, min = 0;
  const x = (i) => P + (i * (W - 2 * P)) / (cur.length - 1);
  const y = (val) => H - P - ((val - min) / (max - min)) * (H - 2 * P);
  const line = vals.map((val, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(val).toFixed(1)}`).join('');
  const day = $('day');
  day.max = String(cur.length - 1);
  if (Number(day.value) > cur.length - 1) day.value = String(cur.length - 1);
  const k = Number(day.value);
  $('chart').innerHTML = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${LABEL[metric]} per day, ${fmt(cur[0].d)} to ${fmt(cur.at(-1).d)}">
<line class="grid-line" x1="${P}" x2="${W - P}" y1="${y(max / 1.1)}" y2="${y(max / 1.1)}"/>
<path class="area" d="${line}L${x(cur.length - 1)},${H - P}L${x(0)},${H - P}Z"/><path class="line" d="${line}"/>
<circle class="dot" cx="${x(k)}" cy="${y(vals[k])}" r="5"/></svg>`;
  $('range').textContent = `${fmt(cur[0].d)} – ${fmt(cur.at(-1).d)}`;
  const dd = cur[k];
  $('day-out').textContent = `${fmt(dd.d)} · ${dd.views} views · ${dd.volunteer} volunteer clicks · ${dd.donate} donate clicks`;
  $('daily-table').innerHTML = `<table><thead><tr><th scope="col">Date</th><th scope="col">Profile views</th><th scope="col">Volunteer clicks</th><th scope="col">Donate clicks</th></tr></thead><tbody>${cur.map((r) => `<tr><td>${fmt(r.d)}</td><td>${r.views}</td><td>${r.volunteer}</td><td>${r.donate}</td></tr>`).join('')}</tbody></table>`;
}
['period', 'metric', 'day'].forEach((id) => $(id).addEventListener('input', render));
render();
