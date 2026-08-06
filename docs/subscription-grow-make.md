# מנוי Allura — סליקה דרך Grow (משולם) עם Make

מסמך זה מסביר איך מחברים את חיוב המנוי החודשי של בעלת העסק (מנוי Allura ₪199 —
מנוי אחד שכולל את כל הפיצ׳רים) לשער התשלומים **Grow (משולם)**, בחיוב חוזר
אוטומטי (**הוראת קבע**), דרך תרחיש (scenario) חינמי ב-**Make**.

## איך זה עובד (התמונה הגדולה)

```
בעלת העסק מפעילה את המנוי ב-/subscribe
        │
        ▼
השרת של Allura שולח את פרטי ההזמנה ל-Webhook של Make
        │
        ▼
תרחיש Make קורא ל-Grow "Create Payment Link" (הוראת קבע)
ומחזיר לנו { url, processId, processToken }
        │
        ▼
בעלת העסק מופנית לעמוד הסליקה המאובטח של Grow ומשלמת
        │
        ▼
Grow שולח חיווי (notification) ישירות לשרת של Allura:
POST /api/subscription/webhook   ← זהו מקור האמת
        │
        ▼
Allura מאמת ומפעיל את התוכנית → האתר נפתח
        │
        ▼
כל חודש: Grow מחייב אוטומטית את הוראת הקבע
ושולח שוב חיווי לאותו webhook → התקופה מתחדשת
```

**חשוב:** האתר נפתח לבעלת העסק **רק אחרי** שהתקבל חיווי תשלום מאומת מ-Grow —
לעולם לא על סמך החזרה של הדפדפן בלבד. Allura **לא רואה ולא שומרת** מספרי כרטיס,
ולא מחזיקה אישורי Grow API (הם שמורים בחיבור ב-Make).

---

## מה שאתה צריך לעשות (בגזרתך)

### 1. חשבון Grow
- לפתוח חשבון סוחר ב-Grow (משולם) אם עדיין אין.
- להשתמש ב-**Grow Sandbox** לבדיקות (אפשר להזין פרטי אשראי בלי חיוב אמיתי),
  וב-**Grow** לסביבת אמת.

### 2. חשבון Make
- להיכנס ל-https://www.make.com ולפתוח משתמש (יש תוכנית חינם).

### 3. בניית תרחיש Make אחד — "יצירת קישור תשלום"
צור scenario חדש עם 3 מודולים:

**מודול 1 — Webhooks › Custom webhook (טריגר)**
- לחץ Add, תן שם (למשל `allura-create-subscription-link`), שמור.
- Make ייצור כתובת כמו `https://hook.eu2.make.com/xxxxxxxx`.
- **העתק את הכתובת הזו** — זה הערך של `MAKE_GROW_CREATE_LINK_WEBHOOK_URL`.
- (מומלץ) הרץ "Run once" ואז שלח בקשת בדיקה כדי ש-Make ילמד את מבנה ה-JSON.
  גוף הבקשה שאנחנו שולחים:
  ```json
  {
    "secret": "...", "sum": "199.00", "description": "מנוי Allura — מנוי חודשי",
    "fullName": "שם בעלת העסק", "phone": "", "email": "owner@example.com",
    "successUrl": "https://<הדומיין>/api/subscription/return?sid=...",
    "notifyUrl": "https://<הדומיין>/api/subscription/webhook",
    "recurring": true, "cField1": "<nonce>", "cField2": "<userId>", "cField3": "standard"
  }
  ```

**מודול 2 — Grow › Create Payment Link**
- Connection: צור חיבור (Grow Sandbox לבדיקות / Grow לאמת) — יזהה לפי
  ת.ז/ח.פ + נייד המקושרים לחשבון, עם קוד אימות ב-SMS.
- **Sending Mode: none** (אנחנו מציגים את הקישור בעצמנו, לא שולחים SMS).
- **Payment Type / הוראת קבע: recurring** — כדי שהחיוב יתחדש אוטומטית כל חודש.
- מפה את השדות מגוף ה-Webhook:
  - Sum → `sum`
  - Description → `description`
  - Full Name → `fullName`
  - Phone → `phone`
  - **Notify URL → `notifyUrl`** (חובה — לשם Grow שולח את חיווי התשלום)
  - **Success URL → `successUrl`**
  - Custom Field 1 → `cField1` (ה-nonce; מוחזר אלינו לאימות)
- (אופציונלי) סנן בתחילת התרחיש שה-`secret` שווה ל-`MAKE_WEBHOOK_SHARED_SECRET`.

**מודול 3 — Webhooks › Webhook response**
- Status: `200`
- Headers: `Content-Type: application/json`
- Body — החזר את הפלט של מודול 2 כ-JSON עם המפתחות האלה בדיוק:
  ```json
  {
    "url": "{{2.data.url}}",
    "processId": "{{2.data.processId}}",
    "processToken": "{{2.data.processToken}}"
  }
  ```
  (שמות השדות בפלט של Grow: `URL`, `Payment Link Process ID`,
  `Payment Link Process Token` — מפה אותם ל-`url`/`processId`/`processToken`.)

הפעל את התרחיש (Scheduling: ON / Immediately).

### 4. (אופציונלי) תרחיש שני — "אישור עסקה"
כדי ש-Grow יפסיק לשלוח חיוויים חוזרים על אותה עסקה, אפשר לבנות תרחיש נוסף:
Custom webhook → Grow "Approve Transaction" (מפה Transaction ID / Token / processId /
processToken מגוף הבקשה). העתק את כתובת ה-webhook ל-`MAKE_GROW_APPROVE_WEBHOOK_URL`.
לא חובה — ה-webhook שלנו אידמפוטנטי, אז החיוויים החוזרים לא מזיקים.

### 4b. ביטול הוראת קבע — פעולה ידנית, ואי אפשר אחרת (עודכן 6.8.2026)

התיעוד הרשמי של אפליקציית Grow ל-Make קובע ש**ביטול תשלום חוזר אינו יכול
להתבצע דרך Make ויש לבצעו באתר של Grow**. אפליקציית Grow חושפת שבעה מודולים
בלבד (Create Payment Link, Get Payment Link Info, Approve Transaction, Settle
Suspended Transaction, Refund Transaction, Notify URL Webhook, ו-Make an API
Call הגנרי) — אין ביניהם ביטול הוראת קבע.

לכן **אין תרחיש שלישי לבנות**, וגרסה קודמת של מסמך זה שהמליצה לבנות אותו הייתה
שגויה. `MAKE_GROW_CANCEL_WEBHOOK_URL` נשאר נתמך בקוד למקרה ש-Grow תחשוף נקודת
קצה כזו בעתיד, אך אינו מוגדר ואינו אמור להיות.

**מה שקורה בפועל כשבעלת עסק מבטלת:** Allura מסמנת את המנוי כמבוטל והגישה נסגרת
בסוף התקופה — אבל הוראת הקבע ב-Grow ממשיכה לחייב את הכרטיס שלה עד שמישהו יעצור
אותה ידנית בלוח הבקרה של Grow. ראה "מעקב אחר הוראות קבע" למטה.

### 5. משתני סביבה בפרודקשן (Vercel)
```
SUBSCRIPTIONS_ENABLED=true
MAKE_GROW_CREATE_LINK_WEBHOOK_URL=https://hook.eu2.make.com/xxxxxxxx
NEXT_PUBLIC_APP_URL=https://<הדומיין-שלך>
# אופציונלי:
MAKE_GROW_APPROVE_WEBHOOK_URL=
MAKE_WEBHOOK_SHARED_SECRET=
```

### 6. בדיקה מקצה לקצה (ב-Sandbox)
1. הרשמה חדשה → מגיעים ל-/subscribe → בחירת תוכנית → "המשך לתשלום מאובטח".
2. אמורים להיות מופנים לעמוד סליקה של Grow → משלמים בכרטיס בדיקה.
3. חוזרים → האתר נפתח (הופעל `/dashboard`).
4. ודא בבסיס הנתונים ש-`AccountSubscription.status = active` ו-`User.plan` הוגדר.
5. (לחיוב חוזר) ודא מול חיוב הוראת-קבע ב-Sandbox שהחיווי החוזר מגיע ל-webhook
   ומאריך את `currentPeriodEnd`.

---

## מה כבר מוכן בקוד (בגזרתי)

- **מסך /subscribe** — שער אחרי הרשמה, מנוי אחד + מעבר לתשלום מאובטח.
- **השער (paywall) פעיל** — `requirePaidUser()` חוסם כניסה עד שיש `User.plan`
  שהופעל מתשלום מאומת; אדמין עובר.
- **מתאם Make/Grow** — `src/lib/subscription/grow.ts`.
- **webhook מאומת** — `src/app/api/subscription/webhook/route.ts` (מקור האמת).
- **חזרה מהסליקה** — `src/app/api/subscription/return/route.ts`.
- **מודל נתונים** — `AccountSubscription` (סטטוס, תקופת חיוב, directDebitId).
- **מסך ניהול מנוי** — בהגדרות (/settings › "מנוי Allura"): התוכנית הנוכחית,
  סטטוס, מחיר, מועד חידוש, וביטול מנוי (עם אישור).
- **סריקה יומית** — `/api/cron/subscription-sweep` (03:00) סוגרת את הגישה למנויים
  שבוטלו/נכשלו כשתקופתם נגמרה. Grow מבצע את החיוב החודשי בעצמו — אין cron חיוב.
- **מצב פיתוח** — כשאין הגדרות Make, /subscribe מפעיל את המנוי מיידית ללא
  סליקה, כדי לשמור על האפליקציה ניתנת להרצה מקומית.

> הערה: שמות השדות של חיווי הוראת-הקבע החוזר (directDebitId / paymentSource /
> statusCode) נלקחו מהתיעוד. כדאי לוודא אותם מול חיוב sandbox אמיתי ולעדכן את
> `parseCallback` אם Grow מחזיר שמות שונים בפועל. הפרסר נכתב הגנתי.

---

## מה קורה כשהחיווי החודשי לא מגיע (4.8.2026)

זה הכשל השקט של כל הפרק הזה, והוא היה לגמרי בלתי-נראה: Grow מחייב את הוראת
הקבע ושולח חיווי שמאריך את התקופה. אם החיווי לא מגיע — הוראת הקבע נעצרה, הכרטיס
מת ו-Grow ויתר, או שה-callback נדחה — המנוי נשאר `active` עם `currentPeriodEnd`
בעבר, `User.plan` נשאר דלוק, ובעלת העסק ממשיכה עם גישה מלאה בחינם. הסריקה
היומית בדקה רק `cancelled` ו-`past_due`, ולכן אף אחד לא הסתכל על זה.

מה שנוסף:

- `findOverdueRenewals` / `countOverdueRenewals`
  ([service.ts](../src/server/subscription/service.ts)) — מנוי `active` שעבר את
  סוף התקופה ביותר מ-`RENEWAL_GRACE_DAYS`.
- הסריקה היומית מתריעה עליהם במייל (`subscription.renewal-missing`), כולל
  המיילים והתאריכים.
- `/admin/ops` מציג את זה כבדיקה — "חידושי מנוי שלא התקבלו".

**הגישה לא נסגרת אוטומטית, במכוון.** מסלול החיווי החוזר עדיין לא אומת מול חיוב
Grow אמיתי; ביטול אוטומטי על סמך *היעדר* חיווי היה עלול לנתק כל לקוחה משלמת
בחודש השני — כשל חמור בהרבה מהדליפה שהוא סוגר. אחרי שיאומת חיוב חוזר אחד אמיתי,
אפשר להחליף את ההתראה במעבר ל-`past_due`.

## מעקב אחר הוראות קבע שממתינות לעצירה

ביטול מנוי סוגר את הגישה אבל לא את החיוב (ראה 4b — זו מגבלה של Grow, לא פער
בתצורה). לכן צריך שהפעולה הידנית לא תיפול בין הכיסאות. שתי שכבות:

1. **התראה מיידית** — כל ביטול שבו עצירת הוראת הקבע לא הצליחה שולח מייל עם
   ה-`directDebitId`.
2. **רשימה שלא נעלמת** — `/admin/ops` מציג "הוראות קבע שממתינות לעצירה ב-Grow":
   כל מנוי `cancelled`/`expired` שיש לו `directDebitId` ואין לו
   `directDebitStoppedAt`. עוצרים ב-Grow, לוחצים "סומן כנעצר", והשורה נעלמת.
   כל עוד הרשימה אינה ריקה, `/admin/ops` מציג חוסם.

השכבה השנייה קיימת כי מייל אחד שפוספס פירושו לקוחה שביטלה וממשיכה לשלם, בלי
ששום דבר במערכת יזכיר את זה. הסימון מסרב לפעול על מנוי פעיל, כדי שלחיצה שגויה
לא תסתיר הוראת קבע של לקוחה משלמת מהרשימה שנועדה לתפוס בדיוק את זה.
