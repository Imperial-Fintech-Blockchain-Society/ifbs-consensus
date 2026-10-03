"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, Check, ArrowRight, Eye, Pencil } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ALLOCATION } from "@/lib/rules";
type Coin = { id: string; name: string; symbol: string };
export function PitchForm() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [coins, setCoins] = useState<Coin[]>([]);
  const [coin, setCoin] = useState<Coin | null>(null);
  const [searchError, setSearchError] = useState("");
  const [searching, setSearching] = useState(false);
  const [thesis, setThesis] = useState("");
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (coin || query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      setSearchError("");
      try {
        const response = await fetch(
          `/api/coins?q=${encodeURIComponent(query.trim())}`,
          { signal: controller.signal },
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setCoins(data.coins);
        if (!data.coins.length)
          setSearchError("No tokens found. Try another name or ticker.");
      } catch (err) {
        if (!controller.signal.aborted)
          setSearchError(
            err instanceof Error ? err.message : "Search unavailable.",
          );
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, coin]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!coin) {
      setError("Choose a token from the CoinGecko results.");
      return;
    }
    setBusy(true);
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch("/api/pitches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...fields, coinId: coin.id, thesis }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      router.push(`/pitches/${data.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create pitch.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="card space-y-7 p-6 sm:p-8">
      <div>
        <label htmlFor="token" className="label">
          Asset
        </label>
        <div className="relative">
          <Search
            size={17}
            className="absolute left-4 top-3.5 text-slate-400"
          />
          <input
            id="token"
            className="input pl-11"
            autoComplete="off"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCoin(null);
              setCoins([]);
              setSearchError("");
              setSearching(false);
            }}
            placeholder="Search Bitcoin, Ethereum, SOL…"
            role="combobox"
            aria-expanded={coins.length > 0 && !coin}
            aria-controls="coin-results"
            aria-autocomplete="list"
          />
          {coin && (
            <Check
              size={18}
              className="absolute right-4 top-3.5 text-emerald-600"
            />
          )}
          {coins.length > 0 && !coin && (
            <ul
              id="coin-results"
              role="listbox"
              className="absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl"
            >
              {coins.map((c) => (
                <li key={c.id} role="option" aria-selected={false}>
                  <button
                    type="button"
                    onClick={() => {
                      setCoin(c);
                      setQuery(`${c.name} (${c.symbol.toUpperCase()})`);
                      setCoins([]);
                    }}
                    className="flex w-full justify-between rounded-lg px-4 py-3 text-left text-sm hover:bg-blue-50"
                  >
                    <span>
                      {c.name}
                      <span className="ml-2 text-xs text-slate-400">
                        {c.id}
                      </span>
                    </span>
                    <span className="font-semibold text-brand">
                      {c.symbol.toUpperCase()}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="mt-2 text-xs text-slate-400" aria-live="polite">
          {searching
            ? "Searching CoinGecko…"
            : searchError ||
              (coin
                ? `Selected CoinGecko ID: ${coin.id}`
                : "Select a result to verify the token’s identity.")}
        </p>
      </div>
      <div>
        <label htmlFor="title" className="label">
          Title
        </label>
        <input
          id="title"
          name="title"
          minLength={10}
          maxLength={120}
          required
          className="input"
          placeholder="Why Ethereum’s next chapter is worth watching"
        />
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label htmlFor="thesis" className="text-sm font-semibold">
            Thesis
          </label>
          <button
            type="button"
            onClick={() => setPreview(!preview)}
            className="flex items-center gap-1.5 text-xs font-semibold text-brand"
          >
            {preview ? <Pencil size={14} /> : <Eye size={14} />}
            {preview ? "Edit" : "Preview"}
          </button>
        </div>
        {preview ? (
          <div className="markdown min-h-72 rounded-xl border border-slate-200 p-4 text-sm">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {thesis || "Your thesis preview will appear here."}
            </ReactMarkdown>
          </div>
        ) : (
          <textarea
            id="thesis"
            name="thesis"
            value={thesis}
            onChange={(e) => setThesis(e.target.value)}
            required
            minLength={100}
            maxLength={20000}
            rows={12}
            className="input resize-y leading-7"
            placeholder={
              "## The opportunity\nWhat is your investment thesis?\n\n## The catalysts\nWhat could drive value?\n\n## The risks\nWhat would change your mind?"
            }
          />
        )}
        <p className="mt-2 text-xs text-slate-400">
          Markdown supported · Minimum 100 characters ·{" "}
          {thesis.length.toLocaleString()} / 20,000
        </p>
      </div>
      <div>
        <p className="label">Targets</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="tp" className="mb-2 block text-xs text-slate-500">
              Take profit (%)
            </label>
            <input
              id="tp"
              name="takeProfitPercent"
              type="number"
              min={1}
              max={1000}
              step="0.01"
              defaultValue={25}
              required
              className="input"
            />
          </div>
          <div>
            <label htmlFor="sl" className="mb-2 block text-xs text-slate-500">
              Stop loss (%)
            </label>
            <input
              id="sl"
              name="stopLossPercent"
              type="number"
              min={1}
              max={90}
              step="0.01"
              defaultValue={10}
              required
              className="input"
            />
          </div>
        </div>
      </div>
      <div>
        <label htmlFor="allocation" className="label">
          Investment (USD)
        </label>
        <input
          id="allocation"
          name="allocation"
          type="number"
          min={0.01}
          max={ALLOCATION}
          step="0.01"
          defaultValue={ALLOCATION}
          required
          className="input"
        />
        <p className="mt-2 text-xs text-slate-400">
          Maximum $10,000 per pitch.
        </p>
      </div>
      <div className="rounded-xl bg-blue-50 p-4 text-xs leading-6 text-slate-600">
        7-day vote · 5-vote quorum · Majority approval. Execution requires
        available capital.
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700"
        >
          {error}
        </p>
      )}
      <button disabled={busy} className="btn w-full sm:w-auto">
        {busy ? "Verifying and publishing…" : "Publish investment pitch"}
        <ArrowRight size={17} />
      </button>
    </form>
  );
}
