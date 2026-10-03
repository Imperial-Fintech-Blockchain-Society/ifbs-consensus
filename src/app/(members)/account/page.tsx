import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { pitchSummaries } from "@/lib/data";
import { date, money } from "@/lib/format";
import { PageHeading, Stat, PitchCard, Empty } from "@/components/ui";
import { DigestToggle } from "@/components/digest-toggle";
import {
  Lightbulb,
  MessagesSquare,
  CheckCheck,
  ChartNoAxesCombined,
} from "lucide-react";
export const metadata = { title: "My track record" };
export default async function Account() {
  const user = await requireUser();
  const [pitches, pitchCount, votes, passed, positions] = await Promise.all([
    pitchSummaries({ authorId: user.id }),
    db.pitch.count({ where: { authorId: user.id } }),
    db.vote.count({ where: { voterId: user.id } }),
    db.pitch.count({ where: { authorId: user.id, status: "PASSED" } }),
    db.position.findMany({
      where: { status: "CLOSED", pitch: { authorId: user.id } },
    }),
  ]);
  const realized = positions.reduce(
    (sum, p) =>
      sum + (Number(p.closePrice) - Number(p.entryPrice)) * Number(p.quantity),
    0,
  );
  return (
    <>
      <PageHeading title="My track record" />
      <div className="mb-7 grid gap-6 lg:grid-cols-2">
        <section className="card flex items-center gap-5 p-6">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-xl font-bold text-brand">
            {user.name
              .split(" ")
              .map((n) => n[0])
              .slice(0, 2)
              .join("")}
          </span>
          <div>
            <h2 className="text-xl font-bold">{user.name}</h2>
            <p className="mt-1 text-sm text-slate-500">{user.email}</p>
            <p className="mt-2 text-xs text-slate-400">
              Member since {date(user.createdAt)}
            </p>
          </div>
        </section>
        <section className="card p-6">
          <h2 className="mb-4 text-sm font-bold">
            Keep up with the conversation
          </h2>
          <DigestToggle initial={user.digestEnabled} />
        </section>
      </div>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Pitches published"
          value={String(pitchCount)}
          note="Your investment ideas"
          icon={<Lightbulb size={17} />}
        />
        <Stat
          label="Votes contributed"
          value={String(votes)}
          note="Your perspectives on the floor"
          icon={<MessagesSquare size={17} />}
        />
        <Stat
          label="Pitches passed"
          value={String(passed)}
          note="Ideas that earned consensus"
          icon={<CheckCheck size={17} />}
        />
        <Stat
          label="Realized pitch P&L"
          value={money(realized)}
          note={`${positions.length} closed positions from your pitches`}
          icon={<ChartNoAxesCombined size={17} />}
        />
      </div>
      <h2 className="mb-5 text-xl font-bold">Your investment theses</h2>
      {pitches.length ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {pitches.map((p) => (
            <PitchCard key={p.id} pitch={p} />
          ))}
        </div>
      ) : (
        <Empty
          title="Your first thesis is the first step."
          description="Put an idea to the community and start building your investment track record."
          href="/pitches/new"
        />
      )}
    </>
  );
}
