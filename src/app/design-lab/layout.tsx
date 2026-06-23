import type { Metadata } from "next";
import { Frank_Ruhl_Libre, Cormorant, Heebo } from "next/font/google";
import "./lab.css";

/*
 * Design Lab layout — fully isolated.
 * Loads its own luxury type stack and sets the dark cinematic canvas.
 * This route group does NOT use the authenticated app shell, real data,
 * server actions, Prisma, or WhatsApp logic. Visual exploration only.
 */

// Hebrew editorial serif — the display voice (Dior/YSL-grade headlines in Hebrew)
const display = Frank_Ruhl_Libre({
  variable: "--font-display",
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "700", "900"],
  display: "swap",
});

// Latin high-fashion serif — wordmark, numerals, eyebrows
const latin = Cormorant({
  variable: "--font-latin",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// Clean Hebrew UI sans — body and controls
const sans = Heebo({
  variable: "--font-sans",
  subsets: ["hebrew", "latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Allura — Design Lab",
  description: "Luxury beauty operating system · visual prototype",
};

export default function DesignLabLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`allura-lab ${display.variable} ${latin.variable} ${sans.variable}`}>
      {children}
    </div>
  );
}
