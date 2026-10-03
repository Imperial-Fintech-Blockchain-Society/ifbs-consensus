import { Brand } from "./brand";
import { AuthForm } from "./auth-form";
import { Quote, ShieldCheck } from "lucide-react";
export function AuthPage({ mode }: { mode: "login" | "register" }) {
  return (
    <main className="grid min-h-screen bg-paper lg:grid-cols-2">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-navy p-12 text-white lg:flex">
        <Brand dark />
        <div className="absolute -bottom-40 -right-40 h-[600px] w-[600px] rounded-full border-[90px] border-brand/15" />
        <div className="relative max-w-md">
          <Quote size={40} className="mb-8 text-blue-400" />
          <h2 className="text-5xl font-bold leading-tight tracking-tight">
            One idea.
            <br />
            Many perspectives.
            <br />
            <span className="text-blue-400">Better conviction.</span>
          </h2>
          <p className="mt-6 text-sm leading-7 text-blue-100/70">
            The Imperial community’s space to research, debate, and learn from
            the markets together.
          </p>
          <div className="mt-10 flex items-center gap-3 text-xs text-blue-200">
            <ShieldCheck size={18} />
            Exclusively for Imperial members
          </div>
        </div>
        <p className="relative text-xs text-blue-200/50">
          Imperial Fintech & Blockchain Society · Consensus
        </p>
      </section>
      <section className="flex flex-col px-6 py-8 sm:px-12">
        <div className="lg:hidden">
          <Brand />
        </div>
        <div className="m-auto w-full max-w-sm py-12">
          <p className="eyebrow mb-4 text-brand">
            {mode === "register" ? "Your perspective matters" : "Welcome back"}
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-navy">
            {mode === "register"
              ? "Join the conversation."
              : "Back to the collective."}
          </h1>
          <p className="mb-8 mt-3 text-sm leading-6 text-slate-500">
            {mode === "register"
              ? "Create your account and make your first contribution to the fund."
              : "Log in to explore the latest ideas and follow the fund."}
          </p>
          <AuthForm mode={mode} />
        </div>
      </section>
    </main>
  );
}
