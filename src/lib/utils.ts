/**
 * cn — מאחד שמות מחלקות Tailwind בצורה בטוחה.
 * מסנן ערכים ריקים/שקריים ומאחד למחרוזת אחת.
 * מספיק לצרכי הבסיס; אפשר להחליף ל-tailwind-merge בעתיד אם יידרש.
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
