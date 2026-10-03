import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { prices } from "./coingecko";
import { lockFund } from "./fund";
import { valueHoldings, type PublicFundData } from "./fund-valuation";

const positionSelect = {
  coinId: true,
  ticker: true,
  quantity: true,
  pitch: { select: { tokenName: true } },
} as const;

export async function publicFund(): Promise<PublicFundData> {
  // A single database view prevents an exit appearing in both cash and holdings.
  const { fund, positions, snapshots } = await db.$transaction(
    async (tx) => ({
      fund: await tx.fund.findUniqueOrThrow({ where: { id: "main" } }),
      positions: await tx.position.findMany({
        where: { status: "OPEN" },
        select: positionSelect,
      }),
      snapshots: await tx.fundSnapshot.findMany({
        orderBy: { capturedAt: "asc" },
      }),
    }),
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
  const quotes = await prices(positions.map((p) => p.coinId)).catch(() => ({}));
  const now = Date.now();
  const valuation = valueHoldings(
    Number(fund.cash),
    positions.map((p) => ({
      coinId: p.coinId,
      ticker: p.ticker,
      name: p.pitch.tokenName,
      quantity: Number(p.quantity),
    })),
    quotes,
    now,
  );
  return {
    ...valuation,
    initialCapital: Number(fund.initialCapital),
    fetchedAt: new Date(now).toISOString(),
    history: snapshots.map((s) => ({
      at: s.capturedAt.toISOString(),
      value: Number(s.value),
    })),
  };
}

export async function recordFundSnapshot() {
  const ids = await db.position.findMany({
    where: { status: "OPEN" },
    select: { coinId: true },
  });
  const quotes = await prices(
    ids.map((p) => p.coinId),
    true,
  );
  return db.$transaction(
    async (tx) => {
      const fund = await lockFund(tx);
      const positions = await tx.position.findMany({
        where: { status: "OPEN" },
        select: positionSelect,
      });
      const now = Date.now();
      const { total } = valueHoldings(
        Number(fund.cash),
        positions.map((p) => ({
          coinId: p.coinId,
          ticker: p.ticker,
          name: p.pitch.tokenName,
          quantity: Number(p.quantity),
        })),
        quotes,
        now,
      );
      if (total === null)
        throw new Error("Incomplete or stale fund prices; snapshot skipped.");
      // At most one observation per minute, even when cron jobs overlap.
      const latest = await tx.fundSnapshot.findFirst({
        orderBy: { capturedAt: "desc" },
      });
      if (latest && now - latest.capturedAt.getTime() < 60000) return false;
      await tx.fundSnapshot.create({
        data: { capturedAt: new Date(now), value: total },
      });
      return true;
    },
    { maxWait: 10000, timeout: 15000 },
  );
}
