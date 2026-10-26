"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, ArrowRight } from "lucide-react";
export function VoteForm({
  pitchId,
  endpoint,
  closeVote = false,
}: {
  pitchId: string;
  endpoint?: string;
  closeVote?: boolean;
}) {
  const router = useRouter();
  const [decision, setDecision] = useState<boolean | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (decision === null) {
      setError("Choose agree or don’t agree.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        endpoint ?? `/api/pitches/${pitchId}/votes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision, reason }),
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit vote.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          aria-pressed={decision === true}
          onClick={() => setDecision(true)}
          className={`flex items-center justify-center gap-2 rounded-xl border px-2 py-3 text-xs font-bold ${decision === true ? "border-brand bg-blue-50 text-brand" : "border-slate-200 text-slate-500"}`}
        >
          <Check size={16} />
          {closeVote ? "Close" : "Agree"}
        </button>
        <button
          type="button"
          aria-pressed={decision === false}
          onClick={() => setDecision(false)}
          className={`flex items-center justify-center gap-2 rounded-xl border px-2 py-3 text-xs font-bold ${decision === false ? "border-rose-300 bg-rose-50 text-rose-700" : "border-slate-200 text-slate-500"}`}
        >
          <X size={16} />
          {closeVote ? "Keep open" : "Don’t agree"}
        </button>
      </div>
      <div>
        <label htmlFor={`reason-${pitchId}`} className="label">
          Comment <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <textarea
          id={`reason-${pitchId}`}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={2000}
          rows={5}
          className="input resize-y"
          placeholder="Explain your vote (optional)"
        />
      </div>
      {error && (
        <p role="alert" className="text-xs text-rose-700">
          {error}
        </p>
      )}
      <button className="btn w-full" disabled={busy || decision === null}>
        {busy ? "Submitting…" : "Submit your vote"}
        <ArrowRight size={15} />
      </button>
    </form>
  );
}
