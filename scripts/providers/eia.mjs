// EIA (U.S. Energy Information Administration) data provider.
// Free API: https://www.eia.gov/opendata/  (get a key at https://www.eia.gov/opendata/register.php)
//
// Emits the normalized shape described in scripts/providers/README.md.

import { AREAS, GRADES } from '../../js/regions.js';

const BASE = 'https://api.eia.gov/v2';
// The site uses ~13 weeks; 40 keeps `backtest.mjs --site-data` (26-report warm-up) working.
const WEEKS_OF_HISTORY = 40;
const WHOLESALE_DAYS = 90;

// STEO series ids (cents/gal) by outlook family and PADD.
const OUTLOOK_SERIES = {
  regular: { NUS: 'MGRARUS', R10: 'MGRARP1', R20: 'MGRARP2', R30: 'MGRARP3', R40: 'MGRARP4', R50: 'MGRARP5' },
  diesel:  { NUS: 'DSRTUUS' },   // on-highway diesel retail, U.S. average
};

const WHOLESALE_SERIES = {
  wti:  'RWTC',                        // Cushing, OK WTI spot, $/bbl
  rbob: 'EER_EPMRU_PF4_Y35NY_DPG',     // NY Harbor conventional regular gasoline spot, $/gal
  ulsd: 'EER_EPD2DXL0_PF4_Y35NY_DPG',  // NY Harbor ultra-low-sulfur diesel spot, $/gal
};

async function eiaGet(route, params, apiKey) {
  const rows = [];
  for (let offset = 0; ; offset += 5000) {
    const url = new URL(`${BASE}/${route}/data/`);
    url.searchParams.set('api_key', apiKey);
    for (const [k, v] of Object.entries(params)) {
      if (Array.isArray(v)) v.forEach(x => url.searchParams.append(k, x));
      else url.searchParams.set(k, v);
    }
    url.searchParams.set('length', 5000);
    url.searchParams.set('offset', offset);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`EIA ${route} HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const json = await res.json();
    if (json.error) throw new Error(`EIA ${route}: ${json.error}`);
    const page = json.response && json.response.data;
    if (!Array.isArray(page)) throw new Error(`EIA ${route}: unexpected response shape`);
    rows.push(...page);
    if (page.length < 5000) break;
  }
  return rows;
}

const num = v => (v === null || v === undefined || v === '' ? NaN : Number(v));
const byDateAsc = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

export async function fetchPrices({ apiKey }) {
  const areaIds = Object.keys(AREAS);
  const productToGrade = Object.fromEntries(Object.entries(GRADES).map(([g, x]) => [x.product, g]));
  const start = new Date(Date.now() - (WEEKS_OF_HISTORY + 2) * 7 * 86400000).toISOString().slice(0, 10);

  // 1. Weekly retail prices, every grade, every area, in one paginated call.
  const weeklyRows = await eiaGet('petroleum/pri/gnd', {
    frequency: 'weekly',
    'data[0]': 'value',
    'facets[product][]': Object.values(GRADES).map(g => g.product),
    'facets[duoarea][]': areaIds,
    start,
    'sort[0][column]': 'period',
    'sort[0][direction]': 'asc',
  }, apiKey);

  const areas = {};
  for (const id of areaIds) {
    areas[id] = { name: AREAS[id].name, kind: AREAS[id].kind, padd: AREAS[id].padd, prices: {} };
  }
  for (const r of weeklyRows) {
    const a = areas[r.duoarea];
    const grade = productToGrade[r.product];
    const price = num(r.value);
    if (!a || !grade || !Number.isFinite(price)) continue;
    (a.prices[grade] ||= { weekly: [] }).weekly.push({ date: r.period, price });
  }
  for (const a of Object.values(areas)) {
    for (const [grade, p] of Object.entries(a.prices)) {
      p.weekly.sort(byDateAsc);
      p.weekly = p.weekly.slice(-WEEKS_OF_HISTORY);
      if (p.weekly.length < 8) delete a.prices[grade];   // not really reported for this area
    }
  }

  // 2. Monthly outlook (STEO), cents → dollars, keyed by outlook family then PADD.
  const allSeries = Object.values(OUTLOOK_SERIES).flatMap(m => Object.values(m));
  const outlookRows = await eiaGet('steo', {
    frequency: 'monthly',
    'data[0]': 'value',
    'facets[seriesId][]': allSeries,
    start: shiftMonth(new Date().toISOString().slice(0, 7), -12),
    'sort[0][column]': 'period',
    'sort[0][direction]': 'asc',
  }, apiKey);
  const seriesToKey = {};
  for (const [family, map] of Object.entries(OUTLOOK_SERIES)) {
    for (const [padd, sid] of Object.entries(map)) seriesToKey[sid] = [family, padd];
  }
  const outlook = {};
  for (const r of outlookRows) {
    const key = seriesToKey[r.seriesId];
    const price = num(r.value) / 100;
    if (!key || !Number.isFinite(price)) continue;
    const [family, padd] = key;
    ((outlook[family] ||= {})[padd] ||= []).push({ month: r.period, price });
  }
  for (const fam of Object.values(outlook)) {
    for (const list of Object.values(fam)) list.sort((a, b) => a.month.localeCompare(b.month));
  }

  // 3. Daily wholesale spot prices.
  const spotRows = await eiaGet('petroleum/pri/spt', {
    frequency: 'daily',
    'data[0]': 'value',
    'facets[series][]': Object.values(WHOLESALE_SERIES),
    start: new Date(Date.now() - (WHOLESALE_DAYS + 40) * 86400000).toISOString().slice(0, 10),
    'sort[0][column]': 'period',
    'sort[0][direction]': 'asc',
  }, apiKey);
  const seriesToSpot = Object.fromEntries(Object.entries(WHOLESALE_SERIES).map(([k, s]) => [s, k]));
  const wholesale = Object.fromEntries(Object.keys(WHOLESALE_SERIES).map(k => [k, []]));
  for (const r of spotRows) {
    const k = seriesToSpot[r.series];
    const price = num(r.value);
    if (k && Number.isFinite(price)) wholesale[k].push({ date: r.period, price });
  }
  for (const k of Object.keys(wholesale)) {
    wholesale[k].sort(byDateAsc);
    wholesale[k] = wholesale[k].slice(-WHOLESALE_DAYS);
  }

  return {
    generatedAt: new Date().toISOString(),
    source: {
      id: 'eia',
      name: 'U.S. Energy Information Administration',
      url: 'https://www.eia.gov/petroleum/gasdiesel/',
      cadence: 'weekly',
      note: 'Weekly retail prices for regular, midgrade and premium gasoline (all formulations) and on-highway diesel, posted Mondays. Outlook from the EIA Short-Term Energy Outlook. Wholesale from EIA daily spot prices.',
    },
    grades: Object.fromEntries(Object.entries(GRADES).map(([g, x]) => [g, { name: x.name, lead: x.lead, outlook: x.outlook }])),
    areas,
    outlook,
    wholesale,
  };
}

function shiftMonth(yyyyMm, delta) {
  const [y, m] = yyyyMm.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}
