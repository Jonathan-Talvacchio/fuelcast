import { AREAS, STATES, KIND_LABELS, areaForCoords } from './regions.js';
import { analyze, parseDate } from './predict.js';
import { renderChart, fillTable } from './chart.js';

const DATA_URL = 'data/prices.json';
const STORAGE_KEY = 'fuelcast.selection';
const STALE_DAYS = 10;
const DAY_MS = 86400000;

const $ = id => document.getElementById(id);
const money = v => `$${v.toFixed(2)}`;
const cents = v => `${Math.abs(Math.round(v * 100))}¢`;
const fmtDate = s => new Date(parseDate(s)).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
const fmtMonth = s => new Date(parseDate(s)).toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' });

let data = null;

// ---- Selection: "area:ID" or "state:CODE" ----------------------------------

function buildSelect() {
  const sel = $('areaSelect');
  const groups = [];

  const states = document.createElement('optgroup');
  states.label = 'Your state';
  for (const [code, s] of Object.entries(STATES).sort((a, b) => a[1].name.localeCompare(b[1].name))) {
    states.appendChild(new Option(s.name, `state:${code}`));
  }
  groups.push(states);

  for (const kind of ['metro', 'region', 'national']) {
    const g = document.createElement('optgroup');
    g.label = KIND_LABELS[kind];
    const ids = Object.keys(AREAS).filter(id => AREAS[id].kind === kind)
      .sort((a, b) => AREAS[a].name.localeCompare(AREAS[b].name));
    for (const id of ids) g.appendChild(new Option(AREAS[id].name, `area:${id}`));
    groups.push(g);
  }
  sel.replaceChildren(...groups);
}

function resolveSelection(value) {
  const [type, key] = String(value || '').split(':');
  if (type === 'state' && STATES[key]) {
    const s = STATES[key];
    const area = AREAS[s.area];
    const note = area.kind === 'state' ? '' :
      `${s.name} doesn't have its own price series, so we're showing the ${area.name} regional average — the closest available data.`;
    return { value, areaId: s.area, label: area.kind === 'state' ? s.name : `${s.name} (${area.name} region)`, note };
  }
  if (type === 'area' && AREAS[key]) {
    return { value, areaId: key, label: AREAS[key].name, note: '' };
  }
  return null;
}

function initialSelection() {
  const fromHash = decodeURIComponent(location.hash.slice(1));
  if (resolveSelection(fromHash)) return fromHash;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (resolveSelection(stored)) return stored;
  } catch { /* storage unavailable */ }
  return 'area:NUS';
}

function persist(value) {
  try { localStorage.setItem(STORAGE_KEY, value); } catch { /* ignore */ }
  history.replaceState(null, '', `#${encodeURIComponent(value)}`);
}

// ---- Rendering --------------------------------------------------------------

function setStatus(msg, kind = '') {
  const el = $('status');
  el.textContent = msg;
  el.className = `status ${kind}`.trim();
}

function delta(el, value, base, suffix) {
  const d = Math.round(value * 100) / 100 - Math.round(base * 100) / 100;
  const dir = Math.abs(d) < 0.005 ? 'flat' : d > 0 ? 'up' : 'down';
  el.className = `tile-delta ${dir === 'flat' ? '' : dir}`.trim();
  el.textContent = dir === 'flat' ? `about the same ${suffix}` : `${dir === 'up' ? '▲' : '▼'} ${cents(d)} ${suffix}`;
}

function reasonText(r, areaLabel) {
  const span = r.range.high - r.range.low;
  const pos = span > 0.001 ? (r.today - r.range.low) / span : 0.5;
  const where = pos <= 0.2 ? 'near their 90-day low'
    : pos <= 0.45 ? 'below their recent average'
    : pos <= 0.7 ? 'around their recent average'
    : pos <= 0.9 ? 'above their recent average'
    : 'near their 90-day high';
  const c = r.change14;
  const trend = Math.abs(c) < 0.015 ? 'expected to stay about flat over the next two weeks'
    : `predicted to ${c > 0 ? 'rise' : 'fall'} about ${cents(c)} over the next two weeks`;
  const where2 = areaLabel === 'U.S. average' ? 'Nationally, prices' : `Prices in ${areaLabel}`;
  return `${where2} are ${where} and ${trend}.`;
}

function scoreSub(r) {
  if (r.score >= 70) return 'Great price vs. last 90 days';
  if (r.score >= 40) return 'Fair price vs. last 90 days';
  return 'Pricey vs. last 90 days';
}

function renderDrivers(r) {
  const items = [];
  const chip = (d, fmt) => `<span class="chip ${d > 0 ? 'up' : d < 0 ? 'down' : ''}">${d > 0 ? '▲' : d < 0 ? '▼' : '•'} ${fmt}</span>`;

  const m = r.drivers.momentumPerWeek;
  items.push({
    ico: '📈', t: `Local trend ${chip(Math.abs(m) < 0.005 ? 0 : m, Math.abs(m) < 0.005 ? 'flat' : `${cents(m)}/week`)}`,
    d: 'Direction of your area\'s reported average over the last six weeks, weighted toward recent weeks.',
  });

  if (r.drivers.rbob) {
    const w = r.drivers.rbob;
    const eff = r.drivers.wholesaleEffect;
    items.push({
      ico: '🛢️', t: `Wholesale gasoline ${chip(w.delta, `${(w.pct * 100).toFixed(1)}%`)} <span class="muted">${money(w.to)}/gal (${fmtDate(w.asOf)})</span>`,
      d: `NY Harbor spot price over the last ~2 weeks. Pump prices usually follow within 1–2 weeks: ${Math.abs(eff) < 0.005 ? 'little effect expected' : `roughly ${eff > 0 ? '+' : '−'}${cents(eff)} at the pump`}.`,
    });
  }
  if (r.drivers.wti) {
    const w = r.drivers.wti;
    items.push({
      ico: '🌍', t: `Crude oil (WTI) ${chip(w.delta, `${(w.pct * 100).toFixed(1)}%`)} <span class="muted">$${w.to.toFixed(2)}/bbl (${fmtDate(w.asOf)})</span>`,
      d: 'Crude is the biggest ingredient in gasoline prices; big moves here show up at the pump over the following weeks.',
    });
  }
  $('drivers').innerHTML = items.map(i =>
    `<li><span class="ico" aria-hidden="true">${i.ico}</span><div><div class="t">${i.t}</div><div class="d">${i.d}</div></div></li>`).join('');

  const ol = $('outlook');
  if (r.drivers.outlook.length) {
    ol.innerHTML = r.drivers.outlook.map(o =>
      `<li><span class="m">${fmtMonth(o.month + '-01')}</span><strong>${money(o.price)}</strong></li>`).join('');
  } else {
    ol.innerHTML = '<li class="muted">No official outlook available for this area.</li>';
  }
}

function render(selectionValue) {
  const sel = resolveSelection(selectionValue) || resolveSelection('area:NUS');
  const area = data.areas[sel.areaId];
  if (!area) { setStatus(`No price data for ${sel.label} yet.`, 'error'); return; }

  const series = area.daily && area.daily.length ? area.daily : area.weekly;
  const paddId = area.padd;
  const regionArea = paddId !== sel.areaId ? data.areas[paddId] : null;
  const r = analyze({
    series,
    outlook: data.outlook[paddId],
    regionSeries: regionArea ? (regionArea.daily?.length ? regionArea.daily : regionArea.weekly) : null,
    wholesale: data.wholesale,
  });

  $('areaNote').textContent = sel.note;
  $('areaNote').hidden = !sel.note;
  $('areaName').textContent = sel.label;
  $('areaName2').textContent = sel.label === 'U.S. average' ? 'the U.S.' : sel.label;

  const card = $('verdictCard');
  card.dataset.verdict = r.verdict.key;
  $('verdictLabel').textContent = r.verdict.label;
  $('verdictWhy').textContent = r.verdict.why;
  $('reason').textContent = reasonText(r, sel.label);
  $('lastReported').textContent = `$${r.lastReported.toFixed(3)}`;
  $('asOfDate').textContent = fmtDate(r.asOf);
  $('stale').innerHTML = r.daysSinceReport > 14
    ? ` <span class="stale-flag">(${r.daysSinceReport} days old — treat predictions with extra caution)</span>` : '';

  $('scoreNum').textContent = r.score;
  $('scoreBox').dataset.tier = r.score >= 70 ? 'good' : r.score >= 40 ? 'warn' : 'bad';
  $('ringFill').style.strokeDashoffset = (326.7 * (1 - r.score / 100)).toFixed(1);
  $('scoreSub').textContent = scoreSub(r);

  $('pToday').textContent = money(r.today);
  $('dToday').textContent = r.daysSinceReport > 0
    ? `est. from ${fmtDate(r.asOf)} report` : 'per gallon, regular';
  $('pTomorrow').textContent = money(r.tomorrow);
  delta($('dTomorrow'), r.tomorrow, r.today, 'vs today');
  $('pThisWeek').textContent = money(r.thisWeek);
  delta($('dThisWeek'), r.thisWeek, r.today, 'vs today');
  $('pNextWeek').textContent = money(r.nextWeek);
  delta($('dNextWeek'), r.nextWeek, r.thisWeek, 'vs this week');

  $('rLow').textContent = money(r.range.low);
  $('rAvg').textContent = money(r.range.avg);
  $('rHigh').textContent = money(r.range.high);
  const span = r.range.high - r.range.low;
  const pos = span > 0.001 ? Math.min(1, Math.max(0, (r.today - r.range.low) / span)) : 0.5;
  $('rMarker').style.left = `${(pos * 100).toFixed(1)}%`;
  $('rNote').textContent = `Today's estimate is ${cents(r.today - r.range.low)} above the 90-day low and ${cents(r.range.high - r.today)} below the high.`;

  renderDrivers(r);
  renderChart($('chart'), r);
  fillTable($('dataTable').querySelector('tbody'), r);

  $('content').hidden = false;
  document.title = `${r.verdict.label} · ${sel.label} · Fuelcast`;
}

// ---- Geolocation ------------------------------------------------------------

function locate() {
  const btn = $('locateBtn');
  if (!navigator.geolocation) { setStatus('Your browser does not support location lookup.', 'error'); return; }
  btn.disabled = true;
  setStatus('Finding the closest area with price data…', 'info');
  navigator.geolocation.getCurrentPosition(pos => {
    btn.disabled = false;
    const { latitude, longitude } = pos.coords;
    const hit = areaForCoords(latitude, longitude);
    const value = hit.via === 'metro' ? `area:${hit.area}`
      : `state:${Object.keys(STATES).find(c => STATES[c].name === hit.name)}`;
    $('areaSelect').value = value;
    persist(value);
    setStatus('');
    render(value);
    const note = $('areaNote');
    note.textContent = `${hit.via === 'metro' ? 'Nearest metro with data' : 'Based on your location'}: ${hit.name}. ${note.textContent}`.trim();
    note.hidden = false;
  }, err => {
    btn.disabled = false;
    setStatus(err.code === err.PERMISSION_DENIED
      ? 'Location access was denied — pick your area from the list instead.'
      : 'Could not determine your location — pick your area from the list instead.', 'error');
  }, { timeout: 10000, maximumAge: 600000 });
}

// ---- Boot -------------------------------------------------------------------

async function main() {
  buildSelect();
  const sel = $('areaSelect');
  sel.value = initialSelection();
  sel.addEventListener('change', () => { persist(sel.value); setStatus(''); render(sel.value); });
  $('locateBtn').addEventListener('click', locate);
  window.addEventListener('hashchange', () => {
    const v = decodeURIComponent(location.hash.slice(1));
    if (resolveSelection(v) && v !== sel.value) { sel.value = v; render(v); }
  });

  setStatus('Loading the latest prices…', 'info');
  try {
    const res = await fetch(DATA_URL, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (e) {
    setStatus(`Could not load price data (${e.message}). Please try again later.`, 'error');
    return;
  }

  const generated = new Date(data.generatedAt);
  $('updatedAt').textContent = generated.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  if (data.source && data.source.url) $('sourceLink').href = data.source.url;
  const ageDays = (Date.now() - generated.getTime()) / DAY_MS;
  setStatus(ageDays > STALE_DAYS
    ? `Heads up: this data was last updated ${Math.round(ageDays)} days ago, so the numbers may be out of date.` : '');

  try {
    render(sel.value);
  } catch (e) {
    console.error(e);
    setStatus(`Something went wrong showing this area: ${e.message}`, 'error');
  }
}

main();
