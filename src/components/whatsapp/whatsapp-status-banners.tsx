import { Info, AlertCircle } from "lucide-react";

/**
 * WhatsApp status banners shown above the automation cards.
 *
 * OWNER vs ADMIN visibility (Allura rule: regular business owners must never see
 * test-mode / debug / Meta-technical wording):
 *   - The dev-mode, env-fallback, and test-mode banners are ADMIN-ONLY. They talk
 *     about internal delivery restrictions ("מצב בדיקה", "מספר הבדיקה") that are
 *     meaningless and alarming to a non-technical owner. The owner's real WhatsApp
 *     status is shown by the connection card itself.
 *   - The connection-error and connected banners are owner-safe and shown to all,
 *     but the connected banner's technical sub-line (test-mode/env detail) is
 *     admin-only; owners get a calm product line.
 */
export function WhatsAppStatusBanners({
  isAdmin,
  realSendConfigured,
  testMode,
  isEnvFallback,
  connectionState,
  whatsappConnected,
}: {
  isAdmin: boolean;
  realSendConfigured: boolean;
  testMode: boolean;
  isEnvFallback: boolean;
  connectionState: "not_connected" | "pending" | "active" | "error";
  whatsappConnected: boolean;
}) {
  return (
    <>
      {/* Dev mode: real send not enabled — admin/diagnostic only. */}
      {isAdmin && !realSendConfigured && (
        <div
          className="flex items-start gap-3 rounded-2xl px-4 py-3.5"
          dir="rtl"
          style={{ background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.28)" }}
        >
          <Info className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "#b45309" }} />
          <p className="text-sm leading-relaxed" style={{ color: "#92400e" }}>
            <strong>מצב בדיקה</strong> — הודעות לא נשלחות ללקוחות אמיתיים.
            ניתן להגדיר את האוטומציות, אך שליחה בפועל תופעל רק כאשר WhatsApp Business יהיה מחובר.
          </p>
        </div>
      )}

      {/* Env fallback: connection defined at system level, not per business — admin only. */}
      {isAdmin && realSendConfigured && isEnvFallback && (
        <div
          className="flex items-start gap-3 rounded-2xl px-4 py-3.5"
          dir="rtl"
          style={{ background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.28)" }}
        >
          <Info className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "#b45309" }} />
          <p className="text-sm leading-relaxed" style={{ color: "#92400e" }}>
            <strong>מצב בדיקה — החיבור מוגדר ברמת המערכת ולא ברמת העסק.</strong>{" "}
            הודעות לא מייצגות חיבור אמיתי של העסק.
          </p>
        </div>
      )}

      {/* Test mode active — admin only (owners never see test-number restrictions). */}
      {isAdmin && realSendConfigured && testMode && (
        <div
          className="flex items-start gap-3 rounded-2xl px-4 py-3.5"
          dir="rtl"
          style={{ background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.28)" }}
        >
          <Info className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "#b45309" }} />
          <p className="text-sm leading-relaxed" style={{ color: "#92400e" }}>
            <strong>מצב בדיקה פעיל</strong> — הודעות נשלחות רק למספר הבדיקה המוגדר.
            לקוחות אמיתיים לא יקבלו הודעות עד שמצב הבדיקה יכובה.
          </p>
        </div>
      )}

      {/* Connection failed — owner-safe, shown to everyone (only after a real failure). */}
      {realSendConfigured && !testMode && !isEnvFallback && connectionState === "error" && (
        <div
          className="flex items-start gap-3 rounded-2xl px-4 py-3.5"
          dir="rtl"
          style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.20)" }}
        >
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "#dc2626" }} />
          <p className="text-sm leading-relaxed" style={{ color: "#991b1b" }}>
            <strong>לא הצלחנו לחבר את WhatsApp</strong> — נסי שוב, ואם הבעיה נמשכת פני לתמיכה.
          </p>
        </div>
      )}

      {/* Properly connected — owner-safe. The technical sub-line is admin-only. */}
      {realSendConfigured && !testMode && whatsappConnected && !isEnvFallback && (
        <div
          className="flex items-start gap-3 rounded-2xl px-4 py-3.5"
          dir="rtl"
          style={{ background: "rgba(22,163,74,0.06)", border: "1px solid rgba(22,163,74,0.20)" }}
        >
          <Info className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "#15803d" }} />
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-semibold" style={{ color: "#14532d" }}>
              WhatsApp מחובר
            </p>
            <p className="text-xs" style={{ color: "#15803d" }}>
              {isAdmin
                ? "מצב בדיקה כבוי · חיבור ברמת העסק · האוטומציות פעילות"
                : "האוטומציות פעילות לפי ההגדרות שלך."}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
