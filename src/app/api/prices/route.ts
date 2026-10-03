import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { prices } from "@/lib/coingecko";
import { errorResponse, HttpError, rateLimit } from "@/lib/http";
export async function GET() {
  try {
    const user = await currentUser();
    if (!user) throw new HttpError(401, "Please sign in.");
    await rateLimit(`prices:${user.id}`, 10, 60);
    const positions = await db.position.findMany({
      where: { status: "OPEN" },
      select: { coinId: true },
    });
    return NextResponse.json({
      quotes: await prices(positions.map((p) => p.coinId)),
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
