// Allura — load test (k6)
//
// מדמה עומס בו-זמני על המסלולים הקריטיים כדי לענות על השאלה:
// "מה קורה כשעשרות-מאות בעלות עסק משתמשות במקביל?"
//
// מטרות עיקריות:
//   1. GET /api/health   — נוגע ב-DB, ולכן חושף התנהגות של מאגר החיבורים
//                          (connection pool) תחת בו-זמניות. זה המדד הכי חשוב.
//   2. GET /login        — עמוד קל, בסיס-רפרנס לזמן תגובה של Next.
//   3. GET /b/<SLUG>      — עמוד עסק ציבורי, קריאת DB כבדה יחסית (אופציונלי).
//
// כל המסלולים קריאה-בלבד: הבדיקה לא יוצרת נתונים ולא שולחת הודעות.
//
// הרצה:
//   BASE_URL=https://staging.allura.info k6 run load-test/smoke.js
//   BASE_URL=https://staging.allura.info PUBLIC_SLUG=my-biz k6 run load-test/smoke.js
//
// התקנת k6 (macOS):  brew install k6
// אין k6? ראו load-test/README.md לחלופת autocannon ללא התקנה.

import http from "k6/http";
import { check, group, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const PUBLIC_SLUG = __ENV.PUBLIC_SLUG || ""; // אם ריק — מדלגים על עמוד העסק

const errorRate = new Rate("allura_errors");
const healthLatency = new Trend("allura_health_latency", true);

export const options = {
  // עלייה הדרגתית עד ~200 משתמשות וירטואליות במקביל, החזקה, וירידה.
  // 200 VU בערך = 200 בעלות עסק פעילות בו-זמנית.
  stages: [
    { duration: "30s", target: 50 },
    { duration: "30s", target: 100 },
    { duration: "1m", target: 200 },
    { duration: "1m", target: 200 }, // שיא מוחזק
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    // סף כישלון: אם נחצה — הבדיקה מסומנת כנכשלת (exit code != 0).
    http_req_failed: ["rate<0.01"], // פחות מ-1% בקשות כושלות
    http_req_duration: ["p(95)<800", "p(99)<2000"], // p95 מתחת ל-800ms
    allura_health_latency: ["p(95)<500"], // בדיקת ה-DB מהירה גם בעומס
    allura_errors: ["rate<0.01"],
  },
};

export default function () {
  group("health (DB + pool)", () => {
    const res = http.get(`${BASE_URL}/api/health`);
    healthLatency.add(res.timings.duration);
    const ok = check(res, {
      "health 200": (r) => r.status === 200,
      "health not 5xx": (r) => r.status < 500,
    });
    errorRate.add(!ok);
  });

  group("login page", () => {
    const res = http.get(`${BASE_URL}/login`);
    const ok = check(res, { "login 200": (r) => r.status === 200 });
    errorRate.add(!ok);
  });

  if (PUBLIC_SLUG) {
    group("public business page", () => {
      const res = http.get(`${BASE_URL}/b/${PUBLIC_SLUG}`);
      // 429 מ-rate-limit הוא תגובה תקינה בעומס, לא שגיאה.
      const ok = check(res, {
        "public page ok/limited": (r) => r.status === 200 || r.status === 429,
      });
      errorRate.add(!ok);
    });
  }

  sleep(1); // "think time" — משתמשת אמיתית לא מרעננת בלולאה הדוקה.
}
