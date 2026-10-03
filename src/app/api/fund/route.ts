import { NextResponse } from "next/server";
import { publicFund } from "@/lib/public-fund";
import { errorResponse } from "@/lib/http";

export async function GET() {
  try {
    return NextResponse.json(await publicFund(), {
      headers: { "Cache-Control": "public, s-maxage=60" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
