"use client";
import { useState } from "react";
export function DigestToggle({ initial }: { initial: boolean }) {
  const [enabled, setEnabled] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function toggle() {
    const previous = enabled;
    const next = !enabled;
    setEnabled(next);
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ digestEnabled: next }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setMessage("Preference saved.");
    } catch {
      setEnabled(previous);
      setMessage("Could not save. Please retry.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          disabled={busy}
          onChange={toggle}
          className="h-4 w-4 accent-brand"
        />
        Receive the weekly pitch digest
      </label>
      <p className="mt-2 text-xs leading-5 text-slate-400">
        A weekly roundup of active investment ideas, sent to your Imperial
        email.
      </p>
      <p role="status" className="mt-2 text-xs text-brand">
        {message}
      </p>
    </div>
  );
}
