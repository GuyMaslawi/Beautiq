import Link from "next/link";
import { AlertTriangle, Users, ShieldAlert, Shield, Megaphone } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { requireCurrentBusiness } from "@/server/auth/session";
import { getAtRiskClients } from "@/server/at-risk/queries";
import type { AtRiskSummary } from "@/server/at-risk/queries";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AtRiskClientCard } from "@/components/at-risk/at-risk-client-card";
import { AT_RISK } from "@/lib/constants/he";

function formatLastVisit(date: Date): string {
  return new Date(date).toLocaleDateString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export default async function AtRiskPage() {
  const business = await requireCurrentBusiness();
  const tenant = { businessId: business.id };

  const clients = await getAtRiskClients(tenant);
  const summary: AtRiskSummary = {
    total: clients.length,
    critical: clients.filter((c) => c.riskLevel === "critical").length,
    high: clients.filter((c) => c.riskLevel === "high").length,
    medium: clients.filter((c) => c.riskLevel === "medium").length,
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6" dir="rtl">
      {/* Page header */}
      <PageHeader
        icon={AlertTriangle}
        title={AT_RISK.pageTitle}
        subtitle={AT_RISK.pageSubtitle}
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* סה"כ בסיכון */}
        <div
          className="rounded-2xl px-4 py-4 transition-shadow hover:shadow-md"
          style={{
            background: summary.total > 0 ? "rgba(255,235,235,0.80)" : "rgba(255,255,255,0.90)",
            border: `1px solid ${summary.total > 0 ? "rgba(200,60,60,0.22)" : "var(--border)"}`,
            boxShadow: "0 1px 6px rgba(43,37,48,0.06)",
          }}
        >
          <div
            className="mb-3 flex h-8 w-8 items-center justify-center rounded-xl"
            style={{ background: summary.total > 0 ? "rgba(200,60,60,0.12)" : "rgba(184,107,140,0.08)" }}
          >
            <Users className="h-4 w-4" style={{ color: summary.total > 0 ? "#c03c3c" : "#b86b8c" }} />
          </div>
          <p className="text-2xl font-bold tabular-nums" style={{ color: summary.total > 0 ? "#8b2020" : "#2b2530" }}>
            {summary.total}
          </p>
          <p className="mt-1 text-xs font-medium leading-tight" style={{ color: "#8a8190" }}>
            {AT_RISK.summary.total}
          </p>
        </div>

        {/* קריטי */}
        <div
          className="rounded-2xl px-4 py-4 transition-shadow hover:shadow-md"
          style={{
            background: summary.critical > 0 ? "rgba(245,220,220,0.85)" : "rgba(255,255,255,0.90)",
            border: `1px solid ${summary.critical > 0 ? "rgba(180,30,30,0.30)" : "var(--border)"}`,
            boxShadow: "0 1px 6px rgba(43,37,48,0.06)",
          }}
        >
          <div
            className="mb-3 flex h-8 w-8 items-center justify-center rounded-xl"
            style={{ background: summary.critical > 0 ? "rgba(180,30,30,0.15)" : "rgba(184,107,140,0.08)" }}
          >
            <ShieldAlert className="h-4 w-4" style={{ color: summary.critical > 0 ? "#b41e1e" : "#b86b8c" }} />
          </div>
          <p className="text-2xl font-bold tabular-nums" style={{ color: summary.critical > 0 ? "#6b1010" : "#2b2530" }}>
            {summary.critical}
          </p>
          <p className="mt-1 text-xs font-medium leading-tight" style={{ color: "#8a8190" }}>
            {AT_RISK.summary.critical}
          </p>
        </div>

        {/* גבוה */}
        <div
          className="rounded-2xl px-4 py-4 transition-shadow hover:shadow-md"
          style={{
            background: summary.high > 0 ? "rgba(255,235,235,0.80)" : "rgba(255,255,255,0.90)",
            border: `1px solid ${summary.high > 0 ? "rgba(200,60,60,0.22)" : "var(--border)"}`,
            boxShadow: "0 1px 6px rgba(43,37,48,0.06)",
          }}
        >
          <div
            className="mb-3 flex h-8 w-8 items-center justify-center rounded-xl"
            style={{ background: summary.high > 0 ? "rgba(200,60,60,0.12)" : "rgba(184,107,140,0.08)" }}
          >
            <AlertTriangle className="h-4 w-4" style={{ color: summary.high > 0 ? "#c03c3c" : "#b86b8c" }} />
          </div>
          <p className="text-2xl font-bold tabular-nums" style={{ color: summary.high > 0 ? "#8b2020" : "#2b2530" }}>
            {summary.high}
          </p>
          <p className="mt-1 text-xs font-medium leading-tight" style={{ color: "#8a8190" }}>
            {AT_RISK.summary.high}
          </p>
        </div>

        {/* בינוני */}
        <div
          className="rounded-2xl px-4 py-4 transition-shadow hover:shadow-md"
          style={{
            background: summary.medium > 0 ? "rgba(255,243,232,0.80)" : "rgba(255,255,255,0.90)",
            border: `1px solid ${summary.medium > 0 ? "rgba(220,120,40,0.22)" : "var(--border)"}`,
            boxShadow: "0 1px 6px rgba(43,37,48,0.06)",
          }}
        >
          <div
            className="mb-3 flex h-8 w-8 items-center justify-center rounded-xl"
            style={{ background: summary.medium > 0 ? "rgba(220,120,40,0.12)" : "rgba(184,107,140,0.08)" }}
          >
            <Shield className="h-4 w-4" style={{ color: summary.medium > 0 ? "#c07820" : "#b86b8c" }} />
          </div>
          <p className="text-2xl font-bold tabular-nums" style={{ color: summary.medium > 0 ? "#8a4a10" : "#2b2530" }}>
            {summary.medium}
          </p>
          <p className="mt-1 text-xs font-medium leading-tight" style={{ color: "#8a8190" }}>
            {AT_RISK.summary.medium}
          </p>
        </div>
      </div>

      {/* Guidance banner */}
      {clients.length > 0 && (
        <div
          className="rounded-2xl px-5 py-4 space-y-3"
          style={{
            background: "rgba(255,235,235,0.60)",
            border: "1px solid rgba(200,60,60,0.18)",
          }}
        >
          <p className="text-sm font-semibold mb-1" style={{ color: "#8b2020" }}>
            {AT_RISK.guidanceTitle}
          </p>
          <p className="text-sm leading-6" style={{ color: "#6b3030" }}>
            {AT_RISK.guidanceBody}
          </p>
          <Link
            href={
              summary.critical > 0
                ? "/win-back-campaigns?campaign=90"
                : summary.high > 0
                  ? "/win-back-campaigns?campaign=60"
                  : "/win-back-campaigns"
            }
          >
            <Button size="sm" variant="secondary" className="gap-1.5 mt-1">
              <Megaphone className="h-3.5 w-3.5" />
              {AT_RISK.winBackCta}
            </Button>
          </Link>
        </div>
      )}

      {/* Client list or empty state */}
      {clients.length === 0 ? (
        <Card className="p-8 text-center space-y-4">
          <div className="flex justify-center">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full"
              style={{
                background: "linear-gradient(135deg, rgba(201,120,152,0.12) 0%, rgba(184,107,140,0.08) 100%)",
              }}
            >
              <Users className="h-6 w-6" style={{ color: "#b86b8c" }} />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-foreground font-semibold text-base">
              {AT_RISK.emptyState.title}
            </h2>
            <p className="text-muted text-sm leading-relaxed max-w-sm mx-auto">
              {AT_RISK.emptyState.body}
            </p>
          </div>
          <Link href={AT_RISK.emptyState.ctaHref}>
            <Button variant="secondary" size="sm">
              {AT_RISK.emptyState.cta}
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-3">
          {clients.map((client) => (
            <AtRiskClientCard
              key={client.id}
              client={client}
              businessName={business.name}
              lastVisitFormatted={formatLastVisit(client.lastVisitAt)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
