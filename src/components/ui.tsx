import {
  ArrowUpRight,
  MessageSquare,
  Clock3,
  ArrowRight,
  Lightbulb,
} from "lucide-react";
import Link from "next/link";
import { timeLeft, money } from "@/lib/format";
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
      <div>
        {eyebrow && <p className="eyebrow mb-3 text-brand">{eyebrow}</p>}
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
export function Status({ status }: { status: string }) {
  const style =
    status === "PASSED" || status === "OPEN"
      ? "bg-emerald-50 text-emerald-700"
      : status === "REJECTED"
        ? "bg-rose-50 text-rose-700"
        : status === "QUEUED"
          ? "bg-amber-50 text-amber-700"
          : status === "CLOSED" || status === "CANCELLED"
            ? "bg-slate-100 text-slate-600"
            : "bg-blue-50 text-brand";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${style}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status === "PENDING"
        ? "Voting open"
        : status === "QUEUED"
          ? "Awaiting capital"
          : status.toLowerCase()}
    </span>
  );
}
export type PitchSummary = {
  id: string;
  ticker: string;
  tokenName: string;
  title: string;
  thesis: string;
  status: string;
  expiresAt: string | Date;
  author: { name: string };
  votes: { decision: boolean }[];
  quorum: number;
  allocation: number;
  stopLossPercent: number | null;
};
export function PitchCard({ pitch }: { pitch: PitchSummary }) {
  const agree = pitch.votes.filter((v) => v.decision).length;
  const approval = pitch.votes.length
    ? Math.round((agree / pitch.votes.length) * 100)
    : 0;
  return (
    <Link
      href={`/pitches/${pitch.id}`}
      className="card group flex flex-col p-6 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
    >
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-xs font-bold text-brand">
            {pitch.ticker.slice(0, 4)}
          </span>
          <div>
            <p className="text-sm font-semibold">{pitch.tokenName}</p>
            <p className="text-xs text-slate-400">{pitch.ticker}</p>
          </div>
        </div>
        <Status status={pitch.status} />
      </div>
      <h3 className="mb-3 text-lg font-bold leading-snug tracking-tight group-hover:text-brand">
        {pitch.title}
      </h3>
      <p className="mb-5 line-clamp-2 text-sm leading-6 text-slate-500">
        {pitch.thesis.replace(/[#*_`]/g, "")}
      </p>
      <div className="mb-5 flex flex-wrap gap-4 text-xs">
        <span className="text-slate-500">
          {pitch.stopLossPercent === null
            ? "Stop loss unavailable"
            : `↘ SL −${pitch.stopLossPercent}%`}
        </span>
        <span className="text-slate-500">{money(pitch.allocation)}</span>
      </div>
      <div className="mt-auto">
        <div className="mb-2 flex justify-between text-xs">
          <span className="text-slate-500">Community conviction</span>
          <span className="font-semibold">{approval}% agree</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-brand"
            style={{ width: `${approval}%` }}
          />
        </div>
        <div className="mt-4 flex justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <MessageSquare size={13} />
            {pitch.votes.length}/{pitch.quorum} quorum
          </span>
          <span className="flex items-center gap-1.5">
            <Clock3 size={13} />
            {pitch.status === "PENDING"
              ? timeLeft(pitch.expiresAt)
              : "Resolved"}
          </span>
        </div>
        <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
          <span className="text-xs text-slate-500">By {pitch.author.name}</span>
          <ArrowUpRight size={17} className="text-brand" />
        </div>
      </div>
    </Link>
  );
}
export function Empty({
  title,
  description,
  href,
  label = "Create a pitch",
}: {
  title: string;
  description: string;
  href?: string;
  label?: string;
}) {
  return (
    <div className="card px-6 py-16 text-center">
      <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-brand">
        <Lightbulb size={25} />
      </span>
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        {description}
      </p>
      {href && (
        <Link href={href} className="btn mt-6">
          {label}
          <ArrowRight size={16} />
        </Link>
      )}
    </div>
  );
}
export function Stat({
  label,
  value,
  note,
  icon,
}: {
  label: string;
  value: string;
  note: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="card p-5">
      <div className="mb-5 flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <span className="rounded-lg bg-blue-50 p-2 text-brand">{icon}</span>
      </div>
      <p className="text-3xl font-bold tracking-tight tabular-nums">{value}</p>
      <p className="mt-2 text-xs text-slate-400">{note}</p>
    </div>
  );
}
