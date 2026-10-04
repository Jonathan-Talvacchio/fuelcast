// Fills the days after EIA's latest wholesale spot price using NYMEX futures.
//
// EIA posts its daily spot prices once a week (Wednesdays, through Tuesday), so
// the wholesale series the model leans on is 2–8 days old. NYMEX RBOB (gasoline)
// and ULSD (diesel) futures settle every trading day, and their day-to-day
// changes track the spot price closely. Each missing day is estimated as the
// last EIA spot price plus the futures change since that date, and flagged
// `est: true`. Backtested in docs/BACKTEST.md ("Daily verdict").
//
// Quotes come from Yahoo Finance's public chart endpoint (no key, unofficial).
// Any failure leaves the EIA series untouched — the site just loses freshness.

const SYMBOL = { rbob: 'RB', ulsd: 'HO' };
const MONTH_CODES = 'FGHJKMNQUVXZ';
const MAX_FILL_DAYS = 14;   // never stretch further than this past the last EIA day

// The second-nearest contract on the given date. The front contract can expire
// inside the fill window, and gasoline's spring/fall rolls jump 20¢+ between
// contracts; the second one trades through the whole window.
export function contractFor(root, isoDate) {
  const [y, m] = isoDate.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1 + 2, 1));
  return `${root}${MONTH_CODES[t.getUTCMonth()]}${String(t.getUTCFullYear()).slice(2)}.NYM`;
}

async function settlements(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1mo&interval=1d`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (fuelcast data job)' }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const r = (await res.json()).chart?.result?.[0];
  const ts = r?.timestamp, close = r?.indicators?.quote?.[0]?.close;
  if (!Array.isArray(ts) || !Array.isArray(close)) throw new Error('unexpected response shape');
  const offset = (r.meta?.gmtoffset ?? -4 * 3600) * 1000;   // trading dates are exchange-local
  return ts.map((t, i) => ({ date: new Date(t * 1000 + offset).toISOString().slice(0, 10), price: close[i] }))
    .filter(p => Number.isFinite(p.price) && p.price > 0);
}

// Pure: extend `spot` with futures-delta estimates after its last date.
export function splice(spot, futures, maxDays = MAX_FILL_DAYS) {
  if (!spot.length || !futures.length) return spot;
  const last = spot[spot.length - 1];
  const base = futures.filter(p => p.date <= last.date).at(-1);
  if (!base) return spot;
  const limit = new Date(Date.parse(last.date) + maxDays * 86400000).toISOString().slice(0, 10);
  const fill = futures
    .filter(p => p.date > last.date && p.date <= limit)
    .map(p => ({ date: p.date, price: Math.round((last.price + p.price - base.price) * 1000) / 1000, est: true }));
  return [...spot, ...fill];
}

// Mutates `wholesale` (keys rbob / ulsd) in place; returns a log line per series.
export async function extendWithFutures(wholesale) {
  const log = [];
  for (const [key, root] of Object.entries(SYMBOL)) {
    const spot = wholesale[key];
    if (!spot?.length) continue;
    const symbol = contractFor(root, spot[spot.length - 1].date);
    try {
      const out = splice(spot, await settlements(symbol));
      log.push(`${key} +${out.length - spot.length}d from ${symbol}`);
      wholesale[key] = out;
    } catch (e) {
      log.push(`${key} futures skipped (${symbol}: ${e.message})`);
    }
  }
  return log;
}
