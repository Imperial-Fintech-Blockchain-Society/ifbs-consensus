import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { chromium, request as playwrightRequest } from "@playwright/test";

// Every test record lives in a unique schema, which is removed after the run.
const schema = `ifbs_test_${Date.now()}_${randomBytes(4).toString("hex")}`;
assert.match(schema, /^ifbs_test_[0-9]+_[a-f0-9]+$/);
if (!process.env.VERCEL_DB_URL)
  throw new Error("Set VERCEL_DB_URL before running end-to-end tests.");
const url = new URL(process.env.VERCEL_DB_URL);
url.searchParams.set("schema", schema);
const databaseUrl = url.toString();
const db = new PrismaClient({ datasourceUrl: databaseUrl });
const base = "http://localhost:3001";
const headers = { Origin: base };
const cronSecret = randomBytes(32).toString("hex");
const password = "Consensus-test-password-2026";
let price = 100;
let stale = false;
let unavailable = false;
let emailsSent = 0;
const confirmationLinks = new Map();
let mailFailure = false;
let failBroadcastUpdate = true;
let broadcastsCreated = 0;
let broadcastsSent = 0;
let broadcastsUpdated = 0;
const broadcasts = new Map();
const segments = new Map();
const contacts = new Map([
  [
    "opted-out",
    { id: "opted-out", email: "alex@ic.ac.uk", unsubscribed: false },
  ],
  [
    "outsider",
    { id: "outsider", email: "outsider@ic.ac.uk", unsubscribed: false },
  ],
  [
    "unsubscribed",
    { id: "unsubscribed", email: "member2@imperial.ac.uk", unsubscribed: true },
  ],
  [
    "existing-member",
    {
      id: "existing-member",
      email: "member3@imperial.ac.uk",
      unsubscribed: false,
    },
  ],
]);
const segmentMembers = new Set();
function paginate(list, url) {
  const after = url.searchParams.get("after");
  const start = after ? list.findIndex((item) => item.id === after) + 1 : 0;
  return {
    object: "list",
    data: list.slice(start, start + 2),
    has_more: start + 2 < list.length,
  };
}
const market = createServer((req, res) => {
  res.setHeader("Content-Type", "application/json");
  if (unavailable) {
    res.writeHead(503);
    res.end('{"error":"unavailable"}');
    return;
  }
  const path = new URL(req.url, "http://localhost:3012");
  // Give each run a unique market URL so Next's fetch cache cannot reuse
  // mocked quotes from a previous isolated test schema.
  path.pathname = path.pathname.slice(schema.length + 1);
  if (path.pathname === "/search")
    res.end(
      JSON.stringify({
        coins: [
          { id: "bitcoin", name: "Bitcoin", symbol: "btc" },
          { id: "ethereum", name: "Ethereum", symbol: "eth" },
        ],
      }),
    );
  else if (path.pathname.startsWith("/coins/")) {
    const id = path.pathname.split("/")[2];
    res.end(
      JSON.stringify({
        id,
        name: id === "bitcoin" ? "Bitcoin" : "Ethereum",
        symbol: id === "bitcoin" ? "btc" : "eth",
      }),
    );
  } else if (path.pathname === "/simple/price")
    res.end(
      JSON.stringify(
        Object.fromEntries(
          (path.searchParams.get("ids") || "").split(",").map((id) => [
            id,
            {
              usd: price,
              last_updated_at:
                Math.floor(Date.now() / 1000) - (stale ? 600 : 0),
            },
          ]),
        ),
      ),
    );
  else {
    res.writeHead(404);
    res.end("{}");
  }
});
const mail = createServer(async (req, res) => {
  let body = "";
  for await (const chunk of req) body += chunk;
  const email = body ? JSON.parse(body) : {};
  const url = new URL(req.url, "http://localhost:3013");
  const parts = url.pathname.split("/").filter(Boolean);
  res.setHeader("Content-Type", "application/json");
  const reply = (data) => res.end(JSON.stringify(data));
  if (parts[0] === "segments") {
    if (req.method === "POST") {
      const segment = { id: "digest-segment", name: email.name };
      segments.set(segment.id, segment);
      // Stale membership must be removed before the app sends the digest.
      segmentMembers.add("opted-out");
      segmentMembers.add("outsider");
      segmentMembers.add("unsubscribed");
      return reply(segment);
    }
    if (!parts[1]) return reply(paginate([...segments.values()], url));
    if (parts[2] === "contacts")
      return reply(
        paginate(
          [...contacts.values()].filter((c) => segmentMembers.has(c.id)),
          url,
        ),
      );
    return reply(segments.get(parts[1]));
  }
  if (parts[0] === "contacts") {
    if (parts[2] === "segments") {
      assert.equal(parts[3], "digest-segment");
      if (req.method === "POST") segmentMembers.add(parts[1]);
      else if (req.method === "DELETE") segmentMembers.delete(parts[1]);
      return reply({ id: parts[1] });
    }
    if (req.method === "GET")
      return reply(paginate([...contacts.values()], url));
    if (req.method === "POST") {
      assert.ok(![...contacts.values()].some((c) => c.email === email.email));
      const contact = {
        id: `contact-${contacts.size}`,
        email: email.email,
        unsubscribed: false,
      };
      contacts.set(contact.id, contact);
      assert.deepEqual(email.segments, [{ id: "digest-segment" }]);
      segmentMembers.add(contact.id);
      return reply(contact);
    }
  }
  if (parts[0] === "broadcasts") {
    if (!parts[1] && req.method === "GET")
      return reply(paginate([...broadcasts.values()], url));
    if (!parts[1] && req.method === "POST") {
      assert.equal(email.segment_id, "digest-segment");
      assert.notEqual(email.send, true);
      const broadcast = {
        ...email,
        id: `broadcast-${++broadcastsCreated}`,
        status: "draft",
      };
      broadcasts.set(broadcast.id, broadcast);
      return reply({ id: broadcast.id });
    }
    const broadcast = broadcasts.get(parts[1]);
    assert.ok(broadcast);
    if (req.method === "GET") return reply(broadcast);
    if (req.method === "PATCH") {
      assert.equal(broadcast.status, "draft");
      if (failBroadcastUpdate) {
        failBroadcastUpdate = false;
        res.writeHead(500);
        return reply({
          name: "application_error",
          message: "Mock update failure",
        });
      }
      assert.ok(email.html.includes("{{{RESEND_UNSUBSCRIBE_URL}}}"));
      assert.ok(email.text.includes("{{{RESEND_UNSUBSCRIBE_URL}}}"));
      Object.assign(broadcast, email);
      broadcastsUpdated++;
      return reply({ id: broadcast.id });
    }
    if (parts[2] === "send") {
      assert.ok(broadcastsUpdated > 0, "Update must happen before send");
      assert.equal(broadcast.status, "draft");
      broadcast.status = "queued";
      broadcastsSent++;
      emailsSent += [...contacts.values()].filter(
        (c) => segmentMembers.has(c.id) && !c.unsubscribed,
      ).length;
      return reply({ id: broadcast.id });
    }
  }
  assert.equal(req.url, "/emails");
  assert.ok(req.headers["idempotency-key"]);
  if (mailFailure) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        message: "Mock delivery failure",
        name: "application_error",
      }),
    );
    return;
  }
  if (email.subject.startsWith("Confirm your email")) {
    const link = email.text.match(/http:\/\/[^\s]+/)[0];
    assert.ok(email.html.includes(`href="${link}"`));
    assert.ok(email.html.includes("Confirm email address"));
    confirmationLinks.set(email.to, link);
  } else emailsSent++;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ id: `test-email-${emailsSent}` }));
});
const env = {
  ...process.env,
  VERCEL_DB_URL: databaseUrl,
  NEXT_PUBLIC_APP_URL: base,
  COINGECKO_API_URL: `http://localhost:3012/${schema}`,
  CRON_SECRET: cronSecret,
  JWT_SECRET: randomBytes(48).toString("hex"),
  RESEND_API_KEY: "re_test_mock",
  RESEND_BASE_URL: "http://localhost:3013",
  EMAIL_FROM: "IFBS <test@example.com>",
  RESEND_DIGEST_SEGMENT_ID: "",
  IFBS_BUILD_DIR: ".next-e2e",
  NEXT_TELEMETRY_DISABLED: "1",
};
function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { env, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`Command failed: ${code}`)),
    );
  });
}
let app;
let browser;
const clients = [];
try {
  await run(["node_modules/prisma/build/index.js", "migrate", "deploy"]);
  await new Promise((resolve) => market.listen(3012, "127.0.0.1", resolve));
  await new Promise((resolve) => mail.listen(3013, "127.0.0.1", resolve));
  app = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "dev", "-p", "3001"],
    { env, stdio: ["ignore", "pipe", "pipe"] },
  );
  // Keep logs concise; request errors and failed assertions surface in the test output.
  let log = "";
  app.stdout.on("data", (chunk) => {
    log = (log + chunk).slice(-4000);
  });
  app.stderr.on("data", (chunk) => {
    log = (log + chunk).slice(-4000);
  });
  for (let n = 0; n < 60; n++) {
    try {
      if ((await fetch(base)).ok) break;
    } catch {}
    if (n === 59) throw new Error(`App did not start: ${log}`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  browser = await chromium.launch({
    channel: process.env.PLAYWRIGHT_CHANNEL || "chrome",
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  const browserErrors = [];
  page.on("pageerror", (err) => browserErrors.push(err.message));
  const artifacts = "/private/tmp/ifbs-screenshots";
  await mkdir(artifacts, { recursive: true });
  await page.goto(base);
  await page.screenshot({
    path: `${artifacts}/landing-desktop.png`,
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    "Landing page should fit mobile width",
  );
  await page.screenshot({
    path: `${artifacts}/landing-mobile.png`,
    fullPage: true,
  });
  await page.goto(`${base}/dashboard`);
  await page.waitForURL("**/login");
  const anonymous = await playwrightRequest.newContext({
    baseURL: base,
    extraHTTPHeaders: headers,
  });
  clients.push(anonymous);
  const cashOnly = await anonymous.get("/api/fund");
  assert.equal(cashOnly.status(), 200);
  const initialPublicFund = await cashOnly.json();
  assert.equal(initialPublicFund.total, 100000);
  assert.equal(initialPublicFund.holdings[0].ticker, "CASH");
  await page.goto(`${base}/fund`);
  await page
    .getByRole("img", { name: "Holdings by current USD value" })
    .waitFor();
  assert.equal(new URL(page.url()).pathname, "/fund");
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    "Public fund should fit mobile width",
  );
  await page.screenshot({
    path: `${artifacts}/public-fund-mobile.png`,
    fullPage: true,
  });
  assert.equal(
    (await anonymous.post("/api/pitches", { data: {} })).status(),
    401,
  );
  assert.equal(
    (
      await anonymous.post("/api/auth/register", {
        data: { name: "External", email: "external@gmail.com", password },
      })
    ).status(),
    400,
  );
  assert.equal(
    (
      await anonymous.post("/api/auth/register", {
        headers: { Origin: "https://evil.example" },
        data: {},
      })
    ).status(),
    403,
  );
  await page.goto(`${base}/register`);
  await page.getByLabel("Your name").fill("Alex Morgan");
  await page.getByLabel("Imperial email address").fill("alex@ic.ac.uk");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Send confirmation email" }).click();
  await page.getByRole("heading", { name: "Check your email" }).waitFor();
  assert.equal(
    await db.user.count(),
    0,
    "No account exists before confirmation",
  );
  assert.equal(
    (await context.cookies()).some((c) => c.name === "ifbs_session"),
    false,
  );
  assert.equal(
    (
      await anonymous.post("/api/auth/login", {
        data: { email: "alex@ic.ac.uk", password },
      })
    ).status(),
    401,
    "Pending signups cannot log in",
  );
  const alexLink = confirmationLinks.get("alex@ic.ac.uk");
  const alexToken = new URL(alexLink).searchParams.get("token");
  const pending = await db.pendingSignup.findUnique({
    where: { email: "alex@ic.ac.uk" },
  });
  assert.notEqual(pending.tokenHash, alexToken);
  assert.notEqual(pending.passwordHash, password);
  assert.equal((await anonymous.get(alexLink)).status(), 200);
  assert.equal(
    await db.user.count(),
    0,
    "Fetching the email link alone does not create an account",
  );
  await page.goto(alexLink);
  await page.waitForURL("**/dashboard");
  await page.getByRole("heading", { name: "Welcome back, Alex." }).waitFor();
  assert.equal(await db.pendingSignup.count(), 0);
  assert.equal(
    (
      await anonymous.post("/api/auth/verify", { data: { token: alexToken } })
    ).status(),
    400,
  );
  assert.equal(
    (
      await anonymous.post("/api/auth/verify", { data: { token: "invalid" } })
    ).status(),
    400,
  );
  const signupChecks = await playwrightRequest.newContext({
    baseURL: base,
    extraHTTPHeaders: { ...headers, "X-Forwarded-For": "192.0.2.100" },
  });
  const retryData = {
    name: "Pending Member",
    email: "pending@ic.ac.uk",
    password,
  };
  assert.equal(
    (
      await signupChecks.post("/api/auth/register", { data: retryData })
    ).status(),
    202,
  );
  const oldToken = new URL(
    confirmationLinks.get(retryData.email),
  ).searchParams.get("token");
  assert.equal(
    (
      await signupChecks.post("/api/auth/register", { data: retryData })
    ).status(),
    202,
  );
  const newToken = new URL(
    confirmationLinks.get(retryData.email),
  ).searchParams.get("token");
  assert.notEqual(oldToken, newToken);
  assert.equal(
    (
      await signupChecks.post("/api/auth/verify", { data: { token: oldToken } })
    ).status(),
    400,
  );
  await db.pendingSignup.update({
    where: { email: retryData.email },
    data: { expiresAt: new Date(0) },
  });
  assert.equal(
    (
      await signupChecks.post("/api/auth/verify", { data: { token: newToken } })
    ).status(),
    400,
  );
  assert.equal(await db.user.count({ where: { email: retryData.email } }), 0);
  const failedData = { ...retryData, email: "delivery@ic.ac.uk" };
  mailFailure = true;
  assert.equal(
    (
      await signupChecks.post("/api/auth/register", { data: failedData })
    ).status(),
    503,
  );
  mailFailure = false;
  assert.equal(
    await db.pendingSignup.count({ where: { email: failedData.email } }),
    0,
  );
  assert.equal(await db.user.count({ where: { email: failedData.email } }), 0);
  assert.equal(
    (
      await signupChecks.post("/api/auth/register", { data: failedData })
    ).status(),
    202,
  );
  assert.equal(
    (
      await signupChecks.post("/api/auth/register", { data: retryData })
    ).status(),
    202,
  );
  assert.equal(
    (
      await signupChecks.post("/api/auth/register", { data: retryData })
    ).status(),
    429,
  );
  await db.pendingSignup.deleteMany({
    where: { email: { in: [retryData.email, failedData.email] } },
  });
  await signupChecks.dispose();
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.screenshot({
    path: `${artifacts}/navigation-mobile.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Close navigation" }).click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: `${artifacts}/dashboard-empty.png`,
    fullPage: true,
  });
  const session = (await context.cookies()).find(
    (c) => c.name === "ifbs_session",
  );
  assert.ok(session?.httpOnly);
  assert.equal(session.sameSite, "Lax");
  assert.ok(session.expires > Date.now() / 1000, "Session cookie persists");
  for (const route of ["login", "register"]) {
    await page.goto(`${base}/${route}`);
    await page.waitForURL("**/dashboard");
    await page.getByRole("heading", { name: "Welcome back, Alex." }).waitFor();
    const invalidSession = await anonymous.get(`/${route}`, {
      headers: { Cookie: "ifbs_session=invalid" },
      maxRedirects: 0,
    });
    assert.equal(
      invalidSession.status(),
      200,
      "Invalid sessions do not redirect",
    );
  }
  const stored = await db.user.findUnique({
    where: { email: "alex@ic.ac.uk" },
  });
  assert.ok(stored.passwordHash.startsWith("$2"));
  assert.notEqual(stored.passwordHash, password);
  await page.goto(`${base}/pitches/new`);
  await page.getByLabel("Asset", { exact: true }).fill("bitcoin");
  await page
    .getByRole("option")
    .filter({ hasText: "Bitcoin" })
    .getByRole("button")
    .click();
  await page
    .getByLabel("Title", { exact: true })
    .fill("Bitcoin and the case for patient conviction");
  await page
    .getByLabel("Thesis", { exact: true })
    .fill(
      "## The opportunity\nBitcoin offers a compelling case for a patient investment horizon.\n\n## The risks\nA reversal in demand or a broader market selloff could invalidate this thesis. Members can announce a closing vote if the thesis changes.",
    );
  assert.equal(await page.getByLabel("Take profit (%)").count(), 0);
  assert.equal(await page.getByLabel("Stop loss (%)").count(), 0);
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  assert.equal(await page.getByLabel("Investment (USD)").inputValue(), "10000");
  await page.getByLabel("Investment (USD)").fill("1000");
  await page.getByRole("heading", { name: "The opportunity" }).waitFor();
  await page.getByRole("button", { name: "Publish investment pitch" }).click();
  await page.waitForURL(
    (url) =>
      /^\/pitches\/[^/]+$/.test(url.pathname) &&
      url.pathname !== "/pitches/new",
  );
  const pitchId = page.url().split("/").pop();
  await page.getByRole("button", { name: "Agree", exact: true }).click();
  await page
    .getByLabel("Reason", { exact: true })
    .fill(
      "The thesis balances potential catalysts with a clear downside framework.",
    );
  await page.getByRole("button", { name: "Submit your vote" }).click();
  await page.getByText("Your vote is recorded.", { exact: false }).waitFor();
  assert.equal(
    (
      await context.request.post(`${base}/api/pitches/${pitchId}/votes`, {
        headers,
        data: {
          decision: true,
          reason: "Duplicate vote should be rejected by the database.",
        },
      })
    ).status(),
    409,
  );
  const voterIds = [stored.id];
  for (let n = 2; n <= 6; n++) {
    const client = await playwrightRequest.newContext({
      baseURL: base,
      extraHTTPHeaders: { ...headers, "X-Forwarded-For": `192.0.2.${n}` },
    });
    clients.push(client);
    assert.equal(
      (
        await client.post("/api/auth/register", {
          data: {
            name: `Member ${n}`,
            email: `member${n}@imperial.ac.uk`,
            password,
          },
        })
      ).status(),
      202,
    );
    const token = new URL(
      confirmationLinks.get(`member${n}@imperial.ac.uk`),
    ).searchParams.get("token");
    const confirmations = await Promise.all([
      client.post("/api/auth/verify", { data: { token } }),
      client.post("/api/auth/verify", { data: { token } }),
    ]);
    assert.deepEqual(confirmations.map((r) => r.status()).sort(), [200, 400]);
    voterIds.push(
      (
        await db.user.findUnique({
          where: { email: `member${n}@imperial.ac.uk` },
        })
      ).id,
    );
    if (n <= 5)
      assert.equal(
        (
          await client.post(`/api/pitches/${pitchId}/votes`, {
            data: {
              decision: n <= 3,
              reason:
                "This investment case has sufficient detail to support my considered decision.",
            },
          })
        ).status(),
        201,
      );
  }
  await page.reload();
  await page.getByText("Community conviction", { exact: true }).waitFor();
  await page.screenshot({
    path: `${artifacts}/pitch-detail.png`,
    fullPage: true,
  });
  await page.goto(`${base}/pitches`);
  await page.getByRole("heading", { name: "Investment pitches" }).waitFor();
  await page.screenshot({
    path: `${artifacts}/pitches-desktop.png`,
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.getByRole("heading", { name: "Investment pitches" }).waitFor();
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    "Member page should fit mobile width",
  );
  await page.screenshot({
    path: `${artifacts}/pitches-mobile.png`,
    fullPage: true,
  });
  await db.pitch.update({
    where: { id: pitchId },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });
  assert.equal(
    (
      await clients.at(-1).post(`/api/pitches/${pitchId}/votes`, {
        data: {
          decision: true,
          reason: "Voting after the deadline must be rejected.",
        },
      })
    ).status(),
    409,
  );
  assert.equal((await anonymous.post("/api/cron/resolve")).status(), 401);
  const cronHeaders = { Authorization: `Bearer ${cronSecret}` };
  async function closeByVote(positions) {
    for (const position of positions) {
      const pending = await db.closeProposal.findFirst({
        where: { positionId: position.id, status: "PENDING" },
      });
      const ballot = {
        createdAt: new Date(Date.now() - 2 * 3600000),
        expiresAt: new Date(Date.now() - 1000),
        votes: {
          create: {
            voterId: stored.id,
            decision: true,
            reason: "The investment thesis has changed; close this position.",
          },
        },
      };
      if (pending) {
        await db.closeProposal.update({
          where: { id: pending.id },
          data: ballot,
        });
      } else {
        await db.closeProposal.create({
          data: {
            ...ballot,
            positionId: position.id,
            proposerId: stored.id,
            reason: "The investment thesis has changed; close this position.",
          },
        });
      }
    }
    for (const response of await Promise.all([
      anonymous.post("/api/cron/resolve", { headers: cronHeaders }),
      anonymous.post("/api/cron/resolve", { headers: cronHeaders }),
    ]))
      assert.equal(response.status(), 200, await response.text());
  }
  const resolutions = await Promise.all([
    anonymous.post("/api/cron/resolve", { headers: cronHeaders }),
    anonymous.post("/api/cron/resolve", { headers: cronHeaders }),
  ]);
  for (const response of resolutions)
    assert.equal(response.status(), 200, await response.text());
  assert.equal(await db.position.count({ where: { pitchId } }), 1);
  const position = await db.position.findUnique({ where: { pitchId } });
  assert.equal(Number(position.entryPrice), 100);
  assert.equal(Number(position.quantity), 10);
  assert.equal("targetPrice" in position, false);
  assert.equal("stopPrice" in position, false);
  price = 130;
  assert.equal(
    (
      await anonymous.post("/api/cron/monitor", { headers: cronHeaders })
    ).status(),
    200,
  );
  assert.equal(
    (await db.position.findUnique({ where: { pitchId } })).status,
    "OPEN",
  );
  assert.equal(
    (
      await anonymous.post("/api/cron/monitor", { headers: cronHeaders })
    ).status(),
    200,
  );
  await closeByVote([position]);
  async function fixture(title, decisions, allocation = 1000) {
    return db.pitch.create({
      data: {
        authorId: stored.id,
        coinId: "bitcoin",
        tokenName: "Bitcoin",
        ticker: "BTC",
        title,
        thesis:
          "A research thesis with enough detail to discuss the opportunity and its risks. ".repeat(
            3,
          ),
        allocation,
        expiresAt: new Date(Date.now() - 1000),
        votes: {
          create: decisions.map((decision, i) => ({
            voterId: voterIds[i],
            decision,
            reason: "A detailed reason supporting this member’s vote.",
          })),
        },
      },
    });
  }
  const tie = await fixture("A tied community vote", [
    true,
    true,
    true,
    false,
    false,
    false,
  ]);
  const noQuorum = await fixture("A pitch short of quorum", [
    true,
    true,
    true,
    true,
  ]);
  const stop = await fixture("A pitch for vote-only closing testing", [
    true,
    true,
    true,
    false,
    false,
  ]);
  price = 100;
  stale = true;
  assert.equal(
    (
      await anonymous.post("/api/cron/resolve", { headers: cronHeaders })
    ).status(),
    503,
  );
  assert.equal(
    (await db.pitch.findUnique({ where: { id: stop.id } })).status,
    "PENDING",
  );
  assert.equal(
    (await db.pitch.findUnique({ where: { id: tie.id } })).status,
    "REJECTED",
  );
  assert.equal(
    (await db.pitch.findUnique({ where: { id: noQuorum.id } })).status,
    "REJECTED",
  );
  stale = false;
  assert.equal(
    (
      await anonymous.post("/api/cron/resolve", { headers: cronHeaders })
    ).status(),
    200,
  );
  price = 80;
  assert.equal(
    (
      await anonymous.post("/api/cron/monitor", { headers: cronHeaders })
    ).status(),
    200,
  );
  assert.equal(
    (await db.position.findUnique({ where: { pitchId: stop.id } })).status,
    "OPEN",
  );
  await closeByVote([
    await db.position.findUniqueOrThrow({ where: { pitchId: stop.id } }),
  ]);
  // Keep a live position to verify portfolio quote rendering and outages.
  price = 100;
  const live = await fixture("A live position for valuation", [
    true,
    true,
    true,
    false,
    false,
  ]);
  assert.equal(
    (
      await anonymous.post("/api/cron/resolve", { headers: cronHeaders })
    ).status(),
    200,
  );
  assert.equal(
    (await db.position.findUnique({ where: { pitchId: live.id } })).status,
    "OPEN",
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  // Complete public valuations are readable without a session; snapshots use
  // actual cash and current crypto prices, and never include member details.
  const publicResponse = await anonymous.get("/api/fund");
  assert.equal(publicResponse.status(), 200);
  const publicData = await publicResponse.json();
  const ledger = await db.fund.findUnique({ where: { id: "main" } });
  const openHoldings = await db.position.findMany({
    where: { status: "OPEN" },
  });
  const expectedValue =
    Number(ledger.cash) +
    openHoldings.reduce((sum, p) => sum + Number(p.quantity) * price, 0);
  assert.equal(publicData.total, expectedValue);
  assert.equal(publicData.holdings.length, 2);
  assert.deepEqual(Object.keys(publicData).sort(), [
    "fetchedAt",
    "history",
    "holdings",
    "initialCapital",
    "total",
  ]);
  await db.fundSnapshot.deleteMany();
  stale = true;
  assert.equal(
    (
      await anonymous.post("/api/cron/monitor", { headers: cronHeaders })
    ).status(),
    503,
  );
  assert.equal(
    await db.fundSnapshot.count(),
    0,
    "Stale prices must never create a performance observation",
  );
  stale = false;
  for (const response of await Promise.all(
    [1, 2].map(() =>
      anonymous.post("/api/cron/monitor", { headers: cronHeaders }),
    ),
  ))
    assert.equal(response.status(), 200);
  assert.equal(
    await db.fundSnapshot.count(),
    1,
    "Overlapping jobs should record once",
  );
  assert.equal(
    Number((await db.fundSnapshot.findFirst()).value),
    expectedValue,
  );
  await page.goto(`${base}/fund`);
  await page
    .getByRole("img", { name: "Holdings by current USD value" })
    .waitFor();
  await page.getByText("Bitcoin", { exact: true }).waitFor();
  await page.screenshot({
    path: `${artifacts}/public-fund-desktop.png`,
    fullPage: true,
  });
  await page.goto(`${base}/portfolio`);
  await page.getByText("$100.00", { exact: true }).first().waitFor();
  await page.getByText(/^Refreshed /).waitFor();
  await page.screenshot({
    path: `${artifacts}/portfolio-open.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Closed positions (2)" }).click();
  await page.getByText("+30.00%", { exact: true }).waitFor();
  await page.getByText("-20.00%", { exact: true }).waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Closed positions (2)" })
      .getAttribute("aria-pressed"),
    "true",
  );
  await page.screenshot({
    path: `${artifacts}/portfolio-closed.png`,
    fullPage: true,
  });
  // Closing proposals use their own one-day ballot, without pitch quorum.
  const livePosition = await db.position.findUnique({
    where: { pitchId: live.id },
  });
  const proposalPath = `/api/positions/${livePosition.id}/close-proposals`;
  const reason =
    "The catalyst has changed; close the position before its targets.";
  assert.equal(
    (await anonymous.post(proposalPath, { data: { reason } })).status(),
    401,
  );
  assert.equal(
    (
      await context.request.post(`${base}${proposalPath}`, {
        headers,
        data: { reason, hours: 25 },
      })
    ).status(),
    400,
  );
  await page.goto(`${base}/positions/${livePosition.id}`);
  await page.getByLabel("Reason to close").fill(reason);
  await page.getByLabel("Voting window (hours)").fill("1");
  await page.getByRole("button", { name: "Start vote", exact: true }).click();
  await page.getByText("A close vote is pending.").waitFor();
  const proposal = await db.closeProposal.findFirst({
    where: { positionId: livePosition.id, status: "PENDING" },
  });
  assert.equal(proposal.expiresAt - proposal.createdAt, 3600000);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page
    .getByLabel("Reason", { exact: true })
    .fill("The original thesis no longer supports holding this position.");
  await page.getByRole("button", { name: "Submit your vote" }).click();
  await page.getByText("You voted to close.", { exact: true }).waitFor();
  await page.screenshot({
    path: `${artifacts}/close-vote.png`,
    fullPage: true,
  });
  const closeVotePath = `/api/close-proposals/${proposal.id}/votes`;
  assert.equal(
    (
      await clients[1].post(closeVotePath, {
        data: {
          decision: false,
          reason:
            "Keep the position open because the original thesis remains valid.",
        },
      })
    ).status(),
    201,
  );
  async function expireClose(id) {
    await db.closeProposal.update({
      where: { id },
      data: {
        createdAt: new Date(Date.now() - 2 * 3600000),
        expiresAt: new Date(Date.now() - 1000),
      },
    });
  }
  await expireClose(proposal.id);
  assert.equal(
    (
      await clients[2].post(closeVotePath, { data: { decision: true, reason } })
    ).status(),
    409,
  );
  assert.equal(
    (
      await anonymous.post("/api/cron/resolve", { headers: cronHeaders })
    ).status(),
    200,
  );
  assert.equal(
    (await db.closeProposal.findUnique({ where: { id: proposal.id } })).status,
    "REJECTED",
  );
  assert.equal(
    (await db.position.findUnique({ where: { id: livePosition.id } })).status,
    "OPEN",
  );
  const proposalResponses = await Promise.all(
    [1, 2].map(() =>
      context.request.post(`${base}${proposalPath}`, {
        headers,
        data: { reason, hours: 24 },
      }),
    ),
  );
  assert.deepEqual(proposalResponses.map((r) => r.status()).sort(), [201, 409]);
  const accepted = await proposalResponses
    .find((r) => r.status() === 201)
    .json();
  const acceptedPath = `/api/close-proposals/${accepted.id}/votes`;
  for (let n = 1; n <= 3; n++)
    assert.equal(
      (
        await clients[n].post(acceptedPath, {
          data: { decision: n <= 2, reason },
        })
      ).status(),
      201,
    );
  assert.equal(
    (
      await clients[1].post(acceptedPath, { data: { decision: true, reason } })
    ).status(),
    409,
  );
  await expireClose(accepted.id);
  stale = true;
  assert.equal(
    (
      await anonymous.post("/api/cron/resolve", { headers: cronHeaders })
    ).status(),
    503,
  );
  assert.equal(
    (await db.position.findUnique({ where: { id: livePosition.id } })).status,
    "OPEN",
  );
  const beforeClose = await db.fund.findUnique({ where: { id: "main" } });
  stale = false;
  price = 110;
  for (const response of await Promise.all([
    anonymous.post("/api/cron/resolve", { headers: cronHeaders }),
    anonymous.post("/api/cron/resolve", { headers: cronHeaders }),
    anonymous.post("/api/cron/monitor", { headers: cronHeaders }),
  ]))
    assert.equal(response.status(), 200, await response.text());
  const afterClose = await db.fund.findUnique({ where: { id: "main" } });
  assert.equal(Number(afterClose.cash) - Number(beforeClose.cash), 1100);
  assert.equal(Number(afterClose.allocated), 0);
  assert.equal(
    (await db.position.findUnique({ where: { id: livePosition.id } }))
      .closeReason,
    "EARLY_VOTE",
  );
  assert.equal(
    (await db.closeProposal.findUnique({ where: { id: accepted.id } })).status,
    "PASSED",
  );
  assert.equal(
    (
      await context.request.post(`${base}${proposalPath}`, {
        headers,
        data: { reason },
      })
    ).status(),
    409,
  );

  // More cash from gains must not allow over $100,000 in open allocations.
  price = 100;
  const capitalPitches = [];
  for (let n = 0; n < 11; n++)
    capitalPitches.push(
      await fixture(
        `Capital test ${n}`,
        [true, true, true, false, false],
        n === 10 ? 1000 : 10000,
      ),
    );
  for (const response of await Promise.all([
    anonymous.post("/api/cron/resolve", { headers: cronHeaders }),
    anonymous.post("/api/cron/resolve", { headers: cronHeaders }),
  ]))
    assert.equal(response.status(), 200, await response.text());
  const fullFund = await db.fund.findUnique({ where: { id: "main" } });
  assert.ok(Number(fullFund.cash) >= 0);
  assert.equal(Number(fullFund.allocated), 100000);
  assert.equal(
    (await db.pitch.findUnique({ where: { id: capitalPitches[10].id } }))
      .status,
    "QUEUED",
  );
  const openAllocation = await db.position.aggregate({
    where: { status: "OPEN" },
    _sum: { allocation: true },
  });
  assert.equal(Number(openAllocation._sum.allocation), 100000);
  const cancellationPosition = await db.position.findUnique({
    where: { pitchId: capitalPitches[0].id },
  });
  const cancellation = await context.request.post(
    `${base}/api/positions/${cancellationPosition.id}/close-proposals`,
    { headers, data: { reason } },
  );
  assert.equal(cancellation.status(), 201);
  const cancellationId = (await cancellation.json()).id;
  price = 80;
  for (const response of await Promise.all([
    anonymous.post("/api/cron/monitor", { headers: cronHeaders }),
    anonymous.post("/api/cron/monitor", { headers: cronHeaders }),
  ]))
    assert.equal(response.status(), 200, await response.text());
  assert.equal(
    (await db.closeProposal.findUnique({ where: { id: cancellationId } }))
      .status,
    "PENDING",
  );
  const unchanged = await db.fund.findUnique({ where: { id: "main" } });
  assert.equal(Number(unchanged.cash), Number(fullFund.cash));
  assert.equal(Number(unchanged.allocated), 100000);
  await closeByVote(await db.position.findMany({ where: { status: "OPEN" } }));
  assert.equal(
    (await db.closeProposal.findUnique({ where: { id: cancellationId } }))
      .status,
    "PASSED",
  );
  const credited = await db.fund.findUnique({ where: { id: "main" } });
  // Closing votes release cash before queued pitches execute in the same run.
  assert.equal(Number(credited.allocated), 1000);
  assert.equal(Number(credited.cash) - Number(fullFund.cash), 79000);
  assert.equal(
    (
      await anonymous.post("/api/cron/resolve", { headers: cronHeaders })
    ).status(),
    200,
  );
  assert.equal(
    (await db.pitch.findUnique({ where: { id: capitalPitches[10].id } }))
      .status,
    "PASSED",
  );
  assert.equal(
    Number((await db.fund.findUnique({ where: { id: "main" } })).allocated),
    1000,
  );
  // Losses leave less than $100,000 cash: the cash limit must bind first.
  const cashPitches = [];
  for (let n = 0; n < 8; n++)
    cashPitches.push(
      await fixture(
        `Cash limit test ${n}`,
        [true, true, true, false, false],
        10000,
      ),
    );
  assert.equal(
    (
      await anonymous.post("/api/cron/resolve", { headers: cronHeaders })
    ).status(),
    200,
  );
  const constrained = await db.fund.findUnique({ where: { id: "main" } });
  assert.equal(Number(constrained.allocated), 71000);
  assert.equal(Number(constrained.cash), 9200);
  assert.equal(
    (await db.pitch.findUnique({ where: { id: cashPitches[7].id } })).status,
    "QUEUED",
  );

  await page.goto(`${base}/account`);
  await page
    .getByRole("checkbox", { name: "Receive the weekly pitch digest" })
    .uncheck();
  await page.getByText("Preference saved.").waitFor();
  assert.equal(
    (await db.user.findUnique({ where: { id: stored.id } })).digestEnabled,
    false,
  );
  await page.screenshot({ path: `${artifacts}/account.png`, fullPage: true });
  const digestPitch = await fixture(
    "A new active pitch for the weekly digest",
    [],
  );
  await db.pitch.update({
    where: { id: digestPitch.id },
    data: { expiresAt: new Date(Date.now() + 86400000) },
  });
  assert.equal(
    (
      await anonymous.post("/api/cron/digest", { headers: cronHeaders })
    ).status(),
    503,
  );
  assert.equal(broadcastsCreated, 1);
  assert.equal(
    broadcastsSent,
    0,
    "Failed updates must not send a stale digest",
  );
  const campaign = await db.digestBroadcast.findFirst();
  assert.ok(campaign.broadcastId);
  assert.equal(campaign.lockOwner, null, "Failures release the digest lease");
  // Simulate losing the saved ID: recover the remote draft by its stable name.
  await db.digestBroadcast.update({
    where: { week: campaign.week },
    data: { broadcastId: null },
  });
  await db.pitch.update({
    where: { id: digestPitch.id },
    data: { title: "Fresh digest body after a failed draft update" },
  });
  const digestRuns = await Promise.all([
    anonymous.post("/api/cron/digest", { headers: cronHeaders }),
    anonymous.post("/api/cron/digest", { headers: cronHeaders }),
  ]);
  assert.deepEqual(digestRuns.map((r) => r.status()).sort(), [200, 503]);
  assert.equal(
    (await digestRuns.find((r) => r.status() === 200).json()).queued,
    4,
  );
  assert.equal(broadcastsCreated, 1, "Retry reuses the remote draft");
  assert.equal(broadcastsSent, 1);
  assert.ok(
    [...broadcasts.values()][0].html.includes(
      "Fresh digest body after a failed draft update",
    ),
  );
  assert.equal(
    emailsSent,
    4,
    "App opt-outs and Resend unsubscribes are excluded",
  );
  assert.equal(segmentMembers.has("opted-out"), false);
  assert.equal(segmentMembers.has("outsider"), false);
  assert.equal(segmentMembers.has("unsubscribed"), false);
  assert.equal(contacts.get("unsubscribed").unsubscribed, true);
  assert.equal(
    (await db.digestBroadcast.findFirst()).broadcastId,
    campaign.broadcastId,
  );
  assert.equal(
    (
      await anonymous.post("/api/cron/digest", { headers: cronHeaders })
    ).status(),
    200,
  );
  assert.equal(
    emailsSent,
    8,
    "Each new digest goes to current opted-in members",
  );
  assert.equal(broadcastsSent, 2);
  assert.equal(broadcastsCreated, 2, "A new request creates a fresh broadcast");
  const nextCampaign = await db.digestBroadcast.findFirst();
  assert.notEqual(nextCampaign.broadcastId, campaign.broadcastId);
  assert.equal(nextCampaign.generation, 1);
  const rows = await db.$queryRawUnsafe(
    `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = '${schema}' AND tablename <> '_prisma_migrations'`,
  );
  assert.ok(
    rows.length === 12 && rows.every((row) => row.rowsecurity),
    "All app tables should enable RLS",
  );
  await context.request.post(`${base}/api/auth/logout`, { headers });
  assert.equal((await context.request.get(`${base}/api/prices`)).status(), 401);
  for (const route of ["login", "register"]) {
    await page.goto(`${base}/${route}`);
    await page.getByLabel("Imperial email address").waitFor();
    assert.equal(new URL(page.url()).pathname, `/${route}`);
  }
  assert.equal(
    (
      await anonymous.post("/api/auth/login", {
        data: { email: "alex@ic.ac.uk", password: "incorrect-password" },
      })
    ).status(),
    401,
  );
  assert.equal(
    (
      await anonymous.post("/api/auth/login", {
        data: { email: "alex@ic.ac.uk", password },
      })
    ).status(),
    200,
  );
  await page.goto(`${base}/login`);
  await page.getByLabel("Imperial email address").fill("alex@ic.ac.uk");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in to Consensus" }).click();
  await page.waitForURL("**/dashboard");
  for (const route of ["login", "register"]) {
    await page.goto(`${base}/${route}`);
    await page.waitForURL("**/dashboard");
  }
  await page.screenshot({
    path: `${artifacts}/dashboard-populated.png`,
    fullPage: true,
  });
  assert.deepEqual(browserErrors, [], "Browser should have no uncaught errors");
  console.log(
    "PASS: email confirmation, pending-account access, expiry/replay/concurrent confirmation, resend limits, delivery retry, domain/CSRF protection, login/logout, token search, Markdown, voting, duplicate/deadline protection, concurrent resolution, stale-price retries, quorum/tie rejection, vote-only closing, portfolio P&L, public fund charts/valuations, snapshot integrity, digest preferences, fresh broadcasts/retry recovery, RLS, and mobile layouts.",
  );
  console.log(`Screenshots: ${artifacts}`);
} finally {
  if (browser) await browser.close();
  for (const client of clients) await client.dispose();
  if (app) {
    app.kill("SIGTERM");
    await new Promise((resolve) => {
      app.once("exit", resolve);
      setTimeout(resolve, 3000);
    });
  }
  market.close();
  mail.close();
  await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await db.$disconnect();
  console.log(
    "Removed isolated test schema and its test records. The public application tables were preserved.",
  );
}
