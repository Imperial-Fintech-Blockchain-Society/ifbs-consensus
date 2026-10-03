import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { validateCoin, prices, executablePrice } from "@/lib/coingecko";
import { pitchSchema, VOTING_DAYS, QUORUM } from "@/lib/rules";
import {
  errorResponse,
  HttpError,
  sameOrigin,
  jsonBody,
  rateLimit,
} from "@/lib/http";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await currentUser();
    if (!user) throw new HttpError(401, "Please sign in.");
    await rateLimit(`pitch:${user.id}`, 10, 86400);
    const data = pitchSchema.parse(await jsonBody(request));
    const coin = await validateCoin(data.coinId);
    executablePrice((await prices([coin.id], true))[coin.id]);
    const pitch = await db.pitch.create({
      data: {
        ...data,
        authorId: user.id,
        tokenName: coin.name,
        ticker: coin.symbol.toUpperCase(),
        quorum: QUORUM,
        expiresAt: new Date(Date.now() + VOTING_DAYS * 86400000),
      },
    });
    return NextResponse.json({ id: pitch.id }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
