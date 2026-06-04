import { PrismaClient } from "@prisma/client";

/**
 * Prisma Client כ-singleton.
 *
 * ב-Next.js בסביבת פיתוח, hot reload יוצר מופעים חדשים של המודול
 * ועלול לפתוח חיבורים מרובים למסד הנתונים. כדי למנוע זאת, אנו
 * שומרים מופע יחיד על אובייקט global ומשתמשים בו מחדש.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
