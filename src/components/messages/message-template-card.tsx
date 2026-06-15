import { Card } from "@/components/ui/card";
import type { MessageTemplateType } from "@prisma/client";
import { TEMPLATE_TYPE_LABELS } from "@/lib/messages/template-labels";
import { MESSAGES } from "@/lib/constants/he";
import { renderTemplate } from "@/lib/messages/render-template";

const SAMPLE_VARS = {
  clientName: "נועה",
  businessName: "הסטודיו של יעל",
  serviceName: "לק ג׳ל",
  bookingDate: "יום שני, 12 ביוני",
  bookingTime: "10:00",
  price: "₪120",
};

const VARIABLE_KEY_LABELS: Record<string, string> =
  MESSAGES.templateVariableLabels;

function extractUsedVariableLabels(body: string): string[] {
  const keys = [...body.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
  return [...new Set(keys)]
    .map((k) => VARIABLE_KEY_LABELS[k])
    .filter(Boolean) as string[];
}

interface MessageTemplateCardProps {
  type: MessageTemplateType;
  body: string;
  isCustom?: boolean;
}

export function MessageTemplateCard({
  type,
  body,
  isCustom = false,
}: MessageTemplateCardProps) {
  const preview = renderTemplate(body, SAMPLE_VARS);
  const useCases = MESSAGES.templateUseCases as Record<string, string>;
  const useCase = useCases[type];
  const variableLabels = extractUsedVariableLabels(body);

  return (
    <Card className="p-4">
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-foreground text-sm font-semibold">
          {TEMPLATE_TYPE_LABELS[type]}
        </p>
        {isCustom && (
          <span className="border-border text-muted rounded-full border px-2 py-0.5 text-xs">
            מותאם אישית
          </span>
        )}
      </div>
      {useCase && (
        <p className="text-muted mb-3 text-xs">{useCase}</p>
      )}
      <div className="bg-surface rounded-lg p-3">
        <p className="text-foreground text-sm leading-relaxed whitespace-pre-line">
          {preview}
        </p>
      </div>
      {variableLabels.length > 0 && (
        <p className="text-muted mt-2 text-xs">
          {MESSAGES.templateVariablesHint} {variableLabels.join(", ")}
        </p>
      )}
    </Card>
  );
}
