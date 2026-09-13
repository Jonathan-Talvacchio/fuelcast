// Pure prediction logic. No DOM, no fetch — shared by the browser and tests.
//
// analyze() takes an area's price history, the official monthly outlook for
// its region, and daily wholesale prices, and returns a daily projection plus
// the summary numbers the UI shows (today / tomorrow / this week / next week,
// deal score, verdict). Everything is a simple, explainable heuristic.

const DAY_MS = 86400000;

export const MODEL = {
  momentumPoints: 6,        // regression window (data points)
  maxSlopePerDay: 0.02,     // $/gal/day cap on momentum
  passThrough: 0.7,         // share of wholesale move that reaches the pump
  leadLookbackDays: 10,     // trading days of wholesale change to consider
  leadMaxEffect: 0.25,      // $/gal cap on wholesale effect
  leadStartDay: 2,          // days before wholesale change starts showing
  leadFullDay: 14,          // day by which the wholesale change is fully passed through
  anchorStartDay: 7,        // projection starts blending toward outlook here...
  anchorFullDay: 30,        // ...and is fully anchored here
  bandPoints: 12,           // changes used for the uncertainty band
  minBand: 0.02,            // $/gal minimum per-step volatility
  flatThreshold: 0.03,      // $/gal; smaller 30-day moves count as "flat"
  scoreRangeDays: 90,
  scoreRangeWeight: 0.7,
  scoreTrendWeight: 0.3,
  scoreTrendFullSwing: 0.15, // 14-day move that maps to a 0 or 100 trend score
  verdictMove: 0.02,        // $/gal predicted 14-day move that makes timing advice directional
  horizonDays: 30,
};

export const VERDICTS = {
  now:  { key: 'now',  label: 'Fill up now' },
  ok:   { key: 'ok',   label: 'No rush — fill when convenient' },
  wait: { key: 'wait', label: 'Wait if you can — top off only' },
};

export function parseDate(s) {
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d || 1);
}

export function isoDate(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const mean = xs => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);

function stdev(xs) {
  if (xs.length < 2) return NaN;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
}

function median(xs) {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// Weighted least-squares slope ($/day) over the last n points, weighting
// recent points more so the estimate reflects current momentum.
export function momentumSlope(points, n = MODEL.momentumPoints) {
  const pts = points.slice(-n);
  if (pts.length < 2) return 0;
  const t0 = parseDate(pts[0].date);
  const xs = pts.map(p => (parseDate(p.date) - t0) / DAY_MS);
  const ys = pts.map(p => p.price);
  const ws = pts.map((_, i) => i + 1);
  const W = ws.reduce((a, b) => a + b, 0);
  const xm = xs.reduce((a, x, i) => a + ws[i] * x, 0) / W;
  const ym = ys.reduce((a, y, i) => a + ws[i] * y, 0) / W;
  let num = 0, den = 0;
  for (let i = 0; i < pts.length; i++) {
    num += ws[i] * (xs[i] - xm) * (ys[i] - ym);
    den += ws[i] * (xs[i] - xm) ** 2;
  }
  if (den === 0) return 0;
  return clamp(num / den, -MODEL.maxSlopePerDay, MODEL.maxSlopePerDay);
}

// Total expected $/gal effect at the pump from the recent wholesale move.
export function wholesaleLead(rbob) {
  if (!rbob || rbob.length < 2) return 0;
  const last = rbob[rbob.length - 1].price;
  const prior = rbob[Math.max(0, rbob.length - 1 - MODEL.leadLookbackDays)].price;
  return clamp((last - prior) * MODEL.passThrough, -MODEL.leadMaxEffect, MODEL.leadMaxEffect);
}

function leadRamp(d) {
  return clamp((d - MODEL.leadStartDay) / (MODEL.leadFullDay - MODEL.leadStartDay), 0, 1);
}

function anchorWeight(d) {
  return clamp((d - MODEL.anchorStartDay) / (MODEL.anchorFullDay - MODEL.anchorStartDay), 0, 1);
}

// Interpolate a monthly outlook (each value = that month's average) to a
// specific day by linearly blending between month midpoints.
export function outlookAt(outlook, ms) {
  if (!outlook || !outlook.length) return NaN;
  const pts = outlook
    .map(o => {
      const [y, m] = o.month.split('-').map(Number);
      const start = Date.UTC(y, m - 1, 1);
      const end = Date.UTC(y, m, 1);
      return { t: (start + end) / 2, price: o.price };
    })
    .sort((a, b) => a.t - b.t);
  if (ms <= pts[0].t) return pts[0].price;
  if (ms >= pts[pts.length - 1].t) return pts[pts.length - 1].price;
  for (let i = 1; i < pts.length; i++) {
    if (ms <= pts[i].t) {
      const f = (ms - pts[i - 1].t) / (pts[i].t - pts[i - 1].t);
      return pts[i - 1].price + f * (pts[i].price - pts[i - 1].price);
    }
  }
  return NaN;
}

// Volatility per data step, and the step length in days.
function volatility(series) {
  const pts = series.slice(-(MODEL.bandPoints + 1));
  const diffs = [];
  const gaps = [];
  for (let i = 1; i < pts.length; i++) {
    diffs.push(pts[i].price - pts[i - 1].price);
    gaps.push((parseDate(pts[i].date) - parseDate(pts[i - 1].date)) / DAY_MS);
  }
  const sd = stdev(diffs);
  return {
    sd: Number.isFinite(sd) ? Math.max(sd, MODEL.minBand) : 0.05,
    stepDays: Number.isFinite(median(gaps)) && median(gaps) > 0 ? median(gaps) : 7,
  };
}

// Timing advice follows the predicted direction; when prices look steady the
// deal score decides whether it's worth filling up now.
export function verdictFor(score, change14 = 0) {
  if (change14 >= MODEL.verdictMove) return { ...VERDICTS.now, why: 'prices are headed up' };
  if (change14 <= -MODEL.verdictMove) return { ...VERDICTS.wait, why: 'prices are headed down' };
  if (score >= 70) return { ...VERDICTS.now, why: 'this is a good price that is not expected to get better' };
  return { ...VERDICTS.ok, why: 'prices look steady' };
}

/**
 * @param {object} p
 * @param {{date:string,price:number}[]} p.series  area history, oldest → newest
 * @param {{month:string,price:number}[]} [p.outlook]  monthly forecast for the area's region
 * @param {{date:string,price:number}[]} [p.regionSeries]  region history (to offset the outlook)
 * @param {{wti?:{date:string,price:number}[], rbob?:{date:string,price:number}[]}} [p.wholesale]
 * @param {number} [p.now]  ms timestamp for "today" (defaults to Date.now())
 */
export function analyze({ series, outlook, regionSeries, wholesale, now = Date.now() }) {
  if (!series || !series.length) throw new Error('No price history for this area');
  const pts = [...series].sort((a, b) => parseDate(a.date) - parseDate(b.date));
  const latest = pts[pts.length - 1];
  const asOfMs = parseDate(latest.date);
  const todayMs = Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), new Date(now).getUTCDate());
  const d0 = clamp(Math.round((todayMs - asOfMs) / DAY_MS), 0, 60);

  const slope = momentumSlope(pts);
  const lead = wholesaleLead(wholesale && wholesale.rbob);
  const { sd, stepDays } = volatility(pts);

  // Offset the region-level outlook by how this area currently trades vs. its
  // region (used when displaying the outlook for this area).
  let offset = 0;
  if (regionSeries && regionSeries.length) {
    const r = [...regionSeries].sort((a, b) => parseDate(a.date) - parseDate(b.date));
    offset = latest.price - r[r.length - 1].price;
  }
  const hasOutlook = !!(outlook && outlook.length);
  // The outlook contributes its expected *trajectory* from the as-of date, not
  // its level: monthly forecasts are published early in the month and can sit
  // above or below what the pump is actually doing this week.
  const outlookBase = hasOutlook ? outlookAt(outlook, asOfMs) : NaN;

  const horizon = d0 + MODEL.horizonDays;
  const projection = [];
  for (let d = 0; d <= horizon; d++) {
    const ms = asOfMs + d * DAY_MS;
    let price = latest.price + slope * d + lead * leadRamp(d);
    if (hasOutlook) {
      const anchor = latest.price + (outlookAt(outlook, ms) - outlookBase);
      if (Number.isFinite(anchor)) {
        const w = anchorWeight(d);
        price = price * (1 - w) + anchor * w;
      }
    }
    const half = d === 0 ? 0 : sd * Math.sqrt(d / stepDays);
    projection.push({ date: isoDate(ms), day: d, price, low: price - half, high: price + half });
  }
  const at = d => projection[Math.min(d, projection.length - 1)].price;
  const avg = (from, to) => mean(projection.slice(from, to + 1).map(p => p.price));

  const today = at(d0);
  const tomorrow = at(d0 + 1);
  const thisWeek = avg(d0 + 1, d0 + 7);
  const nextWeek = avg(d0 + 8, d0 + 14);
  const change14 = at(d0 + 14) - today;
  const change30 = at(d0 + 30) - today;
  const direction = change30 > MODEL.flatThreshold ? 'rising'
    : change30 < -MODEL.flatThreshold ? 'falling' : 'flat';

  // Deal score: where today sits in the trailing range, plus what's coming.
  const rangeStart = asOfMs - MODEL.scoreRangeDays * DAY_MS;
  const window = pts.filter(p => parseDate(p.date) >= rangeStart).map(p => p.price);
  const lo = Math.min(...window, latest.price);
  const hi = Math.max(...window, latest.price);
  const rangePos = hi > lo ? clamp((hi - today) / (hi - lo), 0, 1) : 0.5;
  const trendPos = clamp(0.5 + change14 / MODEL.scoreTrendFullSwing / 2, 0, 1);
  const score = Math.round(100 * (MODEL.scoreRangeWeight * rangePos + MODEL.scoreTrendWeight * trendPos));
  const verdict = verdictFor(score, change14);

  // Wholesale context for the "what's driving prices" panel.
  const change = (arr, n) => {
    if (!arr || arr.length < 2) return null;
    const last = arr[arr.length - 1];
    const prior = arr[Math.max(0, arr.length - 1 - n)];
    return { from: prior.price, to: last.price, delta: last.price - prior.price,
      pct: (last.price - prior.price) / prior.price, asOf: last.date };
  };

  // Next three months of outlook, offset to this area.
  const nowMonth = isoDate(todayMs).slice(0, 7);
  const upcoming = hasOutlook
    ? outlook.filter(o => o.month >= nowMonth).sort((a, b) => a.month.localeCompare(b.month))
      .slice(0, 3).map(o => ({ month: o.month, price: o.price + offset }))
    : [];

  return {
    asOf: latest.date,
    lastReported: latest.price,
    daysSinceReport: d0,
    today, tomorrow, thisWeek, nextWeek,
    change14, change30, direction,
    score, verdict,
    range: { low: lo, high: hi, avg: mean(window), days: MODEL.scoreRangeDays },
    drivers: {
      momentumPerWeek: slope * 7,
      wholesaleEffect: lead,
      wti: change(wholesale && wholesale.wti, MODEL.leadLookbackDays),
      rbob: change(wholesale && wholesale.rbob, MODEL.leadLookbackDays),
      outlook: upcoming,
      outlookOffset: offset,
    },
    history: pts,
    projection,
    projectionFromDay: d0,
  };
}
