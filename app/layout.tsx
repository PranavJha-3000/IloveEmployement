import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "iloveemployment — Get hired. Or at least stop getting ignored.",
  description:
    "Brutally honest, actually useful resume analysis with a side of unhinged commentary. Bring your own AI key. No sign-up. No tracking.",
  metadataBase: new URL("https://iloveemployement.vercel.app"),
  openGraph: {
    title: "iloveemployment",
    description: "Ilovepdf but for getting a job. Brutal resume analysis. Bring your own AI key.",
    url: "https://iloveemployement.vercel.app",
    siteName: "iloveemployment",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "iloveemployment",
    description: "Brutal resume analysis. Bring your own AI key.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

