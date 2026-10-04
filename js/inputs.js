// Picks the model inputs for an area and grade out of data/prices.json. Shared
// by the browser and the data job (which saves each day's verdict so the next
// day's call can apply hysteresis), so both see exactly the same inputs.

import { GRADES } from './regions.js';
import { parseDate } from './predict.js';

const DAY_MS = 86400000;
const VERDICT_MAX_AGE_DAYS = 3;   // older saved verdicts are ignored

export function pickSeries(area, g) {
  const p = area && area.prices && area.prices[g];
  if (!p) return null;
  const s = p.daily && p.daily.length ? p.daily : p.weekly;
  return s && s.length ? s : null;
}

// Find this grade's series for an area, falling back to its region (then the
// U.S.) when the grade isn't reported there — EIA publishes diesel for regions
// and California only.
export function seriesFor(data, areaId, g) {
  const area = data.areas[areaId];
  let s = pickSeries(area, g);
  if (s) return { series: s, areaId, fallback: false };
  s = pickSeries(data.areas[area.padd], g);
  if (s) return { series: s, areaId: area.padd, fallback: true };
  return { series: pickSeries(data.areas.NUS, g), areaId: 'NUS', fallback: true };
}

// The previous verdict saved by the data job for this series, if recent.
export function savedVerdict(data, areaId, g, now = Date.now()) {
  const v = data.verdicts;
  if (!v || !v.date || now - parseDate(v.date) > VERDICT_MAX_AGE_DAYS * DAY_MS) return null;
  return (v[g] && v[g][areaId]) || null;
}

// Everything analyze() needs for an area that reports this grade (or its fallback).
export function analysisInputs(data, areaId, g, now = Date.now()) {
  const found = seriesFor(data, areaId, g);
  if (!found.series) return { found };
  const grade = GRADES[g];
  const paddId = data.areas[found.areaId].padd;
  const outlookFamily = data.outlook[grade.outlook] || {};
  return {
    found,
    paddId,
    args: {
      series: found.series,
      outlook: outlookFamily[paddId] || outlookFamily.NUS || null,
      regionSeries: paddId !== found.areaId ? pickSeries(data.areas[paddId], g) : null,
      wholesale: { spot: data.wholesale[grade.lead], wti: data.wholesale.wti },
      now,
      prevVerdict: savedVerdict(data, found.areaId, g, now),
    },
  };
}
