"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const register = mode === "register";
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [visible, setVisible] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not connect. Please retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-5">
      {register && (
        <div>
          <label htmlFor="name" className="label">
            Your name
          </label>
          <input
            id="name"
            name="name"
            autoComplete="name"
            minLength={2}
            maxLength={60}
            required
            className="input"
            placeholder="Alex Morgan"
          />
        </div>
      )}
      <div>
        <label htmlFor="email" className="label">
          Imperial email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="input"
          placeholder="you@imperial.ac.uk"
        />
        <p className="mt-2 text-xs text-slate-400">
          @ic.ac.uk or @imperial.ac.uk
        </p>
      </div>
      <div>
        <label htmlFor="password" className="label">
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={visible ? "text" : "password"}
            autoComplete={register ? "new-password" : "current-password"}
            minLength={register ? 12 : 1}
            maxLength={72}
            required
            className="input pr-12"
            placeholder={
              register ? "At least 12 characters" : "Enter your password"
            }
          />
          <button
            type="button"
            aria-label={visible ? "Hide password" : "Show password"}
            onClick={() => setVisible(!visible)}
            className="absolute right-3 top-3 text-slate-400"
          >
            {visible ? <EyeOff size={19} /> : <Eye size={19} />}
          </button>
        </div>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700"
        >
          {error}
        </p>
      )}
      <button disabled={busy} className="btn w-full py-3.5">
        {busy
          ? "Please wait…"
          : register
            ? "Create your account"
            : "Log in to Consensus"}
        <ArrowRight size={17} />
      </button>
      <p className="text-center text-sm text-slate-500">
        {register ? "Already part of the fund?" : "New to Consensus?"}{" "}
        <Link
          className="font-semibold text-brand"
          href={register ? "/login" : "/register"}
        >
          {register ? "Log in" : "Create an account"}
        </Link>
      </p>
      {register && (
        <p className="text-center text-xs leading-5 text-slate-400">
          This is a paper investment simulation. Your account enables a weekly
          pitch digest, which you can turn off in your account settings.
        </p>
      )}
    </form>
  );
}
