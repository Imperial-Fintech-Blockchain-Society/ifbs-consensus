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

Open http://localhost:3000. Create an account using an `@ic.ac.uk` or `@imperial.ac.uk` address. Passwords must contain at least 12 characters. The MVP validates the email domain; it does not verify mailbox ownership or use SSO.

## Environment

| Variable | Purpose | Required |
| --- | --- | --- |
| `DATABASE_URL` | Supabase PostgreSQL connection string used by Prisma on the server. URL-encode special characters in the password. For Vercel, use the Supabase transaction pooler URL with `?pgbouncer=true&connection_limit=1`. | Yes |
| `DIRECT_URL` | Direct Postgres connection or session pooler URL for migration commands. `db:migrate` and `db:dev` use this when set, otherwise `DATABASE_URL`. | If your runtime connection is transaction-pooled |
| `JWT_SECRET` | At least 32 random characters for signing member sessions. | Yes |
| `NEXT_PUBLIC_APP_URL` | Exact app origin, e.g. `http://localhost:3000` locally and `https://consensus.your-domain.com` in production. Used for origin checks and email links. | Yes |
| `CRON_SECRET` | At least 32 random characters. Scheduled requests must send `Authorization: Bearer <CRON_SECRET>`. | For scheduled jobs |
| `COINGECKO_API_URL` | Defaults to `https://api.coingecko.com/api/v3`. | No |
| `COINGECKO_API_KEY` | Optional Demo API key, sent through `x-cg-demo-api-key`. Keyless endpoints are supported; Demo keys improve reliability. | No |
| `RESEND_API_KEY` | Resend API credential. | For digest delivery |
| `EMAIL_FROM` | Sender on a domain verified in Resend, e.g. `IFBS Consensus <noreply@your-domain.com>`. | For digest delivery |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | Not used by this implementation, which accesses PostgreSQL through Prisma and provides custom authentication. Existing values can remain. | No |

Generate each secret separately with `openssl rand -hex 32`. Keep `.env` private. Only the public app URL has a `NEXT_PUBLIC_` prefix.

## Features and fund rules

- Custom bcrypt password authentication, HS256 JWT sessions, HTTP-only cookies, same-origin mutation checks and database-backed rate limits.
- Member dashboard, searchable/filterable pitches, CoinGecko token selection, Markdown thesis editing and preview, and immutable published targets.
- One immutable vote per member per pitch; agree/disagree requires a public reason of at least 20 characters. Authors may vote under the same rules as other members.
- Voting lasts seven days. Resolution happens after the deadline, requires at least five votes, and passes only with more than 50% agreement. A tie or missing quorum rejects the pitch.
- Pitch investments default to $10,000 and accept any positive cent amount up to $10,000.
- The fund starts with $100,000 cash. Executions require sufficient cash and cannot push open allocations above $100,000. Approved pitches without available capital are queued and retried by the scheduler.
- Every exit returns the actual proceeds to cash, including profit or loss. Cash, open allocations, and positions update atomically under a shared fund lock. Available capital is the smaller of cash and remaining room under the $100,000 allocation cap.
- Portfolio tracks entry prices, quantities, live USD valuations, realized and unrealized P&L, and closed positions. Open quotes refresh every 60 seconds.
- Members can start an early-close vote from a position. The proposer chooses a 1–24 hour window. A strict majority of votes cast closes the position at the current market price after the deadline; no five-vote quorum applies. Ties and no-vote ballots are rejected. Each member gets one reasoned vote. Only one close proposal can be pending per position.
- TP/SL exits remain active during close voting. If a position closes first, its pending proposal is cancelled. Scheduler retries cannot close or credit the same position twice, and unavailable prices leave an approved close proposal pending for retry with voting closed.
- Scheduled monitoring closes positions at the observed price if a take-profit or stop-loss threshold is crossed. Checks are periodic; no guarantee of filling at the exact threshold. The simulation omits fees and slippage.
- Member track records show published/passed pitches, contributed votes, and realized performance from their own closed pitches.
- Weekly HTML digest of new active pitches, with member opt-out and per-week/per-member delivery tracking. Resend idempotency keys protect overlapping retries.

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

Use `/api/cron/monitor` and `/api/cron/digest` for the other jobs. Resolution processes expired close votes first, then expired and queued pitches, so released cash can fund queued entries in the same run. Voting closes at its deadline; scheduled execution can occur later. Each run processes up to 100 close proposals and 100 pitches. Digest delivery is paced; large memberships should use a queue.

## Deploy on Vercel

1. Import this GitHub repository into Vercel and select the Next.js framework preset. Choose Node.js 24.
2. Set the environment variables above. `NEXT_PUBLIC_APP_URL` must match the production origin; use a corresponding origin for each preview deployment you want to test. Keep secrets server-only.
3. Configure a Supabase pooler `DATABASE_URL` for serverless requests and a direct/session-pooler `DIRECT_URL` for migrations.
4. Apply migrations with `npm run db:migrate` against the production database before starting the deployment. The build generates Prisma but deliberately does not run database migrations.
5. Deploy with the default `npm run build` command, then register a member account and check pitch creation and the portfolio.
6. Verify your email sender in Resend, set `EMAIL_FROM`, and add the GitHub Actions secrets. Enable Actions on the default branch and run `resolve` and `monitor` manually once.

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

The end-to-end script requires a database owner connection and installed Google Chrome. Set `PLAYWRIGHT_CHANNEL=chromium` to use a Playwright-managed Chromium installation. It creates a uniquely named `ifbs_test_*` database schema, runs migrations, launches a separate app on port 3001 and local CoinGecko/Resend mocks on ports 3012–3013, then removes its schema and records in `finally`. It never sends real emails or alters public application data. Screenshots are written to `/private/tmp/ifbs-screenshots`. It checks registration, login/logout, domain/origin restrictions, cookie flags, password hashes, token search, Markdown, voting, duplicate/deadline protection, concurrent resolution, stale-price retries, rejection rules, TP/SL exits, portfolio P&L, digest opt-out/idempotency, RLS and responsive layout.

The production dependency audit is clean. Some development lint dependencies currently have upstream audit findings with no compatible patch; they are not reachable through the deployed app. Do not use `npm audit fix --force`, which currently proposes downgrading Next.js tooling.

## Design and market API references

The requested Landingfolio MCP currently returns screenshot references rather than Tailwind source. The app’s Tailwind components adapt the visual approach of [Near](https://www.landingfolio.com/inspiration/post/near) (financial workspace, clear hierarchy) and [Atlas](https://www.landingfolio.com/inspiration/post/atlas) (blue accents and a framed product presentation) into the supplied IFBS colour scheme: `#0f1f7b`, `#216cf0`, and `#fefefe`. The supplied logo is copied to `public/ifbs-logo.jpeg`; its original is preserved.

CoinGecko integration uses the documented [public/Demo endpoints](https://docs.coingecko.com/demo/reference/endpoint-overview): `/search`, `/coins/{id}`, and `/simple/price`. Keys and requests remain server-side.
