"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Sparkles, Send, ArrowLeft, User, Wand2, ShieldCheck } from "lucide-react";
import { ASSISTANT } from "@/lib/constants/he";
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
  text?: string; // for user messages
  answer?: AssistantAnswer; // for assistant messages
}

/* ── Daily briefing ──────────────────────────────────────────────────────── */
function Briefing({ lines }: { lines: string[] }) {
  return (
    <div
      className="relative overflow-hidden rounded-[1.4rem] px-6 py-5"
      style={{
        background: "linear-gradient(150deg, #2b0e1f 0%, #3e1630 55%, #2c1527 100%)",
        border: "1px solid rgba(172,92,127,0.28)",
        boxShadow: "0 8px 30px rgba(120,40,80,0.22)",
      }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse at 85% 0%, rgba(199,111,147,0.22) 0%, transparent 55%)" }}
      />
      <div className="relative">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: "rgba(212,168,83,0.18)", border: "1px solid rgba(212,168,83,0.30)" }}>
            <Wand2 className="h-4 w-4" style={{ color: "#e5bd6a" }} />
          </span>
          <h3 className="text-sm font-semibold text-white">{ASSISTANT.briefingTitle}</h3>
        </div>
        {lines.length === 0 ? (
          <p className="text-sm leading-6" style={{ color: "rgba(255,255,255,0.60)" }}>{ASSISTANT.briefingEmpty}</p>
        ) : (
          <ul className="space-y-1.5">
            {lines.map((line, i) => (
              <li key={i} className="flex items-start gap-2 text-sm leading-6" style={{ color: "rgba(255,255,255,0.88)" }}>
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "#e5bd6a" }} />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ── Answer bubble ───────────────────────────────────────────────────────── */
function AnswerBubble({ answer }: { answer: AssistantAnswer }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: "linear-gradient(135deg,#c76f93,#ac5c7f)" }}>
        <Sparkles className="h-4 w-4 text-white" />
      </span>
      <div className="min-w-0 flex-1 rounded-2xl rounded-tr-sm p-4 aura-card">
        <p className="font-display mb-2 text-sm font-semibold" style={{ color: "var(--foreground)" }}>{answer.title}</p>
        <div className="space-y-1">
          {answer.lines.map((line, i) => (
            <p key={i} className="text-sm leading-6" style={{ color: "var(--muted-dark, var(--foreground))" }}>{line}</p>
          ))}
        </div>
        {answer.actions.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {answer.actions.map((a) => (
              <Link
                key={a.href + a.label}
                href={a.href}
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-80"
                style={{ background: "rgba(172,92,127,0.10)", color: "var(--primary)", border: "1px solid rgba(172,92,127,0.22)" }}
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
    <div className="flex items-start justify-end gap-2.5">
      <div className="max-w-[80%] rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm leading-6 text-white" style={{ background: "linear-gradient(135deg,#c76f93,#ac5c7f)" }}>
        {text}
      </div>
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: "rgba(43,37,48,0.08)" }}>
        <User className="h-4 w-4" style={{ color: "var(--muted)" }} />
      </span>
    </div>
  );
}

/* ── Root ────────────────────────────────────────────────────────────────── */
export function AssistantClient({ context }: { context: AssistantContext }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const nextId = useRef(1);
  const endRef = useRef<HTMLDivElement>(null);

  const briefing = buildBriefing(context);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  function ask(userText: string, answer: AssistantAnswer) {
    setMessages((prev) => [
      ...prev,
      { id: nextId.current++, role: "user", text: userText },
      { id: nextId.current++, role: "assistant", answer },
    ]);
  }

  function handleChip(intent: AssistantIntent, label: string) {
    ask(label, answerIntent(context, intent));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    ask(text, answerText(context, text));
    setInput("");
  }

  return (
    <div className="space-y-5">
      <Briefing lines={briefing} />

      {/* Suggested questions */}
      <div>
        <p className="mb-2.5 text-sm font-semibold" style={{ color: "var(--foreground)" }}>{ASSISTANT.askTitle}</p>
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_QUESTIONS.map((q) => (
            <button
              key={q.intent}
              type="button"
              onClick={() => handleChip(q.intent, q.label)}
              className="rounded-full px-3.5 py-2 text-xs font-medium transition-all duration-200 hover:-translate-y-0.5"
              style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }}
            >
              {q.label}
            </button>
          ))}
        </div>
      </div>

      {/* Conversation */}
      {messages.length > 0 && (
        <div className="space-y-4 rounded-[1.4rem] p-4" style={{ background: "rgba(172,92,127,0.03)", border: "1px solid var(--border)" }}>
          {messages.map((m) =>
            m.role === "user" ? (
              <UserBubble key={m.id} text={m.text ?? ""} />
            ) : (
              <AnswerBubble key={m.id} answer={m.answer!} />
            ),
          )}
          <div ref={endRef} />
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={ASSISTANT.inputPlaceholder}
          className="bg-surface border-border text-foreground placeholder:text-muted-light h-12 w-full rounded-xl border px-4 text-base outline-none transition-all duration-200 focus:border-primary focus:ring-2 focus:ring-primary/20"
          aria-label={ASSISTANT.inputPlaceholder}
        />
        <button
          type="submit"
          className="flex h-12 shrink-0 items-center gap-1.5 rounded-xl px-4 text-sm font-semibold text-white transition-transform duration-200 hover:-translate-y-0.5"
          style={{ background: "linear-gradient(135deg,#c76f93,#ac5c7f)" }}
        >
          <Send className="h-4 w-4" />
          <span className="hidden sm:inline">{ASSISTANT.send}</span>
        </button>
      </form>

      {/* Privacy note */}
      <div className="flex items-center justify-center gap-1.5">
        <ShieldCheck className="h-3.5 w-3.5" style={{ color: "var(--muted-light)" }} />
        <p className="text-center text-xs" style={{ color: "var(--muted-light)" }}>{ASSISTANT.disclaimer}</p>
      </div>
    </div>
  );
}
