import Image from "next/image";
import Link from "next/link";
export function Brand({ dark = false }: { dark?: boolean }) {
  return (
    <Link
      href="/"
      aria-label="IFBS Consensus home"
      className="flex items-center gap-3"
    >
      <div className="flex h-11 w-11 shrink-0 items-center overflow-hidden rounded-lg bg-white">
        <Image
          src="/ifbs-logo.jpeg"
          alt="Imperial Fintech & Blockchain Society"
          width={120}
          height={48}
          priority
          className="h-12 w-[120px] max-w-none shrink-0"
        />
      </div>
      <div className={dark ? "text-white" : "text-navy"}>
        <span className="block text-base font-bold tracking-tight">
          Consensus<span className="text-brand">.</span>
        </span>
        <span
          className={`block whitespace-nowrap text-[8px] font-bold tracking-[.14em] ${dark ? "text-blue-200" : "text-slate-400"}`}
        >
          THE IFBS PAPER FUND
        </span>
      </div>
    </Link>
  );
}
