"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function CloseProposalForm({ positionId }: { positionId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch(
        `/api/positions/${positionId}/close-proposals`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start vote.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="card space-y-4 p-6">
      <h2 className="text-lg font-bold">Start a close vote</h2>
      <div>
        <label htmlFor="close-reason" className="label">
          Reason to close
        </label>
        <textarea
          id="close-reason"
          name="reason"
          minLength={20}
          maxLength={2000}
          required
          rows={4}
          className="input"
          placeholder="Why should this position close early?"
        />
      </div>
      <div>
        <label htmlFor="close-hours" className="label">
          Voting window (hours)
        </label>
        <input
          id="close-hours"
          name="hours"
          type="number"
          min={1}
          max={24}
          step={1}
          defaultValue={24}
          required
          className="input"
        />
      </div>
      <p className="text-xs text-slate-500">
        Majority of votes cast. Ties keep the position open.
      </p>
      {error && (
        <p role="alert" className="text-sm text-rose-700">
          {error}
        </p>
      )}
      <button disabled={busy} className="btn">
        {busy ? "Starting…" : "Start vote"}
      </button>
    </form>
  );
}
