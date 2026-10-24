import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { money, date, timeLeft } from "@/lib/format";
import { PageHeading, Status } from "@/components/ui";
import { CloseProposalForm } from "@/components/close-proposal-form";
import { VoteForm } from "@/components/vote-form";
export const metadata = { title: "Position" };
export default async function PositionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const position = await db.position.findUnique({
    where: { id },
    include: {
      pitch: { select: { tokenName: true, title: true } },
      closeProposals: {
        include: {
          proposer: { select: { name: true } },
          votes: {
            include: { voter: { select: { name: true } } },
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!position) notFound();
  const pending = position.closeProposals.some((p) => p.status === "PENDING");
  return (
    <>
      <Link
        href="/portfolio"
        className="mb-6 inline-block text-xs font-semibold text-brand"
      >
        ← Portfolio
      </Link>
      <PageHeading
        title={`${position.pitch.tokenName} position`}
        action={<Status status={position.status} />}
      />
      <div className="card mb-6 grid gap-5 p-6 sm:grid-cols-2">
        {[
          ["Investment", money(Number(position.allocation))],
          ["Entry", money(Number(position.entryPrice))],
        ].map(([label, value]) => (
          <div key={label}>
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-2 text-lg font-bold">{value}</p>
          </div>
        ))}
      </div>
      <Link
        href={`/pitches/${position.pitchId}`}
        className="mb-6 inline-block text-sm text-brand"
      >
        View pitch →
      </Link>
      <div className="grid items-start gap-6 xl:grid-cols-[1fr_340px]">
        <section className="space-y-5">
          <h2 className="text-xl font-bold">Close votes</h2>
          {!position.closeProposals.length && (
            <p className="text-sm text-slate-500">No close votes yet.</p>
          )}
          {position.closeProposals.map((proposal) => {
            const ownVote = proposal.votes.find((v) => v.voterId === user.id);
            const agree = proposal.votes.filter((v) => v.decision).length;
            const open =
              proposal.status === "PENDING" &&
              proposal.expiresAt > new Date() &&
              position.status === "OPEN";
            return (
              <article key={proposal.id} className="card space-y-5 p-6">
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">
                      {proposal.proposer.name}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {date(proposal.createdAt)} ·{" "}
                      {proposal.status === "PENDING"
                        ? timeLeft(proposal.expiresAt)
                        : proposal.status.toLowerCase()}
                    </p>
                  </div>
                  <Status status={proposal.status} />
                </div>
                <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">
                  {proposal.reason}
                </p>
                <p className="text-xs font-semibold">
                  {agree} close · {proposal.votes.length - agree} keep open
                </p>
                {ownVote ? (
                  <p className="rounded-xl bg-blue-50 p-3 text-sm text-brand">
                    You voted to {ownVote.decision ? "close" : "keep open"}.
                  </p>
                ) : open ? (
                  <VoteForm
                    pitchId={proposal.id}
                    endpoint={`/api/close-proposals/${proposal.id}/votes`}
                    closeVote
                  />
                ) : proposal.status === "PENDING" ? (
                  <p className="text-xs text-slate-500">
                    Voting ended. Awaiting resolution.
                  </p>
                ) : null}
                {proposal.votes.map((v) => (
                  <div key={v.id} className="border-t border-slate-100 pt-4">
                    <p className="text-xs font-semibold">
                      {v.voter.name} · {v.decision ? "Close" : "Keep open"}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-500">
                      {v.reason}
                    </p>
                  </div>
                ))}
              </article>
            );
          })}
        </section>
        <aside>
          {position.status === "OPEN" && !pending ? (
            <CloseProposalForm positionId={position.id} />
          ) : (
            <div className="card p-6 text-sm text-slate-500">
              {position.status === "CLOSED"
                ? `Closed at ${money(Number(position.closePrice))}.`
                : "A close vote is pending."}
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
