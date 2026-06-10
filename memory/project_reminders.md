---
name: project-reminders
description: Appointment reminders feature built — /automations page, settings stored in Business.settings JSON, Reminder model tracks sent reminders
metadata:
  type: project
---

Appointment reminders feature is live at `/automations`.

**Why:** Core Allura promise — less manual WhatsApp work, fewer no-shows.

**How it works:**
- Reminder timing and template stored in `Business.settings` JSON (`reminderHoursBefore`, `reminderTemplate`)
- `Reminder` model (already existed) tracks sent reminders per booking (`type=booking_reminder`, `status=sent/pending`)
- Dashboard fetches `getRemindersDueCount` and shows an attention card linking to `/automations`
- No real auto-send — manual WhatsApp send only; banner clearly states this

**Files added:**
- `src/server/automations/queries.ts` — `getRemindersData`, `getRemindersDueCount`, `getReminderSettings`
- `src/server/automations/actions.ts` — `saveReminderSettingsAction`, `markReminderSentAction`, `markReminderPendingAction`
- `src/components/automations/reminder-settings-form.tsx` — preset timing + custom hours + template editor with variable chips
- `src/components/automations/reminders-due-list.tsx` — cards per booking with WhatsApp link, copy, mark sent/pending

**How to apply:** Future reminder features (e.g. real auto-send) should extend these same server files and the existing `Reminder` schema model. Settings should move from Business.settings JSON to dedicated columns only if they become core/indexed.
