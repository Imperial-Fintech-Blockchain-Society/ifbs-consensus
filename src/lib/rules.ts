import { z } from "zod";
export const ALLOCATION = 10000;
export const INITIAL_CAPITAL = 100000;
export const imperialEmail = z
  .string()
  .trim()
  .toLowerCase()
  .email()
  .regex(
    /^[^@]+@(ic\.ac\.uk|imperial\.ac\.uk)$/,
    "Use your @ic.ac.uk or @imperial.ac.uk email.",
  );
export const registerSchema = z.object({
  name: z.string().trim().min(2).max(60),
  email: imperialEmail,
  password: z.string().min(12, "Use at least 12 characters.").max(72),
});
export const loginSchema = z.object({
  email: imperialEmail,
  password: z.string().min(1).max(72),
});
export const pitchSchema = z.object({
  coinId: z
    .string()
    .regex(/^[a-z0-9_-]+$/)
    .max(100),
  title: z.string().trim().min(10).max(120),
  thesis: z
    .string()
    .trim()
    .min(100, "Give your thesis at least 100 characters.")
    .max(20000),
  stopLossPercent: z.coerce
    .number()
    .min(5, "Stop loss must be at least 5%.")
    .max(20, "Stop loss must be at most 20%."),
  allocation: z.coerce
    .number()
    .positive()
    .max(ALLOCATION, "Maximum investment is $10,000.")
    .multipleOf(0.01)
    .default(ALLOCATION),
});
export const voteSchema = z.object({
  decision: z.boolean(),
  reason: z
    .string()
    .trim()
    .min(20, "Explain your vote in at least 20 characters.")
    .max(2000),
});
export const VOTING_DAYS = 3;
export const QUORUM = 5;
export const closeProposalSchema = z.object({
  reason: voteSchema.shape.reason,
  hours: z.coerce.number().int().min(1).max(24).default(24),
});
export function closePasses(agree: number, total: number) {
  return total > 0 && agree > total / 2;
}
export function passes(agree: number, total: number, quorum = QUORUM) {
  return total >= quorum && agree > total / 2;
}
export function exitReason(price: number, stop: number | null) {
  return stop !== null && price <= stop ? "STOP_LOSS" : null;
}
export function pnl(entry: number, current: number, quantity: number) {
  return {
    amount: (current - entry) * quantity,
    percent: (current / entry - 1) * 100,
  };
}
