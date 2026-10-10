import Link from "next/link";
import {
  ArrowRight,
  Plus,
  Lightbulb,
  MessagesSquare,
  ChartNoAxesCombined,
  Users,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { pitchSummaries } from "@/lib/data";
import { money, date } from "@/lib/format";
import { PageHeading, Stat, PitchCard, Empty } from "@/components/ui";
import { fundSummary } from "@/lib/fund";
export const metadata = { title: "Overview" };
export default async function Dashboard() {
  const user = await requireUser();
  const [pitches, active, members, votes, positions, activity] =
    await Promise.all([
      pitchSummaries({ status: "PENDING", expiresAt: { gt: new Date() } }, 3),
      db.pitch.count({
        where: { status: "PENDING", expiresAt: { gt: new Date() } },
      }),
      db.user.count(),
      db.vote.count(),
      fundSummary(),
      db.vote.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        include: {
          voter: { select: { name: true } },
          pitch: { select: { id: true, title: true, ticker: true } },
        },
      }),
    ]);
  return (
    <>
      <PageHeading
        title={`Welcome back, ${user.name.split(" ")[0]}.`}
        action={
          <Link href="/pitches/new" className="btn">
            <Plus size={17} />
            New pitch
          </Link>
        }
      />
      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Active pitches"
          value={String(active)}
          note="Ideas open for your perspective"
          icon={<Lightbulb size={17} />}
        />
        <Stat
          label="Community votes"
          value={String(votes)}
          note="Every decision backed by a reason"
          icon={<MessagesSquare size={17} />}
        />
        <Stat
          label="Paper capital allocated"
          value={money(positions.allocated)}
          note={`${money(positions.available)} available`}
          icon={<ChartNoAxesCombined size={17} />}
        />
        <Stat
          label="Imperial members"
          value={String(members)}
          note="One community. Many perspectives."
          icon={<Users size={17} />}
        />
      </div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">
            On the voting floor
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            The latest ideas seeking consensus
          </p>
        </div>
        <Link
          href="/pitches"
          className="flex items-center gap-2 text-xs font-semibold text-brand"
        >
          View all
          <ArrowRight size={14} />
        </Link>
      </div>
      {pitches.length ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {pitches.map((p) => (
            <PitchCard key={p.id} pitch={p} />
          ))}
        </div>
      ) : (
        <Empty
          title="The floor is yours."
          description="No pitches are open yet. Share the first investment thesis and start the conversation."
          href="/pitches/new"
        />
      )}
      <div className="mt-8 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <section className="card p-6">
          <h2 className="mb-5 text-base font-bold">Around the community</h2>
          {activity.length ? (
            <div className="divide-y divide-slate-100">
              {activity.map((v) => (
                <Link
                  key={v.id}
                  href={`/pitches/${v.pitch.id}`}
                  className="flex items-start gap-3 py-4 first:pt-0 hover:text-brand"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-brand">
                    {v.voter.name[0]}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs leading-5">
                      <span className="font-semibold">{v.voter.name}</span>{" "}
                      {v.decision ? "agreed with" : "challenged"}{" "}
                      <span className="font-semibold">{v.pitch.ticker}</span>
                    </p>
                    <p className="mt-1 truncate text-xs text-slate-400">
                      {v.pitch.title}
                    </p>
                  </div>
                  <span className="ml-auto shrink-0 text-[10px] text-slate-400">
                    {date(v.createdAt)}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm leading-6 text-slate-500">
              Votes and discussions will appear here as the community gets
              involved.
            </p>
          )}
        </section>
        <section className="card p-6">
          <h2 className="text-lg font-bold">The consensus rules</h2>
          <div className="mt-5 space-y-4">
            {[
              ["3 days", "To debate an investment thesis"],
              ["5 votes", "Minimum quorum to pass a pitch"],
              [">50%", "Approval needed to execute"],
            ].map(([n, t]) => (
              <div key={n} className="flex items-center gap-4">
                <span className="w-20 rounded-lg bg-blue-50 px-2 py-2 text-center text-xs font-bold text-brand">
                  {n}
                </span>
                <span className="text-xs text-slate-500">{t}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
