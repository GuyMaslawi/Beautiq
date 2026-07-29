import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, getCurrentBusiness } from "@/server/auth/session";
import { getDayAvailability } from "@/server/availability/get-available-slots";
import { isValidDateStr } from "@/lib/time";

export async function GET(req: NextRequest) {
  // אותו שער בדיוק כמו requirePaidUser() + requireCurrentBusiness(), אבל כתוב
  // במפורש כדי שהמסלול יחזיר קודי סטטוס JSON במקום הפניה — הלקוח כאן קורא
  // res.json(), ודף HTML של התחברות היה נראה לו כתשובה תקינה.
  //
  // עד עכשיו נבדק רק "האם יש עסק מחובר", ולכן חשבון שלא שילם או חשבון שהושהה
  // בגלל ניצול לרעה המשיך לקרוא כאן בזמן שכל שאר האפליקציה נחסמה בפניו.
  const user = await getCurrentUser();
  if (!user) {
    // 401 (ולא רשימה ריקה בשקט) כדי שהלקוח יציג שגיאה אמיתית במקום להסוות
    // אותה כ"אין שעות פנויות".
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const suspended =
    !user.isAdmin &&
    !user.impersonating &&
    !!user.suspendedUntil &&
    user.suspendedUntil.getTime() > Date.now();
  if (suspended) {
    return NextResponse.json({ error: "suspended" }, { status: 403 });
  }
  if (!user.plan && !user.isAdmin && !user.impersonating) {
    return NextResponse.json({ error: "subscription_required" }, { status: 403 });
  }

  const business = await getCurrentBusiness();
  if (!business) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const date = req.nextUrl.searchParams.get("date");
  const serviceId = req.nextUrl.searchParams.get("serviceId");

  // isValidDateStr ולא רק בדיקת תבנית: "2026-99-99" עובר regex ומתגלגל בשקט
  // לתאריך אחר לגמרי.
  if (!date || !serviceId || !isValidDateStr(date)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  // businessId comes from the session — never from client input (CLAUDE.md §10).
  const { open, slots } = await getDayAvailability({
    businessId: business.id,
    date,
    serviceId,
  });

  return NextResponse.json({ open, slots });
}
