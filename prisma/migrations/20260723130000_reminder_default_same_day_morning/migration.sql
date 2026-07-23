-- Realign existing appointment-reminder settings to the same-day-morning timing.
--
-- Older businesses were seeded with the evening-before default
-- (thresholdDays = 1, sendHour = 18). The owner-facing settings only ever allow
-- hours 6–12, so that value could only have come from the old seed — never from
-- an owner choice. We move exactly those untouched seeds to same-day morning
-- (thresholdDays = 0, sendHour = 8), matching the new default and the UI.
--
-- Any business whose reminder was customised (sendHour in 6–12, or thresholdDays
-- already 0) does NOT match this filter and is left untouched.
UPDATE "AutomationSetting"
SET "thresholdDays" = 0,
    "sendHour" = 8,
    "updatedAt" = NOW()
WHERE "type" = 'morning_reminder'
  AND "thresholdDays" = 1
  AND "sendHour" = 18;
