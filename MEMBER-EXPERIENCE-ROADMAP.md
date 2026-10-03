# IFBS Consensus: member experience roadmap

This roadmap adds four practical learning experiences to the society's crypto paper fund: pre-trade risk assessment, quantitative entry research, portfolio construction, and crypto due diligence. Each should produce a reviewable piece of work that members can discuss at an investment committee and include in their research portfolio.

This is a proposed implementation plan, not a description of features already built. Numerical policy limits below are illustrative society choices, not recommended real-money allocations.

## 1. Starting point and implementation order

The current app already provides token selection, Markdown pitches, reasoned voting, allocations, a shared paper fund, stop-loss/take-profit exits, and portfolio valuation. It starts with $100,000 cash, caps each pitch at $10,000, and caps open cost allocations at $100,000. Approval follows a seven-day vote; execution can occur later if capital or prices are unavailable. It currently omits fees and slippage.

Relevant existing files:

| Area | Existing files | How to extend them |
| --- | --- | --- |
| Data model | `prisma/schema.prisma` | Add versioned research records, historical observations, and analysis snapshots. |
| Pitch authoring | `src/components/pitch-form.tsx`, `src/app/api/pitches/route.ts` | Add guided research, risk inputs, and analysis attachments. |
| Validation | `src/lib/rules.ts` | Validate new inputs and approved fund policies on the server. |
| Market data | `src/lib/coingecko.ts` | Extend with a separate historical-data adapter and provenance. |
| Trading engine | `src/lib/engine.ts`, `src/lib/fund.ts` | Recheck applicable risk policies at execution while preserving atomic accounting. |
| Fund valuation | `src/lib/fund-valuation.ts`, `src/lib/public-fund.ts` | Reuse current market-value calculations for portfolio weights and NAV. |
| Member views | `src/app/(members)/pitches/[id]/page.tsx`, `src/app/(members)/portfolio/page.tsx` | Display research evidence, risk summaries, and portfolio comparisons. |

Build in this order:

1. Establish shared calculation conventions and a versioned fund policy.
2. Add structured due diligence and basic risk sizing; neither requires a long historical dataset.
3. Add reliable historical data ingestion and quality checks.
4. Add portfolio concentration, correlation, and stress analysis.
5. Add reproducible entry research, then optionally simulated entry orders.

Before implementing application code, read the relevant guides in `node_modules/next/dist/docs/` as required by `AGENTS.md`. Preserve existing work in progress and introduce additive database migrations.

## 2. Shared foundations

### Step 1: agree the fund's educational mandate

Record the eligible asset universe, long-only/no-leverage starting scope, investment horizon, benchmark, and risk rules in a versioned policy. Distinguish warnings from execution-blocking limits. Example discussion points are maximum single-token weight, maximum sector exposure, a minimum cash reserve, and a per-trade planned loss budget.

Start with informational warnings. Introduce hard limits after the committee has agreed their meaning and behaviour. Do not silently resize a voted allocation: show a policy block and require an explicit revised proposal if needed. Existing published pitches should keep their original terms.

### Step 2: define consistent units and timestamps

- Use USD throughout and UTC for historical observations.
- Use fractions internally for returns and percentages only for display.
- Define NAV as cash plus fresh market value of open holdings. Keep cost allocation separate: `Fund.allocated` is not current market exposure.
- Aggregate multiple positions in the same token by `coinId` before measuring concentration.
- Use database decimals for money, quantities, and accounting; use numerical arrays for statistical calculations with explicit precision tolerances.
- Every report records its calculation version, policy version, inputs, observation period, and data timestamp.

### Step 3: add a historical-data pipeline

Implement a server-side historical adapter, initially targeting completed daily UTC observations for selected tokens and BTC/ETH benchmarks. CoinGecko's market-chart endpoint supplies timestamped price, market-cap, and volume observations, but granularity and history access depend on the endpoint and plan. Verify the actual Demo plan before committing to a lookback or API budget. [CoinGecko market-chart documentation](https://docs.coingecko.com/reference/coins-id-market-chart).

1. Add a proposed `MarketObservation` model keyed by provider, `coinId`, quote currency, interval, and observation timestamp. Store price, optional volume/market cap, retrieval time, and source metadata.
2. Normalize provider samples to a documented daily boundary. Store the sampling method; do not call a sampled price an exchange close or fabricate OHLC candles.
3. Fetch a bounded asset universe through a scheduled ingestion job. Cache shared results, retry transient failures with backoff, and make writes idempotent.
4. Reject non-positive prices, resolve duplicate timestamps deterministically, and flag missing observations. Exclude incomplete days from analysis.
5. Align assets on shared observation dates. Do not fill missing prices with zero, carry prices forward through outages, or invent history before listing.
6. Save a dataset version or hash with each analysis run. Retain enough immutable inputs to reproduce a saved result even if the provider revises its data.
7. Display the available period and sample size. If history is insufficient, show an explicit unavailable state rather than a reassuring metric.

For an initial policy, require at least 60 aligned daily returns for historical statistics, prefer 90 or more where available, and disclose short samples. These are implementation thresholds, not guarantees of statistical reliability. Longer entry experiments may need another data plan or a smaller research scope.

### Step 4: separate calculations from presentation

Add proposed pure modules such as `src/lib/risk.ts`, `src/lib/portfolio-analysis.ts`, and `src/lib/entry-research.ts`. Keep provider calls and database writes outside calculation functions. Member-facing analysis endpoints must reuse existing authentication, origin checks for mutations, rate limits, and server validation. Bound asset counts, lookbacks, and strategy runs to prevent expensive requests.

Research belongs in authenticated member views. Publish only deliberately selected aggregates on the public fund page.

## 3. Pre-trade risk assessment

### Member experience

Before publishing a pitch, the author chooses a planned loss budget, explains the stop and thesis invalidation, and shows how the proposed position affects the fund. A reviewer challenges whether the sizing remains sensible under a worse execution or a market shock.

### Step 1: build a basic position-sizing calculator

Inputs: current NAV, proposed allocation, stop-loss percentage, take-profit percentage, and chosen risk-budget percentage of NAV.

```text
Loss budget = NAV × risk-budget fraction
Suggested position value = loss budget / stop-loss fraction
Planned stop loss = proposed allocation × stop-loss fraction
Planned stop loss as fraction of NAV = planned stop loss / NAV
Gross reward/risk ratio = take-profit fraction / stop-loss fraction
```

Example: $100,000 NAV, a 0.5% planned loss budget, and a 10% stop imply $500 budget and $5,000 position value. A $10,000 allocation with the same stop implies $1,000 planned loss. Apply available cash, the existing $10,000 per-pitch cap, the open-allocation cap, and any approved concentration limits separately; show which constraint binds.

Call this a **planned loss at the stop**, not a maximum possible loss. Periodic monitoring, gaps, and poor liquidity can produce a worse exit. A reward/risk ratio does not establish a probability of success. [CME position-sizing explanation](https://www.cmegroup.com/education/courses/trade-and-risk-management/proper-position-size).

### Step 2: collect the reasoning and freeze a risk snapshot

Add a proposed `PitchRiskAssessment` linked to the pitch with NAV, allocation, risk budget, planned stop loss, stop rationale, invalidation criteria, policy version, and quote timestamps. Calculate authoritative values on the server. Validate finite positive inputs and enforce existing pitch ranges.

Show the snapshot beside the voting controls so members vote on the same assumptions. Keep later reassessments as separate timestamped records rather than overwriting the publication snapshot.

### Step 3: add historical and hypothetical risk views

After historical ingestion is available, calculate daily simple returns `r[t] = P[t] / P[t-1] - 1`, sample standard deviation, annualized volatility using `sqrt(365)` for daily crypto data, and historical maximum drawdown.

Show hypothetical losses for explicitly labelled token shocks, such as -10%, -30%, and -50%. Add portfolio shocks using the same framework in section 5. Later, introduce historical VaR and expected shortfall with a stated horizon, confidence level, sample size, and quantile convention. Explain that historical estimates are not loss ceilings.

### Step 4: recheck at actual execution

An approved pitch may execute days after publication. Fetch fresh valuation inputs before the transaction, then recheck current holdings and applicable hard policies inside the existing fund lock. Ensure the quotes remain within freshness rules when committing; retry if necessary. Avoid slow provider calls while holding the lock.

Add an explicit risk-block reason and retry/reproposal policy for queued pitches. Preserve idempotency and atomic updates to cash, allocation, and positions. Do not claim an earlier risk snapshot still describes the fund at execution.

### Step 5: verify and run a workshop

Test the $500/$5,000 sizing example, percentage conversion, caps, missing NAV, stale prices, duplicate-token exposure, and concurrent approvals that together breach a limit. Have teams size the same thesis using different loss budgets and defend their choices.

**Completion criterion:** every new pitch has a reproducible risk summary visible to voters, and any enforced policy is also checked at execution.

## 4. Quantitative entry research

### Member experience

Members ask a testable question: does a specified entry rule improve outcomes versus buying immediately? They submit a hypothesis, evidence, and limitations. Present an entry range or rule with uncertainty rather than a guaranteed “best price.”

### Step 1: define a small set of strategies and fair comparisons

Start with buy at the next observation, wait for a fixed pullback with an expiry, and enter in three equal scheduled tranches. Add a moving-average rule later. Members specify the asset, decision dates, entry window, evaluation horizon, allocation, and cost assumptions before testing.

Compare the same starting capital and end date. Track unused cash, expired unfilled plans, and partly invested plans. Include an immediate-entry baseline for every episode; comparing only trades that filled hides the opportunity cost of waiting.

### Step 2: implement a deterministic simulator

1. Use only information available at each simulated decision time. A signal computed from a completed day's price executes no earlier than the next observation.
2. With daily sampled prices, model fills only at available observations. Do not infer intraday limit touches or fills at the exact limit price. For realistic limit fills, add suitable OHLC/order-book data and document the model separately.
3. Parameterize fees and slippage on entries and exits. Label these as simulation assumptions, not observed venue costs.
4. Fix an exit/evaluation policy across entry strategies and include any remaining cash in ending wealth.
5. Generate an event log of decisions, fills, quantities, cash, costs, and expiry outcomes.
6. Include a selectable seven-day approval delay when modelling Consensus pitches; a backtest cannot assume entry before voting closes.

### Step 3: keep development and evaluation separate

Split data chronologically into a development period and an untouched evaluation period before selecting parameters. Use walk-forward experiments only once the basic pipeline works. Keep parameter grids small and log all attempted settings. If members inspect a test period and then revise the rule, that period becomes development data; require a new holdout or forward paper test.

Restrict conclusions to the tested assets and periods. Today's listed tokens alone create survivorship limitations; disclose them and include delisted assets only if suitable historical data exists. Repeated historical tuning can fit noise instead of a durable pattern. [QuantConnect research guide](https://www.quantconnect.com/docs/v2/cloud-platform/backtesting/research-guide).

### Step 4: save and display research runs

Add a proposed `EntryResearchRun` with author, optional pitch link, strategy and parameters, dataset identifier, development/test periods, cost assumptions, simulator version, and results. Retain the event log or an immutable artifact reference.

Show ending wealth, net return, maximum drawdown, fill rate, time to entry, average invested capital, and missed-trade outcomes. Compare average entry price only alongside total exposure and ending wealth. Use multiple non-overlapping decision episodes where practical and state whether observations overlap; a single successful trade is not strong evidence.

Attach a frozen run to the pitch, alongside a short explanation of when the rule should fail.

### Step 5: optionally connect research to live paper entry plans

First release research without changing the trading engine. A later release can add a separate `EntryOrder`/`EntryFill` model with approved parameters, expiry, remaining quantity, reserved capital, and cancellation rules. The current unique `Position.pitchId` and single-entry representation need an explicit design for partial fills and weighted-average cost.

Model approval separately from execution: members approve the entry plan, and the order becomes eligible only after the vote passes. Atomically manage reservations and fills under the fund lock, define stops/targets for staged entries, and test concurrent fills and scheduler retries. This is a distinct trading-engine extension, not a prerequisite for educational research.

### Step 6: verify and run an entry challenge

Test no future-data access, next-observation execution, fees/slippage, missing observations, expired plans, partial investment, common horizons, and the approval delay. Ask teams to preregister one rule and compare its subsequent paper performance with immediate entry.

**Completion criterion:** a member can reproduce a saved experiment and explain both its benefits and its missed opportunities.

## 5. Portfolio construction

### Member experience

Members assess whether an attractive token improves the shared fund. They compare alternative allocations and explain diversification, common market exposure, and the role of cash.

### Step 1: show current and proposed market-value weights

Aggregate holdings by `coinId` and calculate `asset weight = current market value / NAV`, including cash. Preview the exact proposed dollar allocation by reducing cash and increasing the chosen holding; buying an already-held token must add to its exposure.

Show before/after token weights, sector weights, cash, and planned downside. Preserve the existing cost-allocation cap independently of these market-value measures. Missing quotes should suppress complete portfolio statistics rather than silently remove an asset from the denominator.

### Step 2: add explicit classifications

Maintain curated primary sectors such as L1, L2, DeFi, infrastructure, and stablecoins, plus overlapping descriptive tags. Record classification sources and dates. Use primary sectors for weights that sum to 100%; label overlapping tags as non-additive. Keep unclassified assets visible.

Add a proposed `AssetClassification` model. Due-diligence records can provide shared dependency tags, such as chain, bridge, issuer, or oracle exposure, for qualitative concentration review.

### Step 3: calculate correlation and market exposure

Use the same aligned daily-return matrix for all assets. Show pairwise correlations, sample dates, and sample size. Estimate BTC beta as `cov(asset returns, BTC returns) / var(BTC returns)`; suppress beta for zero benchmark variance and correlations for zero-variance series.

Explain that correlation changes over time and may rise during stress. A portfolio of several altcoins can still have substantial common crypto-market exposure.

### Step 4: calculate portfolio volatility and risk contributions

For risky-asset weights measured as fractions of total NAV and daily return covariance matrix `Σ`:

```text
Portfolio daily volatility = sqrt(wᵀ Σ w)
Annualized volatility = daily volatility × sqrt(365)
Asset contribution to daily volatility = w[i] × (Σw)[i] / portfolio daily volatility
```

Treat USD paper cash as zero-return/zero-volatility in the initial model and state that assumption; a stablecoin is a separate risky asset. Include covariance terms rather than averaging individual volatilities. Handle zero portfolio volatility explicitly. Contributions can be negative when an asset diversifies the portfolio; do not discard their signs.

Use one common sample to construct covariance. If history is incomplete, show concentration and hypothetical shocks while withholding unsupported historical statistics.

### Step 5: build a constrained allocation sandbox

Let members adjust proposed dollar holdings within available cash and existing caps. Compare equal-weight allocations, inverse-volatility allocations, and their own allocation. Apply token/sector/cash rules and explain each constraint. Simple inverse volatility is a heuristic, not true equal-risk contribution.

Start with adding positions rather than assuming the app can rebalance existing ones automatically. A proposed sale must follow the existing close-vote workflow; partial sales require a separate accounting extension. Add constrained minimum-variance optimization only later, with estimation sensitivity and out-of-sample comparisons.

### Step 6: add stress tests and saved proposals

Provide labelled hypothetical scenarios: all crypto -30%, ETH-related assets -40%, or a stablecoin depeg. Show per-asset losses, total dollar loss, and loss as a percentage of NAV using current holdings. Explicitly state that scenarios hold quantities fixed and do not assume stops fill during the shock.

Add a proposed `PortfolioAnalysisSnapshot` attached to a pitch or committee review, storing holdings, quotes, classifications, assumptions, dataset version, and before/after metrics. Historical replay is a later feature requiring aligned historical shocks and a clear treatment of newly listed assets.

### Step 7: verify and run an allocation committee

Test cash-only portfolios, duplicate-token positions, missing quotes, constant series, correlated/diversifying assets, covariance calculations, risk-contribution reconciliation, and exhausted cash. Ask teams to allocate the same paper budget to competing pitches and defend how the whole fund changes.

**Completion criterion:** voters can inspect a reproducible before/after portfolio report instead of assessing the pitch in isolation.

## 6. Crypto due diligence

### Member experience

The author assembles an evidence-backed research pack. Another member reviews it and identifies the strongest counterargument. Members learn to distinguish protocol adoption from value accruing to the token.

### Step 1: create a structured research template

| Section | Required questions and evidence |
| --- | --- |
| Identity | Which chain and contract address? Is this a native coin, wrapped asset, or bridge representation? Does it match the selected CoinGecko ID? |
| Product and competition | What problem is solved, who uses it, and which alternatives compete? What evidence supports adoption? |
| Token value accrual | Why should usage increase token value? Separate governance rights, fee distributions, burns, and incentives; identify holders' actual economic claims. |
| Supply and unlocks | What are circulating/total/max supply, market cap, FDV, emissions, and known unlocks? What could dilute holders over the thesis horizon? |
| Usage and economics | Distinguish volume, fees, protocol revenue, token-holder revenue, and incentives. Define metrics, dates, and sources; avoid equating TVL with revenue. |
| Security and dependencies | Which audits cover which deployed version? What incidents occurred? Who controls upgrades, admin keys, oracles, bridges, and emergency actions? |
| Governance and concentration | Who can change the protocol? What is known about insiders and voting power? Distinguish exchange/custody wallets from identified beneficial owners. |
| Liquidity and venues | Where does it trade, what liquidity evidence exists, and what venue/counterparty risks matter? Aggregate volume alone is not executable depth. |
| Catalysts and scenarios | What events could change value, on what timeline? Include bull/base/bear assumptions and measurable thesis invalidation. |
| Evidence gaps | What remains unknown, contested, stale, or unverified? What evidence would change the conclusion? |

### Step 2: store evidence and review history

Add proposed `DueDiligenceReport`, `ResearchSource`, and `DueDiligenceReview` models. A report should carry a schema version and immutable published content. Sources record URL, title, publisher, observed/accessed date, relevant metric date, and the claim supported. Reviews record reviewer, report version, comments, and unresolved questions.

Use typed required fields or a versioned validated structured payload; do not leave the entire checklist as an unconstrained text blob. Retain the existing Markdown thesis as the readable summary. Mark absent historical reports as unavailable rather than creating backdated evidence.

### Step 3: prefill cautiously from verified sources

Extend market-data adapters to prefill available supply/market-cap/FDV fields with timestamps. Members verify contract identities against project documentation and relevant explorers. Obtain unlock schedules and security evidence from primary project disclosures and audit reports where available, recording limitations.

Calculate `FDV / market cap` only when both are valid and comparable. Express upcoming unlocks relative to dated circulating supply and distinguish scheduled release from expected selling pressure. Label any estimate. Missing data remains unknown, not zero.

For MVP, members paste source links and extracted evidence; no arbitrary server-side URL fetching is needed. If source ingestion is added later, constrain fetch destinations and response sizes and treat external content as untrusted data.

### Step 4: add a reviewer workflow

Introduce draft research records so authors can complete and review the pack before starting the current seven-day pitch vote. Require an independent reviewer for the educational workflow; do not silently change the voting engine's existing quorum or author-vote rules.

Review states can be draft, changes requested, and reviewed. “Reviewed” means the checklist was examined, not that the token is safe. Persist unresolved concerns so voters can see them. Any material change after publication should produce a new version and, if investment terms change, a new proposal rather than rewriting what members voted on.

### Step 5: assess research quality

Use separate rubric dimensions: evidence quality, token economics, identification of risks, falsifiable thesis, and response to challenges. Keep completeness separate from investment attractiveness. Avoid a single automated “safe token” score or allowing an AI summary to stand in for verified evidence.

### Step 6: verify and run a research clinic

Test required sections, invalid/unsupported source links, missing metrics, identity mismatches, version immutability, reviewer permissions, and escaping of member-provided content. Run a paired exercise where one member writes a report and another searches for evidence against it.

**Completion criterion:** every new pitch includes a dated research pack, source trail, independent review, and visible unresolved risks.

## 7. Delivery milestones and verification

| Milestone | Deliverable | Acceptance check |
| --- | --- | --- |
| A: foundations | Versioned policy, calculation conventions, data-model design | Committee agrees warning/block behaviour and treatment of existing pitches. |
| B: first learning release | Risk calculator, structured due diligence, reviewer workflow | A member publishes a pitch with a frozen research and risk pack; voters can inspect it. |
| C: historical data | Idempotent ingestion, normalized observations, dataset provenance | Repeated ingestion does not duplicate records; gaps and short history are visible. |
| D: portfolio lab | Weights, correlations, portfolio risk, scenarios, saved comparisons | A proposed allocation produces a correct reproducible before/after report. |
| E: entry lab | Baselines, chronological evaluation, realistic assumptions, saved runs | A member reproduces a test and explains unfilled outcomes and net performance. |
| F: optional execution extension | Approved paper entry plans and fills | Reservations, partial fills, expiries, and retries preserve fund accounting. |

For each code milestone, run relevant calculation tests and the repository's `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`. Extend `npm run test:e2e` when workflows or accounting change. Keep provider calls mocked in automated tests, visually check member pages on desktop/mobile, and apply migrations to an isolated test database before deployment.

Preserve server-only credentials and existing access controls. Every new application table needs the same RLS posture as existing tables: do not expose member research through the public Supabase client. Bound new scheduled work so it fits the current cron infrastructure; move larger research batches into a job queue if needed.

## 8. Running the experience during term

1. **Research session:** pairs complete due diligence and review each other's strongest counterargument.
2. **Risk session:** each pair sizes the same idea and compares stop-based loss with stress losses.
3. **Portfolio committee:** members compare pitches against current holdings and allocate a limited paper budget.
4. **Quant session:** teams preregister an entry rule and compare it against immediate entry on unseen data.
5. **Monthly review:** revisit the frozen evidence and assumptions, explain changes, and record lessons without editing the original decision record.

Each member should finish with a reviewed research pack, a risk assessment, a portfolio allocation rationale, and a reproducible entry experiment. Assess those artifacts alongside outcomes so short-term P&L does not dominate the educational experience.
