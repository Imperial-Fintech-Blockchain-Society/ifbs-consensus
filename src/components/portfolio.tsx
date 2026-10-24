"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  RefreshCw,
  ArrowUpRight,
  ChartNoAxesCombined,
  Wallet,
  Target,
  CheckCheck,
} from "lucide-react";
import { money, percent, date } from "@/lib/format";
import { pnl } from "@/lib/rules";
import { Stat, Empty } from "./ui";
type Quote = { usd: number; last_updated_at?: number };
export type PositionData = {
  id: string;
  pitchId: string;
  ticker: string;
  tokenName: string;
  title: string;
  coinId: string;
  status: string;
  allocation: number;
  quantity: number;
  entryPrice: number;
  stopPrice: number | null;
  entryTime: string;
  closePrice: number | null;
  closeTime: string | null;
  closeReason: string | null;
  closeVotePending: boolean;
};
export function Portfolio({
  positions,
  fund,
}: {
  positions: PositionData[];
  fund: {
    initialCapital: number;
    cash: number;
    allocated: number;
    available: number;
  };
}) {
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [updated, setUpdated] = useState("");
  const [tab, setTab] = useState("OPEN");
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setBusy(true);
      try {
        const response = await fetch("/api/prices", {
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setQuotes(data.quotes);
        setUpdated(data.fetchedAt);
        setError("");
      } catch (err) {
        if (!controller.signal.aborted)
          setError(
            err instanceof Error
              ? err.message
              : "Could not load market prices.",
          );
      } finally {
        if (!controller.signal.aborted) setBusy(false);
      }
    }
    void load();
    const interval = setInterval(load, 60000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, []);
  async function refresh() {
    setBusy(true);
    try {
      const response = await fetch("/api/prices");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setQuotes(data.quotes);
      setUpdated(data.fetchedAt);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load prices.");
    } finally {
      setBusy(false);
    }
  }
  const open = positions.filter((p) => p.status === "OPEN");
  const closed = positions.filter((p) => p.status === "CLOSED");
  const quoteFor = (p: PositionData) => {
    const quote = quotes[p.coinId];
    return !error &&
      quote &&
      Number.isFinite(quote.usd) &&
      quote.usd > 0 &&
      quote.last_updated_at &&
      new Date(updated).getTime() / 1000 - quote.last_updated_at < 300 &&
      quote.last_updated_at <= new Date(updated).getTime() / 1000 + 60
      ? quote.usd
      : null;
  };
  const complete = open.every((p) => quoteFor(p) !== null);
  const unrealized = open.reduce(
    (sum, p) =>
      sum +
      (quoteFor(p) === null
        ? 0
        : pnl(p.entryPrice, quoteFor(p)!, p.quantity).amount),
    0,
  );
  const realized = closed.reduce(
    (sum, p) => sum + pnl(p.entryPrice, p.closePrice!, p.quantity).amount,
    0,
  );
  const fundValue = complete
    ? fund.cash + open.reduce((sum, p) => sum + quoteFor(p)! * p.quantity, 0)
    : null;
  return (
    <>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Fund value"
          value={fundValue === null ? "—" : money(fundValue)}
          note={`${money(fund.initialCapital)} starting capital`}
          icon={<Wallet size={17} />}
        />
        <Stat
          label="Available to invest"
          value={money(fund.available)}
          note={`${money(fund.cash)} cash`}
          icon={<ChartNoAxesCombined size={17} />}
        />
        <Stat
          label="Realized P&L"
          value={money(realized)}
          note={`${closed.length} closed positions · USD`}
          icon={<CheckCheck size={17} />}
        />
        <Stat
          label="Allocated capital"
          value={money(fund.allocated)}
          note={`${open.length} open positions`}
          icon={<Target size={17} />}
        />
      </div>
      <p className="mb-6 text-xs text-slate-500">
        Unrealized P&L: {complete ? money(unrealized) : "—"}
      </p>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1">
          {["OPEN", "CLOSED"].map((t) => (
            <button
              key={t}
              aria-pressed={tab === t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-4 py-2 text-xs font-semibold ${tab === t ? "bg-blue-50 text-brand" : "text-slate-500"}`}
            >
              {t === "OPEN" ? "Open positions" : "Closed positions"} (
              {t === "OPEN" ? open.length : closed.length})
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-slate-400">
            {updated
              ? `Refreshed ${new Date(updated).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
              : "Loading prices…"}
          </span>
          <button
            onClick={refresh}
            disabled={busy}
            aria-label="Refresh market prices"
            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500"
          >
            <RefreshCw size={15} className={busy ? "animate-spin" : ""} />
          </button>
        </div>
      </div>
      {error && (
        <p
          role="alert"
          className="mb-5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          {error} Open-position valuations are unavailable until prices recover.
        </p>
      )}
      {(tab === "OPEN" ? open : closed).length ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50/50 text-[10px] uppercase tracking-wider text-slate-400">
                <tr>
                  {[
                    "Asset / thesis",
                    "Entry price",
                    tab === "OPEN" ? "Current price" : "Exit price",
                    "Paper value",
                    "Return",
                    tab === "OPEN" ? "Closing" : "Closed",
                    "",
                  ].map((h, i) => (
                    <th key={i} className="px-5 py-4 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(tab === "OPEN" ? open : closed).map((p) => {
                  const current =
                    p.status === "CLOSED" ? p.closePrice : quoteFor(p);
                  const result =
                    current === null
                      ? null
                      : pnl(p.entryPrice, current, p.quantity);
                  return (
                    <tr key={p.id} className="hover:bg-blue-50/30">
                      <td className="px-5 py-5">
                        <Link
                          href={`/pitches/${p.pitchId}`}
                          className="flex items-center gap-3"
                        >
                          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[10px] font-bold text-brand">
                            {p.ticker.slice(0, 4)}
                          </span>
                          <div>
                            <p className="font-bold">{p.tokenName}</p>
                            <p className="mt-1 max-w-[180px] truncate text-[10px] text-slate-400">
                              {p.title}
                            </p>
                          </div>
                        </Link>
                      </td>
                      <td className="px-5 py-5 tabular-nums">
                        <p className="font-semibold">{money(p.entryPrice)}</p>
                        <p className="mt-1 text-[10px] text-slate-400">
                          {date(p.entryTime)}
                        </p>
                      </td>
                      <td className="px-5 py-5 font-semibold tabular-nums">
                        {current === null ? "Unavailable" : money(current)}
                      </td>
                      <td className="px-5 py-5 tabular-nums">
                        <p className="font-semibold">
                          {current === null ? "—" : money(current * p.quantity)}
                        </p>
                        <p className="mt-1 text-[10px] text-slate-400">
                          {money(p.allocation)} allocated
                        </p>
                      </td>
                      <td className="px-5 py-5 tabular-nums">
                        {result ? (
                          <>
                            <p
                              className={`font-bold ${result.amount >= 0 ? "text-emerald-600" : "text-rose-600"}`}
                            >
                              {percent(result.percent)}
                            </p>
                            <p className="mt-1 text-[10px] text-slate-400">
                              {money(result.amount)}
                            </p>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-5 py-5 text-[10px]">
                        {p.status === "OPEN" ? (
                          <p className="text-slate-500">
                            {p.stopPrice === null
                              ? "Stop loss unavailable"
                              : `SL ${money(p.stopPrice)}`}
                          </p>
                        ) : (
                          <>
                            <p
                              className={
                                p.closeReason === "TAKE_PROFIT"
                                  ? "text-emerald-600"
                                  : "text-rose-600"
                              }
                            >
                              {p.closeReason === "EARLY_VOTE"
                                ? "Close vote"
                                : p.closeReason === "TAKE_PROFIT"
                                  ? "Take profit"
                                  : "Stop loss"}
                            </p>
                            <p className="mt-1 text-slate-400">
                              {date(p.closeTime!)}
                            </p>
                          </>
                        )}
                      </td>
                      <td className="px-4">
                        <Link
                          aria-label={`View ${p.ticker} thesis`}
                          href={`/positions/${p.id}`}
                          className="text-brand"
                        >
                          {p.status === "OPEN" ? (
                            <span className="whitespace-nowrap text-xs font-semibold">
                              {p.closeVotePending
                                ? "Vote to close"
                                : "Close vote"}
                            </span>
                          ) : (
                            <ArrowUpRight size={17} />
                          )}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <Empty
          title={tab === "OPEN" ? "No open positions" : "No closed positions"}
          description={
            tab === "OPEN"
              ? "Approved pitches appear here."
              : "Closed positions appear here."
          }
          href={tab === "OPEN" ? "/pitches" : undefined}
          label="Explore investment pitches"
        />
      )}
      <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50/60 p-5 text-xs leading-6 text-slate-500">
        $100,000 capital limit · Up to $10,000 per pitch · Prices refresh every
        minute.
      </div>
    </>
  );
}
