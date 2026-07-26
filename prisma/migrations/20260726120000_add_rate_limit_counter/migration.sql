-- מונה הגבלת קצב משותף לכל מופעי השרת.
-- המגביל שבזיכרון הוא פר-תהליך, ובסביבת serverless הוא נחלש ככל שמספר
-- המופעים גדל. טבלה זו נותנת דלי אחד אמיתי לכל המופעים עבור הפעולות
-- הרגישות: התחברות/הרשמה (השתלטות על חשבון) ושליחת WhatsApp (עלות כספית).
CREATE TABLE "RateLimitCounter" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "resetAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitCounter_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "RateLimitCounter_resetAt_idx" ON "RateLimitCounter"("resetAt");
