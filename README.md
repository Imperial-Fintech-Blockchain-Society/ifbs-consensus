# IFBS Consensus

The Imperial Fintech & Blockchain Society’s member-led crypto paper fund. Built with Next.js App Router, React, Tailwind CSS, Prisma, Supabase PostgreSQL, CoinGecko and Resend.

## Run locally

Use Node.js 24 LTS (see `.nvmrc`) or Node 22.13+. Node 23 is not supported by some development dependencies.

```sh
npm install
cp .env.example .env
# Fill in your database URL and secrets.
npm run db:generate
npm run db:migrate
npm run dev
```

Open http://localhost:3000. Create an account using an `@ic.ac.uk` or `@imperial.ac.uk` address. Passwords must contain at least 12 characters. Signup sends a confirmation email through Resend. No user account or session is created until the member opens the one-time confirmation link; they are then signed in and redirected to the dashboard.

Links expire after 24 hours. Submitting signup again sends a new link and invalidates the previous one (up to three requests per email per hour). Pending signups store only a password hash and token hash, and expired pending records are removed on subsequent signup requests. Existing accounts continue to work.

## Environment

| Variable | Purpose | Required |
| --- | --- | --- |
| `VERCEL_DB_URL` | The single PostgreSQL connection string used by the app, Prisma CLI, migrations, Studio, and end-to-end tests. Use the Supabase session pooler (port 5432) so the same URL supports IPv4 runtime connections and migrations. URL-encode special characters in the password. | Yes |
| `JWT_SECRET` | At least 32 random characters for signing member sessions. | Yes |
| `NEXT_PUBLIC_APP_URL` | Canonical app URL used for email links and digest identity. Its origin is also trusted for website actions. The app always accepts `https://ifbsconsensus.com`, `https://www.ifbsconsensus.com`, `https://ifbs-consensus.vercel.app`, `http://localhost:3000`, and `http://localhost:3001`. | Yes |
| `CRON_SECRET` | At least 32 random characters. Scheduled requests must send `Authorization: Bearer <CRON_SECRET>`. | For scheduled jobs |
| `COINGECKO_API_URL` | Defaults to `https://api.coingecko.com/api/v3`. | No |
| `COINGECKO_API_KEY` | Optional Demo API key, sent through `x-cg-demo-api-key`. Keyless endpoints are supported; Demo keys improve reliability. | No |
| `RESEND_API_KEY` | Full-access Resend API credential (contacts, segments and broadcasts require more than sending-only access). | For signup and digest delivery |
| `RESEND_DIGEST_SEGMENT_ID` | Optional dedicated app-managed segment ID. If unset, the app finds or creates its own segment, scoped to the app origin. Segment membership is synchronized before every send; use a segment dedicated to this app. | No |
| `EMAIL_FROM` | Sender on a domain verified in Resend, e.g. `IFBS Consensus <noreply@your-domain.com>`. | For signup and digest delivery |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | Not used by this implementation, which accesses PostgreSQL through Prisma and provides custom authentication. Existing values can remain. | No |

Generate each secret separately with `openssl rand -hex 32`. Keep `.env` private. Only the public app URL has a `NEXT_PUBLIC_` prefix.

Apply `20261024160000_restore_stop_loss` before deploying the current app. It restores Stop Loss columns after the previous exit-level removal. Historical stop values deleted by that migration remain unavailable; they are never replaced with guessed values. New pitches require a stop loss between 5% and 20%, with 10% selected by default. Apply `20261024170000_stop_loss_bounds` to enforce this range in the database. Take Profit remains removed.

## Features and fund rules

- Custom bcrypt password authentication, HS256 JWT sessions, HTTP-only cookies, same-origin mutation checks and database-backed rate limits.
- Member dashboard, searchable/filterable pitches, CoinGecko token selection, Markdown thesis editing and preview, and immutable published pitches.
- One immutable vote per member per pitch; agree/disagree requires a public reason of at least 20 characters. Authors may vote under the same rules as other members.
- Voting lasts three days. Resolution happens after the deadline, requires at least five votes, and passes only with more than 50% agreement. A tie or missing quorum rejects the pitch.
- Pitch investments default to $10,000 and accept any positive cent amount up to $10,000.
- The fund starts with $100,000 cash. Executions require sufficient cash and cannot push open allocations above $100,000. Approved pitches without available capital are queued and retried by the scheduler.
- Every exit returns the actual proceeds to cash, including profit or loss. Cash, open allocations, and positions update atomically under a shared fund lock. Available capital is the smaller of cash and remaining room under the $100,000 allocation cap.
- Portfolio tracks entry prices, quantities, live USD valuations, realized and unrealized P&L, and closed positions. Open quotes refresh every 60 seconds.
- Public `/fund` page shows current USD cash and aggregated crypto holdings in a pie chart, plus a fund-return line chart. No account is required. `/api/fund` exposes only fund valuations and asset holdings. Missing or stale quotes suppress the total and allocation chart rather than substituting entry prices.
- The monitor job records complete fund valuations, at most once per minute. Performance history begins when this feature is installed; historical market values are not fabricated or backfilled. Apply the `20261003150000_fund_performance` migration before deploying. A cash-only fund receives an initial valuation during migration.
- Members can start a closing vote from a position. The proposer chooses a 1–24 hour window. A strict majority of votes cast closes the position at the current market price after the deadline; no five-vote quorum applies. Ties and no-vote ballots are rejected. Each member gets one reasoned vote. Only one close proposal can be pending per position.
- Positions close automatically at their Stop Loss or through a member-announced closing vote. Scheduler retries cannot close or credit the same position twice, and unavailable prices leave an approved close proposal pending for retry with voting closed.
- Scheduled monitoring closes positions at or below their Stop Loss using a fresh observed market price, records fund valuations, and cleans up expired rate limits. Stop Loss remains active while closing votes are pending; an automatic close cancels the pending vote. Price increases never close a position automatically. The simulation omits fees and slippage.
- Member track records show published/passed pitches, contributed votes, and realized performance from their own closed pitches.
- Weekly HTML and plain-text digest of new active pitches via Resend Broadcasts. Each new digest request creates a fresh broadcast with the current contents and submits it to a dedicated member segment. A database lease serializes overlapping calls; failed requests recover their unfinished drafts without resending the same broadcast.

Coin IDs identify assets uniquely, since tickers can be ambiguous. Execution requires a positive price, a timestamp no more than five minutes old, and price precision supported by the database (minimum $0.0000000001). Failed price requests leave approved pitches pending for retry. Voting remains closed after the deadline. Duplicate scheduler requests are safe: row locks and unique constraints prevent duplicate trades, and conditional updates prevent a second close.

The migration enables RLS with no public client policies on every application table. Server-side Prisma uses the database owner connection. The public Supabase key cannot read member credentials or application data. No fabricated seed data is inserted into the application database.

## Scheduled jobs

The GitHub Actions workflow in `.github/workflows/consensus-jobs.yml` runs resolution and monitoring approximately every ten minutes and the digest on Sundays at 18:00 UTC. GitHub may delay scheduled workflows. Set repository Actions secrets:

- `APP_URL`: your deployed app origin.
- `CRON_SECRET`: exactly the same value as the deployed environment.

The workflow supports manual selection of `resolve`, `monitor`, or `digest`. The endpoints accept authenticated POST requests:

```sh
curl --fail-with-body -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  "$NEXT_PUBLIC_APP_URL/api/cron/resolve"
```

Use `/api/cron/monitor` and `/api/cron/digest` for the other jobs. Resolution processes expired close votes first, then expired and queued pitches, so released cash can fund queued entries in the same run. Voting closes at its deadline; scheduled execution can occur later. Each run processes up to 100 close proposals and 100 pitches. Contact synchronization is paced; Resend handles broadcast delivery queues.

The digest uses Resend Marketing/Broadcasts, while signup confirmation emails remain transactional. Contacts are synchronized from confirmed user accounts with `digestEnabled: true` before submission. App opt-outs and non-members are removed from the dedicated segment without deleting their Resend contacts. Existing Resend unsubscribes are never reversed; both HTML and plain text include `{{{RESEND_UNSUBSCRIBE_URL}}}`. Pending signups are never imported.

Digest responses contain `broadcastId` and `queued` (the number of eligible recipients submitted, not a delivery receipt), or a `skipped` reason. After a successful submission, the next call creates a new broadcast, even within the same week. Every digest includes all currently opted-in members who have not unsubscribed in Resend; previous delivery does not exclude them. The weekly schedule controls frequency—calling the endpoint again intentionally sends another digest. Failed attempts reuse their draft and refresh its contents. If a send acknowledgement is lost, a retry confirms the existing queued/sent broadcast and returns `queued: 0`; the following call starts a new digest. For large first-time imports, contact sync stops before the route timeout and returns 503 so another call can continue. An interrupted invocation's lease expires after ten minutes.

Apply the `20261010140000_digest_broadcasts` and `20261010150000_digest_generations` migrations with `npm run db:migrate` before deploying. The Resend key must have full access. The app can automatically create its dedicated segment; alternatively set `RESEND_DIGEST_SEGMENT_ID` to an existing dedicated segment. See [Resend Broadcasts](https://resend.com/docs/api-reference/broadcasts/create-broadcast).

## Deploy on Vercel

1. Import this GitHub repository into Vercel and select the Next.js framework preset. Choose Node.js 24.
2. Set the environment variables above. Set `NEXT_PUBLIC_APP_URL` to the canonical production URL for email links. The production domains (including www) and localhost ports 3000/3001 are already trusted for website actions; no extra origin variable is needed. Keep secrets server-only.
3. Set `VERCEL_DB_URL` to your Supabase session-pooler connection string (port 5432), both locally and in Vercel. All database commands use this one variable.
4. Apply migrations with `npm run db:migrate` against the production database before starting the deployment. The build generates Prisma but deliberately does not run database migrations.
5. Configure `RESEND_API_KEY`, a verified `EMAIL_FROM`, and the public `NEXT_PUBLIC_APP_URL` before accepting signups. Apply the `20261010120000_email_confirmation` migration. Deploy with the default `npm run build` command, then register a member account and check pitch creation and the portfolio.
6. Add the GitHub Actions secrets. Enable Actions on the default branch and run `resolve` and `monitor` manually once.

The code is deployable but does not contain Vercel account credentials or linked project configuration. The cron route’s maximum duration is 300 seconds; select a Vercel plan/runtime configuration that supports the duration required for your membership size.

## Verification

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm audit --omit=dev
npm run test:e2e
```

The end-to-end script requires a database owner connection and installed Google Chrome. Set `PLAYWRIGHT_CHANNEL=chromium` to use a Playwright-managed Chromium installation. It creates a uniquely named `ifbs_test_*` database schema, runs migrations, launches a separate app on port 3001 and local CoinGecko/Resend mocks on ports 3012–3013, then removes its schema and records in `finally`. It never sends real emails or alters public application data. Screenshots are written to `/private/tmp/ifbs-screenshots`. It checks confirmation emails and fallback links, pending-account access, token expiry/replay/concurrent consumption, replacement links, delivery failure/retry, resend limits, login/logout, domain/origin restrictions, cookie flags, password hashes, token search, Markdown, voting, duplicate/deadline protection, concurrent resolution, stale-price retries, rejection rules, Stop Loss exits and closing votes, portfolio P&L, broadcast creation/recovery/update/send, concurrent submission, recipient pagination, opt-outs/unsubscribes, RLS and responsive layout.

The production dependency audit is clean. Some development lint dependencies currently have upstream audit findings with no compatible patch; they are not reachable through the deployed app. Do not use `npm audit fix --force`, which currently proposes downgrading Next.js tooling.

## Design and market API references

The requested Landingfolio MCP currently returns screenshot references rather than Tailwind source. The app’s Tailwind components adapt the visual approach of [Near](https://www.landingfolio.com/inspiration/post/near) (financial workspace, clear hierarchy) and [Atlas](https://www.landingfolio.com/inspiration/post/atlas) (blue accents and a framed product presentation) into the supplied IFBS colour scheme: `#0f1f7b`, `#216cf0`, and `#fefefe`. The supplied logo is copied to `public/ifbs-logo.jpeg`; its original is preserved.

CoinGecko integration uses the documented [public/Demo endpoints](https://docs.coingecko.com/demo/reference/endpoint-overview): `/search`, `/coins/{id}`, and `/simple/price`. Keys and requests remain server-side.
