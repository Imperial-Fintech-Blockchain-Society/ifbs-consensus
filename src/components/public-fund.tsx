"use client";

import { useEffect, useId, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { money, percent } from "@/lib/format";
import type { Holding, PublicFundData } from "@/lib/fund-valuation";

const colors = [
  "#cbd5e1",
  "#216cf0",
  "#0f1f7b",
  "#14b8a6",
  "#8b5cf6",
  "#f59e0b",
  "#f43f5e",
  "#06b6d4",
];
const shortDate = (at: string) =>
  new Date(at).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
const stamp = (at: string) =>
  new Date(at).toLocaleString("en-GB", { timeZone: "UTC" }) + " UTC";

function HoldingsChart({
  holdings,
  total,
}: {
  holdings: Holding[];
  total: number | null;
}) {
  let cumulative = 0;
  return (
    <>
      <div className="relative mx-auto my-7 flex h-64 w-64 items-center justify-center">
        <svg
          viewBox="0 0 240 240"
          role="img"
          aria-label="Holdings by current USD value"
          className="h-full w-full -rotate-90"
        >
          <circle
            cx="120"
            cy="120"
            r="94"
            fill="none"
            stroke="#f1f5f9"
            strokeWidth="32"
          />
          {total !== null &&
            total > 0 &&
            holdings.map((h, i) => {
              const share = h.value! / total;
              const offset = cumulative;
              cumulative += share;
              return share > 0 ? (
                <circle
                  key={h.id}
                  cx="120"
                  cy="120"
                  r="94"
                  fill="none"
                  stroke={colors[i % colors.length]}
                  strokeWidth="32"
                  pathLength="100"
                  strokeDasharray={`${share * 100} ${100 - share * 100}`}
                  strokeDashoffset={-offset * 100}
                >
                  <title>
                    {h.ticker}: {money(h.value!)} · {(share * 100).toFixed(1)}%
                  </title>
                </circle>
              ) : null;
            })}
        </svg>
        <div className="pointer-events-none absolute text-center">
          <p className="text-xs text-slate-400">Total value</p>
          <p className="mt-2 text-xl font-bold tabular-nums text-navy">
            {total === null ? "—" : money(total)}
          </p>
        </div>
      </div>
      {total === null && (
        <p className="mb-4 text-center text-xs text-amber-700">
          Allocation unavailable until all prices recover.
        </p>
      )}
      <table className="w-full text-left text-sm">
        <caption className="sr-only">
          Current holdings, USD values and fund weights
        </caption>
        <thead className="text-[10px] uppercase tracking-wider text-slate-400">
          <tr>
            <th className="pb-3 font-medium">Asset</th>
            <th className="pb-3 text-right font-medium">Value</th>
            <th className="pb-3 text-right font-medium">Weight</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {holdings.map((h, i) => (
            <tr key={h.id}>
              <th scope="row" className="py-3 font-medium">
                <span className="flex items-center gap-2.5">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: colors[i % colors.length] }}
                  />
                  <span>
                    <span className="block font-bold">{h.ticker}</span>
                    <span className="block text-[11px] font-normal text-slate-400">
                      {h.name}
                    </span>
                  </span>
                </span>
              </th>
              <td className="py-3 text-right tabular-nums">
                {h.value === null ? "—" : money(h.value)}
              </td>
              <td className="py-3 pl-3 text-right tabular-nums text-slate-500">
                {total === null || total <= 0
                  ? "—"
                  : `${((h.value! / total) * 100).toFixed(1)}%`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function PerformanceChart({
  history,
  initialCapital,
}: {
  history: PublicFundData["history"];
  initialCapital: number;
}) {
  const gradientId = useId();
  const [active, setActive] = useState<number | null>(null);
  const chartRef = useRef<SVGSVGElement>(null);
  const [chartWidth, setChartWidth] = useState(710);
  const hasPoints = history.length > 0;
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    // Match the coordinate space to the card so mobile labels stay legible.
    const observer = new ResizeObserver(([entry]) => {
      setChartWidth(Math.max(240, Math.min(710, entry.contentRect.width)));
    });
    observer.observe(chart);
    return () => observer.disconnect();
  }, [hasPoints]);
  const right = chartWidth - 32;
  const plotWidth = right - 58;
  const points = history;
  if (!points.length)
    return (
      <div className="flex h-80 items-center justify-center text-sm text-slate-400">
        Performance tracking begins with the first valuation.
      </div>
    );
  const values = points.map((p) => (p.value / initialCapital - 1) * 100);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const padding = Math.max((max - min) * 0.2, 0.5);
  const bottom = min - padding;
  const top = max + padding;
  const start = new Date(points[0].at).getTime();
  const end = new Date(points[points.length - 1].at).getTime();
  const x = (i: number) =>
    end === start
      ? (58 + right) / 2
      : 58 +
        ((new Date(points[i].at).getTime() - start) / (end - start)) *
          plotWidth;
  const y = (value: number) => 260 - ((value - bottom) / (top - bottom)) * 225;
  const path = values
    .map((value, i) => `${i ? "L" : "M"}${x(i)},${y(value)}`)
    .join(" ");
  const selected =
    active !== null && active < points.length ? active : points.length - 1;
  return (
    <div className="mt-6">
      <div
        className="flex min-h-10 flex-wrap items-center justify-between gap-2 text-xs text-slate-400"
        aria-live="polite"
      >
        <span>{stamp(points[selected].at)}</span>
        <span className="font-semibold tabular-nums text-ink">
          {money(points[selected].value)}{" "}
          <span className="ml-2 text-brand">{percent(values[selected])}</span>
        </span>
      </div>
      <svg
        ref={chartRef}
        viewBox={`0 0 ${chartWidth} 310`}
        role="img"
        aria-label="Fund return since inception, based on recorded USD valuations"
        className="mt-4 w-full overflow-visible"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#216cf0" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#216cf0" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3, 4].map((i) => {
          const value = top - ((top - bottom) * i) / 4;
          return (
            <g key={i}>
              <line
                x1="58"
                y1={y(value)}
                x2={right}
                y2={y(value)}
                stroke="#e2e8f0"
                strokeDasharray="3 5"
              />
              <text
                x="46"
                y={y(value) + 4}
                textAnchor="end"
                fontSize="11"
                fill="#94a3b8"
              >
                {value.toFixed(1)}%
              </text>
            </g>
          );
        })}
        <line x1="58" y1={y(0)} x2={right} y2={y(0)} stroke="#cbd5e1" />
        {points.length > 1 && (
          <>
            <path
              d={`${path} L${x(points.length - 1)},260 L${x(0)},260 Z`}
              fill={`url(#${gradientId})`}
            />
            <path
              d={path}
              fill="none"
              stroke="#216cf0"
              strokeWidth="3"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </>
        )}
        {points.map((point, i) => (
          <circle
            key={point.at}
            cx={x(i)}
            cy={y(values[i])}
            r={i === selected ? 5 : 3}
            fill="#216cf0"
            stroke="white"
            strokeWidth="2"
          >
            <title>
              {stamp(point.at)}: {money(point.value)} ({percent(values[i])})
            </title>
          </circle>
        ))}
        {points.map((point, i) => (
          <rect
            key={point.at}
            x={i === 0 ? 58 : (x(i - 1) + x(i)) / 2}
            y="25"
            width={
              points.length === 1
                ? plotWidth
                : Math.max(
                    1,
                    (i === points.length - 1 ? right : (x(i) + x(i + 1)) / 2) -
                      (i === 0 ? 58 : (x(i - 1) + x(i)) / 2),
                  )
            }
            height="240"
            fill="transparent"
            tabIndex={0}
            role="button"
            aria-label={`${stamp(point.at)}: ${money(point.value)}, ${percent(values[i])}`}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
            onClick={() => setActive(i)}
          />
        ))}
        <text x="58" y="295" fontSize="11" fill="#94a3b8">
          {shortDate(points[0].at)}
        </text>
        {points.length > 1 && (
          <text x={right} y="295" textAnchor="end" fontSize="11" fill="#94a3b8">
            {shortDate(points[points.length - 1].at)}
          </text>
        )}
      </svg>
      <p className="mt-5 text-[11px] text-slate-400">
        {points.length === 1
          ? "First valuation recorded. More observations will build the chart."
          : `Recorded since ${shortDate(points[0].at)} · Return vs. starting capital`}
      </p>
    </div>
  );
}

export function PublicFund() {
  const [data, setData] = useState<PublicFundData | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setBusy(true);
      try {
        const response = await fetch("/api/fund", {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok)
          throw new Error("Fund data is temporarily unavailable.");
        setData(await response.json());
        setError("");
      } catch (err) {
        if (!controller.signal.aborted)
          setError(
            err instanceof Error ? err.message : "Could not load the fund.",
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
  }, [refreshKey]);
  const total = error ? null : (data?.total ?? null);
  const history = [...(data?.history ?? [])];
  if (data && total !== null)
    history.push({ at: data.fetchedAt, value: total });
  const returnPercent =
    data && total !== null ? (total / data.initialCapital - 1) * 100 : null;
  return (
    <>
      <div className="mb-8 grid gap-4 sm:grid-cols-3" aria-busy={busy}>
        {[
          { label: "Fund value", value: total === null ? "—" : money(total) },
          {
            label: "Total return",
            value: returnPercent === null ? "—" : percent(returnPercent),
          },
          {
            label: "Cash · USD",
            value: data ? money(data.holdings[0].value!) : "—",
          },
        ].map((stat) => (
          <div key={stat.label} className="card px-6 py-5">
            <p className="text-xs text-slate-500">{stat.label}</p>
            <p
              className={`mt-3 text-3xl font-bold tracking-tight tabular-nums ${stat.label === "Total return" && returnPercent !== null ? (returnPercent >= 0 ? "text-emerald-600" : "text-rose-600") : "text-navy"}`}
            >
              {stat.value}
            </p>
          </div>
        ))}
      </div>
      {error && (
        <p role="alert" className="mb-5 text-sm text-amber-700">
          {error}
        </p>
      )}
      {data && !error && total === null && (
        <p role="status" className="mb-5 text-sm text-amber-700">
          Some market prices are unavailable. Fund value and return will recover
          with prices.
        </p>
      )}
      <div className="grid items-start gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section
          className="card min-w-0 p-6 sm:p-8"
          aria-labelledby="performance-heading"
        >
          <div className="flex items-center justify-between">
            <h2
              id="performance-heading"
              className="text-lg font-bold text-navy"
            >
              Performance
            </h2>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-[10px] font-semibold text-brand">
              ALL TIME
            </span>
          </div>
          {data ? (
            <PerformanceChart
              history={history}
              initialCapital={data.initialCapital}
            />
          ) : (
            <div className="flex h-80 items-center justify-center text-sm text-slate-400">
              {busy ? "Loading performance…" : "Performance unavailable"}
            </div>
          )}
        </section>
        <section
          className="card min-w-0 p-6 sm:p-8"
          aria-labelledby="holdings-heading"
        >
          <h2 id="holdings-heading" className="text-lg font-bold text-navy">
            Current holdings
          </h2>
          {data ? (
            <HoldingsChart
              holdings={
                error
                  ? data.holdings.map((h) => ({
                      ...h,
                      value: h.quantity === null ? h.value : null,
                    }))
                  : data.holdings
              }
              total={total}
            />
          ) : (
            <div className="flex h-80 items-center justify-center text-sm text-slate-400">
              {busy ? "Loading holdings…" : "Holdings unavailable"}
            </div>
          )}
        </section>
      </div>
      <div className="mt-6 flex items-center justify-between gap-3 text-[11px] text-slate-400">
        <span>
          {data
            ? `Updated ${stamp(data.fetchedAt)}`
            : "Prices refresh every minute"}
        </span>
        <button
          disabled={busy}
          onClick={() => setRefreshKey((key) => key + 1)}
          aria-label="Refresh fund"
          className="flex shrink-0 items-center gap-2 rounded-lg p-2 hover:bg-white hover:text-brand"
        >
          <RefreshCw size={13} className={busy ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>
    </>
  );
}
