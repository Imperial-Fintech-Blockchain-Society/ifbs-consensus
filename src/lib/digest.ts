import "server-only";
import { Resend } from "resend";
import { db } from "./db";
import { HttpError } from "./http";
function escape(text: string) {
  return text.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
export async function sendDigest() {
  if (
    !process.env.RESEND_API_KEY ||
    !process.env.EMAIL_FROM ||
    !process.env.NEXT_PUBLIC_APP_URL
  )
    throw new HttpError(
      503,
      "Set RESEND_API_KEY, EMAIL_FROM and NEXT_PUBLIC_APP_URL to enable digests.",
    );
  const now = new Date();
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  const week = start.toISOString().slice(0, 10);
  const pitches = await db.pitch.findMany({
    where: {
      status: "PENDING",
      expiresAt: { gt: now },
      createdAt: { gte: new Date(now.getTime() - 7 * 86400000) },
    },
    include: {
      author: { select: { name: true } },
      _count: { select: { votes: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!pitches.length) return { sent: 0, skipped: "No new active pitches" };
  const users = await db.user.findMany({
    where: { digestEnabled: true },
    select: { id: true, email: true, name: true },
  });
  const resend = new Resend(process.env.RESEND_API_KEY);
  const base = process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  let sent = 0;
  const failures: string[] = [];
  for (const user of users) {
    if (
      await db.digestDelivery.findUnique({
        where: { week_userId: { week, userId: user.id } },
      })
    )
      continue;
    try {
      const html = `<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="background:#f4f6fc;font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#142044;margin:0;padding:0"><div style="width:100%;max-width:600px;margin:auto;background:#fefefe;padding:0;overflow-wrap:anywhere"><p style="color:#216cf0;font-weight:bold">IFBS / CONSENSUS</p><h1>This week’s investment ideas</h1><p>Hi ${escape(user.name)}, add your perspective to the fund.</p>${pitches.map((p) => `<div style="border-top:1px solid #e5e9f3;padding:20px 0"><p style="color:#216cf0">${escape(p.ticker)} · ${p._count.votes} votes</p><h2>${escape(p.title)}</h2><p>${escape(p.thesis.slice(0, 240))}…</p><a href="${escape(base)}/pitches/${p.id}" style="color:#216cf0">Read the thesis and vote →</a></div>`).join("")}<p><a href="${escape(base)}/dashboard">Open Consensus</a></p><p style="font-size:12px;color:#657089">Paper investments only. <a href="${escape(base)}/account">Manage weekly email preferences</a></p></div></body></html>`;
      const result = await resend.emails.send(
        {
          from: process.env.EMAIL_FROM,
          to: user.email,
          subject: `IFBS Consensus · ${pitches.length} ideas to discuss this week`,
          html,
        },
        { idempotencyKey: `ifbs-digest-${week}-${user.id}` },
      );
      if (result.error) throw new Error("Email delivery failed");
      await db.digestDelivery.create({ data: { week, userId: user.id } });
      sent++;
      // Resend's standard API rate limit is two requests per second.
      await new Promise((resolve) => setTimeout(resolve, 600));
    } catch {
      failures.push(user.id);
    }
  }
  return { sent, failures };
}
