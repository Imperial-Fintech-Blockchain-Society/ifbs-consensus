import Link from "next/link";
import { Brand } from "@/components/brand";
import { PublicFund } from "@/components/public-fund";

export const metadata = {
  title: "Paper fund",
  description:
    "Live holdings and performance of the IFBS crypto paper fund, in USD.",
};

export default function FundPage() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200/70 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <Brand />
          <Link href="/login" className="text-sm font-semibold text-navy">
            Member login
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="mb-8 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-navy sm:text-4xl">
            The paper fund
          </h1>
        </div>
        <PublicFund />
      </main>
    </div>
  );
}
