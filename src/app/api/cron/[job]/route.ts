import { NextResponse } from "next/server";
import { cronAuth, errorResponse, HttpError } from "@/lib/http";
import { resolveAll } from "@/lib/engine";
import { db } from "@/lib/db";
import { sendDigest } from "@/lib/digest";
import { recordFundSnapshot } from "@/lib/public-fund";
export const maxDuration = 300;
export async function POST(
  request: Request,
  context: { params: Promise<{ job: string }> },
) {
  try {
    cronAuth(request);
    const { job } = await context.params;
    const result =
      job === "resolve"
        ? await resolveAll()
        : job === "monitor"
          ? { failures: [] as string[] }
          : job === "digest"
            ? await sendDigest()
            : null;
    if (!result) throw new HttpError(404, "Unknown job.");
    if (job === "monitor") {
      await db.rateLimit.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
      try {
        await recordFundSnapshot();
      } catch {
        if ("failures" in result) result.failures?.push("fund-snapshot");
      }
    }
    return NextResponse.json(result, {
      status: "failures" in result && result.failures?.length ? 503 : 200,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
