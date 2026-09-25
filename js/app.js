import { AREAS, STATES, GRADES, FUEL_CHOICES, KIND_LABELS, areaForCoords } from './regions.js';
import { analyze, parseDate } from './predict.js';
import { renderChart, fillTable } from './chart.js';

const DATA_URL = 'data/prices.json';
const STORAGE_KEY = 'fuelcast.selection';
const GRADE_KEY = 'fuelcast.grade';
const STALE_DAYS = 10;
const DAY_MS = 86400000;

const $ = id => document.getElementById(id);
const money = v => `$${v.toFixed(2)}`;
// Small amounts read best in cents; a dollar or more reads better as dollars.
const cents = v => {
  const c = Math.abs(Math.round(v * 100));
  return c >= 100 ? `$${(c / 100).toFixed(2)}` : `${c}¢`;
};
const fmtDate = s => new Date(parseDate(s)).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
// For values interpolated into innerHTML templates.
const esc = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const fmtMonth = s => new Date(parseDate(s)).toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' });

let data = null;
let grade = 'regular';

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

// URL hash: "#state:TX" or "#state:TX/diesel". Old midgrade / premium links
// are folded into gas (regular).
const FUEL_ALIASES = { midgrade: 'regular', premium: 'regular' };
function resolveFuel(g) {
  const key = FUEL_ALIASES[g] || g;
  return FUEL_CHOICES.includes(key) ? key : null;
}

function parseHash() {
  const [sel, g] = decodeURIComponent(location.hash.slice(1)).split('/');
  return { sel: resolveSelection(sel) ? sel : null, grade: resolveFuel(g) };
}

function initialSelection() {
  const h = parseHash();
  if (h.sel) return h.sel;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (resolveSelection(stored)) return stored;
  } catch { /* storage unavailable */ }
  return 'area:NUS';
}

function initialGrade() {
  const h = parseHash();
  if (h.grade) return h.grade;
  try {
    const stored = resolveFuel(localStorage.getItem(GRADE_KEY));
    if (stored) return stored;
  } catch { /* storage unavailable */ }
  return 'regular';
}

function persist(value) {
  try { localStorage.setItem(STORAGE_KEY, value); localStorage.setItem(GRADE_KEY, grade); } catch { /* ignore */ }
  history.replaceState(null, '', `#${encodeURIComponent(value)}${grade === 'regular' ? '' : '/' + grade}`);
}

function buildGradeSelect() {
  const box = $('gradeSelect');
  box.replaceChildren(...FUEL_CHOICES.map(key => {
    const b = document.createElement('button');
    b.type = 'button'; b.setAttribute('role', 'radio'); b.dataset.grade = key; b.textContent = GRADES[key].short;
    b.addEventListener('click', () => {
      if (grade === key) return;
      grade = key;
      syncGradeSelect();
      persist($('areaSelect').value);
      setStatus('');
      render($('areaSelect').value);
    });
    return b;
  }));
  syncGradeSelect();
}

function syncGradeSelect() {
  for (const b of $('gradeSelect').querySelectorAll('button')) {
    b.setAttribute('aria-checked', String(b.dataset.grade === grade));
    // Grey out grades nobody reports (e.g. a provider without diesel).
    b.disabled = !!data && !Object.values(data.areas).some(a => a.prices[b.dataset.grade]);
  }
}

function pickSeries(area, g) {
  const p = area && area.prices && area.prices[g];
  if (!p) return null;
  const s = p.daily && p.daily.length ? p.daily : p.weekly;
  return s && s.length ? s : null;
}

// Find this grade's series for an area, falling back to its region (then the
// U.S.) when the grade isn't reported there — EIA publishes diesel for regions
// and California only.
function seriesFor(areaId, g) {
  const area = data.areas[areaId];
  let s = pickSeries(area, g);
  if (s) return { series: s, areaId, fallback: false };
  s = pickSeries(data.areas[area.padd], g);
  if (s) return { series: s, areaId: area.padd, fallback: true };
  return { series: pickSeries(data.areas.NUS, g), areaId: 'NUS', fallback: true };
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
  const pos = r.range.pos;
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

// Midgrade / premium track regular almost exactly, so estimate each as its
// latest reported price plus whatever move regular is estimated to have made.
function otherGradesText(r, areaId, g) {
  const parts = (g.also || []).map(key => {
    const s = pickSeries(data.areas[areaId], key);
    if (!s) return null;
    const last = s[s.length - 1];
    if (last.date !== r.asOf) return null;
    return `${GRADES[key].name} ≈ ${money(last.price + (r.today - r.lastReported))}`;
  }).filter(Boolean);
  return parts.join(' · ');
}

function renderDrivers(r, g) {
  const items = [];
  const chip = (d, fmt) => `<span class="chip ${d > 0 ? 'up' : d < 0 ? 'down' : ''}">${d > 0 ? '▲' : d < 0 ? '▼' : '•'} ${fmt}</span>`;

  const m = r.drivers.momentumPerWeek;
  items.push({
    ico: '📈', t: `Local trend ${chip(Math.abs(m) < 0.005 ? 0 : m, Math.abs(m) < 0.005 ? 'flat' : `${cents(m)}/week`)}`,
    d: 'Direction of your area\'s reported average over the last six weeks, weighted toward recent weeks.',
  });

  if (r.drivers.spot) {
    const w = r.drivers.spot;
    const eff = r.drivers.wholesaleEffect;
    const what = g.lead === 'ulsd' ? 'Wholesale diesel (ULSD)' : 'Wholesale gasoline';
    items.push({
      ico: '🛢️', t: `${what} ${chip(w.delta, `${(w.pct * 100).toFixed(1)}%`)} <span class="muted">${money(w.to)}/gal (${esc(fmtDate(w.asOf))})</span>`,
      d: `NY Harbor spot price over the last ~2 weeks. Pump prices usually follow within 1–2 weeks: ${Math.abs(eff) < 0.005 ? 'little effect expected' : `roughly ${eff > 0 ? '+' : '−'}${cents(eff)} at the pump`}.`,
    });
  }
  if (r.drivers.wti) {
    const w = r.drivers.wti;
    items.push({
      ico: '🌍', t: `Crude oil (WTI) ${chip(w.delta, `${(w.pct * 100).toFixed(1)}%`)} <span class="muted">$${w.to.toFixed(2)}/bbl (${esc(fmtDate(w.asOf))})</span>`,
      d: `Crude is the biggest ingredient in ${g.lead === 'ulsd' ? 'diesel' : 'gasoline'} prices; big moves here show up at the pump over the following weeks.`,
    });
  }
  $('drivers').innerHTML = items.map(i =>
    `<li><span class="ico" aria-hidden="true">${i.ico}</span><div><div class="t">${i.t}</div><div class="d">${i.d}</div></div></li>`).join('');

  const ol = $('outlook');
  if (r.drivers.outlook.length) {
    ol.innerHTML = r.drivers.outlook.map(o =>
      `<li><span class="m">${esc(fmtMonth(o.month + '-01'))}</span><strong>${money(o.price)}</strong></li>`).join('');
  } else {
    ol.innerHTML = '<li class="muted">No official outlook available for this fuel and area.</li>';
  }
}

function render(selectionValue) {
  const sel = resolveSelection(selectionValue) || resolveSelection('area:NUS');
  const area = data.areas[sel.areaId];
  if (!area) { setStatus(`No price data for ${sel.label} yet.`, 'error'); return; }
  const g = GRADES[grade];

  const found = seriesFor(sel.areaId, grade);
  if (!found.series) { setStatus(`No ${g.name.toLowerCase()} price data is available yet.`, 'error'); return; }
  const shownArea = data.areas[found.areaId];
  const paddId = shownArea.padd;
  const regionSeries = paddId !== found.areaId ? pickSeries(data.areas[paddId], grade) : null;
  const outlookFamily = data.outlook[g.outlook] || {};
  const outlook = outlookFamily[paddId] || outlookFamily.NUS || null;
  const r = analyze({
    series: found.series,
    outlook,
    regionSeries,
    wholesale: { spot: data.wholesale[g.lead], wti: data.wholesale.wti },
  });

  let label = sel.label;
  let note = sel.note;
  if (found.fallback) {
    const base = sel.label.replace(/ \(.*\)$/, '');
    const what = shownArea.kind === 'national' ? 'U.S. average' : `${shownArea.name} region`;
    label = `${base} (${what})`;
    note = `${g.name} prices aren't reported for ${base}, so we're showing the ${what} — the closest available data.`;
  }
  $('areaNote').textContent = note;
  $('areaNote').hidden = !note;
  $('areaName').textContent = label;
  $('areaName2').textContent = label === 'U.S. average' ? 'the U.S.' : label;
  $('gradeName2').textContent = `· ${g.name.toLowerCase()}`;

  const card = $('verdictCard');
  card.dataset.verdict = r.verdict.key;
  $('verdictLabel').textContent = r.verdict.label;
  $('verdictWhy').textContent = r.verdict.why;
  $('reason').textContent = reasonText(r, label);
  $('lastReported').textContent = `$${r.lastReported.toFixed(3)}`;
  $('asOfDate').textContent = fmtDate(r.asOf);
  $('stale').innerHTML = r.daysSinceReport > 14
    ? ` <span class="stale-flag">(${r.daysSinceReport} days old — treat predictions with extra caution)</span>` : '';

  $('pToday').textContent = money(r.today);
  $('dToday').textContent = r.daysSinceReport > 0
    ? `est. from ${fmtDate(r.asOf)} report` : `per gallon, ${g.name.toLowerCase()}`;
  $('otherGrades').textContent = otherGradesText(r, found.areaId, g);
  $('otherGrades').hidden = !$('otherGrades').textContent;
  $('pTomorrow').textContent = money(r.tomorrow);
  delta($('dTomorrow'), r.tomorrow, r.today, 'vs today');
  $('pThisWeek').textContent = money(r.thisWeek);
  delta($('dThisWeek'), r.thisWeek, r.today, 'vs today');
  $('pNextWeek').textContent = money(r.nextWeek);
  delta($('dNextWeek'), r.nextWeek, r.thisWeek, 'vs this week');

  $('rLow').textContent = money(r.range.low);
  $('rAvg').textContent = money(r.range.avg);
  $('rHigh').textContent = money(r.range.high);
  $('rMarker').style.left = `${(r.range.pos * 100).toFixed(1)}%`;
  $('rNote').textContent = `Today's estimate is ${cents(r.today - r.range.low)} above the 90-day low and ${cents(r.range.high - r.today)} below the high.`;

  renderDrivers(r, g);
  renderChart($('chart'), r);
  fillTable($('dataTable').querySelector('tbody'), r);

  $('content').hidden = false;
  document.title = `${r.verdict.label} · ${label}${grade === 'regular' ? '' : ' · ' + g.name} · Fuelcast`;
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
  grade = initialGrade();
  buildGradeSelect();
  const sel = $('areaSelect');
  sel.value = initialSelection();
  sel.addEventListener('change', () => { persist(sel.value); setStatus(''); render(sel.value); });
  $('locateBtn').addEventListener('click', locate);
  window.addEventListener('hashchange', () => {
    const h = parseHash();
    const g = h.grade || 'regular';
    if ((h.sel && h.sel !== sel.value) || g !== grade) {
      if (h.sel) sel.value = h.sel;
      grade = g;
      syncGradeSelect();
      render(sel.value);
    }
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

  // Older data files (before grades) carry only regular prices at the top level.
  for (const a of Object.values(data.areas)) a.prices ||= { regular: { weekly: a.weekly, daily: a.daily } };
  data.grades ||= { regular: GRADES.regular };
  if (!data.outlook.regular && !data.outlook.diesel) data.outlook = { regular: data.outlook };
  if (!Object.values(data.areas).some(a => a.prices[grade])) grade = 'regular';
  syncGradeSelect();

  const generated = new Date(data.generatedAt);
  $('updatedAt').textContent = generated.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  if (/^https:\/\//.test(data.source?.url || '')) $('sourceLink').href = data.source.url;
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
