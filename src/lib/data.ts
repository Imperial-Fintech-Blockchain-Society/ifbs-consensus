import "server-only";
import { db } from "./db";
import type { PitchSummary } from "@/components/ui";
export async function pitchSummaries(
  where = {},
  take = 60,
): Promise<PitchSummary[]> {
  const rows = await db.pitch.findMany({
    where,
    take,
    orderBy: { createdAt: "desc" },
    include: {
      author: { select: { name: true } },
      votes: { select: { decision: true } },
    },
  });
  return rows.map((p) => ({
    ...p,
    allocation: Number(p.allocation),
  }));
}
