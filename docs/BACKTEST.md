# Backtest results

Generated 2026-09-25 by `node scripts/backtest.mjs --sweep --report` on 10 years of EIA history (2016-09-26 → 2026-09-07), evaluated separately for each fuel grade.

## Method

Walk forward one weekly report at a time, giving the model only what existed on that date: retail reports up to the report date and the grade's NY Harbor wholesale spot price (RBOB for gasoline grades, ULSD for diesel) dated on or before it — the same 90-day window the site uses. The EIA outlook anchor is **disabled**: only the current forecast vintage is available, and using it for past dates would leak the future into the test. So this measures the momentum + wholesale-lead core of the model, which drives the tomorrow / this-week / verdict numbers on the site. All grades use the same constants.

- **Forecast MAE** — mean absolute error of the 1- and 2-week-ahead prediction against the actual next reports, next to a "no change" baseline.
- **Band coverage** — share of actual prices that fell inside the uncertainty band (a ±1σ band should catch ≈68%).
- **Direction** — when the model predicts a 14-day move of at least the verdict threshold, how often the actual 2-week change had the same sign.
- **Decision** — a driver who must buy within the week follows the verdict: buy now, or buy next week on "wait". Compared with always-now, always-wait, and a perfect-foresight oracle (min of the two). Savings are in cents per gallon, averaged over every week.

## Summary by grade

| Grade | Decisions · areas | 1wk MAE / no-change | 2wk MAE / no-change | Band 1wk / 2wk | Direction right | Saved vs always-now | Of oracle |
|---|---|---|---|---|---|---|---|
| Regular | 15,083 · 29 | 5.06¢ / 5.57¢ | 9.65¢ / 9.25¢ | 67.8% / 67.3% | 72.0% | 1.26¢ | 48.9% |
| Midgrade | 15,078 · 29 | 5.11¢ / 5.49¢ | 9.63¢ / 9.01¢ | 67.0% / 66.8% | 71.7% | 1.13¢ | 45.0% |
| Premium | 15,077 · 29 | 5.00¢ / 5.42¢ | 9.54¢ / 8.98¢ | 67.2% / 66.5% | 72.2% | 1.14¢ | 46.2% |
| Diesel | 5,722 · 11 | 4.20¢ / 4.69¢ | 8.91¢ / 8.48¢ | 68.4% / 63.1% | 75.0% | 1.26¢ | 64.6% |

## Regular

15,083 weekly decisions across 29 areas, 2016-09-26 → 2026-09-07. Wholesale lead: RBOB.

| Variant | 1wk MAE / no-change | 2wk MAE / no-change | Band 1wk / 2wk | Direction right | Saved vs always-now | Of oracle |
|---|---|---|---|---|---|---|
| Default (momentum + wholesale) | 5.06¢ / 5.57¢ | 9.65¢ / 9.25¢ | 67.8% / 67.3% | 72.0% (87.0% called) | 1.26¢ | 48.9% |
| Momentum only | 5.33¢ / 5.57¢ | 8.88¢ / 9.25¢ | 68.0% / 73.9% | 63.9% (51.1% called) | 0.63¢ | 24.5% |

Verdict mix: fill up now 50.9%, no rush 8.8%, wait 40.3%. "Wait" calls were right 77.4% of the time and saved 3.12¢/gal on average when made. Always waiting a week would have cost 0.43¢/gal relative to always buying now; the oracle saves 2.57¢/gal.

<details><summary>Per area</summary>

| Area | Saved vs always-now | Direction right | 1wk MAE / no-change |
|---|---|---|---|
| Lower Atlantic | 1.53¢ | 74.2% | 4.12¢ / 4.93¢ |
| Florida | 1.52¢ | 71.1% | 6.57¢ / 7.06¢ |
| Chicago | 1.44¢ | 65.7% | 7.62¢ / 8.04¢ |
| Denver | 1.41¢ | 68.4% | 5.94¢ / 6.67¢ |
| East Coast | 1.40¢ | 77.9% | 3.47¢ / 4.28¢ |
| Texas | 1.40¢ | 71.9% | 5.47¢ / 6.10¢ |
| Gulf Coast | 1.40¢ | 74.2% | 4.56¢ / 5.23¢ |
| California | 1.40¢ | 71.1% | 5.00¢ / 5.72¢ |
| Colorado | 1.39¢ | 69.6% | 5.60¢ / 6.27¢ |
| Los Angeles | 1.39¢ | 70.3% | 5.32¢ / 5.96¢ |
| New England | 1.32¢ | 78.0% | 3.18¢ / 3.86¢ |
| New York City | 1.32¢ | 75.8% | 3.82¢ / 4.41¢ |
| San Francisco | 1.31¢ | 70.5% | 5.60¢ / 6.18¢ |
| U.S. average | 1.31¢ | 74.5% | 3.69¢ / 4.29¢ |
| Miami | 1.30¢ | 70.7% | 6.66¢ / 7.04¢ |
| Central Atlantic | 1.27¢ | 78.6% | 3.42¢ / 4.03¢ |
| Midwest | 1.27¢ | 67.0% | 5.48¢ / 5.69¢ |
| Rocky Mountain | 1.24¢ | 72.2% | 4.10¢ / 4.78¢ |
| West Coast | 1.24¢ | 73.8% | 4.17¢ / 4.96¢ |
| Minnesota | 1.23¢ | 70.8% | 4.41¢ / 4.80¢ |
| Massachusetts | 1.22¢ | 76.0% | 3.37¢ / 3.80¢ |
| West Coast (excl. California) | 1.19¢ | 74.9% | 3.62¢ / 4.44¢ |
| New York | 1.16¢ | 77.3% | 3.39¢ / 3.73¢ |
| Boston | 1.15¢ | 76.3% | 3.39¢ / 3.65¢ |
| Washington | 1.14¢ | 74.0% | 3.94¢ / 4.55¢ |
| Cleveland | 1.05¢ | 58.3% | 9.48¢ / 9.18¢ |
| Seattle | 1.00¢ | 73.7% | 3.87¢ / 4.31¢ |
| Houston | 0.73¢ | 74.2% | 5.31¢ / 5.66¢ |
| Ohio | 0.72¢ | 56.5% | 12.17¢ / 11.96¢ |

</details>

<details><summary>Constant sweep (one at a time, others at default)</summary>

| Constant | Value | Saved vs always-now | Of oracle | Direction right | MAE 1wk / 2wk | Band 1wk / 2wk | Wait share |
|---|---|---|---|---|---|---|---|
| `passThrough` | 0 | 0.63¢ | 24.5% | 63.9% | 5.33¢ / 8.88¢ | 68.0% / 73.9% | 23.2% |
| `passThrough` | 0.35 | 1.21¢ | 47.1% | 73.3% | 4.78¢ / 8.11¢ | 73.6% / 78.3% | 35.4% |
| `passThrough` | 0.7 (default) | 1.26¢ | 48.9% | 72.0% | 5.06¢ / 9.65¢ | 67.8% / 67.3% | 40.3% |
| `passThrough` | 1 | 1.27¢ | 49.3% | 70.8% | 5.57¢ / 11.46¢ | 60.8% / 57.5% | 42.2% |
| `verdictMove` | 0.01 | 1.27¢ | 49.4% | 70.5% | 5.06¢ / 9.65¢ | 67.8% / 67.3% | 43.5% |
| `verdictMove` | 0.02 (default) | 1.26¢ | 48.9% | 72.0% | 5.06¢ / 9.65¢ | 67.8% / 67.3% | 40.3% |
| `verdictMove` | 0.03 | 1.24¢ | 48.3% | 73.0% | 5.06¢ / 9.65¢ | 67.8% / 67.3% | 37.1% |
| `verdictMove` | 0.05 | 1.17¢ | 45.7% | 75.1% | 5.06¢ / 9.65¢ | 67.8% / 67.3% | 31.0% |
| `momentumPoints` | 4 | 1.29¢ | 50.1% | 72.3% | 5.14¢ / 9.85¢ | 66.5% / 66.0% | 41.2% |
| `momentumPoints` | 6 (default) | 1.26¢ | 48.9% | 72.0% | 5.06¢ / 9.65¢ | 67.8% / 67.3% | 40.3% |
| `momentumPoints` | 8 | 1.23¢ | 47.7% | 71.5% | 5.07¢ / 9.59¢ | 68.5% / 68.1% | 40.0% |
| `momentumPoints` | 12 | 1.20¢ | 46.8% | 71.4% | 5.12¢ / 9.60¢ | 68.5% / 68.3% | 39.8% |
| `leadLookbackDays` | 5 | 1.26¢ | 48.9% | 73.0% | 4.68¢ / 8.53¢ | 73.2% / 74.5% | 38.8% |
| `leadLookbackDays` | 10 (default) | 1.26¢ | 48.9% | 72.0% | 5.06¢ / 9.65¢ | 67.8% / 67.3% | 40.3% |
| `leadLookbackDays` | 15 | 1.19¢ | 46.1% | 69.1% | 5.64¢ / 11.17¢ | 60.7% / 58.2% | 41.3% |
| `momentumDecayDays` | 5 | 1.26¢ | 49.0% | 71.7% | 4.97¢ / 9.50¢ | 68.6% / 68.2% | 40.4% |
| `momentumDecayDays` | 7 (default) | 1.26¢ | 48.9% | 72.0% | 5.06¢ / 9.65¢ | 67.8% / 67.3% | 40.3% |
| `momentumDecayDays` | 10 | 1.26¢ | 49.2% | 72.0% | 5.16¢ / 9.87¢ | 66.9% / 66.2% | 40.2% |
| `momentumDecayDays` | 14 | 1.26¢ | 49.1% | 71.8% | 5.26¢ / 10.11¢ | 66.1% / 65.2% | 40.5% |
| `momentumDecayDays` | 28 | 1.25¢ | 48.7% | 71.6% | 5.41¢ / 10.60¢ | 64.7% / 63.3% | 40.9% |
| `momentumDecayDays` | Infinity | 1.21¢ | 47.2% | 71.0% | 5.62¢ / 11.44¢ | 63.0% / 59.7% | 40.8% |
| `bandScale` | 1 (default) | 1.26¢ | 48.9% | 72.0% | 5.06¢ / 9.65¢ | 67.8% / 67.3% | 40.3% |
| `bandScale` | 1.25 | 1.26¢ | 48.9% | 72.0% | 5.06¢ / 9.65¢ | 77.7% / 76.5% | 40.3% |
| `bandExponent` | 0.5 | 1.26¢ | 48.9% | 72.0% | 5.06¢ / 9.65¢ | 67.8% / 52.6% | 40.3% |
| `bandExponent` | 0.65 | 1.26¢ | 48.9% | 72.0% | 5.06¢ / 9.65¢ | 67.8% / 57.3% | 40.3% |
| `bandExponent` | 0.8 | 1.26¢ | 48.9% | 72.0% | 5.06¢ / 9.65¢ | 67.8% / 61.7% | 40.3% |
| `bandExponent` | 1 (default) | 1.26¢ | 48.9% | 72.0% | 5.06¢ / 9.65¢ | 67.8% / 67.3% | 40.3% |

</details>

## Midgrade

15,078 weekly decisions across 29 areas, 2016-09-26 → 2026-09-07. Wholesale lead: RBOB.

| Variant | 1wk MAE / no-change | 2wk MAE / no-change | Band 1wk / 2wk | Direction right | Saved vs always-now | Of oracle |
|---|---|---|---|---|---|---|
| Default (momentum + wholesale) | 5.11¢ / 5.49¢ | 9.63¢ / 9.01¢ | 67.0% / 66.8% | 71.7% (87.0% called) | 1.13¢ | 45.0% |
| Momentum only | 5.28¢ / 5.49¢ | 8.66¢ / 9.01¢ | 68.2% / 75.0% | 63.8% (49.3% called) | 0.55¢ | 22.0% |

Verdict mix: fill up now 50.9%, no rush 9.0%, wait 40.1%. "Wait" calls were right 75.8% of the time and saved 2.81¢/gal on average when made. Always waiting a week would have cost 0.48¢/gal relative to always buying now; the oracle saves 2.50¢/gal.

<details><summary>Per area</summary>

| Area | Saved vs always-now | Direction right | 1wk MAE / no-change |
|---|---|---|---|
| Florida | 1.48¢ | 71.0% | 6.51¢ / 6.96¢ |
| Lower Atlantic | 1.44¢ | 74.9% | 3.98¢ / 4.71¢ |
| California | 1.36¢ | 71.6% | 5.03¢ / 5.63¢ |
| Colorado | 1.36¢ | 69.2% | 5.93¢ / 6.51¢ |
| Gulf Coast | 1.34¢ | 74.8% | 4.53¢ / 5.12¢ |
| Los Angeles | 1.34¢ | 70.9% | 5.41¢ / 5.90¢ |
| San Francisco | 1.33¢ | 68.9% | 5.54¢ / 6.09¢ |
| Denver | 1.33¢ | 68.2% | 6.10¢ / 6.71¢ |
| Texas | 1.33¢ | 72.4% | 5.51¢ / 6.06¢ |
| East Coast | 1.29¢ | 76.9% | 3.37¢ / 4.04¢ |
| U.S. average | 1.26¢ | 76.0% | 3.50¢ / 4.08¢ |
| Miami | 1.24¢ | 69.7% | 6.77¢ / 6.94¢ |
| Midwest | 1.23¢ | 65.5% | 5.66¢ / 5.80¢ |
| West Coast | 1.22¢ | 73.9% | 4.31¢ / 4.98¢ |
| Minnesota | 1.19¢ | 70.8% | 4.57¢ / 4.90¢ |
| Rocky Mountain | 1.19¢ | 71.0% | 4.48¢ / 5.12¢ |
| Central Atlantic | 1.18¢ | 76.4% | 3.41¢ / 3.87¢ |
| New York City | 1.15¢ | 74.7% | 3.74¢ / 4.12¢ |
| West Coast (excl. California) | 1.13¢ | 75.7% | 3.55¢ / 4.25¢ |
| Washington | 1.12¢ | 76.7% | 3.85¢ / 4.33¢ |
| New York | 1.08¢ | 75.4% | 3.52¢ / 3.73¢ |
| New England | 1.07¢ | 77.2% | 3.05¢ / 3.33¢ |
| Massachusetts | 0.94¢ | 74.9% | 3.22¢ / 3.27¢ |
| Cleveland | 0.93¢ | 58.5% | 8.58¢ / 8.21¢ |
| Seattle | 0.88¢ | 74.3% | 3.86¢ / 4.07¢ |
| Ohio | 0.70¢ | 56.5% | 11.76¢ / 11.57¢ |
| Chicago | 0.67¢ | 63.7% | 8.78¢ / 9.09¢ |
| Houston | 0.49¢ | 73.4% | 5.36¢ / 5.53¢ |
| Boston | 0.43¢ | 75.3% | 4.37¢ / 4.19¢ |

</details>

<details><summary>Constant sweep (one at a time, others at default)</summary>

| Constant | Value | Saved vs always-now | Of oracle | Direction right | MAE 1wk / 2wk | Band 1wk / 2wk | Wait share |
|---|---|---|---|---|---|---|---|
| `passThrough` | 0 | 0.55¢ | 22.0% | 63.8% | 5.28¢ / 8.66¢ | 68.2% / 75.0% | 21.9% |
| `passThrough` | 0.35 | 1.08¢ | 42.9% | 73.4% | 4.79¢ / 7.99¢ | 73.1% / 78.4% | 34.6% |
| `passThrough` | 0.7 (default) | 1.13¢ | 45.0% | 71.7% | 5.11¢ / 9.63¢ | 67.0% / 66.8% | 40.1% |
| `passThrough` | 1 | 1.16¢ | 46.1% | 70.7% | 5.65¢ / 11.50¢ | 59.5% / 56.2% | 42.1% |
| `verdictMove` | 0.01 | 1.14¢ | 45.3% | 70.4% | 5.11¢ / 9.63¢ | 67.0% / 66.8% | 43.4% |
| `verdictMove` | 0.02 (default) | 1.13¢ | 45.0% | 71.7% | 5.11¢ / 9.63¢ | 67.0% / 66.8% | 40.1% |
| `verdictMove` | 0.03 | 1.11¢ | 44.2% | 72.9% | 5.11¢ / 9.63¢ | 67.0% / 66.8% | 36.9% |
| `verdictMove` | 0.05 | 1.07¢ | 42.7% | 74.8% | 5.11¢ / 9.63¢ | 67.0% / 66.8% | 30.8% |
| `momentumPoints` | 4 | 1.17¢ | 46.7% | 71.9% | 5.20¢ / 9.83¢ | 65.2% / 65.2% | 40.8% |
| `momentumPoints` | 6 (default) | 1.13¢ | 45.0% | 71.7% | 5.11¢ / 9.63¢ | 67.0% / 66.8% | 40.1% |
| `momentumPoints` | 8 | 1.09¢ | 43.6% | 71.3% | 5.12¢ / 9.58¢ | 67.5% / 67.4% | 39.6% |
| `momentumPoints` | 12 | 1.07¢ | 42.7% | 71.2% | 5.17¢ / 9.59¢ | 67.7% / 67.6% | 39.6% |
| `leadLookbackDays` | 5 | 1.11¢ | 44.2% | 72.6% | 4.71¢ / 8.48¢ | 72.3% / 74.1% | 38.3% |
| `leadLookbackDays` | 10 (default) | 1.13¢ | 45.0% | 71.7% | 5.11¢ / 9.63¢ | 67.0% / 66.8% | 40.1% |
| `leadLookbackDays` | 15 | 1.09¢ | 43.5% | 69.1% | 5.68¢ / 11.13¢ | 59.7% / 57.6% | 41.2% |
| `momentumDecayDays` | 5 | 1.15¢ | 45.8% | 71.5% | 5.02¢ / 9.49¢ | 67.9% / 67.3% | 40.1% |
| `momentumDecayDays` | 7 (default) | 1.13¢ | 45.0% | 71.7% | 5.11¢ / 9.63¢ | 67.0% / 66.8% | 40.1% |
| `momentumDecayDays` | 10 | 1.13¢ | 45.0% | 71.7% | 5.21¢ / 9.84¢ | 66.0% / 65.8% | 40.0% |
| `momentumDecayDays` | 14 | 1.13¢ | 45.0% | 71.6% | 5.30¢ / 10.07¢ | 65.2% / 64.8% | 40.2% |
| `momentumDecayDays` | 28 | 1.11¢ | 44.5% | 71.3% | 5.44¢ / 10.53¢ | 63.8% / 62.8% | 40.4% |
| `momentumDecayDays` | Infinity | 1.08¢ | 43.2% | 70.9% | 5.64¢ / 11.32¢ | 62.1% / 59.6% | 40.4% |
| `bandScale` | 1 (default) | 1.13¢ | 45.0% | 71.7% | 5.11¢ / 9.63¢ | 67.0% / 66.8% | 40.1% |
| `bandScale` | 1.25 | 1.13¢ | 45.0% | 71.7% | 5.11¢ / 9.63¢ | 76.9% / 75.6% | 40.1% |
| `bandExponent` | 0.5 | 1.13¢ | 45.0% | 71.7% | 5.11¢ / 9.63¢ | 67.0% / 51.5% | 40.1% |
| `bandExponent` | 0.65 | 1.13¢ | 45.0% | 71.7% | 5.11¢ / 9.63¢ | 67.0% / 56.2% | 40.1% |
| `bandExponent` | 0.8 | 1.13¢ | 45.0% | 71.7% | 5.11¢ / 9.63¢ | 67.0% / 60.8% | 40.1% |
| `bandExponent` | 1 (default) | 1.13¢ | 45.0% | 71.7% | 5.11¢ / 9.63¢ | 67.0% / 66.8% | 40.1% |

</details>

## Premium

15,077 weekly decisions across 29 areas, 2016-09-26 → 2026-09-07. Wholesale lead: RBOB.

| Variant | 1wk MAE / no-change | 2wk MAE / no-change | Band 1wk / 2wk | Direction right | Saved vs always-now | Of oracle |
|---|---|---|---|---|---|---|
| Default (momentum + wholesale) | 5.00¢ / 5.42¢ | 9.54¢ / 8.98¢ | 67.2% / 66.5% | 72.2% (87.0% called) | 1.14¢ | 46.2% |
| Momentum only | 5.19¢ / 5.42¢ | 8.61¢ / 8.98¢ | 68.0% / 74.5% | 64.9% (49.2% called) | 0.59¢ | 23.9% |

Verdict mix: fill up now 50.9%, no rush 9.0%, wait 40.1%. "Wait" calls were right 76.2% of the time and saved 2.83¢/gal on average when made. Always waiting a week would have cost 0.50¢/gal relative to always buying now; the oracle saves 2.46¢/gal.

<details><summary>Per area</summary>

| Area | Saved vs always-now | Direction right | 1wk MAE / no-change |
|---|---|---|---|
| Florida | 1.45¢ | 70.9% | 6.08¢ / 6.54¢ |
| Lower Atlantic | 1.41¢ | 74.2% | 3.92¢ / 4.61¢ |
| California | 1.36¢ | 71.0% | 5.12¢ / 5.82¢ |
| Denver | 1.35¢ | 69.6% | 5.68¢ / 6.39¢ |
| Los Angeles | 1.35¢ | 70.2% | 5.41¢ / 5.95¢ |
| Colorado | 1.34¢ | 70.1% | 5.57¢ / 6.22¢ |
| Gulf Coast | 1.33¢ | 75.3% | 4.58¢ / 5.16¢ |
| Texas | 1.32¢ | 72.1% | 5.41¢ / 5.95¢ |
| East Coast | 1.28¢ | 76.5% | 3.33¢ / 3.99¢ |
| Midwest | 1.26¢ | 67.9% | 5.37¢ / 5.72¢ |
| West Coast | 1.25¢ | 73.0% | 4.40¢ / 5.15¢ |
| San Francisco | 1.25¢ | 68.9% | 5.50¢ / 6.06¢ |
| U.S. average | 1.24¢ | 76.5% | 3.49¢ / 4.08¢ |
| Rocky Mountain | 1.21¢ | 74.3% | 4.06¢ / 4.73¢ |
| New York City | 1.19¢ | 76.0% | 3.75¢ / 4.21¢ |
| Central Atlantic | 1.19¢ | 77.3% | 3.45¢ / 3.96¢ |
| Minnesota | 1.13¢ | 71.2% | 4.29¢ / 4.68¢ |
| West Coast (excl. California) | 1.12¢ | 74.9% | 3.54¢ / 4.29¢ |
| Washington | 1.11¢ | 74.2% | 3.85¢ / 4.47¢ |
| Miami | 1.11¢ | 69.7% | 6.26¢ / 6.36¢ |
| New York | 1.08¢ | 77.1% | 3.58¢ / 3.84¢ |
| New England | 1.07¢ | 79.3% | 3.05¢ / 3.39¢ |
| Boston | 0.96¢ | 76.5% | 3.33¢ / 3.29¢ |
| Cleveland | 0.94¢ | 60.3% | 8.67¢ / 8.28¢ |
| Massachusetts | 0.94¢ | 78.1% | 3.27¢ / 3.33¢ |
| Seattle | 0.93¢ | 74.0% | 3.93¢ / 4.39¢ |
| Ohio | 0.80¢ | 55.9% | 11.60¢ / 11.38¢ |
| Chicago | 0.49¢ | 65.7% | 9.14¢ / 9.40¢ |
| Houston | 0.48¢ | 74.9% | 5.44¢ / 5.69¢ |

</details>

<details><summary>Constant sweep (one at a time, others at default)</summary>

| Constant | Value | Saved vs always-now | Of oracle | Direction right | MAE 1wk / 2wk | Band 1wk / 2wk | Wait share |
|---|---|---|---|---|---|---|---|
| `passThrough` | 0 | 0.59¢ | 23.9% | 64.9% | 5.19¢ / 8.61¢ | 68.0% / 74.5% | 21.8% |
| `passThrough` | 0.35 | 1.10¢ | 44.6% | 73.9% | 4.68¢ / 7.89¢ | 73.1% / 78.3% | 34.7% |
| `passThrough` | 0.7 (default) | 1.14¢ | 46.2% | 72.2% | 5.00¢ / 9.54¢ | 67.2% / 66.5% | 40.1% |
| `passThrough` | 1 | 1.17¢ | 47.7% | 71.2% | 5.54¢ / 11.40¢ | 59.7% / 56.1% | 42.1% |
| `verdictMove` | 0.01 | 1.15¢ | 46.7% | 71.0% | 5.00¢ / 9.54¢ | 67.2% / 66.5% | 43.3% |
| `verdictMove` | 0.02 (default) | 1.14¢ | 46.2% | 72.2% | 5.00¢ / 9.54¢ | 67.2% / 66.5% | 40.1% |
| `verdictMove` | 0.03 | 1.12¢ | 45.3% | 73.2% | 5.00¢ / 9.54¢ | 67.2% / 66.5% | 37.0% |
| `verdictMove` | 0.05 | 1.08¢ | 44.0% | 75.4% | 5.00¢ / 9.54¢ | 67.2% / 66.5% | 30.7% |
| `momentumPoints` | 4 | 1.18¢ | 47.8% | 72.6% | 5.08¢ / 9.73¢ | 65.6% / 65.1% | 40.9% |
| `momentumPoints` | 6 (default) | 1.14¢ | 46.2% | 72.2% | 5.00¢ / 9.54¢ | 67.2% / 66.5% | 40.1% |
| `momentumPoints` | 8 | 1.11¢ | 44.9% | 71.9% | 5.01¢ / 9.49¢ | 67.9% / 67.1% | 39.5% |
| `momentumPoints` | 12 | 1.09¢ | 44.4% | 71.8% | 5.07¢ / 9.51¢ | 67.7% / 67.3% | 39.5% |
| `leadLookbackDays` | 5 | 1.12¢ | 45.4% | 73.0% | 4.61¢ / 8.39¢ | 72.5% / 74.4% | 38.2% |
| `leadLookbackDays` | 10 (default) | 1.14¢ | 46.2% | 72.2% | 5.00¢ / 9.54¢ | 67.2% / 66.5% | 40.1% |
| `leadLookbackDays` | 15 | 1.12¢ | 45.4% | 69.6% | 5.58¢ / 11.05¢ | 59.8% / 57.4% | 41.2% |
| `momentumDecayDays` | 5 | 1.16¢ | 47.3% | 72.1% | 4.92¢ / 9.40¢ | 68.2% / 67.2% | 40.1% |
| `momentumDecayDays` | 7 (default) | 1.14¢ | 46.2% | 72.2% | 5.00¢ / 9.54¢ | 67.2% / 66.5% | 40.1% |
| `momentumDecayDays` | 10 | 1.14¢ | 46.4% | 72.4% | 5.10¢ / 9.74¢ | 66.3% / 65.5% | 39.9% |
| `momentumDecayDays` | 14 | 1.14¢ | 46.5% | 72.2% | 5.19¢ / 9.96¢ | 65.4% / 64.3% | 40.0% |
| `momentumDecayDays` | 28 | 1.12¢ | 45.7% | 72.0% | 5.33¢ / 10.43¢ | 63.9% / 62.3% | 40.4% |
| `momentumDecayDays` | Infinity | 1.10¢ | 44.7% | 71.4% | 5.53¢ / 11.21¢ | 62.4% / 59.3% | 40.2% |
| `bandScale` | 1 (default) | 1.14¢ | 46.2% | 72.2% | 5.00¢ / 9.54¢ | 67.2% / 66.5% | 40.1% |
| `bandScale` | 1.25 | 1.14¢ | 46.2% | 72.2% | 5.00¢ / 9.54¢ | 77.1% / 75.2% | 40.1% |
| `bandExponent` | 0.5 | 1.14¢ | 46.2% | 72.2% | 5.00¢ / 9.54¢ | 67.2% / 51.8% | 40.1% |
| `bandExponent` | 0.65 | 1.14¢ | 46.2% | 72.2% | 5.00¢ / 9.54¢ | 67.2% / 56.1% | 40.1% |
| `bandExponent` | 0.8 | 1.14¢ | 46.2% | 72.2% | 5.00¢ / 9.54¢ | 67.2% / 60.9% | 40.1% |
| `bandExponent` | 1 (default) | 1.14¢ | 46.2% | 72.2% | 5.00¢ / 9.54¢ | 67.2% / 66.5% | 40.1% |

</details>

## Diesel

5,722 weekly decisions across 11 areas, 2016-09-26 → 2026-09-07. Wholesale lead: ULSD.

| Variant | 1wk MAE / no-change | 2wk MAE / no-change | Band 1wk / 2wk | Direction right | Saved vs always-now | Of oracle |
|---|---|---|---|---|---|---|
| Default (momentum + wholesale) | 4.20¢ / 4.69¢ | 8.91¢ / 8.48¢ | 68.4% / 63.1% | 75.0% (83.6% called) | 1.26¢ | 64.6% |
| Momentum only | 4.34¢ / 4.69¢ | 7.98¢ / 8.48¢ | 72.2% / 74.0% | 70.6% (44.9% called) | 0.64¢ | 32.8% |

Verdict mix: fill up now 50.3%, no rush 11.6%, wait 38.1%. "Wait" calls were right 81.1% of the time and saved 3.32¢/gal on average when made. Always waiting a week would have cost 0.77¢/gal relative to always buying now; the oracle saves 1.96¢/gal.

<details><summary>Per area</summary>

| Area | Saved vs always-now | Direction right | 1wk MAE / no-change |
|---|---|---|---|
| Midwest | 1.34¢ | 71.6% | 4.77¢ / 5.29¢ |
| California | 1.31¢ | 75.6% | 4.41¢ / 4.86¢ |
| West Coast | 1.30¢ | 76.3% | 4.31¢ / 4.87¢ |
| Gulf Coast | 1.29¢ | 71.3% | 4.54¢ / 5.00¢ |
| West Coast (excl. California) | 1.28¢ | 74.9% | 4.60¢ / 5.19¢ |
| U.S. average | 1.26¢ | 73.5% | 4.16¢ / 4.71¢ |
| Central Atlantic | 1.25¢ | 79.2% | 3.49¢ / 4.03¢ |
| Lower Atlantic | 1.24¢ | 73.9% | 4.39¢ / 4.77¢ |
| Rocky Mountain | 1.23¢ | 74.4% | 4.18¢ / 4.70¢ |
| East Coast | 1.23¢ | 76.3% | 3.89¢ / 4.38¢ |
| New England | 1.19¢ | 78.5% | 3.46¢ / 3.75¢ |

</details>

<details><summary>Constant sweep (one at a time, others at default)</summary>

| Constant | Value | Saved vs always-now | Of oracle | Direction right | MAE 1wk / 2wk | Band 1wk / 2wk | Wait share |
|---|---|---|---|---|---|---|---|
| `passThrough` | 0 | 0.64¢ | 32.8% | 70.6% | 4.34¢ / 7.98¢ | 72.2% / 74.0% | 20.7% |
| `passThrough` | 0.35 | 1.16¢ | 59.2% | 76.5% | 3.75¢ / 7.24¢ | 78.1% / 78.5% | 32.8% |
| `passThrough` | 0.7 (default) | 1.26¢ | 64.6% | 75.0% | 4.20¢ / 8.91¢ | 68.4% / 63.1% | 38.1% |
| `passThrough` | 1 | 1.26¢ | 64.6% | 74.8% | 4.81¢ / 10.64¢ | 58.7% / 51.9% | 40.4% |
| `verdictMove` | 0.01 | 1.28¢ | 65.7% | 74.3% | 4.20¢ / 8.91¢ | 68.4% / 63.1% | 41.6% |
| `verdictMove` | 0.02 (default) | 1.26¢ | 64.6% | 75.0% | 4.20¢ / 8.91¢ | 68.4% / 63.1% | 38.1% |
| `verdictMove` | 0.03 | 1.22¢ | 62.4% | 75.8% | 4.20¢ / 8.91¢ | 68.4% / 63.1% | 33.6% |
| `verdictMove` | 0.05 | 1.15¢ | 58.8% | 77.3% | 4.20¢ / 8.91¢ | 68.4% / 63.1% | 28.3% |
| `momentumPoints` | 4 | 1.29¢ | 65.8% | 75.0% | 4.35¢ / 9.21¢ | 66.0% / 61.8% | 38.5% |
| `momentumPoints` | 6 (default) | 1.26¢ | 64.6% | 75.0% | 4.20¢ / 8.91¢ | 68.4% / 63.1% | 38.1% |
| `momentumPoints` | 8 | 1.23¢ | 63.0% | 74.5% | 4.15¢ / 8.77¢ | 69.1% / 63.6% | 37.4% |
| `momentumPoints` | 12 | 1.22¢ | 62.1% | 73.9% | 4.19¢ / 8.80¢ | 69.9% / 63.9% | 37.1% |
| `leadLookbackDays` | 5 | 1.25¢ | 63.9% | 74.5% | 3.75¢ / 7.62¢ | 75.9% / 72.8% | 37.3% |
| `leadLookbackDays` | 10 (default) | 1.26¢ | 64.6% | 75.0% | 4.20¢ / 8.91¢ | 68.4% / 63.1% | 38.1% |
| `leadLookbackDays` | 15 | 1.13¢ | 57.7% | 73.0% | 4.95¢ / 10.70¢ | 59.7% / 53.3% | 39.9% |
| `momentumDecayDays` | 5 | 1.25¢ | 64.1% | 74.9% | 4.12¢ / 8.77¢ | 68.9% / 64.1% | 37.7% |
| `momentumDecayDays` | 7 (default) | 1.26¢ | 64.6% | 75.0% | 4.20¢ / 8.91¢ | 68.4% / 63.1% | 38.1% |
| `momentumDecayDays` | 10 | 1.22¢ | 62.6% | 75.1% | 4.29¢ / 9.11¢ | 67.1% / 62.1% | 38.1% |
| `momentumDecayDays` | 14 | 1.21¢ | 61.8% | 75.1% | 4.37¢ / 9.33¢ | 66.5% / 61.2% | 37.9% |
| `momentumDecayDays` | 28 | 1.20¢ | 61.4% | 74.6% | 4.51¢ / 9.77¢ | 65.2% / 58.8% | 37.7% |
| `momentumDecayDays` | Infinity | 1.17¢ | 59.6% | 73.8% | 4.69¢ / 10.50¢ | 63.1% / 55.5% | 38.1% |
| `bandScale` | 1 (default) | 1.26¢ | 64.6% | 75.0% | 4.20¢ / 8.91¢ | 68.4% / 63.1% | 38.1% |
| `bandScale` | 1.25 | 1.26¢ | 64.6% | 75.0% | 4.20¢ / 8.91¢ | 77.4% / 71.9% | 38.1% |
| `bandExponent` | 0.5 | 1.26¢ | 64.6% | 75.0% | 4.20¢ / 8.91¢ | 68.4% / 49.2% | 38.1% |
| `bandExponent` | 0.65 | 1.26¢ | 64.6% | 75.0% | 4.20¢ / 8.91¢ | 68.4% / 53.9% | 38.1% |
| `bandExponent` | 0.8 | 1.26¢ | 64.6% | 75.0% | 4.20¢ / 8.91¢ | 68.4% / 57.9% | 38.1% |
| `bandExponent` | 1 (default) | 1.26¢ | 64.6% | 75.0% | 4.20¢ / 8.91¢ | 68.4% / 63.1% | 38.1% |

</details>

## Caveats

- No outlook anchor in the test (see Method), so the 2-week numbers on the live site blend in one more signal than is measured here.
- Weekly area averages, not station prices. A driver who shops around can beat any of these numbers.
- Diesel is reported for the U.S., the regions and California only (11 areas), so its sample is smaller and more regional.
- The decision metric assumes the tank can wait a week. If it cannot, only the "now" and "no rush" verdicts apply.
- Past behaviour of gas prices does not guarantee future behaviour. This is a calibration aid, not a promise.
