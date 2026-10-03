import Link from "next/link";
export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center px-6">
      <p className="eyebrow text-brand">404</p>
      <h1 className="mt-4 text-3xl font-bold">This page doesn’t exist.</h1>
      <Link href="/dashboard" className="btn mt-6">
        Back to overview
      </Link>
    </main>
  );
}
