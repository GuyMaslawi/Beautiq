import { NextRequest, NextResponse } from "next/server";
import { getCurrentBusiness } from "@/server/auth/session";
import { getAvailableSlots } from "@/server/availability/get-available-slots";

export async function GET(req: NextRequest) {
  const business = await getCurrentBusiness();
  if (!business) {
    return NextResponse.json({ slots: [] }, { status: 401 });
  }

  const date = req.nextUrl.searchParams.get("date");
  const serviceId = req.nextUrl.searchParams.get("serviceId");

  if (!date || !serviceId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ slots: [] });
  }

  const slots = await getAvailableSlots({
    businessId: business.id,
    date,
    serviceId,
  });

  return NextResponse.json({ slots });
}
