import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { voteSchema } from "@/lib/rules";
import {
  errorResponse,
  HttpError,
  sameOrigin,
  jsonBody,
  rateLimit,
} from "@/lib/http";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    sameOrigin(request);
    const user = await currentUser();
    if (!user) throw new HttpError(401, "Please sign in.");
    await rateLimit(`close-vote:${user.id}`, 60, 3600);
    const data = voteSchema.parse(await jsonBody(request));
    const { id } = await context.params;
    const proposal = await db.closeProposal.findUnique({
      where: { id },
      select: { positionId: true },
    });
    if (!proposal) throw new HttpError(404, "Close vote not found.");
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Position" WHERE "id" = ${proposal.positionId} FOR UPDATE`;
      await tx.$queryRaw`SELECT "id" FROM "CloseProposal" WHERE "id" = ${id} FOR UPDATE`;
      const current = await tx.closeProposal.findUniqueOrThrow({
        where: { id },
        include: { position: { select: { status: true } } },
      });
      if (
        current.position.status !== "OPEN" ||
        current.status !== "PENDING" ||
        current.expiresAt <= new Date()
      )
        throw new HttpError(409, "Voting is closed.");
      await tx.closeVote.create({
        data: { ...data, proposalId: id, voterId: user.id },
      });
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
