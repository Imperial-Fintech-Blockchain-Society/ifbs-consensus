import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft, Check, X, Clock3, Users, ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { date, money, timeLeft } from "@/lib/format";
import { Status } from "@/components/ui";
import { VoteForm } from "@/components/vote-form";
export const metadata = { title: "Investment thesis" };
export default async function PitchDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const pitch = await db.pitch.findUnique({
    where: { id },
    include: {
      author: { select: { name: true } },
      votes: {
        include: { voter: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
      position: true,
    },
  });
  if (!pitch) notFound();
  const agree = pitch.votes.filter((v) => v.decision).length;
  const approval = pitch.votes.length
    ? Math.round((agree / pitch.votes.length) * 100)
    : 0;
  const ownVote = pitch.votes.find((v) => v.voterId === user.id);
  const open = pitch.status === "PENDING" && pitch.expiresAt > new Date();
  return (
    <>
      <Link
        href="/pitches"
        className="mb-7 inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-brand"
      >
        <ArrowLeft size={15} />
        Back to pitches
      </Link>
      <div className="mb-8">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <span className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-brand">
            {pitch.ticker} · {pitch.tokenName}
          </span>
          <Status status={pitch.status} />
        </div>
        <h1 className="max-w-4xl text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
          {pitch.title}
        </h1>
        <p className="mt-4 text-xs text-slate-500">
          Pitched by <span className="font-semibold">{pitch.author.name}</span>
          <span className="mx-3">·</span>
          {date(pitch.createdAt)}
        </p>
      </div>
      <div className="grid items-start gap-7 xl:grid-cols-[1fr_340px]">
        <div>
          <section className="card p-6 sm:p-8">
            <div className="mb-7 border-b border-slate-100 pb-7">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Paper allocation
              </p>
              <p className="mt-2 text-lg font-bold sm:text-xl">
                {money(Number(pitch.allocation))}
              </p>
            </div>
            <p className="eyebrow mb-6 text-brand">The investment thesis</p>
            <div className="markdown text-sm text-slate-600">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {pitch.thesis}
              </ReactMarkdown>
            </div>
          </section>
          {pitch.position && (
            <section className="card mt-6 p-6">
              <div className="mb-3 flex justify-between">
                <h2 className="text-base font-bold">Executed paper position</h2>
                <Status status={pitch.position.status} />
              </div>
              <p className="text-sm text-slate-500">
                Entry:{" "}
                <strong>{money(Number(pitch.position.entryPrice))}</strong> ·{" "}
                {date(pitch.position.entryTime)}
                {pitch.position.closePrice && (
                  <>
                    {" "}
                    · Exit:{" "}
                    <strong>{money(Number(pitch.position.closePrice))}</strong>
                  </>
                )}
              </p>
              <Link
                href={`/positions/${pitch.position.id}`}
                className="mt-4 inline-block text-xs font-semibold text-brand"
              >
                View position →
              </Link>
            </section>
          )}
          <section className="mt-8">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-bold">The discussion</h2>
              <span className="text-xs text-slate-400">
                {pitch.votes.length} perspectives
              </span>
            </div>
            {pitch.votes.length ? (
              <div className="space-y-4">
                {pitch.votes.map((v) => (
                  <article className="card p-5" key={v.id}>
                    <div className="mb-3 flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-brand">
                        {v.voter.name[0]}
                      </span>
                      <div>
                        <p className="text-xs font-semibold">
                          {v.voter.name}
                          {v.voterId === user.id ? " (you)" : ""}
                        </p>
                        <p className="mt-0.5 text-[10px] text-slate-400">
                          {date(v.createdAt)}
                        </p>
                      </div>
                      <span
                        className={`ml-auto flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold ${v.decision ? "bg-blue-50 text-brand" : "bg-rose-50 text-rose-700"}`}
                      >
                        {v.decision ? <Check size={12} /> : <X size={12} />}
                        {v.decision ? "Agrees" : "Disagrees"}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">
                      {v.reason}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <div className="card p-8 text-center text-sm leading-6 text-slate-500">
                No votes yet. Be the first to bring a perspective.
              </div>
            )}
          </section>
          {pitch.status === "QUEUED" && (
            <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
              Approved. Awaiting available capital.
            </p>
          )}
        </div>
        <aside className="space-y-5 xl:sticky xl:top-6">
          <section className="card p-6">
            <p className="eyebrow mb-4 text-brand">Community conviction</p>
            <div className="flex items-end justify-between">
              <span className="text-4xl font-bold">{approval}%</span>
              <span className="pb-1 text-xs text-slate-400">agree</span>
            </div>
            <div className="my-4 h-2 rounded-full bg-rose-100">
              <div
                className="h-full rounded-full bg-brand"
                style={{ width: `${approval}%` }}
              />
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-brand">{agree} agree</span>
              <span className="text-slate-400">
                {pitch.votes.length - agree} don’t agree
              </span>
            </div>
            <div className="my-5 space-y-3 border-y border-slate-100 py-4 text-xs text-slate-500">
              <p className="flex items-center gap-2">
                <Users size={15} />
                {pitch.votes.length} / {pitch.quorum} quorum votes
              </p>
              <p className="flex items-center gap-2">
                <Clock3 size={15} />
                {pitch.status === "PENDING"
                  ? timeLeft(pitch.expiresAt)
                  : `Resolved ${date(pitch.resolvedAt!)}`}
              </p>
            </div>
            {ownVote ? (
              <div className="rounded-xl bg-blue-50 p-4 text-sm leading-6 text-brand">
                <Check size={18} className="mb-2" />
                Your vote is recorded. You{" "}
                {ownVote.decision ? "agreed" : "disagreed"} with this thesis.
              </div>
            ) : open ? (
              <VoteForm pitchId={pitch.id} />
            ) : (
              <p className="text-sm leading-6 text-slate-500">
                {pitch.status === "PENDING"
                  ? "Voting is closed. The scheduled job will resolve the result once a valid market price is available."
                  : "This pitch has been resolved. Voting is closed."}
              </p>
            )}
          </section>
          <div className="flex gap-3 rounded-xl bg-blue-50 p-4 text-xs leading-6 text-slate-500">
            <ShieldCheck size={20} className="mt-1 shrink-0 text-brand" />
            Pitches execute after voting closes with a quorum and majority
            approval. All investments are paper positions.
          </div>
        </aside>
      </div>
    </>
  );
}
