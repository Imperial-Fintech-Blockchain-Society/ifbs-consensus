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
      <head>
        {/* Google tag (gtag.js) */}
        {/* Use the supplied tag directly to keep it in the document head. */}
        {/* eslint-disable-next-line @next/next/next-script-for-ga */}
        <script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-CH5GMLDV6F"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-CH5GMLDV6F');`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
