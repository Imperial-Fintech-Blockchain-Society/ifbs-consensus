import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveAll: vi.fn(),
  monitorPositions: vi.fn(),
  sendDigest: vi.fn(),
  recordFundSnapshot: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("../src/lib/db", () => ({ db: {} }));
vi.mock("../src/lib/engine", () => ({
  resolveAll: mocks.resolveAll,
  monitorPositions: mocks.monitorPositions,
}));
vi.mock("../src/lib/digest", () => ({ sendDigest: mocks.sendDigest }));
vi.mock("../src/lib/public-fund", () => ({
  recordFundSnapshot: mocks.recordFundSnapshot,
}));

import { POST } from "../src/app/api/cron/[job]/route";
const secret = "cron-test-secret-with-at-least-32-characters";
function invoke(job: string, authenticated = true) {
  return POST(
    new Request(`https://www.ifbsconsensus.com/api/cron/${job}`, {
      method: "POST",
      headers: authenticated ? { Authorization: `Bearer ${secret}` } : {},
    }),
    { params: Promise.resolve({ job }) },
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("CRON_SECRET", secret);
  mocks.resolveAll.mockResolvedValue({
    resolved: 1,
    queued: 0,
    closeVotesResolved: 1,
    failures: [],
  });
  mocks.monitorPositions.mockResolvedValue({ closed: 1, failures: [] });
  mocks.sendDigest.mockResolvedValue({ sent: 1 });
  mocks.recordFundSnapshot.mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllEnvs());

describe("Scheduled endpoints", () => {
  it.each(["resolve", "monitor", "digest"])(
    "rejects unauthenticated %s without executing jobs",
    async (job) => {
      expect((await invoke(job, false)).status).toBe(401);
      for (const mock of Object.values(mocks))
        expect(mock).not.toHaveBeenCalled();
    },
  );
  it.each([
    ["resolve", "resolveAll"],
    ["monitor", "monitorPositions"],
    ["digest", "sendDigest"],
  ] as const)("executes authenticated %s", async (job, handler) => {
    const response = await invoke(job);
    expect(response.status).toBe(200);
    const expected =
      job === "resolve"
        ? { resolved: 1, queued: 0, closeVotesResolved: 1, failures: [] }
        : job === "monitor"
          ? { closed: 1, failures: [] }
          : { sent: 1 };
    expect(await response.json()).toEqual(expected);
    expect(mocks[handler]).toHaveBeenCalledOnce();
    expect(mocks.recordFundSnapshot).toHaveBeenCalledTimes(
      job === "monitor" ? 1 : 0,
    );
  });
  it("returns a retryable failure when monitoring cannot execute an exit", async () => {
    mocks.monitorPositions.mockResolvedValue({
      closed: 0,
      failures: ["position-1"],
    });
    const response = await invoke("monitor");
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      closed: 0,
      failures: ["position-1"],
    });
    expect(mocks.recordFundSnapshot).toHaveBeenCalledOnce();
  });
  it("reports snapshot failures while retaining the monitor result", async () => {
    mocks.recordFundSnapshot.mockRejectedValue(new Error("Missing quote"));
    const response = await invoke("monitor");
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      closed: 1,
      failures: ["fund-snapshot"],
    });
  });
  it("rejects unknown jobs", async () => {
    expect((await invoke("unknown")).status).toBe(404);
  });
});
