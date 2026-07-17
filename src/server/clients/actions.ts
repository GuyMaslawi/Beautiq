"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db/prisma";
import { requireTenant } from "@/server/auth/session";
import { getClientDetail } from "@/server/clients/queries";
import { normalizePhone, isValidIsraeliPhone } from "@/lib/phone";
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
    select: { id: true, businessId: true, whatsappOptIn: true },
  });

  if (!client || client.businessId !== tenant.businessId) {
    return { error: CLIENTS.errors.notFound };
  }

  const whatsappOptIn = formData.getAll("whatsappOptIn").includes("true");
  const marketingOptIn = formData.getAll("marketingOptIn").includes("true");

  try {
    await prisma.client.update({
      where: { id: clientId },
      data: {
        whatsappOptIn,
        marketingOptIn,
        // Record provenance only when the owner newly grants WhatsApp consent.
        ...(whatsappOptIn && !client.whatsappOptIn
          ? { whatsappOptInAt: new Date(), whatsappOptInSource: "manual_owner" }
          : {}),
      },
    });
  } catch {
    return { error: CLIENTS.errors.generic };
  }

  revalidatePath(`/clients/${clientId}`);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Full client edit (name, phone, email, notes, opt-in, unsubscribed)
// ---------------------------------------------------------------------------

export interface UpdateClientState {
  success?: boolean;
  fieldErrors?: {
    fullName?: string;
    phone?: string;
    email?: string;
  };
  formError?: string;
}

export async function updateClientAction(
  clientId: string,
  _prevState: UpdateClientState,
  formData: FormData,
): Promise<UpdateClientState> {
  const tenant = await requireTenant();

  const existing = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, businessId: true, whatsappOptIn: true },
  });

  if (!existing || existing.businessId !== tenant.businessId) {
    return { formError: CLIENTS.errors.notFound };
  }

  const fullName = String(formData.get("fullName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const whatsappOptIn = formData.getAll("whatsappOptIn").includes("true");
  const marketingOptIn = formData.getAll("marketingOptIn").includes("true");

  const fieldErrors: NonNullable<UpdateClientState["fieldErrors"]> = {};

  if (!fullName) fieldErrors.fullName = CLIENTS.edit.errors.nameRequired;

  if (!phone) {
    fieldErrors.phone = CLIENTS.edit.errors.phoneRequired;
  } else if (!isValidIsraeliPhone(phone)) {
    fieldErrors.phone = CLIENTS.edit.errors.phoneInvalid;
  }

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const normalizedPhone = normalizePhone(phone);

  // Check duplicate phone in same business (excluding self)
  const duplicate = await prisma.client.findUnique({
    where: {
      businessId_normalizedPhone: {
        businessId: tenant.businessId,
        normalizedPhone,
      },
    },
    select: { id: true },
  });

  if (duplicate && duplicate.id !== clientId) {
    return { fieldErrors: { phone: CLIENTS.edit.errors.phoneDuplicate } };
  }

  try {
    await prisma.client.update({
      where: { id: clientId },
      data: {
        fullName,
        phone,
        normalizedPhone,
        email,
        notes,
        whatsappOptIn,
        marketingOptIn,
        ...(whatsappOptIn && !existing.whatsappOptIn
          ? { whatsappOptInAt: new Date(), whatsappOptInSource: "manual_owner" }
          : {}),
      },
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("Unique constraint")) {
      return { fieldErrors: { phone: CLIENTS.edit.errors.phoneDuplicate } };
    }
    return { formError: CLIENTS.errors.generic };
  }

  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/clients");
  return { success: true };
}
