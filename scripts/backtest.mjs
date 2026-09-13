// Backtest the prediction model against history.
//
//   node scripts/backtest.mjs                 # all areas, last 10 years, default constants
//   node scripts/backtest.mjs --years 5       # shorter window
//   node scripts/backtest.mjs --sweep         # also try alternative constants
//   node scripts/backtest.mjs --report        # write docs/BACKTEST.md
//   node scripts/backtest.mjs --refresh       # re-download history (cached in .cache/)
//   node scripts/backtest.mjs --site-data     # offline smoke test using data/prices.json
//
// What is tested: the momentum + wholesale-lead core of js/predict.js, walking
// forward one weekly report at a time with only the data that existed on that
// date (retail reports up to and including the report date, RBOB spot prices
// dated on or before it). The EIA outlook anchor is disabled: only the current
// forecast vintage is available, and using it for past dates would leak the
// future into the test.
//
// Metrics:
//   forecast   MAE of the 1- and 2-week-ahead price vs. the actual next reports,
//              compared with "no change" (persistence); share of actuals inside
//              the uncertainty band.
//   direction  when the model calls a move of at least verdictMove over 14 days,
//              how often the actual 2-week change had the same sign.
//   decision   a driver who must buy within a week: follow the verdict (buy now,
//              or wait a week on "wait") vs. always-now, always-wait, and a
//              perfect-foresight oracle. Reported in cents per gallon.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyze, MODEL, parseDate } from '../js/predict.js';
import { AREAS } from '../js/regions.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = n => args.includes(`--${n}`);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const YEARS = Number(opt('years', 10));
const CACHE = resolve(root, '.cache/backtest-history.json');
const API_KEY = process.env.EIA_API_KEY || 'DEMO_KEY';
const DAY = 86400000;

// ---- History ----------------------------------------------------------------

async function eiaAll(route, params) {
  const rows = [];
  for (let offset = 0; ; offset += 5000) {
    const url = new URL(`https://api.eia.gov/v2/${route}/data/`);
    url.searchParams.set('api_key', API_KEY);
    for (const [k, v] of Object.entries(params)) {
      if (Array.isArray(v)) v.forEach(x => url.searchParams.append(k, x));
      else url.searchParams.set(k, v);
    }
    url.searchParams.set('length', 5000);
    url.searchParams.set('offset', offset);
    let json;
    for (let attempt = 1; ; attempt++) {
      const res = await fetch(url);
      if (res.status === 429 && attempt < 8) {   // DEMO_KEY is rate-limited; back off and retry
        const wait = 5000 * attempt;
        console.error(`  rate-limited, retrying in ${wait / 1000}s…`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      if (!res.ok) throw new Error(`EIA ${route}: HTTP ${res.status}`);
      json = await res.json();
      break;
    }
    const page = json.response?.data ?? [];
    rows.push(...page);
    if (page.length < 5000) break;
  }
  return rows;
}

async function loadHistory() {
  if (flag('site-data')) {   // offline smoke test on the site's own data file (2y retail, 90d RBOB)
    const d = JSON.parse(await readFile(resolve(root, 'data/prices.json'), 'utf8'));
    const areas = Object.fromEntries(Object.entries(d.areas).map(([id, a]) => [id, a.weekly]));
    return { years: 2, fetchedAt: d.generatedAt, areas, rbob: d.wholesale.rbob };
  }
  if (existsSync(CACHE) && !flag('refresh')) {
    const cached = JSON.parse(await readFile(CACHE, 'utf8'));
    if (cached.years >= YEARS) return cached;
  }
  const start = new Date(Date.now() - (YEARS + 0.5) * 365.25 * DAY).toISOString().slice(0, 10);
  console.error(`Downloading ${YEARS}y of history from EIA (start ${start})…`);
  const areaIds = Object.keys(AREAS);
  const weeklyRows = await eiaAll('petroleum/pri/gnd', {
    frequency: 'weekly', 'data[0]': 'value', 'facets[product][]': 'EPMR',
    'facets[duoarea][]': areaIds, start, 'sort[0][column]': 'period', 'sort[0][direction]': 'asc',
  });
  const areas = {};
  for (const r of weeklyRows) {
    const price = Number(r.value);
    if (!areaIds.includes(r.duoarea) || !Number.isFinite(price)) continue;
    (areas[r.duoarea] ||= []).push({ date: r.period, price });
  }
  for (const s of Object.values(areas)) s.sort((a, b) => a.date.localeCompare(b.date));

  const spotRows = await eiaAll('petroleum/pri/spt', {
    frequency: 'daily', 'data[0]': 'value', 'facets[series][]': 'EER_EPMRU_PF4_Y35NY_DPG',
    start, 'sort[0][column]': 'period', 'sort[0][direction]': 'asc',
  });
  const rbob = spotRows.map(r => ({ date: r.period, price: Number(r.value) }))
    .filter(p => Number.isFinite(p.price)).sort((a, b) => a.date.localeCompare(b.date));

  const data = { years: YEARS, fetchedAt: new Date().toISOString(), areas, rbob };
  await mkdir(dirname(CACHE), { recursive: true });
  await writeFile(CACHE, JSON.stringify(data));
  return data;
}

// ---- Walk-forward -----------------------------------------------------------

const WARMUP = 26;       // reports before the first evaluation
const RBOB_WINDOW = 90;  // days of spot history handed to the model (as on the site)

function walk(history, useWholesale = true) {
  const rows = [];
  const rbobAll = history.rbob;
  let ri = 0; // moving pointer into rbob (sorted)
  for (const [area, series] of Object.entries(history.areas)) {
    ri = 0;
    for (let t = WARMUP; t < series.length - 2; t++) {
      const asOf = series[t].date;
      const asOfMs = parseDate(asOf);
      while (ri < rbobAll.length && rbobAll[ri].date <= asOf) ri++;
      const rbob = useWholesale
        ? rbobAll.slice(Math.max(0, ri - RBOB_WINDOW), ri) : [];
      const r = analyze({ series: series.slice(0, t + 1), wholesale: { rbob }, now: asOfMs });
      const p7 = r.projection[7], p14 = r.projection[14];
      const a0 = series[t].price, a1 = series[t + 1].price, a2 = series[t + 2].price;
      rows.push({
        area, asOf, a0, a1, a2,
        f7: p7.price, f14: p14.price, lo7: p7.low, hi7: p7.high, lo14: p14.low, hi14: p14.high,
        change14: r.change14, verdict: r.verdict.key, score: r.score,
      });
    }
  }
  return rows;
}

// ---- Metrics ----------------------------------------------------------------

const mean = xs => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
const c = v => (v * 100).toFixed(2);   // dollars → cents string
const pct = v => (v * 100).toFixed(1) + '%';

function metrics(rows) {
  const mae7 = mean(rows.map(r => Math.abs(r.f7 - r.a1)));
  const mae14 = mean(rows.map(r => Math.abs(r.f14 - r.a2)));
  const naive7 = mean(rows.map(r => Math.abs(r.a0 - r.a1)));
  const naive14 = mean(rows.map(r => Math.abs(r.a0 - r.a2)));
  const in7 = mean(rows.map(r => (r.a1 >= r.lo7 && r.a1 <= r.hi7 ? 1 : 0)));
  const in14 = mean(rows.map(r => (r.a2 >= r.lo14 && r.a2 <= r.hi14 ? 1 : 0)));

  const called = rows.filter(r => Math.abs(r.change14) >= MODEL.verdictMove);
  const dirHit = mean(called.map(r => (Math.sign(r.change14) === Math.sign(r.a2 - r.a0) ? 1 : 0)));
  const baseUp = mean(rows.map(r => (r.a2 > r.a0 ? 1 : 0)));
  const calledUp = called.filter(r => r.change14 > 0);
  const calledDown = called.filter(r => r.change14 < 0);
  const upHit = mean(calledUp.map(r => (r.a2 > r.a0 ? 1 : 0)));
  const downHit = mean(calledDown.map(r => (r.a2 < r.a0 ? 1 : 0)));

  // Decision: must buy within a week. Verdict "wait" → buy next week, else buy now.
  const payNow = rows.map(r => r.a0);
  const payWait = rows.map(r => r.a1);
  const payModel = rows.map(r => (r.verdict === 'wait' ? r.a1 : r.a0));
  const payOracle = rows.map(r => Math.min(r.a0, r.a1));
  const now = mean(payNow), wait = mean(payWait), model = mean(payModel), oracle = mean(payOracle);
  const waitRows = rows.filter(r => r.verdict === 'wait');
  const waitSaved = mean(waitRows.map(r => r.a0 - r.a1));
  const waitRight = mean(waitRows.map(r => (r.a1 < r.a0 ? 1 : 0)));

  return {
    n: rows.length, areas: new Set(rows.map(r => r.area)).size,
    from: rows.reduce((m, r) => (r.asOf < m ? r.asOf : m), '9999'),
    to: rows.reduce((m, r) => (r.asOf > m ? r.asOf : m), '0000'),
    mae7, mae14, naive7, naive14, in7, in14,
    calledShare: called.length / rows.length, dirHit, baseUp, upHit, downHit,
    nUp: calledUp.length, nDown: calledDown.length,
    now, wait, model, oracle,
    savedVsNow: now - model, savedVsWait: wait - model, oracleGain: now - oracle,
    captured: (now - model) / (now - oracle || 1),
    waitShare: waitRows.length / rows.length, waitSaved, waitRight,
    verdicts: Object.fromEntries(['now', 'ok', 'wait'].map(k => [k, rows.filter(r => r.verdict === k).length / rows.length])),
  };
}

function printMetrics(m, title) {
  console.log(`\n== ${title} ==`);
  console.log(`${m.n} decisions across ${m.areas} areas, ${m.from} → ${m.to}`);
  console.log(`Forecast MAE   1wk ${c(m.mae7)}¢ (no-change ${c(m.naive7)}¢)   2wk ${c(m.mae14)}¢ (no-change ${c(m.naive14)}¢)`);
  console.log(`Band coverage  1wk ${pct(m.in7)}   2wk ${pct(m.in14)}   (target ≈ 68%)`);
  console.log(`Direction      called on ${pct(m.calledShare)} of weeks; right ${pct(m.dirHit)}  `
    + `[up ${pct(m.upHit)} of ${m.nUp}, down ${pct(m.downHit)} of ${m.nDown}; base rate up ${pct(m.baseUp)}]`);
  console.log(`Verdict mix    now ${pct(m.verdicts.now)}  no-rush ${pct(m.verdicts.ok)}  wait ${pct(m.verdicts.wait)}`);
  console.log(`Decision       follow model $${m.model.toFixed(4)}  always-now $${m.now.toFixed(4)}  always-wait $${m.wait.toFixed(4)}  oracle $${m.oracle.toFixed(4)}`);
  console.log(`               saves ${c(m.savedVsNow)}¢/gal vs always-now, ${c(m.savedVsWait)}¢/gal vs always-wait; `
    + `captures ${pct(m.captured)} of the oracle's ${c(m.oracleGain)}¢`);
  console.log(`               "wait" calls: ${pct(m.waitShare)} of weeks, right ${pct(m.waitRight)}, avg ${c(m.waitSaved)}¢ saved each`);
}

// ---- Sweep ------------------------------------------------------------------

const SWEEP = [
  ['passThrough', [0, 0.35, 0.7, 1.0]],
  ['verdictMove', [0.01, 0.02, 0.03, 0.05]],
  ['momentumPoints', [4, 6, 8, 12]],
  ['leadLookbackDays', [5, 10, 15]],
];

function withModel(overrides, fn) {
  const saved = { ...MODEL };
  Object.assign(MODEL, overrides);
  try { return fn(); } finally { Object.assign(MODEL, saved); }
}

// ---- Main -------------------------------------------------------------------

const history = await loadHistory();
const base = metrics(walk(history));
printMetrics(base, `Default constants (retail momentum + wholesale lead, no outlook)`);
const noWholesale = metrics(walk(history, false));
printMetrics(noWholesale, 'Without the wholesale lead (momentum only)');

const perArea = Object.entries(history.areas).map(([id]) => {
  const m = metrics(walk({ areas: { [id]: history.areas[id] }, rbob: history.rbob }));
  return { id, name: AREAS[id].name, ...m };
}).sort((a, b) => b.savedVsNow - a.savedVsNow);
console.log('\n== Per area (¢/gal saved vs always-now · direction hit rate · 1wk MAE vs no-change) ==');
for (const a of perArea) {
  console.log(`${a.name.padEnd(32)} ${c(a.savedVsNow).padStart(6)}¢   ${pct(a.dirHit).padStart(6)}   ${c(a.mae7)}¢ vs ${c(a.naive7)}¢`);
}

let sweep = [];
if (flag('sweep')) {
  console.log('\n== Sweep (one constant at a time) ==');
  for (const [key, values] of SWEEP) {
    for (const v of values) {
      const m = withModel({ [key]: v }, () => metrics(walk(history)));
      sweep.push({ key, value: v, ...m });
      console.log(`${key}=${String(v).padEnd(5)}  saved ${c(m.savedVsNow).padStart(5)}¢  captured ${pct(m.captured).padStart(6)}  `
        + `dir ${pct(m.dirHit)}  1wk MAE ${c(m.mae7)}¢  wait ${pct(m.waitShare)}`);
    }
  }
}

if (flag('report')) {
  const md = renderReport(base, noWholesale, perArea, sweep, history);
  const out = resolve(root, 'docs/BACKTEST.md');
  await writeFile(out, md);
  console.log(`\nWrote ${out}`);
}

function renderReport(m, m0, areas, sweep, history) {
  const row = (label, x) => `| ${label} | ${c(x.mae7)}¢ / ${c(x.naive7)}¢ | ${c(x.mae14)}¢ / ${c(x.naive14)}¢ | ${pct(x.in7)} / ${pct(x.in14)} | ${pct(x.dirHit)} (${pct(x.calledShare)} called) | ${c(x.savedVsNow)}¢ | ${pct(x.captured)} |`;
  const lines = [];
  lines.push('# Backtest results', '',
    `Generated ${new Date().toISOString().slice(0, 10)} by \`node scripts/backtest.mjs --sweep --report\` `
    + `on ${YEARS} years of EIA history (${m.from} → ${m.to}), ${m.n.toLocaleString()} weekly decisions across ${m.areas} areas.`, '',
    '## Method', '',
    'Walk forward one weekly report at a time, giving the model only what existed on that date: retail reports up to the report date and NY Harbor RBOB spot prices dated on or before it (the same 90-day window the site uses). The EIA outlook anchor is **disabled** — only the current forecast vintage is available, and using it for past dates would leak the future into the test. So this measures the momentum + wholesale-lead core of the model, which drives the tomorrow / this-week / verdict numbers on the site.', '',
    '- **Forecast MAE** — mean absolute error of the 1- and 2-week-ahead prediction against the actual next reports, next to a "no change" baseline.',
    '- **Band coverage** — share of actual prices that fell inside the uncertainty band (a ±1σ band should catch ≈68%).',
    '- **Direction** — when the model predicts a 14-day move of at least the verdict threshold, how often the actual 2-week change had the same sign.',
    '- **Decision** — a driver who must buy within the week follows the verdict: buy now, or buy next week on "wait". Compared with always-now, always-wait, and a perfect-foresight oracle (min of the two). Savings are in cents per gallon, averaged over every week.', '',
    '## Results', '',
    '| Variant | 1wk MAE / no-change | 2wk MAE / no-change | Band 1wk / 2wk | Direction right | Saved vs always-now | Of oracle |',
    '|---|---|---|---|---|---|---|',
    row('Default (momentum + wholesale)', m),
    row('Momentum only', m0), '',
    `Default verdict mix: fill up now ${pct(m.verdicts.now)}, no rush ${pct(m.verdicts.ok)}, wait ${pct(m.verdicts.wait)}. `
    + `"Wait" calls were right ${pct(m.waitRight)} of the time and saved ${c(m.waitSaved)}¢/gal on average when made. `
    + `Always waiting a week would have cost ${c(m.wait - m.now)}¢/gal relative to always buying now; the oracle saves ${c(m.oracleGain)}¢/gal.`, '',
    '## Per area', '',
    '| Area | Saved vs always-now | Direction right | 1wk MAE / no-change |', '|---|---|---|---|');
  for (const a of areas) lines.push(`| ${a.name} | ${c(a.savedVsNow)}¢ | ${pct(a.dirHit)} | ${c(a.mae7)}¢ / ${c(a.naive7)}¢ |`);
  if (sweep.length) {
    lines.push('', '## Constant sweep (one at a time, others at default)', '',
      '| Constant | Value | Saved vs always-now | Of oracle | Direction right | 1wk MAE | Wait share |', '|---|---|---|---|---|---|---|');
    for (const s of sweep) {
      const isDefault = s.value === ({ passThrough: 0.7, verdictMove: 0.02, momentumPoints: 6, leadLookbackDays: 10 })[s.key];
      lines.push(`| \`${s.key}\` | ${s.value}${isDefault ? ' (default)' : ''} | ${c(s.savedVsNow)}¢ | ${pct(s.captured)} | ${pct(s.dirHit)} | ${c(s.mae7)}¢ | ${pct(s.waitShare)} |`);
    }
  }
  lines.push('', '## Caveats', '',
    '- No outlook anchor in the test (see Method), so the 2-week numbers on the live site blend in one more signal than is measured here.',
    '- Weekly area averages, not station prices. A driver who shops around can beat any of these numbers.',
    '- The decision metric assumes the tank can wait a week. If it cannot, only the "now" and "no rush" verdicts apply.',
    '- Past behaviour of gas prices does not guarantee future behaviour. This is a calibration aid, not a promise.', '');
  return lines.join('\n');
}
