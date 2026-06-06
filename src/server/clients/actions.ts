"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db/prisma";
import { requireTenant } from "@/server/auth/session";
import { getClientDetail } from "@/server/clients/queries";
import { CLIENTS } from "@/lib/constants/he";

export interface ClientNotesFormState {
  success?: boolean;
  formError?: string;
}

export async function updateClientNotesAction(
  clientId: string,
  _prevState: ClientNotesFormState,
  formData: FormData,
): Promise<ClientNotesFormState> {
  const tenant = await requireTenant();

  // Verify client belongs to this business (scopedWhere enforces multi-tenant safety)
  const client = await getClientDetail(tenant, clientId);
  if (!client) return { formError: CLIENTS.errors.notFound };

  const notes = String(formData.get("notes") ?? "").trim();

  try {
    await prisma.client.updateMany({
      where: { id: clientId, businessId: tenant.businessId },
      data: { notes: notes || null },
    });
  } catch {
    return { formError: CLIENTS.errors.generic };
  }

  revalidatePath(`/clients/${clientId}`);
  return { success: true };
}
