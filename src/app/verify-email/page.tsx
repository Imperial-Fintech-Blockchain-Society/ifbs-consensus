import { Brand } from "@/components/brand";
import { EmailConfirmation } from "@/components/email-confirmation";

export const metadata = {
  title: "Confirm your email",
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};

export default async function VerifyEmail({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { token } = await searchParams;
  return (
    <main className="min-h-screen bg-paper px-6 py-8">
      <Brand />
      <div className="mx-auto mt-24 max-w-md rounded-2xl bg-white p-8">
        <EmailConfirmation token={typeof token === "string" ? token : ""} />
      </div>
    </main>
  );
}
