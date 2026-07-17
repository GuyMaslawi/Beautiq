import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import "./globals.css";
import { META } from "@/lib/constants/he";
import { APP_URL } from "@/lib/config";

// פונט עברי אחיד לכל האתר — כותרות וגוף טקסט כאחד. נטען עם תת-קבוצת
// תווים עברית + לטינית כדי לתמוך בעברית ובמספרים/לטינית במקומות הנדרשים.
// חשוב: שם המשתנה ייחודי (‎--font-heebo‎) ולא זהה לטוקן העיצוב (‎--font-sans‎),
// כדי למנוע הגדרה מעגלית ש-"שוברת" את הפונט ומחזירה פונט מערכת אקראי.
const heebo = Heebo({
  variable: "--font-heebo",
  subsets: ["hebrew", "latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
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
    <html
      lang="he"
      dir="rtl"
      className={`${heebo.variable} h-full antialiased`}
    >
      <body className="bg-background text-foreground flex min-h-screen flex-col">
        {children}
      </body>
    </html>
  );
}
