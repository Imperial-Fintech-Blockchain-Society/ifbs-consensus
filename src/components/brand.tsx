import Image from "next/image";
import Link from "next/link";
export function Brand({ dark = false }: { dark?: boolean }) {
  return (
    <Link
      href="/"
      aria-label="IFBS Consensus home"
      className="flex items-center gap-3"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white">
        <Image
          src="/logo.jpg"
          alt="Imperial Fintech & Blockchain Society"
          width={44}
          height={44}
          priority
          className="h-full w-full object-contain"
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
