import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { createHash, timingSafeEqual } from "node:crypto";
import { db } from "./db";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function errorResponse(error: unknown) {
  if (error instanceof HttpError)
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  if (error instanceof ZodError)
    return NextResponse.json(
      { error: error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  if (error instanceof SyntaxError)
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  )
    return NextResponse.json(
      { error: "This email or vote already exists." },
      { status: 409 },
    );
  console.error(
    "Request failed:",
    error instanceof Error ? error.name : "UnknownError",
  );
  return NextResponse.json(
    { error: "The service is temporarily unavailable. Please try again." },
    { status: 503 },
  );
}
const trustedOrigins = new Set([
  "https://ifbsconsensus.com",
  "https://www.ifbsconsensus.com",
  "https://ifbs-consensus.vercel.app",
  "http://localhost:3000",
  "http://localhost:3001",
]);
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  const configuredOrigin = configured ? new URL(configured).origin : null;
  if (!origin || (!trustedOrigins.has(origin) && origin !== configuredOrigin))
    throw new HttpError(403, "Request origin is not allowed.");
}
export async function jsonBody(request: Request) {
  const text = await request.text();
  if (text.length > 25000) throw new HttpError(413, "Request is too large.");
  return JSON.parse(text);
}
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
) {
  const hashed = createHash("sha256").update(key).digest("hex");
  const now = new Date();
  const expiry = new Date(now.getTime() + windowSeconds * 1000);
  const rows = await db.$queryRaw<{ count: number }[]>(Prisma.sql`
    INSERT INTO "RateLimit" ("key", "count", "expiresAt") VALUES (${hashed}, 1, ${expiry})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."expiresAt" <= ${now} THEN 1 ELSE "RateLimit"."count" + 1 END,
      "expiresAt" = CASE WHEN "RateLimit"."expiresAt" <= ${now} THEN ${expiry} ELSE "RateLimit"."expiresAt" END
    RETURNING "count"`);
  if (rows[0].count > limit)
    throw new HttpError(429, "Too many requests. Please try again later.");
}
export function clientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local"
  );
}
export function cronAuth(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected || expected.length < 32)
    throw new HttpError(503, "Cron is not configured.");
  const received = request.headers.get("authorization") ?? "";
  const target = `Bearer ${expected}`;
  if (
    received.length !== target.length ||
    !timingSafeEqual(Buffer.from(received), Buffer.from(target))
  )
    throw new HttpError(401, "Unauthorized.");
}
