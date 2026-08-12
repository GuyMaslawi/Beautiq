"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";

/**
 * מועד הפתיחה הרשמי — 13.8.2026 בשעה 19:00 שעון ישראל (UTC+3 בקיץ).
 * נשמר כחותמת זמן מוחלטת כדי שהספירה תהיה זהה בכל אזור זמן.
 */
const LAUNCH_AT = Date.parse("2026-08-13T19:00:00+03:00");

/**
 * כמה שניות נשארים על מסך החגיגה לפני המעבר האוטומטי להתחברות.
 * מספיק כדי לראות את הקונפטי, קצר מספיק כדי לא להיתקע.
 */
const REDIRECT_SECONDS = 7;

type Remaining = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  done: boolean;
};

/**
 * חזרה יבשה לפני האירוע: ‎/launch?preview=15‎ מקצר את הספירה ל-15 שניות מרגע
 * הטעינה, כדי לראות את הפיצוץ ואת המעבר להתחברות בלי לחכות למועד האמיתי.
 * משפיע רק על התצוגה בדפדפן — לא על שום נתון או הרשאה.
 */
function resolveTarget(): number {
  const raw = new URLSearchParams(window.location.search).get("preview");
  if (!raw) return LAUNCH_AT;
  const seconds = Number(raw);
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 3600) {
    return LAUNCH_AT;
  }
  return Date.now() + seconds * 1000;
}

function remainingFrom(now: number, target: number): Remaining {
  const diff = target - now;
  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, done: true };
  }
  const totalSeconds = Math.floor(diff / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    done: false,
  };
}

const UNITS = [
  { key: "days", label: "ימים" },
  { key: "hours", label: "שעות" },
  { key: "minutes", label: "דקות" },
  { key: "seconds", label: "שניות" },
] as const;

export function LaunchCountdown() {
  const router = useRouter();

  // עד שהקומפוננטה עולה בדפדפן אין לנו "עכשיו" — רינדור השרת והלקוח חייבים
  // להיות זהים, ולכן מתחילים ריק ומתמלאים אחרי ההרכבה.
  const [remaining, setRemaining] = useState<Remaining | null>(null);
  const [redirectIn, setRedirectIn] = useState<number | null>(null);

  // הרגע שבו *המסך הזה* ראה את הפתיחה. מי שנוחתת על העמוד אחרי 19:00 מקבלת
  // את אותה חגיגה קצרה ואז מועברת, בלי לחשב לאחור מרגע ההשקה עצמו.
  const seenLaunchAtRef = useRef<number | null>(null);
  const redirectedRef = useRef(false);

  useEffect(() => {
    const target = resolveTarget();
    const tick = () => {
      const now = Date.now();
      const next = remainingFrom(now, target);
      setRemaining(next);

      if (!next.done) return;

      if (seenLaunchAtRef.current === null) seenLaunchAtRef.current = now;
      const elapsed = Math.floor((now - seenLaunchAtRef.current) / 1000);
      const left = Math.max(0, REDIRECT_SECONDS - elapsed);
      setRedirectIn(left);

      // replace ולא push — כפתור "חזור" לא אמור להחזיר אותה לספירה שנגמרה.
      if (left === 0 && !redirectedRef.current) {
        redirectedRef.current = true;
        router.replace("/login");
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [router]);

  const launched = remaining?.done ?? false;

  // "כמעט שם" — הדקה האחרונה מקבלת פעימה חזקה יותר.
  const finalMinute =
    !!remaining &&
    !remaining.done &&
    remaining.days === 0 &&
    remaining.hours === 0 &&
    remaining.minutes === 0;

  return (
    <div className="flex w-full flex-col items-center">
      <Confetti active={launched} />

      {launched ? (
        <LaunchedBanner redirectIn={redirectIn} />
      ) : (
        <div
          className="grid w-full max-w-2xl grid-cols-4 gap-2 sm:gap-4"
          dir="ltr"
          aria-live="off"
        >
          {UNITS.map((unit) => (
            <TimeCell
              key={unit.key}
              value={remaining ? remaining[unit.key] : null}
              label={unit.label}
              urgent={finalMinute}
            />
          ))}
        </div>
      )}

      {/* קורא מסך מקבל טקסט אחד ברור במקום ארבע ספרות מתחלפות */}
      <p className="sr-only" aria-live="polite">
        {launched
          ? "העונה נפתחה. מעבירים אותך למסך ההתחברות."
          : remaining
            ? `נותרו ${remaining.days} ימים, ${remaining.hours} שעות ו-${remaining.minutes} דקות עד הפתיחה`
            : "טוען את הספירה לאחור"}
      </p>

      <div className="mt-10 flex w-full flex-col items-center gap-3 sm:mt-12 sm:w-auto sm:flex-row">
        <Link
          href={launched ? "/login" : "/signup"}
          className="launch-cta group flex w-full items-center justify-center gap-2 rounded-full px-8 py-4 text-base font-bold text-white sm:w-auto"
        >
          <Sparkles className="h-5 w-5" aria-hidden="true" />
          {launched ? "להתחברות עכשיו" : "לשמור לי מקום"}
          <ArrowLeft
            className="h-5 w-5 transition-transform group-hover:-translate-x-1"
            aria-hidden="true"
          />
        </Link>
        <Link
          href={launched ? "/signup" : "/login"}
          className="flex w-full items-center justify-center rounded-full border border-white/25 px-8 py-4 text-base font-semibold text-white/85 transition hover:border-white/50 hover:bg-white/10 hover:text-white sm:w-auto"
        >
          {launched ? "פתיחת חשבון חדש" : "כבר יש לי חשבון"}
        </Link>
      </div>
    </div>
  );
}

function TimeCell({
  value,
  label,
  urgent,
}: {
  value: number | null;
  label: string;
  urgent: boolean;
}) {
  const text = value === null ? "--" : String(value).padStart(2, "0");

  return (
    <div
      className={`launch-cell relative flex flex-col items-center justify-center rounded-2xl px-1 py-5 sm:rounded-3xl sm:px-2 sm:py-7 ${
        urgent ? "launch-cell-urgent" : ""
      }`}
    >
      <span
        key={text}
        className="launch-digit text-4xl font-extrabold leading-none tracking-tight text-white sm:text-6xl md:text-7xl"
      >
        {text}
      </span>
      <span className="mt-2 text-[11px] font-medium tracking-wide text-white/60 sm:mt-3 sm:text-sm">
        {label}
      </span>
    </div>
  );
}

function LaunchedBanner({ redirectIn }: { redirectIn: number | null }) {
  const total = REDIRECT_SECONDS;
  const left = redirectIn ?? total;
  // הפס מתמלא ככל שמתקרבים למעבר — סימן ויזואלי שמשהו עומד לקרות.
  const progress = Math.min(100, Math.max(0, ((total - left) / total) * 100));

  return (
    <div className="launch-cell flex w-full max-w-2xl flex-col items-center rounded-3xl px-6 py-12 text-center">
      <span className="text-5xl" aria-hidden="true">
        🎉
      </span>
      <p className="text-brand-gradient-bright mt-4 text-4xl font-extrabold leading-tight sm:text-6xl">
        העונה נפתחה!
      </p>
      <p className="mt-3 max-w-md text-base leading-relaxed text-white/70 sm:text-lg">
        זהו. מכאן ממשיכים ביומן מסודר, לקוחות במקום אחד והודעות שנשלחות בזמן.
      </p>

      <div className="mt-8 w-full max-w-xs">
        <p className="text-sm font-medium text-white/70">
          {left > 0
            ? `מעבירים אותך למסך ההתחברות בעוד ${left}...`
            : "מעבירים אותך למסך ההתחברות..."}
        </p>
        <div
          className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/15"
          aria-hidden="true"
        >
          <div
            className="launch-progress h-full rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * פיצוץ קונפטי קצר ברגע הפתיחה. קנבס אחד, ללא ספריות חיצוניות, ומכבד
 * העדפת "פחות תנועה" של מערכת ההפעלה.
 */
function Confetti({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const colors = useMemo(
    () => ["#c76f93", "#ac5c7f", "#92609f", "#c09560", "#ffffff"],
    [],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!active || !canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const pieces = Array.from({ length: 140 }, () => ({
      x: Math.random() * width,
      y: -Math.random() * height * 0.6,
      size: 5 + Math.random() * 7,
      vx: (Math.random() - 0.5) * 1.6,
      vy: 1.8 + Math.random() * 2.8,
      rot: Math.random() * Math.PI,
      vrot: (Math.random() - 0.5) * 0.22,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));

    let frame = 0;
    let raf = 0;
    const MAX_FRAMES = 60 * 7; // כשבע שניות ואז נעצרים

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      const fade = Math.max(0, 1 - frame / MAX_FRAMES);
      for (const p of pieces) {
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vrot;
        if (p.y > height + 20) {
          p.y = -20;
          p.x = Math.random() * width;
        }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = fade;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }
      frame += 1;
      if (frame < MAX_FRAMES) {
        raf = window.requestAnimationFrame(draw);
      } else {
        ctx.clearRect(0, 0, width, height);
      }
    };

    raf = window.requestAnimationFrame(draw);
    return () => window.cancelAnimationFrame(raf);
  }, [active, colors]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-50 h-full w-full"
    />
  );
}
