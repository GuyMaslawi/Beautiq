"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Sparkles, Send, ArrowLeft, User, Wand2, X, MessageCircle } from "lucide-react";
import { ASSISTANT } from "@/lib/constants/he";
import { loadAssistantContextAction } from "@/server/assistant/actions";
import {
  type AssistantContext,
  type AssistantAnswer,
  type AssistantIntent,
  SUGGESTED_QUESTIONS,
  answerIntent,
  answerText,
  buildBriefing,
} from "@/lib/assistant/engine";

interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  text?: string;
  answer?: AssistantAnswer;
}

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; context: AssistantContext }
  | { status: "no-business" }
  | { status: "error" };

/* ── Answer bubble ───────────────────────────────────────────────────────── */
function AnswerBubble({ answer, onClose }: { answer: AssistantAnswer; onClose: () => void }) {
  return (
    <div className="flex items-start gap-2">
      <span
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
        style={{ background: "linear-gradient(135deg,#c76f93,#ac5c7f)" }}
      >
        <Sparkles className="h-3.5 w-3.5 text-white" />
      </span>
      <div className="min-w-0 flex-1 rounded-2xl rounded-tr-sm p-3.5 aura-card">
        <p className="font-display mb-1.5 text-sm font-semibold" style={{ color: "var(--foreground)" }}>
          {answer.title}
        </p>
        <div className="space-y-1">
          {answer.lines.map((line, i) => (
            <p key={i} className="text-[13px] leading-6" style={{ color: "var(--muted-dark, var(--foreground))" }}>
              {line}
            </p>
          ))}
        </div>
        {answer.actions.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {answer.actions.map((a) => (
              <Link
                key={a.href + a.label}
                href={a.href}
                onClick={onClose}
                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-opacity hover:opacity-80"
                style={{
                  background: "rgba(172,92,127,0.10)",
                  color: "var(--primary)",
                  border: "1px solid rgba(172,92,127,0.22)",
                }}
              >
                {a.label}
                <ArrowLeft className="h-3 w-3" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── User bubble ─────────────────────────────────────────────────────────── */
function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex items-start justify-end gap-2">
      <div
        className="max-w-[80%] rounded-2xl rounded-tl-sm px-3.5 py-2 text-[13px] leading-6 text-white"
        style={{ background: "linear-gradient(135deg,#c76f93,#ac5c7f)" }}
      >
        {text}
      </div>
      <span
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
        style={{ background: "rgba(43,37,48,0.08)" }}
      >
        <User className="h-3.5 w-3.5" style={{ color: "var(--muted)" }} />
      </span>
    </div>
  );
}

/* ── Root widget ─────────────────────────────────────────────────────────── */
export function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [load, setLoad] = useState<LoadState>({ status: "idle" });
  const [refreshing, setRefreshing] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const nextId = useRef(1);
  const inFlight = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function applyResult(res: Awaited<ReturnType<typeof loadAssistantContextAction>>) {
    if (res.ok) setLoad({ status: "ready", context: res.context });
    else if (res.reason === "no-business") setLoad({ status: "no-business" });
    else if (res.reason === "error") setLoad({ status: "error" });
    else setLoad({ status: "idle" }); // locked — shouldn't happen (widget is gated), retry next open
  }

  // Full (blocking) load — shows the spinner. Used on the first open and on retry.
  function fetchContext() {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoad({ status: "loading" });
    loadAssistantContextAction()
      .then(applyResult)
      // Network/serialization failure — surface it instead of spinning forever.
      .catch(() => setLoad({ status: "error" }))
      .finally(() => {
        inFlight.current = false;
      });
  }

  // Silent background refresh — keeps the current answers on screen while it
  // re-pulls the latest business data, so anything the owner added since the
  // last open (new clients, bookings, services…) is picked up automatically.
  function refreshContext() {
    if (inFlight.current) return;
    inFlight.current = true;
    setRefreshing(true);
    loadAssistantContextAction()
      .then((res) => {
        if (res.ok || res.reason !== "error") applyResult(res);
        // A transient error keeps the existing (still-useful) data on screen.
      })
      .catch(() => {
        /* keep showing existing data */
      })
      .finally(() => {
        inFlight.current = false;
        setRefreshing(false);
      });
  }

  function toggleOpen() {
    if (!open) {
      // Opening: first time → blocking load; already loaded → silent refresh
      // (learns newly-added data); previous error → retry with the spinner.
      if (load.status === "idle" || load.status === "error") fetchContext();
      else if (load.status === "ready") refreshContext();
      // no-business → nothing to refresh until a business exists.
    }
    setOpen((v) => !v);
  }

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, open, load.status]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const context = load.status === "ready" ? load.context : null;
  const briefing = context ? buildBriefing(context) : [];

  function ask(userText: string, answer: AssistantAnswer) {
    setMessages((prev) => [
      ...prev,
      { id: nextId.current++, role: "user", text: userText },
      { id: nextId.current++, role: "assistant", answer },
    ]);
  }

  function handleChip(intent: AssistantIntent, label: string) {
    if (!context) return;
    ask(label, answerIntent(context, intent));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || !context) return;
    ask(text, answerText(context, text));
    setInput("");
  }

  const close = () => setOpen(false);

  return (
    <>
      {/* Launcher — fixed bottom-left */}
      <button
        type="button"
        onClick={toggleOpen}
        aria-label={open ? ASSISTANT.closeAria : ASSISTANT.launcherAria}
        aria-expanded={open}
        className="group fixed bottom-5 left-5 z-50 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition-all duration-300 hover:scale-105 md:bottom-6 md:left-6"
        style={{
          background: "linear-gradient(135deg,#c76f93,#ac5c7f)",
          boxShadow: "0 10px 30px rgba(172,92,127,0.45)",
        }}
      >
        {open ? (
          <X className="h-6 w-6" />
        ) : (
          <>
            <MessageCircle className="h-6 w-6" />
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white">
              <Sparkles className="h-2.5 w-2.5" style={{ color: "#ac5c7f" }} />
            </span>
          </>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div
          dir="rtl"
          className="animate-in fade-in slide-in-from-bottom-2 fixed bottom-24 left-4 z-50 flex max-h-[min(70vh,560px)] w-[calc(100vw-2rem)] max-w-[380px] flex-col overflow-hidden rounded-[1.5rem] duration-200 md:bottom-24 md:left-6"
          style={{
            background: "var(--background, #fff)",
            border: "1px solid var(--border)",
            boxShadow: "0 24px 60px rgba(60,20,40,0.28)",
          }}
          role="dialog"
          aria-label={ASSISTANT.headerTitle}
        >
          {/* Header */}
          <div
            className="flex items-center gap-2.5 px-4 py-3.5"
            style={{ background: "linear-gradient(135deg,#c76f93,#ac5c7f)" }}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
              <Wand2 className="h-4.5 w-4.5 text-white" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white">{ASSISTANT.headerTitle}</p>
              <p className="truncate text-xs text-white/80">{ASSISTANT.headerSubtitle}</p>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label={ASSISTANT.closeAria}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/90 transition-colors hover:bg-white/15"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>

          {/* Body */}
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {load.status === "loading" && (
              <div className="flex flex-col items-center justify-center gap-3 py-10">
                <span
                  className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
                  style={{ borderColor: "rgba(172,92,127,0.30)", borderTopColor: "transparent" }}
                />
                <p className="text-sm" style={{ color: "var(--muted)" }}>
                  {ASSISTANT.loading}
                </p>
              </div>
            )}

            {load.status === "error" && (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-full"
                  style={{ background: "rgba(172,92,127,0.10)" }}
                >
                  <Sparkles className="h-5 w-5" style={{ color: "var(--primary)" }} />
                </span>
                <div>
                  <p className="font-display text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                    {ASSISTANT.errorTitle}
                  </p>
                  <p className="mt-1 text-sm leading-6" style={{ color: "var(--muted)" }}>
                    {ASSISTANT.errorBody}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={fetchContext}
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-white"
                  style={{ background: "linear-gradient(135deg,#c76f93,#ac5c7f)" }}
                >
                  {ASSISTANT.retry}
                </button>
              </div>
            )}

            {load.status === "no-business" && (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <Sparkles className="h-7 w-7" style={{ color: "var(--primary)" }} />
                <p className="text-sm leading-6" style={{ color: "var(--muted)" }}>
                  {ASSISTANT.noBusiness}
                </p>
                <Link
                  href="/dashboard"
                  onClick={close}
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-white"
                  style={{ background: "linear-gradient(135deg,#c76f93,#ac5c7f)" }}
                >
                  {ASSISTANT.answers.openLabel}
                </Link>
              </div>
            )}

            {load.status === "ready" && (
              <>
                {refreshing && (
                  <div className="flex items-center justify-center gap-2 pb-1">
                    <span
                      className="h-3 w-3 animate-spin rounded-full border-2"
                      style={{ borderColor: "rgba(172,92,127,0.30)", borderTopColor: "transparent" }}
                    />
                    <span className="text-xs" style={{ color: "var(--muted)" }}>
                      {ASSISTANT.refreshing}
                    </span>
                  </div>
                )}

                {/* Greeting + briefing */}
                <div className="flex items-start gap-2">
                  <span
                    className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                    style={{ background: "linear-gradient(135deg,#c76f93,#ac5c7f)" }}
                  >
                    <Sparkles className="h-3.5 w-3.5 text-white" />
                  </span>
                  <div className="min-w-0 flex-1 rounded-2xl rounded-tr-sm p-3.5 aura-card">
                    <p className="text-[13px] leading-6" style={{ color: "var(--foreground)" }}>
                      {ASSISTANT.greeting}
                    </p>
                    {briefing.length > 0 && (
                      <ul className="mt-2.5 space-y-1.5 border-t pt-2.5" style={{ borderColor: "var(--border)" }}>
                        {briefing.map((line, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-[13px] leading-6"
                            style={{ color: "var(--muted-dark, var(--foreground))" }}
                          >
                            <span
                              className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full"
                              style={{ background: "var(--primary)" }}
                            />
                            <span>{line}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {/* Conversation */}
                {messages.map((m) =>
                  m.role === "user" ? (
                    <UserBubble key={m.id} text={m.text ?? ""} />
                  ) : (
                    <AnswerBubble key={m.id} answer={m.answer!} onClose={close} />
                  ),
                )}

                {/* Suggested chips (always available) */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <button
                      key={q.intent}
                      type="button"
                      onClick={() => handleChip(q.intent, q.label)}
                      className="rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 hover:-translate-y-0.5"
                      style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                    >
                      {q.label}
                    </button>
                  ))}
                </div>

                <div ref={endRef} />
              </>
            )}
          </div>

          {/* Input */}
          {load.status === "ready" && (
            <form
              onSubmit={handleSubmit}
              className="flex items-center gap-2 border-t px-3 py-3"
              style={{ borderColor: "var(--border)" }}
            >
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={ASSISTANT.inputPlaceholder}
                className="bg-surface border-border text-foreground placeholder:text-muted-light h-11 w-full rounded-xl border px-3.5 text-sm outline-none transition-all duration-200 focus:border-primary focus:ring-2 focus:ring-primary/20"
                aria-label={ASSISTANT.inputPlaceholder}
              />
              <button
                type="submit"
                disabled={!input.trim()}
                aria-label={ASSISTANT.send}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white transition-transform duration-200 hover:-translate-y-0.5 disabled:opacity-40 disabled:hover:translate-y-0"
                style={{ background: "linear-gradient(135deg,#c76f93,#ac5c7f)" }}
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          )}
        </div>
      )}
    </>
  );
}
