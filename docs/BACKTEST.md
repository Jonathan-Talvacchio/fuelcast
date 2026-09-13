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
| Default (momentum + wholesale) | 5.60¢ / 5.54¢ | 11.38¢ / 9.17¢ | 62.9% / 45.6% | 71.0% (88.1% called) | 1.23¢ | 47.8% |
| Momentum only | 5.59¢ / 5.54¢ | 9.84¢ / 9.17¢ | 64.5% / 53.1% | 60.8% (75.8% called) | 0.67¢ | 25.9% |

Default verdict mix: fill up now 51.6%, no rush 7.7%, wait 40.7%. "Wait" calls were right 77.1% of the time and saved 3.02¢/gal on average when made. Always waiting a week would have cost 0.39¢/gal relative to always buying now; the oracle saves 2.58¢/gal.

## Per area

| Area | Saved vs always-now | Direction right | 1wk MAE / no-change |
|---|---|---|---|
| Los Angeles | 1.58¢ | 72.3% | 5.80¢ / 5.93¢ |
| California | 1.52¢ | 72.9% | 5.43¢ / 5.65¢ |
| Colorado | 1.47¢ | 69.5% | 6.10¢ / 6.25¢ |
| San Francisco | 1.46¢ | 72.0% | 6.05¢ / 6.12¢ |
| Lower Atlantic | 1.45¢ | 72.7% | 4.79¢ / 4.88¢ |
| West Coast | 1.39¢ | 75.9% | 4.56¢ / 4.91¢ |
| Denver | 1.39¢ | 68.7% | 6.52¢ / 6.69¢ |
| East Coast | 1.38¢ | 76.0% | 4.10¢ / 4.22¢ |
| Chicago | 1.38¢ | 63.2% | 8.38¢ / 8.07¢ |
| Texas | 1.35¢ | 68.5% | 6.08¢ / 6.10¢ |
| Rocky Mountain | 1.34¢ | 73.8% | 4.44¢ / 4.75¢ |
| Florida | 1.33¢ | 66.6% | 7.14¢ / 7.02¢ |
| U.S. average | 1.32¢ | 73.2% | 4.32¢ / 4.29¢ |
| Gulf Coast | 1.32¢ | 70.7% | 5.22¢ / 5.17¢ |
| New England | 1.30¢ | 77.3% | 3.76¢ / 3.80¢ |
| New York City | 1.29¢ | 74.0% | 4.35¢ / 4.36¢ |
| Central Atlantic | 1.28¢ | 77.5% | 4.01¢ / 3.96¢ |
| Minnesota | 1.28¢ | 68.1% | 5.07¢ / 4.83¢ |
| West Coast (excl. California) | 1.25¢ | 76.8% | 3.92¢ / 4.35¢ |
| Washington | 1.23¢ | 75.7% | 4.28¢ / 4.53¢ |
| Midwest | 1.21¢ | 65.0% | 6.19¢ / 5.72¢ |
| Massachusetts | 1.20¢ | 75.9% | 3.89¢ / 3.78¢ |
| New York | 1.19¢ | 76.9% | 3.80¢ / 3.69¢ |
| Boston | 1.15¢ | 76.7% | 3.85¢ / 3.67¢ |
| Seattle | 1.05¢ | 75.3% | 4.19¢ / 4.24¢ |
| Houston | 0.76¢ | 71.7% | 5.98¢ / 5.63¢ |
| Cleveland | 0.72¢ | 56.4% | 10.18¢ / 9.24¢ |
| Miami | 0.66¢ | 65.6% | 7.26¢ / 7.03¢ |
| Ohio | 0.44¢ | 52.1% | 12.85¢ / 11.95¢ |

## Constant sweep (one at a time, others at default)

| Constant | Value | Saved vs always-now | Of oracle | Direction right | MAE 1wk / 2wk | Band 1wk / 2wk | Wait share |
|---|---|---|---|---|---|---|---|
| `passThrough` | 0 | 0.67¢ | 25.9% | 60.8% | 5.59¢ / 9.84¢ | 64.5% / 53.1% | 35.5% |
| `passThrough` | 0.35 | 1.06¢ | 41.1% | 68.9% | 5.25¢ / 9.73¢ | 68.3% / 53.8% | 38.4% |
| `passThrough` | 0.7 (default) | 1.23¢ | 47.8% | 71.0% | 5.60¢ / 11.38¢ | 62.9% / 45.6% | 40.7% |
| `passThrough` | 1 | 1.28¢ | 49.7% | 71.1% | 6.12¢ / 13.14¢ | 56.0% / 38.4% | 42.3% |
| `verdictMove` | 0.01 | 1.23¢ | 47.8% | 70.0% | 5.60¢ / 11.38¢ | 62.9% / 45.6% | 43.7% |
| `verdictMove` | 0.02 (default) | 1.23¢ | 47.8% | 71.0% | 5.60¢ / 11.38¢ | 62.9% / 45.6% | 40.7% |
| `verdictMove` | 0.03 | 1.22¢ | 47.2% | 71.8% | 5.60¢ / 11.38¢ | 62.9% / 45.6% | 38.1% |
| `verdictMove` | 0.05 | 1.19¢ | 46.0% | 73.6% | 5.60¢ / 11.38¢ | 62.9% / 45.6% | 32.8% |
| `momentumPoints` | 4 | 1.29¢ | 50.2% | 72.0% | 5.79¢ / 12.01¢ | 60.5% / 43.4% | 42.6% |
| `momentumPoints` | 6 (default) | 1.23¢ | 47.8% | 71.0% | 5.60¢ / 11.38¢ | 62.9% / 45.6% | 40.7% |
| `momentumPoints` | 8 | 1.18¢ | 45.7% | 70.6% | 5.54¢ / 11.08¢ | 63.9% / 46.9% | 39.6% |
| `momentumPoints` | 12 | 1.10¢ | 42.6% | 69.5% | 5.52¢ / 10.84¢ | 64.6% / 47.9% | 39.4% |
| `leadLookbackDays` | 5 | 1.17¢ | 45.6% | 70.3% | 5.07¢ / 9.75¢ | 68.6% / 53.2% | 39.3% |
| `leadLookbackDays` | 10 (default) | 1.23¢ | 47.8% | 71.0% | 5.60¢ / 11.38¢ | 62.9% / 45.6% | 40.7% |
| `leadLookbackDays` | 15 | 1.10¢ | 42.8% | 68.2% | 6.33¢ / 13.43¢ | 55.6% / 37.4% | 41.6% |
| `momentumDecayDays` | 5 | 1.28¢ | 49.8% | 71.8% | 4.95¢ / 9.43¢ | 68.7% / 53.8% | 40.2% |
| `momentumDecayDays` | 7 | 1.28¢ | 49.8% | 72.1% | 5.04¢ / 9.59¢ | 67.8% / 52.6% | 40.1% |
| `momentumDecayDays` | 10 | 1.29¢ | 50.0% | 72.1% | 5.14¢ / 9.81¢ | 66.9% / 51.6% | 40.1% |
| `momentumDecayDays` | 14 | 1.28¢ | 49.8% | 71.9% | 5.24¢ / 10.05¢ | 66.0% / 50.4% | 40.4% |
| `momentumDecayDays` | 28 | 1.27¢ | 49.3% | 71.7% | 5.39¢ / 10.54¢ | 64.6% / 48.7% | 40.8% |
| `momentumDecayDays` | Infinity (default) | 1.23¢ | 47.8% | 71.0% | 5.60¢ / 11.38¢ | 62.9% / 45.6% | 40.7% |
| `bandScale` | 1 (default) | 1.23¢ | 47.8% | 71.0% | 5.60¢ / 11.38¢ | 62.9% / 45.6% | 40.7% |
| `bandScale` | 1.25 | 1.23¢ | 47.8% | 71.0% | 5.60¢ / 11.38¢ | 72.9% / 54.6% | 40.7% |
| `bandScale` | 1.5 | 1.23¢ | 47.8% | 71.0% | 5.60¢ / 11.38¢ | 80.8% / 62.4% | 40.7% |

## Caveats

- No outlook anchor in the test (see Method), so the 2-week numbers on the live site blend in one more signal than is measured here.
- Weekly area averages, not station prices. A driver who shops around can beat any of these numbers.
- The decision metric assumes the tank can wait a week. If it cannot, only the "now" and "no rush" verdicts apply.
- Past behaviour of gas prices does not guarantee future behaviour. This is a calibration aid, not a promise.
