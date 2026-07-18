"use server";

import { requireTenant } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { normalizePhone } from "@/lib/phone";

export interface ClientImportRow {
  fullName: string;
  phone: string;
  email?: string;
  notes?: string;
}

export interface ClientImportResult {
  created: number;
  duplicates: number;
  failed: number;
}

export async function importClients(
  rows: ClientImportRow[],
): Promise<ClientImportResult> {
  const tenant = await requireTenant();

  // Fetch all existing normalized phones once for efficient duplicate detection
  const existingPhones = new Set(
    (
      await prisma.client.findMany({
        where: { businessId: tenant.businessId },
        select: { normalizedPhone: true },
      })
    ).map((c) => c.normalizedPhone),
  );

  let created = 0;
  let duplicates = 0;
  let failed = 0;

  for (const row of rows) {
    const normalized = normalizePhone(row.phone);

    if (existingPhones.has(normalized)) {
      duplicates++;
      continue;
    }

    try {
      await prisma.client.create({
        data: {
          businessId: tenant.businessId,
          fullName: row.fullName.trim(),
          phone: row.phone.trim(),
          normalizedPhone: normalized,
          email: row.email?.trim() || null,
          notes: row.notes?.trim() || null,
        },
      });
      // Track within this batch to prevent batch-level duplicates
      existingPhones.add(normalized);
      created++;
    } catch {
      failed++;
    }
  }

  return { created, duplicates, failed };
}
