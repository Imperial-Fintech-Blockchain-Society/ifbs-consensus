import { db } from "@/lib/db";
import { PageHeading } from "@/components/ui";
import { Portfolio } from "@/components/portfolio";
import { fundSummary } from "@/lib/fund";
import Link from "next/link";
export const metadata = { title: "The paper fund" };
export default async function Fund() {
  const fund = await fundSummary();
  const positions = await db.position.findMany({
    include: {
      pitch: { select: { title: true, tokenName: true } },
      closeProposals: {
        where: { status: "PENDING" },
        select: { id: true },
        take: 1,
      },
    },
    orderBy: { entryTime: "desc" },
  });
  return (
    <>
      <PageHeading title="Paper fund" />
      <Link
        href="/fund"
        className="mb-6 inline-block text-sm font-semibold text-brand"
      >
        View public fund charts ↗
      </Link>
      <Portfolio
        fund={fund}
        positions={positions.map((p) => ({
          id: p.id,
          pitchId: p.pitchId,
          coinId: p.coinId,
          ticker: p.ticker,
          tokenName: p.pitch.tokenName,
          title: p.pitch.title,
          status: p.status,
          allocation: Number(p.allocation),
          quantity: Number(p.quantity),
          entryPrice: Number(p.entryPrice),
          stopPrice: p.stopPrice === null ? null : Number(p.stopPrice),
          entryTime: p.entryTime.toISOString(),
          closePrice: p.closePrice === null ? null : Number(p.closePrice),
          closeTime: p.closeTime?.toISOString() ?? null,
          closeReason: p.closeReason,
          closeVotePending: p.closeProposals.length > 0,
        }))}
      />
    </>
  );
}
