// Run with: node --test scripts/
import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze, momentumSlope, wholesaleLead, outlookAt, verdictFor, MODEL } from '../js/predict.js';
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
  assert.ok(d30 > 3.2, `anchored price ${d30}`);
  assert.equal(r.projection[7].price, 3.0); // no anchor influence before anchorStartDay
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
