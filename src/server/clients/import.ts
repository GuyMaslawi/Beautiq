"use server";

import { requireTenant } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { normalizePhone, isValidIsraeliPhone } from "@/lib/phone";

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

/**
 * Upper bound on a single import. This is a Server Action, so `rows` is whatever
 * the caller POSTs — without a cap, a 500k-element array becomes 500k sequential
 * INSERTs inside one request, saturating the shared connection pool and degrading
 * every other tenant.
 */
const MAX_IMPORT_ROWS = 2000;

export async function importClients(
  rows: ClientImportRow[],
): Promise<ClientImportResult> {
  const tenant = await requireTenant();

  if (!Array.isArray(rows) || rows.length === 0) {
    return { created: 0, duplicates: 0, failed: 0 };
  }
  if (rows.length > MAX_IMPORT_ROWS) {
    return { created: 0, duplicates: 0, failed: rows.length };
  }

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
    // Per-row shape check: a non-string fullName used to throw mid-loop and abort
    // the whole import with no rollback. An unparseable phone is counted as
    // failed rather than stored, so it cannot become a client that breaks later
    // at WhatsApp send time.
    if (typeof row?.fullName !== "string" || !row.fullName.trim()) {
      failed++;
      continue;
    }
    if (typeof row.phone !== "string" || !isValidIsraeliPhone(row.phone)) {
      failed++;
      continue;
    }

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
