-- AlterTable
-- Test-only minute-based timing for automations. Production stays day-based:
-- timingUnit defaults to 'days', so existing rows are unchanged.
ALTER TABLE "AutomationSetting" ADD COLUMN     "timingUnit" TEXT NOT NULL DEFAULT 'days',
ADD COLUMN     "testThresholdMinutes" INTEGER,
ADD COLUMN     "testCooldownMinutes" INTEGER;
