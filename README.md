# ⛽ Full Tank

**Should you fill up today, or wait?** Full Tank shows today's average gas price
for your area, tomorrow's and this week's predicted prices, a deal score, and where
prices are headed — using free public data, hosted for free on GitHub Pages.

- **Data:** U.S. Energy Information Administration (EIA) — weekly retail regular
  gasoline prices for the U.S., 5 regions (+3 East Coast sub-regions), 9 states and
  10 metros; EIA's official monthly price outlook; daily wholesale gasoline (RBOB) and
  crude (WTI) spot prices.
- **Predictions:** a transparent heuristic (recent momentum + wholesale pass-through +
  EIA outlook trajectory) with an uncertainty band. See "How this works" on the page
  and `js/predict.js`.
- **Stack:** plain HTML/CSS/JS, no build step. Chart.js from a CDN. A GitHub Actions
  cron job refreshes `data/prices.json` daily.

## Setup (about 10 minutes, $0)

1. **Create a GitHub repository** and push this folder to the `main` branch.
2. **Get a free EIA API key:** <https://www.eia.gov/opendata/register.php> (instant, by email).
3. **Add the key as a secret:** repo → Settings → Secrets and variables → Actions →
   *New repository secret* → name `EIA_API_KEY`, value = your key.
4. **Enable GitHub Pages:** repo → Settings → Pages → *Build and deployment* → Source:
   **GitHub Actions**. The `Deploy to GitHub Pages` workflow runs on every push to `main`.
5. **Run the data job once:** repo → Actions → *Update price data* → *Run workflow*.
   It commits a fresh `data/prices.json`, which triggers a redeploy. It then runs
   itself every day at 21:00 UTC.

Your site will be at `https://<your-username>.github.io/<repo-name>/`.
(Without the secret the job still works using EIA's rate-limited `DEMO_KEY`, but get a
real key — it's free.)

## Local development

Modules must be served over HTTP (not opened as a file):

```bash
python -m http.server 8765
```

then open <http://localhost:8765>. To refresh the data locally:

```bash
node scripts/fetch-data.mjs
```

Tests for the prediction logic and region mapping:

```bash
node --test scripts/test-predict.mjs
```

## Project layout

```
index.html              the page
css/style.css           styles (light + dark)
js/app.js               UI wiring, area selection, geolocation
js/regions.js           area catalog, state → area map, centroids
js/predict.js           prediction model + deal score (pure, tested)
js/chart.js             trend chart
data/prices.json        generated data (committed by the Actions job)
scripts/fetch-data.mjs  fetches from the provider, validates, writes data/prices.json
scripts/providers/      data providers (EIA today; add a paid one later — see README there)
.github/workflows/      daily data refresh + Pages deploy
```

## Upgrading the data source later

Everything the site needs is defined by the JSON shape in
`scripts/providers/README.md`. To move to a daily/station-level paid API, write one
provider module, add its key as a secret, and set the `DATA_PROVIDER` repository
variable. No changes to the site itself.

## Disclaimer

Full Tank exists only to help you decide when to buy gas. Prices are area-wide
averages and predictions are estimates that are **not guaranteed**. Not financial
advice.
