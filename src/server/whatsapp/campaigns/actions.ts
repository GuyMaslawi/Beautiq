"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db/prisma";
import { requireCurrentUser, getCurrentBusiness } from "@/server/auth/session";
import { maskPhone } from "@/lib/phone";
import { WA_CAMPAIGNS } from "@/lib/constants/whatsapp-campaigns";
import {
  buildCampaignAudience,
  type AudienceInput,
  type ExclusionReason,
} from "./eligibility";
import {
  getMarketingCampaignTemplate,
  buildCampaignVariables,
  renderCampaignPreview,
} from "./template";
import { processCampaignBatch, getCampaignCounts, type CampaignCounts } from "./processor";
import { getCampaignDetail, type CampaignDetail } from "./queries";

// ---------------------------------------------------------------------------
// Shared auth helper — resolves the current user + their business together.
// businessId ALWAYS comes from the session, never from client input.
// ---------------------------------------------------------------------------

async function requireUserAndBusiness() {
  const user = await requireCurrentUser();
  const business = await getCurrentBusiness();
  if (!business) throw new Error("no_business");
  return { user, business, tenant: { businessId: business.id } };
}

function reasonLabel(reason: ExclusionReason): string {
  return WA_CAMPAIGNS.reasons[reason];
}

// ---------------------------------------------------------------------------
// Preview audience — read-only. Computes eligibility server-side.
// ---------------------------------------------------------------------------

export interface CampaignPreviewResult {
  ok: boolean;
  error?: string;
  counts?: {
    totalSelected: number;
    eligible: number;
    excluded: number;
  };
  excluded?: Array<{ clientName: string; maskedPhone: string; reason: string }>;
  template?: {
    label: string;
    status: string;
    available: boolean;
    preview: string;
    variableNames: string[];
  };
}

export async function previewCampaignAudienceAction(
  input: AudienceInput,
  payload?: Record<string, string> | null,
): Promise<CampaignPreviewResult> {
  const { business, tenant } = await requireUserAndBusiness();

  const [audience, template] = await Promise.all([
    buildCampaignAudience(tenant, input),
    getMarketingCampaignTemplate(business.id),
  ]);

  // Build an example preview for the first eligible client (or a generic sample).
  const sample = audience.eligible[0];
  const previewVars = buildCampaignVariables(template, {
    clientFullName: sample?.fullName ?? "נועה",
    businessName: business.name,
    payload: payload ?? undefined,
  });

  return {
    ok: true,
    counts: {
      totalSelected: audience.counts.totalSelected,
      eligible: audience.counts.eligible,
      excluded: audience.counts.excluded,
    },
    excluded: audience.excluded.map((r) => ({
      clientName: r.fullName,
      maskedPhone: maskPhone(r.normalizedPhone),
      reason: reasonLabel(r.classification as ExclusionReason),
    })),
    template: {
      label: template.label,
      status: template.status,
      available: template.available,
      preview: renderCampaignPreview(template, previewVars),
      variableNames: template.variableNames,
    },
  };
}

// ---------------------------------------------------------------------------
// List candidates for manual selection — scoped, with per-client eligibility.
// ---------------------------------------------------------------------------

export interface CampaignCandidate {
  clientId: string;
  clientName: string;
  maskedPhone: string;
  eligible: boolean;
  reason?: string;
}

export async function listCampaignCandidatesAction(
  filters?: AudienceInput["filters"],
): Promise<{ ok: boolean; candidates: CampaignCandidate[] }> {
  const { tenant } = await requireUserAndBusiness();
  const audience = await buildCampaignAudience(tenant, { mode: "all_eligible", filters });
  return {
    ok: true,
    candidates: audience.all.map((r) => ({
      clientId: r.clientId,
      clientName: r.fullName,
      maskedPhone: maskPhone(r.normalizedPhone),
      eligible: r.classification === "eligible",
      reason:
        r.classification === "eligible"
          ? undefined
          : reasonLabel(r.classification as ExclusionReason),
    })),
  };
}

// ---------------------------------------------------------------------------
// Create campaign — snapshots eligible recipients in a transaction. Idempotent.
// ---------------------------------------------------------------------------

export interface CreateCampaignInput {
  audience: AudienceInput;
  payload?: Record<string, string> | null;
  audienceSummary?: string;
  /** Client-generated key to make a double-click idempotent. */
  idempotencyKey?: string;
}

export interface CreateCampaignResult {
  ok: boolean;
  campaignId?: string;
  error?: string;
}

export async function createCampaignAction(
  input: CreateCampaignInput,
): Promise<CreateCampaignResult> {
  const { user, business, tenant } = await requireUserAndBusiness();

  const template = await getMarketingCampaignTemplate(business.id);
  if (!template.available) {
    return { ok: false, error: WA_CAMPAIGNS.errors.templateUnavailable };
  }

  // Idempotency: return the existing campaign if this key was already used.
  if (input.idempotencyKey) {
    const existing = await prisma.whatsAppCampaign.findFirst({
      where: { businessId: business.id, idempotencyKey: input.idempotencyKey },
      select: { id: true },
    });
    if (existing) return { ok: true, campaignId: existing.id };
  }

  const audience = await buildCampaignAudience(tenant, input.audience);
  if (audience.eligible.length === 0) {
    return { ok: false, error: WA_CAMPAIGNS.errors.noEligible };
  }

  try {
    const campaign = await prisma.$transaction(async (tx) => {
      const created = await tx.whatsAppCampaign.create({
        data: {
          businessId: business.id,
          createdByUserId: user.id,
          templateName: template.name,
          templateLanguage: template.language,
          templateCategory: "MARKETING",
          variablePayload: input.payload ?? undefined,
          audienceSummary: input.audienceSummary ?? null,
          status: "queued",
          totalSelected: audience.counts.totalSelected,
          totalEligible: audience.counts.eligible,
          idempotencyKey: input.idempotencyKey ?? null,
        },
      });

      // Snapshot ALL classified recipients: eligible → queued; excluded → skipped
      // with the exact reason, so the details view can explain every exclusion.
      await tx.whatsAppCampaignRecipient.createMany({
        data: audience.all.map((r) => ({
          campaignId: created.id,
          businessId: business.id,
          clientId: r.clientId,
          normalizedPhone: r.normalizedPhone,
          status: r.classification === "eligible" ? "queued" : "skipped",
          skipReason:
            r.classification === "eligible"
              ? null
              : reasonLabel(r.classification as ExclusionReason),
        })),
      });

      return created;
    });

    revalidatePath("/clients");
    return { ok: true, campaignId: campaign.id };
  } catch (err) {
    // Unique (businessId, idempotencyKey) violation from a concurrent double-submit.
    if (input.idempotencyKey) {
      const existing = await prisma.whatsAppCampaign.findFirst({
        where: { businessId: business.id, idempotencyKey: input.idempotencyKey },
        select: { id: true },
      });
      if (existing) return { ok: true, campaignId: existing.id };
    }
    console.error(
      `[whatsapp-campaign] create failed — businessId=${business.id} err=${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    return { ok: false, error: WA_CAMPAIGNS.errors.generic };
  }
}

// ---------------------------------------------------------------------------
// Process one batch (owner-driven, for live progress). Scoped to the business.
// ---------------------------------------------------------------------------

export interface CampaignProgressResult {
  ok: boolean;
  error?: string;
  status?: string;
  done?: boolean;
  busy?: boolean;
  counts?: CampaignCounts;
}

export async function processCampaignBatchAction(
  campaignId: string,
): Promise<CampaignProgressResult> {
  const { business } = await requireUserAndBusiness();

  // Ensure the campaign belongs to this business before touching it.
  const campaign = await prisma.whatsAppCampaign.findFirst({
    where: { id: campaignId, businessId: business.id },
    select: { id: true },
  });
  if (!campaign) return { ok: false, error: WA_CAMPAIGNS.errors.notFound };

  try {
    const progress = await processCampaignBatch(campaignId, business.id);
    revalidatePath("/clients");
    return {
      ok: true,
      status: progress.status,
      done: progress.done,
      busy: progress.busy,
      counts: progress.counts,
    };
  } catch (err) {
    console.error(
      `[whatsapp-campaign] process failed — campaignId=${campaignId} err=${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    return { ok: false, error: WA_CAMPAIGNS.errors.generic };
  }
}

// ---------------------------------------------------------------------------
// Poll progress (read-only) for the UI.
// ---------------------------------------------------------------------------

export async function getCampaignProgressAction(
  campaignId: string,
): Promise<CampaignProgressResult> {
  const { business } = await requireUserAndBusiness();
  const campaign = await prisma.whatsAppCampaign.findFirst({
    where: { id: campaignId, businessId: business.id },
    select: { status: true },
  });
  if (!campaign) return { ok: false, error: WA_CAMPAIGNS.errors.notFound };

  const counts = await getCampaignCounts(campaignId);
  return {
    ok: true,
    status: campaign.status,
    done: ["completed", "completed_with_errors", "cancelled"].includes(campaign.status),
    counts,
  };
}

// ---------------------------------------------------------------------------
// Campaign detail (recipient-level) — scoped, read-only.
// ---------------------------------------------------------------------------

export async function getCampaignDetailAction(
  campaignId: string,
): Promise<{ ok: boolean; detail?: CampaignDetail; error?: string }> {
  const { tenant } = await requireUserAndBusiness();
  const detail = await getCampaignDetail(tenant, campaignId);
  if (!detail) return { ok: false, error: WA_CAMPAIGNS.errors.notFound };
  return { ok: true, detail };
}

// ---------------------------------------------------------------------------
// Cancel — stops any queued recipients from being sent.
// ---------------------------------------------------------------------------

export async function cancelCampaignAction(
  campaignId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { business } = await requireUserAndBusiness();

  const campaign = await prisma.whatsAppCampaign.findFirst({
    where: { id: campaignId, businessId: business.id },
    select: { id: true, status: true },
  });
  if (!campaign) return { ok: false, error: WA_CAMPAIGNS.errors.notFound };
  if (["completed", "completed_with_errors", "cancelled"].includes(campaign.status)) {
    return { ok: true }; // already terminal
  }

  // Mark still-queued recipients skipped, then cancel the campaign. Already
  // accepted/sent recipients are left intact (their message is out).
  await prisma.$transaction([
    prisma.whatsAppCampaignRecipient.updateMany({
      where: { campaignId, businessId: business.id, status: "queued" },
      data: { status: "skipped", skipReason: WA_CAMPAIGNS.status.cancelled },
    }),
    prisma.whatsAppCampaign.updateMany({
      where: { id: campaignId, businessId: business.id },
      data: { status: "cancelled", lockedAt: null, completedAt: new Date() },
    }),
  ]);

  revalidatePath("/clients");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Retry — re-queue ONLY recipients that failed and never reached Meta (no wamid).
// ---------------------------------------------------------------------------

export async function retryCampaignFailedAction(
  campaignId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { business } = await requireUserAndBusiness();

  const campaign = await prisma.whatsAppCampaign.findFirst({
    where: { id: campaignId, businessId: business.id },
    select: { id: true },
  });
  if (!campaign) return { ok: false, error: WA_CAMPAIGNS.errors.notFound };

  const requeued = await prisma.whatsAppCampaignRecipient.updateMany({
    // Never retry a recipient that already reached an accepted/wamid state.
    where: {
      campaignId,
      businessId: business.id,
      status: "failed",
      metaMessageId: null,
    },
    data: {
      status: "queued",
      errorCode: null,
      errorSubcode: null,
      errorMessage: null,
      failedAt: null,
    },
  });

  if (requeued.count > 0) {
    // Re-activate the campaign so a worker (owner-driven or cron) actually sends
    // the re-queued recipients. This MUST include "cancelled": cancelling only
    // flips still-queued recipients to skipped and leaves already-failed rows as
    // failed, so a cancelled campaign can still expose the retry action — without
    // this the recipients would sit in "queued" forever (cron only selects
    // queued/processing campaigns).
    await prisma.whatsAppCampaign.updateMany({
      where: {
        id: campaignId,
        businessId: business.id,
        status: { in: ["completed", "completed_with_errors", "cancelled"] },
      },
      data: { status: "queued", completedAt: null, lockedAt: null },
    });
  }

  revalidatePath("/clients");
  return { ok: true };
}
