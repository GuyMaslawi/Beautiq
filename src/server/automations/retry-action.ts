"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db/prisma";
import { requireTenant } from "@/server/auth/session";
import { getWhatsAppProviderForBusiness } from "@/server/whatsapp/resolver";
import { isValidIsraeliPhone } from "@/lib/phone";

const MAX_RETRY_COUNT = 3;

export interface RetryMessageResult {
  success: boolean;
  error?: string;
}

export async function retryAutomationMessageAction(
  messageId: string,
): Promise<RetryMessageResult> {
  const tenant = await requireTenant();

  // Find the message — must belong to this business and be failed
  const message = await prisma.automationMessage.findFirst({
    where: {
      id: messageId,
      businessId: tenant.businessId,
      status: "failed",
    },
    include: {
      client: {
        select: {
          id: true,
          businessId: true,
          unsubscribedAt: true,
          normalizedPhone: true,
        },
      },
    },
  });

  if (!message) {
    return { success: false, error: "הודעה לא נמצאה או שאינה במצב כשל" };
  }

  // Safety: client must belong to the same business
  if (message.client.businessId !== tenant.businessId) {
    return { success: false, error: "שגיאת אבטחה" };
  }

  // Don't retry unsubscribed clients
  if (message.client.unsubscribedAt) {
    return { success: false, error: "הלקוח הסיר את הסכמתו לקבלת הודעות" };
  }

  // Max retries guard
  if (message.retryCount >= MAX_RETRY_COUNT) {
    return { success: false, error: `מספר הניסיונות המקסימלי הגיע (${MAX_RETRY_COUNT})` };
  }

  if (!isValidIsraeliPhone(message.client.normalizedPhone)) {
    return { success: false, error: "מספר טלפון לא תקין" };
  }

  const provider = await getWhatsAppProviderForBusiness(tenant.businessId);

  try {
    const result = await provider.send({
      businessId: tenant.businessId,
      toPhone: message.phone,
      templateId: message.templateId ?? undefined,
      fallbackText: message.messageText,
      automationRunId: message.runId,
      clientId: message.clientId,
    });

    if (result.success) {
      await prisma.automationMessage.update({
        where: { id: message.id, businessId: tenant.businessId },
        data: {
          status: "sent",
          providerMessageId: result.providerMessageId,
          sentAt: new Date(),
          failureReason: null,
          retryCount: { increment: 1 },
          lastRetryAt: new Date(),
        },
      });
      revalidatePath("/automations");
      return { success: true };
    }

    // Send failed — record the attempt
    await prisma.automationMessage.update({
      where: { id: message.id, businessId: tenant.businessId },
      data: {
        failureReason: result.failureReason ?? "שליחה נכשלה",
        retryCount: { increment: 1 },
        lastRetryAt: new Date(),
      },
    });
    revalidatePath("/automations");
    return {
      success: false,
      error: result.isMockSkip
        ? "מצב פיתוח — הודעה לא נשלחה בפועל"
        : result.isTestModeBlock
        ? "מצב בדיקה — שליחה מותרת רק למספר הבדיקה"
        : result.failureReason ?? "שליחה נכשלה",
    };
  } catch (err) {
    const errorMsg =
      err instanceof Error ? err.message : "שגיאה לא ידועה";
    await prisma.automationMessage.update({
      where: { id: message.id, businessId: tenant.businessId },
      data: { retryCount: { increment: 1 }, lastRetryAt: new Date() },
    });
    return { success: false, error: errorMsg };
  }
}
