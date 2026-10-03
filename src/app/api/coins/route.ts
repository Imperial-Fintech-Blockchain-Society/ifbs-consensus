import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { searchCoins } from "@/lib/coingecko";
import { errorResponse, HttpError, rateLimit } from "@/lib/http";
export async function GET(request: Request) {
  try {
    const user = await currentUser();
    if (!user) throw new HttpError(401, "Please sign in.");
    await rateLimit(`search:${user.id}`, 60, 60);
    const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
    if (query.length < 2 || query.length > 80)
      return NextResponse.json({ coins: [] });
    return NextResponse.json({ coins: await searchCoins(query) });
  } catch (error) {
    return errorResponse(error);
  }
}
