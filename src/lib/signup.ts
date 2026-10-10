import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import { Resend } from "resend";
import { db } from "./db";
import { HttpError } from "./http";

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function escape(text: string) {
  return text.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c]!,
  );
}

export async function requestSignup(data: {
  name: string;
  email: string;
  password: string;
}) {
  const { RESEND_API_KEY, EMAIL_FROM, NEXT_PUBLIC_APP_URL } = process.env;
  if (!RESEND_API_KEY || !EMAIL_FROM || !NEXT_PUBLIC_APP_URL)
    throw new HttpError(
      503,
      "Email confirmation is temporarily unavailable. Please try again later.",
    );
  if (await db.user.findUnique({ where: { email: data.email } }))
    throw new HttpError(
      409,
      "An account with this email already exists. Please log in.",
    );

  const token = randomBytes(32).toString("hex");
  const url = new URL("/verify-email", NEXT_PUBLIC_APP_URL);
  url.searchParams.set("token", token);
  const now = new Date();
  await db.pendingSignup.deleteMany({ where: { expiresAt: { lte: now } } });
  const pending = {
    name: data.name,
    passwordHash: await hash(data.password, 12),
    tokenHash: tokenHash(token),
    expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
  };
  await db.pendingSignup.upsert({
    where: { email: data.email },
    create: { email: data.email, ...pending },
    update: pending,
  });
  const link = escape(url.toString());
  try {
    const result = await new Resend(RESEND_API_KEY).emails.send(
      {
        from: EMAIL_FROM,
        to: data.email,
        subject: "Confirm your email · IFBS Consensus",
        html: `<html><body style="margin:0;padding:24px;background:#f4f6fc;font-family:Arial,sans-serif;color:#142044;line-height:1.6"><div style="max-width:560px;margin:auto;background:#fff;padding:32px;border-radius:16px"><p style="color:#216cf0;font-weight:bold">IFBS / CONSENSUS</p><h1>Confirm your email address</h1><p>Hi ${escape(data.name)},</p><p>Confirm that this email address belongs to you to finish signing up for Consensus. Your account will only be created after you confirm.</p><p style="margin:32px 0"><a href="${link}" style="display:inline-block;padding:14px 24px;background:#216cf0;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold">Confirm email address</a></p><p>If the button doesn’t work, click or copy this link into your browser:</p><p style="overflow-wrap:anywhere"><a href="${link}">${link}</a></p><p>This link expires in 24 hours. If you request another email, use the newest link.</p><p style="font-size:12px;color:#657089">If you didn’t request this signup, you can ignore this email.</p></div></body></html>`,
        text: `Hi ${data.name},\n\nConfirm your email address to finish signing up for IFBS Consensus:\n${url}\n\nYour account will only be created after confirmation. This link expires in 24 hours. If you request another email, use the newest link.\n\nIf you didn’t request this signup, ignore this email.`,
      },
      { idempotencyKey: `ifbs-signup-${pending.tokenHash}` },
    );
    if (result.error) throw new Error("Email delivery failed");
  } catch {
    await db.pendingSignup.deleteMany({
      where: { tokenHash: pending.tokenHash },
    });
    throw new HttpError(
      503,
      "We couldn’t send your confirmation email. Please sign up again to retry.",
    );
  }
}

export async function confirmSignup(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token))
    throw new HttpError(
      400,
      "This confirmation link is invalid. Please sign up again.",
    );
  return db.$transaction(async (tx) => {
    const pending = await tx.pendingSignup.findUnique({
      where: { tokenHash: tokenHash(token) },
    });
    if (!pending || pending.expiresAt <= new Date())
      throw new HttpError(
        400,
        "This confirmation link has expired or has already been used. Please log in or sign up again.",
      );
    // Consuming the token and creating the account are atomic, including concurrent clicks.
    const consumed = await tx.pendingSignup.deleteMany({
      where: {
        id: pending.id,
        tokenHash: pending.tokenHash,
        expiresAt: { gt: new Date() },
      },
    });
    if (consumed.count !== 1)
      throw new HttpError(
        400,
        "This confirmation link has already been used. Please log in.",
      );
    return tx.user.create({
      data: {
        name: pending.name,
        email: pending.email,
        passwordHash: pending.passwordHash,
      },
    });
  });
}
