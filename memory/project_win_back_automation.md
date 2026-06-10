---
name: project-win-back-automation
description: WhatsApp win-back automation — Phase 1 implemented; schema, provider abstraction, eligibility engine, settings form, status panel, automations card, admin visibility
metadata:
  type: project
---

Phase 1 of WhatsApp Win-back Automation is live.

**Why:** Core product promise — "המערכת מחזירה לקוחות בשבילך." Owners configure a threshold (days inactive), message template, offer type, and cooldown; the system finds eligible clients and tracks sends.

**What was built:**
- Schema: `WhatsAppConnection`, `AutomationSetting`, `AutomationRun`, `AutomationMessage` models + new enums; `Client.whatsappOptIn`, `marketingOptIn`, `unsubscribedAt` fields; migration `20260609170410_add_whatsapp_automation`
- Provider abstraction: `src/lib/whatsapp/provider.ts` — dev mock only; real sends require `ENABLE_REAL_WHATSAPP_SEND=true` env var + Phase 2 credentials
- Eligibility engine: `src/server/win-back-automation/eligibility.ts` — tenant-scoped, cooldown-aware, opt-in-aware
- Message builder: `src/server/win-back-automation/message-builder.ts` — Hebrew templates with `{שם}`, `{שם_העסק}`, `{שירות_אחרון}`, `{הטבה}` variables
- Server queries: `src/server/win-back-automation/queries.ts`
- Server actions: `src/server/win-back-automation/actions.ts` — `saveWinBackAutomationSetting`, `triggerWinBackRun`
- UI components: `src/components/win-back-automation/` — `WinBackSettingsForm`, `WinBackStatusPanel`, `WinBackAutomationsCard`
- `/bring-back` page updated: automation status + settings panel above manual send section
- `/automations` page updated: win-back card at top
- Admin `/admin/businesses/[businessId]` page updated: shows WhatsApp connected, automation enabled, sent/failed counts, last run

**Phase 2 remaining:** Real provider integration (Meta Cloud API / Twilio / Green API), webhook status updates, unsubscribe handling, retry logic, template approval UI.

**How to apply:** When adding automation-related features, build on these models. Real sending is gated by `ENABLE_REAL_WHATSAPP_SEND=true` — never fake delivery.
