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
    await rateLimit(`vote:${user.id}`, 60, 3600);
    const data = voteSchema.parse(await jsonBody(request));
    const { id } = await context.params;
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Pitch" WHERE "id" = ${id} FOR UPDATE`;
      const pitch = await tx.pitch.findUnique({ where: { id } });
      if (!pitch) throw new HttpError(404, "Pitch not found.");
      if (pitch.status !== "PENDING" || pitch.expiresAt <= new Date())
        throw new HttpError(409, "Voting has closed.");
      await tx.vote.create({
        data: { ...data, pitchId: id, voterId: user.id },
      });
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
