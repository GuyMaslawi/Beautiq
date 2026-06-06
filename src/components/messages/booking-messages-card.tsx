import { Card } from "@/components/ui/card";
import { CopyMessageButton } from "@/components/messages/copy-message-button";
import { resolveTemplate } from "@/server/messages/queries";
import { renderTemplate } from "@/lib/messages/render-template";
import { MESSAGES } from "@/lib/constants/he";
import type { TenantContext } from "@/server/db/tenant";
import type { MessageTemplateType } from "@prisma/client";

interface BookingMessagesCardProps {
  tenant: TenantContext;
  clientName: string;
  businessName: string;
  serviceName: string;
  bookingDate: string;
  bookingTime: string;
  price?: string;
  depositAmount?: string;
}

const BOOKING_MESSAGE_TYPES: {
  type: MessageTemplateType;
  label: string;
}[] = [
  {
    type: "booking_confirmation",
    label: MESSAGES.copyLabels.booking_confirmation,
  },
  {
    type: "booking_reminder",
    label: MESSAGES.copyLabels.booking_reminder,
  },
  {
    type: "booking_cancelled",
    label: MESSAGES.copyLabels.booking_cancelled,
  },
  {
    type: "after_treatment",
    label: MESSAGES.copyLabels.after_treatment,
  },
];

export async function BookingMessagesCard({
  tenant,
  clientName,
  businessName,
  serviceName,
  bookingDate,
  bookingTime,
  price,
  depositAmount,
}: BookingMessagesCardProps) {
  const vars = {
    clientName,
    businessName,
    serviceName,
    bookingDate,
    bookingTime,
    price,
    depositAmount,
  };

  const bodies = await Promise.all(
    BOOKING_MESSAGE_TYPES.map(({ type }) => resolveTemplate(tenant, type)),
  );

  const messages = BOOKING_MESSAGE_TYPES.map(({ type, label }, i) => ({
    type,
    label,
    message: bodies[i] ? renderTemplate(bodies[i]!, vars) : null,
  })).filter((m) => m.message !== null);

  if (messages.length === 0) return null;

  return (
    <Card className="p-5">
      <p className="text-muted mb-4 text-xs font-semibold uppercase tracking-wider">
        {MESSAGES.bookingMessagesSection}
      </p>
      <div className="space-y-2">
        {messages.map(({ type, label, message }) => (
          <CopyMessageButton key={type} label={label} message={message!} />
        ))}
      </div>
    </Card>
  );
}
