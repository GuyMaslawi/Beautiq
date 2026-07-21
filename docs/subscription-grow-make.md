# מנוי Allura — סליקה דרך Grow (משולם) עם Make

מסמך זה מסביר איך מחברים את חיוב המנוי החודשי של בעלת העסק (פרימיום ₪149 /
פלטינום ₪249) לשער התשלומים **Grow (משולם)**, בחיוב חוזר אוטומטי (**הוראת קבע**),
דרך תרחיש (scenario) חינמי ב-**Make**.

## איך זה עובד (התמונה הגדולה)

```
בעלת העסק בוחרת תוכנית ב-/subscribe
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
    "secret": "...", "sum": "149.00", "description": "מנוי פרימיום — Allura",
    "fullName": "שם בעלת העסק", "phone": "", "email": "owner@example.com",
    "successUrl": "https://<הדומיין>/api/subscription/return?sid=...",
    "notifyUrl": "https://<הדומיין>/api/subscription/webhook",
    "recurring": true, "cField1": "<nonce>", "cField2": "<userId>", "cField3": "premium"
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

### 4b. (אופציונלי) תרחיש שלישי — "ביטול הוראת קבע"
כשבעלת עסק מבטלת מנוי במסך ההגדרות, Allura מבטלת מקומית (גישה עד סוף התקופה)
ומנסה לעצור את הוראת הקבע ב-Grow. ביטול הוראת קבע **לא נתמך במודולים הרגילים של
Make**, אז אם רוצים ביטול אוטומטי בונים תרחיש: Custom webhook → Grow **"Make an
API Call"** לנקודת ביטול הוראת הקבע (לפי `directDebitId` שנשלח בגוף הבקשה). העתק
את הכתובת ל-`MAKE_GROW_CANCEL_WEBHOOK_URL`.
**אם לא מגדירים** — הביטול המקומי עדיין תקף (הגישה נסגרת בסוף התקופה), ואת עוצרת
את הוראת הקבע ידנית מלוח הבקרה של Grow.

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

- **מסך /subscribe** — שער אחרי הרשמה, 2 תוכניות + מעבר לתשלום מאובטח.
- **השער (paywall) פעיל** — `requirePaidUser()` חוסם כניסה עד שיש `User.plan`
  שהופעל מתשלום מאומת; אדמין ומשתמשים קיימים (platinum) עוברים.
- **מתאם Make/Grow** — `src/lib/subscription/grow.ts`.
- **webhook מאומת** — `src/app/api/subscription/webhook/route.ts` (מקור האמת).
- **חזרה מהסליקה** — `src/app/api/subscription/return/route.ts`.
- **מודל נתונים** — `AccountSubscription` (סטטוס, תקופת חיוב, directDebitId).
- **מסך ניהול מנוי** — בהגדרות (/settings › "מנוי Allura"): התוכנית הנוכחית,
  סטטוס, מחיר, מועד חידוש, שדרוג לפלטינום, וביטול מנוי (עם אישור).
- **סריקה יומית** — `/api/cron/subscription-sweep` (03:00) סוגרת את הגישה למנויים
  שבוטלו/נכשלו כשתקופתם נגמרה. Grow מבצע את החיוב החודשי בעצמו — אין cron חיוב.
- **מצב פיתוח** — כשאין הגדרות Make, /subscribe מפעיל את התוכנית מיידית ללא
  סליקה, כדי לשמור על האפליקציה ניתנת להרצה מקומית.

> הערה: שמות השדות של חיווי הוראת-הקבע החוזר (directDebitId / paymentSource /
> statusCode) נלקחו מהתיעוד. כדאי לוודא אותם מול חיוב sandbox אמיתי ולעדכן את
> `parseCallback` אם Grow מחזיר שמות שונים בפועל. הפרסר נכתב הגנתי.
