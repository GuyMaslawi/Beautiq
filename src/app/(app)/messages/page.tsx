import { MessageCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { requireCurrentBusiness } from "@/server/auth/session";
import { getSystemTemplates, getComposerData } from "@/server/messages/queries";
import { SmartComposer } from "@/components/messages/smart-composer";
import { MessageTemplateCard } from "@/components/messages/message-template-card";
import { MESSAGES } from "@/lib/constants/he";

export default async function MessagesPage() {
  const business = await requireCurrentBusiness();
  const tenant = { businessId: business.id };

  const [templates, { bookingOptions, clientOptions }] = await Promise.all([
    getSystemTemplates(),
    getComposerData(tenant),
  ]);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      {/* Header */}
      <PageHeader
        icon={MessageCircle}
        title={MESSAGES.pageTitle}
        subtitle={MESSAGES.pageSubtitle}
      />

      {/* Explanation banner */}
      <div
        className="flex items-start gap-3 rounded-xl border p-4"
        style={{
          borderColor: "rgba(184,107,140,0.15)",
          background: "rgba(184,107,140,0.04)",
        }}
      >
        <div
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
          style={{ background: "rgba(184,107,140,0.12)" }}
        >
          <MessageCircle className="h-4 w-4" style={{ color: "#b86b8c" }} />
        </div>
        <p className="text-foreground text-sm leading-relaxed">{MESSAGES.explanation}</p>
      </div>

      {/* Smart Message Composer — primary section */}
      <SmartComposer
        businessName={business.name}
        bookings={bookingOptions}
        clients={clientOptions}
      />

      {/* Template library — secondary section */}
      <div>
        <p className="text-muted mb-3 text-xs font-semibold">
          {MESSAGES.templatesTitle}
        </p>
        {templates.length === 0 ? (
          <p className="text-muted text-sm">{MESSAGES.noTemplates}</p>
        ) : (
          <div className="space-y-3">
            {templates.map((template) => (
              <MessageTemplateCard
                key={template.id}
                type={template.type}
                body={template.body}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
