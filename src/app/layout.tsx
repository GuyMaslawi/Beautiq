import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import "./globals.css";
import { META } from "@/lib/constants/he";
import { APP_URL } from "@/lib/config";

// פונט עברי נקי ומודרני. נטען עם תת-קבוצת תווים עברית + לטינית
// כדי לתמוך בעברית ובמספרים/לטינית במקומות הנדרשים.
const heebo = Heebo({
  variable: "--font-sans",
  subsets: ["hebrew", "latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: META.title,
  description: META.description,
  openGraph: {
    title: META.title,
    description: META.description,
    url: APP_URL,
    siteName: "Allura",
    locale: "he_IL",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // עברית ו-RTL הם ברירת המחדל של המוצר. המעטפת המלאה של האפליקציה
  // (סרגל צד, כותרת) חיה בקבוצת הראוטים המאומתת ולא כאן.
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} h-full antialiased`}>
      <body className="bg-background text-foreground flex min-h-screen flex-col">
        {children}
      </body>
    </html>
  );
}
