import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePlatformAdmin } from "@/server/admin/auth";
import { getCurrentUser } from "@/server/auth/session";
import {
  getAdminBusiness,
  getAdminBusinessBookingsThisMonth,
  getAdminBusinessDeletionSummary,
} from "@/server/admin/queries";
import { getAdminAutomationInfo, type AdminManualSendEntry } from "@/server/win-back-automation/queries";
import { SubscriptionForm } from "./_components/subscription-form";
import { RunWinBackButton } from "./_components/run-win-back-button";
import { WhatsAppAdminPanel } from "./_components/whatsapp-admin-panel";
import { BusinessDangerZone } from "./_components/business-danger-zone";
import { AdminBusinessEditPanel } from "./_components/business-edit-panel";
import type { SubscriptionStatus, SubscriptionPlan } from "@prisma/client";

const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  trial: "בתקופת ניסיון",
  active: "פעיל",
  discounted: "בהנחה",
  suspended: "מושהה",
  cancelled: "בוטל",
  pending_payment: "ממתין לתשלום",
};

const STATUS_COLORS: Record<SubscriptionStatus, string> = {
  trial: "#7c3aed",
  active: "#16a34a",
  discounted: "#d97706",
  suspended: "#ea580c",
  cancelled: "#dc2626",
  pending_payment: "#ca8a04",
};

const PLAN_LABELS: Record<SubscriptionPlan, string> = {
  basic: "בסיס",
  pro: "פרו",
};

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  queued:    { label: "ממתין",    color: "#6b7280" },
  sent:      { label: "נשלח ל-Meta", color: "#2563eb" },
  delivered: { label: "נמסר",    color: "#16a34a" },
  read:      { label: "נקרא",    color: "#16a34a" },
  failed:    { label: "נכשל",    color: "#dc2626" },
  skipped:   { label: "דולג",    color: "#9ca3af" },
};

function ManualSendRow({ msg }: { msg: AdminManualSendEntry }) {
  const st = STATUS_LABEL[msg.status] ?? { label: msg.status, color: "#6b7280" };
  const typeLabel = msg.type === "manual" ? "בדיקה/ידני" : msg.type;
  const sourceLabel = msg.source === "manual_admin" ? "אדמין" : "בעל עסק";
  return (
    <div
      className="rounded-xl p-3 text-xs space-y-1.5"
      style={{ background: "rgba(0,0,0,0.025)", border: "1px solid rgba(0,0,0,0.07)" }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold" style={{ color: "#1a1a2e" }}>{msg.clientName}</span>
        <span className="font-semibold" style={{ color: st.color }}>{st.label}</span>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1" style={{ color: "#6b7280" }}>
        <span>
          {new Date(msg.createdAt).toLocaleString("he-IL", {
            day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
          })}
        </span>
        <span>סוג: {typeLabel}</span>
        <span>מקור: {sourceLabel}</span>
        <span dir="ltr">נמען: {msg.maskedPhone}</span>
        {msg.templateId && <span>תבנית: {msg.templateId}</span>}
      </div>
      {msg.providerMessageId && (
        <div style={{ color: "#2563eb" }} dir="ltr">
          מזהה Meta: {msg.providerMessageId}
        </div>
      )}
      {msg.failureReason && (
        <div style={{ color: "#dc2626" }}>סיבת כשל: {msg.failureReason}</div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5" style={{ borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
      <span className="w-32 shrink-0 text-xs font-semibold" style={{ color: "#888" }}>
        {label}
      </span>
      <span className="text-sm" style={{ color: "#1a1a2e" }}>
        {value ?? "—"}
      </span>
    </div>
  );
}

export default async function AdminBusinessDetailPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  await requirePlatformAdmin();
  const { businessId } = await params;

  const [biz, bookingsThisMonth, automationInfo, deletionSummary, admin] = await Promise.all([
    getAdminBusiness(businessId),
    getAdminBusinessBookingsThisMonth(businessId),
    getAdminAutomationInfo(businessId),
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
  const statusColor = STATUS_COLORS[status];

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/admin/businesses"
          className="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
          style={{ background: "#f3f4f6", color: "#555" }}
        >
          ← חזרה לרשימה
        </Link>
        <Link
          href={`/admin/businesses/${biz.id}/clients`}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-80"
          style={{ background: "#1a1a2e" }}
        >
          לקוחות העסק ({biz._count.clients})
        </Link>
        <a
          href={`/b/${biz.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
          style={{ background: "#f3f4f6", color: "#555" }}
        >
          עמוד ההזמנות ↗
        </a>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#1a1a2e" }}>
            {biz.name}
          </h1>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-sm" style={{ color: "#888" }}>
              /{biz.slug}
            </span>
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
              style={{ background: `${statusColor}15`, color: statusColor }}
            >
              {STATUS_LABELS[status]}
            </span>
            <span
              className="rounded px-1.5 py-0.5 text-xs font-semibold"
              style={{ background: "#f3f4f6", color: "#444" }}
            >
              {PLAN_LABELS[plan]}
            </span>
          </div>
        </div>
      </div>

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
          showCancellationPolicy: biz.showCancellationPolicy,
          showPhone: biz.showPhone,
          showAddress: biz.showAddress,
        }}
        owner={owner ? { name: owner.name, email: owner.email } : null}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Usage metrics */}
        <div
          className="rounded-2xl border p-5"
          style={{
            background: "#fff",
            borderColor: "rgba(0,0,0,0.07)",
            boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
          }}
        >
          <h2 className="mb-3 text-sm font-bold" style={{ color: "#1a1a2e" }}>
            נתוני שימוש
          </h2>
          <InfoRow label="לקוחות" value={biz._count.clients} />
          <InfoRow label="תורים סה״כ" value={biz._count.bookings} />
          <InfoRow label="תורים החודש" value={bookingsThisMonth} />
        </div>

        {/* WhatsApp automation info */}
        <div
          className="rounded-2xl border p-5"
          style={{
            background: "#fff",
            borderColor: "rgba(0,0,0,0.07)",
            boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
          }}
        >
          <h2 className="mb-3 text-sm font-bold" style={{ color: "#1a1a2e" }}>
            אוטומציית WhatsApp
          </h2>
          <InfoRow
            label="ספק"
            value={automationInfo.provider ?? "dev_mock"}
          />
          <InfoRow
            label="חיבור WhatsApp"
            value={
              <span
                style={{
                  color: automationInfo.whatsappConnected ? "#16a34a" : "#9ca3af",
                  fontWeight: 600,
                }}
              >
                {automationInfo.whatsappConnected ? "מחובר" : "לא מחובר"}
              </span>
            }
          />
          {automationInfo.phoneNumber && (
            <InfoRow label="מספר WhatsApp" value={automationInfo.phoneNumber} />
          )}
          <InfoRow
            label="שליחה אמיתית"
            value={
              <span style={{ color: automationInfo.realSendEnabled ? "#16a34a" : "#9ca3af", fontWeight: 600 }}>
                {automationInfo.realSendEnabled ? "מופעלת" : "כבויה (מצב פיתוח)"}
              </span>
            }
          />
          <InfoRow
            label="אישורי Meta"
            value={
              <span style={{ color: automationInfo.credentialsConfigured ? "#16a34a" : "#9ca3af", fontWeight: 600 }}>
                {automationInfo.credentialsConfigured ? "מוגדרים" : "לא מוגדרים"}
              </span>
            }
          />
          <InfoRow
            label="תבנית מאושרת"
            value={
              <span style={{ color: automationInfo.templateConfigured ? "#16a34a" : "#9ca3af", fontWeight: 600 }}>
                {automationInfo.templateConfigured ? "מוגדרת" : "לא מוגדרת"}
              </span>
            }
          />
          <InfoRow
            label="אוטומציה"
            value={
              <span
                style={{
                  color: automationInfo.automationEnabled ? "#16a34a" : "#9ca3af",
                  fontWeight: 600,
                }}
              >
                {automationInfo.automationEnabled ? "פעילה" : "כבויה"}
              </span>
            }
          />
          <InfoRow label="נשלחו בפועל החודש (אוטומציה)" value={automationInfo.realSentThisMonth} />
          <InfoRow label="נשלחו ידנית החודש" value={automationInfo.manualSentThisMonth} />
          {automationInfo.mockRunsThisMonth > 0 && (
            <InfoRow
              label="הרצות בדיקה החודש"
              value={
                <span style={{ color: "#7a5800" }}>
                  {automationInfo.mockRunsThisMonth} (לא נשלח בפועל)
                </span>
              }
            />
          )}
          {automationInfo.failedThisMonth > 0 && (
            <InfoRow
              label="נכשלו החודש"
              value={
                <span style={{ color: "#dc2626" }}>
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
                <span className="text-xs" style={{ color: "#dc2626" }}>
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
        </div>

        {/* Current subscription summary */}
        {sub && (
          <div
            className="rounded-2xl border p-5"
            style={{
              background: "#fff",
              borderColor: "rgba(0,0,0,0.07)",
              boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
            }}
          >
            <h2 className="mb-3 text-sm font-bold" style={{ color: "#1a1a2e" }}>
              מנוי נוכחי
            </h2>
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
              <div className="mt-3 rounded-xl p-3" style={{ background: "#fffbeb", border: "1px solid #fde68a" }}>
                <p className="text-xs font-semibold" style={{ color: "#92400e" }}>
                  הערות פנימיות
                </p>
                <p className="mt-1 text-sm" style={{ color: "#78350f" }}>
                  {sub.adminNotes}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* WhatsApp admin panel — connect + diagnostic */}
      <div
        className="rounded-2xl border p-6"
        style={{
          background: "#fff",
          borderColor: "rgba(0,0,0,0.07)",
          boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
        }}
      >
        <h2 className="mb-1 text-sm font-bold" style={{ color: "#1a1a2e" }}>
          ניהול חיבור WhatsApp
        </h2>
        <WhatsAppAdminPanel businessId={biz.id} />
      </div>

      {/* Last manual send attempts */}
      <div
        className="rounded-2xl border p-6"
        style={{
          background: "#fff",
          borderColor: "rgba(0,0,0,0.07)",
          boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
        }}
      >
        <h2 className="mb-4 text-sm font-bold" style={{ color: "#1a1a2e" }}>
          ניסיון שליחה אחרון (WhatsApp ידני)
        </h2>
        {automationInfo.lastManualSends.length === 0 ? (
          <p className="text-sm" style={{ color: "#9ca3af" }}>אין רשומות שליחה ידנית</p>
        ) : (
          <div className="space-y-3">
            {automationInfo.lastManualSends.map((msg: AdminManualSendEntry) => (
              <ManualSendRow key={msg.id} msg={msg} />
            ))}
          </div>
        )}
      </div>

      {/* Win-back manual trigger */}
      <div
        className="rounded-2xl border p-6"
        style={{
          background: "#fff",
          borderColor: "rgba(0,0,0,0.07)",
          boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
        }}
      >
        <h2 className="mb-1 text-sm font-bold" style={{ color: "#1a1a2e" }}>
          הפעלת Win-Back ידנית
        </h2>
        <p className="mb-4 text-xs" style={{ color: "#888" }}>
          מריץ את אוטומציית החזרת הלקוחות עבור עסק זה עכשיו, ללא המתנה לשעת הקרון. כל שאר ההגנות (cooldown, test mode) פעילות.
        </p>
        <RunWinBackButton businessId={biz.id} />
      </div>

      {/* Edit subscription form */}
      <div
        className="rounded-2xl border p-6"
        style={{
          background: "#fff",
          borderColor: "rgba(0,0,0,0.07)",
          boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
        }}
      >
        <h2 className="mb-5 text-sm font-bold" style={{ color: "#1a1a2e" }}>
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
      </div>

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
