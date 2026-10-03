import "server-only";
import { HttpError } from "./http";
export type Coin = { id: string; name: string; symbol: string; thumb?: string };
export type Quote = {
  usd: number;
  usd_24h_change?: number;
  last_updated_at?: number;
};
async function gecko<T>(path: string, revalidate: number): Promise<T> {
  const base =
    process.env.COINGECKO_API_URL || "https://api.coingecko.com/api/v3";
  const headers: Record<string, string> = { accept: "application/json" };
  if (process.env.COINGECKO_API_KEY)
    headers["x-cg-demo-api-key"] = process.env.COINGECKO_API_KEY;
  try {
    const response = await fetch(`${base.replace(/\/$/, "")}${path}`, {
      headers,
      next: { revalidate },
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw new Error(`CoinGecko ${response.status}`);
    return (await response.json()) as T;
  } catch {
    throw new HttpError(
      503,
      "Market data is temporarily unavailable. Please try again shortly.",
    );
  }
}
export async function searchCoins(query: string) {
  const data = await gecko<{ coins: Coin[] }>(
    `/search?query=${encodeURIComponent(query)}`,
    300,
  );
  return data.coins
    .slice(0, 12)
    .map(({ id, name, symbol, thumb }) => ({ id, name, symbol, thumb }));
}
export async function validateCoin(id: string) {
  const data = await gecko<Coin>(
    `/coins/${encodeURIComponent(id)}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false`,
    3600,
  );
  if (!data.id || !data.symbol || !data.name)
    throw new HttpError(400, "Choose a valid CoinGecko token.");
  return data;
}
export async function prices(ids: string[], fresh = false) {
  if (!ids.length) return {} as Record<string, Quote>;
  const unique = [...new Set(ids)];
  const result: Record<string, Quote> = {};
  for (let i = 0; i < unique.length; i += 100) {
    Object.assign(
      result,
      await gecko<Record<string, Quote>>(
        `/simple/price?ids=${unique
          .slice(i, i + 100)
          .map(encodeURIComponent)
          .join(
            ",",
          )}&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true`,
        fresh ? 0 : 60,
      ),
    );
  }
  return result;
}
export function executablePrice(quote: Quote | undefined) {
  if (
    !quote ||
    !Number.isFinite(quote.usd) ||
    quote.usd < 0.0000000001 ||
    !quote.last_updated_at ||
    Date.now() / 1000 - quote.last_updated_at > 300 ||
    quote.last_updated_at > Date.now() / 1000 + 60
  )
    throw new HttpError(
      503,
      "A recent valid price within the fund’s supported precision is required to execute this position.",
    );
  return quote.usd;
}
