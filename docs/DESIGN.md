# Fuelcast — Design Document

**Status:** Live at <https://jonathan-talvacchio.github.io/fuelcast/>
**Repo:** <https://github.com/Jonathan-Talvacchio/fuelcast>
**Last updated:** 2026-09-13 (deal score removed; selector reduced to Gas · Diesel)

## 1. Overview

Fuelcast answers one question for a driver: **should I fill up today, or wait?**
It shows the average price of regular gasoline in the visitor's area, predicted
prices for tomorrow, this week and next week, a two-week trend
chart, and the factors moving prices — all from free public data, on a site that
costs nothing to run.

The site is deliberately a *timing* tool, not a station finder. It does not know
what any individual station charges; it knows where an area's average is and where
it is likely headed.

## 2. Goals and non-goals

**Goals**

- Give a clear, honest recommendation (fill up now / no rush / wait) with the reasoning visible.
- Show today, tomorrow, this-week and next-week prices for the visitor's area.
- Show where today sits in the 90-day range and a short-term trend with an uncertainty range.
- Run at $0 indefinitely: static hosting, free data, no servers, no keys in the browser.
- Make swapping in a paid, higher-resolution data source a one-file change.
- Be usable on a phone in a few seconds, including a "use my location" shortcut.
- State plainly that predictions are estimates and not guaranteed.

**Non-goals**

- Station-level prices, maps, or route planning.
- User accounts, price alerts, or push notifications (would need a backend).
- A machine-learned model. The predictor is a transparent heuristic by design.
- Non-US coverage (the data source is US-only).

## 3. Constraints that shaped the design

| Constraint | Consequence |
|---|---|
| Must be free to host | Static site on GitHub Pages; no runtime backend. |
| No free real-time, zip-level gas price API exists | Use the U.S. EIA: weekly average retail prices for 29 areas (US, 5 regions + 3 East Coast sub-districts, 9 states, 10 metros). "Your area" means the most specific of those. |
| The EIA API needs a key, and a browser can't hide one | Data is fetched server-side by a scheduled GitHub Actions job and committed as a JSON file. The browser only reads that file. |
| Weekly data, but visitors want "today" and "tomorrow" | Estimate today from the last weekly report plus momentum; use EIA's *daily* wholesale prices as a leading indicator and EIA's official monthly outlook for the direction further out. |
| Paid data may come later | A provider contract: the site consumes one normalized JSON shape; providers are pluggable modules in the fetch script. |

## 4. Architecture

```
            ┌──────────────────────────┐
            │  EIA Open Data API (v2)  │  weekly retail · daily spot · monthly STEO outlook
            └────────────┬─────────────┘
                         │  daily 21:00 UTC (GitHub Actions cron, EIA_API_KEY secret)
                         ▼
   scripts/fetch-data.mjs ──► scripts/providers/eia.mjs
                         │  normalize + validate
                         ▼
               data/prices.json  (committed to main, ~120 KB)
                         │  deploy job (same workflow)
                         ▼
                  GitHub Pages (static)
                         │  fetch('data/prices.json')
                         ▼
   Browser: js/app.js ── js/regions.js ── js/predict.js ── js/chart.js
```

There are two moving parts and nothing else:

1. **Data pipeline** (`scripts/`, `.github/workflows/update-data.yml`). A Node 20
   script with no dependencies calls the configured provider, validates the result,
   and writes `data/prices.json`. The workflow commits the file if it changed, then
   deploys Pages. (Commits made with the Actions token do not trigger other
   workflows, so the deploy step lives in the same workflow rather than relying on
   the push-triggered `deploy-pages.yml`, which handles ordinary code pushes.)
2. **Static site** (`index.html`, `css/`, `js/`). Plain ES modules, no build step.
   Chart.js 4 is the only external library, loaded pinned from cdnjs.

## 5. Data

### 5.1 Sources (EIA API v2)

| Data | Route | Series | Cadence | Use |
|---|---|---|---|---|
| Retail prices, $/gal | `petroleum/pri/gnd` | products `EPMR` regular, `EPMM` midgrade, `EPMP` premium (29 areas each), `EPD2D` diesel (11 areas: U.S., regions, California) | Weekly (Mondays) | Price history, "today", 90-day range |
| Regular gasoline retail outlook, ¢/gal | `steo` | `MGRARUS`, `MGRARP1`–`MGRARP5` | Monthly, ~15 months ahead | Anchor for the 1–4 week projection (all gasoline grades); "official outlook" panel |
| Diesel retail outlook, ¢/gal | `steo` | `DSRTUUS` (U.S. only) | Monthly | Anchor for diesel, offset to the area |
| NY Harbor RBOB gasoline spot, $/gal | `petroleum/pri/spt` | `EER_EPMRU_PF4_Y35NY_DPG` | Daily | Leading indicator for gasoline pump prices |
| NY Harbor ULSD diesel spot, $/gal | `petroleum/pri/spt` | `EER_EPD2DXL0_PF4_Y35NY_DPG` | Daily | Leading indicator for diesel pump prices |
| WTI crude spot, $/bbl | `petroleum/pri/spt` | `RWTC` | Daily | Context in "what's driving prices" |

### 5.2 Normalized contract (`data/prices.json`)

```jsonc
{
  "generatedAt": "2026-09-13T23:20:54Z",
  "source": { "id": "eia", "name": "...", "url": "...", "cadence": "weekly", "note": "..." },
  "grades": { "regular": { "name": "Regular", "lead": "rbob", "outlook": "regular" }, ...,
              "diesel":  { "name": "Diesel",  "lead": "ulsd", "outlook": "diesel" } },
  "areas": {
    "STX": { "name": "Texas", "kind": "state", "padd": "R30",
             "prices": {
               "regular": { "weekly": [ { "date": "2026-09-07", "price": 3.618 } ] },  // oldest → newest, 104 weeks
               "premium": { "weekly": [ ... ] }            // a missing grade → UI falls back to padd, then NUS
             },
             "weekly": [ ... ] }                           // alias of prices.regular.weekly
  },
  "outlook":   { "regular": { "R30": [ { "month": "2026-10", "price": 3.589 } ] },   // by family, then PADD
                 "diesel":  { "NUS": [ ... ] } },
  "wholesale": { "wti":  [ { "date": "2026-09-09", "price": 97.26 } ],
                 "rbob": [ { "date": "2026-09-09", "price": 3.289 } ],
                 "ulsd": [ { "date": "2026-09-09", "price": 4.85 } ] }
}
```

The file is about 500 KB with four grades (about 120 KB gzipped over Pages).

Area ids are EIA `duoarea` codes so the data file and `js/regions.js` agree without
a mapping layer. The fetch script rejects a file with fewer than 8 history points
for any area, non-positive prices, or missing wholesale data, so a bad upstream
response can never replace good committed data.

### 5.3 Provider abstraction

`scripts/providers/<name>.mjs` exports `fetchPrices({ apiKey })` returning the
contract above. `DATA_PROVIDER` (a repository variable) selects the module; a new
key is passed through as another secret. The UI and model are untouched by a
provider change. If a provider supplies `daily`, the model uses it automatically
and scales its uncertainty band by day instead of week.

## 6. Regions and location

`js/regions.js` holds three tables:

- **AREAS** — the 29 areas with name, kind (national / metro / state / region), the
  PADD used for the outlook, and lat/lon for metros.
- **STATES** — all 50 states + DC mapped to the most specific area available (own
  state series if one exists, otherwise its PADD sub-district, e.g. Georgia →
  Lower Atlantic, Oregon → West Coast excl. California) plus a centroid.
- **areaForCoords(lat, lon)** — nearest metro if within 75 miles, else the nearest
  state centroid's area. Runs entirely offline; no geocoding service.

The dropdown lists states first (what people know), then metros, regions and the
U.S. average. Selecting a state without its own series shows a note explaining
which regional average is being used. Selection is stored in `localStorage` and
mirrored in the URL hash (`#state:TX`) so links are shareable.

**Fuel.** A segmented control offers Gas · Diesel (`FUEL_CHOICES` in `regions.js`).
All four EIA grades are fetched and backtested (`GRADES`), but midgrade and premium
are not selectable: in two years of data their week-to-week moves correlate 0.97–1.00
with regular's in 27 of 29 areas, and the backtest gives the same direction accuracy
(72%) for all three — so the verdict would be identical, and a four-way control only
added noise. What *does* differ is the level: premium runs 42¢ (Los Angeles) to $1.12
(Chicago) over regular, and the gap is stable within an area (±1–4¢). So the Today
tile shows "Midgrade ≈ $x · Premium ≈ $y", each estimated as that grade's latest
report plus regular's estimated move since then. Diesel earns its own choice: it
correlates only ~0.89 with regular, has its own wholesale lead (ULSD vs. RBOB), its
own outlook family and its own areas.

Each grade names the wholesale series that leads it and the outlook family it follows
(the regular-gasoline forecast for all gasoline grades; the diesel forecast for
diesel). When a grade is not reported for the chosen area, the UI falls back to the
area's region, then the U.S., and says so: EIA publishes diesel only for regions and
California. The fuel is remembered alongside the area and appears in the hash as
`#state:TX/diesel`; old `/midgrade` and `/premium` links resolve to gas.

## 7. Prediction model (`js/predict.js`)

Everything is a pure function of the data file, so it is unit-tested in Node and
runs unchanged in the browser. Let `P₀` be the latest reported price on date
`asOf`, and `d` the number of days after `asOf`.

**Momentum.** Weighted least-squares slope `m` ($/day) over the last 6 reports,
weights 1…6 (most recent heaviest), clamped to ±$0.02/day. Its effect fades with a
one-week time constant rather than extrapolating forever:
`mom(d) = m × 7 × (1 − e^(−d/7))` — so it contributes at most a week's worth of drift.
(Backtested: linear extrapolation made the 2-week forecast worse than "no change".)

**Wholesale lead.** `L = clamp(0.7 × (RBOB_now − RBOB_10 trading days ago), ±$0.25)`.
Pump prices follow wholesale with a lag, so `L` is applied on a ramp from day 2
to day 14: `lead(d) = L × clamp((d − 2) / 12, 0, 1)`.

**Outlook anchor.** EIA's monthly forecast is interpolated between month midpoints
to a daily curve `O(t)`. Only its *trajectory* is used, never its level (a forecast
published early in the month can sit well above or below this week's pump price):
`A(d) = P₀ + O(asOf + d) − O(asOf)`.

**Projection.** `raw(d) = P₀ + mom(d) + lead(d)`, then blended toward the anchor with
weight `w(d) = clamp((d − 7) / 23, 0, 1)`:
`price(d) = (1 − w)·raw(d) + w·A(d)`. So days 0–7 are pure momentum + wholesale;
by day 30 the projection follows EIA's outlook shape.

**Uncertainty band.** `σ` = standard deviation of the last 12 report-to-report
changes (floor $0.02); `band(d) = ±σ·(d / stepDays)`. The band grows linearly with
the horizon, not as √d: backtesting showed a random-walk band caught only 53% of
2-week outcomes, while linear growth calibrates both horizons at ≈68%.

**Derived numbers.** With `d₀` = days since `asOf` (today):
today = `price(d₀)`, tomorrow = `price(d₀+1)`, this week = mean of days `d₀+1…d₀+7`,
next week = mean of `d₀+8…d₀+14`, `Δ14 = price(d₀+14) − today`,
direction over 30 days = rising / falling / flat (±$0.03 threshold).

**90-day range.** `pos = (today − low₉₀) / (high₉₀ − low₉₀)` — 0 when today is the
90-day low, 1 at the high. Shown as the low / average / high bar and used for the
plain-English "near their 90-day low / around their recent average / …" summary.

**Verdict.** Timing advice follows direction first, then the range position:

| Condition | Verdict | Shown reason |
|---|---|---|
| `Δ14 ≥ +$0.02` | Fill up now | prices are headed up |
| `Δ14 ≤ −$0.02` | Wait if you can — top off only | prices are headed down |
| otherwise, `pos ≤ 0.2` | Fill up now | a good price that is not expected to get better |
| otherwise | No rush — fill when convenient | prices look steady |

Direction comes first by design: an earlier version derived the verdict from a
blended 0–100 "deal score" and could say "wait" while predicting a rise. The score
was later dropped from the UI entirely — one number that mixed "cheap vs. the last
90 days" with "expected to rise" was harder to read than the two facts it summarized.

All constants live in one `MODEL` object so they can be tuned in one place.

### 7.1 Backtest evidence

`scripts/backtest.mjs` walks forward through 10 years of EIA history, separately
for each fuel grade with that grade's wholesale lead, using only the data that
existed on each date; the outlook anchor is disabled because past forecast
vintages are unavailable. The **Backtest model** workflow reruns it with the real
API key and commits [`docs/BACKTEST.md`](BACKTEST.md). Results with the current
(shared) constants:

| Grade | Decisions · areas | Direction right | 1-wk error vs "no change" | Band 1 wk / 2 wk | Saved vs always-now | Of oracle |
|---|---|---|---|---|---|---|
| Regular | 15,083 · 29 | 72% | 5.0¢ vs 5.5¢ | 68% / 67% | 1.28¢/gal | 50% |
| Midgrade | 15,078 · 29 | 72% | 5.1¢ vs 5.5¢ | 67% / 67% | 1.15¢/gal | 46% |
| Premium | 15,077 · 29 | 72% | 5.0¢ vs 5.4¢ | 67% / 67% | 1.16¢/gal | 47% |
| Diesel | 5,722 · 11 | 75% | 4.1¢ vs 4.6¢ | 69% / 63% | 1.27¢/gal | 65% |

Base rate for direction is ≈50%. "Wait" calls are right 76–81% of the time
depending on grade and save about 3¢/gal each when made.

The wholesale lead is the single most valuable input for every grade: momentum
alone gets 64–70% direction accuracy and roughly half the savings. The sweep found
`passThrough`, `verdictMove`, `momentumPoints` and `leadLookbackDays` near their
optimum for the gasoline grades; the two changes it motivated were momentum decay
and linear band growth. Diesel is the best-behaved grade (ULSD leads the pump most
reliably). Its sweep shows a lower pass-through (0.35) would cut its forecast error
further (3.7¢) at a small cost in savings, so the shared constants were kept —
the site optimizes for the decision, not the point forecast.

## 8. User interface

Single page, mobile-first, no framework. Reading order matches decision order:

1. **Area and fuel controls** — dropdown + "Use my location" + Gas/Diesel toggle, with a note when a regional fallback is used.
2. **Verdict card** — the recommendation, a one-line "because…", the plain-English
   summary (position vs. 90-day range + predicted move), and the last reported price
   and date. The card's left rule and headline take the verdict color.
3. **Price strip** — Today (est.) · Tomorrow · This week avg · Next week avg, each
   with a rounded-cents delta so the numbers and deltas never contradict.
4. **Trend chart** — 13 weeks reported (solid, points) + 14 days predicted (dashed)
   with the band as a fill, a "today" marker, one linear day-offset axis so weekly
   and daily points share a scale without a date adapter, and a table view.
5. **What's driving prices** — local momentum, wholesale gasoline, crude, each with
   an up/down chip and one sentence of context.
6. **Last 90 days** — low / average / high, a position marker, and EIA's next three
   monthly outlook values offset to this area.
7. **How this works** and the **disclaimer** footer.

States: loading, fetch failure, stale data banner (file older than 10 days), and a
per-area "report is N days old" flag when a report is more than 14 days old.

Visual system: system font stack; light and dark palettes via `prefers-color-scheme`;
semantic colors reserved for good / warning / bad; blue for the data line only.
Breakpoints at 760px (single column, 2×2 price tiles, shorter chart) and 400px
(tighter padding).

## 9. Deployment and operations

- **`deploy-pages.yml`** — on push to `main`: upload the repo root as the Pages artifact and deploy.
- **`update-data.yml`** — daily at 21:00 UTC (after EIA's Monday ~5 pm ET release) and on demand: run tests → fetch → commit if changed → deploy. Uses the `EIA_API_KEY` secret; falls back to EIA's rate-limited `DEMO_KEY` with a warning.
- Both workflows share the `pages` concurrency group so deploys never overlap.
- Pages source is "GitHub Actions"; `.nojekyll` prevents Jekyll processing.
- Local development: `python -m http.server 8765` (modules need HTTP); `node scripts/fetch-data.mjs` to refresh data; `node --test scripts/test-predict.mjs` for the 14 model/region tests.

## 10. Privacy and security

- No accounts, cookies, analytics, or third-party requests other than the Chart.js
  script from cdnjs. The only stored state is the area choice in `localStorage`.
- Geolocation is requested only on tap, resolved in the browser, and never sent anywhere.
- The API key exists only as a repository secret; the deployed site contains no secrets.
- Workflow permissions are scoped: the data job has `contents: write`; the deploy job has `pages: write` + `id-token: write` only.

## 11. Known limitations

- **Resolution.** Prices are area averages, updated weekly. A visitor in rural
  Georgia sees the Lower Atlantic average, not their county. Station spread within a
  town is usually larger than any week-over-week move — the page says so.
- **"Today" is an estimate** whenever today isn't the report date; the tile is labeled `(est.)` and cites the report date.
- **The model is a heuristic.** It has no notion of hurricanes, refinery outages,
  tax holidays, or OPEC decisions until they show up in wholesale prices or EIA's outlook.
- **Outlook granularity.** EIA forecasts by PADD only; the area offset assumes the
  area's premium over its region stays constant.
- **Free-tier limits.** `DEMO_KEY` is rate-limited; a real key (free) is expected.

## 12. Future work

1. **Paid / daily provider** (planned): one module in `scripts/providers/`, one secret,
   one repository variable. Candidates: CollectAPI (state-level daily), OPIS/GasBuddy
   commercial feeds (station-level). With daily data the "today" estimate becomes an
   observation.
2. **Custom domain** — DNS A/CNAME records to GitHub Pages; no code change.
3. **Backtesting the outlook anchor** — needs archived STEO vintages (EIA publishes
   them as monthly files, not through the API); would let the full model be tested.
4. **Model refinements** — day-of-week seasonality if a daily source is added;
   regional pass-through factors; a hurricane-season prior for Gulf Coast areas.
