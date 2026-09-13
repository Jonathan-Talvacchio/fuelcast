// Fetches gas price data from the configured provider and writes data/prices.json.
//
//   EIA_API_KEY=your_key node scripts/fetch-data.mjs
//
// Env:
//   DATA_PROVIDER  provider module name in scripts/providers/ (default: eia)
//   EIA_API_KEY    EIA key; falls back to DEMO_KEY (rate-limited) with a warning
//   OUTPUT         output path (default: data/prices.json)

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const providerName = process.env.DATA_PROVIDER || 'eia';
const output = resolve(root, process.env.OUTPUT || 'data/prices.json');

let apiKey = process.env.EIA_API_KEY;
if (!apiKey) {
  console.warn('EIA_API_KEY not set — using DEMO_KEY (fine for testing, rate-limited).');
  apiKey = 'DEMO_KEY';
}

const { fetchPrices } = await import(`./providers/${providerName}.mjs`);
const data = await fetchPrices({ apiKey });
validate(data);

await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(data));

const areaCount = Object.keys(data.areas).length;
const latest = Object.values(data.areas).map(a => a.weekly.at(-1)?.date).sort().at(-1);
const coverage = Object.keys(data.grades).map(g =>
  `${g} ${Object.values(data.areas).filter(a => a.prices[g]).length}/${areaCount}`).join(', ');
console.log(`Wrote ${output}: ${areaCount} areas, latest retail ${latest}; grade coverage: ${coverage}; `
  + `outlook: ${Object.entries(data.outlook).map(([f, m]) => `${f} ${Object.keys(m).join('/')}`).join('; ')}; `
  + `wholesale: ${Object.entries(data.wholesale).map(([k, v]) => `${k} ${v.length}d`).join(', ')}`);

function validate(d) {
  const fail = msg => { throw new Error(`Invalid data: ${msg}`); };
  if (!d.generatedAt || !d.source?.id) fail('missing generatedAt/source');
  if (!d.grades?.regular) fail('missing grades.regular');
  if (!d.areas || typeof d.areas !== 'object') fail('missing areas');
  const checkSeries = (label, series) => {
    if (!Array.isArray(series) || series.length < 8) fail(`${label}: too little history (${series?.length ?? 0})`);
    for (const p of series) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date) || !Number.isFinite(p.price) || p.price <= 0) fail(`${label}: bad point ${JSON.stringify(p)}`);
    }
  };
  for (const [id, a] of Object.entries(d.areas)) {
    if (!a.name || !a.padd) fail(`${id}: missing name/padd`);
    if (!a.prices?.regular) fail(`${id}: missing regular prices`);
    for (const [g, p] of Object.entries(a.prices)) checkSeries(`${id}/${g}`, p.daily?.length ? p.daily : p.weekly);
  }
  if (!d.outlook || typeof d.outlook !== 'object') fail('missing outlook');
  if (!d.wholesale?.rbob?.length) fail('missing wholesale.rbob');
}
