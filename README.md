# Allura

מערכת חכמה לניהול עסקי יופי וטיפוח — Hebrew-only, RTL-first, multi-tenant SaaS.

## Stack

- Next.js 16 (App Router) + React 19
- TypeScript (strict)
- Tailwind CSS v4
- Prisma 6 + PostgreSQL

## הקמה מקומית (Local setup)

דרושים **Node.js** ו-**Docker** מותקנים ופועלים.

```bash
# 1. התקנת תלויות (מריץ `prisma generate` אוטומטית)
npm install

# 2. הגדרת משתני סביבה — העתקת קובץ הדוגמה
cp .env.example .env
# ברירת המחדל ב-.env כבר מתאימה ל-Postgres של Docker. אין צורך לשנות דבר לפיתוח מקומי.

# 3. הפעלת מסד הנתונים (PostgreSQL) דרך Docker
npm run docker:db:up
# מריץ קונטיינר בשם beautiq-postgres וממפה אותו לפורט 5433 במחשב (כדי לא
# להתנגש עם Postgres מקומי שאולי כבר רץ על 5432). מעקב לוגים: npm run docker:db:logs

# 4. הרצת המיגרציה הראשונית (יוצר את הטבלאות)
npm run db:migrate -- --name init

# 5. זריעת נתוני הבסיס (קטגוריות עסק + תבניות הודעה בעברית)
npm run db:seed

# 6. פתיחת Prisma Studio לעיון בנתונים (אופציונלי)
npm run db:studio

# 7. הפעלת שרת הפיתוח
npm run dev
# http://localhost:3000
```

לעצירת מסד הנתונים: `npm run docker:db:down` (הנתונים נשמרים ב-volume בשם `beautiq_postgres_data`).

> **שינוי שם משתמש/סיסמה/שם DB אחרי שהקונטיינר כבר רץ פעם אחת?**
> משתני `POSTGRES_*` נקראים רק כש-Postgres מאתחל data directory ריק. אם שיניתם
> אותם אחרי שה-volume כבר נוצר, צריך לאפס את ה-volume:
> ```bash
> docker compose down -v   # מוחק את ה-volume (כל נתוני הפיתוח יימחקו)
> docker compose up -d
> ```

## פתרון תקלות (Troubleshooting)

### Prisma error P1010 — `User was denied access on the database`

ל-Prisma הצליח להתחבר לשרת Postgres כלשהו, אבל המשתמש נדחה. הסיבות הנפוצות:

1. **התנגשות פורט עם Postgres מקומי (הסיבה הנפוצה ביותר ב-macOS).**
   אם כבר רץ אצלכם Postgres מקומי (Homebrew / Postgres.app) על פורט 5432, אז
   `localhost:5432` יגיע אליו ולא לקונטיינר של Docker — והמשתמש `beautiq_user`
   לא קיים שם. לכן הקונטיינר ממופה כברירת מחדל לפורט **5433**, וה-`DATABASE_URL`
   שב-`.env` חייב להצביע על 5433:
   ```
   DATABASE_URL="postgresql://beautiq_user:beautiq_password@localhost:5433/beautiq_dev?schema=public"
   ```
   בדיקת מי מאזין על הפורט:
   ```bash
   lsof -nP -iTCP:5432 -sTCP:LISTEN
   lsof -nP -iTCP:5433 -sTCP:LISTEN
   ```

2. **Volume ישן עם פרטי התחברות אחרים.**
   אם ה-volume נוצר בעבר עם סיסמה/משתמש שונים, Postgres מתעלם מהערכים החדשים.
   הפתרון — איפוס ה-volume (מוחק את נתוני הפיתוח):
   ```bash
   docker compose down -v
   docker compose up -d
   ```

3. **חוסר התאמה בין `.env` ל-`docker-compose.yml`.** ודאו ששם המשתמש, הסיסמה ושם
   ה-DB ב-`DATABASE_URL` תואמים ל-`POSTGRES_USER` / `POSTGRES_PASSWORD` /
   `POSTGRES_DB` שב-`docker-compose.yml`.

> רוצים בכל זאת להשתמש ב-5432? אפשר להגדיר `DB_PORT=5432` בסביבה לפני
> `docker compose up`, אבל רק אם אין Postgres אחר שתופס את הפורט.

## דמו מקומי (Local demo)

הדמו יוצר עסק מלא עם לקוחות, תורים ונתונים ריאליים שמפעילים את כל כרטיסי ההנחיה בדשבורד.

### הרצה מהירה (DB ריק / לאחר reset)

```bash
# זריעת נתוני ייחוס (קטגוריות + תבניות הודעה)
npm run db:seed

# זריעת נתוני הדמו (משתמש + עסק + תורים)
npm run db:demo
```

### איפוס מלא + זריעה מחדש

> ⚠️ **הרסני** — מוחק את כל נתוני הפיתוח ומתחיל מחדש.

```bash
npm run db:reset   # מבקש אישור לפני המחיקה
npm run db:seed
npm run db:demo
```

### פרטי כניסה לדמו

| שדה | ערך |
|---|---|
| Email | `demo@allura.local` |
| Password | `Demo123456!` |

### לינק הזמנה ציבורי

```
http://localhost:3000/b/yael-studio
```

### מה כלול בדמו

- עסק: **הסטודיו של יעל** (פתח תקווה)
- 4 שירותים: לק ג'ל, עיצוב גבות, טיפול פנים, הסרת לק ג'ל
- 6 לקוחות: נועה כהן, מיה לוי, שירה אברהם, דנה ביטון, רוני מזרחי, ליאור פרץ
- 12 תורים: תורים להיום, עתידיים, תורים שהושלמו, ביטול, אי-הגעה, הזמנה ציבורית

סקריפט הדמו בטוח להרצה חוזרת — הוא מנקה ומייצר מחדש את נתוני העסק `yael-studio` בלבד.

---

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check (`tsc --noEmit`) |
| `npm run db:generate` | Generate Prisma Client |
| `npm run db:migrate` | Run Prisma migrations (dev) |
| `npm run db:seed` | Seed reference data (categories + system templates) |
| `npm run db:demo` | Seed local demo business, clients, and bookings |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:reset` | **Destructive, local only** — drop DB, re-run migrations + seed |
| `npm run docker:db:up` | Start local PostgreSQL (Docker) |
| `npm run docker:db:down` | Stop local PostgreSQL |
| `npm run docker:db:logs` | Follow PostgreSQL logs |

## Project structure

```
prisma/
  schema.prisma         # Full Allura data model (Phase 3)
  seed.ts               # Reference seed: categories + system message templates
docker-compose.yml      # Local PostgreSQL for development
src/
  app/                  # App Router routes, root layout (lang="he", dir="rtl")
  components/
    ui/                 # Reusable UI: Button, Card, Input, StatusBadge
    layout/             # AppShell, Header
  lib/
    constants/he.ts     # Hebrew UI strings (single source)
    utils.ts            # cn() class helper
  server/
    db/prisma.ts        # Prisma client singleton
    auth/               # (Phase 4)
    services/           # (Phase 5+)
  utils/                # general helpers
```

> Status: Phase 3.5 (database foundation + local Docker Postgres). Product features are not implemented yet.
> See `CLAUDE.md` for the full product rules and phase plan.
