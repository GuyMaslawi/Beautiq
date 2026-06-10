/**
 * Tenant-scoping helpers.
 *
 * Allura is a multi-tenant SaaS: almost every business-owned row carries a
 * `businessId`, and every read/write of business data MUST be scoped to the
 * current business (see CLAUDE.md §10). These helpers make that intent explicit
 * and hard to forget. This is intentionally minimal — the full data-access /
 * service layer is built in later phases.
 */

/**
 * Identifies the current tenant for a request/operation. Pass this around the
 * server layer instead of a bare `businessId` string so the scoping intent is
 * always visible at call sites.
 */
export interface TenantContext {
  businessId: string;
}

/**
 * Merge a tenant scope into a Prisma `where` filter.
 *
 * Always prefer this over filtering by record id alone:
 *
 *   // ❌ leaks across tenants
 *   prisma.booking.findUnique({ where: { id } })
 *
 *   // ✅ scoped to the current business
 *   prisma.booking.findFirst({ where: scopedWhere(tenant, { id }) })
 */
export function scopedWhere<T extends object>(
  tenant: TenantContext,
  where?: T,
): T & { businessId: string } {
  return { ...(where ?? ({} as T)), businessId: tenant.businessId };
}
