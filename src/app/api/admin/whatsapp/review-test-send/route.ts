import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { getCurrentUser, getCurrentBusiness } from "@/server/auth/session";
import { sendReviewDemoTestMessage } from "@/server/whatsapp/review-demo";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/admin/whatsapp/review-test-send
 *
 * Platform-admin-only. Sends a single approved WhatsApp template message to the
 * configured test recipient (WHATSAPP_TEST_PHONE) for a controlled Meta App
 * Review demo. The send is fully guarded server-side by sendReviewDemoTestMessage
 * — it is refused unless every real-send guard passes, and it never fakes a send
 * or returns secrets.
 *
 * Body (optional JSON):
 *   { "businessId": "..." }  — target a specific business (must exist)
 *   {}                       — use the current admin's own business
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let businessId: string | undefined;
  try {
    const body = await request.json().catch(() => ({}));
    if (body && typeof body.businessId === "string") {
      businessId = body.businessId;
    }
  } catch {
    // no body
  }

  if (businessId) {
    // Validate the business exists (keeps the action business-scoped).
    const exists = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true },
    });
    if (!exists) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }
  } else {
    const business = await getCurrentBusiness();
    if (!business) {
      return NextResponse.json({ error: "No business" }, { status: 400 });
    }
    businessId = business.id;
  }

  const result = await sendReviewDemoTestMessage(businessId);
  // result never contains secrets — safe to return as-is.
  return NextResponse.json(result, { status: result.blocked ? 409 : 200 });
}
