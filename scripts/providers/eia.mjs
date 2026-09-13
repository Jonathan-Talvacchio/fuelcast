// EIA (U.S. Energy Information Administration) data provider.
// Free API: https://www.eia.gov/opendata/  (get a key at https://www.eia.gov/opendata/register.php)
//
// Emits the normalized shape described in scripts/providers/README.md.

import { AREAS } from '../../js/regions.js';

const BASE = 'https://api.eia.gov/v2';
const WEEKS_OF_HISTORY = 104;
const WHOLESALE_DAYS = 90;

// STEO series ids for regular gasoline retail price by PADD (cents/gal).
const OUTLOOK_SERIES = {
  NUS: 'MGRARUS', R10: 'MGRARP1', R20: 'MGRARP2', R30: 'MGRARP3', R40: 'MGRARP4', R50: 'MGRARP5',
};

const WHOLESALE_SERIES = {
  wti: 'RWTC',                      // Cushing, OK WTI spot, $/bbl
  rbob: 'EER_EPMRU_PF4_Y35NY_DPG',  // NY Harbor conventional regular gasoline spot, $/gal
};

async function eiaGet(route, params, apiKey) {
  const url = new URL(`${BASE}/${route}/data/`);
  url.searchParams.set('api_key', apiKey);
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) v.forEach(x => url.searchParams.append(k, x));
    else url.searchParams.set(k, v);
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`EIA ${route} HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  if (json.error) throw new Error(`EIA ${route}: ${json.error}`);
  const rows = json.response && json.response.data;
  if (!Array.isArray(rows)) throw new Error(`EIA ${route}: unexpected response shape`);
  return rows;
}

const num = v => (v === null || v === undefined || v === '' ? NaN : Number(v));

function byDateAsc(a, b) {
  return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
}

export async function fetchPrices({ apiKey }) {
  const areaIds = Object.keys(AREAS);

  // 1. Weekly retail regular gasoline, all areas in one call.
  const weeklyRows = await eiaGet('petroleum/pri/gnd', {
    frequency: 'weekly',
    'data[0]': 'value',
    'facets[product][]': 'EPMR',
    'facets[duoarea][]': areaIds,
    'sort[0][column]': 'period',
    'sort[0][direction]': 'desc',
    length: areaIds.length * WEEKS_OF_HISTORY,
  }, apiKey);

  const areas = {};
  for (const id of areaIds) {
    areas[id] = { name: AREAS[id].name, kind: AREAS[id].kind, padd: AREAS[id].padd, weekly: [] };
  }
  for (const r of weeklyRows) {
    const a = areas[r.duoarea];
    const price = num(r.value);
    if (!a || !Number.isFinite(price)) continue;
    a.weekly.push({ date: r.period, price });
  }
  for (const a of Object.values(areas)) {
    a.weekly.sort(byDateAsc);
    a.weekly = a.weekly.slice(-WEEKS_OF_HISTORY);
  }

  // 2. Monthly outlook (STEO), cents → dollars.
  const outlookRows = await eiaGet('steo', {
    frequency: 'monthly',
    'data[0]': 'value',
    'facets[seriesId][]': Object.values(OUTLOOK_SERIES),
    'sort[0][column]': 'period',
    'sort[0][direction]': 'desc',
    length: 6 * 36,
  }, apiKey);
  const seriesToArea = Object.fromEntries(Object.entries(OUTLOOK_SERIES).map(([a, s]) => [s, a]));
  const outlook = {};
  const thisMonth = new Date().toISOString().slice(0, 7);
  for (const r of outlookRows) {
    const area = seriesToArea[r.seriesId];
    const price = num(r.value) / 100;
    if (!area || !Number.isFinite(price)) continue;
    // Keep the current month onward plus a year of history for context.
    if (r.period < shiftMonth(thisMonth, -12)) continue;
    (outlook[area] ||= []).push({ month: r.period, price });
  }
  for (const list of Object.values(outlook)) list.sort((a, b) => a.month.localeCompare(b.month));

  // 3. Daily wholesale spot prices.
  const spotRows = await eiaGet('petroleum/pri/spt', {
    frequency: 'daily',
    'data[0]': 'value',
    'facets[series][]': Object.values(WHOLESALE_SERIES),
    'sort[0][column]': 'period',
    'sort[0][direction]': 'desc',
    length: 2 * WHOLESALE_DAYS,
  }, apiKey);
  const wholesale = { wti: [], rbob: [] };
  for (const r of spotRows) {
    const price = num(r.value);
    if (!Number.isFinite(price)) continue;
    if (r.series === WHOLESALE_SERIES.wti) wholesale.wti.push({ date: r.period, price });
    else if (r.series === WHOLESALE_SERIES.rbob) wholesale.rbob.push({ date: r.period, price });
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
      note: 'Weekly retail prices for regular gasoline (all formulations), posted Mondays. Outlook from the EIA Short-Term Energy Outlook. Wholesale from EIA daily spot prices.',
    },
    areas,
    outlook,
    wholesale,
  };
}

function shiftMonth(yyyyMm, delta) {
  const [y, m] = yyyyMm.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}
