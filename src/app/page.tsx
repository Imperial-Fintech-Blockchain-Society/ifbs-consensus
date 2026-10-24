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
          <Link href="/fund" className="font-semibold text-brand">
            Paper fund
          </Link>
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
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-0 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-blue-100/50 blur-3xl"
          />
          <div className="relative mx-auto max-w-7xl px-5 py-20 text-center sm:px-8 sm:py-24 lg:py-28">
            <div className="mx-auto max-w-6xl">
              <p className="eyebrow text-brand">
                Imperial Fintech &amp; Blockchain Society
              </p>
              <h1 className="mt-6 text-[clamp(2.75rem,6.7vw,6rem)] font-bold leading-[1.04] tracking-[-.055em] text-balance text-navy">
                Where ideas become
                <span className="block text-brand">investments.</span>
              </h1>
              <p className="mx-auto mt-7 max-w-2xl text-base leading-7 text-balance text-slate-500 sm:text-lg sm:leading-8">
                A crypto paper fund, built by the community. Pitch your thesis,
                challenge the thinking, and turn collective conviction into a
                track record.
              </p>
              <div className="mt-9 flex flex-wrap justify-center gap-3">
                <Link href="/register" className="btn px-6 py-3.5">
                  Find your consensus
                  <ArrowRight size={17} />
                </Link>
                <a href="/fund" className="btn-secondary">
                  Explore fund performance
                  <ChevronRight size={16} />
                </a>
              </div>
              <div className="mt-7 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-slate-500">
                <span className="inline-flex items-center gap-2">
                  <ShieldCheck
                    size={15}
                    aria-hidden="true"
                    className="text-brand"
                  />
                  Imperial members only
                </span>
                <span>100% paper money</span>
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
                body: "Choose a token, write your investment thesis, and set your investment amount and stop loss.",
              },
              {
                icon: MessagesSquare,
                title: "Put it to the room",
                body: "Members debate and vote over three days. Five votes and a majority approval put your idea into motion.",
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
