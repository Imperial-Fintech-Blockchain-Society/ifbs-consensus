import { describe, expect, it } from "vitest";
import { valueHoldings } from "../src/lib/fund-valuation";

const now = 1_800_000_000_000;
const position = {
  coinId: "bitcoin",
  ticker: "btc",
  name: "Bitcoin",
  quantity: 2,
};
const quote = { usd: 120, last_updated_at: now / 1000 };

describe("Public fund valuations", () => {
  it("values a cash-only fund without market prices", () => {
    const result = valueHoldings(100000, [], {}, now);
    expect(result.total).toBe(100000);
    expect(result.holdings).toEqual([
      {
        id: "cash-usd",
        ticker: "CASH",
        name: "US dollars",
        quantity: null,
        value: 100000,
      },
    ]);
  });
  it("aggregates repeated coin holdings at market value and includes actual cash", () => {
    const result = valueHoldings(
      900,
      [position, { ...position, quantity: 3 }],
      { bitcoin: quote },
      now,
    );
    expect(result.total).toBe(1500);
    expect(result.holdings[1]).toMatchObject({
      ticker: "BTC",
      quantity: 5,
      value: 600,
    });
  });
  it("keeps coins with identical tickers separate", () => {
    const result = valueHoldings(
      0,
      [position, { ...position, coinId: "another-coin" }],
      { bitcoin: quote, "another-coin": { ...quote, usd: 10 } },
      now,
    );
    expect(result.holdings).toHaveLength(3);
    expect(result.total).toBe(260);
  });
  it("does not present incomplete, stale or invalid quotes as current fund value", () => {
    for (const invalid of [
      undefined,
      { ...quote, usd: 0 },
      { ...quote, usd: NaN },
      { ...quote, last_updated_at: undefined },
      { ...quote, last_updated_at: now / 1000 - 301 },
      { ...quote, last_updated_at: now / 1000 + 61 },
    ]) {
      const result = valueHoldings(
        900,
        [position],
        invalid ? { bitcoin: invalid } : {},
        now,
      );
      expect(result.total).toBeNull();
      expect(result.holdings[0].value).toBe(900);
      expect(result.holdings[1].value).toBeNull();
    }
  });
});
