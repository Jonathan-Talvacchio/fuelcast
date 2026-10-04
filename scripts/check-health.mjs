// Fails (exit 1) when data/prices.json shows stale or degraded data, so the
// workflow run fails and GitHub notifies the owner. Run after the data is
// committed and deployed, so an alert never blocks an update.
//
//   node scripts/check-health.mjs

import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { healthProblems } from '../js/health.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(await readFile(resolve(root, process.env.OUTPUT || 'data/prices.json'), 'utf8'));
if (!data.health) {
  console.log('No health record in the data file yet.');
  process.exit(0);
}
const problems = healthProblems(data.health);
console.log(`Health: retail ${data.health.retailAsOf}, EIA spot ${data.health.eiaSpotAsOf}, `
  + `wholesale through ${data.health.wholesaleThrough}, futures ${data.health.futuresOk ? 'ok' : `failing (${data.health.futuresFailStreak} runs)`}`);
for (const p of problems) console.log(`::error::${p}`);
process.exit(problems.length ? 1 : 0);
