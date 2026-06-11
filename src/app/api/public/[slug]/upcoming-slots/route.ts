import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 40; // generous — slot lookups are read-only

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

function dateLabel(date: Date, idx: number): string {
  if (idx === 0) return "היום";
  if (idx === 1) return "מחר";
  return `יום ${HEBREW_WEEKDAYS[date.getDay()] ?? ""}`;
}

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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

  const service = await prisma.service.findFirst({
    where: { id: serviceId, businessId: business.id, isActive: true },
    select: { durationMinutes: true, bufferBeforeMinutes: true, bufferAfterMinutes: true },
  });
  if (!service) return NextResponse.json({ groups: [] });

  const totalDuration =
    service.durationMinutes + service.bufferBeforeMinutes + service.bufferAfterMinutes;
  const SLOT_STEP = 30;
  const DAYS_AHEAD = 5;
  const MAX_SLOTS_PER_DAY = 6;
  const nowMs = Date.now();

  const groups: UpcomingSlotGroup[] = [];

  for (let i = 0; i < DAYS_AHEAD; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const dateStr = toDateString(d);
    const [y, mo, day] = dateStr.split("-").map(Number);
    const weekday = new Date(y, mo - 1, day).getDay();

    const rules = await prisma.availabilityRule.findMany({
      where: { businessId: business.id, weekday, isActive: true },
      select: { startMinutes: true, endMinutes: true },
      orderBy: { startMinutes: "asc" },
    });

    if (rules.length === 0) continue;

    const dayStart = new Date(`${dateStr}T00:00:00`);
    const dayEnd = new Date(`${dateStr}T23:59:59`);

    const existingBookings = await prisma.booking.findMany({
      where: {
        businessId: business.id,
        status: { in: ["pending", "approved"] },
        AND: [{ startTime: { lt: dayEnd } }, { endTime: { gt: dayStart } }],
      },
      select: { startTime: true, endTime: true },
    });

    const daySlots: string[] = [];
    for (const rule of rules) {
      let slotMinutes = rule.startMinutes;
      while (slotMinutes + totalDuration <= rule.endMinutes && daySlots.length < MAX_SLOTS_PER_DAY) {
        const h = Math.floor(slotMinutes / 60).toString().padStart(2, "0");
        const mn = (slotMinutes % 60).toString().padStart(2, "0");
        const slotTime = `${h}:${mn}`;
        const slotStartMs = new Date(`${dateStr}T${slotTime}:00`).getTime();
        const slotEndMs = slotStartMs + totalDuration * 60 * 1000;

        if (slotStartMs >= nowMs - 5 * 60 * 1000) {
          const hasConflict = existingBookings.some(
            (b) => b.startTime.getTime() < slotEndMs && b.endTime.getTime() > slotStartMs,
          );
          if (!hasConflict) daySlots.push(slotTime);
        }
        slotMinutes += SLOT_STEP;
      }
      if (daySlots.length >= MAX_SLOTS_PER_DAY) break;
    }

    if (daySlots.length > 0) {
      groups.push({ label: dateLabel(d, i), date: dateStr, slots: daySlots });
    }
  }

  return NextResponse.json({ groups });
}
