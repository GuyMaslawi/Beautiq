-- CreateEnum
CREATE TYPE "AccountPlan" AS ENUM ('premium', 'platinum');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "plan" "AccountPlan",
ADD COLUMN     "planActivatedAt" TIMESTAMP(3);

-- Grandfather existing accounts: any user created before the paywall keeps full
-- access on the top tier, so only NEW signups hit the subscribe gate.
UPDATE "User"
SET "plan" = 'platinum', "planActivatedAt" = now()
WHERE "plan" IS NULL;
