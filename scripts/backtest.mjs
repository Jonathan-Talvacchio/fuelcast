// Backtest the prediction model against history.
//
//   node scripts/backtest.mjs                 # all areas, last 10 years, default constants
//   node scripts/backtest.mjs --years 5       # shorter window
//   node scripts/backtest.mjs --sweep         # also try alternative constants (every grade)
//   node scripts/backtest.mjs --grade diesel  # only this grade
//   node scripts/backtest.mjs --report        # write docs/BACKTEST.md
//   node scripts/backtest.mjs --refresh       # re-download history (cached in .cache/)
//   node scripts/backtest.mjs --site-data     # offline smoke test using data/prices.json
//   node scripts/backtest.mjs --calibrate     # also write js/calibration.js (odds shown on the site)
//
// What is tested: the momentum + wholesale-lead core of js/predict.js, for each
// fuel grade, walking forward one weekly report at a time with only the data
// that existed on that date (retail reports up to and including the report
// date, and the grade's wholesale spot series — RBOB for gasoline, ULSD for
// diesel — dated on or before it). The EIA outlook anchor is disabled: only the current
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
//   daily      the same decision made every calendar day, with the data the site
//              would have had that evening: retail reports published before that
//              day, and EIA spot prices as EIA posts them (Wednesdays, through
//              Tuesday) — with and without the NYMEX futures fill
//              (scripts/providers/futures.mjs), and with the EIA outlook edition
//              that was out on that date (scripts/data/steo-vintages.json).
//              Actual prices between weekly reports are interpolated.
//   odds       from the daily rows, how often the price was lower a week later
//              and the average move, by forecast size. --calibrate writes the
//              table the site shows to js/calibration.js.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyze, MODEL, parseDate } from '../js/predict.js';
import { AREAS, GRADES } from '../js/regions.js';
import { splice } from './providers/futures.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = n => args.includes(`--${n}`);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const YEARS = Number(opt('years', 10));
const ONLY_GRADE = opt('grade', null);
if (ONLY_GRADE && !GRADES[ONLY_GRADE]) { console.error(`Unknown grade ${ONLY_GRADE}`); process.exit(1); }
const GRADE_IDS = Object.keys(GRADES).filter(g => !ONLY_GRADE || g === ONLY_GRADE);
const CACHE = resolve(root, '.cache/backtest-history-v2.json');
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
  if (flag('site-data')) {   // offline smoke test on the site's own data file (2y retail, 90d spot)
    const d = JSON.parse(await readFile(resolve(root, 'data/prices.json'), 'utf8'));
    const grades = {};
    for (const g of Object.keys(GRADES)) {
      const areas = {};
      for (const [id, a] of Object.entries(d.areas)) if (a.prices?.[g]) areas[id] = a.prices[g].weekly;
      grades[g] = areas;
    }
    return { years: 2, fetchedAt: d.generatedAt, grades, spot: { rbob: d.wholesale.rbob, ulsd: d.wholesale.ulsd || [] } };
  }
  if (existsSync(CACHE) && !flag('refresh')) {
    const cached = JSON.parse(await readFile(CACHE, 'utf8'));
    if (cached.years >= YEARS) return cached;
  }
  const start = new Date(Date.now() - (YEARS + 0.5) * 365.25 * DAY).toISOString().slice(0, 10);
  console.error(`Downloading ${YEARS}y of history from EIA (start ${start})…`);
  const areaIds = Object.keys(AREAS);
  const productToGrade = Object.fromEntries(Object.entries(GRADES).map(([g, x]) => [x.product, g]));
  const weeklyRows = await eiaAll('petroleum/pri/gnd', {
    frequency: 'weekly', 'data[0]': 'value', 'facets[product][]': Object.values(GRADES).map(g => g.product),
    'facets[duoarea][]': areaIds, start, 'sort[0][column]': 'period', 'sort[0][direction]': 'asc',
  });
  const grades = Object.fromEntries(Object.keys(GRADES).map(g => [g, {}]));
  for (const r of weeklyRows) {
    const price = Number(r.value);
    const g = productToGrade[r.product];
    if (!g || !areaIds.includes(r.duoarea) || !Number.isFinite(price)) continue;
    (grades[g][r.duoarea] ||= []).push({ date: r.period, price });
  }
  for (const areas of Object.values(grades)) {
    for (const [id, s] of Object.entries(areas)) {
      s.sort((a, b) => a.date.localeCompare(b.date));
      if (s.length < WARMUP + 10) delete areas[id];
    }
  }

  const SPOT = { rbob: 'EER_EPMRU_PF4_Y35NY_DPG', ulsd: 'EER_EPD2DXL0_PF4_Y35NY_DPG' };
  const spotRows = await eiaAll('petroleum/pri/spt', {
    frequency: 'daily', 'data[0]': 'value', 'facets[series][]': Object.values(SPOT),
    start, 'sort[0][column]': 'period', 'sort[0][direction]': 'asc',
  });
  const spot = { rbob: [], ulsd: [] };
  for (const r of spotRows) {
    const k = Object.keys(SPOT).find(k => SPOT[k] === r.series);
    const price = Number(r.value);
    if (k && Number.isFinite(price)) spot[k].push({ date: r.period, price });
  }
  for (const s of Object.values(spot)) s.sort((a, b) => a.date.localeCompare(b.date));

  const data = { years: YEARS, fetchedAt: new Date().toISOString(), grades, spot };
  await mkdir(dirname(CACHE), { recursive: true });
  await writeFile(CACHE, JSON.stringify(data));
  return data;
}

// Continuous front-month futures (Yahoo Finance, no key) for the daily test.
// The live job uses a single contract per fill window; the continuous series
// also carries roll jumps, so this slightly understates the fill.
async function loadFutures(history) {
  if (history.futures || flag('site-data')) return;
  console.error('Downloading futures history (Yahoo Finance)…');
  const period1 = Math.floor((Date.now() - (YEARS + 0.5) * 365.25 * DAY) / 1000);
  history.futures = {};
  for (const [k, sym] of [['rbob', 'RB=F'], ['ulsd', 'HO=F']]) {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}`
      + `?period1=${period1}&period2=${Math.floor(Date.now() / 1000)}&interval=1d`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (fuelcast backtest)' } });
    if (!res.ok) throw new Error(`Yahoo ${sym}: HTTP ${res.status}`);
    const r = (await res.json()).chart.result[0];
    const off = (r.meta.gmtoffset ?? -4 * 3600) * 1000;
    history.futures[k] = r.timestamp
      .map((t, i) => ({ date: new Date(t * 1000 + off).toISOString().slice(0, 10), price: r.indicators.quote[0].close[i] }))
      .filter(p => Number.isFinite(p.price));
  }
  await writeFile(CACHE, JSON.stringify(history));
}

// Archived EIA outlook editions (scripts/data/build-steo-vintages.py), each
// usable from the 12th of its month — EIA publishes in the first half.
const STEO = JSON.parse(await readFile(resolve(root, 'scripts/data/steo-vintages.json'), 'utf8'));
const STEO_EDITIONS = Object.keys(STEO).sort();
const OUTLOOK_SERIES = { NUS: 'MGRARUS', R10: 'MGRARP1', R20: 'MGRARP2', R30: 'MGRARP3', R40: 'MGRARP4', R50: 'MGRARP5' };
function outlookOn(day, area, grade) {
  let ed = null;
  for (const k of STEO_EDITIONS) if (`${k}-12` <= day) ed = k;
  if (!ed) return null;
  const e = STEO[ed];
  const sid = GRADES[grade].outlook === 'diesel' ? 'DSRTUUS' : OUTLOOK_SERIES[AREAS[area].padd] || 'MGRARUS';
  const [y, m] = e.start.split('-').map(Number);
  return e[sid].map((price, k) => ({ month: new Date(Date.UTC(y, m - 1 + k, 1)).toISOString().slice(0, 7), price }));
}

// ---- Walk-forward -----------------------------------------------------------

const WARMUP = 26;       // reports before the first evaluation
const RBOB_WINDOW = 90;  // days of spot history handed to the model (as on the site)

function walk(history, grade, useWholesale = true, onlyArea = null) {
  const rows = [];
  const rbobAll = history.spot[GRADES[grade].lead] || [];
  let ri = 0; // moving pointer into the spot series (sorted)
  for (const [area, series] of Object.entries(history.grades[grade])) {
    if (onlyArea && area !== onlyArea) continue;
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
        grade, area, asOf, a0, a1, a2,
        f7: p7.price, f14: p14.price, lo7: p7.low, hi7: p7.high, lo14: p14.low, hi14: p14.high,
        change14: r.change14, verdict: r.verdict.key,
      });
    }
  }
  return rows;
}

const isoDay = ms => new Date(ms).toISOString().slice(0, 10);

// Every calendar day: the verdict a visitor would have seen that day, scored
// against interpolated actual prices that day and a week later.
function dailyWalk(history, grade, { futures: withFutures = true, outlook: withOutlook = true, from = '0000' } = {}) {
  const lead = GRADES[grade].lead;
  const spotAll = history.spot[lead] || [];
  const fut = (history.futures && history.futures[lead]) || [];
  const rows = [];
  let flips = 0, pairs = 0;
  for (const [area, series] of Object.entries(history.grades[grade])) {
    const ms = series.map(p => parseDate(p.date));
    const truth = t => {
      const i = ms.findIndex(m => m >= t);
      if (i <= 0) return series[Math.max(i, 0)].price;
      return series[i - 1].price + (t - ms[i - 1]) / (ms[i] - ms[i - 1]) * (series[i].price - series[i - 1].price);
    };
    let ri = 0, si = 0, fi = 0, prev = null, prevKey = null;
    for (let D = ms[WARMUP] + DAY; D + 7 * DAY <= ms[ms.length - 1]; D += DAY) {
      if (isoDay(D) < from) continue;
      while (ri < series.length && ms[ri] < D) ri++;           // reports published before today
      let wed = D - DAY;                                        // EIA's latest Wednesday posting
      while (new Date(wed).getUTCDay() !== 3) wed -= DAY;
      const thru = isoDay(wed - DAY);
      while (si < spotAll.length && spotAll[si].date <= thru) si++;
      let spot = spotAll.slice(Math.max(0, si - RBOB_WINDOW), si);
      if (withFutures) {
        const yesterday = isoDay(D - DAY);
        while (fi < fut.length && fut[fi].date <= yesterday) fi++;
        spot = splice(spot, fut.slice(Math.max(0, fi - 15), fi));
      }
      const outlook = withOutlook ? outlookOn(isoDay(D), area, grade) : null;
      const r = analyze({ series: series.slice(Math.max(0, ri - 40), ri), wholesale: { spot }, outlook, now: D, prevVerdict: prevKey });
      const wait = r.verdict.key === 'wait';
      if (prev !== null) { pairs++; if (prev !== wait) flips++; }
      prev = wait;
      prevKey = r.verdict.key;
      rows.push({ day: isoDay(D), wait, change14: r.change14, t0: truth(D), t7: truth(D + 7 * DAY), est: r.today, last: series[ri - 1].price });
    }
  }
  const now = mean(rows.map(r => r.t0));
  const model = mean(rows.map(r => (r.wait ? r.t7 : r.t0)));
  const oracle = mean(rows.map(r => Math.min(r.t0, r.t7)));
  return {
    n: rows.length, saved: now - model, captured: (now - model) / (now - oracle || 1),
    right: mean(rows.map(r => (r.wait === (r.t7 < r.t0) ? 1 : 0))),
    waitShare: mean(rows.map(r => (r.wait ? 1 : 0))),
    todayMae: mean(rows.map(r => Math.abs(r.est - r.t0))),
    todayNaive: mean(rows.map(r => Math.abs(r.last - r.t0))),
    flipsPerMonth: 30 * flips / (pairs || 1),
    rows,
  };
}

// Odds by forecast size: how often the price was lower a week later, and the
// average 7-day move, in bins of the predicted 14-day change. `xMean` is where
// each bin's rows actually sit, so the site can interpolate between bins.
const ODDS_EDGES = [-Infinity, -0.06, -0.04, -0.02, -0.01, 0, 0.01, 0.02, 0.04, 0.06, Infinity];
function oddsTable(rows) {
  const bins = ODDS_EDGES.slice(0, -1).map(() => []);
  for (const r of rows) bins[ODDS_EDGES.findIndex((e, k) => r.change14 >= e && r.change14 < ODDS_EDGES[k + 1])].push(r);
  return bins.filter(b => b.length).map(b => ({
    xMean: mean(b.map(r => r.change14)),
    pLower: mean(b.map(r => (r.t7 < r.t0 ? 1 : 0))),
    move7: mean(b.map(r => r.t7 - r.t0)),
    n: b.length,
  }));
}
const nearestBin = (table, x) => table.reduce((best, b) => (Math.abs(b.xMean - x) < Math.abs(best.xMean - x) ? b : best));

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
  ['momentumDecayDays', [5, 7, 10, 14, 28, Infinity]],
  ['bandScale', [1, 1.25]],
  ['bandExponent', [0.5, 0.65, 0.8, 1.0]],
];

const DEFAULTS = { ...MODEL };

function withModel(overrides, fn) {
  const saved = { ...MODEL };
  Object.assign(MODEL, overrides);
  try { return fn(); } finally { Object.assign(MODEL, saved); }
}

// ---- Main -------------------------------------------------------------------

const history = await loadHistory();
await loadFutures(history);
const DAILY_HOLDOUT = '2022-01-01';   // daily-verdict rows from here on are out of sample
const results = {};   // grade → { base, noWholesale, perArea, sweep }
for (const grade of GRADE_IDS) {
  if (!history.grades[grade] || !Object.keys(history.grades[grade]).length) { console.log(`\n(no ${grade} history)`); continue; }
  const name = GRADES[grade].name;
  const base = metrics(walk(history, grade));
  printMetrics(base, `${name}: default constants (momentum + ${GRADES[grade].lead.toUpperCase()} lead, no outlook)`);
  const noWholesale = metrics(walk(history, grade, false));
  printMetrics(noWholesale, `${name}: momentum only`);

  const perArea = Object.keys(history.grades[grade]).map(id => {
    const m = metrics(walk(history, grade, true, id));
    return { id, name: AREAS[id].name, ...m };
  }).sort((a, b) => b.savedVsNow - a.savedVsNow);
  console.log(`\n== ${name} per area (¢/gal saved vs always-now · direction hit rate · 1wk MAE vs no-change) ==`);
  for (const a of perArea) {
    console.log(`${a.name.padEnd(32)} ${c(a.savedVsNow).padStart(6)}¢   ${pct(a.dirHit).padStart(6)}   ${c(a.mae7)}¢ vs ${c(a.naive7)}¢`);
  }

  const sweep = [];
  if (flag('sweep')) {
    console.log(`\n== ${name} sweep (one constant at a time) ==`);
    for (const [key, values] of SWEEP) {
      for (const v of values) {
        const m = withModel({ [key]: v }, () => metrics(walk(history, grade)));
        sweep.push({ key, value: v, ...m });
        console.log(`${key}=${String(v).padEnd(8)}  saved ${c(m.savedVsNow).padStart(5)}¢  captured ${pct(m.captured).padStart(6)}  `
          + `dir ${pct(m.dirHit)}  MAE 1wk ${c(m.mae7)}¢ 2wk ${c(m.mae14)}¢  band ${pct(m.in7)}/${pct(m.in14)}  wait ${pct(m.waitShare)}`);
      }
    }
  }
  const daily = [];
  let odds = null;
  if (history.futures) {
    console.log(`\n== ${name} daily verdict (every calendar day) ==`);
    const since = `${DAILY_HOLDOUT.slice(0, 4)}+`;
    const VARIANTS = [
      ['EIA spot only', { futures: false, outlook: false }, { verdictHysteresis: 0 }],
      ['+ futures fill', { outlook: false }, { verdictHysteresis: 0 }],
      ['+ hysteresis', { outlook: false }, {}],
      ['+ outlook from day 7 (previous)', {}, { anchorStartDay: 7, anchorFullDay: 30 }],
      ['+ outlook from day 21 (current)', {}, {}],
    ];
    const current = {};
    for (const [from, suffix] of [['0000', ''], [DAILY_HOLDOUT, `, ${since}`]]) {
      for (const [label, opts, overrides] of VARIANTS) {
        const m = withModel(overrides, () => dailyWalk(history, grade, { ...opts, from }));
        if (!Object.keys(overrides).length && opts.outlook !== false) current[from] = m;
        daily.push({ label: label + suffix, ...m, rows: undefined });
        console.log(`${(label + suffix).padEnd(40)} saved ${c(m.saved)}¢ (${pct(m.captured)} of oracle)  right ${pct(m.right)}  wait ${pct(m.waitShare)}  `
          + `today MAE ${c(m.todayMae)}¢ vs last report ${c(m.todayNaive)}¢  flips ${m.flipsPerMonth.toFixed(1)}/mo`);
      }
    }
    // Odds: the shipped table uses every year; the check builds one from the
    // years before the holdout and scores it on the holdout (Brier score, lower
    // is better) against always predicting the holdout's own base rate.
    const all = current['0000'].rows;
    const train = all.filter(r => r.day < DAILY_HOLDOUT), test = current[DAILY_HOLDOUT].rows;
    const lower = r => (r.t7 < r.t0 ? 1 : 0);
    const trainTable = oddsTable(train);
    const base = mean(test.map(lower));
    odds = {
      table: oddsTable(all), train: trainTable, test: oddsTable(test),
      brier: mean(test.map(r => (nearestBin(trainTable, r.change14).pLower - lower(r)) ** 2)),
      brierBase: mean(test.map(r => (base - lower(r)) ** 2)),
    };
    console.log(`Odds: holdout Brier ${odds.brier.toFixed(4)} with a pre-${DAILY_HOLDOUT.slice(0, 4)} table vs ${odds.brierBase.toFixed(4)} for the base rate`);
  }
  results[grade] = { base, noWholesale, perArea, sweep, daily, odds };
}

if (flag('calibrate')) {
  const tables = Object.fromEntries(Object.entries(results).filter(([, r]) => r.odds)
    .map(([g, r]) => [g, r.odds.table.map(b => ({ x: +b.xMean.toFixed(4), p: +b.pLower.toFixed(3), move: +b.move7.toFixed(4) }))]));
  const out = resolve(root, 'js/calibration.js');
  await writeFile(out, [
    '// Generated by `node scripts/backtest.mjs --calibrate` — do not edit by hand.',
    `// Daily backtest, ${YEARS} years to ${new Date().toISOString().slice(0, 10)}. For a predicted 14-day change of x`,
    '// ($/gal), p = share of days the price was lower a week later, move = the',
    '// average actual 7-day change ($/gal). See docs/BACKTEST.md ("Odds").',
    'export const ODDS = {',
    ...Object.entries(tables).flatMap(([g, rows]) => [`  ${g}: [`, ...rows.map(r => `    ${JSON.stringify(r)},`), '  ],']),
    '};', '',
  ].join('\n'));
  console.log(`\nWrote ${out}`);
}

if (flag('report')) {
  const md = renderReport(results);
  const out = resolve(root, 'docs/BACKTEST.md');
  await writeFile(out, md);
  console.log(`\nWrote ${out}`);
}

function renderReport(results) {
  const row = (label, x) => `| ${label} | ${c(x.mae7)}¢ / ${c(x.naive7)}¢ | ${c(x.mae14)}¢ / ${c(x.naive14)}¢ | ${pct(x.in7)} / ${pct(x.in14)} | ${pct(x.dirHit)} (${pct(x.calledShare)} called) | ${c(x.savedVsNow)}¢ | ${pct(x.captured)} |`;
  const first = Object.values(results)[0].base;
  const lines = [];
  lines.push('# Backtest results', '',
    `Generated ${new Date().toISOString().slice(0, 10)} by \`node scripts/backtest.mjs --sweep --report\` `
    + `on ${YEARS} years of EIA history (${first.from} → ${first.to}), evaluated separately for each fuel grade.`, '',
    '## Method', '',
    'Walk forward one weekly report at a time, giving the model only what existed on that date: retail reports up to the report date and the grade\'s NY Harbor wholesale spot price (RBOB for gasoline grades, ULSD for diesel) dated on or before it — the same 90-day window the site uses. The EIA outlook anchor is **disabled**: only the current forecast vintage is available, and using it for past dates would leak the future into the test. So this measures the momentum + wholesale-lead core of the model, which drives the tomorrow / this-week / verdict numbers on the site. All grades use the same constants.', '',
    '- **Forecast MAE** — mean absolute error of the 1- and 2-week-ahead prediction against the actual next reports, next to a "no change" baseline.',
    '- **Band coverage** — share of actual prices that fell inside the uncertainty band (a ±1σ band should catch ≈68%).',
    '- **Direction** — when the model predicts a 14-day move of at least the verdict threshold, how often the actual 2-week change had the same sign.',
    '- **Decision** — a driver who must buy within the week follows the verdict: buy now, or buy next week on "wait". Compared with always-now, always-wait, and a perfect-foresight oracle (min of the two). Savings are in cents per gallon, averaged over every week.', '',
    '## Summary by grade', '',
    '| Grade | Decisions · areas | 1wk MAE / no-change | 2wk MAE / no-change | Band 1wk / 2wk | Direction right | Saved vs always-now | Of oracle |',
    '|---|---|---|---|---|---|---|---|');
  for (const [g, r] of Object.entries(results)) {
    const m = r.base;
    lines.push(`| ${GRADES[g].name} | ${m.n.toLocaleString()} · ${m.areas} | ${c(m.mae7)}¢ / ${c(m.naive7)}¢ | ${c(m.mae14)}¢ / ${c(m.naive14)}¢ | ${pct(m.in7)} / ${pct(m.in14)} | ${pct(m.dirHit)} | ${c(m.savedVsNow)}¢ | ${pct(m.captured)} |`);
  }
  if (Object.values(results).some(r => r.daily.length)) {
    lines.push('', '## Daily verdict', '',
      'The weekly test above scores Mondays only, but the site re-runs every evening. This walks every calendar day with what the site would have had: '
      + 'retail reports published before that day, and EIA spot prices as EIA actually posts them — once a week on Wednesdays, through Tuesday, so 2–8 days old. '
      + '"+ futures fill" adds the days since EIA\'s latest posting from NYMEX futures (`scripts/providers/futures.mjs`; here continuous front-month history from Yahoo Finance). '
      + '"+ outlook" adds the EIA monthly outlook edition that was out on each date (`scripts/data/steo-vintages.json`, usable from the 12th of its month). Blending toward it from day 7 made the decision worse, so the blend now starts at day 21, past the 2-week window the verdict and price tiles use. '
      + 'Actual prices between weekly reports are linearly interpolated. A driver must buy within a week and follows the verdict: buy now, or in 7 days on "wait". '
      + `The model constants were set before this test existed and no constant was tuned on ${DAILY_HOLDOUT.slice(0, 4)} onward, so those rows are out of sample.`, '',
      '| Grade | Variant | Saved vs always-now | Of oracle | Verdict right | Wait share | "Today" error / last report | Wait↔buy flips per month |',
      '|---|---|---|---|---|---|---|---|');
    for (const [g, r] of Object.entries(results)) {
      for (const d of r.daily) {
        lines.push(`| ${GRADES[g].name} | ${d.label} | ${c(d.saved)}¢ | ${pct(d.captured)} | ${pct(d.right)} | ${pct(d.waitShare)} | ${c(d.todayMae)}¢ / ${c(d.todayNaive)}¢ | ${d.flipsPerMonth.toFixed(1)} |`);
      }
    }
  }
  if (Object.values(results).some(r => r.odds)) {
    const yr = DAILY_HOLDOUT.slice(0, 4);
    lines.push('', '## Odds', '',
      `The site shows how often, historically, the price was lower a week later — and the average move — for forecasts like today's: the daily walk with the current model, bucketed by the predicted 14-day change. To check that this generalizes, a table built only from the years before ${yr} is scored on ${yr} onward (Brier score, lower is better; "base rate" always predicts the holdout's own share of lower weeks).`, '');
    for (const [g, r] of Object.entries(results)) {
      if (!r.odds) continue;
      const o = r.odds;
      lines.push(`**${GRADES[g].name}** — holdout Brier ${o.brier.toFixed(4)} vs ${o.brierBase.toFixed(4)} for the base rate.`, '',
        `| Predicted 14-day change (bin avg) | Lower a week later | before ${yr} / ${yr}+ | Avg 7-day move | Days |`, '|---|---|---|---|---|');
      for (const b of o.table) {
        const tr = nearestBin(o.train, b.xMean), te = nearestBin(o.test, b.xMean);
        lines.push(`| ${b.xMean >= 0 ? '+' : ''}${c(b.xMean)}¢ | ${pct(b.pLower)} | ${pct(tr.pLower)} / ${pct(te.pLower)} | ${b.move7 >= 0 ? '+' : ''}${c(b.move7)}¢ | ${b.n.toLocaleString()} |`);
      }
      lines.push('');
    }
  }
  for (const [g, r] of Object.entries(results)) {
    const { base: m, noWholesale: m0, perArea, sweep } = r;
    lines.push('', `## ${GRADES[g].name}`, '',
      `${m.n.toLocaleString()} weekly decisions across ${m.areas} areas, ${m.from} → ${m.to}. Wholesale lead: ${GRADES[g].lead.toUpperCase()}.`, '',
      '| Variant | 1wk MAE / no-change | 2wk MAE / no-change | Band 1wk / 2wk | Direction right | Saved vs always-now | Of oracle |',
      '|---|---|---|---|---|---|---|',
      row('Default (momentum + wholesale)', m),
      row('Momentum only', m0), '',
      `Verdict mix: fill up now ${pct(m.verdicts.now)}, no rush ${pct(m.verdicts.ok)}, wait ${pct(m.verdicts.wait)}. `
      + `"Wait" calls were right ${pct(m.waitRight)} of the time and saved ${c(m.waitSaved)}¢/gal on average when made. `
      + `Always waiting a week would have cost ${c(m.wait - m.now)}¢/gal relative to always buying now; the oracle saves ${c(m.oracleGain)}¢/gal.`, '',
      '<details><summary>Per area</summary>', '',
      '| Area | Saved vs always-now | Direction right | 1wk MAE / no-change |', '|---|---|---|---|');
    for (const a of perArea) lines.push(`| ${a.name} | ${c(a.savedVsNow)}¢ | ${pct(a.dirHit)} | ${c(a.mae7)}¢ / ${c(a.naive7)}¢ |`);
    lines.push('', '</details>');
    if (sweep.length) {
      lines.push('', '<details><summary>Constant sweep (one at a time, others at default)</summary>', '',
        '| Constant | Value | Saved vs always-now | Of oracle | Direction right | MAE 1wk / 2wk | Band 1wk / 2wk | Wait share |', '|---|---|---|---|---|---|---|---|');
      for (const s of sweep) {
        const isDefault = s.value === DEFAULTS[s.key];
        lines.push(`| \`${s.key}\` | ${s.value}${isDefault ? ' (default)' : ''} | ${c(s.savedVsNow)}¢ | ${pct(s.captured)} | ${pct(s.dirHit)} | ${c(s.mae7)}¢ / ${c(s.mae14)}¢ | ${pct(s.in7)} / ${pct(s.in14)} | ${pct(s.waitShare)} |`);
      }
      lines.push('', '</details>');
    }
  }
  lines.push('', '## Caveats', '',
    '- No outlook anchor in the test (see Method), so the 2-week numbers on the live site blend in one more signal than is measured here.',
    '- Weekly area averages, not station prices. A driver who shops around can beat any of these numbers.',
    '- Diesel is reported for the U.S., the regions and California only (11 areas), so its sample is smaller and more regional.',
    '- The decision metric assumes the tank can wait a week. If it cannot, only the "now" and "no rush" verdicts apply.',
    '- Past behaviour of gas prices does not guarantee future behaviour. This is a calibration aid, not a promise.', '');
  return lines.join('\n');
}
