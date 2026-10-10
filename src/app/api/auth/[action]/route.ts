import { NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { confirmSignup, requestSignup } from "@/lib/signup";
import { db } from "@/lib/db";
import { createSession, clearSession } from "@/lib/auth";
import { registerSchema, loginSchema } from "@/lib/rules";
import {
  errorResponse,
  HttpError,
  sameOrigin,
  rateLimit,
  clientIp,
  jsonBody,
} from "@/lib/http";
export async function POST(
  request: Request,
  context: { params: Promise<{ action: string }> },
) {
  try {
    sameOrigin(request);
    const { action } = await context.params;
    if (action === "logout") {
      await clearSession();
      return NextResponse.json({ ok: true });
    }
    await rateLimit(`auth:${clientIp(request)}`, 20, 900);
    if (action === "register") {
      const data = registerSchema.parse(await jsonBody(request));
      if (Buffer.byteLength(data.password, "utf8") > 72)
        throw new HttpError(400, "Password must be at most 72 UTF-8 bytes.");
      await rateLimit(`signup:${data.email}`, 3, 3600);
      await requestSignup(data);
      return NextResponse.json(
        { ok: true, verificationRequired: true },
        { status: 202 },
      );
    }
    if (action === "verify") {
      const data = await jsonBody(request);
      const user = await confirmSignup(
        typeof data?.token === "string" ? data.token : "",
      );
      await createSession(user.id);
      return NextResponse.json({ ok: true });
    }
    if (action === "login") {
      const data = loginSchema.parse(await jsonBody(request));
      await rateLimit(`login:${data.email}`, 10, 900);
      const user = await db.user.findUnique({ where: { email: data.email } });
      const dummy =
        "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxZTu.SIkBZqgcRIMutjdJlE5He";
      const valid = await compare(data.password, user?.passwordHash ?? dummy);
      if (!user || !valid)
        throw new HttpError(401, "Email or password is incorrect.");
      await createSession(user.id);
      return NextResponse.json({ ok: true });
    }
    throw new HttpError(404, "Not found.");
  } catch (error) {
    return errorResponse(error);
  }
}
