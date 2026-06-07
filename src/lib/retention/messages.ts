import { RETENTION } from "@/lib/constants/he";

export function generateRetentionMessage(params: {
  clientName: string;
  businessName: string;
  serviceName?: string;
}): string {
  const { clientName, businessName, serviceName } = params;

  if (serviceName) {
    return RETENTION.message.withService(clientName, serviceName, businessName);
  }

  return RETENTION.message.withoutService(clientName, businessName);
}
