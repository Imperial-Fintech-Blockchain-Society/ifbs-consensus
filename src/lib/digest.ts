import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { Resend } from "resend";
import { db } from "./db";
import { HttpError } from "./http";

type Result<T> = { data: T | null; error: { name: string } | null };

function plain(text: string) {
  return text.replace(/\{\{\{/g, "{ { {");
}

function escape(text: string) {
  return text.replace(
    /[&<>"'{}]/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
        "{": "&#123;",
        "}": "&#125;",
      })[c]!,
  );
}

export async function sendDigest() {
  const { RESEND_API_KEY, EMAIL_FROM, NEXT_PUBLIC_APP_URL } = process.env;
  if (!RESEND_API_KEY || !EMAIL_FROM || !NEXT_PUBLIC_APP_URL)
    throw new HttpError(
      503,
      "Set RESEND_API_KEY, EMAIL_FROM and NEXT_PUBLIC_APP_URL to enable digests.",
    );
  const now = new Date();
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  const week = start.toISOString().slice(0, 10);
  const owner = randomUUID();
  await db.digestBroadcast.upsert({
    where: { week },
    create: { week },
    update: {},
  });
  const lock = await db.digestBroadcast.updateMany({
    where: { week, OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }] },
    data: {
      lockOwner: owner,
      lockedUntil: new Date(now.getTime() + 10 * 60 * 1000),
    },
  });
  if (lock.count !== 1)
    throw new HttpError(
      503,
      "This week’s digest is already being processed. Please retry later.",
    );

  try {
    const resend = new Resend(RESEND_API_KEY);
    // Pace API requests and stop before the route's 300-second deadline. A retry
    // continues the contact sync and retrieves any draft already created.
    let nextRequest = 0;
    const deadline = Date.now() + 260000;
    async function call<T>(operation: () => Promise<Result<T>>): Promise<T> {
      for (let attempt = 0; attempt < 3; attempt++) {
        if (Date.now() >= deadline)
          throw new HttpError(
            503,
            "Digest recipient sync is still in progress. Please retry the digest endpoint.",
          );
        const delay = nextRequest - Date.now();
        if (delay > 0)
          await new Promise((resolve) => setTimeout(resolve, delay));
        nextRequest = Date.now() + 150;
        const result = await operation();
        if (!result.error && result.data) return result.data;
        if (result.error?.name === "rate_limit_exceeded" && attempt < 2) {
          await new Promise((resolve) =>
            setTimeout(resolve, 1000 * (attempt + 1)),
          );
          continue;
        }
        throw new HttpError(
          503,
          "Resend could not prepare or send the digest. Check the API key has full access and retry.",
        );
      }
      throw new HttpError(503, "Resend is temporarily unavailable.");
    }
    async function pages<T extends { id: string }>(
      fetchPage: (
        after?: string,
      ) => Promise<Result<{ data: T[]; has_more: boolean }>>,
    ) {
      const items: T[] = [];
      let after: string | undefined;
      const cursors = new Set<string>();
      do {
        const page = await call(() => fetchPage(after));
        items.push(...page.data);
        if (!page.has_more) return items;
        after = page.data.at(-1)?.id;
        if (!after || cursors.has(after))
          throw new HttpError(
            503,
            "Could not read all Resend records. Please retry.",
          );
        cursors.add(after);
      } while (after);
      return items;
    }

    const state = await db.digestBroadcast.findUniqueOrThrow({
      where: { week },
    });
    const namespace = createHash("sha256")
      .update(new URL(NEXT_PUBLIC_APP_URL).origin)
      .digest("hex")
      .slice(0, 12);
    const name = `IFBS digest ${week} ${namespace}`;
    let broadcastId = state.broadcastId;
    if (!broadcastId && !state.submittedAt) {
      // Recover even if a previous create succeeded but its response was lost.
      const existing = (
        await pages((after) => resend.broadcasts.list({ limit: 100, after }))
      ).find((b) => b.name === name);
      broadcastId = existing?.id ?? null;
      if (broadcastId)
        await db.digestBroadcast.update({
          where: { week },
          data: { broadcastId },
        });
    }
    if (broadcastId) {
      const id = broadcastId;
      const { broadcast } = await call(async () => {
        const result = await resend.broadcasts.get(id);
        return {
          data: { broadcast: result.data },
          error: result.error?.name === "not_found" ? null : result.error,
        };
      });
      if (!broadcast) {
        if (state.submittedAt)
          return {
            queued: 0,
            broadcastId,
            skipped: "Digest already submitted",
          };
        broadcastId = null;
      } else {
        // A sent/queued/scheduled/canceled broadcast must never be sent again.
        if (state.submittedAt || broadcast.status !== "draft") {
          if (!state.submittedAt)
            await db.digestBroadcast.update({
              where: { week },
              data: { submittedAt: new Date() },
            });
          return {
            queued: 0,
            broadcastId,
            skipped: `Digest broadcast is ${broadcast.status}`,
          };
        }
      }
    } else if (state.submittedAt) {
      return { queued: 0, skipped: "Digest already submitted" };
    }

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
    if (!pitches.length) return { queued: 0, skipped: "No new active pitches" };
    // Keep old transactional delivery records effective during the transition.
    const delivered = await db.digestDelivery.findMany({
      where: { week },
      select: { userId: true },
    });
    const users = await db.user.findMany({
      where: {
        digestEnabled: true,
        id: { notIn: delivered.map((d) => d.userId) },
      },
      select: { email: true },
    });
    if (!users.length) return { queued: 0, skipped: "No subscribed members" };

    let segmentId = state.segmentId ?? process.env.RESEND_DIGEST_SEGMENT_ID;
    if (!segmentId) {
      const segmentName = `IFBS digest members ${namespace}`;
      const segments = await pages((after) =>
        resend.segments.list({ limit: 100, after }),
      );
      segmentId = segments.find((s) => s.name === segmentName)?.id;
      if (!segmentId)
        segmentId = (
          await call(() => resend.segments.create({ name: segmentName }))
        ).id;
    }
    await call(() => resend.segments.get(segmentId!));
    await db.digestBroadcast.update({ where: { week }, data: { segmentId } });

    const contacts = await pages((after) =>
      resend.contacts.list({ limit: 100, after }),
    );
    const members = await pages((after) =>
      resend.contacts.list({ segmentId, limit: 100, after }),
    );
    const byEmail = new Map(contacts.map((c) => [c.email.toLowerCase(), c]));
    const eligible = new Set(users.map((u) => u.email.toLowerCase()));
    const inSegment = new Set(members.map((c) => c.email.toLowerCase()));
    // This is a dedicated app-managed segment: remove opted-out/non-member
    // addresses without deleting contacts or altering their other segments.
    for (const contact of members) {
      if (!eligible.has(contact.email.toLowerCase()) || contact.unsubscribed)
        await call(() =>
          resend.contacts.segments.remove({
            contactId: contact.id,
            segmentId: segmentId!,
          }),
        );
    }
    let recipients = 0;
    for (const user of users) {
      const contact = byEmail.get(user.email.toLowerCase());
      // Never overwrite an unsubscribe made through Resend's email link.
      if (contact?.unsubscribed) continue;
      if (!contact) {
        await call(() =>
          resend.contacts.create({
            email: user.email,
            segments: [{ id: segmentId! }],
          }),
        );
      } else if (!inSegment.has(user.email.toLowerCase())) {
        await call(() =>
          resend.contacts.segments.add({
            contactId: contact.id,
            segmentId: segmentId!,
          }),
        );
      }
      recipients++;
    }
    if (!recipients) return { queued: 0, skipped: "No subscribed recipients" };

    const base = NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
    const subject = `IFBS Consensus · ${pitches.length} ideas to discuss this week`;
    const html = `<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="background:#f4f6fc;font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#142044;margin:0;padding:0"><div style="width:100%;max-width:600px;margin:auto;background:#fefefe;padding:0;overflow-wrap:anywhere"><p style="color:#216cf0;font-weight:bold">IFBS / CONSENSUS</p><h1>This week’s investment ideas</h1><p>Hello Consensus members, add your perspective to the fund.</p>${pitches.map((p) => `<div style="border-top:1px solid #e5e9f3;padding:20px 0"><p style="color:#216cf0">${escape(p.ticker)} · ${p._count.votes} votes</p><h2>${escape(p.title)}</h2><p>${escape(p.thesis.slice(0, 240))}…</p><a href="${escape(base)}/pitches/${p.id}" style="color:#216cf0">Read the thesis and vote →</a></div>`).join("")}<p><a href="${escape(base)}/dashboard">Open Consensus</a></p><p style="font-size:12px;color:#657089">Paper investments only. <a href="${escape(base)}/account">Manage weekly email preferences</a> · <a href="{{{RESEND_UNSUBSCRIBE_URL}}}">Unsubscribe</a></p></div></body></html>`;
    const text = `IFBS Consensus · This week’s investment ideas\n\n${pitches.map((p) => `${plain(p.ticker)}: ${plain(p.title)}\n${plain(p.thesis.slice(0, 240))}…\n${base}/pitches/${p.id}`).join("\n\n")}\n\nOpen Consensus: ${base}/dashboard\nManage preferences: ${base}/account\nUnsubscribe: {{{RESEND_UNSUBSCRIBE_URL}}}`;
    if (!broadcastId) {
      broadcastId = (
        await call(() =>
          resend.broadcasts.create({
            name,
            segmentId: segmentId!,
            from: EMAIL_FROM,
            subject,
            html,
            text,
          }),
        )
      ).id;
      await db.digestBroadcast.update({
        where: { week },
        data: { broadcastId },
      });
    }
    // Always refresh an existing draft immediately before submitting it.
    await call(() =>
      resend.broadcasts.update(broadcastId!, {
        segmentId,
        from: EMAIL_FROM,
        subject,
        html,
        text,
      }),
    );
    await call(() => resend.broadcasts.send(broadcastId!));
    await db.digestBroadcast.update({
      where: { week },
      data: { submittedAt: new Date() },
    });
    return { queued: recipients, broadcastId };
  } finally {
    await db.digestBroadcast.updateMany({
      where: { week, lockOwner: owner },
      data: { lockOwner: null, lockedUntil: null },
    });
  }
}
