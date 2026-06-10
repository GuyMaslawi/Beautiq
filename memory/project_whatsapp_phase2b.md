---
name: project_whatsapp_phase2b
description: WhatsApp Phase 2B — Hebrew template support, testSendPassedAt tracking, production readiness milestones in UI
metadata:
  type: project
---

Phase 2B implemented on 2026-06-10. Builds on Phase 2A (Meta Cloud API provider, env routing, template guard, first test send using hello_world confirmed working).

**What was done:**
- `AutomationSetting.testSendPassedAt DateTime?` added to schema; migration `20260610120000_add_test_send_passed_at`
- `sendWhatsAppTestMessage` now persists `testSendPassedAt` on first successful sandbox send (only sets once, never overwrites)
- Test send uses `setting.templateName` and `setting.templateLanguage` — NOT hardcoded `hello_world`
- Template language field now has `he` / `he_IL` quick-select buttons (Meta sometimes requires `he_IL` for Hebrew)
- `WinBackAutomationData` exposes `sandboxTestPassed` and `hasRealBusinessPhone` (derived from `META_WHATSAPP_PHONE_NUMBER_ID` env)
- Setup checklist extended with "Production Readiness" subsection showing 3 milestones:
  1. שליחת בדיקה בוצעה בהצלחה (sandboxTestPassed)
  2. מספר טלפון עסקי רשום ב-Meta (hasRealBusinessPhone)
  3. תבנית עברית מאושרת מוגדרת (templateConfigured)

**Still NOT done (Phase 2C):**
- Webhooks / cron-based scheduled runs
- Production customer sending (WHATSAPP_TEST_MODE must remain true until real business phone confirmed)
- Real WhatsApp Business phone onboarding UI

**Safety invariants that must stay:**
- WHATSAPP_TEST_MODE=true blocks all sends except to WHATSAPP_TEST_PHONE
- templateName is required for any real send (checked in action before provider call)
- Production send requires explicit WHATSAPP_TEST_MODE=false

**Why:** Meta Cloud API confirmed working in Phase 2A. Phase 2B adds Hebrew template path and visible progress milestones so the business owner knows exactly what is left before going live.

**How to apply:** When continuing Phase 2B/C work, the test pipeline is: configure templateName (e.g. win_back_v1), set templateLanguage (he or he_IL), use test send button — sandboxTestPassed becomes true after first success.
