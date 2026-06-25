import { prisma } from "@/server/db/prisma";
import {
  DEV_MOCK_SKIP_REASON,
  TEST_MODE_BLOCKED_REASON,
} from "@/lib/whatsapp/provider";

/**
 * Admin-only WhatsApp message log.
 *
 * Unlike the owner-facing log and the "last manual sends" summary, this surfaces
 * EVERY recent message for a single business regardless of source (cron,
 * manual, retry) and classifies each into a clear launch-QA outcome so a
 * platform admin can see at a glance what actually happened: delivered, failed
 * with a provider error, blocked by test mode, skipped for an invalid phone,
 * missing template, opt-out, etc.
 *
 * Always scoped by businessId. Phone numbers are masked. No secrets, tokens or
 * raw message bodies are returned.
 */

export type MessageOutcome =
  | "sent"
  | "delivered"
  | "read"
  | "queued"
  | "failed"
  | "test_mode_blocked"
  | "invalid_phone"
  | "missing_template"
  | "opted_out"
  | "dev_mock"
  | "skipped";

export interface AdminMessageLogEntry {
  id: string;
  createdAt: Date;
  clientName: string;
  type: string;
  source: string | null;
  status: string;
  outcome: MessageOutcome;
  failureReason: string | null;
  maskedPhone: string;
  templateId: string | null;
  providerMessageId: string | null;
  retryCount: number;
}

export interface AdminMessageLog {
  entries: AdminMessageLogEntry[];
  /** Counts by outcome across the returned window. */
  summary: Record<MessageOutcome, number>;
  total: number;
}

function maskPhoneForLog(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.length < 7) return "***";
  return d.slice(0, 3) + "***" + d.slice(-3);
}

/**
 * Map a stored (status, failureReason) pair to a clear admin-facing outcome.
 * The reason strings are the exact constants written by the send runners, so
 * matching is deterministic.
 */
function classifyOutcome(
  status: string,
  failureReason: string | null,
): MessageOutcome {
  if (status === "sent") return "sent";
  if (status === "delivered") return "delivered";
  if (status === "read") return "read";
  if (status === "queued") return "queued";

  const reason = failureReason ?? "";

  if (status === "skipped") {
    if (reason === TEST_MODE_BLOCKED_REASON) return "test_mode_blocked";
    if (reason === DEV_MOCK_SKIP_REASON) return "dev_mock";
    if (reason.includes("טלפון")) return "invalid_phone";
    if (reason.includes("תבנית")) return "missing_template";
    if (reason.includes("מעוניינת") || reason.includes("אישרה")) return "opted_out";
    return "skipped";
  }

  // status === "failed"
  if (reason === TEST_MODE_BLOCKED_REASON) return "test_mode_blocked";
  if (reason.includes("טלפון")) return "invalid_phone";
  if (reason.includes("תבנית")) return "missing_template";
  return "failed";
}

const EMPTY_SUMMARY: Record<MessageOutcome, number> = {
  sent: 0,
  delivered: 0,
  read: 0,
  queued: 0,
  failed: 0,
  test_mode_blocked: 0,
  invalid_phone: 0,
  missing_template: 0,
  opted_out: 0,
  dev_mock: 0,
  skipped: 0,
};

export async function getAdminMessageLog(
  businessId: string,
  limit = 25,
): Promise<AdminMessageLog> {
  const msgs = await prisma.automationMessage.findMany({
    where: { businessId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      createdAt: true,
      type: true,
      source: true,
      status: true,
      failureReason: true,
      phone: true,
      templateId: true,
      providerMessageId: true,
      retryCount: true,
      client: { select: { fullName: true } },
    },
  });

  const summary: Record<MessageOutcome, number> = { ...EMPTY_SUMMARY };

  const entries: AdminMessageLogEntry[] = msgs.map((m) => {
    const outcome = classifyOutcome(m.status, m.failureReason);
    summary[outcome] += 1;
    return {
      id: m.id,
      createdAt: m.createdAt,
      clientName: m.client.fullName,
      type: m.type,
      source: m.source,
      status: m.status,
      outcome,
      failureReason: m.failureReason,
      maskedPhone: maskPhoneForLog(m.phone),
      templateId: m.templateId,
      providerMessageId: m.providerMessageId,
      retryCount: m.retryCount,
    };
  });

  return { entries, summary, total: entries.length };
}
