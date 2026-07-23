# בדיקת עומס — Allura

מטרה: לענות בעובדות (לא בהערכה) על השאלה **"מה קורה כשעשרות-מאות בעלות עסק
משתמשות במקביל?"** — במיוחד האם מאגר החיבורים (connection pool) למסד הנתונים
מחזיק, ומה זמני התגובה בשיא.

> הריצו תמיד מול סביבת **staging/preview**, לא מול פרודקשן חי עם לקוחות אמיתיות.

---

## אופציה A — autocannon (ללא התקנה, הכי מהיר)

לא צריך להתקין כלום, רץ דרך `npx`:

```bash
# 100 חיבורים בו-זמנית, 30 שניות, מול בדיקת הבריאות שנוגעת ב-DB
npx autocannon -c 100 -d 30 https://staging.allura.info/api/health

# עמוד ההתחברות
npx autocannon -c 100 -d 30 https://staging.allura.info/login
```

מה לבדוק בפלט:
- **Latency p97.5 / p99** — כמה מילישניות. מתחת ל-~800ms מצוין.
- **2xx vs Non-2xx** — כמה בקשות נכשלו. שאיפה: 0 כשלים (429 מ-rate-limit זה תקין).
- **Req/Sec** — תפוקה. אם היא קורסת כשמעלים `-c`, זה חשוד למאגר חיבורים.

---

## אופציה B — k6 (תרחיש מלא, מומלץ)

התקנה (פעם אחת): `brew install k6`

```bash
# תרחיש עולה עד 200 משתמשות במקביל, מול staging
BASE_URL=https://staging.allura.info npm run load:test

# כולל עמוד עסק ציבורי (קריאת DB כבדה יותר) — החליפו את ה-slug
BASE_URL=https://staging.allura.info PUBLIC_SLUG=my-biz npm run load:test
```

הבדיקה **נכשלת אוטומטית** (exit code ≠ 0) אם נחצה אחד מהספים:
- יותר מ-1% בקשות כושלות
- p95 של זמן התגובה מעל 800ms
- p95 של `/api/health` מעל 500ms

זה הופך את זה לבדיקה בינארית: עברה / לא עברה.

---

## מה מחפשים — ומה זה אומר

| תסמין בבדיקה | סיבה סבירה | תיקון |
|---|---|---|
| `/api/health` מאט או מחזיר 5xx ככל שמעלים חיבורים | תקרת חיבורי Postgres — אין pooler | `DATABASE_URL` חייב endpoint של pooler + `?pgbouncer=true&connection_limit=1` |
| שגיאות `too many connections` בלוגים | אותו דבר | כנ"ל |
| p95 גבוה עקבי גם בעומס נמוך | שאילתה איטית / חוסר אינדקס | לבדוק `EXPLAIN` על השאילתה הכבדה |
| 429 בעומס גבוה על מסלולים ציבוריים | ה-rate-limit עובד כמצופה | תקין — לא צריך תיקון |

### מאגר החיבורים — הבדיקה הכי חשובה לפני השקה

בסביבת serverless (Vercel) כל בקשה בו-זמנית עלולה להריץ מופע נפרד שפותח חיבור
Postgres משלו. בלי pooler חיצוני, עומס מגיע לתקרת החיבורים ומחזיר שגיאות.

ודאו בפרודקשן (Vercel → Settings → Environment Variables):

1. `DATABASE_URL` מצביע ל-**endpoint של ה-pooler** (בּ-Neon: מכיל `-pooler`), עם
   `?pgbouncer=true&connection_limit=1` בסוף.
2. `DIRECT_URL` מצביע ל-endpoint הישיר (למיגרציות).
3. `prisma/schema.prisma` מכריז **שניהם**:
   ```prisma
   datasource db {
     provider  = "postgresql"
     url       = env("DATABASE_URL")   // מפולל — ל-runtime
     directUrl = env("DIRECT_URL")     // ישיר — למיגרציות
   }
   ```

כרגע `schema.prisma` מכריז רק `url`. אם `DATABASE_URL` בפרודקשן הוא מפולל, יש
להוסיף את שורת `directUrl` כדי ש-`prisma migrate deploy` בבנייה יעבוד. בדיקת
העצמה שהוספנו ב-`src/lib/env.ts` תרשום אזהרה בלוגים של Vercel אם התצורה נראית
לא מפוללת — בדקו את הלוגים אחרי ה-deploy הבא.
