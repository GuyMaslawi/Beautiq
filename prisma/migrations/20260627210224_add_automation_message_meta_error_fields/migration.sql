-- AlterTable
ALTER TABLE "AutomationMessage" ADD COLUMN     "errorCode" INTEGER,
ADD COLUMN     "errorFbtraceId" TEXT,
ADD COLUMN     "errorRaw" TEXT,
ADD COLUMN     "errorSubcode" INTEGER,
ADD COLUMN     "errorType" TEXT,
ADD COLUMN     "phoneNumberId" TEXT,
ADD COLUMN     "templateLanguage" TEXT;
