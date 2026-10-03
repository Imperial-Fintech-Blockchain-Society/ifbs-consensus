export type Holding = {
  id: string;
  ticker: string;
  name: string;
  quantity: number | null;
  value: number | null;
};
type Position = {
  coinId: string;
  ticker: string;
  name: string;
  quantity: number;
};
type Quote = { usd: number; last_updated_at?: number };

export function valueHoldings(
  cash: number,
  positions: Position[],
  quotes: Record<string, Quote>,
  now: number,
) {
  const assets = new Map<string, Holding>();
  for (const position of positions) {
    const quote = quotes[position.coinId];
    const valid =
      quote &&
      Number.isFinite(quote.usd) &&
      quote.usd > 0 &&
      quote.last_updated_at &&
      now / 1000 - quote.last_updated_at <= 300 &&
      quote.last_updated_at <= now / 1000 + 60;
    const existing = assets.get(position.coinId);
    const quantity = (existing?.quantity ?? 0) + position.quantity;
    assets.set(position.coinId, {
      id: position.coinId,
      ticker: position.ticker.toUpperCase(),
      name: position.name,
      quantity,
      value: valid ? quantity * quote.usd : null,
    });
  }
  const holdings: Holding[] = [
    {
      id: "cash-usd",
      ticker: "CASH",
      name: "US dollars",
      quantity: null,
      value: cash,
    },
    ...[...assets.values()].sort((a, b) => a.id.localeCompare(b.id)),
  ];
  const total = holdings.every((h) => h.value !== null)
    ? holdings.reduce((sum, h) => sum + h.value!, 0)
    : null;
  return { holdings, total };
}

export type PublicFundData = {
  holdings: Holding[];
  total: number | null;
  initialCapital: number;
  fetchedAt: string;
  history: { at: string; value: number }[];
};
