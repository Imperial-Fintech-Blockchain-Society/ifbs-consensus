"use client";
import Link from "next/link";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-6 text-center">
      <p className="eyebrow text-brand">Please try again</p>
      <h1 className="mt-4 text-3xl font-bold">We couldn’t load this page.</h1>
      <p className="mt-4 text-sm leading-6 text-slate-500">
        The service may be temporarily unavailable. Your saved pitches and votes
        are safe.
      </p>
      <div className="mt-6 flex gap-3">
        <button onClick={reset} className="btn">
          Retry
        </button>
        <Link href="/" className="btn-secondary">
          Go home
        </Link>
      </div>
    </main>
  );
}
