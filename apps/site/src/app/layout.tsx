import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

// Display face for headlines — it has enough character to not look like a
// template, while staying legible at small sizes for the odd sub-heading.
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  display: "swap",
});

// Body face. Chosen for its numerals as much as its letters: this site is full
// of prices and percentages, and Inter's tabular figures keep them aligned.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Nearby Bids — Let local shops compete for your order",
    template: "%s · Nearby Bids",
  },
  description:
    "Post what you want to buy. Shops near you send their best price. You pick one and collect it the same day — no delivery wait, no haggling shop to shop.",
  openGraph: {
    title: "Nearby Bids — Let local shops compete for your order",
    description:
      "Post what you want to buy. Shops near you send their best price. Pick one and collect it the same day.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ea580c",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${bricolage.variable} ${inter.variable}`}>
      <body className="flex min-h-screen flex-col">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
