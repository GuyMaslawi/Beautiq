import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireTenant } from "@/server/auth/session";
import { ImportWizard } from "@/components/clients/import-wizard";
import { CLIENT_IMPORT } from "@/lib/constants/he";

export default async function ClientsImportPage() {
  await requireTenant();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      {/* Back link */}
      <div>
        <Link
          href="/clients"
          className="inline-flex items-center gap-1.5 text-sm"
          style={{ color: "var(--muted)" }}
        >
          <ArrowRight className="h-4 w-4" />
          חזרה ללקוחות
        </Link>
      </div>

      {/* Page header */}
      <div>
        <h1
          className="text-2xl font-bold tracking-tight"
          style={{ color: "var(--foreground)" }}
        >
          {CLIENT_IMPORT.pageTitle}
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          {CLIENT_IMPORT.pageSubtitle}
        </p>
      </div>

      <ImportWizard />
    </div>
  );
}
