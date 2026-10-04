// Data freshness checks. The data job records `health` in data/prices.json;
// scripts/check-health.mjs fails the workflow (so GitHub emails the owner) when
// a check fails. Pure, so it can be tested.

import { parseDate } from './predict.js';

const DAY_MS = 86400000;
export const LIMITS = {
  retailDays: 10,          // EIA posts retail weekly (Mondays); 10 days means a missed week
  spotDays: 10,            // EIA posts spot prices weekly (Wednesdays)
  futuresFailRuns: 3,      // consecutive data runs without the futures fill
};

const lastDate = s => (s && s.length ? s[s.length - 1].date : null);

// Summarize freshness from a fresh data file and the previous one's health.
export function healthOf(d, previous = null, now = Date.now()) {
  const retail = Object.values(d.areas).map(a => lastDate(a.prices.regular?.weekly)).filter(Boolean).sort().at(-1) || null;
  const spot = d.wholesale.rbob || [];
  const eiaSpot = lastDate(spot.filter(p => !p.est));
  const futures = d.source?.futures || {};
  const futuresOk = Object.values(futures).length > 0 && Object.values(futures).every(f => !f.error);
  return {
    checkedAt: new Date(now).toISOString(),
    retailAsOf: retail,
    eiaSpotAsOf: eiaSpot,
    wholesaleThrough: lastDate(spot),
    futuresOk,
    futuresFailStreak: futuresOk ? 0 : ((previous && previous.futuresFailStreak) || 0) + 1,
  };
}

// Problems worth an alert; empty when healthy.
export function healthProblems(h, now = Date.now()) {
  const age = day => (day ? Math.floor((now - parseDate(day)) / DAY_MS) : Infinity);
  const out = [];
  if (age(h.retailAsOf) > LIMITS.retailDays) out.push(`EIA retail prices are ${age(h.retailAsOf)} days old (latest ${h.retailAsOf}).`);
  if (age(h.eiaSpotAsOf) > LIMITS.spotDays) out.push(`EIA wholesale spot prices are ${age(h.eiaSpotAsOf)} days old (latest ${h.eiaSpotAsOf}).`);
  if (h.futuresFailStreak >= LIMITS.futuresFailRuns) out.push(`The NYMEX futures fill has failed ${h.futuresFailStreak} runs in a row; wholesale is EIA-only, through ${h.eiaSpotAsOf}.`);
  return out;
}
