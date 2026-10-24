import { describe, expect, it } from "vitest";
import {
  imperialEmail,
  registerSchema,
  pitchSchema,
  voteSchema,
  passes,
  exitReason,
  pnl,
  closePasses,
  closeProposalSchema,
} from "../src/lib/rules";
describe("Imperial-only registration", () => {
  it("normalizes valid member emails and rejects lookalike domains", () => {
    expect(imperialEmail.parse(" Member@IC.AC.UK ")).toBe("member@ic.ac.uk");
    expect(imperialEmail.safeParse("member@imperial.ac.uk").success).toBe(true);
    for (const email of [
      "member@gmail.com",
      "member@imperial.ac.uk.evil.com",
      "member@evilimperial.ac.uk",
      "member@sub.ic.ac.uk",
      "member@@ic.ac.uk",
    ])
      expect(imperialEmail.safeParse(email).success).toBe(false);
  });
  it("requires sufficiently long passwords", () => {
    expect(
      registerSchema.safeParse({
        name: "Alex",
        email: "a@ic.ac.uk",
        password: "short",
      }).success,
    ).toBe(false);
  });
});
describe("Consensus decisions", () => {
  it("enforces quorum and a strict majority", () => {
    expect(passes(4, 4)).toBe(false);
    expect(passes(3, 5)).toBe(true);
    expect(passes(2, 5)).toBe(false);
    expect(passes(3, 6)).toBe(false);
    expect(passes(4, 6)).toBe(true);
    expect(passes(0, 0)).toBe(false);
  });
  it("requires a reason and a boolean decision", () => {
    expect(
      voteSchema.safeParse({ decision: true, reason: "yes" }).success,
    ).toBe(false);
    expect(
      voteSchema.safeParse({
        decision: "true",
        reason: "A sufficiently detailed reason for this vote.",
      }).success,
    ).toBe(false);
  });
  it("requires a stop loss, ignores take profit, and protects coin identifiers", () => {
    const valid = {
      coinId: "bitcoin",
      title: "A compelling Bitcoin thesis",
      thesis: "a".repeat(100),
      stopLossPercent: 10,
    };
    expect(pitchSchema.safeParse(valid).success).toBe(true);
    expect(pitchSchema.parse(valid).allocation).toBe(10000);
    const legacyPitch = pitchSchema.parse({
      ...valid,
      takeProfitPercent: 25,
      stopLossPercent: 10,
    });
    expect(legacyPitch).not.toHaveProperty("takeProfitPercent");
    expect(legacyPitch.stopLossPercent).toBe(10);
    for (const stopLossPercent of [
      undefined,
      null,
      0,
      -1,
      1,
      4.99,
      20.01,
      90,
      100,
    ])
      expect(pitchSchema.safeParse({ ...valid, stopLossPercent }).success).toBe(
        false,
      );
    for (const stopLossPercent of [5, 5.01, 10, 19.99, 20])
      expect(pitchSchema.safeParse({ ...valid, stopLossPercent }).success).toBe(
        true,
      );
    expect(
      pitchSchema.parse({ ...valid, allocation: "2345.67" }).allocation,
    ).toBe(2345.67);
    for (const allocation of [0, -1, 10000.01, 10.001])
      expect(pitchSchema.safeParse({ ...valid, allocation }).success).toBe(
        false,
      );
    expect(
      pitchSchema.safeParse({ ...valid, coinId: "../admin" }).success,
    ).toBe(false);
  });
});
describe("Closing votes", () => {
  it("requires a strict majority without a pitch quorum", () => {
    expect(closePasses(0, 0)).toBe(false);
    expect(closePasses(1, 2)).toBe(false);
    expect(closePasses(1, 1)).toBe(true);
    expect(closePasses(2, 3)).toBe(true);
  });
  it("allows voting windows from one to twenty-four hours", () => {
    const reason = "Close because the original catalyst has changed.";
    expect(closeProposalSchema.parse({ reason }).hours).toBe(24);
    for (const hours of [1, 12, 24])
      expect(closeProposalSchema.safeParse({ reason, hours }).success).toBe(
        true,
      );
    for (const hours of [0, -1, 25, 1.5])
      expect(closeProposalSchema.safeParse({ reason, hours }).success).toBe(
        false,
      );
  });
});
describe("Paper performance", () => {
  it("closes only at or below a configured stop loss", () => {
    expect(exitReason(90, 90)).toBe("STOP_LOSS");
    expect(exitReason(80, 90)).toBe("STOP_LOSS");
    expect(exitReason(100, 90)).toBeNull();
    expect(exitReason(130, 90)).toBeNull();
    expect(exitReason(1, null)).toBeNull();
  });
  it("calculates dollar P&L from actual quantity", () => {
    expect(pnl(100, 125, 10)).toEqual({ amount: 250, percent: 25 });
    expect(pnl(100, 80, 10).amount).toBe(-200);
    expect(pnl(100, 100, 10).amount).toBe(0);
  });
});
