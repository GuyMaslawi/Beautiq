"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Plus,
  Edit2,
  Trash2,
  BarChart2,
  Sparkles,
  Target,
} from "lucide-react";
import { FINANCE } from "@/lib/constants/he";
import { deleteExpenseAction } from "@/server/finance/actions";
import { ExpenseFormModal } from "./expense-form-modal";
import type { FinanceData, PeriodFilter } from "@/server/finance/queries";
import type { RevenueForecastData } from "@/server/revenue-forecast/queries";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatILS(amount: number): string {
  return `₪${Math.abs(Math.round(amount)).toLocaleString("he-IL")}`;
}

function formatDate(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("he-IL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Period filter
// ---------------------------------------------------------------------------

const PERIOD_OPTIONS: { value: PeriodFilter; label: string }[] = [
  { value: "today", label: FINANCE.periods.today },
  { value: "week", label: FINANCE.periods.week },
  { value: "month", label: FINANCE.periods.month },
  { value: "year", label: FINANCE.periods.year },
];

function PeriodFilter({
  current,
  onChange,
}: {
  current: PeriodFilter;
  onChange: (p: PeriodFilter) => void;
}) {
  return (
    <div
      className="flex flex-wrap gap-1.5 rounded-2xl p-1"
      style={{ background: "var(--surface-muted, rgba(0,0,0,0.04))", border: "1px solid var(--border)" }}
    >
      {PERIOD_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className="rounded-xl px-4 py-1.5 text-sm font-medium transition-all"
          style={
            current === opt.value
              ? {
                  background: "linear-gradient(135deg, #c97898 0%, #b86b8c 100%)",
                  color: "#fff",
                  boxShadow: "0 2px 8px rgba(184,107,140,0.30)",
                }
              : { color: "var(--foreground-soft)" }
          }
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Summary cards
// ---------------------------------------------------------------------------

function SummaryCard({
  title,
  value,
  sub,
  accent,
  icon: Icon,
  warn,
}: {
  title: string;
  value: string;
  sub?: string;
  accent?: "green" | "rose" | "gold";
  icon: React.ElementType;
  warn?: boolean;
}) {
  const accentColors = {
    green: { bg: "rgba(61,139,110,0.10)", fg: "#3d8b6e", border: "rgba(61,139,110,0.25)" },
    rose: { bg: "rgba(201,120,152,0.10)", fg: "#b86b8c", border: "rgba(201,120,152,0.25)" },
    gold: { bg: "rgba(212,168,30,0.10)", fg: "#b8960a", border: "rgba(212,168,30,0.25)" },
  };

  const colors = accent ? accentColors[accent] : null;

  return (
    <div
      className="flex flex-col gap-3 rounded-2xl p-5"
      style={{
        background: colors ? colors.bg : "var(--surface)",
        border: `1px solid ${colors ? colors.border : "var(--border)"}`,
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium" style={{ color: "var(--foreground-soft)" }}>
          {title}
        </span>
        <Icon
          className="h-4 w-4"
          style={{ color: colors ? colors.fg : "var(--muted)" }}
        />
      </div>
      <p
        className="text-2xl font-bold leading-none"
        style={{ color: warn ? "#ef4444" : colors ? colors.fg : "var(--foreground)" }}
      >
        {value}
      </p>
      {sub && (
        <p className="text-xs" style={{ color: "var(--muted)" }}>{sub}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Profit visual (simple bars)
// ---------------------------------------------------------------------------

function ProfitVisual({ revenue, expenses, profit }: { revenue: number; expenses: number; profit: number }) {
  const max = Math.max(revenue, expenses, 1);
  const bars = [
    { label: FINANCE.summary.revenue, value: revenue, color: "#3d8b6e", pct: (revenue / max) * 100 },
    { label: FINANCE.summary.expenses, value: expenses, color: "#b86b8c", pct: (expenses / max) * 100 },
    { label: FINANCE.summary.profit, value: profit, color: profit >= 0 ? "#b8960a" : "#ef4444", pct: Math.abs(profit) / max * 100 },
  ];

  const helperText = expenses === 0
    ? FINANCE.profitVisual.helperNoExpenses
    : FINANCE.profitVisual.helper;

  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="mb-4 flex items-center gap-2">
        <BarChart2 className="h-4 w-4" style={{ color: "#b86b8c" }} />
        <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
          {FINANCE.profitVisual.title}
        </h3>
      </div>
      <div className="space-y-3">
        {bars.map((bar) => (
          <div key={bar.label} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span style={{ color: "var(--foreground-soft)" }}>{bar.label}</span>
              <span className="font-semibold" style={{ color: bar.color }}>
                {bar.value < 0 ? "-" : ""}{formatILS(bar.value)}
              </span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full"
              style={{ background: "rgba(0,0,0,0.06)" }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.max(1, bar.pct)}%`, background: bar.color }}
              />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs" style={{ color: "var(--muted)" }}>
        {helperText}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Top services
// ---------------------------------------------------------------------------

function TopServices({ services }: { services: FinanceData["topServices"] }) {
  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-4 w-4" style={{ color: "#b86b8c" }} />
        <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
          {FINANCE.topServices.title}
        </h3>
      </div>

      {services.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--muted)" }}>{FINANCE.topServices.empty}</p>
      ) : (
        <div className="divide-y" style={{ borderColor: "var(--border)" }}>
          {services.map((svc) => (
            <div key={svc.serviceId} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium" style={{ color: "var(--foreground)" }}>
                  {svc.serviceName}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                  {svc.bookingsCount} {FINANCE.topServices.bookings} · {FINANCE.topServices.avgPrice} {formatILS(svc.avgPrice)}
                </p>
              </div>
              <span className="shrink-0 text-sm font-bold" style={{ color: "#3d8b6e" }}>
                {formatILS(svc.revenue)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Expense list
// ---------------------------------------------------------------------------

function ExpenseList({
  expenses,
  onEdit,
}: {
  expenses: FinanceData["expenses"];
  onEdit: (expense: FinanceData["expenses"][number]) => void;
}) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function handleDelete(id: string) {
    if (!confirm(FINANCE.expenseList.deleteConfirm)) return;
    setDeletingId(id);
    startTransition(async () => {
      await deleteExpenseAction(id);
      setDeletingId(null);
    });
  }

  const categoryLabel = (cat: string) =>
    (FINANCE.categories as Record<string, string>)[cat] ?? cat;

  return (
    <div className="space-y-2">
      {expenses.map((exp) => (
        <div
          key={exp.id}
          className="flex items-center gap-3 rounded-xl px-4 py-3"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            opacity: deletingId === exp.id ? 0.4 : 1,
            transition: "opacity 0.2s",
          }}
        >
          {/* Date */}
          <div className="w-20 shrink-0 text-xs" style={{ color: "var(--muted)" }}>
            {formatDate(exp.date)}
          </div>

          {/* Category badge */}
          <div className="hidden sm:block">
            <span
              className="rounded-full px-2.5 py-0.5 text-xs font-medium"
              style={{
                background: "rgba(184,107,140,0.10)",
                color: "#b86b8c",
                border: "1px solid rgba(184,107,140,0.20)",
              }}
            >
              {categoryLabel(exp.category)}
            </span>
          </div>

          {/* Description + notes */}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium" style={{ color: "var(--foreground)" }}>
              {exp.description}
            </p>
            {exp.notes && (
              <p className="truncate text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                {exp.notes}
              </p>
            )}
          </div>

          {/* Amount */}
          <span className="shrink-0 text-sm font-bold" style={{ color: "#b86b8c" }}>
            {formatILS(exp.amount)}
          </span>

          {/* Actions */}
          <div className="flex shrink-0 gap-1">
            <button
              onClick={() => onEdit(exp)}
              className="rounded-lg p-1.5 transition-colors hover:bg-black/10"
              aria-label={FINANCE.expenseList.editButton}
            >
              <Edit2 className="h-3.5 w-3.5" style={{ color: "var(--muted)" }} />
            </button>
            <button
              onClick={() => handleDelete(exp.id)}
              disabled={deletingId === exp.id}
              className="rounded-lg p-1.5 transition-colors hover:bg-red-500/10"
              aria-label={FINANCE.expenseList.deleteButton}
            >
              <Trash2 className="h-3.5 w-3.5" style={{ color: deletingId === exp.id ? "var(--muted)" : "#ef4444" }} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Target vs. actual — surfaces the monthly forecast inside Finance (Phase 3
// recommendation). Always month-scoped, regardless of the period filter.
// ---------------------------------------------------------------------------

const CONFIDENCE_LABEL: Record<RevenueForecastData["confidence"], string> = {
  high: "דיוק גבוה",
  medium: "דיוק בינוני",
  low: "דיוק ראשוני",
};

function TargetVsActual({ forecast }: { forecast: RevenueForecastData }) {
  if (!forecast.hasEnoughData) return null;

  const gapClosed = forecast.gapToTarget <= 0 || forecast.isOnTrack;

  const segments = [
    { label: FINANCE.summary.revenue, value: forecast.completedRevenue, color: "#3d8b6e" },
    { label: "תורים קרובים", value: forecast.upcomingRevenue, color: "#c97898" },
    { label: "פער ליעד", value: forecast.gapToTarget, color: "#d4a81e" },
    { label: "הכנסה שאבדה", value: forecast.lostRevenue, color: "#e06060" },
  ].filter((s) => s.value > 0);

  const barTotal = segments.reduce((sum, s) => sum + s.value, 0) || 1;

  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="mb-1 flex items-center gap-2">
        <Target className="h-4 w-4" style={{ color: "#b86b8c" }} />
        <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
          יעד מול ביצוע · החודש
        </h3>
        <span
          className="ms-auto rounded-full px-2 py-0.5 text-[10px] font-bold"
          style={{ background: "rgba(184,107,140,0.10)", color: "#b86b8c" }}
        >
          {CONFIDENCE_LABEL[forecast.confidence]}
        </span>
      </div>
      <p className="mb-4 text-xs" style={{ color: "var(--muted)" }}>
        צפי לסוף החודש מבוסס על תורים שהושלמו ועל תורים מאושרים שעוד צפויים החודש.
      </p>

      {/* Key numbers */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        <div>
          <p className="text-xs" style={{ color: "var(--muted)" }}>יעד החודש</p>
          <p className="text-lg font-bold tabular-nums" style={{ color: "#b8960a" }}>
            {forecast.monthlyTarget > 0 ? formatILS(forecast.monthlyTarget) : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs" style={{ color: "var(--muted)" }}>צפי לסוף החודש</p>
          <p className="text-lg font-bold tabular-nums" style={{ color: "#b86b8c" }}>
            {formatILS(forecast.expectedRevenue)}
          </p>
        </div>
        <div>
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            {gapClosed ? "עמידה ביעד" : "פער ליעד"}
          </p>
          <p
            className="text-lg font-bold tabular-nums"
            style={{ color: gapClosed ? "#3d8b6e" : "#b8960a" }}
          >
            {gapClosed ? "✓ ביעד" : formatILS(forecast.gapToTarget)}
          </p>
        </div>
      </div>

      {/* Composition bar */}
      {segments.length > 0 && (
        <>
          <div className="flex h-2.5 overflow-hidden rounded-full" style={{ background: "rgba(0,0,0,0.06)" }}>
            {segments.map((s) => (
              <div
                key={s.label}
                style={{ width: `${(s.value / barTotal) * 100}%`, background: s.color }}
                title={`${s.label}: ${formatILS(s.value)}`}
              />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
            {segments.map((s) => (
              <div key={s.label} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                <span className="text-xs" style={{ color: "var(--foreground-soft)" }}>
                  {s.label}
                </span>
                <span className="text-xs font-semibold" style={{ color: s.color }}>
                  {formatILS(s.value)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

interface FinancePageClientProps {
  data: FinanceData;
  period: PeriodFilter;
  forecast: RevenueForecastData;
}

export function FinancePageClient({ data, period, forecast }: FinancePageClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [modalOpen, setModalOpen] = useState(false);
  const [editExpense, setEditExpense] = useState<FinanceData["expenses"][number] | null>(null);

  const { summary, topServices, expenses } = data;

  function handlePeriodChange(p: PeriodFilter) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", p);
    router.push(`${pathname}?${params.toString()}`);
  }

  function openAdd() {
    setEditExpense(null);
    setModalOpen(true);
  }

  function openEdit(expense: FinanceData["expenses"][number]) {
    setEditExpense(expense);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditExpense(null);
  }

  const isOverspend = summary.profit < 0 && summary.revenue > 0;

  return (
    <>
      {/* Period filter */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PeriodFilter current={period} onChange={handlePeriodChange} />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard
          title={FINANCE.summary.revenue}
          value={formatILS(summary.revenue)}
          sub={`${summary.completedBookings} תורים שהושלמו · ממוצע ${formatILS(summary.avgBookingValue)} לתור`}
          accent="green"
          icon={TrendingUp}
        />
        <SummaryCard
          title={FINANCE.summary.expenses}
          value={formatILS(summary.expenses)}
          sub={expenses.length > 0 ? `${expenses.length} הוצאות רשומות` : undefined}
          accent="rose"
          icon={TrendingDown}
        />
        <SummaryCard
          title={FINANCE.summary.profit}
          value={(summary.profit < 0 ? "-" : "") + formatILS(summary.profit)}
          sub={
            summary.revenue > 0
              ? `${summary.expensePct}% ${FINANCE.summary.expensePct}`
              : undefined
          }
          accent="gold"
          icon={Wallet}
          warn={isOverspend}
        />
      </div>

      {/* Target vs. actual (monthly forecast) */}
      <TargetVsActual forecast={forecast} />

      {/* Overspend warning */}
      {isOverspend && (
        <div
          className="rounded-xl px-4 py-3 text-sm"
          style={{
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.20)",
            color: "#ef4444",
          }}
        >
          {FINANCE.overspend}
        </div>
      )}

      {/* Upcoming revenue banner */}
      {summary.upcomingRevenue > 0 && (
        <div
          className="rounded-xl px-4 py-3 text-sm"
          style={{
            background: "rgba(61,139,110,0.07)",
            border: "1px solid rgba(61,139,110,0.18)",
          }}
        >
          <div className="flex items-center gap-3">
            <TrendingUp className="h-4 w-4 shrink-0" style={{ color: "#3d8b6e" }} />
            <span style={{ color: "var(--foreground-soft)" }}>
              {FINANCE.summary.upcomingRevenue}:{" "}
              <strong style={{ color: "#3d8b6e" }}>{formatILS(summary.upcomingRevenue)}</strong>
              {summary.upcomingBookingsCount > 0 && (
                <span className="text-xs ms-1" style={{ color: "var(--muted)" }}>
                  ({summary.upcomingBookingsCount} תורים)
                </span>
              )}
            </span>
          </div>
          <p className="mt-1 text-xs" style={{ color: "var(--muted)", paddingInlineStart: "1.75rem" }}>
            {FINANCE.summary.upcomingRevenueNote}
          </p>
        </div>
      )}

      {/* No revenue empty state */}
      {summary.revenue === 0 && (
        <div
          className="rounded-2xl px-6 py-8 text-center"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <TrendingUp className="mx-auto mb-3 h-8 w-8" style={{ color: "var(--muted)" }} />
          <p className="font-medium" style={{ color: "var(--foreground)" }}>
            {FINANCE.noRevenue.title}
          </p>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            {FINANCE.noRevenue.body}
          </p>
        </div>
      )}

      {/* Two-column layout: visual + top services */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ProfitVisual
          revenue={summary.revenue}
          expenses={summary.expenses}
          profit={summary.profit}
        />
        <TopServices services={topServices} />
      </div>

      {/* Expenses section */}
      <div
        className="rounded-2xl p-5"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            {FINANCE.expenseList.title}
            {expenses.length > 0 && (
              <span
                className="ms-2 rounded-full px-2 py-0.5 text-xs font-medium"
                style={{
                  background: "rgba(184,107,140,0.10)",
                  color: "#b86b8c",
                }}
              >
                {expenses.length}
              </span>
            )}
          </h3>
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #c97898 0%, #b86b8c 100%)" }}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{FINANCE.expenseList.addButton}</span>
          </button>
        </div>

        {expenses.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              {FINANCE.expenseList.empty}
            </p>
            <button
              onClick={openAdd}
              className="mx-auto mt-4 flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #c97898 0%, #b86b8c 100%)" }}
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{FINANCE.expenseList.emptyCta}</span>
            </button>
          </div>
        ) : (
          <ExpenseList expenses={expenses} onEdit={openEdit} />
        )}
      </div>

      {/* Modal */}
      <ExpenseFormModal
        open={modalOpen}
        expense={editExpense}
        onClose={closeModal}
      />
    </>
  );
}
