import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { pitchSummaries } from "@/lib/data";
import { PageHeading, PitchCard, Empty } from "@/components/ui";
export const metadata = { title: "Investment pitches" };
export default async function Pitches({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const params = await searchParams;
  const status = ["PENDING", "QUEUED", "PASSED", "REJECTED"].includes(
    params.status ?? "",
  )
    ? params.status
    : undefined;
  const q = (params.q ?? "").slice(0, 100);
  const pitches = await pitchSummaries({
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { ticker: { contains: q, mode: "insensitive" } },
            { tokenName: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  });
  return (
    <>
      <PageHeading
        title="Investment pitches"
        action={
          <Link href="/pitches/new" className="btn">
            <Plus size={17} />
            New pitch
          </Link>
        }
      />
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1">
          {[
            ["", "All pitches"],
            ["PENDING", "Voting"],
            ["QUEUED", "Awaiting capital"],
            ["PASSED", "Passed"],
            ["REJECTED", "Rejected"],
          ].map(([s, label]) => (
            <Link
              key={s}
              href={`/pitches?status=${s}&q=${encodeURIComponent(q)}`}
              className={`rounded-lg px-4 py-2 text-xs font-semibold ${s === (status ?? "") ? "bg-blue-50 text-brand" : "text-slate-500 hover:bg-slate-50"}`}
            >
              {label}
            </Link>
          ))}
        </div>
        <form className="relative w-full sm:w-64">
          <input type="hidden" name="status" value={status ?? ""} />
          <Search size={16} className="absolute left-3 top-3 text-slate-400" />
          <input
            aria-label="Search pitches"
            name="q"
            defaultValue={q}
            className="input pl-9"
            placeholder="Search a token or thesis…"
          />
        </form>
      </div>
      {pitches.length ? (
        <>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {pitches.map((p) => (
              <PitchCard key={p.id} pitch={p} />
            ))}
          </div>
          <p className="mt-6 text-xs text-slate-400">
            Showing {pitches.length} recent pitches
            {pitches.length === 60
              ? ". Use search to find more specific ideas."
              : "."}
          </p>
        </>
      ) : (
        <Empty
          title={
            q
              ? "No ideas matched your search."
              : "A new conversation starts here."
          }
          description={
            q
              ? "Try a different token or keyword."
              : "Share an investment thesis with the community. Every great fund starts with a first idea."
          }
          href={q ? undefined : "/pitches/new"}
        />
      )}
    </>
  );
}
