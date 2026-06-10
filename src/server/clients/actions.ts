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

// ---------------------------------------------------------------------------
// Opt-in management
// ---------------------------------------------------------------------------

export interface UpdateClientOptInState {
  success?: boolean;
  error?: string;
}

export async function updateClientOptInAction(
  clientId: string,
  _prevState: UpdateClientOptInState,
  formData: FormData,
): Promise<UpdateClientOptInState> {
  const tenant = await requireTenant();

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, businessId: true },
  });

  if (!client || client.businessId !== tenant.businessId) {
    return { error: CLIENTS.errors.notFound };
  }

  const whatsappOptIn = formData.get("whatsappOptIn") === "true";
  const marketingOptIn = formData.get("marketingOptIn") === "true";

  try {
    await prisma.client.update({
      where: { id: clientId },
      data: { whatsappOptIn, marketingOptIn },
    });
  } catch {
    return { error: CLIENTS.errors.generic };
  }

  revalidatePath(`/clients/${clientId}`);
  return { success: true };
}
