"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export function EmailConfirmation({ token }: { token: string }) {
  const started = useRef(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    // Remove the token from browser history before making further requests.
    window.history.replaceState(null, "", "/verify-email");
    async function confirm() {
      try {
        const response = await fetch("/api/auth/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        window.location.replace("/dashboard");
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Could not connect. Please try your email link again.",
        );
      }
    }
    void confirm();
  }, [token]);
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-navy">
        {error ? "We couldn’t confirm your email" : "Confirming your email…"}
      </h1>
      {error ? (
        <>
          <p role="alert" className="text-sm leading-6 text-slate-600">
            {error}
          </p>
          <Link href="/register" className="btn w-full">
            Request a new confirmation email
          </Link>
          <Link
            href="/login"
            className="block text-center text-sm font-semibold text-brand"
          >
            Already confirmed? Log in
          </Link>
        </>
      ) : (
        <p role="status" className="text-sm leading-6 text-slate-600">
          Please wait while we finish your signup and take you to your
          dashboard.
        </p>
      )}
    </div>
  );
}
