import type { Metadata } from "next";
import { Explainer } from "./explainer";

// עמוד ציבורי: סרטון הסברה אינטראקטיבי ללקוחות פוטנציאליות.
// משותף כקישור (allura.info/intro) ומקושר מעמוד המותג /about.
export const metadata: Metadata = {
  title: "איך Allura עובדת? | Allura",
  description:
    "הצצה של דקה ל־Allura — מערכת חכמה לניהול עסקי יופי: תורים, לקוחות, וואטסאפ אוטומטי ותובנות על הכסף.",
  alternates: { canonical: "/intro" },
};

export default function IntroPage() {
  return <Explainer />;
}
