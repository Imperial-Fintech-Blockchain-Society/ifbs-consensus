# How the paper fund works

The fund starts with **$100,000 of simulated USD cash**. Buying and selling update a database ledger using CoinGecko prices. No real tokens or money move, and the simulation does not include trading fees or slippage.

## Investing after a pitch expires

A pitch has a **three-day voting window**. Voting stops at its expiry timestamp, but the investment happens when the next successful scheduler run processes it.

A pitch passes with **at least five votes and strictly more than 50% agreement**. Ties and missing quorum are rejected. An approved investment requires enough cash and cannot push the original cost of open positions above **$100,000**. Each pitch can invest up to **$10,000**.

If capital is unavailable, the pitch becomes `QUEUED` and is retried later. If a valid price is unavailable, execution is also retried. Voting stays closed in both cases.

The resolver uses the USD quote available when execution occurs, then calculates:

```text
Quantity = investment amount / entry price
```

For example, **$10,000 invested at $100 per token** creates a position holding **100 tokens**.

The app creates an `OPEN` position, subtracts the investment from cash, adds it to allocated capital, and marks the pitch `PASSED`. These changes happen together in a transaction. Row locks and a unique position-per-pitch constraint prevent duplicate investments.

Code: [pitch creation](src/app/api/pitches/route.ts), [voting deadline](src/app/api/pitches/[id]/votes/route.ts), [approval rules](src/lib/rules.ts), [execution and queuing](src/lib/engine.ts) (`resolvePitches`).

## Closing through a member vote

A member can announce a closing vote from an open position and explain why it should close. The proposer chooses a **1–24 hour voting window**. Each member can cast one reasoned vote. Only one closing proposal can be pending per position.

After the deadline, a **strict majority of votes cast** approves closing; no five-vote quorum applies. Ties and ballots with no votes leave the position open. A rejected proposal allows members to announce another closing vote.

An approved vote is the only way to close an investment. Market price changes never close positions automatically. The resolver closes the entire position at the **observed market quote** after voting ends. Invalid or stale prices leave an approved proposal pending for retry, with voting closed.

On closing, the app calculates `proceeds = exit price × quantity`, rounded to cents. It records the exit price, time, and reason; returns the proceeds to cash; and releases the original allocation. Locks and an `OPEN` status check prevent proceeds being credited twice.

For the example above, selling 100 tokens at $130 returns **$13,000**, realizing a **$3,000 profit**. Selling at $90 returns **$9,000**, realizing a **$1,000 loss**. Both exits release the original **$10,000 allocation**.

Code: [closing proposals](src/app/api/positions/[id]/close-proposals/route.ts), [vote resolution](src/lib/engine.ts) (`resolveCloseProposals`), [closing and cash updates](src/lib/fund.ts) (`closePosition`).

## Holdings and performance on `/fund`

The public page calculates:

```text
Crypto holding value = total token quantity × current USD price
Fund value           = cash + value of all open crypto holdings
Fund return (%)      = (fund value / initial capital − 1) × 100
Holding weight (%)   = holding value / fund value × 100
```

Positions in the same token are grouped by CoinGecko coin ID. Cash appears as a separate USD holding. Closed positions are excluded because their proceeds are already in cash. Allocated capital tracks invested cost for the capital limit; it is not added to fund value.

Return includes **realized gains and losses through cash**, and **unrealized gains and losses through open holdings**. Assuming our example is the only investment:

| State | Cash | Crypto value | Fund value | Fund return |
| --- | ---: | ---: | ---: | ---: |
| Before investing | $100,000 | $0 | $100,000 | 0% |
| Bought at $100 | $90,000 | $10,000 | $100,000 | 0% |
| Token valued at $120 | $90,000 | $12,000 | $102,000 | +2% |
| Closed at $130 | $103,000 | $0 | $103,000 | +3% |

Alternatively, an approved closing vote executing at $90 leaves **$99,000 cash and a −1% fund return**. The fund return reflects the investment's size: a 30% gain on a $10,000 position adds 3% to a $100,000 fund.

The pie chart shows current USD weights. The line chart shows percentage return against starting capital, using saved valuations plus the latest displayed valuation. Its points show timestamps, fund values, and returns; connecting lines do not represent recorded prices between observations.

The monitor saves complete fund valuations, at most once per minute. Visiting or refreshing `/fund` does not save history or execute trades. History begins when this feature is installed; past market values are not backfilled. The migration adds an initial cash valuation only if no crypto positions are open.

Code: [public data loading and snapshots](src/lib/public-fund.ts), [holding valuations](src/lib/fund-valuation.ts), [charts and return calculations](src/components/public-fund.tsx), [snapshot migration](prisma/migrations/20261003150000_fund_performance/migration.sql).

## Timing and price reliability

- The [scheduled workflow](.github/workflows/consensus-jobs.yml) is configured to run `resolve`, then `monitor`, every **ten minutes**. It requires a working deployment, enabled workflow, and correct `APP_URL` and `CRON_SECRET` secrets.
- Within resolution, closing votes run before pitch investments, so released cash can fund queued pitches in the same run. If resolution keeps failing after retries, the workflow stops before monitoring.
- The public page refreshes every **60 seconds**. Valuation quotes and the public API response can also be cached for 60 seconds.
- Execution quotes must be finite, at least **$0.0000000001**, no more than **five minutes old**, and no more than **one minute into the future**.
- If any open holding lacks a valid current quote, fund value, return, and pie allocation are unavailable. Existing history remains visible, and no incomplete snapshot is saved.

Code: [price fetching and execution validation](src/lib/coingecko.ts), [valuation validation](src/lib/fund-valuation.ts), [public API](src/app/api/fund/route.ts), [scheduler endpoint](src/app/api/cron/[job]/route.ts).
