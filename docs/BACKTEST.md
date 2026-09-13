# Backtest results

Generated 2026-09-13 by `node scripts/backtest.mjs --sweep --report` on 10 years of EIA history (2016-09-12 → 2026-08-24), 15,080 weekly decisions across 29 areas.

## Method

Walk forward one weekly report at a time, giving the model only what existed on that date: retail reports up to the report date and NY Harbor RBOB spot prices dated on or before it (the same 90-day window the site uses). The EIA outlook anchor is **disabled** — only the current forecast vintage is available, and using it for past dates would leak the future into the test. So this measures the momentum + wholesale-lead core of the model, which drives the tomorrow / this-week / verdict numbers on the site.

- **Forecast MAE** — mean absolute error of the 1- and 2-week-ahead prediction against the actual next reports, next to a "no change" baseline.
- **Band coverage** — share of actual prices that fell inside the uncertainty band (a ±1σ band should catch ≈68%).
- **Direction** — when the model predicts a 14-day move of at least the verdict threshold, how often the actual 2-week change had the same sign.
- **Decision** — a driver who must buy within the week follows the verdict: buy now, or buy next week on "wait". Compared with always-now, always-wait, and a perfect-foresight oracle (min of the two). Savings are in cents per gallon, averaged over every week.

## Results

| Variant | 1wk MAE / no-change | 2wk MAE / no-change | Band 1wk / 2wk | Direction right | Saved vs always-now | Of oracle |
|---|---|---|---|---|---|---|
| Default (momentum + wholesale) | 5.04¢ / 5.54¢ | 9.59¢ / 9.17¢ | 67.8% / 52.6% | 72.1% (87.0% called) | 1.28¢ | 49.8% |
| Momentum only | 5.30¢ / 5.54¢ | 8.80¢ / 9.17¢ | 68.1% / 58.5% | 63.8% (50.9% called) | 0.63¢ | 24.4% |

Default verdict mix: fill up now 51.3%, no rush 8.6%, wait 40.1%. "Wait" calls were right 77.8% of the time and saved 3.20¢/gal on average when made. Always waiting a week would have cost 0.39¢/gal relative to always buying now; the oracle saves 2.58¢/gal.

## Per area

| Area | Saved vs always-now | Direction right | 1wk MAE / no-change |
|---|---|---|---|
| Florida | 1.56¢ | 70.9% | 6.53¢ / 7.02¢ |
| Lower Atlantic | 1.53¢ | 75.2% | 4.12¢ / 4.88¢ |
| Chicago | 1.45¢ | 65.6% | 7.63¢ / 8.07¢ |
| Denver | 1.45¢ | 68.4% | 5.93¢ / 6.69¢ |
| Texas | 1.44¢ | 71.7% | 5.44¢ / 6.10¢ |
| East Coast | 1.43¢ | 77.8% | 3.46¢ / 4.22¢ |
| Gulf Coast | 1.42¢ | 74.3% | 4.54¢ / 5.17¢ |
| California | 1.42¢ | 71.3% | 4.97¢ / 5.65¢ |
| Los Angeles | 1.41¢ | 70.6% | 5.31¢ / 5.93¢ |
| Colorado | 1.40¢ | 69.2% | 5.57¢ / 6.25¢ |
| Midwest | 1.36¢ | 67.0% | 5.46¢ / 5.72¢ |
| San Francisco | 1.35¢ | 70.4% | 5.56¢ / 6.12¢ |
| Miami | 1.35¢ | 70.2% | 6.66¢ / 7.03¢ |
| U.S. average | 1.35¢ | 75.1% | 3.65¢ / 4.29¢ |
| New York City | 1.35¢ | 76.1% | 3.78¢ / 4.36¢ |
| New England | 1.33¢ | 78.1% | 3.18¢ / 3.80¢ |
| Central Atlantic | 1.30¢ | 78.7% | 3.41¢ / 3.96¢ |
| Rocky Mountain | 1.26¢ | 71.8% | 4.08¢ / 4.75¢ |
| Minnesota | 1.26¢ | 70.9% | 4.37¢ / 4.83¢ |
| West Coast | 1.26¢ | 73.7% | 4.15¢ / 4.91¢ |
| Massachusetts | 1.24¢ | 76.4% | 3.34¢ / 3.78¢ |
| New York | 1.18¢ | 77.6% | 3.37¢ / 3.69¢ |
| West Coast (excl. California) | 1.17¢ | 74.8% | 3.58¢ / 4.35¢ |
| Boston | 1.16¢ | 76.2% | 3.34¢ / 3.67¢ |
| Washington | 1.15¢ | 74.2% | 3.93¢ / 4.53¢ |
| Cleveland | 1.12¢ | 59.3% | 9.52¢ / 9.24¢ |
| Seattle | 0.97¢ | 74.0% | 3.85¢ / 4.24¢ |
| Ohio | 0.77¢ | 56.6% | 12.16¢ / 11.95¢ |
| Houston | 0.76¢ | 74.3% | 5.31¢ / 5.63¢ |

## Constant sweep (one at a time, others at default)

| Constant | Value | Saved vs always-now | Of oracle | Direction right | MAE 1wk / 2wk | Band 1wk / 2wk | Wait share |
|---|---|---|---|---|---|---|---|
| `passThrough` | 0 | 0.63¢ | 24.4% | 63.8% | 5.30¢ / 8.80¢ | 68.1% / 58.5% | 23.1% |
| `passThrough` | 0.35 | 1.22¢ | 47.4% | 73.3% | 4.76¢ / 8.03¢ | 73.7% / 64.1% | 35.3% |
| `passThrough` | 0.7 (default) | 1.28¢ | 49.8% | 72.1% | 5.04¢ / 9.59¢ | 67.8% / 52.6% | 40.1% |
| `passThrough` | 1 | 1.29¢ | 50.2% | 71.0% | 5.56¢ / 11.40¢ | 60.7% / 43.4% | 42.0% |
| `verdictMove` | 0.01 | 1.30¢ | 50.3% | 70.6% | 5.04¢ / 9.59¢ | 67.8% / 52.6% | 43.3% |
| `verdictMove` | 0.02 (default) | 1.28¢ | 49.8% | 72.1% | 5.04¢ / 9.59¢ | 67.8% / 52.6% | 40.1% |
| `verdictMove` | 0.03 | 1.26¢ | 49.0% | 73.1% | 5.04¢ / 9.59¢ | 67.8% / 52.6% | 37.0% |
| `verdictMove` | 0.05 | 1.19¢ | 46.2% | 75.3% | 5.04¢ / 9.59¢ | 67.8% / 52.6% | 30.9% |
| `momentumPoints` | 4 | 1.30¢ | 50.6% | 72.3% | 5.12¢ / 9.79¢ | 66.4% / 51.4% | 41.1% |
| `momentumPoints` | 6 (default) | 1.28¢ | 49.8% | 72.1% | 5.04¢ / 9.59¢ | 67.8% / 52.6% | 40.1% |
| `momentumPoints` | 8 | 1.25¢ | 48.6% | 71.6% | 5.05¢ / 9.52¢ | 68.5% / 53.1% | 39.8% |
| `momentumPoints` | 12 | 1.23¢ | 47.6% | 71.5% | 5.10¢ / 9.53¢ | 68.6% / 52.7% | 39.6% |
| `leadLookbackDays` | 5 | 1.28¢ | 49.7% | 73.1% | 4.64¢ / 8.44¢ | 73.3% / 60.3% | 38.6% |
| `leadLookbackDays` | 10 (default) | 1.28¢ | 49.8% | 72.1% | 5.04¢ / 9.59¢ | 67.8% / 52.6% | 40.1% |
| `leadLookbackDays` | 15 | 1.18¢ | 45.9% | 68.9% | 5.63¢ / 11.13¢ | 60.6% / 44.7% | 41.3% |
| `momentumDecayDays` | 5 | 1.28¢ | 49.8% | 71.8% | 4.95¢ / 9.43¢ | 68.7% / 53.8% | 40.2% |
| `momentumDecayDays` | 7 (default) | 1.28¢ | 49.8% | 72.1% | 5.04¢ / 9.59¢ | 67.8% / 52.6% | 40.1% |
| `momentumDecayDays` | 10 | 1.29¢ | 50.0% | 72.1% | 5.14¢ / 9.81¢ | 66.9% / 51.6% | 40.1% |
| `momentumDecayDays` | 14 | 1.28¢ | 49.8% | 71.9% | 5.24¢ / 10.05¢ | 66.0% / 50.4% | 40.4% |
| `momentumDecayDays` | 28 | 1.27¢ | 49.3% | 71.7% | 5.39¢ / 10.54¢ | 64.6% / 48.7% | 40.8% |
| `momentumDecayDays` | Infinity | 1.23¢ | 47.8% | 71.0% | 5.60¢ / 11.38¢ | 62.9% / 45.6% | 40.7% |
| `bandScale` | 1 (default) | 1.28¢ | 49.8% | 72.1% | 5.04¢ / 9.59¢ | 67.8% / 52.6% | 40.1% |
| `bandScale` | 1.25 | 1.28¢ | 49.8% | 72.1% | 5.04¢ / 9.59¢ | 77.7% / 62.2% | 40.1% |
| `bandExponent` | 0.5 (default) | 1.28¢ | 49.8% | 72.1% | 5.04¢ / 9.59¢ | 67.8% / 52.6% | 40.1% |
| `bandExponent` | 0.65 | 1.28¢ | 49.8% | 72.1% | 5.04¢ / 9.59¢ | 67.8% / 57.3% | 40.1% |
| `bandExponent` | 0.8 | 1.28¢ | 49.8% | 72.1% | 5.04¢ / 9.59¢ | 67.8% / 61.7% | 40.1% |
| `bandExponent` | 1 | 1.28¢ | 49.8% | 72.1% | 5.04¢ / 9.59¢ | 67.8% / 67.3% | 40.1% |

## Caveats

- No outlook anchor in the test (see Method), so the 2-week numbers on the live site blend in one more signal than is measured here.
- Weekly area averages, not station prices. A driver who shops around can beat any of these numbers.
- The decision metric assumes the tank can wait a week. If it cannot, only the "now" and "no rush" verdicts apply.
- Past behaviour of gas prices does not guarantee future behaviour. This is a calibration aid, not a promise.
