import type { Metadata, Viewport } from "next";
import { Schibsted_Grotesk } from "next/font/google";
import "./globals.css";

const ui = Schibsted_Grotesk({ subsets: ["latin"], variable: "--font-ui", display: "swap" });

export const metadata: Metadata = {
  title: "iloveemployment: every tool for getting hired",
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
    <html lang="en" className={ui.variable}>
      <body>{children}</body>
    </html>
  );
}

