import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ExternalLink, Users2 } from "lucide-react";
import { requirePlatformAdmin } from "@/server/admin/auth";
import { getCurrentUser } from "@/server/auth/session";
import {
  getAdminBusiness,
  getAdminBusinessDeletionSummary,
} from "@/server/admin/queries";
import { getAdminBusinessProfile } from "@/server/admin/business-profile";
import { BusinessDossier } from "./_components/business-dossier";
import { getAdminAutomationInfo } from "@/server/win-back-automation/queries";
import { getAdminMessageLog } from "@/server/admin/message-log";
import { Card } from "@/components/ui/card";
import { AdminMessageLogPanel } from "./_components/message-log";
import { SubscriptionForm } from "./_components/subscription-form";
import { RunWinBackButton } from "./_components/run-win-back-button";
import { WhatsAppAdminPanel } from "./_components/whatsapp-admin-panel";
import { BusinessDangerZone } from "./_components/business-danger-zone";
import { AdminBusinessEditPanel } from "./_components/business-edit-panel";
import { ImpersonateButton } from "./_components/impersonate-button";
import { GodControls } from "./_components/god-controls";
import type { SubscriptionStatus, SubscriptionPlan } from "@prisma/client";

const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  trial: "בתקופת ניסיון",
  active: "פעיל",
  discounted: "בהנחה",
  suspended: "מושהה",
  cancelled: "בוטל",
  pending_payment: "ממתין לתשלום",
};

const STATUS_STYLES: Record<SubscriptionStatus, { color: string; bg: string }> = {
  trial: { color: "var(--mauve)", bg: "var(--mauve-light)" },
  active: { color: "var(--success)", bg: "var(--success-light)" },
  discounted: { color: "var(--accent)", bg: "var(--accent-light)" },
  suspended: { color: "var(--warning)", bg: "var(--warning-light)" },
  cancelled: { color: "var(--error)", bg: "var(--error-light)" },
  pending_payment: { color: "var(--warning)", bg: "var(--warning-light)" },
};

const PLAN_LABELS: Record<SubscriptionPlan, string> = {
  basic: "בסיס",
  pro: "פרו",
};

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 border-b border-border/70 py-2.5 last:border-0">
      <span className="w-32 shrink-0 text-xs font-semibold text-muted">
        {label}
      </span>
      <span className="text-sm text-foreground">{value ?? "—"}</span>
    </div>
  );
}

function OnOffValue({ on, onLabel, offLabel }: { on: boolean; onLabel: string; offLabel: string }) {
  return (
    <span
      className="font-semibold"
      style={{ color: on ? "var(--success)" : "var(--muted-light)" }}
    >
      {on ? onLabel : offLabel}
    </span>
  );
}

export default async function AdminBusinessDetailPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  await requirePlatformAdmin();
  const { businessId } = await params;

  const [biz, profile, automationInfo, messageLog, deletionSummary, admin] =
    await Promise.all([
      getAdminBusiness(businessId),
      getAdminBusinessProfile(businessId),
      getAdminAutomationInfo(businessId),
      getAdminMessageLog(businessId, 25),
      getAdminBusinessDeletionSummary(businessId),
      getCurrentUser(),
    ]);

  if (!biz) notFound();

  // Whether the owner User account is safe to delete alongside the business, and
  // a Hebrew reason when it is not (mirrors the server-side guards exactly).
  let ownerDeletable = false;
  let ownerBlockReason: string | null = null;
  if (deletionSummary) {
    if (!deletionSummary.ownerId) {
      ownerBlockReason = "לא נמצא בעלים לעסק זה — ניתן למחוק את העסק בלבד.";
    } else if (deletionSummary.ownerIsAdmin) {
      ownerBlockReason = "הבעלים הוא מנהל פלטפורמה — לא ניתן למחוק את חשבון המשתמש.";
    } else if (admin && deletionSummary.ownerId === admin.id) {
      ownerBlockReason = "לא ניתן למחוק את חשבון המשתמש שלך.";
    } else if (!deletionSummary.ownerCanBeDeleted) {
      ownerBlockReason = `הבעלים מקושר לעוד ${deletionSummary.ownerOtherBusinessCount} עסקים — ניתן למחוק את העסק בלבד.`;
    } else {
      ownerDeletable = true;
    }
  }

  const owner = biz.members[0]?.user;
  const sub = biz.subscription;
  const status: SubscriptionStatus = sub?.status ?? "trial";
  const plan: SubscriptionPlan = sub?.plan ?? "basic";
  const statusStyle = STATUS_STYLES[status];

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/admin/businesses"
          className="flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-background-alt hover:text-foreground"
        >
          <ArrowRight className="h-3.5 w-3.5" />
          חזרה לרשימה
        </Link>
        <Link
          href={`/admin/businesses/${biz.id}/clients`}
          className="bg-brand-gradient flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          <Users2 className="h-3.5 w-3.5" />
          לקוחות העסק ({biz._count.clients})
        </Link>
        <a
          href={`/b/${biz.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-background-alt hover:text-foreground"
        >
          עמוד ההזמנות
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
        {owner && owner.id !== admin?.id && !deletionSummary?.ownerIsAdmin && (
          <ImpersonateButton
            userId={owner.id}
            ownerLabel={owner.name ?? owner.email}
          />
        )}
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow text-primary">ניהול עסקים</p>
          <h1 className="font-display mt-1 text-2xl font-semibold tracking-tight text-foreground">
            {biz.name}
          </h1>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="text-sm text-muted">/{biz.slug}</span>
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
              style={{ background: statusStyle.bg, color: statusStyle.color }}
            >
              {STATUS_LABELS[status]}
            </span>
            <span className="rounded bg-background-alt px-1.5 py-0.5 text-xs font-semibold text-foreground-soft">
              {PLAN_LABELS[plan]}
            </span>
          </div>
        </div>
      </div>
      <div className="editorial-rule" />

      {/* 360° business dossier — revenue, forecast, usage, activity */}
      {profile && <BusinessDossier profile={profile} />}

      {/* Editable business / public page / owner details */}
      <AdminBusinessEditPanel
        businessId={biz.id}
        business={{
          name: biz.name,
          slug: biz.slug,
          phone: biz.phone,
          description: biz.description,
          timezone: biz.timezone,
          city: biz.city,
          area: biz.area,
          addressNote: biz.addressNote,
          logoUrl: biz.logoUrl,
          coverImageUrl: biz.coverImageUrl,
          instagramUrl: biz.instagramUrl,
          facebookUrl: biz.facebookUrl,
          brandColor: biz.brandColor,
          introMessage: biz.introMessage,
          showServices: biz.showServices,
          showPrices: biz.showPrices,
          showHours: biz.showHours,
          showReviews: biz.showReviews,
          showGallery: biz.showGallery,
          showPhone: biz.showPhone,
          showAddress: biz.showAddress,
        }}
        owner={owner ? { name: owner.name, email: owner.email } : null}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* WhatsApp automation info */}
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-bold text-foreground">
            אוטומציית WhatsApp
          </h2>
          <InfoRow label="ספק" value={automationInfo.provider ?? "dev_mock"} />
          <InfoRow
            label="חיבור WhatsApp"
            value={
              <OnOffValue
                on={automationInfo.whatsappConnected}
                onLabel="מחובר"
                offLabel="לא מחובר"
              />
            }
          />
          {automationInfo.phoneNumber && (
            <InfoRow label="מספר WhatsApp" value={automationInfo.phoneNumber} />
          )}
          <InfoRow
            label="שליחה אמיתית"
            value={
              <OnOffValue
                on={automationInfo.realSendEnabled}
                onLabel="מופעלת"
                offLabel="כבויה (מצב פיתוח)"
              />
            }
          />
          <InfoRow
            label="אישורי Meta"
            value={
              <OnOffValue
                on={automationInfo.credentialsConfigured}
                onLabel="מוגדרים"
                offLabel="לא מוגדרים"
              />
            }
          />
          <InfoRow
            label="תבנית מאושרת"
            value={
              <OnOffValue
                on={automationInfo.templateConfigured}
                onLabel="מוגדרת"
                offLabel="לא מוגדרת"
              />
            }
          />
          <InfoRow
            label="אוטומציה"
            value={
              <OnOffValue
                on={automationInfo.automationEnabled}
                onLabel="פעילה"
                offLabel="כבויה"
              />
            }
          />
          <InfoRow label="נשלחו בפועל החודש (אוטומציה)" value={automationInfo.realSentThisMonth} />
          <InfoRow label="נשלחו ידנית החודש" value={automationInfo.manualSentThisMonth} />
          {automationInfo.mockRunsThisMonth > 0 && (
            <InfoRow
              label="הרצות בדיקה החודש"
              value={
                <span style={{ color: "var(--warning)" }}>
                  {automationInfo.mockRunsThisMonth} (לא נשלח בפועל)
                </span>
              }
            />
          )}
          {automationInfo.failedThisMonth > 0 && (
            <InfoRow
              label="נכשלו החודש"
              value={
                <span style={{ color: "var(--error)" }}>
                  {automationInfo.failedThisMonth}
                </span>
              }
            />
          )}
          {automationInfo.skippedThisMonth > 0 && (
            <InfoRow label="דולגו החודש" value={automationInfo.skippedThisMonth} />
          )}
          <InfoRow
            label="ריצה אחרונה"
            value={
              automationInfo.lastRunAt
                ? new Date(automationInfo.lastRunAt).toLocaleDateString("he-IL", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })
                : "טרם הופעלה"
            }
          />
          {automationInfo.lastFailureReason && (
            <InfoRow
              label="סיבת כישלון אחרונה"
              value={
                <span className="text-xs" style={{ color: "var(--error)" }}>
                  {automationInfo.lastFailureReason}
                </span>
              }
            />
          )}
          <InfoRow
            label="Webhook אחרון"
            value={
              automationInfo.lastWebhookReceivedAt
                ? new Date(automationInfo.lastWebhookReceivedAt).toLocaleString("he-IL", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "טרם התקבל"
            }
          />
          <InfoRow
            label="מסירה אחרונה"
            value={
              automationInfo.lastDeliveryEventAt
                ? new Date(automationInfo.lastDeliveryEventAt).toLocaleString("he-IL", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "—"
            }
          />
          <InfoRow
            label="קריאה אחרונה"
            value={
              automationInfo.lastReadEventAt
                ? new Date(automationInfo.lastReadEventAt).toLocaleString("he-IL", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "—"
            }
          />
        </Card>

        {/* Current subscription summary */}
        {sub && (
          <Card className="p-5">
            <h2 className="mb-3 text-sm font-bold text-foreground">מנוי נוכחי</h2>
            <InfoRow label="תוכנית" value={`${PLAN_LABELS[plan]} — ₪${Number(sub.monthlyPrice).toLocaleString("he-IL")}/חודש`} />
            <InfoRow label="סטטוס" value={STATUS_LABELS[status]} />
            {sub.discountType !== "none" && (
              <>
                <InfoRow
                  label="הנחה"
                  value={
                    sub.discountType === "fixed"
                      ? `₪${Number(sub.discountValue ?? 0).toLocaleString("he-IL")}`
                      : `${Number(sub.discountValue ?? 0)}%`
                  }
                />
                {sub.discountNote && (
                  <InfoRow label="הערת הנחה" value={sub.discountNote} />
                )}
              </>
            )}
            {sub.trialStartedAt && (
              <InfoRow
                label="תחילת ניסיון"
                value={new Date(sub.trialStartedAt).toLocaleDateString("he-IL")}
              />
            )}
            {sub.trialEndsAt && (
              <InfoRow
                label="סיום ניסיון"
                value={new Date(sub.trialEndsAt).toLocaleDateString("he-IL")}
              />
            )}
            {sub.adminNotes && (
              <div
                className="mt-3 rounded-xl border p-3"
                style={{
                  background: "var(--warning-light)",
                  borderColor: "color-mix(in srgb, var(--warning) 30%, transparent)",
                }}
              >
                <p className="text-xs font-semibold" style={{ color: "var(--warning)" }}>
                  הערות פנימיות
                </p>
                <p className="mt-1 text-sm text-foreground-soft">{sub.adminNotes}</p>
              </div>
            )}
          </Card>
        )}
      </div>

      {/* WhatsApp admin panel — connect + diagnostic */}
      <Card className="p-6">
        <h2 className="mb-1 text-sm font-bold text-foreground">
          ניהול חיבור WhatsApp
        </h2>
        <WhatsAppAdminPanel businessId={biz.id} />
      </Card>

      {/* Full WhatsApp message log — all sources, classified by outcome */}
      <Card className="p-6">
        <h2 className="mb-1 text-sm font-bold text-foreground">
          יומן הודעות WhatsApp
        </h2>
        <p className="mb-4 text-xs text-muted">
          25 ההודעות האחרונות מכל המקורות (אוטומציה, ידני, ניסיון חוזר) — כולל הודעות
          שנחסמו במצב בדיקה, מספרים לא תקינים, תבניות חסרות ושגיאות ספק.
        </p>
        <AdminMessageLogPanel log={messageLog} />
      </Card>

      {/* Win-back manual trigger */}
      <Card className="p-6">
        <h2 className="mb-1 text-sm font-bold text-foreground">
          הפעלת Win-Back ידנית
        </h2>
        <p className="mb-4 text-xs text-muted">
          מריץ את אוטומציית החזרת הלקוחות עבור עסק זה עכשיו, ללא המתנה לשעת הקרון. כל שאר ההגנות (cooldown, test mode) פעילות.
        </p>
        <RunWinBackButton businessId={biz.id} />
      </Card>

      {/* Edit subscription form */}
      <Card className="p-6">
        <h2 className="mb-5 text-sm font-bold text-foreground">
          עדכון מנוי ופרטים פנימיים
        </h2>
        <SubscriptionForm
          businessId={biz.id}
          subscription={
            sub
              ? {
                  plan: sub.plan,
                  status: sub.status,
                  monthlyPrice: Number(sub.monthlyPrice),
                  discountType: sub.discountType,
                  discountValue: sub.discountValue != null ? Number(sub.discountValue) : null,
                  discountNote: sub.discountNote,
                  trialStartedAt: sub.trialStartedAt?.toISOString() ?? null,
                  trialEndsAt: sub.trialEndsAt?.toISOString() ?? null,
                  adminNotes: sub.adminNotes,
                }
              : null
          }
        />
      </Card>

      {/* God-mode controls — plan/access override, password reset, admin role */}
      {owner && (
        <GodControls
          businessId={biz.id}
          owner={{
            id: owner.id,
            name: owner.name,
            email: owner.email,
            plan: owner.plan,
            isAdmin: owner.isAdmin,
            planExpiresAt: owner.planExpiresAt?.toISOString() ?? null,
            suspendedUntil: owner.suspendedUntil?.toISOString() ?? null,
          }}
          isSelf={owner.id === admin?.id}
        />
      )}

      {/* Danger zone — delete business / owner account */}
      {deletionSummary && (
        <BusinessDangerZone
          summary={{
            id: deletionSummary.id,
            name: deletionSummary.name,
            slug: deletionSummary.slug,
            ownerName: deletionSummary.ownerName,
            ownerEmail: deletionSummary.ownerEmail,
            clientCount: deletionSummary.clientCount,
            bookingCount: deletionSummary.bookingCount,
            serviceCount: deletionSummary.serviceCount,
            automationMessageCount: deletionSummary.automationMessageCount,
          }}
          ownerDeletable={ownerDeletable}
          ownerBlockReason={ownerBlockReason}
        />
      )}
    </div>
  );
}
