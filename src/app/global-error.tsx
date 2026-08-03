"use client";

import { useEffect } from "react";
// הקבוע היחיד שהמסך הזה מייבא: config.ts הוא מודול טהור שלא זורק בטעינה
// (כל הפרסור שלו עטוף ב-try). כתובת קשיחה כאן כבר התיישנה פעם אחת מול שאר
// המוצר, וזה בדיוק המסך שבו כתובת שגויה עולה הכי ביוקר.
import { SUPPORT_EMAIL } from "@/lib/config";

/**
 * מסך שגיאה אחרון (global error boundary).
 *
 * נכנס לפעולה רק כשה-layout השורשי עצמו קרס — כלומר כשגם error.tsx של
 * האפליקציה כבר לא זמין. בגלל זה הוא מחליף את כל מסמך ה-HTML, ולכן אינו
 * נשען על ה-layout, על הגופנים או על מחלקות Tailwind של האפליקציה: הכול
 * inline, כדי שהמסך הזה יעבוד גם כשכל השאר שבור.
 *
 * ה-digest מוצג בכוונה — זה המזהה שמופיע גם בלוג בשרת, והוא מה שמאפשר
 * לבעלת עסק שמתקשרת לתמיכה להצביע על השגיאה המדויקת שלה.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="he" dir="rtl">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#faf7f8",
          color: "#3b2b33",
          fontFamily:
            "Heebo, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif",
          padding: "1.5rem",
        }}
      >
        <main
          style={{
            maxWidth: "26rem",
            width: "100%",
            textAlign: "center",
            background: "#ffffff",
            border: "1px solid #eadfe4",
            borderRadius: "1.5rem",
            padding: "2.5rem 2rem",
            boxShadow: "0 18px 40px -28px rgba(59, 43, 51, 0.35)",
          }}
        >
          <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 600 }}>
            משהו השתבש
          </h1>
          <p
            style={{
              margin: "0.75rem 0 0",
              fontSize: "0.9375rem",
              lineHeight: 1.75,
              color: "#7a6670",
            }}
          >
            אירעה תקלה זמנית בטעינת המערכת. אפשר לנסות שוב — ואם זה חוזר,
            נשמח לעזור בכתובת {SUPPORT_EMAIL}
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: "1.5rem",
              padding: "0.625rem 1.5rem",
              fontSize: "0.9375rem",
              fontWeight: 500,
              color: "#ffffff",
              background: "#ac5c7f",
              border: "none",
              borderRadius: "0.75rem",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            לנסות שוב
          </button>
          {error.digest && (
            <p
              style={{
                margin: "1.25rem 0 0",
                fontSize: "0.75rem",
                color: "#a3919a",
                direction: "ltr",
              }}
            >
              קוד תקלה: {error.digest}
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
