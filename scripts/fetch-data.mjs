// Fetches gas price data from the configured provider and writes data/prices.json.
//
//   EIA_API_KEY=your_key node scripts/fetch-data.mjs
//
// Env:
//   DATA_PROVIDER  provider module name in scripts/providers/ (default: eia)
//   EIA_API_KEY    EIA key; falls back to DEMO_KEY (rate-limited) with a warning
//   OUTPUT         output path (default: data/prices.json)
//   HISTORY        verdict history path (default: data/verdict-history.json)

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyze } from '../js/predict.js';
import { analysisInputs, pickSeries } from '../js/inputs.js';
import { FUEL_CHOICES } from '../js/regions.js';
import { scoreTrack, appendHistory } from '../js/track.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const providerName = process.env.DATA_PROVIDER || 'eia';
const output = resolve(root, process.env.OUTPUT || 'data/prices.json');
const historyPath = resolve(root, process.env.HISTORY || 'data/verdict-history.json');

let apiKey = process.env.EIA_API_KEY;
if (!apiKey) {
  console.warn('EIA_API_KEY not set — using DEMO_KEY (fine for testing, rate-limited).');
  apiKey = 'DEMO_KEY';
}

const { fetchPrices } = await import(`./providers/${providerName}.mjs`);
const data = await fetchPrices({ apiKey });
validate(data);
data.verdicts = await saveVerdicts(data);
data.track = await updateTrack(data);

await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(data));

const areaCount = Object.keys(data.areas).length;
const latest = Object.values(data.areas).map(a => a.prices.regular?.weekly.at(-1)?.date).sort().at(-1);
const coverage = Object.keys(data.grades).map(g =>
  `${g} ${Object.values(data.areas).filter(a => a.prices[g]).length}/${areaCount}`).join(', ');
console.log(`Wrote ${output}: ${areaCount} areas, latest retail ${latest}; grade coverage: ${coverage}; `
  + `outlook: ${Object.entries(data.outlook).map(([f, m]) => `${f} ${Object.keys(m).join('/')}`).join('; ')}; `
  + `wholesale: ${Object.entries(data.wholesale).map(([k, v]) => `${k} ${v.length}d`).join(', ')}`);

// Today's verdict for every area and grade with its own series, saved so that
// tomorrow's call (here and in the browser) can apply hysteresis against it.
// Yesterday's saved verdicts come from the file being replaced.
async function saveVerdicts(d) {
  let previous = null;
  try { previous = JSON.parse(await readFile(output, 'utf8')).verdicts || null; } catch { /* first run */ }
  const now = Date.now();
  const saved = { date: new Date(now).toISOString().slice(0, 10) };
  const withPrevious = { ...d, verdicts: previous };
  for (const g of Object.keys(d.grades)) {
    saved[g] = {};
    for (const [id, a] of Object.entries(d.areas)) {
      if (!a.prices[g]) continue;
      const { args } = analysisInputs(withPrevious, id, g, now);
      saved[g][id] = analyze(args).verdict.key;
    }
  }
  const flips = Object.keys(d.grades).flatMap(g => Object.entries(saved[g])
    .filter(([id, k]) => previous?.[g]?.[id] && (previous[g][id] === 'wait') !== (k === 'wait')).map(([id, k]) => `${g}/${id}→${k}`));
  console.log(`Verdicts saved for ${saved.date}${previous ? ` (previous ${previous.date})` : ''}; wait↔buy changes: ${flips.join(', ') || 'none'}`);
  return saved;
}

// Keep a rolling history of the verdicts the site gave (the grades it offers)
// and score them against the prices EIA has reported since — the live track
// record shown on the page.
async function updateTrack(d) {
  let history = {};
  try { history = JSON.parse(await readFile(historyPath, 'utf8')); } catch { /* first run */ }
  const calls = Object.fromEntries(FUEL_CHOICES.filter(g => d.verdicts[g]).map(g => [g, d.verdicts[g]]));
  history = appendHistory(history, d.verdicts.date, calls);
  await mkdir(dirname(historyPath), { recursive: true });
  await writeFile(historyPath, JSON.stringify(history, null, 0).replace(/\},"/g, '},\n"') + '\n');
  const track = scoreTrack(history, FUEL_CHOICES, (g, id) => pickSeries(d.areas[id], g));
  const scored = Object.values(track).flatMap(Object.values).reduce((n, a) => n + a.n, 0);
  console.log(`Track record: ${Object.keys(history).length} days of calls kept, ${scored} scored`);
  return track;
}

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
