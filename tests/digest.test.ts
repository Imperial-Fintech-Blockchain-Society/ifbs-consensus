import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: {
    digestBroadcast: {
      upsert: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    digestDelivery: { findMany: vi.fn() },
    pitch: { findMany: vi.fn() },
    user: { findMany: vi.fn() },
  },
  broadcasts: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    send: vi.fn(),
  },
  contacts: {
    list: vi.fn(),
    create: vi.fn(),
    segments: { add: vi.fn(), remove: vi.fn() },
  },
  segments: { list: vi.fn(), create: vi.fn(), get: vi.fn() },
}));
vi.mock("server-only", () => ({}));
vi.mock("../src/lib/db", () => ({ db: mocks.db }));
vi.mock("resend", () => ({
  Resend: class {
    broadcasts = mocks.broadcasts;
    contacts = mocks.contacts;
    segments = mocks.segments;
  },
}));
import { sendDigest } from "../src/lib/digest";

const ok = <T>(data: T) => ({ data, error: null });
const list = <T>(data: T[]) => ok({ data, has_more: false });
let state: {
  week: string;
  broadcastId: string | null;
  segmentId: string | null;
  submittedAt: Date | null;
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("RESEND_API_KEY", "re_test");
  vi.stubEnv("EMAIL_FROM", "test@example.com");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://consensus.example.com");
  vi.stubEnv("RESEND_DIGEST_SEGMENT_ID", "segment");
  // Advance the pacing clock without delaying tests or changing the calendar.
  let tick = Date.now();
  vi.spyOn(Date, "now").mockImplementation(() => (tick += 1000));
  state = {
    week: "test-week",
    broadcastId: null,
    segmentId: null,
    submittedAt: null,
  };
  mocks.db.digestBroadcast.updateMany.mockResolvedValue({ count: 1 });
  mocks.db.digestBroadcast.findUniqueOrThrow.mockImplementation(async () => ({
    ...state,
  }));
  mocks.db.digestBroadcast.update.mockImplementation(async ({ data }) =>
    Object.assign(state, data),
  );
  mocks.db.digestDelivery.findMany.mockResolvedValue([]);
  mocks.db.pitch.findMany.mockResolvedValue([
    {
      id: "pitch",
      ticker: "BTC",
      title: "<script> {{{UNTRUSTED}}}",
      thesis: "Research & debate",
      _count: { votes: 2 },
    },
  ]);
  mocks.db.user.findMany.mockResolvedValue([{ email: "member@ic.ac.uk" }]);
  mocks.broadcasts.list.mockResolvedValue(list([]));
  mocks.broadcasts.get.mockResolvedValue(ok({ id: "draft", status: "draft" }));
  mocks.broadcasts.create.mockResolvedValue(ok({ id: "draft" }));
  mocks.broadcasts.update.mockResolvedValue(ok({ id: "draft" }));
  mocks.broadcasts.send.mockResolvedValue(ok({ id: "draft" }));
  mocks.segments.get.mockResolvedValue(ok({ id: "segment" }));
  mocks.contacts.list.mockResolvedValue(list([]));
  mocks.contacts.create.mockResolvedValue(ok({ id: "contact" }));
  mocks.contacts.segments.add.mockResolvedValue(ok({ id: "contact" }));
  mocks.contacts.segments.remove.mockResolvedValue(ok({ id: "contact" }));
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("Broadcast digest", () => {
  it("refreshes and submits a draft with safe content and an unsubscribe link", async () => {
    expect(await sendDigest()).toMatchObject({
      queued: 1,
      broadcastId: "draft",
    });
    const content = mocks.broadcasts.update.mock.calls[0][1];
    expect(content.html).toContain("{{{RESEND_UNSUBSCRIBE_URL}}}");
    expect(content.text).toContain("{{{RESEND_UNSUBSCRIBE_URL}}}");
    expect(content.html).not.toContain("<script>");
    expect(content.html).not.toContain("{{{UNTRUSTED}}}");
    expect(content.text).not.toContain("{{{UNTRUSTED}}}");
    expect(mocks.broadcasts.update.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.broadcasts.send.mock.invocationCallOrder[0],
    );
    expect(state.submittedAt).toBeInstanceOf(Date);
  });
  it("does not send a stale draft when updating it fails and reuses it on retry", async () => {
    mocks.broadcasts.update.mockResolvedValueOnce({
      data: null,
      error: { name: "application_error" },
    });
    await expect(sendDigest()).rejects.toMatchObject({ status: 503 });
    expect(mocks.broadcasts.send).not.toHaveBeenCalled();
    expect(state.broadcastId).toBe("draft");
    expect(state.submittedAt).toBeNull();
    expect(mocks.db.digestBroadcast.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: { lockOwner: null, lockedUntil: null } }),
    );
    await sendDigest();
    expect(mocks.broadcasts.create).toHaveBeenCalledTimes(1);
    expect(mocks.broadcasts.get).toHaveBeenCalledWith("draft");
    expect(mocks.broadcasts.send).toHaveBeenCalledTimes(1);
  });
  it("does not resend after the send response is lost but Resend has queued it", async () => {
    state.broadcastId = "draft";
    mocks.broadcasts.send.mockResolvedValueOnce({
      data: null,
      error: { name: "application_error" },
    });
    await expect(sendDigest()).rejects.toMatchObject({ status: 503 });
    expect(state.submittedAt).toBeNull();
    mocks.broadcasts.get.mockResolvedValue(
      ok({ id: "draft", status: "queued" }),
    );
    expect(await sendDigest()).toMatchObject({
      queued: 0,
      broadcastId: "draft",
    });
    expect(mocks.broadcasts.send).toHaveBeenCalledTimes(1);
    expect(state.submittedAt).toBeInstanceOf(Date);
  });
  it("preserves remote unsubscribes even when the app preference remains enabled", async () => {
    mocks.contacts.list.mockResolvedValue(
      list([{ id: "contact", email: "member@ic.ac.uk", unsubscribed: true }]),
    );
    expect(await sendDigest()).toMatchObject({
      queued: 0,
      skipped: "No subscribed recipients",
    });
    expect(mocks.contacts.create).not.toHaveBeenCalled();
    expect(mocks.contacts.segments.add).not.toHaveBeenCalled();
    expect(mocks.contacts.segments.remove).toHaveBeenCalledWith({
      contactId: "contact",
      segmentId: "segment",
    });
    expect(mocks.broadcasts.send).not.toHaveBeenCalled();
  });
  it("does not create a broadcast when there are no current pitches", async () => {
    mocks.db.pitch.findMany.mockResolvedValue([]);
    expect(await sendDigest()).toMatchObject({
      queued: 0,
      skipped: "No new active pitches",
    });
    expect(mocks.contacts.list).not.toHaveBeenCalled();
    expect(mocks.broadcasts.create).not.toHaveBeenCalled();
  });
  it("rejects an overlapping call before any external mutation", async () => {
    mocks.db.digestBroadcast.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(sendDigest()).rejects.toMatchObject({ status: 503 });
    expect(mocks.broadcasts.list).not.toHaveBeenCalled();
    expect(mocks.contacts.create).not.toHaveBeenCalled();
  });
});
