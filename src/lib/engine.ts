import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { prices, executablePrice } from "./coingecko";
import { passes, closePasses } from "./rules";
import { lockFund, closePosition } from "./fund";
const transactionOptions = { maxWait: 10000, timeout: 15000 };

export async function resolvePitches() {
  const expired = await db.pitch.findMany({
    where: {
      status: { in: ["PENDING", "QUEUED"] },
      expiresAt: { lte: new Date() },
    },
    include: { votes: { select: { decision: true } } },
    take: 100,
    orderBy: [{ expiresAt: "asc" }, { id: "asc" }],
  });
  let resolved = 0;
  let queued = 0;
  const failures: string[] = [];
  for (const pitch of expired) {
    try {
      const approved = passes(
        pitch.votes.filter((v) => v.decision).length,
        pitch.votes.length,
        pitch.quorum,
      );
      const entry = approved
        ? new Prisma.Decimal(
            executablePrice((await prices([pitch.coinId], true))[pitch.coinId]),
          )
        : null;
      await db.$transaction(async (tx) => {
        const fund = await lockFund(tx);
        await tx.$queryRaw`SELECT "id" FROM "Pitch" WHERE "id" = ${pitch.id} FOR UPDATE`;
        const current = await tx.pitch.findUnique({
          where: { id: pitch.id },
          include: { votes: { select: { decision: true } } },
        });
        if (!current || !["PENDING", "QUEUED"].includes(current.status)) return;
        const finalApproval = passes(
          current.votes.filter((v) => v.decision).length,
          current.votes.length,
          current.quorum,
        );
        if (finalApproval && !entry)
          throw new Error("Retry with a price after the last vote commits.");
        if (finalApproval && entry) {
          if (
            fund.cash.lt(current.allocation) ||
            fund.allocated.add(current.allocation).gt(fund.initialCapital)
          ) {
            await tx.pitch.update({
              where: { id: current.id },
              data: {
                status: "QUEUED",
                resolvedAt: current.resolvedAt ?? new Date(),
              },
            });
            queued++;
            return;
          }
          await tx.position.create({
            data: {
              pitchId: current.id,
              coinId: current.coinId,
              ticker: current.ticker,
              entryPrice: entry,
              quantity: current.allocation.div(entry),
              allocation: current.allocation,
            },
          });
          await tx.fund.update({
            where: { id: "main" },
            data: {
              cash: { decrement: current.allocation },
              allocated: { increment: current.allocation },
            },
          });
        }
        await tx.pitch.update({
          where: { id: current.id },
          data: {
            status: finalApproval ? "PASSED" : "REJECTED",
            resolvedAt: new Date(),
          },
        });
        resolved++;
      }, transactionOptions);
    } catch {
      failures.push(pitch.id);
    }
  }
  return { resolved, queued, failures };
}

export async function resolveCloseProposals() {
  const proposals = await db.closeProposal.findMany({
    where: { status: "PENDING", expiresAt: { lte: new Date() } },
    include: { votes: { select: { decision: true } }, position: true },
    take: 100,
    orderBy: { expiresAt: "asc" },
  });
  let resolved = 0;
  const failures: string[] = [];
  for (const proposal of proposals) {
    try {
      const approved = closePasses(
        proposal.votes.filter((v) => v.decision).length,
        proposal.votes.length,
      );
      const price =
        approved && proposal.position.status === "OPEN"
          ? executablePrice(
              (await prices([proposal.position.coinId], true))[
                proposal.position.coinId
              ],
            )
          : null;
      await db.$transaction(async (tx) => {
        await lockFund(tx);
        await tx.$queryRaw`SELECT "id" FROM "Position" WHERE "id" = ${proposal.positionId} FOR UPDATE`;
        await tx.$queryRaw`SELECT "id" FROM "CloseProposal" WHERE "id" = ${proposal.id} FOR UPDATE`;
        const current = await tx.closeProposal.findUniqueOrThrow({
          where: { id: proposal.id },
          include: { votes: { select: { decision: true } }, position: true },
        });
        if (current.status !== "PENDING") return;
        if (current.position.status !== "OPEN") {
          await tx.closeProposal.update({
            where: { id: current.id },
            data: { status: "CANCELLED", resolvedAt: new Date() },
          });
        } else {
          const finalApproval = closePasses(
            current.votes.filter((v) => v.decision).length,
            current.votes.length,
          );
          if (finalApproval) {
            if (price === null)
              throw new Error(
                "Retry with a price after the last vote commits.",
              );
            await closePosition(tx, current.positionId, price, current.id);
          }
          await tx.closeProposal.update({
            where: { id: current.id },
            data: {
              status: finalApproval ? "PASSED" : "REJECTED",
              resolvedAt: new Date(),
            },
          });
        }
        resolved++;
      }, transactionOptions);
    } catch {
      failures.push(proposal.id);
    }
  }
  return { resolved, failures };
}

export async function resolveAll() {
  const closeVotes = await resolveCloseProposals();
  const pitches = await resolvePitches();
  return {
    resolved: pitches.resolved,
    queued: pitches.queued,
    closeVotesResolved: closeVotes.resolved,
    failures: [...closeVotes.failures, ...pitches.failures],
  };
}
