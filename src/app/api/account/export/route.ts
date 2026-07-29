/**
 * הורדת קובץ ייצוא — GET /api/account/export?type=clients|bookings
 *
 * נתיב מוגן: אינו מופיע ברשימת ההיתר של ה-middleware, ו-requireCurrentBusiness
 * מאמת סשן, מנוי פעיל והשתייכות לעסק לפני כל שאילתה. הייצוא עצמו מסונן
 * ב-businessId של העסק הנוכחי בלבד.
 *
 * זה route handler ולא Server Action כי התוצאה היא קובץ להורדה: הדפדפן צריך
 * כתובת שאפשר לפתוח ישירות עם Content-Disposition, בלי להעביר מגה-בייטים של
 * CSV דרך תגובת RSC.
 */

import { NextResponse, type NextRequest } from "next/server";
import { requireCurrentBusiness } from "@/server/auth/session";
import { buildExport, isExportType } from "@/server/account/export";
import { safeFileName } from "@/lib/csv";
import { captureError } from "@/lib/logger";

// תמיד דינמי — הנתונים משתנים כל הזמן ואסור שיישמרו ב-cache משותף.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const business = await requireCurrentBusiness();

  const type = req.nextUrl.searchParams.get("type");
  if (!isExportType(type)) {
    return NextResponse.json(
      { error: "סוג ייצוא לא מוכר." },
      { status: 400 },
    );
  }

  try {
    const result = await buildExport({ businessId: business.id }, type);

    const fileName = safeFileName(
      `Allura-${result.fileNameBase}-${business.slug}`,
      "csv",
    );

    return new NextResponse(result.content, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        // filename* בקידוד UTF-8 — שם הקובץ בעברית שובר את filename= הפשוט.
        // נשמר גם fallback ASCII לדפדפנים ישנים.
        "Content-Disposition": `attachment; filename="allura-export.csv"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    captureError("account.export", err, { businessId: business.id, type });
    return NextResponse.json(
      { error: "ייצוא הנתונים נכשל. נסי שוב בעוד רגע." },
      { status: 500 },
    );
  }
}
