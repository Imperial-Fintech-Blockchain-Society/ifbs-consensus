import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "./db";
export async function fundSummary() {
  const fund = await db.fund.findUniqueOrThrow({ where: { id: "main" } });
  return {
    initialCapital: Number(fund.initialCapital),
    cash: Number(fund.cash),
    allocated: Number(fund.allocated),
    available: Number(
      Prisma.Decimal.min(fund.cash, fund.initialCapital.sub(fund.allocated)),
    ),
  };
}
export async function lockFund(tx: Prisma.TransactionClient) {
  await tx.$queryRaw`SELECT "id" FROM "Fund" WHERE "id" = 'main' FOR UPDATE`;
  return tx.fund.findUniqueOrThrow({ where: { id: "main" } });
}
// Call with the fund lock held. Every exit credits proceeds and releases the
// allocation in the same transaction, so monitoring and close votes cannot double-credit.
export async function closePosition(
  tx: Prisma.TransactionClient,
  id: string,
  price: number,
  reason: string,
  proposalId?: string,
) {
  await tx.$queryRaw`SELECT "id" FROM "Position" WHERE "id" = ${id} FOR UPDATE`;
  const position = await tx.position.findUniqueOrThrow({ where: { id } });
  if (position.status !== "OPEN") return false;
  const proceeds = new Prisma.Decimal(price)
    .mul(position.quantity)
    .toDecimalPlaces(2);
  await tx.position.update({
    where: { id },
    data: {
      status: "CLOSED",
      closePrice: price,
      closeTime: new Date(),
      closeReason: reason,
    },
  });
  await tx.fund.update({
    where: { id: "main" },
    data: {
      cash: { increment: proceeds },
      allocated: { decrement: position.allocation },
    },
  });
  await tx.closeProposal.updateMany({
    where: {
      positionId: id,
      status: "PENDING",
      ...(proposalId ? { id: { not: proposalId } } : {}),
    },
    data: { status: "CANCELLED", resolvedAt: new Date() },
  });
  return true;
}
