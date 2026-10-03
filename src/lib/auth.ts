import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { redirect } from "next/navigation";
import { db } from "./db";
const cookieName = "ifbs_session";
function secret() {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 32)
    throw new Error("JWT_SECRET must contain at least 32 characters.");
  return new TextEncoder().encode(value);
}
export async function createSession(userId: string) {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuer("ifbs-consensus")
    .setAudience("ifbs-members")
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());
  (await cookies()).set(cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 86400,
  });
}
export async function clearSession() {
  (await cookies()).delete(cookieName);
}
export async function currentUser() {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) return null;
  let id: string | undefined;
  try {
    id = (
      await jwtVerify(token, secret(), {
        algorithms: ["HS256"],
        issuer: "ifbs-consensus",
        audience: "ifbs-members",
      })
    ).payload.sub;
  } catch {
    return null;
  }
  return id
    ? db.user.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          digestEnabled: true,
        },
      })
    : null;
}
export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}
