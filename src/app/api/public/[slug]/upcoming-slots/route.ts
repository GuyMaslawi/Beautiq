import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { getAvailableSlots } from "@/server/availability/get-available-slots";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 40;

export interface UpcomingSlotGroup {
  label: string; // "היום", "מחר", "יום ראשון", …
  date: string;  // "YYYY-MM-DD"
  slots: string[];
}

const HEBREW_WEEKDAYS: Record<number, string> = {
  0: "ראשון",
  1: "שני",
  2: "שלישי",
  3: "רביעי",
  4: "חמישי",
  5: "שישי",
  6: "שבת",
};

function dateLabel(dateStr: string, idx: number): string {
  if (idx === 0) return "היום";
  if (idx === 1) return "מחר";
  const [y, m, d] = dateStr.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return `יום ${HEBREW_WEEKDAYS[dow] ?? ""}`;
}

/** Return YYYY-MM-DD for a Date in Asia/Jerusalem time (avoids UTC date shift). */
function israelDateStr(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(d);
}

/** Add `n` calendar days to a YYYY-MM-DD string without timezone drift. */
function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d + n);
  return israelDateStr(date);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const ip = getClientIp(req.headers);
  if (!checkRateLimit(`slots:${ip}:${slug}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)) {
    return NextResponse.json(
      { error: "נשלחו יותר מדי בקשות. נסו שוב בעוד כמה דקות." },
      { status: 429 },
    );
  }

  const serviceId = req.nextUrl.searchParams.get("serviceId");
  if (!serviceId) return NextResponse.json({ groups: [] });

  const business = await prisma.business.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!business) return NextResponse.json({ groups: [] });

  const DAYS_AHEAD = 5;
  const MAX_SLOTS_PER_DAY = 6;

  const todayStr = israelDateStr(new Date());
  const groups: UpcomingSlotGroup[] = [];

  for (let i = 0; i < DAYS_AHEAD; i++) {
    const dateStr = addDays(todayStr, i);

    const allSlots = await getAvailableSlots({
      businessId: business.id,
      date: dateStr,
      serviceId,
    });

    const daySlots = allSlots.slice(0, MAX_SLOTS_PER_DAY);
    if (daySlots.length > 0) {
      groups.push({ label: dateLabel(dateStr, i), date: dateStr, slots: daySlots });
    }
  }

  return NextResponse.json({ groups });
}
