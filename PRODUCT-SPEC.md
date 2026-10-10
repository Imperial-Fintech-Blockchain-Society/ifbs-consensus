## Product Specification: IFBS Consensus

### 1. Executive Summary

A web-based platform for the Imperial Fintech and Blockchain Society (IFBS) to crowd-source, vote on, and track cryptocurrency investment pitches. The app simulates a DAO-managed paper-money fund, allowing members to build a verifiable track record of their investment thesis and performance.

### 2. Core Features &amp; User Flows

**A. Authentication &amp; Account Management**

- **Sign-up/Log-in:** Custom JWT-based authentication system.
- **Domain Restriction:** System must reject any email that does not end in `@[ic.ac.uk](http://ic.ac.uk)` or `@[imperial.ac.uk](http://imperial.ac.uk)`.
- **Security:** Passwords must be hashed (e.g., using bcrypt) before database insertion. No SSO integration for MVP.

**B. Pitch Creation**

- **Form Inputs:** Token Name, Token Ticker (e.g., BTC, ETH), Thesis/Pitch (markdown), Stop Loss percentage and Take Profit (TP) percentage.
- **Validation:** System checks that the ticker exists via a crypto price API before submission. While the user is entering the cryptocurrency name, we have a dropdown which lists the available tokens via the CryptoGecko API.

**C. Voting Mechanism (The "Consensus" Engine)**

- **Voting UI:** Members view active pitches and select "AGREE" or "DON'T AGREE".
- **Reasoning:** A text box is required to submit the vote, encouraging rigorous debate rather than blind clicking.
- **Resolution Logic:** Pitches have a set voting window (e.g., 3 days). If a pitch reaches a defined quorum (e.g., minimum 5 votes) and a majority approval (e.g., &gt;50%), it automatically "executes."

**D. Paper Trading &amp; PnL Dashboard**

- **Execution:** When a pitch passes, the system pings a crypto API (like CoinGecko) to fetch the exact current price and logs it as the "Entry Price" in the database.
- **Live Dashboard:** Displays the fund's active positions. Calculates real-time PnL by comparing the database Entry Price against the current live price.
- **Take Profit Execution:** A background job monitors prices. If a token hits its TP percentage, the position is marked as "Closed," locking in the final paper profit.

**E. Automated Notifications**

- **Weekly Digest:** A scheduled background task compiles all active pitches created that week.
- **Email Delivery:** Sends an HTML email to all registered users containing pitch summaries and a call-to-action link to the voting dashboard.

### 3. Recommended Tech Stack

For a student society, you want a stack that is modern, fast to build with, and highly employable.

- **Frontend:** Next.js (React) styled with Tailwind CSS. It handles routing and UI efficiently.
- **Backend:** Next.js API Routes (Serverless) or a lightweight Node.js/Express server.
- **Database:** PostgreSQL, hosted on Supabase (free tier is very generous). Use Prisma as your ORM to safely interact with the database.
- **Market Data API:** CoinGecko API (free tier)  for real-time and historical token prices.
- **Email Provider:** Resend or SendGrid (both have excellent free tiers and developer-friendly SDKs).
- **Cron Jobs:** GitHub Actions (to trigger the weekly emails and check TP thresholds).

### 4. Data Architecture (Database Schema)


|               |                                                                                                                         |                                               |
| ------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| **Table**     | **Core Columns**                                                                                                        | **Purpose**                                   |
| **Users**     | `id`, `email`, `password_hash`, `created_at`                                                                            | Stores society members.                       |
| **Pitches**   | `id`, `author_id`, `token_name`, `ticker`, `pitch_text`, `tp_percent`, `status` (pending/passed/rejected), `expires_at` | Stores the investment proposals.              |
| **Votes**     | `id`, `pitch_id`, `voter_id`, `decision` (boolean), `reason_text`, `created_at`                                         | Tracks individual member votes and rationale. |
| **Positions** | `id`, `pitch_id`, `ticker`, `entry_price`, `entry_time`, `target_price`, `status` (open/closed), `close_price`          | Tracks the actual paper-money portfolio.      |


### 5. Implementation Roadmap

**Phase 1: Foundation &amp; Authentication (Weeks 1-2)**

- Set up the Next.js repository and connect it to the PostgreSQL database.
- Build the custom registration flow. Implement the regex check for Imperial domains.
- Build the login flow and establish secure session management (JWT/Cookies).

**Phase 2: Pitches &amp; Voting (Weeks 3-4)**

- Create the Dashboard UI for listing pitches.
- Build the "New Pitch" form and its database endpoints.
- Build the voting interface and logic (preventing users from voting on the same pitch twice).
- Implement the status-check logic (determining if a pitch passed or failed when its time expires).

**Phase 3: Crypto Integration &amp; The Fund (Weeks 5-6)**

- Integrate CoinGecko API to fetch live prices.
- Build the execution logic: when a pitch passes, fetch the price and create a record in the `Positions` table.
- Build the PnL Dashboard: dynamically calculate the difference between `entry_price` and live API price.

**Phase 4: Automation &amp; Polish (Weeks 7-8)**

- Set up the CRON job (github action) for the weekly digest email.
- Design the email template and integrate Resend/SendGrid.
- Set up a secondary CRON job to check if open positions have hit their Take Profit targets, closing them if they have.
- Final UI polish, bug fixing, and deployment (we will use Vercel).