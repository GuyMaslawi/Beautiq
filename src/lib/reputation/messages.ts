import { REPUTATION } from "@/lib/constants/he";

export function generateThankyouMessage(params: {
  clientName: string;
  serviceName: string;
  businessName: string;
  isToday: boolean;
}): string {
  const { clientName, serviceName, businessName, isToday } = params;
  if (isToday) {
    return REPUTATION.thankyou.today(clientName, serviceName, businessName);
  }
  return REPUTATION.thankyou.other(clientName, serviceName, businessName);
}

export function generateReviewRequestMessage(params: {
  clientName: string;
  businessName: string;
}): string {
  const { clientName, businessName } = params;
  return REPUTATION.review(clientName, businessName);
}
