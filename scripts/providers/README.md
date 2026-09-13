# Data providers

The website never talks to a price API directly. `scripts/fetch-data.mjs` calls one
provider module, validates the result, and writes `data/prices.json`, which the
browser loads. To switch sources you only change the provider — the UI and the
prediction logic stay the same.

## Contract

A provider is a module in this folder exporting:

```js
export async function fetchPrices({ apiKey }) { ... }
```

that resolves to:

```jsonc
{
  "generatedAt": "2026-09-13T21:00:00Z",
  "source": { "id": "eia", "name": "...", "url": "...", "cadence": "weekly", "note": "..." },
  "areas": {
    "STX": {                      // area ids must match js/regions.js (AREAS)
      "name": "Texas",
      "kind": "state",            // national | metro | state | region
      "padd": "R30",              // region used for the outlook
      "weekly": [ { "date": "2026-09-07", "price": 3.618 } ],   // oldest → newest
      "daily":  [ { "date": "2026-09-12", "price": 3.62 } ]     // optional; preferred by the UI when present
    }
  },
  "outlook": {                    // monthly forecast, $/gal, keyed by padd id (may be empty {})
    "R30": [ { "month": "2026-10", "price": 3.59 } ]
  },
  "wholesale": {                  // daily spot prices, oldest → newest
    "wti":  [ { "date": "2026-09-09", "price": 97.26 } ],       // $/bbl (optional)
    "rbob": [ { "date": "2026-09-09", "price": 3.289 } ]        // $/gal, required
  }
}
```

Prices are dollars per gallon. Every area needs at least 8 points of history.

## Adding a paid / daily provider later

1. Create `scripts/providers/<name>.mjs` implementing `fetchPrices`. If the API gives
   station-level or daily state prices, aggregate them per area and fill `daily`
   (keep `weekly` too if you have it — the chart and model use whichever is present).
   You can keep calling the EIA provider for `outlook` and `wholesale` and merge the
   results — see `eia.mjs` for the requests.
2. Add any new area ids to `js/regions.js` (`AREAS`, and the `STATES` map so
   geolocation and the state dropdown find them).
3. Put the API key in a repository secret and pass it through in
   `.github/workflows/update-data.yml` (add an `env:` line next to `EIA_API_KEY`).
4. Set the repository variable `DATA_PROVIDER=<name>` (Settings → Secrets and
   variables → Actions → Variables). The next scheduled run switches over; no code
   changes to the site are needed.

Candidate sources when you're ready to spend money: CollectAPI gas prices (state-level,
daily, small free tier), OPIS/GasBuddy commercial feeds (station-level).
