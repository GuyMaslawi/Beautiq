import { CheckCircle, AlertTriangle, FlaskConical, Clock } from "lucide-react";

/**
 * Owner-facing readiness badge for a single automation card.
 *
 * Only rendered when WhatsApp is connected (the locked / pre-connection state is
 * handled by the card itself). Shows ONLY calm, plain-Hebrew owner states —
 * never a per-card "missing template" warning or a per-card setup button.
 * Template creation is automatic (after connect) and, if needed, retried from
 * the single button on the central WhatsApp connection card.
 *
 *   no template yet   → "מכינים תבניות הודעה"   (calm, transient)
 *   pending / unknown → "ממתין לאישור WhatsApp"
 *   rejected          → "חלק מהתבניות נדחו — פני לתמיכה"
 *   approved          → "מוכן לשליחה"
 *
 * Never shows template names, provider, or other Meta technical details to owners.
 */
export function TemplateReadinessBadge({
  realSendConfigured,
  testMode,
  templateName,
  templateStatus,
}: {
  realSendConfigured: boolean;
  testMode: boolean;
  templateName?: string | null;
  templateStatus?: string | null;
}) {
  if (!realSendConfigured) return null;

  if (testMode) {
    return (
      <div className="flex items-center gap-1.5 text-xs" style={{ color: "#b45309" }}>
        <FlaskConical className="h-3 w-3 shrink-0" />
        מצב בדיקה פעיל
      </div>
    );
  }

  // Connected but template not created yet — calm "preparing" state, not a warning.
  if (!templateName) {
    return (
      <div className="flex items-center gap-1.5 text-xs" style={{ color: "#b45309" }}>
        <Clock className="h-3 w-3 shrink-0" />
        מכינים תבניות הודעה
      </div>
    );
  }

  if (templateStatus === "rejected") {
    return (
      <div className="flex items-center gap-1.5 text-xs" style={{ color: "#dc2626" }}>
        <AlertTriangle className="h-3 w-3 shrink-0" />
        חלק מהתבניות נדחו — פני לתמיכה
      </div>
    );
  }

  if (templateStatus === "approved") {
    return (
      <div className="flex items-center gap-1.5 text-xs" style={{ color: "#15803d" }}>
        <CheckCircle className="h-3 w-3 shrink-0" />
        מוכן לשליחה
      </div>
    );
  }

  // Template exists but not yet approved (pending / not synced).
  return (
    <div className="flex items-center gap-1.5 text-xs" style={{ color: "#b45309" }}>
      <Clock className="h-3 w-3 shrink-0" />
      ממתין לאישור WhatsApp
    </div>
  );
}
