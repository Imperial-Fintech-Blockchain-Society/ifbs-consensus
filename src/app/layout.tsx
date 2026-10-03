import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "IFBS Consensus — Ideas into conviction",
    template: "%s | IFBS Consensus",
  },
  description:
    "Pitch, debate and track crypto investment ideas with the Imperial Fintech & Blockchain Society. A member-led paper investment fund.",
  icons: {
    icon: { url: "/logo.jpg", type: "image/jpeg" },
    shortcut: "/logo.jpg",
    apple: "/logo.jpg",
  },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
