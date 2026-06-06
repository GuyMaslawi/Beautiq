import type { MessageTemplateType } from "@prisma/client";
import { MESSAGES } from "@/lib/constants/he";

export const TEMPLATE_TYPE_LABELS: Record<MessageTemplateType, string> =
  MESSAGES.templateTypeLabels;
