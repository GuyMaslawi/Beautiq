"use client";

import { useState, useRef } from "react";
import type React from "react";
import {
  Users,
  Sparkles,
  ArrowRight,
  MessageCircle,
  Copy,
  Check,
  User,
  Megaphone,
  Target,
  Gift,
  Send,
  TrendingUp,
  ChevronDown,
  Info,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { WIN_BACK } from "@/lib/constants/he";
import type {
  WinBackClient,
  CampaignType,
  WinBackMetrics,
} from "@/server/win-back-campaigns/queries";
import {
  getDefaultTemplate,
  renderMessage,
  OFFER_TEXT,
  type MessageTone,
  type OfferType,
} from "@/lib/win-back-campaigns/messages";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

type TrackingStatus = "pending" | "sent" | "answered" | "booked" | "no_answer";

const TRACKING_CYCLE: TrackingStatus[] = [
  "pending",
  "sent",
  "answered",
  "booked",
  "no_answer",
];

const TRACKING_LABELS: Record<TrackingStatus, string> = {
  pending: "ממתינה לשליחה",
  sent: "נשלחה ידנית",
  answered: "ענתה",
  booked: "נקבע תור",
  no_answer: "לא ענתה",
};

const TRACKING_STYLE: Record<TrackingStatus, React.CSSProperties> = {
  pending: {
    background: "rgba(200,200,200,0.15)",
    color: "#6a6070",
    border: "1px solid rgba(200,200,200,0.35)",
  },
  sent: {
    background: "rgba(59,130,246,0.10)",
    color: "#1d4ed8",
    border: "1px solid rgba(59,130,246,0.25)",
  },
  answered: {
    background: "rgba(245,158,11,0.12)",
    color: "#92400e",
    border: "1px solid rgba(245,158,11,0.30)",
  },
  booked: {
    background: "rgba(34,197,94,0.12)",
    color: "#166534",
    border: "1px solid rgba(34,197,94,0.25)",
  },
  no_answer: {
    background: "rgba(239,68,68,0.10)",
    color: "#991b1b",
    border: "1px solid rgba(239,68,68,0.22)",
  },
};

interface CampaignViewProps {
  allCampaigns: Record<CampaignType, WinBackClient[]>;
  metrics: WinBackMetrics;
  businessName: string;
  defaultCampaignType?: CampaignType;
}

const CAMPAIGN_ORDER: CampaignType[] = ["30", "60", "90", "vip"];
const TONE_OPTIONS: MessageTone[] = [
  "gentle",
  "personal",
  "sales",
  "luxury",
  "short",
];
const OFFER_OPTIONS: OfferType[] = [
  "none",
  "discount_10",
  "upgrade_gift",
  "special_slot",
  "personal",
];

const ACCENT: Record<
  CampaignType,
  {
    bg: string;
    border: string;
    borderStrong: string;
    text: string;
    iconBg: string;
    iconColor: string;
  }
> = {
  "30": {
    bg: "rgba(254,246,228,0.80)",
    border: "rgba(184,150,10,0.22)",
    borderStrong: "rgba(184,150,10,0.50)",
    text: "#7a6400",
    iconBg: "rgba(184,150,10,0.10)",
    iconColor: "#b87c1e",
  },
  "60": {
    bg: "rgba(255,243,232,0.80)",
    border: "rgba(220,120,40,0.22)",
    borderStrong: "rgba(220,120,40,0.50)",
    text: "#8a4a10",
    iconBg: "rgba(220,120,40,0.10)",
    iconColor: "#c07820",
  },
  "90": {
    bg: "rgba(255,235,235,0.80)",
    border: "rgba(200,60,60,0.22)",
    borderStrong: "rgba(200,60,60,0.50)",
    text: "#8b2020",
    iconBg: "rgba(200,60,60,0.10)",
    iconColor: "#c03c3c",
  },
  vip: {
    bg: "rgba(247,238,243,0.85)",
    border: "rgba(172,92,127,0.22)",
    borderStrong: "rgba(172,92,127,0.50)",
    text: "#8a4070",
    iconBg: "rgba(172,92,127,0.12)",
    iconColor: "#ac5c7f",
  },
};

function formatILS(amount: number): string {
  return `₪${Math.round(amount).toLocaleString("he-IL")}`;
}

function computeRevenuePotential(clients: WinBackClient[]): number {
  return clients.reduce((sum, c) => {
    return (
      sum +
      (c.totalCompletedBookings > 0
        ? c.totalRevenue / c.totalCompletedBookings
        : 0)
    );
  }, 0);
}

function computeAudienceStats(clients: WinBackClient[]) {
  if (clients.length === 0) return null;
  const avgDays = Math.round(
    clients.reduce((s, c) => s + c.daysSinceLastVisit, 0) / clients.length,
  );
  const revenuePotential = computeRevenuePotential(clients);
  const serviceCounts: Record<string, number> = {};
  for (const c of clients) {
    serviceCounts[c.lastServiceName] =
      (serviceCounts[c.lastServiceName] ?? 0) + 1;
  }
  const commonService =
    Object.entries(serviceCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
  return { count: clients.length, avgDays, revenuePotential, commonService };
}

function computeRevenueImpact(clients: WinBackClient[]) {
  if (clients.length === 0) return null;
  const total = computeRevenuePotential(clients);
  const avg = total / clients.length;
  const halfCount = Math.max(1, Math.ceil(clients.length * 0.5));
  return {
    total,
    avg,
    count: clients.length,
    if1: avg,
    if3: avg * Math.min(3, clients.length),
    ifHalfCount: halfCount,
    ifHalf: avg * halfCount,
  };
}

// ── Summary card ─────────────────────────────────────────────────────────────

function CampaignSummaryCard({
  campaignTitle,
  audienceCount,
  revenuePotential,
  offer,
  tone,
  accent,
}: {
  campaignTitle: string;
  audienceCount: number;
  revenuePotential: number;
  offer: OfferType;
  tone: MessageTone;
  accent: (typeof ACCENT)[CampaignType];
}) {
  return (
    <div
      className="rounded-2xl px-5 py-4"
      style={{
        background: accent.bg,
        border: `1.5px solid ${accent.borderStrong}`,
        boxShadow: "0 2px 10px rgba(43,37,48,0.07)",
      }}
    >
      <p className="mb-0.5 text-xs font-bold uppercase tracking-wide" style={{ color: accent.iconColor }}>
        סיכום הקמפיין
      </p>
      <div className="mb-3 flex items-start justify-between gap-3">
        <p className="font-bold text-base leading-tight" style={{ color: "#2b2530" }}>
          {campaignTitle}
        </p>
        <span
          className="shrink-0 rounded-full px-2.5 py-0.5 text-sm font-bold tabular-nums"
          style={{
            background: "rgba(255,255,255,0.65)",
            color: accent.text,
            border: `1px solid ${accent.border}`,
          }}
        >
          {audienceCount} לקוחות
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
        {[
          { label: "פוטנציאל הכנסה", value: formatILS(revenuePotential), highlight: true },
          {
            label: "הטבה שנבחרה",
            value: offer === "none" ? "ללא הטבה" : WIN_BACK.offers[offer],
            highlight: offer !== "none",
          },
          { label: "טון הודעה", value: WIN_BACK.builder.tones[tone] },
          { label: "מצב שליחה", value: "ידנית בוואטסאפ" },
        ].map(({ label, value, highlight }) => (
          <div key={label} className="flex items-baseline gap-1.5">
            <span className="text-xs shrink-0" style={{ color: accent.text, opacity: 0.7 }}>
              {label}:
            </span>
            <span
              className="text-xs font-bold truncate"
              style={{ color: highlight ? accent.iconColor : "#2b2530" }}
            >
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Campaign-ready banner ─────────────────────────────────────────────────────

function CampaignReadyBanner({
  count,
  onStart,
}: {
  count: number;
  onStart: () => void;
}) {
  return (
    <div
      className="rounded-2xl px-5 py-4"
      style={{
        background: "rgba(34,197,94,0.06)",
        border: "1.5px solid rgba(34,197,94,0.22)",
      }}
    >
      <div className="mb-2.5 flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: "#1a9e4e" }} />
        <p className="font-bold text-sm" style={{ color: "#166534" }}>
          הקמפיין מוכן לשליחה
        </p>
      </div>
      <ul className="mb-4 space-y-1">
        {[
          `${count} לקוחות ממתינות לשליחה`,
          "הודעה מוכנה",
          "שליחה ידנית בוואטסאפ",
        ].map((item) => (
          <li key={item} className="flex items-center gap-1.5 text-xs" style={{ color: "#166534" }}>
            <span>•</span>
            {item}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onStart}
        className="w-full rounded-xl py-2.5 text-sm font-bold transition-all hover:shadow-sm"
        style={{
          background: "rgba(34,197,94,0.13)",
          color: "#166534",
          border: "1.5px solid rgba(34,197,94,0.32)",
        }}
      >
        התחילי שליחה
      </button>
    </div>
  );
}

// ── Stepper ───────────────────────────────────────────────────────────────────

type StepState = "done" | "active" | "idle";

function StepperBar({
  steps,
  accent,
  onStepClick,
}: {
  steps: { label: string; state: StepState }[];
  accent: (typeof ACCENT)[CampaignType];
  onStepClick: (idx: number) => void;
}) {
  return (
    <div className="flex items-start" dir="rtl">
      {steps.map((step, i) => {
        const isDone = step.state === "done";
        const isActive = step.state === "active";

        return (
          <div key={step.label} className="flex flex-1 flex-col items-center">
            <div className="flex w-full items-center">
              {i > 0 && (
                <div
                  className="h-px flex-1"
                  style={{
                    background:
                      isDone || isActive
                        ? accent.borderStrong
                        : "rgba(200,200,200,0.35)",
                  }}
                />
              )}

              <button
                type="button"
                onClick={() => onStepClick(i)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all"
                style={
                  isDone
                    ? {
                        background: accent.bg,
                        color: accent.text,
                        border: `1.5px solid ${accent.borderStrong}`,
                      }
                    : isActive
                      ? {
                          background: accent.iconBg,
                          color: accent.iconColor,
                          border: `1.5px solid ${accent.border}`,
                        }
                      : {
                          background: "rgba(200,200,200,0.12)",
                          color: "#8a8190",
                          border: "1px solid rgba(200,200,200,0.30)",
                        }
                }
              >
                {isDone ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </button>

              {i < steps.length - 1 && (
                <div
                  className="h-px flex-1"
                  style={{
                    background: isDone
                      ? accent.borderStrong
                      : "rgba(200,200,200,0.35)",
                  }}
                />
              )}
            </div>

            <span
              className="mt-1.5 text-center text-xs leading-tight"
              style={{
                color: isDone || isActive ? accent.text : "#8a8190",
                fontWeight: isActive ? 700 : isDone ? 600 : 400,
              }}
            >
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Step section ──────────────────────────────────────────────────────────────

function StepSection({
  step,
  title,
  icon: Icon,
  accent,
  children,
  isCollapsed,
  onToggle,
  isDone,
  sectionRef,
}: {
  step: number;
  title: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  accent: (typeof ACCENT)[CampaignType];
  children: React.ReactNode;
  isCollapsed?: boolean;
  onToggle?: () => void;
  isDone?: boolean;
  sectionRef?: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="space-y-3" ref={sectionRef}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2.5 text-right"
      >
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
            style={{
              background: accent.bg,
              color: accent.text,
              border: `1px solid ${accent.borderStrong}`,
            }}
          >
            {isDone ? <Check className="h-3.5 w-3.5" /> : step}
          </div>
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4" style={{ color: accent.iconColor }} />
            <h3 className="font-semibold text-base" style={{ color: "#2b2530" }}>
              {title}
            </h3>
          </div>
        </div>
        <ChevronDown
          className="h-4 w-4 shrink-0 transition-transform duration-200"
          style={{
            color: "#8a8190",
            transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
          }}
        />
      </button>
      {!isCollapsed && children}
    </div>
  );
}

// ── How it works ───────────────────────────────────────────────────────────────
const HOW_STEP_ICONS = [Megaphone, Gift, Send, CheckCircle2] as const;

function HowCampaignsWork() {
  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: "linear-gradient(135deg, #f7edf3 0%, #f3eef7 100%)",
        border: "1px solid rgba(172,92,127,0.18)",
      }}
    >
      <div className="mb-4 flex items-start gap-2.5">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
          style={{ background: "rgba(172,92,127,0.14)" }}
        >
          <Info className="h-4 w-4" style={{ color: "#ac5c7f" }} />
        </span>
        <div>
          <h2 className="font-semibold text-base tracking-tight" style={{ color: "#2b2530" }}>
            {WIN_BACK.how.title}
          </h2>
          <p className="mt-0.5 text-xs leading-5" style={{ color: "#8a8190" }}>
            {WIN_BACK.how.intro}
          </p>
        </div>
      </div>

      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {WIN_BACK.how.steps.map((step, i) => {
          const Icon = HOW_STEP_ICONS[i] ?? Megaphone;
          return (
            <li
              key={step.title}
              className="rounded-xl p-3.5"
              style={{ background: "rgba(255,255,255,0.75)", border: "1px solid rgba(172,92,127,0.12)" }}
            >
              <div className="mb-2 flex items-center gap-2">
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-bold"
                  style={{ background: "rgba(172,92,127,0.14)", color: "#ac5c7f" }}
                >
                  {i + 1}
                </span>
                <Icon className="h-3.5 w-3.5" style={{ color: "#ac5c7f" }} />
                <span className="text-sm font-semibold" style={{ color: "#2b2530" }}>
                  {step.title}
                </span>
              </div>
              <p className="text-xs leading-5" style={{ color: "#8a8190" }}>
                {step.body}
              </p>
            </li>
          );
        })}
      </ol>

      <div
        className="mt-4 flex items-start gap-2 rounded-xl px-3.5 py-2.5"
        style={{ background: "rgba(37,211,102,0.08)", border: "1px solid rgba(37,211,102,0.20)" }}
      >
        <MessageCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: "#1a9e4e" }} />
        <p className="text-xs leading-5" style={{ color: "#2b2530" }}>
          {WIN_BACK.how.note}
        </p>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function CampaignView({
  allCampaigns,
  metrics,
  businessName,
  defaultCampaignType,
}: CampaignViewProps) {
  const [selectedType, setSelectedType] = useState<CampaignType | null>(
    defaultCampaignType ?? null,
  );
  const [offer, setOffer] = useState<OfferType>("none");
  const [tone, setTone] = useState<MessageTone>("gentle");
  const [messageTemplate, setMessageTemplate] = useState<string>(
    defaultCampaignType
      ? getDefaultTemplate(defaultCampaignType, "gentle", "none")
      : "",
  );
  const [messageTouched, setMessageTouched] = useState(false);
  const [trackingStatus, setTrackingStatus] = useState<
    Record<string, TrackingStatus>
  >({});
  const [waOpenedSet, setWaOpenedSet] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const [copiedClientId, setCopiedClientId] = useState<string | null>(null);
  // Audience starts collapsed (it's pre-loaded — always "done"); message and send start collapsed
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    defaultCampaignType
      ? new Set(["audience", "message", "send"])
      : new Set(),
  );

  const audienceRef = useRef<HTMLDivElement>(null);
  const offerRef = useRef<HTMLDivElement>(null);
  const messageRef = useRef<HTMLDivElement>(null);
  const sendRef = useRef<HTMLDivElement>(null);

  function toggleSection(id: string) {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleSelectCampaign(type: CampaignType) {
    setSelectedType(type);
    setOffer("none");
    setTone("gentle");
    setMessageTemplate(getDefaultTemplate(type, "gentle", "none"));
    setMessageTouched(false);
    setTrackingStatus({});
    setWaOpenedSet(new Set());
    // Audience is always done; start with offer open, rest collapsed
    setCollapsedSections(new Set(["audience", "message", "send"]));
  }

  function handleToneChange(newTone: MessageTone) {
    setTone(newTone);
    if (selectedType) {
      setMessageTemplate(getDefaultTemplate(selectedType, newTone, offer));
      setMessageTouched(false);
    }
  }

  function handleOfferChange(newOffer: OfferType) {
    setOffer(newOffer);
    if (selectedType) {
      setMessageTemplate(getDefaultTemplate(selectedType, tone, newOffer));
      setMessageTouched(false);
    }
    // Guide user: collapse offer, open message
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      next.add("offer");
      next.delete("message");
      return next;
    });
  }

  function handleBack() {
    setSelectedType(null);
  }

  function handleStartSending() {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      next.delete("send");
      next.add("message");
      return next;
    });
    setTimeout(() => {
      sendRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  function cycleTracking(clientId: string) {
    const current = trackingStatus[clientId] ?? "pending";
    const idx = TRACKING_CYCLE.indexOf(current);
    const next = TRACKING_CYCLE[(idx + 1) % TRACKING_CYCLE.length];
    setTrackingStatus((prev) => ({ ...prev, [clientId]: next }));
  }

  function markSent(clientId: string) {
    setTrackingStatus((prev) => ({ ...prev, [clientId]: "sent" }));
  }

  function handleWaOpened(clientId: string) {
    setWaOpenedSet((prev) => new Set([...prev, clientId]));
  }

  async function copyToClipboard(text: string, clientId?: string) {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        if (clientId) {
          setCopiedClientId(clientId);
          setTimeout(() => setCopiedClientId(null), 2500);
        } else {
          setCopied(true);
          setTimeout(() => setCopied(false), 2500);
        }
      }
    } catch {
      // clipboard not available
    }
  }

  function scrollToRef(ref: React.RefObject<HTMLDivElement | null>) {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // ── Campaign builder ──────────────────────────────────────────────────────
  if (selectedType !== null) {
    const clients = allCampaigns[selectedType];
    const accent = ACCENT[selectedType];
    const campaign = WIN_BACK.campaigns[selectedType];
    const audienceWhy = WIN_BACK.audienceWhy[selectedType];
    const stats = computeAudienceStats(clients);
    const impact = computeRevenueImpact(clients);
    const previewClient = clients[0];
    const previewMessage = previewClient
      ? renderMessage(messageTemplate, {
          clientName: previewClient.fullName,
          businessName,
          lastService: previewClient.lastServiceName,
          offer: OFFER_TEXT[offer],
        })
      : "";

    const trackingSummary = {
      pending: 0,
      sent: 0,
      answered: 0,
      booked: 0,
      no_answer: 0,
    };
    for (const c of clients) {
      const s = trackingStatus[c.id] ?? "pending";
      trackingSummary[s]++;
    }

    const anySent = Object.values(trackingStatus).some((s) => s !== "pending");

    const stepStates: StepState[] = [
      "done",
      "done",
      offer !== "none" ? "done" : "active",
      offer !== "none" && (messageTouched || tone !== "gentle")
        ? "done"
        : offer !== "none"
          ? "active"
          : "idle",
      anySent ? "done" : offer !== "none" ? "active" : "idle",
    ];
    if (stepStates[2] === "done" && stepStates[3] === "idle") {
      stepStates[3] = "active";
    }

    const STEPPER_STEPS: { label: string; state: StepState }[] = [
      { label: "מטרה", state: stepStates[0] },
      { label: "קהל", state: stepStates[1] },
      { label: "הטבה", state: stepStates[2] },
      { label: "הודעה", state: stepStates[3] },
      { label: "שליחה", state: stepStates[4] },
    ];

    const SECTION_REFS = [audienceRef, offerRef, messageRef, sendRef];

    function handleStepperClick(idx: number) {
      if (idx === 0) {
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      const ref = SECTION_REFS[idx - 1];
      if (ref) scrollToRef(ref);
      const sectionId = ["audience", "offer", "message", "send"][idx - 1];
      if (sectionId) {
        setCollapsedSections((prev) => {
          const next = new Set(prev);
          next.delete(sectionId);
          return next;
        });
      }
    }

    return (
      <div className="space-y-5">
        {/* Back */}
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-1.5 text-sm font-medium transition-opacity hover:opacity-70"
          style={{ color: "#8a8190" }}
        >
          <ArrowRight className="h-4 w-4" />
          {WIN_BACK.builder.backLabel}
        </button>

        {/* Summary card */}
        <CampaignSummaryCard
          campaignTitle={campaign.title}
          audienceCount={clients.length}
          revenuePotential={stats?.revenuePotential ?? 0}
          offer={offer}
          tone={tone}
          accent={accent}
        />

        {/* Stepper */}
        <StepperBar
          steps={STEPPER_STEPS}
          accent={accent}
          onStepClick={handleStepperClick}
        />

        {/* Step 1: Goal banner */}
        <div
          className="rounded-2xl px-5 py-4"
          style={{
            background: accent.bg,
            border: `1.5px solid ${accent.borderStrong}`,
          }}
        >
          <div className="mb-1.5 flex items-center gap-1.5">
            <Target
              className="h-3.5 w-3.5"
              style={{ color: accent.iconColor }}
            />
            <span
              className="text-xs font-bold uppercase tracking-wide"
              style={{ color: accent.text }}
            >
              שלב 1 — מטרת הקמפיין
            </span>
          </div>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2
                className="font-bold text-lg leading-tight"
                style={{ color: "#2b2530" }}
              >
                {campaign.title}
              </h2>
              <p className="mt-1 text-sm" style={{ color: accent.text }}>
                {campaign.goal}
              </p>
            </div>
            <span
              className="shrink-0 rounded-full px-3 py-1 text-sm font-bold tabular-nums"
              style={{
                background: "rgba(255,255,255,0.65)",
                color: accent.text,
                border: `1px solid ${accent.border}`,
              }}
            >
              {clients.length} {WIN_BACK.builder.audienceCount}
            </span>
          </div>
        </div>

        {/* Step 2: Audience */}
        <StepSection
          step={2}
          title={WIN_BACK.steps.audienceLabel}
          icon={Users}
          accent={accent}
          isCollapsed={collapsedSections.has("audience")}
          onToggle={() => toggleSection("audience")}
          isDone={true}
          sectionRef={audienceRef}
        >
          <Card className="space-y-4 p-5">
            {stats ? (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {(
                    [
                      {
                        label: WIN_BACK.builder.audienceCount,
                        value: String(stats.count),
                      },
                      {
                        label: WIN_BACK.builder.audienceRevenue,
                        value: formatILS(stats.revenuePotential),
                      },
                      {
                        label: WIN_BACK.builder.audienceAvgDays,
                        value: `${stats.avgDays} ימים`,
                      },
                      {
                        label: WIN_BACK.builder.audienceCommonService,
                        value: stats.commonService,
                      },
                    ] as const
                  ).map(({ label, value }) => (
                    <div
                      key={label}
                      className="rounded-xl px-3 py-3"
                      style={{
                        background: "rgba(255,255,255,0.80)",
                        border: `1px solid ${accent.border}`,
                      }}
                    >
                      <p
                        className="text-base font-bold tabular-nums leading-tight"
                        style={{ color: accent.text }}
                      >
                        {value}
                      </p>
                      <p
                        className="mt-0.5 text-xs leading-tight"
                        style={{ color: "#8a8190" }}
                      >
                        {label}
                      </p>
                    </div>
                  ))}
                </div>

                <div
                  className="rounded-xl px-4 py-3"
                  style={{
                    background: accent.iconBg,
                    border: `1px solid ${accent.border}`,
                  }}
                >
                  <p
                    className="text-sm font-medium"
                    style={{ color: accent.text }}
                  >
                    {audienceWhy}
                  </p>
                </div>

                {impact && (
                  <div className="space-y-2.5 border-t border-border pt-3">
                    <div className="flex items-center gap-2">
                      <TrendingUp
                        className="h-3.5 w-3.5"
                        style={{ color: accent.iconColor }}
                      />
                      <p
                        className="text-xs font-bold"
                        style={{ color: "#2b2530" }}
                      >
                        {WIN_BACK.revenueImpact.sectionTitle}
                      </p>
                      <span className="text-xs" style={{ color: "#8a8190" }}>
                        — {WIN_BACK.revenueImpact.sectionSubtitle}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {(
                        [
                          {
                            label: WIN_BACK.revenueImpact.if1Returns,
                            value: formatILS(impact.if1),
                          },
                          {
                            label: WIN_BACK.revenueImpact.ifCountReturns(
                              Math.min(3, impact.count),
                            ),
                            value: formatILS(impact.if3),
                          },
                          {
                            label:
                              WIN_BACK.revenueImpact.ifCountReturns(
                                impact.ifHalfCount,
                              ) + " (50%)",
                            value: formatILS(impact.ifHalf),
                          },
                        ] as const
                      ).map(({ label, value }) => (
                        <div
                          key={label}
                          className="flex items-center justify-between gap-2"
                        >
                          <span
                            className="text-sm"
                            style={{ color: "#6a6070" }}
                          >
                            {label}
                          </span>
                          <span
                            className="font-bold text-sm tabular-nums"
                            style={{ color: accent.text }}
                          >
                            ~{value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="py-4 text-center">
                <p
                  className="text-sm font-semibold"
                  style={{ color: "#2b2530" }}
                >
                  {WIN_BACK.builder.noRecipientsTitle}
                </p>
                <p className="mt-1 text-xs" style={{ color: "#8a8190" }}>
                  {WIN_BACK.builder.noRecipientsBody}
                </p>
              </div>
            )}
          </Card>
        </StepSection>

        {/* Step 3: Offer */}
        <StepSection
          step={3}
          title={WIN_BACK.steps.offerLabel}
          icon={Gift}
          accent={accent}
          isCollapsed={collapsedSections.has("offer")}
          onToggle={() => toggleSection("offer")}
          isDone={offer !== "none"}
          sectionRef={offerRef}
        >
          <Card className="space-y-4 p-5">
            <p className="text-sm" style={{ color: "#8a8190" }}>
              {WIN_BACK.offers.sectionSubtitle}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {OFFER_OPTIONS.map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => handleOfferChange(o)}
                  className="rounded-xl px-3 py-2.5 text-sm font-semibold text-right transition-all hover:shadow-sm"
                  style={
                    offer === o
                      ? {
                          background: accent.bg,
                          color: accent.text,
                          border: `1.5px solid ${accent.borderStrong}`,
                        }
                      : {
                          background: "rgba(200,200,200,0.10)",
                          color: "#4a4050",
                          border: "1px solid rgba(200,200,200,0.28)",
                        }
                  }
                >
                  {WIN_BACK.offers[o]}
                </button>
              ))}
            </div>
            {offer !== "none" && (
              <p className="text-xs font-medium" style={{ color: accent.text }}>
                ✓ ההטבה תשולב בהודעה אוטומטית
              </p>
            )}
          </Card>
        </StepSection>

        {/* Step 4: Message */}
        <StepSection
          step={4}
          title={WIN_BACK.steps.messageLabel}
          icon={MessageCircle}
          accent={accent}
          isCollapsed={collapsedSections.has("message")}
          onToggle={() => toggleSection("message")}
          isDone={messageTouched || tone !== "gentle"}
          sectionRef={messageRef}
        >
          <Card className="space-y-4 p-5">
            {/* Tone selector */}
            <div className="flex items-center justify-between gap-2">
              <span
                className="text-xs font-semibold"
                style={{ color: "#8a8190" }}
              >
                {WIN_BACK.builder.toneLabel}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {TONE_OPTIONS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleToneChange(t)}
                    className="rounded-full px-3 py-1 text-xs font-semibold transition-all"
                    style={
                      tone === t
                        ? {
                            background: accent.bg,
                            color: accent.text,
                            border: `1px solid ${accent.borderStrong}`,
                          }
                        : {
                            background: "rgba(200,200,200,0.12)",
                            color: "#8a8190",
                            border: "1px solid rgba(200,200,200,0.25)",
                          }
                    }
                  >
                    {WIN_BACK.builder.tones[t]}
                  </button>
                ))}
              </div>
            </div>

            <Textarea
              value={messageTemplate}
              onChange={(e) => {
                setMessageTemplate(e.target.value);
                setMessageTouched(true);
              }}
              rows={4}
              dir="rtl"
            />

            {/* Variable pills */}
            <div className="space-y-2">
              <p
                className="text-xs font-semibold"
                style={{ color: "#8a8190" }}
              >
                {WIN_BACK.builder.variablesTitle}
              </p>
              <div className="flex flex-wrap gap-2">
                {WIN_BACK.builder.variables.map((v) => (
                  <span
                    key={v}
                    className="rounded-md px-2 py-0.5 font-mono text-xs"
                    style={{
                      background: "rgba(172,92,127,0.08)",
                      color: "#8a4070",
                      border: "1px solid rgba(172,92,127,0.18)",
                    }}
                  >
                    {v}
                  </span>
                ))}
              </div>
            </div>

            {/* Preview */}
            {previewClient && (
              <div className="space-y-3 border-t border-border pt-4">
                <div className="flex items-center justify-between gap-2">
                  <p
                    className="text-xs font-semibold"
                    style={{ color: "#2b2530" }}
                  >
                    {WIN_BACK.builder.previewTitle}
                  </p>
                  <span className="text-xs" style={{ color: "#8a8190" }}>
                    {WIN_BACK.builder.previewFor} {previewClient.fullName}
                  </span>
                </div>
                <div
                  className="rounded-2xl p-4"
                  style={{
                    background: "rgba(37,211,102,0.06)",
                    border: "1px solid rgba(37,211,102,0.15)",
                  }}
                >
                  <p
                    className="whitespace-pre-line text-sm leading-relaxed"
                    style={{ color: "#2b2530" }}
                  >
                    {previewMessage}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => copyToClipboard(previewMessage)}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-90"
                    style={{
                      background: "rgba(200,200,200,0.12)",
                      color: "#4a4050",
                      border: "1px solid rgba(200,200,200,0.25)",
                    }}
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        {WIN_BACK.builder.messageCopied}
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        {WIN_BACK.builder.copyMessage}
                      </>
                    )}
                  </button>
                  {buildWhatsAppUrl(previewClient.phone, previewMessage) && (
                    <a
                      href={buildWhatsAppUrl(previewClient.phone, previewMessage)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-90"
                      style={{
                        background: "rgba(37,211,102,0.10)",
                        color: "#1a9e4e",
                        border: "1px solid rgba(37,211,102,0.22)",
                      }}
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      פתיחה בוואטסאפ
                    </a>
                  )}
                </div>
              </div>
            )}
          </Card>
        </StepSection>

        {/* Campaign ready banner — shown when there are clients */}
        {clients.length > 0 && (
          <CampaignReadyBanner count={clients.length} onStart={handleStartSending} />
        )}

        {/* Step 5: Send & Track */}
        <StepSection
          step={5}
          title={WIN_BACK.steps.sendLabel}
          icon={Send}
          accent={accent}
          isCollapsed={collapsedSections.has("send")}
          onToggle={() => toggleSection("send")}
          isDone={anySent}
          sectionRef={sendRef}
        >
          <Card className="overflow-hidden p-0">
            {/* WhatsApp manual note */}
            <div
              className="flex items-start gap-2.5 border-b border-border px-5 py-4"
              style={{
                background: "rgba(37,211,102,0.04)",
              }}
            >
              <Info
                className="mt-0.5 h-4 w-4 shrink-0"
                style={{ color: "#1a9e4e" }}
              />
              <p
                className="text-sm leading-relaxed"
                style={{ color: "#166534" }}
              >
                כרגע השליחה מתבצעת ידנית דרך וואטסאפ, לקוחה אחרי לקוחה.
                שליחה אוטומטית תתווסף בהמשך.
              </p>
            </div>

            {/* Tracking summary bar */}
            <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3">
              {trackingSummary.pending > 0 && (
                <span
                  className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                  style={TRACKING_STYLE.pending}
                >
                  {WIN_BACK.tracking.summaryPending(trackingSummary.pending)}
                </span>
              )}
              {trackingSummary.sent > 0 && (
                <span
                  className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                  style={TRACKING_STYLE.sent}
                >
                  {WIN_BACK.tracking.summarySent(trackingSummary.sent)}
                </span>
              )}
              {trackingSummary.answered > 0 && (
                <span
                  className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                  style={TRACKING_STYLE.answered}
                >
                  {WIN_BACK.tracking.summaryAnswered(trackingSummary.answered)}
                </span>
              )}
              {trackingSummary.booked > 0 && (
                <span
                  className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                  style={TRACKING_STYLE.booked}
                >
                  {WIN_BACK.tracking.summaryBooked(trackingSummary.booked)}
                </span>
              )}
              {trackingSummary.no_answer > 0 && (
                <span
                  className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                  style={TRACKING_STYLE.no_answer}
                >
                  {WIN_BACK.tracking.summaryNoAnswer(trackingSummary.no_answer)}
                </span>
              )}
              <span className="mr-auto text-xs" style={{ color: "#8a8190" }}>
                {WIN_BACK.tracking.localNote}
              </span>
            </div>

            {/* Recipient list */}
            {clients.length === 0 ? (
              <div className="space-y-2 p-8 text-center">
                <p
                  className="font-semibold text-base"
                  style={{ color: "#2b2530" }}
                >
                  {WIN_BACK.builder.noRecipientsTitle}
                </p>
                <p className="text-sm" style={{ color: "#8a8190" }}>
                  {WIN_BACK.builder.noRecipientsBody}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {clients.map((client) => {
                  const msg = renderMessage(messageTemplate, {
                    clientName: client.fullName,
                    businessName,
                    lastService: client.lastServiceName,
                    offer: OFFER_TEXT[offer],
                  });
                  const status = trackingStatus[client.id] ?? "pending";
                  const isCopied = copiedClientId === client.id;
                  const waOpened = waOpenedSet.has(client.id);
                  const isPending = status === "pending";

                  return (
                    <div
                      key={client.id}
                      className="flex flex-col gap-2.5 px-4 py-3 sm:flex-row sm:items-center sm:gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p
                          className="text-sm font-semibold leading-tight"
                          style={{ color: "#2b2530" }}
                        >
                          {client.fullName}
                        </p>
                        <p
                          className="mt-0.5 text-xs"
                          style={{ color: "#8a8190" }}
                        >
                          {WIN_BACK.builder.daysAgo(client.daysSinceLastVisit)}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {/* Send WhatsApp */}
                        {buildWhatsAppUrl(client.phone, msg) ? (
                          <a
                            href={buildWhatsAppUrl(client.phone, msg)!}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => handleWaOpened(client.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-opacity hover:opacity-90"
                            style={{
                              background: "rgba(37,211,102,0.10)",
                              color: "#1a9e4e",
                              border: "1px solid rgba(37,211,102,0.22)",
                            }}
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                            פתיחה בוואטסאפ
                          </a>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold opacity-40 cursor-not-allowed"
                            title="מספר טלפון לא תקין"
                            style={{
                              background: "rgba(37,211,102,0.06)",
                              color: "#1a9e4e",
                              border: "1px solid rgba(37,211,102,0.12)",
                            }}
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                            פתיחה בוואטסאפ
                          </span>
                        )}

                        {/* "סמני כנשלחה" — appears after WA opened while still pending */}
                        {waOpened && isPending && (
                          <button
                            type="button"
                            onClick={() => markSent(client.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-opacity hover:opacity-90"
                            style={{
                              background: "rgba(59,130,246,0.10)",
                              color: "#1d4ed8",
                              border: "1.5px solid rgba(59,130,246,0.28)",
                            }}
                          >
                            <Check className="h-3.5 w-3.5" />
                            סמני כנשלחה
                          </button>
                        )}

                        {/* Copy message */}
                        <button
                          type="button"
                          onClick={() => copyToClipboard(msg, client.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-opacity hover:opacity-90"
                          style={{
                            background: "rgba(200,200,200,0.10)",
                            color: "#4a4050",
                            border: "1px solid rgba(200,200,200,0.25)",
                          }}
                        >
                          {isCopied ? (
                            <Check
                              className="h-3.5 w-3.5"
                              style={{ color: "#1a9e4e" }}
                            />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                          {isCopied ? "הועתק" : "העתקי"}
                        </button>

                        {/* Tracking status badge (non-pending) — click to cycle */}
                        {!isPending && (
                          <button
                            type="button"
                            onClick={() => cycleTracking(client.id)}
                            className="rounded-full px-2.5 py-1 text-xs font-semibold transition-all hover:opacity-80"
                            style={TRACKING_STYLE[status]}
                            title={WIN_BACK.tracking.statusHint}
                          >
                            {TRACKING_LABELS[status]}
                          </button>
                        )}

                        {/* Client profile */}
                        <Link
                          href={`/clients/${client.id}`}
                          className="rounded-lg p-1.5 transition-colors hover:bg-surface"
                          title={WIN_BACK.builder.openProfile}
                        >
                          <User
                            className="h-3.5 w-3.5"
                            style={{ color: "#8a8190" }}
                          />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </StepSection>
      </div>
    );
  }

  // ── Campaign selector (default view) ────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Plain-language explainer — what a campaign is and how you send it */}
      <HowCampaignsWork />

      {/* Overview metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div
          className="rounded-2xl px-4 py-4"
          style={{
            background:
              metrics.totalRecoverable > 0
                ? "rgba(247,238,243,0.85)"
                : "rgba(255,255,255,0.90)",
            border: "1px solid rgba(172,92,127,0.22)",
            boxShadow: "0 1px 6px rgba(43,37,48,0.06)",
          }}
        >
          <div
            className="mb-3 flex h-8 w-8 items-center justify-center rounded-xl"
            style={{ background: "rgba(172,92,127,0.12)" }}
          >
            <Users className="h-4 w-4" style={{ color: "#ac5c7f" }} />
          </div>
          <p
            className="text-2xl font-bold tabular-nums"
            style={{
              color: metrics.totalRecoverable > 0 ? "#8a4070" : "#2b2530",
            }}
          >
            {metrics.totalRecoverable}
          </p>
          <p
            className="mt-1 text-xs font-medium leading-tight"
            style={{ color: "#8a8190" }}
          >
            {WIN_BACK.metrics.totalRecoverable}
          </p>
        </div>

        <div
          className="rounded-2xl px-4 py-4"
          style={{
            background: "rgba(255,255,255,0.90)",
            border: "1px solid var(--border)",
            boxShadow: "0 1px 6px rgba(43,37,48,0.06)",
          }}
        >
          <div
            className="mb-3 flex h-8 w-8 items-center justify-center rounded-xl"
            style={{ background: "rgba(184,150,10,0.10)" }}
          >
            <Sparkles className="h-4 w-4" style={{ color: "#b87c1e" }} />
          </div>
          <p
            className="text-2xl font-bold tabular-nums"
            style={{ color: "#7a6400" }}
          >
            {formatILS(metrics.revenuePotential)}
          </p>
          <p
            className="mt-1 text-xs font-medium leading-tight"
            style={{ color: "#8a8190" }}
          >
            {WIN_BACK.metrics.revenuePotential}
          </p>
        </div>

        <div
          className="rounded-2xl px-4 py-4"
          style={{
            background: "rgba(255,255,255,0.90)",
            border: "1px solid var(--border)",
            boxShadow: "0 1px 6px rgba(43,37,48,0.06)",
          }}
        >
          <div
            className="mb-3 flex h-8 w-8 items-center justify-center rounded-xl"
            style={{ background: "rgba(172,92,127,0.08)" }}
          >
            <Megaphone className="h-4 w-4" style={{ color: "#ac5c7f" }} />
          </div>
          <p
            className="text-2xl font-bold tabular-nums"
            style={{ color: "#2b2530" }}
          >
            {CAMPAIGN_ORDER.length}
          </p>
          <p
            className="mt-1 text-xs font-medium leading-tight"
            style={{ color: "#8a8190" }}
          >
            {WIN_BACK.metrics.campaignsAvailable}
          </p>
        </div>

        <div
          className="rounded-2xl px-4 py-4"
          style={{
            background: "rgba(255,255,255,0.90)",
            border: "1px solid var(--border)",
            boxShadow: "0 1px 6px rgba(43,37,48,0.06)",
          }}
        >
          <div
            className="mb-3 flex h-8 w-8 items-center justify-center rounded-xl"
            style={{ background: "rgba(37,211,102,0.08)" }}
          >
            <MessageCircle className="h-4 w-4" style={{ color: "#1a9e4e" }} />
          </div>
          <p
            className="text-2xl font-bold tabular-nums"
            style={{ color: "#2b2530" }}
          >
            {metrics.totalRecoverable}
          </p>
          <p
            className="mt-1 text-xs font-medium leading-tight"
            style={{ color: "#8a8190" }}
          >
            {WIN_BACK.metrics.messagesReady}
          </p>
        </div>
      </div>

      {/* Campaign cards */}
      <div>
        <h2
          className="mb-4 font-semibold text-base"
          style={{ color: "#2b2530" }}
        >
          {WIN_BACK.selectCampaignTitle}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {CAMPAIGN_ORDER.map((type) => {
            const accent = ACCENT[type];
            const count = allCampaigns[type].length;
            const campaign = WIN_BACK.campaigns[type];
            const revPotential = computeRevenuePotential(allCampaigns[type]);

            return (
              <div
                key={type}
                className="flex flex-col gap-4 rounded-2xl p-5"
                style={{
                  background: "rgba(255,255,255,0.92)",
                  border: `1.5px solid ${accent.border}`,
                  boxShadow: "0 1px 6px rgba(43,37,48,0.06)",
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p
                      className="font-bold text-sm leading-tight"
                      style={{ color: "#2b2530" }}
                    >
                      {campaign.title}
                    </p>
                    <p
                      className="mt-1 text-xs leading-relaxed"
                      style={{ color: "#8a8190" }}
                    >
                      {campaign.goal}
                    </p>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums"
                    style={{
                      background:
                        count > 0 ? accent.bg : "rgba(200,200,200,0.15)",
                      color: count > 0 ? accent.text : "#8a8190",
                      border: `1px solid ${count > 0 ? accent.border : "rgba(200,200,200,0.30)"}`,
                    }}
                  >
                    {count}
                  </span>
                </div>

                <div
                  className="flex items-center justify-between text-xs"
                  style={{ color: "#8a8190" }}
                >
                  <span>
                    פוטנציאל:{" "}
                    <strong style={{ color: "#2b2530" }}>
                      {formatILS(revPotential)}
                    </strong>
                  </span>
                  <span
                    className="rounded-full px-2 py-0.5 text-xs"
                    style={{
                      background: accent.iconBg,
                      color: accent.iconColor,
                    }}
                  >
                    {campaign.recommendedTone}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleSelectCampaign(type)}
                  className="mt-auto w-full rounded-xl py-2.5 text-sm font-semibold transition-all hover:shadow-sm"
                  style={{
                    background:
                      count > 0 ? accent.bg : "rgba(200,200,200,0.10)",
                    color: count > 0 ? accent.text : "#8a8190",
                    border: `1.5px solid ${count > 0 ? accent.borderStrong : "rgba(200,200,200,0.25)"}`,
                  }}
                >
                  {campaign.cta}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
