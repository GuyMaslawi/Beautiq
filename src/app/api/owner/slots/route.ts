import { NextRequest, NextResponse } from "next/server";
import { getCurrentBusiness } from "@/server/auth/session";
import { getDayAvailability } from "@/server/availability/get-available-slots";

export async function GET(req: NextRequest) {
  const business = await getCurrentBusiness();
  if (!business) {
    // 401 (not a silent empty list) so the client can surface a real error
    // instead of masking it as "no available times".
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const date = req.nextUrl.searchParams.get("date");
  const serviceId = req.nextUrl.searchParams.get("serviceId");

  if (!date || !serviceId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
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
