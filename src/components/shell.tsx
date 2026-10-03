"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Lightbulb,
  ChartNoAxesCombined,
  UserRound,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { Brand } from "./brand";
const links = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/pitches", label: "Investment pitches", icon: Lightbulb },
  { href: "/portfolio", label: "The paper fund", icon: ChartNoAxesCombined },
  { href: "/account", label: "My track record", icon: UserRound },
];
export function Shell({
  user,
  children,
}: {
  user: { name: string; email: string };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  async function logout() {
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error();
      router.push("/");
      router.refresh();
    } catch {
      setError("Could not sign out. Please retry.");
    }
  }
  return (
    <div className="min-h-screen">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 lg:hidden">
        <Brand />
        <button
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="rounded-lg p-2"
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>
      {open && (
        <div
          className="fixed inset-0 top-[77px] z-30 bg-navy/30 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-navy px-5 py-8 text-white max-lg:top-[77px] ${open ? "" : "max-lg:hidden"}`}
      >
        <div className="mb-10 hidden px-2 lg:block">
          <Brand dark />
        </div>
        <p className="eyebrow mb-4 px-3 text-blue-200/60">Workspace</p>
        <nav className="space-y-2">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              onClick={() => setOpen(false)}
              key={href}
              href={href}
              aria-current={
                pathname === href || pathname.startsWith(href + "/")
                  ? "page"
                  : undefined
              }
              className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm ${pathname === href || pathname.startsWith(href + "/") ? "bg-white/12 font-semibold text-white" : "text-blue-100/70 hover:bg-white/5 hover:text-white"}`}
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto">
          <div className="flex items-center gap-3 border-t border-white/10 pt-5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold">
              {user.name
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold">{user.name}</p>
            </div>
            <button
              aria-label="Sign out"
              onClick={logout}
              className="rounded-lg p-2 text-blue-200 hover:bg-white/10"
            >
              <LogOut size={16} />
            </button>
          </div>
          {error && (
            <p role="alert" className="mt-2 text-xs text-red-200">
              {error}
            </p>
          )}
        </div>
      </aside>
      <div className="lg:pl-64">
        <main className="mx-auto max-w-[1440px] px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
          {children}
        </main>
        <footer className="flex flex-wrap justify-between gap-2 px-8 pb-6 text-[10px] text-slate-400">
          <span>
            © {new Date().getFullYear()} Imperial Fintech & Blockchain Society
          </span>
        </footer>
      </div>
    </div>
  );
}
