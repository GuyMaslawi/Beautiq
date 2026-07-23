/**
 * Throttled "last active" tracker.
 *
 * touchLastSeen() records that a user was seen, but writes at most once per
 * THRESHOLD window so it stays a cheap heartbeat rather than a per-request write.
 * Called fire-and-forget from getCurrentUser(); failures are swallowed.
 *
 * Server-only.
 */

import { prisma } from "@/server/db/prisma";

const THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

export async function touchLastSeen(
  userId: string,
  current: Date | null,
): Promise<void> {
  try {
    if (current && Date.now() - current.getTime() < THRESHOLD_MS) return;
    await prisma.user.update({
      where: { id: userId },
      data: { lastSeenAt: new Date() },
    });
  } catch {
    // Best-effort heartbeat.
  }
}
