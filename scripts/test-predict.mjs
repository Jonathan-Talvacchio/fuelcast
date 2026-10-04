// Run with: node --test scripts/
import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze, momentumSlope, wholesaleLead, outlookAt, verdictFor, oddsFor, MODEL } from '../js/predict.js';
import { areaForCoords, STATES, AREAS } from '../js/regions.js';

const DAY = 86400000;
const iso = ms => new Date(ms).toISOString().slice(0, 10);
const asOf = Date.UTC(2026, 8, 7); // Monday 2026-09-07

// Weekly series ending at asOf, oldest → newest, from a price function of week index.
function weekly(n, fn) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push({ date: iso(asOf - i * 7 * DAY), price: fn(n - 1 - i) });
  return out;
}
function daily(n, fn, end = asOf + 2 * DAY) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push({ date: iso(end - i * DAY), price: fn(n - 1 - i) });
  return out;
}
const now = asOf + 3 * DAY; // Thursday

test('momentum slope follows a steady trend and is capped', () => {
  const up = weekly(8, i => 3 + 0.07 * i); // +7¢/week = 1¢/day
  assert.ok(Math.abs(momentumSlope(up) - 0.01) < 1e-9);
  const flat = weekly(8, () => 3.1);
  assert.ok(Math.abs(momentumSlope(flat)) < 1e-12);
  const wild = weekly(8, i => 3 + 0.5 * i);
  assert.equal(momentumSlope(wild), MODEL.maxSlopePerDay);
  assert.equal(momentumSlope([{ date: '2026-09-07', price: 3 }]), 0);
});

test('wholesale lead applies pass-through and cap', () => {
  const rbob = daily(15, i => 2.0 + (i >= 5 ? 0.10 : 0));
  assert.ok(Math.abs(wholesaleLead(rbob) - 0.07) < 1e-9);
  const spike = daily(15, i => 2.0 + i * 0.1);
  assert.equal(wholesaleLead(spike), MODEL.leadMaxEffect);
  assert.equal(wholesaleLead([]), 0);
  assert.equal(wholesaleLead(undefined), 0);
});

test('outlookAt interpolates between month midpoints and clamps at the ends', () => {
  const outlook = [{ month: '2026-09', price: 3.0 }, { month: '2026-10', price: 3.2 }];
  assert.equal(outlookAt(outlook, Date.UTC(2026, 7, 1)), 3.0);
  assert.equal(outlookAt(outlook, Date.UTC(2026, 11, 1)), 3.2);
  const mid = (Date.UTC(2026, 8, 16) + Date.UTC(2026, 9, 16)) / 2;
  assert.ok(Math.abs(outlookAt(outlook, mid) - 3.1) < 0.01);
  assert.ok(Number.isNaN(outlookAt([], 0)));
});

test('verdict: direction first, then position in the 90-day range when steady', () => {
  assert.equal(verdictFor(0.05, 0.9).key, 'now');   // rising → buy now even if pricey
  assert.equal(verdictFor(-0.05, 0.1).key, 'wait'); // falling → wait even if cheap
  assert.equal(verdictFor(0, 0.2).key, 'now');      // steady + near the 90-day low
  assert.equal(verdictFor(0, 0.21).key, 'ok');
  assert.equal(verdictFor(0.01, 1).key, 'ok');      // steady + pricey → no rush, no deal
});

test('analyze: long decline just turning up → fill up now', () => {
  // 20 weeks of steep decline, then 6 weeks ticking up: still near the 90-day low, but rising.
  const series = weekly(26, i => (i < 20 ? 3.9 - i * 0.044 : 3.0 + (i - 20) * 0.01));
  const r = analyze({ series, wholesale: { rbob: daily(15, i => 2 + i * 0.01) }, now });
  assert.equal(r.asOf, '2026-09-07');
  assert.equal(r.daysSinceReport, 3);
  assert.ok(r.tomorrow > r.today, 'tomorrow above today when rising');
  assert.ok(r.nextWeek > r.thisWeek);
  assert.ok(r.change14 > 0);
  assert.equal(r.direction, 'rising');
  assert.ok(r.range.pos <= 0.3, `range position ${r.range.pos}`);
  assert.equal(r.verdict.key, 'now');
  assert.equal(r.projection[0].day, 0);
  assert.equal(r.projection[0].price, r.lastReported);
  assert.equal(r.projection.length, 3 + MODEL.horizonDays + 1);
});

test('analyze: recent spike now easing → wait', () => {
  // Flat, then a spike to 3.50 that has started to fall back: near the 90-day high and falling.
  const series = weekly(26, i => (i < 20 ? 3.0 : i < 24 ? 3.5 : 3.5 - (i - 23) * 0.05));
  const r = analyze({ series, wholesale: { rbob: daily(15, i => 2.3 - i * 0.02) }, now });
  assert.ok(r.tomorrow < r.today);
  assert.equal(r.direction, 'falling');
  assert.ok(r.range.pos >= 0.7, `range position ${r.range.pos}`);
  assert.equal(r.verdict.key, 'wait');
});

test('analyze: band widens with horizon and brackets the projection', () => {
  const series = weekly(20, i => 3 + Math.sin(i) * 0.05);
  const r = analyze({ series, now });
  const p = r.projection;
  assert.equal(p[0].high - p[0].low, 0);
  const w = d => p[d].high - p[d].low;
  assert.ok(w(7) > w(1) && w(14) > w(7) && w(30) > w(14));
  for (const q of p) assert.ok(q.low <= q.price && q.price <= q.high);
});

test('analyze: outlook anchor pulls the 30-day projection toward the forecast', () => {
  const series = weekly(20, () => 3.0);
  const outlook = [
    { month: '2026-09', price: 3.0 }, { month: '2026-10', price: 3.5 }, { month: '2026-11', price: 3.5 },
  ];
  const r = analyze({ series, outlook, now });
  const d30 = r.projection[r.projectionFromDay + 30].price;
  assert.ok(d30 > 3.1, `anchored price ${d30}`);
  // No anchor influence inside the 2-week window the verdict and tiles use.
  assert.equal(r.projection[r.projectionFromDay + 14].price, 3.0);
  assert.equal(r.drivers.outlook.length, 3);
  assert.equal(r.drivers.outlook[0].month, '2026-09');
});

test('analyze: region offset shifts the anchor by the area premium', () => {
  const series = weekly(20, () => 4.0);
  const regionSeries = weekly(20, () => 3.0);
  const outlook = [{ month: '2026-09', price: 3.0 }, { month: '2026-10', price: 3.0 }, { month: '2026-11', price: 3.0 }];
  const r = analyze({ series, regionSeries, outlook, now });
  assert.equal(r.drivers.outlookOffset, 1);
  assert.ok(Math.abs(r.projection[r.projectionFromDay + 30].price - 4.0) < 1e-9);
  assert.equal(r.drivers.outlook[0].price, 4.0);
});

test('analyze: flat market sits mid-range and reports flat', () => {
  const series = weekly(20, () => 3.25);
  const r = analyze({ series, now });
  assert.equal(r.direction, 'flat');
  assert.equal(r.range.pos, 0.5);
  assert.equal(r.verdict.key, 'ok');
  assert.equal(r.range.low, 3.25);
  assert.equal(r.range.high, 3.25);
});

test('analyze: short or missing history', () => {
  assert.throws(() => analyze({ series: [] }));
  const r = analyze({ series: [{ date: '2026-09-07', price: 3.1 }], now });
  assert.equal(r.today, 3.1);
  assert.equal(r.direction, 'flat');
  assert.ok(r.projection[10].high > r.projection[10].low);
});

test('analyze: daily series scales the band by day, not by week', () => {
  const series = daily(60, i => 3 + (i % 3) * 0.01, asOf);
  const r = analyze({ series, now });
  assert.ok(r.projection[7].high - r.projection[7].low > 0);
  assert.equal(r.daysSinceReport, 3);
});

test('areaForCoords snaps to a metro when close, else the state area', () => {
  assert.deepEqual(areaForCoords(29.75, -95.36), { area: 'Y44HO', via: 'metro', name: 'Houston' });
  assert.deepEqual(areaForCoords(33.75, -84.39), { area: 'R1Z', via: 'state', name: 'Georgia' }); // Atlanta
  assert.equal(areaForCoords(30.27, -97.74).area, 'STX'); // Austin: >75mi from Houston → Texas
  assert.equal(areaForCoords(45.52, -122.68).area, 'R5XCA'); // Portland, OR
});

test('every state maps to a known area', () => {
  for (const [code, s] of Object.entries(STATES)) {
    assert.ok(AREAS[s.area], `${code} → ${s.area} missing from AREAS`);
  }
  assert.equal(Object.keys(STATES).length, 51);
});

test('every grade names a wholesale lead and an outlook family', async () => {
  const { GRADES } = await import('../js/regions.js');
  for (const [k, g] of Object.entries(GRADES)) {
    assert.ok(['rbob', 'ulsd'].includes(g.lead), `${k} lead`);
    assert.ok(['regular', 'diesel'].includes(g.outlook), `${k} outlook`);
    assert.match(g.product, /^EP/);
  }
});

test('analyze accepts wholesale.spot and falls back to wholesale.rbob', () => {
  const series = weekly(20, () => 3.0);
  const up = daily(15, i => 2 + i * 0.02);
  const a = analyze({ series, wholesale: { spot: up }, now });
  const b = analyze({ series, wholesale: { rbob: up }, now });
  assert.equal(a.drivers.wholesaleEffect, b.drivers.wholesaleEffect);
  assert.ok(a.drivers.wholesaleEffect > 0);
  assert.ok(a.drivers.spot && a.drivers.spot.delta > 0);
});

test('futures fill uses the second-nearest contract', async () => {
  const { contractFor } = await import('./providers/futures.mjs');
  assert.equal(contractFor('RB', '2026-09-29'), 'RBX26.NYM');
  assert.equal(contractFor('HO', '2026-11-03'), 'HOF27.NYM');
  assert.equal(contractFor('RB', '2026-12-31'), 'RBG27.NYM');
});

test('futures fill extends spot by futures changes, flagged as estimates', async () => {
  const { splice } = await import('./providers/futures.mjs');
  const spot = [{ date: '2026-09-28', price: 3.4 }, { date: '2026-09-29', price: 3.3 }];
  const fut = [{ date: '2026-09-29', price: 3.1 }, { date: '2026-09-30', price: 3.15 }, { date: '2026-10-01', price: 3.05 }];
  const out = splice(spot, fut);
  assert.deepEqual(out.slice(2), [{ date: '2026-09-30', price: 3.35, est: true }, { date: '2026-10-01', price: 3.25, est: true }]);
  assert.equal(splice(spot, []), spot);
  assert.equal(splice(spot, [{ date: '2026-10-01', price: 3 }]), spot);   // no base on or before the last spot day
  assert.equal(splice(spot, fut, 1).length, 3);                            // capped fill window
  const r = analyze({ series: weekly(20, () => 3.0), wholesale: { spot: out }, now });
  assert.equal(r.drivers.spot.est, true);
});

test('data providers load', async () => {
  const eia = await import('./providers/eia.mjs');
  assert.equal(typeof eia.fetchPrices, 'function');
});

test('verdict hysteresis: yesterday\'s wait/buy call holds near the line', () => {
  // Without a previous call the line is at −verdictMove.
  assert.equal(verdictFor(-0.019, 0.5).key, 'ok');
  assert.equal(verdictFor(-0.021, 0.5).key, 'wait');
  // After a wait, a forecast that eases back toward the line stays a wait…
  assert.equal(verdictFor(-0.015, 0.5, 'wait').key, 'wait');
  // …until it clears the line by the hysteresis margin.
  assert.equal(verdictFor(-0.005, 0.5, 'wait').key, 'ok');
  // After a buy/no-rush call, a forecast just past the line doesn't flip to wait…
  assert.equal(verdictFor(-0.025, 0.5, 'ok').key, 'ok');
  assert.equal(verdictFor(-0.025, 0.1, 'now').key, 'now');
  // …until it clears the margin.
  assert.equal(verdictFor(-0.035, 0.5, 'now').key, 'wait');
  // Rising prices always mean buy now.
  assert.equal(verdictFor(0.03, 0.9, 'wait').key, 'now');
});

test('saved verdicts feed the next analysis only while recent', async () => {
  const { analysisInputs, savedVerdict } = await import('../js/inputs.js');
  const series = weekly(20, () => 3.0);
  const data = {
    areas: { NUS: { padd: 'NUS', prices: { regular: { weekly: series } } },
             SOH: { padd: 'R20', prices: { regular: { weekly: series } } },
             R20: { padd: 'R20', prices: { regular: { weekly: series }, diesel: { weekly: series } } } },
    outlook: {}, wholesale: { rbob: [], ulsd: [] },
    verdicts: { date: iso(now), regular: { SOH: 'wait' }, diesel: { R20: 'now' } },
  };
  assert.equal(savedVerdict(data, 'SOH', 'regular', now), 'wait');
  assert.equal(savedVerdict(data, 'SOH', 'regular', now + 4 * DAY), null);   // stale
  assert.equal(analysisInputs(data, 'SOH', 'regular', now).args.prevVerdict, 'wait');
  // Ohio has no diesel series: falls back to its region and that region's saved call.
  const d = analysisInputs(data, 'SOH', 'diesel', now);
  assert.equal(d.found.areaId, 'R20');
  assert.equal(d.args.prevVerdict, 'now');
  assert.equal(analysisInputs({ ...data, verdicts: undefined }, 'SOH', 'regular', now).args.prevVerdict, null);
});

test('odds interpolate the calibration table and clamp at its ends', () => {
  const table = [{ x: -0.05, p: 0.8, move: -0.02 }, { x: 0, p: 0.5, move: 0 }, { x: 0.05, p: 0.3, move: 0.02 }];
  assert.deepEqual(oddsFor(-0.025, table), { pLower: 0.65, move7: -0.01 });
  assert.deepEqual(oddsFor(-0.2, table), { pLower: 0.8, move7: -0.02 });
  assert.deepEqual(oddsFor(0.2, table), { pLower: 0.3, move7: 0.02 });
  assert.equal(oddsFor(0, []), null);
  assert.equal(oddsFor(NaN, table), null);
  const r = analyze({ series: weekly(20, () => 3.0), now, odds: table });
  assert.ok(r.odds && Math.abs(r.odds.pLower - 0.5) < 0.01);
  assert.equal(analyze({ series: weekly(20, () => 3.0), now }).odds, null);
});

test('shipped odds tables are well formed', async () => {
  const { ODDS } = await import('../js/calibration.js');
  for (const g of ['regular', 'diesel']) {
    const t = ODDS[g];
    assert.ok(t && t.length >= 5, `${g} table`);
    for (let i = 1; i < t.length; i++) assert.ok(t[i].x > t[i - 1].x, `${g} sorted`);
    for (const b of t) assert.ok(b.p > 0 && b.p < 1 && Math.abs(b.move) < 0.5, `${g} ${JSON.stringify(b)}`);
  }
});

test('track record scores calls a week out against interpolated reports', async () => {
  const { scoreTrack, priceOn, appendHistory } = await import('../js/track.js');
  const series = [
    { date: '2026-09-07', price: 3.00 }, { date: '2026-09-14', price: 3.07 },
    { date: '2026-09-21', price: 3.00 }, { date: '2026-09-28', price: 2.93 },
  ];
  assert.ok(Math.abs(priceOn(series, '2026-09-10') - 3.03) < 1e-9);
  assert.equal(priceOn(series, '2026-10-01'), null);
  const history = {
    '2026-09-07': { regular: { A: 'wait' } },   // 3.00 → 3.07: wait was wrong, cost 7¢
    '2026-09-14': { regular: { A: 'wait' } },   // 3.07 → 3.00: right, saved 7¢
    '2026-09-21': { regular: { A: 'now' } },    // 3.00 → 2.93: buying now was wrong, saved 0
    '2026-09-25': { regular: { A: 'ok' } },     // no price a week later yet: not scored
  };
  const t = scoreTrack(history, ['regular', 'diesel'], (g, id) => (g === 'regular' && id === 'A' ? series : null));
  assert.deepEqual(t.regular.A, { n: 3, right: 1, saved: 0, waits: 2 });
  assert.deepEqual(t.diesel, {});
  // History keeps 120 days and stays sorted.
  const h = appendHistory({ '2026-01-01': {}, '2026-09-01': {} }, '2026-10-04', { regular: {} });
  assert.deepEqual(Object.keys(h), ['2026-09-01', '2026-10-04']);
});
