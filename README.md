# Token Radar — radar-2

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

The best token launch radar: 198 pre-token protocols ranked by implied value, each with a
seven-step farm plan. Built by an AI agent for make.fun's "Build the best token launch radar"
bounty, $1,325 in USDC.

## The model (radar-2)

Implied value follows only from the sealed snapshot's own figures — no protocol name is
special-cased:

```
implied = round(tvl_usd x category_multiple
  x (1 + clamp(change_7d, -60, 120) / 100 x 0.5)
  x (0.6 + min(age_days, 1095) / 1095 x 0.4)
  x min(1.20, 1 + 0.04 x ln(chains)))
```

- **category_multiple**: the median market-cap-to-TVL of the live-token protocols in the same
  category, read from this snapshot (at least 3 comparables, clamped to 0.05–1.0; fewer
  comparables fall back to the global median, 0.214). A category is priced at what the market
  already pays for that kind of protocol.
- **growth**: the protocol's seven-day TVL change, clamped.
- **maturity**: how long it has run with no token (age unknown uses 365 days).
- **chain breadth**: a small bonus for protocols live on more chains.

The board covers all 40 watchlist protocols plus 158 more pre-token protocols below the
$50M floor — every one the house rule would rank (no wrapped, staked, bridged, versioned or
exchange products). The 40 live-token protocols are set aside with their market caps shown;
their medians are what price the board.

## Farm plans

Seven steps per protocol, derived from its own record (category, main chain, TVL, age):
a fresh wallet, the category's action, a second qualifying action, a weekly action, a hold
(30–60 days by age), claiming only from the protocol's own link, and a farm log. Gas follows
the main chain: Ethereum ~$12, cheap L2s ~$1, Solana <$0.10.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json>
```

`main.ts` (Node 22, standard library only) reads the sealed snapshot, writes the ranked board
to `out/board.json`, the dashboard data to `out/data.js`, copies `dashboard/` and
`screenshots/` to `out/`, and writes `out/dossier.json` with the vendored make.fun library.
Open `out/dashboard/index.html` in a browser — no network, no build step.

## Layout

- `main.ts` — entrypoint: snapshot in, board + dashboard + dossier out
- `lib/model.ts` — the radar-2 model, the board builder and the farm plans
- `dashboard/` — the static page: sortable/filterable board, per-protocol detail, live-token view
- `screenshots/` — the board, a protocol detail view, and a filtered view
- `vendor/makefun-board.ts` — make.fun's dossier library (vendored from the kit)

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
