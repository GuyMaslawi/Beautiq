import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 40;

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

  const date = req.nextUrl.searchParams.get("date");
  const serviceId = req.nextUrl.searchParams.get("serviceId");

  if (!date || !serviceId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ slots: [] });
  }

  const business = await prisma.business.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!business) return NextResponse.json({ slots: [] });

  const service = await prisma.service.findFirst({
    where: { id: serviceId, businessId: business.id, isActive: true },
    select: {
      durationMinutes: true,
      bufferBeforeMinutes: true,
      bufferAfterMinutes: true,
    },
  });
  if (!service) return NextResponse.json({ slots: [] });

  // Parse date locally to get the correct weekday (avoids UTC shift)
  const [y, m, d] = date.split("-").map(Number);
  const weekday = new Date(y, m - 1, d).getDay();

  const rules = await prisma.availabilityRule.findMany({
    where: { businessId: business.id, weekday, isActive: true },
    select: { startMinutes: true, endMinutes: true },
    orderBy: { startMinutes: "asc" },
  });

  if (rules.length === 0) return NextResponse.json({ slots: [] });

  // Fetch all bookings that touch this calendar day
  const dayStart = new Date(`${date}T00:00:00`);
  const dayEnd = new Date(`${date}T23:59:59`);

  const existingBookings = await prisma.booking.findMany({
    where: {
      businessId: business.id,
      status: { in: ["pending", "approved"] },
      AND: [{ startTime: { lt: dayEnd } }, { endTime: { gt: dayStart } }],
    },
    select: { startTime: true, endTime: true },
  });

  const totalDuration =
    service.durationMinutes +
    service.bufferBeforeMinutes +
    service.bufferAfterMinutes;
  const SLOT_STEP = 30;
  const nowMs = Date.now();
  const slots: string[] = [];

  for (const rule of rules) {
    let slotMinutes = rule.startMinutes;
    while (slotMinutes + totalDuration <= rule.endMinutes) {
      const h = Math.floor(slotMinutes / 60).toString().padStart(2, "0");
      const mn = (slotMinutes % 60).toString().padStart(2, "0");
      const slotTime = `${h}:${mn}`;
      const slotStartMs = new Date(`${date}T${slotTime}:00`).getTime();
      const slotEndMs = slotStartMs + totalDuration * 60 * 1000;

      // Skip slots more than 5 minutes in the past
      if (slotStartMs < nowMs - 5 * 60 * 1000) {
        slotMinutes += SLOT_STEP;
        continue;
      }

      const hasConflict = existingBookings.some(
        (b) =>
          b.startTime.getTime() < slotEndMs &&
          b.endTime.getTime() > slotStartMs,
      );

      if (!hasConflict) slots.push(slotTime);
      slotMinutes += SLOT_STEP;
    }
  }

  return NextResponse.json({ slots });
}
