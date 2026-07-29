import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { getAvailableSlots } from "@/server/availability/get-available-slots";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { isValidDateStr } from "@/lib/time";

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

  // isValidDateStr, ולא רק בדיקת תבנית: "2026-99-99" עובר regex ומתגלגל
  // בשקט לתאריך אחר לגמרי.
  if (!date || !serviceId || !isValidDateStr(date)) {
    return NextResponse.json({ slots: [] });
  }

  const business = await prisma.business.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!business) return NextResponse.json({ slots: [] });

  const slots = await getAvailableSlots({
    businessId: business.id,
    date,
    serviceId,
  });

  return NextResponse.json({ slots });
}
