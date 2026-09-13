# Backtest results

Generated 2026-09-13 by `node scripts/backtest.mjs --sweep --report` on 10 years of EIA history (2016-09-12 → 2026-08-24), evaluated separately for each fuel grade.

## Method

Walk forward one weekly report at a time, giving the model only what existed on that date: retail reports up to the report date and the grade's NY Harbor wholesale spot price (RBOB for gasoline grades, ULSD for diesel) dated on or before it — the same 90-day window the site uses. The EIA outlook anchor is **disabled**: only the current forecast vintage is available, and using it for past dates would leak the future into the test. So this measures the momentum + wholesale-lead core of the model, which drives the tomorrow / this-week / verdict numbers on the site. All grades use the same constants.

- **Forecast MAE** — mean absolute error of the 1- and 2-week-ahead prediction against the actual next reports, next to a "no change" baseline.
- **Band coverage** — share of actual prices that fell inside the uncertainty band (a ±1σ band should catch ≈68%).
- **Direction** — when the model predicts a 14-day move of at least the verdict threshold, how often the actual 2-week change had the same sign.
- **Decision** — a driver who must buy within the week follows the verdict: buy now, or buy next week on "wait". Compared with always-now, always-wait, and a perfect-foresight oracle (min of the two). Savings are in cents per gallon, averaged over every week.

## Summary by grade

| Grade | Decisions · areas | 1wk MAE / no-change | 2wk MAE / no-change | Band 1wk / 2wk | Direction right | Saved vs always-now | Of oracle |
|---|---|---|---|---|---|---|---|
| Regular | 15,083 · 29 | 5.04¢ / 5.54¢ | 9.58¢ / 9.17¢ | 67.7% / 67.3% | 72.1% | 1.28¢ | 49.8% |
| Midgrade | 15,078 · 29 | 5.09¢ / 5.46¢ | 9.57¢ / 8.93¢ | 66.9% / 66.8% | 71.8% | 1.15¢ | 45.9% |
| Premium | 15,077 · 29 | 4.98¢ / 5.39¢ | 9.48¢ / 8.90¢ | 67.2% / 66.6% | 72.3% | 1.16¢ | 47.1% |
| Diesel | 5,722 · 11 | 4.09¢ / 4.56¢ | 8.72¢ / 8.26¢ | 68.6% / 63.4% | 75.0% | 1.27¢ | 64.7% |

## Regular

15,083 weekly decisions across 29 areas, 2016-09-12 → 2026-08-24. Wholesale lead: RBOB.

| Variant | 1wk MAE / no-change | 2wk MAE / no-change | Band 1wk / 2wk | Direction right | Saved vs always-now | Of oracle |
|---|---|---|---|---|---|---|
| Default (momentum + wholesale) | 5.04¢ / 5.54¢ | 9.58¢ / 9.17¢ | 67.7% / 67.3% | 72.1% (87.0% called) | 1.28¢ | 49.8% |
| Momentum only | 5.30¢ / 5.54¢ | 8.80¢ / 9.17¢ | 68.1% / 74.1% | 63.8% (51.0% called) | 0.63¢ | 24.5% |

Verdict mix: fill up now 51.3%, no rush 8.6%, wait 40.1%. "Wait" calls were right 77.6% of the time and saved 3.20¢/gal on average when made. Always waiting a week would have cost 0.39¢/gal relative to always buying now; the oracle saves 2.57¢/gal.

<details><summary>Per area</summary>

| Area | Saved vs always-now | Direction right | 1wk MAE / no-change |
|---|---|---|---|
| Florida | 1.56¢ | 70.9% | 6.53¢ / 7.02¢ |
| Lower Atlantic | 1.56¢ | 75.0% | 4.13¢ / 4.94¢ |
| Chicago | 1.46¢ | 65.7% | 7.61¢ / 8.02¢ |
| Texas | 1.44¢ | 71.9% | 5.42¢ / 6.07¢ |
| East Coast | 1.43¢ | 78.1% | 3.44¢ / 4.25¢ |
| Denver | 1.43¢ | 68.1% | 5.91¢ / 6.65¢ |
| Gulf Coast | 1.43¢ | 74.2% | 4.54¢ / 5.19¢ |
| California | 1.42¢ | 71.4% | 4.97¢ / 5.66¢ |
| Colorado | 1.41¢ | 69.2% | 5.58¢ / 6.29¢ |
| Los Angeles | 1.41¢ | 70.3% | 5.30¢ / 5.91¢ |
| San Francisco | 1.35¢ | 70.5% | 5.56¢ / 6.11¢ |
| New York City | 1.35¢ | 76.0% | 3.78¢ / 4.36¢ |
| New England | 1.34¢ | 78.2% | 3.17¢ / 3.82¢ |
| Miami | 1.34¢ | 70.7% | 6.63¢ / 7.00¢ |
| U.S. average | 1.34¢ | 75.3% | 3.65¢ / 4.25¢ |
| Midwest | 1.33¢ | 67.7% | 5.43¢ / 5.64¢ |
| Central Atlantic | 1.30¢ | 78.8% | 3.39¢ / 3.98¢ |
| Rocky Mountain | 1.27¢ | 71.9% | 4.08¢ / 4.75¢ |
| West Coast | 1.26¢ | 74.0% | 4.15¢ / 4.91¢ |
| Minnesota | 1.24¢ | 71.2% | 4.38¢ / 4.75¢ |
| Massachusetts | 1.24¢ | 76.5% | 3.34¢ / 3.77¢ |
| New York | 1.18¢ | 77.6% | 3.37¢ / 3.69¢ |
| West Coast (excl. California) | 1.17¢ | 74.9% | 3.63¢ / 4.40¢ |
| Boston | 1.17¢ | 76.4% | 3.36¢ / 3.62¢ |
| Washington | 1.14¢ | 74.0% | 3.93¢ / 4.52¢ |
| Cleveland | 1.10¢ | 58.1% | 9.54¢ / 9.20¢ |
| Seattle | 0.99¢ | 73.6% | 3.88¢ / 4.29¢ |
| Ohio | 0.77¢ | 56.6% | 12.16¢ / 11.95¢ |
| Houston | 0.76¢ | 74.2% | 5.29¢ / 5.62¢ |

</details>

<details><summary>Constant sweep (one at a time, others at default)</summary>

| Constant | Value | Saved vs always-now | Of oracle | Direction right | MAE 1wk / 2wk | Band 1wk / 2wk | Wait share |
|---|---|---|---|---|---|---|---|
| `passThrough` | 0 | 0.63¢ | 24.5% | 63.8% | 5.30¢ / 8.80¢ | 68.1% / 74.1% | 23.1% |
| `passThrough` | 0.35 | 1.22¢ | 47.5% | 73.3% | 4.76¢ / 8.03¢ | 73.6% / 78.4% | 35.3% |
| `passThrough` | 0.7 (default) | 1.28¢ | 49.8% | 72.1% | 5.04¢ / 9.58¢ | 67.7% / 67.3% | 40.1% |
| `passThrough` | 1 | 1.29¢ | 50.2% | 71.0% | 5.55¢ / 11.40¢ | 60.7% / 57.5% | 42.1% |
| `verdictMove` | 0.01 | 1.29¢ | 50.3% | 70.6% | 5.04¢ / 9.58¢ | 67.7% / 67.3% | 43.3% |
| `verdictMove` | 0.02 (default) | 1.28¢ | 49.8% | 72.1% | 5.04¢ / 9.58¢ | 67.7% / 67.3% | 40.1% |
| `verdictMove` | 0.03 | 1.26¢ | 49.1% | 73.1% | 5.04¢ / 9.58¢ | 67.7% / 67.3% | 36.9% |
| `verdictMove` | 0.05 | 1.19¢ | 46.3% | 75.3% | 5.04¢ / 9.58¢ | 67.7% / 67.3% | 30.9% |
| `momentumPoints` | 4 | 1.30¢ | 50.7% | 72.4% | 5.12¢ / 9.79¢ | 66.4% / 66.1% | 41.1% |
| `momentumPoints` | 6 (default) | 1.28¢ | 49.8% | 72.1% | 5.04¢ / 9.58¢ | 67.7% / 67.3% | 40.1% |
| `momentumPoints` | 8 | 1.25¢ | 48.6% | 71.7% | 5.04¢ / 9.52¢ | 68.4% / 68.2% | 39.8% |
| `momentumPoints` | 12 | 1.23¢ | 47.7% | 71.5% | 5.10¢ / 9.53¢ | 68.5% / 68.4% | 39.6% |
| `leadLookbackDays` | 5 | 1.28¢ | 49.8% | 73.2% | 4.64¢ / 8.44¢ | 73.2% / 74.7% | 38.6% |
| `leadLookbackDays` | 10 (default) | 1.28¢ | 49.8% | 72.1% | 5.04¢ / 9.58¢ | 67.7% / 67.3% | 40.1% |
| `leadLookbackDays` | 15 | 1.18¢ | 45.9% | 69.0% | 5.63¢ / 11.13¢ | 60.6% / 58.3% | 41.3% |
| `momentumDecayDays` | 5 | 1.28¢ | 49.9% | 71.8% | 4.94¢ / 9.43¢ | 68.6% / 68.3% | 40.2% |
| `momentumDecayDays` | 7 (default) | 1.28¢ | 49.8% | 72.1% | 5.04¢ / 9.58¢ | 67.7% / 67.3% | 40.1% |
| `momentumDecayDays` | 10 | 1.29¢ | 50.0% | 72.2% | 5.14¢ / 9.80¢ | 66.8% / 66.3% | 40.1% |
| `momentumDecayDays` | 14 | 1.28¢ | 49.9% | 71.9% | 5.24¢ / 10.04¢ | 66.0% / 65.2% | 40.4% |
| `momentumDecayDays` | 28 | 1.27¢ | 49.4% | 71.7% | 5.39¢ / 10.54¢ | 64.5% / 63.4% | 40.8% |
| `momentumDecayDays` | Infinity | 1.23¢ | 47.7% | 71.0% | 5.60¢ / 11.38¢ | 62.8% / 59.8% | 40.7% |
| `bandScale` | 1 (default) | 1.28¢ | 49.8% | 72.1% | 5.04¢ / 9.58¢ | 67.7% / 67.3% | 40.1% |
| `bandScale` | 1.25 | 1.28¢ | 49.8% | 72.1% | 5.04¢ / 9.58¢ | 77.7% / 76.7% | 40.1% |
| `bandExponent` | 0.5 | 1.28¢ | 49.8% | 72.1% | 5.04¢ / 9.58¢ | 67.7% / 52.7% | 40.1% |
| `bandExponent` | 0.65 | 1.28¢ | 49.8% | 72.1% | 5.04¢ / 9.58¢ | 67.7% / 57.4% | 40.1% |
| `bandExponent` | 0.8 | 1.28¢ | 49.8% | 72.1% | 5.04¢ / 9.58¢ | 67.7% / 61.8% | 40.1% |
| `bandExponent` | 1 (default) | 1.28¢ | 49.8% | 72.1% | 5.04¢ / 9.58¢ | 67.7% / 67.3% | 40.1% |

</details>

## Midgrade

15,078 weekly decisions across 29 areas, 2016-09-12 → 2026-08-24. Wholesale lead: RBOB.

| Variant | 1wk MAE / no-change | 2wk MAE / no-change | Band 1wk / 2wk | Direction right | Saved vs always-now | Of oracle |
|---|---|---|---|---|---|---|
| Default (momentum + wholesale) | 5.09¢ / 5.46¢ | 9.57¢ / 8.93¢ | 66.9% / 66.8% | 71.8% (87.0% called) | 1.15¢ | 45.9% |
| Momentum only | 5.26¢ / 5.46¢ | 8.59¢ / 8.93¢ | 68.3% / 75.2% | 63.6% (49.2% called) | 0.55¢ | 22.0% |

Verdict mix: fill up now 51.2%, no rush 8.8%, wait 39.9%. "Wait" calls were right 76.0% of the time and saved 2.89¢/gal on average when made. Always waiting a week would have cost 0.43¢/gal relative to always buying now; the oracle saves 2.51¢/gal.

<details><summary>Per area</summary>

| Area | Saved vs always-now | Direction right | 1wk MAE / no-change |
|---|---|---|---|
| Florida | 1.52¢ | 70.8% | 6.47¢ / 6.92¢ |
| Lower Atlantic | 1.47¢ | 75.9% | 3.97¢ / 4.72¢ |
| California | 1.39¢ | 71.9% | 5.00¢ / 5.58¢ |
| Colorado | 1.38¢ | 68.9% | 5.93¢ / 6.54¢ |
| Gulf Coast | 1.38¢ | 75.0% | 4.51¢ / 5.08¢ |
| Texas | 1.37¢ | 72.4% | 5.46¢ / 6.03¢ |
| San Francisco | 1.36¢ | 68.9% | 5.50¢ / 6.03¢ |
| Los Angeles | 1.36¢ | 70.9% | 5.38¢ / 5.85¢ |
| Denver | 1.35¢ | 68.2% | 6.07¢ / 6.69¢ |
| East Coast | 1.32¢ | 77.1% | 3.35¢ / 4.01¢ |
| U.S. average | 1.29¢ | 76.9% | 3.48¢ / 4.04¢ |
| Midwest | 1.27¢ | 66.3% | 5.61¢ / 5.76¢ |
| Miami | 1.27¢ | 69.7% | 6.74¢ / 6.91¢ |
| West Coast | 1.24¢ | 74.1% | 4.29¢ / 4.93¢ |
| Minnesota | 1.22¢ | 70.9% | 4.52¢ / 4.85¢ |
| Rocky Mountain | 1.21¢ | 70.8% | 4.46¢ / 5.09¢ |
| Central Atlantic | 1.20¢ | 76.7% | 3.38¢ / 3.83¢ |
| New York City | 1.18¢ | 74.9% | 3.71¢ / 4.07¢ |
| West Coast (excl. California) | 1.12¢ | 75.2% | 3.55¢ / 4.22¢ |
| Washington | 1.12¢ | 76.8% | 3.83¢ / 4.29¢ |
| New York | 1.09¢ | 75.4% | 3.50¢ / 3.69¢ |
| New England | 1.08¢ | 77.4% | 3.03¢ / 3.29¢ |
| Cleveland | 0.98¢ | 57.6% | 8.71¢ / 8.32¢ |
| Massachusetts | 0.96¢ | 75.3% | 3.19¢ / 3.24¢ |
| Seattle | 0.88¢ | 73.9% | 3.87¢ / 4.02¢ |
| Ohio | 0.75¢ | 56.6% | 11.75¢ / 11.55¢ |
| Chicago | 0.70¢ | 63.7% | 8.77¢ / 9.07¢ |
| Houston | 0.52¢ | 73.4% | 5.34¢ / 5.50¢ |
| Boston | 0.44¢ | 75.8% | 4.33¢ / 4.16¢ |

</details>

<details><summary>Constant sweep (one at a time, others at default)</summary>

| Constant | Value | Saved vs always-now | Of oracle | Direction right | MAE 1wk / 2wk | Band 1wk / 2wk | Wait share |
|---|---|---|---|---|---|---|---|
| `passThrough` | 0 | 0.55¢ | 22.0% | 63.6% | 5.26¢ / 8.59¢ | 68.3% / 75.2% | 21.9% |
| `passThrough` | 0.35 | 1.09¢ | 43.3% | 73.4% | 4.77¢ / 7.93¢ | 73.1% / 78.5% | 34.5% |
| `passThrough` | 0.7 (default) | 1.15¢ | 45.9% | 71.8% | 5.09¢ / 9.57¢ | 66.9% / 66.8% | 39.9% |
| `passThrough` | 1 | 1.18¢ | 47.0% | 70.8% | 5.63¢ / 11.44¢ | 59.4% / 56.2% | 41.9% |
| `verdictMove` | 0.01 | 1.16¢ | 46.2% | 70.6% | 5.09¢ / 9.57¢ | 66.9% / 66.8% | 43.2% |
| `verdictMove` | 0.02 (default) | 1.15¢ | 45.9% | 71.8% | 5.09¢ / 9.57¢ | 66.9% / 66.8% | 39.9% |
| `verdictMove` | 0.03 | 1.13¢ | 44.9% | 73.0% | 5.09¢ / 9.57¢ | 66.9% / 66.8% | 36.7% |
| `verdictMove` | 0.05 | 1.09¢ | 43.3% | 74.9% | 5.09¢ / 9.57¢ | 66.9% / 66.8% | 30.6% |
| `momentumPoints` | 4 | 1.19¢ | 47.2% | 72.0% | 5.18¢ / 9.77¢ | 65.1% / 65.4% | 40.7% |
| `momentumPoints` | 6 (default) | 1.15¢ | 45.9% | 71.8% | 5.09¢ / 9.57¢ | 66.9% / 66.8% | 39.9% |
| `momentumPoints` | 8 | 1.12¢ | 44.5% | 71.5% | 5.10¢ / 9.51¢ | 67.4% / 67.4% | 39.4% |
| `momentumPoints` | 12 | 1.09¢ | 43.6% | 71.3% | 5.15¢ / 9.53¢ | 67.7% / 67.6% | 39.3% |
| `leadLookbackDays` | 5 | 1.13¢ | 45.0% | 72.7% | 4.68¢ / 8.39¢ | 72.4% / 74.3% | 38.1% |
| `leadLookbackDays` | 10 (default) | 1.15¢ | 45.9% | 71.8% | 5.09¢ / 9.57¢ | 66.9% / 66.8% | 39.9% |
| `leadLookbackDays` | 15 | 1.09¢ | 43.3% | 69.1% | 5.67¢ / 11.10¢ | 59.5% / 57.6% | 41.2% |
| `momentumDecayDays` | 5 | 1.17¢ | 46.6% | 71.7% | 5.00¢ / 9.43¢ | 67.8% / 67.3% | 39.9% |
| `momentumDecayDays` | 7 (default) | 1.15¢ | 45.9% | 71.8% | 5.09¢ / 9.57¢ | 66.9% / 66.8% | 39.9% |
| `momentumDecayDays` | 10 | 1.15¢ | 45.8% | 71.9% | 5.19¢ / 9.78¢ | 65.9% / 65.9% | 39.8% |
| `momentumDecayDays` | 14 | 1.15¢ | 45.8% | 71.7% | 5.28¢ / 10.01¢ | 65.0% / 64.8% | 40.0% |
| `momentumDecayDays` | 28 | 1.13¢ | 45.0% | 71.4% | 5.43¢ / 10.48¢ | 63.7% / 62.8% | 40.2% |
| `momentumDecayDays` | Infinity | 1.10¢ | 43.7% | 70.9% | 5.63¢ / 11.27¢ | 62.0% / 59.6% | 40.3% |
| `bandScale` | 1 (default) | 1.15¢ | 45.9% | 71.8% | 5.09¢ / 9.57¢ | 66.9% / 66.8% | 39.9% |
| `bandScale` | 1.25 | 1.15¢ | 45.9% | 71.8% | 5.09¢ / 9.57¢ | 76.9% / 75.7% | 39.9% |
| `bandExponent` | 0.5 | 1.15¢ | 45.9% | 71.8% | 5.09¢ / 9.57¢ | 66.9% / 51.6% | 39.9% |
| `bandExponent` | 0.65 | 1.15¢ | 45.9% | 71.8% | 5.09¢ / 9.57¢ | 66.9% / 56.2% | 39.9% |
| `bandExponent` | 0.8 | 1.15¢ | 45.9% | 71.8% | 5.09¢ / 9.57¢ | 66.9% / 60.9% | 39.9% |
| `bandExponent` | 1 (default) | 1.15¢ | 45.9% | 71.8% | 5.09¢ / 9.57¢ | 66.9% / 66.8% | 39.9% |

</details>

## Premium

15,077 weekly decisions across 29 areas, 2016-09-12 → 2026-08-24. Wholesale lead: RBOB.

| Variant | 1wk MAE / no-change | 2wk MAE / no-change | Band 1wk / 2wk | Direction right | Saved vs always-now | Of oracle |
|---|---|---|---|---|---|---|
| Default (momentum + wholesale) | 4.98¢ / 5.39¢ | 9.48¢ / 8.90¢ | 67.2% / 66.6% | 72.3% (86.9% called) | 1.16¢ | 47.1% |
| Momentum only | 5.17¢ / 5.39¢ | 8.53¢ / 8.90¢ | 68.1% / 74.8% | 64.7% (49.1% called) | 0.59¢ | 24.0% |

Verdict mix: fill up now 51.2%, no rush 8.9%, wait 39.9%. "Wait" calls were right 76.4% of the time and saved 2.91¢/gal on average when made. Always waiting a week would have cost 0.46¢/gal relative to always buying now; the oracle saves 2.47¢/gal.

<details><summary>Per area</summary>

| Area | Saved vs always-now | Direction right | 1wk MAE / no-change |
|---|---|---|---|
| Florida | 1.49¢ | 70.7% | 6.05¢ / 6.50¢ |
| Lower Atlantic | 1.43¢ | 74.9% | 3.90¢ / 4.59¢ |
| California | 1.38¢ | 71.2% | 5.09¢ / 5.77¢ |
| Los Angeles | 1.37¢ | 70.2% | 5.39¢ / 5.90¢ |
| Denver | 1.37¢ | 69.4% | 5.65¢ / 6.37¢ |
| Gulf Coast | 1.36¢ | 75.3% | 4.55¢ / 5.12¢ |
| Texas | 1.36¢ | 72.3% | 5.36¢ / 5.92¢ |
| Colorado | 1.36¢ | 69.9% | 5.55¢ / 6.23¢ |
| East Coast | 1.30¢ | 76.8% | 3.30¢ / 3.96¢ |
| Midwest | 1.29¢ | 68.1% | 5.34¢ / 5.68¢ |
| West Coast | 1.28¢ | 73.2% | 4.38¢ / 5.10¢ |
| San Francisco | 1.28¢ | 68.9% | 5.47¢ / 6.00¢ |
| U.S. average | 1.27¢ | 77.2% | 3.46¢ / 4.04¢ |
| Rocky Mountain | 1.23¢ | 74.0% | 4.03¢ / 4.70¢ |
| New York City | 1.22¢ | 76.0% | 3.73¢ / 4.16¢ |
| Central Atlantic | 1.21¢ | 77.5% | 3.42¢ / 3.91¢ |
| Minnesota | 1.17¢ | 71.4% | 4.25¢ / 4.63¢ |
| Miami | 1.14¢ | 69.7% | 6.23¢ / 6.33¢ |
| Washington | 1.11¢ | 74.3% | 3.83¢ / 4.43¢ |
| West Coast (excl. California) | 1.11¢ | 74.8% | 3.55¢ / 4.25¢ |
| New York | 1.10¢ | 77.1% | 3.56¢ / 3.80¢ |
| New England | 1.09¢ | 79.5% | 3.03¢ / 3.35¢ |
| Cleveland | 1.01¢ | 58.9% | 8.81¢ / 8.40¢ |
| Boston | 0.98¢ | 77.3% | 3.29¢ / 3.26¢ |
| Massachusetts | 0.96¢ | 78.7% | 3.23¢ / 3.29¢ |
| Seattle | 0.93¢ | 73.7% | 3.93¢ / 4.35¢ |
| Ohio | 0.84¢ | 55.9% | 11.60¢ / 11.37¢ |
| Chicago | 0.50¢ | 65.7% | 9.13¢ / 9.38¢ |
| Houston | 0.50¢ | 74.7% | 5.42¢ / 5.66¢ |

</details>

<details><summary>Constant sweep (one at a time, others at default)</summary>

| Constant | Value | Saved vs always-now | Of oracle | Direction right | MAE 1wk / 2wk | Band 1wk / 2wk | Wait share |
|---|---|---|---|---|---|---|---|
| `passThrough` | 0 | 0.59¢ | 24.0% | 64.7% | 5.17¢ / 8.53¢ | 68.1% / 74.8% | 21.8% |
| `passThrough` | 0.35 | 1.11¢ | 44.9% | 73.8% | 4.66¢ / 7.82¢ | 73.2% / 78.4% | 34.7% |
| `passThrough` | 0.7 (default) | 1.16¢ | 47.1% | 72.3% | 4.98¢ / 9.48¢ | 67.2% / 66.6% | 39.9% |
| `passThrough` | 1 | 1.20¢ | 48.5% | 71.2% | 5.53¢ / 11.35¢ | 59.6% / 56.1% | 42.0% |
| `verdictMove` | 0.01 | 1.17¢ | 47.5% | 71.0% | 4.98¢ / 9.48¢ | 67.2% / 66.6% | 43.1% |
| `verdictMove` | 0.02 (default) | 1.16¢ | 47.1% | 72.3% | 4.98¢ / 9.48¢ | 67.2% / 66.6% | 39.9% |
| `verdictMove` | 0.03 | 1.14¢ | 46.1% | 73.2% | 4.98¢ / 9.48¢ | 67.2% / 66.6% | 36.8% |
| `verdictMove` | 0.05 | 1.10¢ | 44.6% | 75.5% | 4.98¢ / 9.48¢ | 67.2% / 66.6% | 30.6% |
| `momentumPoints` | 4 | 1.19¢ | 48.4% | 72.6% | 5.06¢ / 9.68¢ | 65.5% / 65.2% | 40.8% |
| `momentumPoints` | 6 (default) | 1.16¢ | 47.1% | 72.3% | 4.98¢ / 9.48¢ | 67.2% / 66.6% | 39.9% |
| `momentumPoints` | 8 | 1.13¢ | 45.8% | 72.0% | 4.99¢ / 9.43¢ | 67.8% / 67.1% | 39.3% |
| `momentumPoints` | 12 | 1.12¢ | 45.2% | 71.9% | 5.05¢ / 9.45¢ | 67.7% / 67.4% | 39.3% |
| `leadLookbackDays` | 5 | 1.14¢ | 46.2% | 73.0% | 4.58¢ / 8.31¢ | 72.5% / 74.5% | 38.0% |
| `leadLookbackDays` | 10 (default) | 1.16¢ | 47.1% | 72.3% | 4.98¢ / 9.48¢ | 67.2% / 66.6% | 39.9% |
| `leadLookbackDays` | 15 | 1.11¢ | 45.2% | 69.5% | 5.57¢ / 11.01¢ | 59.7% / 57.5% | 41.2% |
| `momentumDecayDays` | 5 | 1.19¢ | 48.1% | 72.1% | 4.90¢ / 9.34¢ | 68.2% / 67.2% | 39.9% |
| `momentumDecayDays` | 7 (default) | 1.16¢ | 47.1% | 72.3% | 4.98¢ / 9.48¢ | 67.2% / 66.6% | 39.9% |
| `momentumDecayDays` | 10 | 1.16¢ | 47.2% | 72.4% | 5.08¢ / 9.68¢ | 66.2% / 65.6% | 39.7% |
| `momentumDecayDays` | 14 | 1.16¢ | 47.1% | 72.2% | 5.17¢ / 9.91¢ | 65.4% / 64.3% | 39.9% |
| `momentumDecayDays` | 28 | 1.14¢ | 46.2% | 72.0% | 5.31¢ / 10.37¢ | 63.8% / 62.2% | 40.3% |
| `momentumDecayDays` | Infinity | 1.11¢ | 45.1% | 71.4% | 5.51¢ / 11.17¢ | 62.2% / 59.2% | 40.1% |
| `bandScale` | 1 (default) | 1.16¢ | 47.1% | 72.3% | 4.98¢ / 9.48¢ | 67.2% / 66.6% | 39.9% |
| `bandScale` | 1.25 | 1.16¢ | 47.1% | 72.3% | 4.98¢ / 9.48¢ | 77.0% / 75.3% | 39.9% |
| `bandExponent` | 0.5 | 1.16¢ | 47.1% | 72.3% | 4.98¢ / 9.48¢ | 67.2% / 51.9% | 39.9% |
| `bandExponent` | 0.65 | 1.16¢ | 47.1% | 72.3% | 4.98¢ / 9.48¢ | 67.2% / 56.2% | 39.9% |
| `bandExponent` | 0.8 | 1.16¢ | 47.1% | 72.3% | 4.98¢ / 9.48¢ | 67.2% / 61.0% | 39.9% |
| `bandExponent` | 1 (default) | 1.16¢ | 47.1% | 72.3% | 4.98¢ / 9.48¢ | 67.2% / 66.6% | 39.9% |

</details>

## Diesel

5,722 weekly decisions across 11 areas, 2016-09-12 → 2026-08-24. Wholesale lead: ULSD.

| Variant | 1wk MAE / no-change | 2wk MAE / no-change | Band 1wk / 2wk | Direction right | Saved vs always-now | Of oracle |
|---|---|---|---|---|---|---|
| Default (momentum + wholesale) | 4.09¢ / 4.56¢ | 8.72¢ / 8.26¢ | 68.6% / 63.4% | 75.0% (83.4% called) | 1.27¢ | 64.7% |
| Momentum only | 4.25¢ / 4.56¢ | 7.80¢ / 8.26¢ | 72.3% / 74.2% | 70.3% (44.6% called) | 0.64¢ | 32.7% |

Verdict mix: fill up now 50.1%, no rush 11.6%, wait 38.3%. "Wait" calls were right 81.2% of the time and saved 3.31¢/gal on average when made. Always waiting a week would have cost 0.64¢/gal relative to always buying now; the oracle saves 1.96¢/gal.

<details><summary>Per area</summary>

| Area | Saved vs always-now | Direction right | 1wk MAE / no-change |
|---|---|---|---|
| Midwest | 1.34¢ | 71.2% | 4.64¢ / 5.16¢ |
| California | 1.31¢ | 75.5% | 4.29¢ / 4.70¢ |
| West Coast | 1.30¢ | 76.2% | 4.20¢ / 4.73¢ |
| Gulf Coast | 1.29¢ | 71.2% | 4.44¢ / 4.87¢ |
| U.S. average | 1.28¢ | 73.5% | 4.04¢ / 4.59¢ |
| West Coast (excl. California) | 1.28¢ | 74.9% | 4.49¢ / 5.05¢ |
| Central Atlantic | 1.25¢ | 79.1% | 3.43¢ / 3.94¢ |
| Lower Atlantic | 1.25¢ | 74.4% | 4.23¢ / 4.61¢ |
| Rocky Mountain | 1.23¢ | 74.3% | 4.11¢ / 4.60¢ |
| East Coast | 1.23¢ | 76.3% | 3.77¢ / 4.25¢ |
| New England | 1.19¢ | 78.4% | 3.39¢ / 3.66¢ |

</details>

<details><summary>Constant sweep (one at a time, others at default)</summary>

| Constant | Value | Saved vs always-now | Of oracle | Direction right | MAE 1wk / 2wk | Band 1wk / 2wk | Wait share |
|---|---|---|---|---|---|---|---|
| `passThrough` | 0 | 0.64¢ | 32.7% | 70.3% | 4.25¢ / 7.80¢ | 72.3% / 74.2% | 20.7% |
| `passThrough` | 0.35 | 1.16¢ | 59.3% | 76.4% | 3.65¢ / 7.06¢ | 78.4% / 78.7% | 32.7% |
| `passThrough` | 0.7 (default) | 1.27¢ | 64.7% | 75.0% | 4.09¢ / 8.72¢ | 68.6% / 63.4% | 38.3% |
| `passThrough` | 1 | 1.27¢ | 64.7% | 74.8% | 4.71¢ / 10.44¢ | 59.0% / 52.3% | 40.6% |
| `verdictMove` | 0.01 | 1.29¢ | 65.9% | 74.3% | 4.09¢ / 8.72¢ | 68.6% / 63.4% | 41.7% |
| `verdictMove` | 0.02 (default) | 1.27¢ | 64.7% | 75.0% | 4.09¢ / 8.72¢ | 68.6% / 63.4% | 38.3% |
| `verdictMove` | 0.03 | 1.22¢ | 62.5% | 75.8% | 4.09¢ / 8.72¢ | 68.6% / 63.4% | 33.6% |
| `verdictMove` | 0.05 | 1.15¢ | 58.7% | 77.3% | 4.09¢ / 8.72¢ | 68.6% / 63.4% | 28.3% |
| `momentumPoints` | 4 | 1.29¢ | 65.7% | 75.0% | 4.25¢ / 9.02¢ | 66.3% / 62.0% | 38.7% |
| `momentumPoints` | 6 (default) | 1.27¢ | 64.7% | 75.0% | 4.09¢ / 8.72¢ | 68.6% / 63.4% | 38.3% |
| `momentumPoints` | 8 | 1.24¢ | 63.4% | 74.6% | 4.04¢ / 8.58¢ | 69.4% / 63.9% | 37.6% |
| `momentumPoints` | 12 | 1.22¢ | 62.3% | 73.8% | 4.09¢ / 8.61¢ | 70.2% / 64.2% | 37.4% |
| `leadLookbackDays` | 5 | 1.25¢ | 63.8% | 74.1% | 3.67¢ / 7.48¢ | 75.9% / 72.9% | 37.3% |
| `leadLookbackDays` | 10 (default) | 1.27¢ | 64.7% | 75.0% | 4.09¢ / 8.72¢ | 68.6% / 63.4% | 38.3% |
| `leadLookbackDays` | 15 | 1.13¢ | 57.5% | 72.8% | 4.87¢ / 10.58¢ | 59.8% / 53.3% | 40.2% |
| `momentumDecayDays` | 5 | 1.26¢ | 64.3% | 74.9% | 4.01¢ / 8.57¢ | 69.2% / 64.4% | 37.9% |
| `momentumDecayDays` | 7 (default) | 1.27¢ | 64.7% | 75.0% | 4.09¢ / 8.72¢ | 68.6% / 63.4% | 38.3% |
| `momentumDecayDays` | 10 | 1.23¢ | 62.7% | 75.1% | 4.19¢ / 8.93¢ | 67.4% / 62.4% | 38.3% |
| `momentumDecayDays` | 14 | 1.21¢ | 61.9% | 75.1% | 4.27¢ / 9.15¢ | 66.8% / 61.4% | 38.0% |
| `momentumDecayDays` | 28 | 1.20¢ | 61.5% | 74.5% | 4.41¢ / 9.60¢ | 65.5% / 59.1% | 37.8% |
| `momentumDecayDays` | Infinity | 1.17¢ | 59.5% | 73.7% | 4.60¢ / 10.35¢ | 63.4% / 55.8% | 38.1% |
| `bandScale` | 1 (default) | 1.27¢ | 64.7% | 75.0% | 4.09¢ / 8.72¢ | 68.6% / 63.4% | 38.3% |
| `bandScale` | 1.25 | 1.27¢ | 64.7% | 75.0% | 4.09¢ / 8.72¢ | 77.7% / 72.2% | 38.3% |
| `bandExponent` | 0.5 | 1.27¢ | 64.7% | 75.0% | 4.09¢ / 8.72¢ | 68.6% / 49.5% | 38.3% |
| `bandExponent` | 0.65 | 1.27¢ | 64.7% | 75.0% | 4.09¢ / 8.72¢ | 68.6% / 54.2% | 38.3% |
| `bandExponent` | 0.8 | 1.27¢ | 64.7% | 75.0% | 4.09¢ / 8.72¢ | 68.6% / 58.1% | 38.3% |
| `bandExponent` | 1 (default) | 1.27¢ | 64.7% | 75.0% | 4.09¢ / 8.72¢ | 68.6% / 63.4% | 38.3% |

</details>

## Caveats

- No outlook anchor in the test (see Method), so the 2-week numbers on the live site blend in one more signal than is measured here.
- Weekly area averages, not station prices. A driver who shops around can beat any of these numbers.
- Diesel is reported for the U.S., the regions and California only (11 areas), so its sample is smaller and more regional.
- The decision metric assumes the tank can wait a week. If it cannot, only the "now" and "no rush" verdicts apply.
- Past behaviour of gas prices does not guarantee future behaviour. This is a calibration aid, not a promise.
