import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";

// שורש האתר מפנה ישירות: משתמשות מחוברות ללוח הבקרה, שאר המבקרים להתחברות.
// עמוד המותג הציבורי (תעודת הזהות של Allura, נדרש לאימות שם התצוגה מול Meta)
// זמין בכתובת /about.
export default async function HomePage() {
  if (await getCurrentUser()) redirect("/dashboard");
  redirect("/login");
}
