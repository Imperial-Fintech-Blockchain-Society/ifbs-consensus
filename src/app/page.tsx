import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Lightbulb,
  MessagesSquare,
  ChartNoAxesCombined,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";
import { Brand } from "@/components/brand";
export default function Home() {
  return (
    <div className="bg-paper">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <Brand />
        <nav className="flex items-center gap-5 text-sm">
          <a
            href="#how-it-works"
            className="hidden text-slate-500 hover:text-brand sm:block"
          >
            How it works
          </a>
          <Link href="/login" className="font-semibold text-navy">
            Log in
          </Link>
          <Link href="/register" className="btn max-sm:hidden">
            Join the fund
            <ArrowUpRight size={16} />
          </Link>
        </nav>
      </header>
      <main>
        <section className="hero-grid relative overflow-hidden border-y border-slate-100">
          <div className="absolute -right-40 top-0 h-[600px] w-[600px] rounded-full bg-blue-100/40 blur-3xl" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:py-28">
            <div>
              <h1 className="mt-7 text-5xl font-bold leading-[1.08] tracking-[-.055em] text-navy sm:text-6xl lg:text-[72px]">
                Great ideas
                <br />
                deserve a<br />
                <span className="text-brand">second opinion.</span>
              </h1>
              <p className="mt-6 max-w-md text-base leading-7 text-slate-500">
                A crypto paper fund, built by the community. Pitch your thesis,
                challenge the thinking, and turn collective conviction into a
                track record.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/register" className="btn px-6 py-3.5">
                  Find your consensus
                  <ArrowRight size={17} />
                </Link>
                <a href="#how-it-works" className="btn-secondary">
                  Explore the process
                  <ChevronRight size={16} />
                </a>
              </div>
              <div className="mt-7 flex items-center gap-2 text-xs text-slate-400">
                <ShieldCheck size={15} className="text-brand" />
                Imperial members only<span className="mx-2">·</span>100% paper
                money
              </div>
            </div>
          </div>
        </section>
        <section
          id="how-it-works"
          className="mx-auto max-w-7xl px-5 py-20 sm:px-8"
        >
          <div className="mb-12 flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="eyebrow text-brand">
                A better way to learn the markets
              </p>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-navy sm:text-4xl">
                From an idea to a shared conviction.
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-6 text-slate-500">
              Real market prices. Transparent decisions.
              <br />A place to sharpen your thinking, together.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                icon: Lightbulb,
                title: "Make your case",
                body: "Choose a token, write your investment thesis, and set your take-profit and stop-loss targets.",
              },
              {
                icon: MessagesSquare,
                title: "Put it to the room",
                body: "Members debate and vote over seven days. Five votes and a majority approval put your idea into motion.",
              },
              {
                icon: ChartNoAxesCombined,
                title: "Follow the outcome",
                body: "Invest up to $10,000 per pitch within the $100,000 paper fund.",
              },
            ].map(({ icon: Icon, title, body }) => (
              <article
                key={title}
                className="rounded-2xl border border-slate-200/80 p-7"
              >
                <div className="mb-8 flex items-center justify-between">
                  <span className="rounded-xl bg-blue-50 p-3 text-brand">
                    <Icon size={23} />
                  </span>
                </div>
                <h3 className="text-xl font-bold text-navy">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-500">{body}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
      <footer className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-5 border-t border-slate-100 px-5 py-7 sm:px-8">
        <Brand />
        <p className="text-xs text-slate-400">
          © {new Date().getFullYear()} IFBS. Paper investing, real learning.
        </p>
      </footer>
    </div>
  );
}
