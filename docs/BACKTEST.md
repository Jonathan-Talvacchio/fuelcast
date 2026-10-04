# Backtest results

Generated 2026-10-04 by `node scripts/backtest.mjs --sweep --report` on 10 years of EIA history (2016-10-03 → 2026-09-14), evaluated separately for each fuel grade.

## Method

Walk forward one weekly report at a time, giving the model only what existed on that date: retail reports up to the report date and the grade's NY Harbor wholesale spot price (RBOB for gasoline grades, ULSD for diesel) dated on or before it — the same 90-day window the site uses. The EIA outlook anchor is **disabled**: only the current forecast vintage is available, and using it for past dates would leak the future into the test. So this measures the momentum + wholesale-lead core of the model, which drives the tomorrow / this-week / verdict numbers on the site. All grades use the same constants.

- **Forecast MAE** — mean absolute error of the 1- and 2-week-ahead prediction against the actual next reports, next to a "no change" baseline.
- **Band coverage** — share of actual prices that fell inside the uncertainty band (a ±1σ band should catch ≈68%).
- **Direction** — when the model predicts a 14-day move of at least the verdict threshold, how often the actual 2-week change had the same sign.
- **Decision** — a driver who must buy within the week follows the verdict: buy now, or buy next week on "wait". Compared with always-now, always-wait, and a perfect-foresight oracle (min of the two). Savings are in cents per gallon, averaged over every week.

## Summary by grade

| Grade | Decisions · areas | 1wk MAE / no-change | 2wk MAE / no-change | Band 1wk / 2wk | Direction right | Saved vs always-now | Of oracle |
|---|---|---|---|---|---|---|---|
| Regular | 15,078 · 29 | 4.99¢ / 5.52¢ | 9.59¢ / 9.20¢ | 68.0% / 67.3% | 72.1% | 1.28¢ | 50.3% |
| Midgrade | 15,076 · 29 | 4.95¢ / 5.34¢ | 9.46¢ / 8.86¢ | 67.0% / 66.7% | 71.9% | 1.19¢ | 49.1% |
| Premium | 15,077 · 29 | 4.86¢ / 5.30¢ | 9.40¢ / 8.86¢ | 67.3% / 66.4% | 72.4% | 1.19¢ | 49.8% |
| Diesel | 5,720 · 11 | 4.19¢ / 4.73¢ | 8.92¢ / 8.51¢ | 68.4% / 63.2% | 75.4% | 1.28¢ | 65.3% |

## Daily verdict

The weekly test above scores Mondays only, but the site re-runs every evening. This walks every calendar day with what the site would have had: retail reports published before that day, and EIA spot prices as EIA actually posts them — once a week on Wednesdays, through Tuesday, so 2–8 days old. "+ futures fill" adds the days since EIA's latest posting from NYMEX futures (`scripts/providers/futures.mjs`; here continuous front-month history from Yahoo Finance). "+ outlook" adds the EIA monthly outlook edition that was out on each date (`scripts/data/steo-vintages.json`, usable from the 12th of its month). Blending toward it from day 7 made the decision worse, so the blend now starts at day 21, past the 2-week window the verdict and price tiles use. Actual prices between weekly reports are linearly interpolated. A driver must buy within a week and follows the verdict: buy now, or in 7 days on "wait". The model constants were set before this test existed and no constant was tuned on 2022 onward, so those rows are out of sample.

| Grade | Variant | Saved vs always-now | Of oracle | Verdict right | Wait share | "Today" error / last report | Wait↔buy flips per month |
|---|---|---|---|---|---|---|---|
| Regular | EIA spot only | 0.90¢ | 40.0% | 66.0% | 37.5% | 2.78¢ / 3.16¢ | 1.6 |
| Regular | + futures fill | 1.14¢ | 50.9% | 70.2% | 36.8% | 2.68¢ / 3.16¢ | 2.7 |
| Regular | + hysteresis | 1.14¢ | 50.5% | 70.3% | 37.1% | 2.68¢ / 3.16¢ | 1.9 |
| Regular | + outlook from day 7 (previous) | 0.96¢ | 42.6% | 67.3% | 37.5% | 2.68¢ / 3.16¢ | 3.4 |
| Regular | + outlook from day 21 (current) | 1.14¢ | 50.5% | 70.3% | 37.1% | 2.68¢ / 3.16¢ | 1.9 |
| Regular | EIA spot only, 2022+ | 1.14¢ | 36.6% | 64.4% | 40.5% | 3.81¢ / 4.32¢ | 1.6 |
| Regular | + futures fill, 2022+ | 1.46¢ | 46.9% | 67.7% | 40.7% | 3.66¢ / 4.32¢ | 3.0 |
| Regular | + hysteresis, 2022+ | 1.44¢ | 46.2% | 67.8% | 40.9% | 3.66¢ / 4.32¢ | 2.2 |
| Regular | + outlook from day 7 (previous), 2022+ | 1.20¢ | 38.5% | 64.4% | 38.5% | 3.66¢ / 4.32¢ | 3.8 |
| Regular | + outlook from day 21 (current), 2022+ | 1.44¢ | 46.2% | 67.8% | 40.9% | 3.66¢ / 4.32¢ | 2.2 |
| Midgrade | EIA spot only | 0.85¢ | 39.7% | 65.8% | 37.3% | 2.73¢ / 3.05¢ | 1.6 |
| Midgrade | + futures fill | 1.07¢ | 49.9% | 69.7% | 36.6% | 2.65¢ / 3.05¢ | 2.6 |
| Midgrade | + hysteresis | 1.06¢ | 49.5% | 69.8% | 36.9% | 2.65¢ / 3.05¢ | 1.9 |
| Midgrade | + outlook from day 7 (previous) | 0.90¢ | 42.0% | 66.9% | 37.4% | 2.65¢ / 3.05¢ | 3.3 |
| Midgrade | + outlook from day 21 (current) | 1.06¢ | 49.5% | 69.8% | 36.9% | 2.65¢ / 3.05¢ | 1.9 |
| Midgrade | EIA spot only, 2022+ | 1.09¢ | 36.7% | 63.8% | 40.4% | 3.72¢ / 4.17¢ | 1.6 |
| Midgrade | + futures fill, 2022+ | 1.38¢ | 46.5% | 67.3% | 40.6% | 3.59¢ / 4.17¢ | 3.0 |
| Midgrade | + hysteresis, 2022+ | 1.35¢ | 45.6% | 67.4% | 40.8% | 3.59¢ / 4.17¢ | 2.2 |
| Midgrade | + outlook from day 7 (previous), 2022+ | 1.14¢ | 38.3% | 63.9% | 38.5% | 3.59¢ / 4.17¢ | 3.7 |
| Midgrade | + outlook from day 21 (current), 2022+ | 1.35¢ | 45.6% | 67.4% | 40.8% | 3.59¢ / 4.17¢ | 2.2 |
| Premium | EIA spot only | 0.84¢ | 39.9% | 66.1% | 37.3% | 2.68¢ / 3.03¢ | 1.6 |
| Premium | + futures fill | 1.07¢ | 50.5% | 70.0% | 36.5% | 2.59¢ / 3.03¢ | 2.7 |
| Premium | + hysteresis | 1.06¢ | 50.1% | 70.2% | 36.8% | 2.59¢ / 3.03¢ | 1.9 |
| Premium | + outlook from day 7 (previous) | 0.90¢ | 42.4% | 67.3% | 37.4% | 2.59¢ / 3.03¢ | 3.3 |
| Premium | + outlook from day 21 (current) | 1.06¢ | 50.1% | 70.2% | 36.8% | 2.59¢ / 3.03¢ | 1.9 |
| Premium | EIA spot only, 2022+ | 1.08¢ | 36.8% | 64.0% | 40.3% | 3.67¢ / 4.15¢ | 1.6 |
| Premium | + futures fill, 2022+ | 1.38¢ | 46.9% | 67.5% | 40.5% | 3.54¢ / 4.15¢ | 3.0 |
| Premium | + hysteresis, 2022+ | 1.35¢ | 46.0% | 67.7% | 40.7% | 3.54¢ / 4.15¢ | 2.2 |
| Premium | + outlook from day 7 (previous), 2022+ | 1.13¢ | 38.6% | 64.3% | 38.5% | 3.54¢ / 4.15¢ | 3.8 |
| Premium | + outlook from day 21 (current), 2022+ | 1.35¢ | 46.0% | 67.7% | 40.7% | 3.54¢ / 4.15¢ | 2.2 |
| Diesel | EIA spot only | 0.86¢ | 47.6% | 68.5% | 36.4% | 2.22¢ / 2.70¢ | 1.5 |
| Diesel | + futures fill | 1.15¢ | 63.3% | 72.2% | 35.1% | 2.12¢ / 2.70¢ | 2.4 |
| Diesel | + hysteresis | 1.15¢ | 63.7% | 72.2% | 35.0% | 2.12¢ / 2.70¢ | 1.7 |
| Diesel | + outlook from day 7 (previous) | 0.79¢ | 43.8% | 66.9% | 30.9% | 2.12¢ / 2.70¢ | 3.0 |
| Diesel | + outlook from day 21 (current) | 1.15¢ | 63.7% | 72.2% | 35.0% | 2.12¢ / 2.70¢ | 1.7 |
| Diesel | EIA spot only, 2022+ | 1.28¢ | 43.9% | 66.1% | 45.7% | 3.47¢ / 4.30¢ | 1.7 |
| Diesel | + futures fill, 2022+ | 1.82¢ | 62.3% | 70.8% | 43.4% | 3.30¢ / 4.30¢ | 2.5 |
| Diesel | + hysteresis, 2022+ | 1.82¢ | 62.6% | 70.7% | 43.8% | 3.30¢ / 4.30¢ | 2.1 |
| Diesel | + outlook from day 7 (previous), 2022+ | 1.18¢ | 40.3% | 65.3% | 44.3% | 3.30¢ / 4.30¢ | 4.5 |
| Diesel | + outlook from day 21 (current), 2022+ | 1.82¢ | 62.6% | 70.7% | 43.8% | 3.30¢ / 4.30¢ | 2.1 |

## Odds

The site shows how often, historically, the price was lower a week later — and the average move — for forecasts like today's: the daily walk with the current model, bucketed by the predicted 14-day change. To check that this generalizes, a table built only from the years before 2022 is scored on 2022 onward (Brier score, lower is better; "base rate" always predicts the holdout's own share of lower weeks).

**Regular** — holdout Brier 0.2105 vs 0.2493 for the base rate; 0.2069 with per-area reliability fitted on the earlier years. Areas whose odds are scaled toward 50/50 (k < 1): Ohio 0.40, Cleveland 0.54, Chicago 0.75, Denver 0.91, Midwest 0.92, San Francisco 0.94, Colorado 0.96, Rocky Mountain 0.99.

| Predicted 14-day change (bin avg) | Lower a week later | before 2022 / 2022+ | Avg 7-day move | Days |
|---|---|---|---|---|
| -12.66¢ | 83.5% | 89.0% / 79.7% | -4.39¢ | 22,810 |
| -4.96¢ | 74.3% | 81.0% / 65.0% | -1.40¢ | 7,393 |
| -2.98¢ | 70.3% | 73.6% / 65.7% | -1.20¢ | 8,602 |
| -1.51¢ | 61.9% | 61.8% / 62.0% | -0.33¢ | 4,526 |
| -0.49¢ | 56.3% | 56.1% / 56.5% | -0.07¢ | 4,503 |
| +0.52¢ | 51.1% | 50.6% / 51.8% | +0.45¢ | 4,815 |
| +1.50¢ | 44.8% | 42.6% / 48.3% | +1.09¢ | 5,228 |
| +2.97¢ | 37.7% | 35.3% / 42.4% | +1.82¢ | 10,373 |
| +4.99¢ | 29.9% | 27.6% / 33.7% | +2.20¢ | 9,245 |
| +12.15¢ | 23.0% | 18.0% / 27.6% | +4.37¢ | 28,065 |

**Midgrade** — holdout Brier 0.2115 vs 0.2495 for the base rate; 0.2083 with per-area reliability fitted on the earlier years. Areas whose odds are scaled toward 50/50 (k < 1): Ohio 0.42, Cleveland 0.56, Chicago 0.77, Midwest 0.89, Rocky Mountain 0.92, Denver 0.93, San Francisco 0.93, Colorado 0.99.

| Predicted 14-day change (bin avg) | Lower a week later | before 2022 / 2022+ | Avg 7-day move | Days |
|---|---|---|---|---|
| -12.62¢ | 82.4% | 87.6% / 78.9% | -4.14¢ | 22,631 |
| -4.96¢ | 72.2% | 77.3% / 65.1% | -1.31¢ | 7,447 |
| -2.98¢ | 68.8% | 71.9% / 64.6% | -1.08¢ | 8,539 |
| -1.50¢ | 61.7% | 61.4% / 62.1% | -0.26¢ | 4,579 |
| -0.49¢ | 55.7% | 55.5% / 56.0% | -0.06¢ | 4,499 |
| +0.52¢ | 50.7% | 50.1% / 51.6% | +0.45¢ | 4,818 |
| +1.51¢ | 43.8% | 41.7% / 47.2% | +1.05¢ | 5,332 |
| +2.97¢ | 37.7% | 34.8% / 43.3% | +1.76¢ | 10,379 |
| +4.98¢ | 30.2% | 26.9% / 35.7% | +2.16¢ | 9,245 |
| +12.11¢ | 23.1% | 18.3% / 27.5% | +4.27¢ | 28,091 |

**Premium** — holdout Brier 0.2111 vs 0.2496 for the base rate; 0.2081 with per-area reliability fitted on the earlier years. Areas whose odds are scaled toward 50/50 (k < 1): Ohio 0.42, Cleveland 0.57, Chicago 0.79, San Francisco 0.94, Denver 0.95, Midwest 0.96, Rocky Mountain 0.97, Seattle 0.98, Colorado 0.98.

| Predicted 14-day change (bin avg) | Lower a week later | before 2022 / 2022+ | Avg 7-day move | Days |
|---|---|---|---|---|
| -12.60¢ | 82.7% | 88.0% / 79.1% | -4.17¢ | 22,599 |
| -4.96¢ | 71.8% | 77.4% / 63.9% | -1.25¢ | 7,425 |
| -2.99¢ | 69.1% | 72.5% / 64.6% | -1.08¢ | 8,538 |
| -1.51¢ | 61.1% | 60.7% / 61.6% | -0.28¢ | 4,616 |
| -0.48¢ | 56.1% | 55.0% / 57.7% | -0.05¢ | 4,493 |
| +0.51¢ | 50.5% | 50.1% / 51.0% | +0.46¢ | 4,792 |
| +1.51¢ | 43.4% | 41.2% / 46.7% | +1.15¢ | 5,367 |
| +2.97¢ | 37.0% | 33.9% / 43.2% | +1.80¢ | 10,391 |
| +4.98¢ | 29.6% | 26.4% / 34.9% | +2.16¢ | 9,209 |
| +12.11¢ | 22.5% | 17.6% / 27.0% | +4.34¢ | 28,130 |

**Diesel** — holdout Brier 0.1971 vs 0.2462 for the base rate; 0.1967 with per-area reliability fitted on the earlier years. Areas whose odds are scaled toward 50/50 (k < 1): Rocky Mountain 0.95, Midwest 0.97.

| Predicted 14-day change (bin avg) | Lower a week later | before 2022 / 2022+ | Avg 7-day move | Days |
|---|---|---|---|---|
| -12.81¢ | 88.2% | 95.2% / 84.7% | -4.59¢ | 8,621 |
| -5.00¢ | 78.8% | 85.3% / 72.6% | -1.40¢ | 2,602 |
| -2.99¢ | 72.1% | 72.5% / 71.5% | -0.95¢ | 2,828 |
| -1.47¢ | 60.9% | 57.4% / 69.2% | -0.40¢ | 1,736 |
| -0.47¢ | 53.8% | 50.3% / 61.1% | +0.73¢ | 2,248 |
| +0.49¢ | 47.8% | 45.2% / 54.1% | +0.94¢ | 2,353 |
| +1.50¢ | 39.7% | 36.0% / 48.2% | +1.07¢ | 2,065 |
| +2.98¢ | 36.4% | 32.9% / 45.9% | +1.15¢ | 4,144 |
| +4.96¢ | 29.3% | 22.8% / 44.7% | +1.55¢ | 3,388 |
| +13.12¢ | 20.3% | 12.4% / 25.5% | +6.22¢ | 10,055 |


## Regular

15,078 weekly decisions across 29 areas, 2016-10-03 → 2026-09-14. Wholesale lead: RBOB.

| Variant | 1wk MAE / no-change | 2wk MAE / no-change | Band 1wk / 2wk | Direction right | Saved vs always-now | Of oracle |
|---|---|---|---|---|---|---|
| Default (momentum + wholesale) | 4.99¢ / 5.52¢ | 9.59¢ / 9.20¢ | 68.0% / 67.3% | 72.1% (87.3% called) | 1.28¢ | 50.3% |
| Momentum only | 5.26¢ / 5.52¢ | 8.81¢ / 9.20¢ | 68.0% / 73.9% | 64.1% (51.2% called) | 0.67¢ | 26.2% |

Verdict mix: fill up now 50.7%, no rush 8.6%, wait 40.7%. "Wait" calls were right 77.5% of the time and saved 3.14¢/gal on average when made. Always waiting a week would have cost 0.45¢/gal relative to always buying now; the oracle saves 2.54¢/gal.

<details><summary>Per area</summary>

| Area | Saved vs always-now | Direction right | 1wk MAE / no-change |
|---|---|---|---|
| Florida | 1.51¢ | 71.1% | 6.60¢ / 7.08¢ |
| Lower Atlantic | 1.49¢ | 74.3% | 4.16¢ / 4.96¢ |
| Denver | 1.45¢ | 68.4% | 5.94¢ / 6.68¢ |
| Colorado | 1.41¢ | 69.4% | 5.58¢ / 6.28¢ |
| East Coast | 1.41¢ | 77.6% | 3.48¢ / 4.30¢ |
| Los Angeles | 1.40¢ | 70.3% | 5.34¢ / 5.98¢ |
| California | 1.40¢ | 71.1% | 5.03¢ / 5.74¢ |
| Texas | 1.39¢ | 71.5% | 5.49¢ / 6.15¢ |
| Gulf Coast | 1.38¢ | 73.8% | 4.59¢ / 5.25¢ |
| Chicago | 1.36¢ | 65.7% | 7.69¢ / 8.12¢ |
| New England | 1.33¢ | 78.1% | 3.17¢ / 3.87¢ |
| New York City | 1.32¢ | 76.2% | 3.79¢ / 4.41¢ |
| Houston | 1.31¢ | 75.2% | 4.11¢ / 4.54¢ |
| U.S. average | 1.30¢ | 74.6% | 3.70¢ / 4.36¢ |
| San Francisco | 1.29¢ | 70.0% | 5.64¢ / 6.20¢ |
| Miami | 1.29¢ | 71.3% | 5.55¢ / 6.00¢ |
| West Coast | 1.28¢ | 73.9% | 4.20¢ / 4.98¢ |
| Central Atlantic | 1.28¢ | 78.6% | 3.42¢ / 4.04¢ |
| Rocky Mountain | 1.27¢ | 72.4% | 4.11¢ / 4.79¢ |
| Midwest | 1.26¢ | 66.8% | 5.54¢ / 5.85¢ |
| Massachusetts | 1.24¢ | 76.1% | 3.35¢ / 3.82¢ |
| Minnesota | 1.22¢ | 70.9% | 4.41¢ / 4.89¢ |
| West Coast (excl. California) | 1.18¢ | 75.4% | 3.59¢ / 4.41¢ |
| Boston | 1.18¢ | 76.2% | 3.38¢ / 3.71¢ |
| New York | 1.17¢ | 77.5% | 3.38¢ / 3.75¢ |
| Washington | 1.16¢ | 74.6% | 3.94¢ / 4.56¢ |
| Cleveland | 1.05¢ | 59.0% | 9.57¢ / 9.23¢ |
| Seattle | 0.97¢ | 74.3% | 3.84¢ / 4.27¢ |
| Ohio | 0.72¢ | 56.5% | 12.20¢ / 11.99¢ |

</details>

<details><summary>Constant sweep (one at a time, others at default)</summary>

| Constant | Value | Saved vs always-now | Of oracle | Direction right | MAE 1wk / 2wk | Band 1wk / 2wk | Wait share |
|---|---|---|---|---|---|---|---|
| `passThrough` | 0 | 0.67¢ | 26.2% | 64.1% | 5.26¢ / 8.81¢ | 68.0% / 73.9% | 23.1% |
| `passThrough` | 0.35 | 1.24¢ | 49.0% | 73.4% | 4.71¢ / 8.04¢ | 73.5% / 78.2% | 35.5% |
| `passThrough` | 0.7 (default) | 1.28¢ | 50.3% | 72.1% | 4.99¢ / 9.59¢ | 68.0% / 67.3% | 40.7% |
| `passThrough` | 1 | 1.27¢ | 50.2% | 71.1% | 5.51¢ / 11.39¢ | 60.9% / 57.5% | 42.5% |
| `verdictMove` | 0.01 | 1.28¢ | 50.6% | 70.7% | 4.99¢ / 9.59¢ | 68.0% / 67.3% | 43.8% |
| `verdictMove` | 0.02 (default) | 1.28¢ | 50.3% | 72.1% | 4.99¢ / 9.59¢ | 68.0% / 67.3% | 40.7% |
| `verdictMove` | 0.03 | 1.26¢ | 49.6% | 73.0% | 4.99¢ / 9.59¢ | 68.0% / 67.3% | 37.6% |
| `verdictMove` | 0.05 | 1.18¢ | 46.5% | 75.1% | 4.99¢ / 9.59¢ | 68.0% / 67.3% | 31.1% |
| `momentumPoints` | 4 | 1.31¢ | 51.5% | 72.4% | 5.08¢ / 9.79¢ | 66.5% / 65.9% | 41.3% |
| `momentumPoints` | 6 (default) | 1.28¢ | 50.3% | 72.1% | 4.99¢ / 9.59¢ | 68.0% / 67.3% | 40.7% |
| `momentumPoints` | 8 | 1.24¢ | 48.8% | 71.5% | 5.00¢ / 9.53¢ | 68.6% / 68.1% | 40.6% |
| `momentumPoints` | 12 | 1.20¢ | 47.5% | 71.4% | 5.06¢ / 9.54¢ | 68.5% / 68.2% | 40.3% |
| `leadLookbackDays` | 5 | 1.30¢ | 51.1% | 73.1% | 4.60¢ / 8.43¢ | 73.2% / 74.7% | 38.4% |
| `leadLookbackDays` | 10 (default) | 1.28¢ | 50.3% | 72.1% | 4.99¢ / 9.59¢ | 68.0% / 67.3% | 40.7% |
| `leadLookbackDays` | 15 | 1.21¢ | 47.5% | 68.9% | 5.58¢ / 11.10¢ | 60.5% / 58.3% | 41.5% |
| `momentumDecayDays` | 5 | 1.27¢ | 50.1% | 71.8% | 4.90¢ / 9.43¢ | 68.8% / 68.1% | 40.8% |
| `momentumDecayDays` | 7 (default) | 1.28¢ | 50.3% | 72.1% | 4.99¢ / 9.59¢ | 68.0% / 67.3% | 40.7% |
| `momentumDecayDays` | 10 | 1.29¢ | 50.8% | 72.1% | 5.10¢ / 9.80¢ | 67.1% / 66.2% | 40.6% |
| `momentumDecayDays` | 14 | 1.28¢ | 50.6% | 71.9% | 5.19¢ / 10.04¢ | 66.1% / 65.0% | 40.7% |
| `momentumDecayDays` | 28 | 1.29¢ | 50.9% | 71.8% | 5.34¢ / 10.52¢ | 64.7% / 63.2% | 41.0% |
| `momentumDecayDays` | Infinity | 1.25¢ | 49.2% | 71.2% | 5.55¢ / 11.35¢ | 63.0% / 59.7% | 40.9% |
| `bandScale` | 1 (default) | 1.28¢ | 50.3% | 72.1% | 4.99¢ / 9.59¢ | 68.0% / 67.3% | 40.7% |
| `bandScale` | 1.25 | 1.28¢ | 50.3% | 72.1% | 4.99¢ / 9.59¢ | 77.7% / 76.4% | 40.7% |
| `bandExponent` | 0.5 | 1.28¢ | 50.3% | 72.1% | 4.99¢ / 9.59¢ | 68.0% / 52.7% | 40.7% |
| `bandExponent` | 0.65 | 1.28¢ | 50.3% | 72.1% | 4.99¢ / 9.59¢ | 68.0% / 57.3% | 40.7% |
| `bandExponent` | 0.8 | 1.28¢ | 50.3% | 72.1% | 4.99¢ / 9.59¢ | 68.0% / 61.6% | 40.7% |
| `bandExponent` | 1 (default) | 1.28¢ | 50.3% | 72.1% | 4.99¢ / 9.59¢ | 68.0% / 67.3% | 40.7% |

</details>

## Midgrade

15,076 weekly decisions across 29 areas, 2016-10-03 → 2026-09-14. Wholesale lead: RBOB.

| Variant | 1wk MAE / no-change | 2wk MAE / no-change | Band 1wk / 2wk | Direction right | Saved vs always-now | Of oracle |
|---|---|---|---|---|---|---|
| Default (momentum + wholesale) | 4.95¢ / 5.34¢ | 9.46¢ / 8.86¢ | 67.0% / 66.7% | 71.9% (87.2% called) | 1.19¢ | 49.1% |
| Momentum only | 5.12¢ / 5.34¢ | 8.49¢ / 8.86¢ | 68.1% / 74.9% | 64.2% (49.4% called) | 0.64¢ | 26.3% |

Verdict mix: fill up now 50.7%, no rush 8.8%, wait 40.5%. "Wait" calls were right 75.9% of the time and saved 2.94¢/gal on average when made. Always waiting a week would have cost 0.50¢/gal relative to always buying now; the oracle saves 2.42¢/gal.

<details><summary>Per area</summary>

| Area | Saved vs always-now | Direction right | 1wk MAE / no-change |
|---|---|---|---|
| Florida | 1.45¢ | 71.1% | 6.55¢ / 6.99¢ |
| Lower Atlantic | 1.41¢ | 75.3% | 4.00¢ / 4.73¢ |
| Denver | 1.38¢ | 68.4% | 6.10¢ / 6.72¢ |
| Chicago | 1.38¢ | 64.8% | 7.30¢ / 7.68¢ |
| Colorado | 1.37¢ | 69.1% | 5.93¢ / 6.52¢ |
| California | 1.36¢ | 71.6% | 5.06¢ / 5.66¢ |
| Los Angeles | 1.35¢ | 70.9% | 5.43¢ / 5.91¢ |
| Gulf Coast | 1.33¢ | 74.6% | 4.55¢ / 5.12¢ |
| Texas | 1.31¢ | 71.9% | 5.54¢ / 6.10¢ |
| East Coast | 1.30¢ | 76.8% | 3.38¢ / 4.06¢ |
| San Francisco | 1.30¢ | 68.4% | 5.57¢ / 6.12¢ |
| U.S. average | 1.25¢ | 76.2% | 3.52¢ / 4.13¢ |
| West Coast | 1.24¢ | 73.7% | 4.34¢ / 5.00¢ |
| Miami | 1.23¢ | 70.3% | 5.56¢ / 5.79¢ |
| Minnesota | 1.22¢ | 71.3% | 4.57¢ / 4.98¢ |
| Rocky Mountain | 1.21¢ | 71.3% | 4.50¢ / 5.13¢ |
| Midwest | 1.20¢ | 65.7% | 5.71¢ / 5.95¢ |
| Central Atlantic | 1.19¢ | 76.7% | 3.40¢ / 3.88¢ |
| New York City | 1.17¢ | 74.7% | 3.72¢ / 4.12¢ |
| Houston | 1.17¢ | 73.9% | 3.96¢ / 4.22¢ |
| Washington | 1.13¢ | 77.4% | 3.85¢ / 4.33¢ |
| West Coast (excl. California) | 1.12¢ | 76.2% | 3.51¢ / 4.22¢ |
| New York | 1.10¢ | 75.3% | 3.50¢ / 3.74¢ |
| New England | 1.06¢ | 77.5% | 3.04¢ / 3.35¢ |
| Massachusetts | 0.94¢ | 75.4% | 3.21¢ / 3.30¢ |
| Cleveland | 0.92¢ | 58.9% | 8.67¢ / 8.30¢ |
| Boston | 0.92¢ | 75.9% | 3.34¢ / 3.31¢ |
| Seattle | 0.87¢ | 74.3% | 3.87¢ / 4.02¢ |
| Ohio | 0.66¢ | 56.6% | 11.80¢ / 11.60¢ |

</details>

<details><summary>Constant sweep (one at a time, others at default)</summary>

| Constant | Value | Saved vs always-now | Of oracle | Direction right | MAE 1wk / 2wk | Band 1wk / 2wk | Wait share |
|---|---|---|---|---|---|---|---|
| `passThrough` | 0 | 0.64¢ | 26.3% | 64.2% | 5.12¢ / 8.49¢ | 68.1% / 74.9% | 21.8% |
| `passThrough` | 0.35 | 1.16¢ | 47.8% | 73.5% | 4.62¢ / 7.82¢ | 73.0% / 78.4% | 34.7% |
| `passThrough` | 0.7 (default) | 1.19¢ | 49.1% | 71.9% | 4.95¢ / 9.46¢ | 67.0% / 66.7% | 40.5% |
| `passThrough` | 1 | 1.18¢ | 48.9% | 70.9% | 5.49¢ / 11.33¢ | 59.3% / 56.2% | 42.4% |
| `verdictMove` | 0.01 | 1.20¢ | 49.3% | 70.7% | 4.95¢ / 9.46¢ | 67.0% / 66.7% | 43.6% |
| `verdictMove` | 0.02 (default) | 1.19¢ | 49.1% | 71.9% | 4.95¢ / 9.46¢ | 67.0% / 66.7% | 40.5% |
| `verdictMove` | 0.03 | 1.17¢ | 48.3% | 73.0% | 4.95¢ / 9.46¢ | 67.0% / 66.7% | 37.4% |
| `verdictMove` | 0.05 | 1.10¢ | 45.3% | 74.8% | 4.95¢ / 9.46¢ | 67.0% / 66.7% | 30.8% |
| `momentumPoints` | 4 | 1.24¢ | 51.0% | 72.1% | 5.04¢ / 9.67¢ | 65.1% / 65.2% | 41.0% |
| `momentumPoints` | 6 (default) | 1.19¢ | 49.1% | 71.9% | 4.95¢ / 9.46¢ | 67.0% / 66.7% | 40.5% |
| `momentumPoints` | 8 | 1.15¢ | 47.6% | 71.4% | 4.95¢ / 9.41¢ | 67.4% / 67.3% | 40.2% |
| `momentumPoints` | 12 | 1.12¢ | 46.1% | 71.2% | 5.01¢ / 9.43¢ | 67.5% / 67.4% | 40.1% |
| `leadLookbackDays` | 5 | 1.20¢ | 49.4% | 72.8% | 4.53¢ / 8.28¢ | 72.3% / 74.2% | 37.8% |
| `leadLookbackDays` | 10 (default) | 1.19¢ | 49.1% | 71.9% | 4.95¢ / 9.46¢ | 67.0% / 66.7% | 40.5% |
| `leadLookbackDays` | 15 | 1.13¢ | 46.7% | 69.1% | 5.52¢ / 10.98¢ | 59.5% / 57.5% | 41.4% |
| `momentumDecayDays` | 5 | 1.18¢ | 48.6% | 71.6% | 4.86¢ / 9.33¢ | 67.8% / 67.2% | 40.6% |
| `momentumDecayDays` | 7 (default) | 1.19¢ | 49.1% | 71.9% | 4.95¢ / 9.46¢ | 67.0% / 66.7% | 40.5% |
| `momentumDecayDays` | 10 | 1.20¢ | 49.5% | 71.9% | 5.04¢ / 9.66¢ | 65.9% / 65.7% | 40.3% |
| `momentumDecayDays` | 14 | 1.20¢ | 49.6% | 71.8% | 5.13¢ / 9.89¢ | 65.1% / 64.7% | 40.4% |
| `momentumDecayDays` | 28 | 1.21¢ | 49.8% | 71.6% | 5.28¢ / 10.34¢ | 63.8% / 62.7% | 40.6% |
| `momentumDecayDays` | Infinity | 1.17¢ | 48.3% | 71.1% | 5.47¢ / 11.12¢ | 62.1% / 59.6% | 40.5% |
| `bandScale` | 1 (default) | 1.19¢ | 49.1% | 71.9% | 4.95¢ / 9.46¢ | 67.0% / 66.7% | 40.5% |
| `bandScale` | 1.25 | 1.19¢ | 49.1% | 71.9% | 4.95¢ / 9.46¢ | 76.9% / 75.6% | 40.5% |
| `bandExponent` | 0.5 | 1.19¢ | 49.1% | 71.9% | 4.95¢ / 9.46¢ | 67.0% / 51.5% | 40.5% |
| `bandExponent` | 0.65 | 1.19¢ | 49.1% | 71.9% | 4.95¢ / 9.46¢ | 67.0% / 56.1% | 40.5% |
| `bandExponent` | 0.8 | 1.19¢ | 49.1% | 71.9% | 4.95¢ / 9.46¢ | 67.0% / 60.7% | 40.5% |
| `bandExponent` | 1 (default) | 1.19¢ | 49.1% | 71.9% | 4.95¢ / 9.46¢ | 67.0% / 66.7% | 40.5% |

</details>

## Premium

15,077 weekly decisions across 29 areas, 2016-10-03 → 2026-09-14. Wholesale lead: RBOB.

| Variant | 1wk MAE / no-change | 2wk MAE / no-change | Band 1wk / 2wk | Direction right | Saved vs always-now | Of oracle |
|---|---|---|---|---|---|---|
| Default (momentum + wholesale) | 4.86¢ / 5.30¢ | 9.40¢ / 8.86¢ | 67.3% / 66.4% | 72.4% (87.2% called) | 1.19¢ | 49.8% |
| Momentum only | 5.05¢ / 5.30¢ | 8.46¢ / 8.86¢ | 68.0% / 74.5% | 65.1% (49.3% called) | 0.64¢ | 26.8% |

Verdict mix: fill up now 50.7%, no rush 8.8%, wait 40.4%. "Wait" calls were right 76.4% of the time and saved 2.94¢/gal on average when made. Always waiting a week would have cost 0.52¢/gal relative to always buying now; the oracle saves 2.39¢/gal.

<details><summary>Per area</summary>

| Area | Saved vs always-now | Direction right | 1wk MAE / no-change |
|---|---|---|---|
| Florida | 1.43¢ | 70.8% | 6.11¢ / 6.56¢ |
| Lower Atlantic | 1.38¢ | 74.3% | 3.94¢ / 4.62¢ |
| Denver | 1.38¢ | 69.6% | 5.69¢ / 6.39¢ |
| California | 1.37¢ | 71.1% | 5.16¢ / 5.85¢ |
| Los Angeles | 1.37¢ | 70.6% | 5.44¢ / 5.98¢ |
| Colorado | 1.35¢ | 70.0% | 5.57¢ / 6.22¢ |
| Texas | 1.31¢ | 71.7% | 5.44¢ / 6.00¢ |
| Gulf Coast | 1.30¢ | 74.9% | 4.60¢ / 5.17¢ |
| East Coast | 1.28¢ | 76.4% | 3.33¢ / 4.01¢ |
| Chicago | 1.28¢ | 66.8% | 7.49¢ / 7.84¢ |
| U.S. average | 1.26¢ | 76.6% | 3.49¢ / 4.14¢ |
| West Coast | 1.26¢ | 72.8% | 4.43¢ / 5.17¢ |
| San Francisco | 1.24¢ | 68.5% | 5.52¢ / 6.09¢ |
| Rocky Mountain | 1.23¢ | 74.9% | 4.06¢ / 4.74¢ |
| Houston | 1.21¢ | 75.5% | 3.91¢ / 4.26¢ |
| New York City | 1.21¢ | 76.2% | 3.74¢ / 4.21¢ |
| Midwest | 1.20¢ | 67.8% | 5.42¢ / 5.77¢ |
| Central Atlantic | 1.20¢ | 77.5% | 3.44¢ / 3.96¢ |
| Minnesota | 1.16¢ | 71.6% | 4.29¢ / 4.77¢ |
| Washington | 1.13¢ | 74.8% | 3.85¢ / 4.47¢ |
| West Coast (excl. California) | 1.12¢ | 75.2% | 3.52¢ / 4.26¢ |
| Miami | 1.10¢ | 70.0% | 4.95¢ / 5.11¢ |
| New York | 1.10¢ | 77.0% | 3.56¢ / 3.85¢ |
| New England | 1.09¢ | 79.7% | 3.03¢ / 3.41¢ |
| Boston | 0.99¢ | 77.1% | 3.31¢ / 3.35¢ |
| Massachusetts | 0.97¢ | 78.8% | 3.24¢ / 3.36¢ |
| Cleveland | 0.95¢ | 60.0% | 8.81¢ / 8.42¢ |
| Seattle | 0.91¢ | 73.8% | 3.91¢ / 4.34¢ |
| Ohio | 0.74¢ | 55.8% | 11.64¢ / 11.42¢ |

</details>

<details><summary>Constant sweep (one at a time, others at default)</summary>

| Constant | Value | Saved vs always-now | Of oracle | Direction right | MAE 1wk / 2wk | Band 1wk / 2wk | Wait share |
|---|---|---|---|---|---|---|---|
| `passThrough` | 0 | 0.64¢ | 26.8% | 65.1% | 5.05¢ / 8.46¢ | 68.0% / 74.5% | 21.8% |
| `passThrough` | 0.35 | 1.17¢ | 49.0% | 74.0% | 4.54¢ / 7.74¢ | 73.0% / 78.3% | 34.8% |
| `passThrough` | 0.7 (default) | 1.19¢ | 49.8% | 72.4% | 4.86¢ / 9.40¢ | 67.3% / 66.4% | 40.4% |
| `passThrough` | 1 | 1.19¢ | 49.6% | 71.4% | 5.40¢ / 11.27¢ | 59.7% / 56.2% | 42.4% |
| `verdictMove` | 0.01 | 1.20¢ | 50.2% | 71.2% | 4.86¢ / 9.40¢ | 67.3% / 66.4% | 43.4% |
| `verdictMove` | 0.02 (default) | 1.19¢ | 49.8% | 72.4% | 4.86¢ / 9.40¢ | 67.3% / 66.4% | 40.4% |
| `verdictMove` | 0.03 | 1.17¢ | 48.9% | 73.2% | 4.86¢ / 9.40¢ | 67.3% / 66.4% | 37.5% |
| `verdictMove` | 0.05 | 1.10¢ | 45.9% | 75.3% | 4.86¢ / 9.40¢ | 67.3% / 66.4% | 30.8% |
| `momentumPoints` | 4 | 1.23¢ | 51.5% | 72.8% | 4.94¢ / 9.60¢ | 65.5% / 65.0% | 41.1% |
| `momentumPoints` | 6 (default) | 1.19¢ | 49.8% | 72.4% | 4.86¢ / 9.40¢ | 67.3% / 66.4% | 40.4% |
| `momentumPoints` | 8 | 1.15¢ | 48.2% | 71.9% | 4.87¢ / 9.35¢ | 67.9% / 66.9% | 40.2% |
| `momentumPoints` | 12 | 1.13¢ | 47.1% | 71.7% | 4.92¢ / 9.37¢ | 67.7% / 67.3% | 40.1% |
| `leadLookbackDays` | 5 | 1.19¢ | 50.0% | 73.0% | 4.47¢ / 8.22¢ | 72.6% / 74.5% | 37.8% |
| `leadLookbackDays` | 10 (default) | 1.19¢ | 49.8% | 72.4% | 4.86¢ / 9.40¢ | 67.3% / 66.4% | 40.4% |
| `leadLookbackDays` | 15 | 1.14¢ | 47.7% | 69.5% | 5.45¢ / 10.92¢ | 59.7% / 57.3% | 41.3% |
| `momentumDecayDays` | 5 | 1.18¢ | 49.3% | 72.2% | 4.77¢ / 9.26¢ | 68.3% / 67.0% | 40.6% |
| `momentumDecayDays` | 7 (default) | 1.19¢ | 49.8% | 72.4% | 4.86¢ / 9.40¢ | 67.3% / 66.4% | 40.4% |
| `momentumDecayDays` | 10 | 1.20¢ | 50.1% | 72.5% | 4.95¢ / 9.60¢ | 66.3% / 65.5% | 40.3% |
| `momentumDecayDays` | 14 | 1.20¢ | 50.3% | 72.4% | 5.04¢ / 9.82¢ | 65.4% / 64.2% | 40.3% |
| `momentumDecayDays` | 28 | 1.21¢ | 50.5% | 72.1% | 5.19¢ / 10.27¢ | 63.9% / 62.3% | 40.6% |
| `momentumDecayDays` | Infinity | 1.18¢ | 49.3% | 71.6% | 5.38¢ / 11.05¢ | 62.5% / 59.3% | 40.4% |
| `bandScale` | 1 (default) | 1.19¢ | 49.8% | 72.4% | 4.86¢ / 9.40¢ | 67.3% / 66.4% | 40.4% |
| `bandScale` | 1.25 | 1.19¢ | 49.8% | 72.4% | 4.86¢ / 9.40¢ | 77.0% / 75.2% | 40.4% |
| `bandExponent` | 0.5 | 1.19¢ | 49.8% | 72.4% | 4.86¢ / 9.40¢ | 67.3% / 51.8% | 40.4% |
| `bandExponent` | 0.65 | 1.19¢ | 49.8% | 72.4% | 4.86¢ / 9.40¢ | 67.3% / 56.1% | 40.4% |
| `bandExponent` | 0.8 | 1.19¢ | 49.8% | 72.4% | 4.86¢ / 9.40¢ | 67.3% / 60.8% | 40.4% |
| `bandExponent` | 1 (default) | 1.19¢ | 49.8% | 72.4% | 4.86¢ / 9.40¢ | 67.3% / 66.4% | 40.4% |

</details>

## Diesel

5,720 weekly decisions across 11 areas, 2016-10-03 → 2026-09-14. Wholesale lead: ULSD.

| Variant | 1wk MAE / no-change | 2wk MAE / no-change | Band 1wk / 2wk | Direction right | Saved vs always-now | Of oracle |
|---|---|---|---|---|---|---|
| Default (momentum + wholesale) | 4.19¢ / 4.73¢ | 8.92¢ / 8.51¢ | 68.4% / 63.2% | 75.4% (83.4% called) | 1.28¢ | 65.3% |
| Momentum only | 4.37¢ / 4.73¢ | 8.00¢ / 8.51¢ | 72.0% / 74.0% | 70.6% (45.1% called) | 0.64¢ | 32.8% |

Verdict mix: fill up now 50.6%, no rush 11.5%, wait 38.0%. "Wait" calls were right 82.0% of the time and saved 3.37¢/gal on average when made. Always waiting a week would have cost 0.82¢/gal relative to always buying now; the oracle saves 1.96¢/gal.

<details><summary>Per area</summary>

| Area | Saved vs always-now | Direction right | 1wk MAE / no-change |
|---|---|---|---|
| Midwest | 1.38¢ | 71.6% | 4.77¢ / 5.46¢ |
| California | 1.32¢ | 76.1% | 4.39¢ / 4.89¢ |
| West Coast | 1.31¢ | 76.9% | 4.29¢ / 4.90¢ |
| West Coast (excl. California) | 1.30¢ | 75.5% | 4.57¢ / 5.19¢ |
| Gulf Coast | 1.29¢ | 71.5% | 4.52¢ / 5.01¢ |
| U.S. average | 1.28¢ | 73.5% | 4.13¢ / 4.80¢ |
| Lower Atlantic | 1.26¢ | 74.5% | 4.38¢ / 4.76¢ |
| Central Atlantic | 1.25¢ | 79.9% | 3.48¢ / 4.07¢ |
| East Coast | 1.24¢ | 76.4% | 3.88¢ / 4.40¢ |
| Rocky Mountain | 1.24¢ | 74.3% | 4.19¢ / 4.75¢ |
| New England | 1.20¢ | 78.9% | 3.48¢ / 3.81¢ |

</details>

<details><summary>Constant sweep (one at a time, others at default)</summary>

| Constant | Value | Saved vs always-now | Of oracle | Direction right | MAE 1wk / 2wk | Band 1wk / 2wk | Wait share |
|---|---|---|---|---|---|---|---|
| `passThrough` | 0 | 0.64¢ | 32.8% | 70.6% | 4.37¢ / 8.00¢ | 72.0% / 74.0% | 20.7% |
| `passThrough` | 0.35 | 1.17¢ | 59.8% | 76.6% | 3.75¢ / 7.27¢ | 78.1% / 78.5% | 32.9% |
| `passThrough` | 0.7 (default) | 1.28¢ | 65.3% | 75.4% | 4.19¢ / 8.92¢ | 68.4% / 63.2% | 38.0% |
| `passThrough` | 1 | 1.27¢ | 65.1% | 74.9% | 4.80¢ / 10.62¢ | 59.0% / 52.3% | 40.1% |
| `verdictMove` | 0.01 | 1.29¢ | 66.1% | 74.3% | 4.19¢ / 8.92¢ | 68.4% / 63.2% | 41.4% |
| `verdictMove` | 0.02 (default) | 1.28¢ | 65.3% | 75.4% | 4.19¢ / 8.92¢ | 68.4% / 63.2% | 38.0% |
| `verdictMove` | 0.03 | 1.24¢ | 63.2% | 76.1% | 4.19¢ / 8.92¢ | 68.4% / 63.2% | 33.7% |
| `verdictMove` | 0.05 | 1.16¢ | 59.2% | 77.4% | 4.19¢ / 8.92¢ | 68.4% / 63.2% | 28.5% |
| `momentumPoints` | 4 | 1.30¢ | 66.3% | 75.4% | 4.35¢ / 9.22¢ | 66.2% / 61.9% | 38.5% |
| `momentumPoints` | 6 (default) | 1.28¢ | 65.3% | 75.4% | 4.19¢ / 8.92¢ | 68.4% / 63.2% | 38.0% |
| `momentumPoints` | 8 | 1.25¢ | 63.8% | 74.9% | 4.14¢ / 8.78¢ | 69.1% / 63.6% | 37.3% |
| `momentumPoints` | 12 | 1.22¢ | 62.3% | 74.1% | 4.19¢ / 8.82¢ | 69.9% / 63.7% | 37.0% |
| `leadLookbackDays` | 5 | 1.27¢ | 65.0% | 74.6% | 3.74¢ / 7.63¢ | 76.0% / 72.7% | 36.9% |
| `leadLookbackDays` | 10 (default) | 1.28¢ | 65.3% | 75.4% | 4.19¢ / 8.92¢ | 68.4% / 63.2% | 38.0% |
| `leadLookbackDays` | 15 | 1.12¢ | 57.3% | 72.8% | 4.94¢ / 10.72¢ | 59.0% / 53.3% | 39.8% |
| `momentumDecayDays` | 5 | 1.27¢ | 64.7% | 75.2% | 4.12¢ / 8.78¢ | 69.1% / 64.2% | 37.5% |
| `momentumDecayDays` | 7 (default) | 1.28¢ | 65.3% | 75.4% | 4.19¢ / 8.92¢ | 68.4% / 63.2% | 38.0% |
| `momentumDecayDays` | 10 | 1.24¢ | 63.1% | 75.3% | 4.27¢ / 9.12¢ | 67.2% / 62.1% | 38.0% |
| `momentumDecayDays` | 14 | 1.22¢ | 62.3% | 75.2% | 4.35¢ / 9.34¢ | 66.6% / 61.0% | 37.8% |
| `momentumDecayDays` | 28 | 1.21¢ | 62.0% | 74.6% | 4.49¢ / 9.78¢ | 65.3% / 58.7% | 37.6% |
| `momentumDecayDays` | Infinity | 1.17¢ | 59.9% | 73.8% | 4.67¢ / 10.52¢ | 63.1% / 55.4% | 37.9% |
| `bandScale` | 1 (default) | 1.28¢ | 65.3% | 75.4% | 4.19¢ / 8.92¢ | 68.4% / 63.2% | 38.0% |
| `bandScale` | 1.25 | 1.28¢ | 65.3% | 75.4% | 4.19¢ / 8.92¢ | 77.6% / 72.0% | 38.0% |
| `bandExponent` | 0.5 | 1.28¢ | 65.3% | 75.4% | 4.19¢ / 8.92¢ | 68.4% / 49.1% | 38.0% |
| `bandExponent` | 0.65 | 1.28¢ | 65.3% | 75.4% | 4.19¢ / 8.92¢ | 68.4% / 53.9% | 38.0% |
| `bandExponent` | 0.8 | 1.28¢ | 65.3% | 75.4% | 4.19¢ / 8.92¢ | 68.4% / 57.9% | 38.0% |
| `bandExponent` | 1 (default) | 1.28¢ | 65.3% | 75.4% | 4.19¢ / 8.92¢ | 68.4% / 63.2% | 38.0% |

</details>

## Caveats

- No outlook anchor in the test (see Method), so the 2-week numbers on the live site blend in one more signal than is measured here.
- Weekly area averages, not station prices. A driver who shops around can beat any of these numbers.
- Diesel is reported for the U.S., the regions and California only (11 areas), so its sample is smaller and more regional.
- The decision metric assumes the tank can wait a week. If it cannot, only the "now" and "no rush" verdicts apply.
- Past behaviour of gas prices does not guarantee future behaviour. This is a calibration aid, not a promise.
