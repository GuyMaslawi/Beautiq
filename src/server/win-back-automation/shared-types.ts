// Shared types for win-back automation — imported by both server and client code.
// Must NOT import server-only modules (Prisma, etc.) or use "use server".

export interface BlockedClientPreview {
  id: string;
  fullName: string;
  maskedPhone: string;
}

export interface BlockedClientsByReason {
  invalidPhone: BlockedClientPreview[];
  unsubscribed: BlockedClientPreview[];
  noOptIn: BlockedClientPreview[];
  noMarketingOptIn: BlockedClientPreview[];
  hasFutureBooking: BlockedClientPreview[];
  inCooldown: BlockedClientPreview[];
  noCompletedBooking: BlockedClientPreview[];
  counts: {
    total: number;
    eligible: number;
    invalidPhone: number;
    unsubscribed: number;
    noOptIn: number;
    noMarketingOptIn: number;
    hasFutureBooking: number;
    inCooldown: number;
    noCompletedBooking: number;
  };
}

export interface EligibleClientPreview {
  name: string;
  maskedPhone: string;
  lastService: string;
  daysSinceLastVisit: number;
}

export interface EligibilityBreakdownResult {
  total: number;
  eligible: number;
  noCompletedBooking: number;
  hasFutureBooking: number;
  noOptIn: number;
  invalidPhone: number;
  inCooldown: number;
  /** Admin override: how many cooldown clients were included instead of skipped */
  cooldownOverrideCount: number;
}

export interface EligibilityCheckResult {
  success: boolean;
  error?: string;
  automationEnabled: boolean;
  whatsappConnected: boolean;
  realSendConfigured: boolean;
  testModeActive: boolean;
  /** True when eligibility for this check was computed in minute-based test mode. */
  minuteModeActive: boolean;
  /** Masked last-4 of WHATSAPP_TEST_PHONE, present only when testModeActive */
  maskedTestPhone?: string;
  breakdown: EligibilityBreakdownResult | null;
  eligibleClients: EligibleClientPreview[];
  /** Per-client priority-based blocking reason breakdown */
  blockedClients: BlockedClientsByReason | null;
}

export interface ManualRunMessageResult {
  clientId: string;
  clientName: string;
  maskedPhone: string;
  status: string;
  failureReason: string | null;
}

export interface ManualRunResult {
  success: boolean;
  error?: string;
  runId?: string;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  mockSkipCount: number;
  isMockMode: boolean;
  isTestMode: boolean;
  /** Masked last-4 of WHATSAPP_TEST_PHONE, present only when isTestMode */
  maskedTestPhone?: string;
  messages: ManualRunMessageResult[];
}
