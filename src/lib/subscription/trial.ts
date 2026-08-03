/**
 * חישובי תקופת ניסיון — פונקציות טהורות מבחינת ה-UI.
 *
 * הזמן נקרא כאן ולא בתוך קומפוננטה: קריאה ל-`Date.now()` בזמן render היא
 * לא-דטרמיניסטית (React עשוי לרנדר שוב מתי שיבחר, ואז המספר "קופץ"), וזו גם
 * שגיאת lint בפרויקט. הקומפוננטות מקבלות מספר מוכן.
 */

const DAY_MS = 86_400_000;

/** כמה ימים נותרו עד סוף הניסיון (0 = מסתיים היום). */
export function trialDaysLeft(endsAt: Date | string, now: number = Date.now()): number {
  const end = endsAt instanceof Date ? endsAt.getTime() : new Date(endsAt).getTime();
  return Math.max(0, Math.ceil((end - now) / DAY_MS));
}

/** האם הניסיון עדיין בתוקף. */
export function isTrialActive(
  endsAt: Date | string | null | undefined,
  now: number = Date.now(),
): boolean {
  if (!endsAt) return false;
  const end = endsAt instanceof Date ? endsAt.getTime() : new Date(endsAt).getTime();
  return end > now;
}

/** האם התפוגה כבר עברה — כלומר הגישה נסגרה בגלל סוף ניסיון. */
export function isTrialLapsed(
  expiresAt: Date | null | undefined,
  now: number = Date.now(),
): boolean {
  return !!expiresAt && expiresAt.getTime() <= now;
}
