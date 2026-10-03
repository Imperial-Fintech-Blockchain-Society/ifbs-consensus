import { PageHeading } from "@/components/ui";
import { PitchForm } from "@/components/pitch-form";
import { Lightbulb, Check } from "lucide-react";
export const metadata = { title: "New investment pitch" };
export default function NewPitch() {
  return (
    <>
      <PageHeading title="New pitch" />
      <div className="grid items-start gap-7 xl:grid-cols-[1fr_300px]">
        <PitchForm />
        <aside className="card p-6">
          <Lightbulb size={25} className="mb-5 text-brand" />
          <h2 className="text-lg font-bold">What makes a strong pitch?</h2>
          <div className="mt-5 space-y-5">
            {[
              "A specific thesis with a clear time horizon.",
              "Evidence and catalysts behind your conviction.",
              "An honest assessment of downside risks.",
              "Targets you can explain and defend.",
            ].map((t) => (
              <div
                key={t}
                className="flex gap-3 text-sm leading-6 text-slate-500"
              >
                <Check size={16} className="mt-1 shrink-0 text-brand" />
                {t}
              </div>
            ))}
          </div>
          <p className="mt-6 border-t border-slate-100 pt-5 text-xs leading-6 text-slate-400">
            The best pitches invite a debate. Give others enough detail to form
            their own view.
          </p>
        </aside>
      </div>
    </>
  );
}
