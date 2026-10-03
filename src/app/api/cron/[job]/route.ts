import { NextResponse } from "next/server";
import { cronAuth, errorResponse, HttpError } from "@/lib/http";
import { resolveAll, monitorPositions } from "@/lib/engine";
import { sendDigest } from "@/lib/digest";
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
          ? await monitorPositions()
          : job === "digest"
            ? await sendDigest()
            : null;
    if (!result) throw new HttpError(404, "Unknown job.");
    return NextResponse.json(result, {
      status: "failures" in result && result.failures?.length ? 503 : 200,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
