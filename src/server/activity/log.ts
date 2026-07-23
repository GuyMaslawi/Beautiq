/**
 * Central activity logger — the single entry point for the platform audit trail.
 *
 * Every meaningful action funnels through logActivity(), which writes one
 * append-only ActivityLog row. It is BEST-EFFORT by design: any failure is
 * swallowed so telemetry can never break the originating request. Callers pass a
 * stable `action` key + a Hebrew `summary`; the actor (userId/actorType) is
 * auto-resolved from the session unless supplied explicitly.
 *
 * Server-only.
 */

import type { Prisma, ActivityActorType, ActivityCategory } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { getCurrentUser } from "@/server/auth/session";

export interface LogActivityInput {
  /** Stable machine key, e.g. "booking.create". */
  action: string;
  category: ActivityCategory;
  /** Human-readable Hebrew summary for the admin feed. */
  summary: string;
  /** Tenant scope; omit/null for account- or platform-level actions. */
  businessId?: string | null;
  /**
   * Acting user. `undefined` → auto-resolve from the session. Pass `null`
   * explicitly for anonymous / public / system actions.
   */
  userId?: string | null;
  /** Defaults to admin/owner based on the resolved user, or "system". */
  actorType?: ActivityActorType;
  metadata?: Record<string, unknown>;
}

export async function logActivity(input: LogActivityInput): Promise<void> {
  try {
    let userId = input.userId;
    let actorType = input.actorType;

    if (userId === undefined) {
      const user = await getCurrentUser();
      userId = user?.id ?? null;
      if (!actorType) actorType = user?.isAdmin ? "admin" : "owner";
    }

    await prisma.activityLog.create({
      data: {
        businessId: input.businessId ?? null,
        userId: userId ?? null,
        actorType: actorType ?? "owner",
        category: input.category,
        action: input.action,
        summary: input.summary,
        metadata: (input.metadata as Prisma.InputJsonValue) ?? undefined,
      },
    });
  } catch {
    // Best-effort: never let telemetry break the real request.
  }
}
