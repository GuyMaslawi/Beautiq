import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * cn — מאחד שמות מחלקות Tailwind בצורה בטוחה.
 * משתמש ב-clsx לסינון ערכים מותנים וב-tailwind-merge לפתרון התנגשויות מחלקות.
 * תואם לאחור עם הקריאות הקיימות (מחרוזות / false / null / undefined).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
