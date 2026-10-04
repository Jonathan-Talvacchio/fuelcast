// Live track record: scores the verdicts the site actually gave, once EIA has
// reported prices far enough past each one. Pure — used by the data job, which
// stores the summary in data/prices.json (`track`) for the page to show.
//
// A call made on day D is scored like the daily backtest: the price that day and
// seven days later, interpolated between weekly reports. "Wait" is right when
// the price was lower a week later; "fill up now" and "no rush" (both: buy
// today) are right when it wasn't. Savings are against always buying right away:
// a followed "wait" saves (or costs) the week's move; a buy-today call saves 0.

import { parseDate } from './predict.js';

const DAY_MS = 86400000;
export const TRACK_WINDOW_DAYS = 90;   // calls made in this many days before the latest report are summarized
export const HISTORY_KEEP_DAYS = 120;

const isoDay = ms => new Date(ms).toISOString().slice(0, 10);

// Price on a calendar day, interpolated between weekly reports; null outside them.
export function priceOn(series, day) {
  const t = parseDate(day);
  for (let i = 1; i < series.length; i++) {
    const a = parseDate(series[i - 1].date), b = parseDate(series[i].date);
    if (t >= a && t <= b) return series[i - 1].price + (t - a) / (b - a) * (series[i].price - series[i - 1].price);
  }
  return null;
}

// history: { 'YYYY-MM-DD': { regular: { AREA: 'wait' | 'now' | 'ok' }, ... } }
// seriesFor(grade, area) → that area's weekly series, oldest → newest
export function scoreTrack(history, grades, seriesFor) {
  const out = {};
  for (const g of grades) {
    const byArea = {};
    for (const [day, calls] of Object.entries(history)) {
      for (const [area, key] of Object.entries(calls[g] || {})) {
        const s = seriesFor(g, area);
        if (!s || !s.length) continue;
        const lastReport = s[s.length - 1].date;
        if (day < isoDay(parseDate(lastReport) - TRACK_WINDOW_DAYS * DAY_MS)) continue;
        const later = isoDay(parseDate(day) + 7 * DAY_MS);
        const p0 = priceOn(s, day), p7 = priceOn(s, later);
        if (p0 === null || p7 === null) continue;           // not scorable yet
        const wait = key === 'wait';
        const a = (byArea[area] ||= { n: 0, right: 0, saved: 0, waits: 0 });
        a.n++;
        if (wait) a.waits++;
        if (wait === (p7 < p0)) a.right++;
        if (wait) a.saved += p0 - p7;
      }
    }
    for (const a of Object.values(byArea)) a.saved = Math.round((a.saved / a.n) * 10000) / 10000;   // $/gal per call
    out[g] = byArea;
  }
  return out;
}

// Add one day's calls and drop old days.
export function appendHistory(history, day, calls) {
  const next = { ...history, [day]: calls };
  const cutoff = isoDay(parseDate(day) - HISTORY_KEEP_DAYS * DAY_MS);
  return Object.fromEntries(Object.entries(next).filter(([d]) => d >= cutoff).sort(([a], [b]) => a.localeCompare(b)));
}
