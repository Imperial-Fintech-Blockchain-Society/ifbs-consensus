import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { closeProposalSchema } from "@/lib/rules";
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
    await rateLimit(`close-proposal:${user.id}`, 10, 3600);
    const data = closeProposalSchema.parse(await jsonBody(request));
    const { id } = await context.params;
    const proposal = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Position" WHERE "id" = ${id} FOR UPDATE`;
      const position = await tx.position.findUnique({ where: { id } });
      if (!position) throw new HttpError(404, "Position not found.");
      if (position.status !== "OPEN")
        throw new HttpError(409, "Position is closed.");
      if (
        await tx.closeProposal.findFirst({
          where: { positionId: id, status: "PENDING" },
        })
      )
        throw new HttpError(409, "A close vote is already pending.");
      const now = new Date();
      return tx.closeProposal.create({
        data: {
          positionId: id,
          proposerId: user.id,
          reason: data.reason,
          createdAt: now,
          expiresAt: new Date(now.getTime() + data.hours * 3600000),
        },
      });
    });
    return NextResponse.json({ id: proposal.id }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
