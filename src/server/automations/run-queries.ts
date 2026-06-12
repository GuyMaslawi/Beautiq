import { prisma } from "@/server/db/prisma";
import type { TenantContext } from "@/server/db/tenant";

export interface SkippedReasonCount {
  reason: string;
  count: number;
}

export interface LastRunSummary {
  id: string;
  startedAt: Date;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  skippedReasons: SkippedReasonCount[];
}

// Map internal failure reasons to owner-friendly Hebrew labels
function toOwnerLabel(reason: string | null): string {
  if (!reason) return "לא נשלח";
  if (reason.includes("מספר טלפון")) return "אין מספר טלפון";
  if (reason.includes("הסירה") || reason.includes("unsubscrib") || reason.includes("מעוניינת בקבלת הודעות")) return "ביקשה להסיר מרשימה";
  if (reason.includes("שיווקי")) return "לא אישרה שיווקיות";
  if (reason.includes("לא אישרה קבלת הודעות")) return "לא אישרה הודעות";
  if (reason.includes("תור עתידי")) return "יש תור עתידי";
  if (reason.includes("נשלחה הודעה לאחרונה") || reason.includes("cooldown") || reason.includes("המתנה")) return "נשלחה הודעה לאחרונה";
  if (reason.includes("פיתוח") || reason.toLowerCase().includes("mock")) return "מצב פיתוח";
  if (reason.includes("בדיקה") || reason.toLowerCase().includes("test_mode")) return "מצב בדיקה";
  if (reason.includes("חיבור WhatsApp")) return "חיבור WhatsApp לא מוגדר";
  return "לא נשלח";
}

export async function getLastAutomationRun(
  tenant: TenantContext,
  type: string,
): Promise<LastRunSummary | null> {
  const run = await prisma.automationRun.findFirst({
    where: { businessId: tenant.businessId, type: type as never },
    orderBy: { startedAt: "desc" },
    select: {
      id: true,
      startedAt: true,
      sentCount: true,
      failedCount: true,
      skippedCount: true,
    },
  });
  if (!run) return null;

  const notSentMessages = await prisma.automationMessage.findMany({
    where: {
      runId: run.id,
      status: { in: ["skipped", "failed"] },
    },
    select: { failureReason: true },
  });

  const reasonCounts = new Map<string, number>();
  for (const msg of notSentMessages) {
    const label = toOwnerLabel(msg.failureReason);
    reasonCounts.set(label, (reasonCounts.get(label) ?? 0) + 1);
  }

  const skippedReasons: SkippedReasonCount[] = Array.from(reasonCounts.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);

  return {
    id: run.id,
    startedAt: run.startedAt,
    sentCount: run.sentCount,
    failedCount: run.failedCount,
    skippedCount: run.skippedCount,
    skippedReasons,
  };
}
