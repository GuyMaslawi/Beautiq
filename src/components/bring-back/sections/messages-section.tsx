import { MessageCircle } from "lucide-react";
import { EditorialSectionHeader } from "@/components/premium";
import { requireCurrentBusiness } from "@/server/auth/session";
import { getSystemTemplates, getComposerData } from "@/server/messages/queries";
import { SmartComposer } from "@/components/messages/smart-composer";
import { MessageTemplateCard } from "@/components/messages/message-template-card";
import { MESSAGES } from "@/lib/constants/he";

/** הודעות — מחולל הודעות חכם וספריית תבניות. */
export async function MessagesSection() {
  const business = await requireCurrentBusiness();
  const tenant = { businessId: business.id };

  const [templates, { bookingOptions, clientOptions }] = await Promise.all([
    getSystemTemplates(),
    getComposerData(tenant),
  ]);

  return (
    <div className="w-full space-y-6">
      {/* Section header */}
      <EditorialSectionHeader
        icon={<MessageCircle className="h-4 w-4" />}
        eyebrow="מרכז ההודעות"
        title={MESSAGES.pageTitle}
        description={MESSAGES.pageSubtitle}
        tint="plum"
      />

      {/* Explanation banner */}
      <div
        className="flex items-start gap-3 rounded-2xl border p-4"
        style={{
          borderColor: "rgba(172,92,127,0.20)",
          background: "rgba(172,92,127,0.06)",
          boxShadow: "0 1px 6px rgba(43,37,48,0.04)",
        }}
      >
        <div
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
          style={{ background: "rgba(172,92,127,0.13)" }}
        >
          <MessageCircle className="h-4 w-4" style={{ color: "#ac5c7f" }} />
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
      <div
        className="overflow-hidden rounded-2xl"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-md)",
        }}
      >
        <div
          className="px-5 py-3.5"
          style={{
            borderBottom: "1px solid var(--border)",
            background: "linear-gradient(135deg, rgba(247,238,243,0.60) 0%, rgba(255,255,255,0) 100%)",
          }}
        >
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
            {MESSAGES.templatesTitle}
          </p>
        </div>
        <div className="p-5">
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
    </div>
  );
}
