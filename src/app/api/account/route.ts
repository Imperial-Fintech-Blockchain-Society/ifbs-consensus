import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { errorResponse, HttpError, sameOrigin, jsonBody } from "@/lib/http";
export async function PATCH(request: Request) {
  try {
    sameOrigin(request);
    const user = await currentUser();
    if (!user) throw new HttpError(401, "Please sign in.");
    const data = z
      .object({ digestEnabled: z.boolean() })
      .parse(await jsonBody(request));
    await db.user.update({ where: { id: user.id }, data });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
