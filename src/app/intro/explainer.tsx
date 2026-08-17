"use client";

/**
 * סרטון הסברה אינטראקטיבי — /intro
 * "סטורי" שמתנגן לבד: סצנות קצרות שמראות ללקוחה פוטנציאלית
 * מה Allura עושה ולמה כדאי לה מנוי. בלי וידאו אמיתי — הכול אנימציה חיה.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import {
  Play,
  Pause,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  Check,
  CheckCheck,
  CalendarDays,
  MessageCircle,
  Sparkles,
  TrendingUp,
  Heart,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* עזרי אנימציה                                                        */
/* ------------------------------------------------------------------ */

const rise = {
  hidden: { opacity: 0, y: 14 },
  show: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay, duration: 0.45, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

const pop = {
  hidden: { opacity: 0, scale: 0.85 },
  show: (delay = 0) => ({
    opacity: 1,
    scale: 1,
    transition: { delay, duration: 0.4, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

/* ------------------------------------------------------------------ */
/* סצנות — ויזואלים                                                    */
/* ------------------------------------------------------------------ */

/** בועת צ'אט נכנסת (של לקוחה) */
function IncomingBubble({ text, delay }: { text: string; delay: number }) {
  return (
    <motion.div
      variants={rise}
      initial="hidden"
      animate="show"
      custom={delay}
      className="me-auto max-w-[85%] rounded-2xl rounded-tr-md bg-white px-4 py-2.5 text-sm shadow-sm ring-1 ring-black/5"
      style={{ color: "var(--foreground)" }}
    >
      {text}
    </motion.div>
  );
}

/** בועת צ'אט יוצאת (של Allura, בשם העסק) */
function OutgoingBubble({ text, delay }: { text: string; delay: number }) {
  return (
    <motion.div
      variants={rise}
      initial="hidden"
      animate="show"
      custom={delay}
      className="ms-auto max-w-[85%] rounded-2xl rounded-tl-md px-4 py-2.5 text-sm shadow-sm"
      style={{ background: "#e7f8d4", color: "#2b3a22" }}
    >
      <span>{text}</span>
      <span className="mt-1 flex items-center justify-end gap-1 text-[10px]" style={{ color: "#5b8a3c" }}>
        14:02
        <CheckCheck className="h-3.5 w-3.5" />
      </span>
    </motion.div>
  );
}

/** סצנה 1 — הכאב: הוואטסאפ מתפוצץ */
function ScenePain() {
  return (
    <div className="flex w-full flex-col gap-2.5">
      <IncomingBubble text="היי, אפשר להזיז את התור שלי למחר? 🙏" delay={0.2} />
      <IncomingBubble text="מתי יש לך פנוי השבוע?" delay={0.9} />
      <IncomingBubble text="אוי… שכחתי לגמרי מהתור 🙈" delay={1.6} />
      <motion.p
        variants={rise}
        initial="hidden"
        animate="show"
        custom={2.4}
        className="mt-3 text-center text-sm font-medium"
        style={{ color: "var(--muted)" }}
      >
        ואת? באמצע טיפול, עם הידיים מלאות…
      </motion.p>
    </div>
  );
}

/** סצנה 2 — הכירי את Allura */
function SceneBrand() {
  return (
    <div className="flex flex-col items-center gap-5">
      <motion.span
        variants={pop}
        initial="hidden"
        animate="show"
        custom={0.15}
        className="brand-chip flex h-24 w-24 items-center justify-center rounded-[2rem] text-5xl font-bold"
      >
        A
      </motion.span>
      <motion.span
        variants={rise}
        initial="hidden"
        animate="show"
        custom={0.5}
        className="font-display text-brand-gradient text-5xl font-semibold tracking-tight"
      >
        Allura
      </motion.span>
      <motion.div
        variants={rise}
        initial="hidden"
        animate="show"
        custom={0.9}
        className="flex flex-wrap items-center justify-center gap-2"
      >
        {["תורים", "לקוחות", "וואטסאפ", "כסף"].map((word) => (
          <span
            key={word}
            className="rounded-full px-3.5 py-1.5 text-xs font-semibold"
            style={{ background: "var(--primary-light)", color: "var(--primary)" }}
          >
            {word}
          </span>
        ))}
      </motion.div>
    </div>
  );
}

/** סצנה 3 — עמוד הזמנות: הלקוחה קובעת לבד */
function SceneBooking() {
  return (
    <div className="w-full max-w-xs">
      <motion.div
        variants={pop}
        initial="hidden"
        animate="show"
        custom={0.1}
        className="rounded-3xl bg-white p-5 shadow-lg ring-1 ring-black/5"
      >
        <div className="flex items-center gap-3">
          <span className="bg-brand-gradient flex h-10 w-10 items-center justify-center rounded-xl text-white">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
              בניית ציפורניים בג׳ל
            </p>
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              60 דקות · ₪180
            </p>
          </div>
        </div>
        <p className="mt-4 text-xs font-medium" style={{ color: "var(--muted)" }}>
          יום שלישי, 24 בנובמבר
        </p>
        <div className="mt-2 flex gap-2">
          {["10:00", "12:30", "16:00"].map((time, i) => (
            <motion.span
              key={time}
              variants={pop}
              initial="hidden"
              animate="show"
              custom={0.7 + i * 0.2}
              className="flex-1 rounded-xl border py-2 text-center text-sm font-medium"
              style={
                time === "12:30"
                  ? { background: "var(--brand-gradient)", color: "#fff", borderColor: "transparent" }
                  : { borderColor: "var(--border)", color: "var(--foreground)" }
              }
            >
              {time}
            </motion.span>
          ))}
        </div>
        <motion.div
          variants={rise}
          initial="hidden"
          animate="show"
          custom={2.2}
          className="mt-4 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold"
          style={{ background: "var(--success-light, #e8f5ec)", color: "var(--success, #2e7d4f)" }}
        >
          <Check className="h-4 w-4" />
          הבקשה נשלחה — מחכה לאישור שלך
        </motion.div>
      </motion.div>
    </div>
  );
}

/** סצנה 4 — יומן מסודר */
function SceneCalendar() {
  const slots = [
    { time: "09:00", label: "לק ג'ל · רוני", tint: "var(--primary-light)" },
    { time: "10:30", label: "מניקור · שירה", tint: "var(--mauve-light, #f1eaf5)" },
    { time: "12:30", label: "בניית ציפורניים · דנה", tint: "var(--accent-light, #f9f2e8)" },
    { time: "16:00", label: "פנוי — Allura תציע לקוחה", tint: "transparent" },
  ];
  return (
    <div className="w-full max-w-xs">
      <motion.div
        variants={pop}
        initial="hidden"
        animate="show"
        custom={0.1}
        className="rounded-3xl bg-white p-5 shadow-lg ring-1 ring-black/5"
      >
        <div className="mb-3 flex items-center gap-2">
          <CalendarDays className="h-4 w-4" style={{ color: "var(--primary)" }} />
          <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            יום שלישי
          </p>
        </div>
        <div className="space-y-2">
          {slots.map((slot, i) => (
            <motion.div
              key={slot.time}
              variants={rise}
              initial="hidden"
              animate="show"
              custom={0.5 + i * 0.35}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5"
              style={
                slot.tint === "transparent"
                  ? { border: "1.5px dashed var(--border-strong, #d9cfd6)" }
                  : { background: slot.tint }
              }
            >
              <span className="text-xs font-bold tabular-nums" style={{ color: "var(--primary)" }}>
                {slot.time}
              </span>
              <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                {slot.label}
              </span>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

/** סצנה 5 — וואטסאפ אוטומטי */
function SceneWhatsApp() {
  return (
    <div className="flex w-full flex-col gap-2.5">
      <OutgoingBubble text="היי דנה! התור שלך אושר ליום שלישי בשעה 12:30. נתראה! 💕" delay={0.2} />
      <OutgoingBubble text="תזכורת קטנה: מחכות לך היום ב־12:30 ✨" delay={1.1} />
      <motion.div
        variants={pop}
        initial="hidden"
        animate="show"
        custom={2.1}
        className="mx-auto mt-2 flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-xs font-semibold shadow-sm ring-1 ring-black/5"
        style={{ color: "var(--primary)" }}
      >
        <MessageCircle className="h-3.5 w-3.5" />
        נשלח אוטומטית — בלי שנגעת בטלפון
      </motion.div>
    </div>
  );
}

/** סצנה 6 — החזרת לקוחות */
function SceneWinBack() {
  return (
    <div className="w-full max-w-xs">
      <motion.div
        variants={pop}
        initial="hidden"
        animate="show"
        custom={0.1}
        className="rounded-3xl bg-white p-5 shadow-lg ring-1 ring-black/5"
      >
        <div className="flex items-center gap-3">
          <span
            className="flex h-11 w-11 items-center justify-center rounded-full text-base font-bold"
            style={{ background: "var(--primary-light)", color: "var(--primary)" }}
          >
            ד
          </span>
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
              דנה לוי
            </p>
            <p className="text-xs" style={{ color: "var(--warning, #b26a00)" }}>
              לא ביקרה כבר חודשיים
            </p>
          </div>
        </div>
        <motion.div
          variants={rise}
          initial="hidden"
          animate="show"
          custom={0.9}
          className="mt-4 rounded-xl px-3.5 py-3 text-sm leading-relaxed"
          style={{ background: "var(--background-alt, #f5f0f2)", color: "var(--foreground-soft)" }}
        >
          “היי דנה, מתגעגעות אלייך! 💕 בא לך לקבוע תור לשבוע הקרוב?”
        </motion.div>
        <motion.button
          type="button"
          tabIndex={-1}
          variants={pop}
          initial="hidden"
          animate="show"
          custom={1.7}
          className="bg-brand-gradient mt-3 w-full cursor-default rounded-xl py-2.5 text-sm font-semibold text-white"
        >
          ההודעה מוכנה — נשאר רק לשלוח
        </motion.button>
      </motion.div>
    </div>
  );
}

/** סצנה 7 — כסף ותובנות */
function SceneMoney() {
  const bars = [42, 58, 50, 74, 66, 88];
  return (
    <div className="w-full max-w-xs">
      <motion.div
        variants={pop}
        initial="hidden"
        animate="show"
        custom={0.1}
        className="rounded-3xl bg-white p-5 shadow-lg ring-1 ring-black/5"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium" style={{ color: "var(--muted)" }}>
              הכנסות החודש
            </p>
            <motion.p
              variants={rise}
              initial="hidden"
              animate="show"
              custom={0.5}
              className="display-num text-3xl font-bold"
              style={{ color: "var(--foreground)" }}
            >
              ₪12,480
            </motion.p>
          </div>
          <motion.span
            variants={pop}
            initial="hidden"
            animate="show"
            custom={0.8}
            className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold"
            style={{ background: "var(--success-light, #e8f5ec)", color: "var(--success, #2e7d4f)" }}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            18%+
          </motion.span>
        </div>
        <div className="mt-5 flex h-24 items-end gap-2">
          {bars.map((height, i) => (
            <motion.div
              key={i}
              initial={{ height: 0 }}
              animate={{ height: `${height}%` }}
              transition={{ delay: 0.6 + i * 0.12, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="flex-1 rounded-t-lg"
              style={{
                background:
                  i === bars.length - 1 ? "var(--brand-gradient)" : "var(--primary-light)",
              }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}

/** סצנה 8 — סגירה: המנוי */
function SceneCta() {
  return (
    <div className="flex w-full max-w-xs flex-col items-center gap-4">
      <motion.div
        variants={pop}
        initial="hidden"
        animate="show"
        custom={0.15}
        className="w-full rounded-3xl bg-white p-6 text-center shadow-lg ring-1 ring-black/5"
      >
        <p className="text-sm font-medium" style={{ color: "var(--muted)" }}>
          מנוי Allura
        </p>
        <p className="display-num mt-1 text-4xl font-bold" style={{ color: "var(--foreground)" }}>
          ₪199
          <span className="text-base font-medium" style={{ color: "var(--muted)" }}>
            {" "}
            לחודש
          </span>
        </p>
        <ul className="mt-4 space-y-2 text-start">
          {[
            "יומן, לקוחות ועמוד הזמנות אישי",
            "וואטסאפ אוטומטי — אישורים ותזכורות",
            "החזרת לקוחות ותובנות על הכסף",
          ].map((line, i) => (
            <motion.li
              key={line}
              variants={rise}
              initial="hidden"
              animate="show"
              custom={0.6 + i * 0.2}
              className="flex items-start gap-2 text-sm"
              style={{ color: "var(--foreground-soft)" }}
            >
              <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--success, #2e7d4f)" }} />
              {line}
            </motion.li>
          ))}
        </ul>
      </motion.div>
      <motion.div
        variants={rise}
        initial="hidden"
        animate="show"
        custom={1.4}
        className="flex w-full flex-col items-center gap-2.5"
      >
        <Link
          href="/signup"
          className="bg-brand-gradient block w-full rounded-xl py-3 text-center text-sm font-semibold text-white shadow-[var(--brand-shadow)] transition-opacity hover:opacity-90"
        >
          רוצה גם? יצירת חשבון
        </Link>
        <Link
          href="/login"
          className="text-sm font-medium transition-opacity hover:opacity-75"
          style={{ color: "var(--primary)" }}
        >
          יש לך כבר חשבון? התחברות
        </Link>
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* רשימת הסצנות                                                        */
/* ------------------------------------------------------------------ */

interface Scene {
  id: string;
  duration: number; // ms
  eyebrow: string;
  title: string;
  subtitle: string;
  Visual: () => React.ReactElement;
}

const SCENES: readonly Scene[] = [
  {
    id: "pain",
    duration: 6500,
    eyebrow: "מכירה את זה?",
    title: "היומן בפנקס, הוואטסאפ מתפוצץ",
    subtitle: "תיאומים, שינויים, ולקוחה שפשוט שכחה להגיע — הכול על הראש שלך.",
    Visual: ScenePain,
  },
  {
    id: "brand",
    duration: 5000,
    eyebrow: "יש דרך אחרת",
    title: "הכירי את Allura",
    subtitle: "מערכת חכמה שמנהלת בשבילך את העסק — בעברית, ומהנייד.",
    Visual: SceneBrand,
  },
  {
    id: "booking",
    duration: 6500,
    eyebrow: "עמוד הזמנות אישי",
    title: "הלקוחות קובעות לבד",
    subtitle: "קישור משלך שפתוח 24/7 — גם כשאת באמצע טיפול. את רק מאשרת.",
    Visual: SceneBooking,
  },
  {
    id: "calendar",
    duration: 6000,
    eyebrow: "יומן ותורים",
    title: "יומן מסודר, בלי כפילויות",
    subtitle: "כל תור במקום שלו, והמערכת שומרת שלא ייקבעו שניים באותה שעה.",
    Visual: SceneCalendar,
  },
  {
    id: "whatsapp",
    duration: 6000,
    eyebrow: "על טייס אוטומטי",
    title: "וואטסאפ שעובד בשבילך",
    subtitle: "אישורי תור ותזכורות נשלחים לבד — פחות שכחות, פחות הברזות.",
    Visual: SceneWhatsApp,
  },
  {
    id: "winback",
    duration: 6000,
    eyebrow: "שימור לקוחות",
    title: "אף לקוחה לא הולכת לאיבוד",
    subtitle: "Allura מזהה מי מזמן לא ביקרה — ומכינה לך הודעה שמחזירה אותה.",
    Visual: SceneWinBack,
  },
  {
    id: "money",
    duration: 5500,
    eyebrow: "הכסף שלך",
    title: "רואים את הכסף בבירור",
    subtitle: "הכנסות, תחזית ורווח — בלי אקסלים ובלי ניחושים.",
    Visual: SceneMoney,
  },
  {
    id: "cta",
    duration: 9000,
    eyebrow: "פשוט להתחיל",
    title: "מנוי אחד. הכול כלול.",
    subtitle: "בלי חבילות מסובכות ובלי הפתעות — כל היכולות במנוי אחד.",
    Visual: SceneCta,
  },
];

const LAST = SCENES.length - 1;

/* ------------------------------------------------------------------ */
/* הנגן                                                                */
/* ------------------------------------------------------------------ */

export function Explainer() {
  const [scene, setScene] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [progress, setProgress] = useState(0); // 0..1 בתוך הסצנה הנוכחית
  const progressRef = useRef(0);
  const reducedMotion = useReducedMotion();

  const goTo = useCallback((index: number, autoplay = true) => {
    setScene(Math.min(Math.max(index, 0), LAST));
    progressRef.current = 0;
    setProgress(0);
    setPlaying(autoplay);
  }, []);

  // התקדמות אוטומטית
  useEffect(() => {
    if (!playing) return;
    const duration = SCENES[scene].duration;
    const startedAt = performance.now() - progressRef.current * duration;
    const timer = setInterval(() => {
      const p = (performance.now() - startedAt) / duration;
      if (p >= 1) {
        if (scene === LAST) {
          progressRef.current = 1;
          setProgress(1);
          setPlaying(false);
        } else {
          setScene((s) => s + 1);
          progressRef.current = 0;
          setProgress(0);
        }
      } else {
        progressRef.current = p;
        setProgress(p);
      }
    }, 50);
    return () => clearInterval(timer);
  }, [playing, scene]);

  const ended = scene === LAST && progress >= 1;
  const { Visual } = SCENES[scene];

  return (
    <div className="app-ambient flex min-h-dvh flex-col" dir="rtl">
      {/* כותרת עליונה מינימלית */}
      <header className="flex items-center justify-between px-5 py-4 sm:px-8">
        <Link href="/about" className="flex items-center gap-2.5">
          <span className="brand-chip flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold">
            A
          </span>
          <span className="text-foreground text-base font-bold tracking-tight">Allura</span>
        </Link>
        <Link
          href="/signup"
          className="bg-brand-gradient rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-[var(--brand-shadow)] transition-opacity hover:opacity-90"
        >
          יצירת חשבון
        </Link>
      </header>

      {/* הבמה */}
      <main className="flex flex-1 items-center justify-center px-4 pb-6">
        <div className="aura-card flex w-full max-w-md flex-col overflow-hidden rounded-[1.75rem]">
          {/* פס התקדמות בסגנון סטורי */}
          <div className="flex gap-1.5 px-5 pt-5" role="presentation">
            {SCENES.map((s, i) => (
              <button
                key={s.id}
                type="button"
                aria-label={`מעבר לחלק ${i + 1}: ${s.title}`}
                onClick={() => goTo(i)}
                className="h-1.5 flex-1 cursor-pointer overflow-hidden rounded-full"
                style={{ background: "var(--border)" }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    background: "var(--brand-gradient)",
                    width:
                      i < scene ? "100%" : i > scene ? "0%" : `${Math.round(progress * 100)}%`,
                  }}
                />
              </button>
            ))}
          </div>

          {/* תוכן הסצנה */}
          <div className="flex min-h-[430px] flex-col px-6 pb-2 pt-6 sm:min-h-[460px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={SCENES[scene].id}
                initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -14 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-1 flex-col"
              >
                <div className="text-center">
                  <p className="eyebrow text-primary">{SCENES[scene].eyebrow}</p>
                  <h1 className="font-display text-foreground mt-1.5 text-2xl font-semibold leading-snug">
                    {SCENES[scene].title}
                  </h1>
                  <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
                    {SCENES[scene].subtitle}
                  </p>
                </div>
                <div className="flex flex-1 items-center justify-center py-6">
                  <Visual />
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* שורת שליטה */}
          <div className="flex items-center justify-between px-5 pb-5">
            <button
              type="button"
              onClick={() => goTo(LAST, false)}
              className="rounded-full px-3 py-1.5 text-xs font-medium transition-colors hover:bg-black/5"
              style={{ color: "var(--muted)" }}
            >
              דילוג לסוף
            </button>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                aria-label="לחלק הקודם"
                onClick={() => goTo(scene - 1)}
                disabled={scene === 0}
                className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-black/5 disabled:opacity-30"
                style={{ color: "var(--foreground)" }}
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              {ended ? (
                <button
                  type="button"
                  aria-label="צפייה מההתחלה"
                  onClick={() => goTo(0)}
                  className="bg-brand-gradient flex h-11 w-11 items-center justify-center rounded-full text-white shadow-[var(--brand-shadow)]"
                >
                  <RotateCcw className="h-5 w-5" />
                </button>
              ) : (
                <button
                  type="button"
                  aria-label={playing ? "השהיה" : "המשך ניגון"}
                  onClick={() => setPlaying((p) => !p)}
                  className="bg-brand-gradient flex h-11 w-11 items-center justify-center rounded-full text-white shadow-[var(--brand-shadow)]"
                >
                  {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 -scale-x-100" />}
                </button>
              )}
              <button
                type="button"
                aria-label="לחלק הבא"
                onClick={() => goTo(scene + 1)}
                disabled={scene === LAST}
                className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-black/5 disabled:opacity-30"
                style={{ color: "var(--foreground)" }}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            </div>
            <span
              className="flex items-center gap-1 text-xs font-medium tabular-nums"
              style={{ color: "var(--muted)" }}
            >
              {scene + 1}/{SCENES.length}
              <Heart className="h-3 w-3" style={{ color: "var(--primary)" }} />
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}
