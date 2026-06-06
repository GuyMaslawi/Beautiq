import { Card } from "@/components/ui/card";
import { CopyMessageButton } from "@/components/messages/copy-message-button";
import { resolveTemplate } from "@/server/messages/queries";
import { renderTemplate, type MessageVars } from "@/lib/messages/render-template";
import { MESSAGES } from "@/lib/constants/he";
import type { TenantContext } from "@/server/db/tenant";

interface RecentBooking {
  serviceName: string;
  startTime: Date;
}

interface ClientMessagesCardProps {
  tenant: TenantContext;
  clientName: string;
  businessName: string;
  recentBooking?: RecentBooking | null;
}

function fmtDate(date: Date): string {
  return new Date(date).toLocaleDateString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function fmtTime(date: Date): string {
  return new Date(date).toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export async function ClientMessagesCard({
  tenant,
  clientName,
  businessName,
  recentBooking,
}: ClientMessagesCardProps) {
  const vars: MessageVars = {
    clientName,
    businessName,
    serviceName: recentBooking?.serviceName,
    bookingDate: recentBooking ? fmtDate(recentBooking.startTime) : undefined,
    bookingTime: recentBooking ? fmtTime(recentBooking.startTime) : undefined,
  };

  const [rebookBody, afterBody] = await Promise.all([
    resolveTemplate(tenant, "rebook_reminder"),
    resolveTemplate(tenant, "after_treatment"),
  ]);

  const messages: { label: string; message: string }[] = [];

  if (rebookBody) {
    messages.push({
      label: MESSAGES.copyLabels.rebook_reminder,
      message: renderTemplate(rebookBody, vars),
    });
  }
  if (afterBody) {
    messages.push({
      label: MESSAGES.copyLabels.after_treatment_client,
      message: renderTemplate(afterBody, vars),
    });
  }

  if (messages.length === 0) return null;

  return (
    <Card className="p-5">
      <p className="text-muted mb-4 text-xs font-semibold uppercase tracking-wider">
        {MESSAGES.clientMessagesSection}
      </p>
      <div className="space-y-2">
        {messages.map(({ label, message }) => (
          <CopyMessageButton key={label} label={label} message={message} />
        ))}
      </div>
    </Card>
  );
}
