/**
 * בריחת תווים (escaping) לגוף אימייל HTML.
 *
 * חלק מהערכים שנכנסים לתבניות האימייל מגיעים ממשתמש אנונימי — שם הלקוחה
 * והערה בעמוד ההזמנות הציבורי נשלטים במלואם על ידי מי שקובעת את התור.
 * בלי escaping, שם כמו:
 *
 *   </td></tr></table><a href="https://evil.example">לאישור התור לחצי כאן</a>
 *
 * היה מוזרק לתוך אימייל אמיתי וממותג של Allura ומאפשר דיוג (phishing)
 * של בעלת העסק. לכן כל ערך דינמי בתבנית HTML חייב לעבור דרך escapeHtml.
 */

/**
 * ממיר את חמשת התווים המשמעותיים ב-HTML לישויות (entities). מיועד לתוכן
 * טקסטואלי ולערכי מאפיינים (attributes) עטופים בגרשיים כאחד.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
