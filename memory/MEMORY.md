# Allura — Memory Index

- [No Playwright for Allura](feedback_no_playwright.md) — validate with typecheck/lint/build/manual only; Playwright only if explicitly requested
- [Settings feature (phase 7)](project_phase_settings.md) — /settings page built; addressNote added to schema; dashboard hasProfileDetails updated
- [Public booking request link](project_public_booking.md) — /b/[slug] live; pending bookings with source=public; settings copy button; checklist done
- [Smart Empty Slots feature](project_empty_slots.md) — dashboard section with slot detection, client suggestions, WhatsApp message copy; guidance card added
- [Retention / Follow-up Center](project_retention.md) — /retention page; client cards with message preview; guidance updated to link /retention; client profile card added
- [Reviews & Reputation feature](project_reputation.md) — /reputation page; thank-you & review messages; booking detail + client profile integration; guidance rule added
- [Pricing Insights feature](project_pricing.md) — /pricing route; marketMin/Avg/MaxPrice on Service; rule-based insights; guidance rule K added
- [Revenue Forecast Pro feature](project_revenue_forecast.md) — /revenue-forecast page; monthly target (last month +15%), gap, confidence, action recs, top services; dashboard gold card; plans marked live
- [Product direction reset (June 2026)](project_direction_reset.md) — new focus: bring clients back automatically; new nav (bring-back, automations, finance, public-page); deposits removed from dashboard; /bring-back hub built
- [Appointment Reminders feature](project_reminders.md) — /automations page; settings in Business.settings JSON; Reminder model tracks sent; dashboard attention card; manual WhatsApp send only
- [Public Page Customization](project_public_page_customization.md) — /public-page config + /b/[slug] premium mini-site; GalleryImage + ClientReview models; visibility toggles on Business; migration 20260609123545
- [Late Cancellation Policy feature](project_late_cancellation_policy.md) — schema migration, settings form, booking badge detection, detail page tracking, public page policy checkbox, dashboard attention card
- [Finance page feature](project_finance_page.md) — /finance live; Expense model + migration; revenue from bookings; manual expenses; profit visual; period filters; dashboard card shows real profit
- [Internal Admin Panel](project_admin_panel.md) — /admin for Allura team only; env-based ADMIN_EMAILS allowlist; BusinessSubscription model; businesses table with search/filter; detail + edit form
- [WhatsApp Win-back Automation (Phase 1)](project_win_back_automation.md) — schema models, dev-mock provider, eligibility engine, settings form, status panel, automations card, admin visibility; real sends gated by ENABLE_REAL_WHATSAPP_SEND=true
- [WhatsApp Automation Phase 1.5](project_whatsapp_automation_phase1_5.md) — E.164 normalization + backfill migration; dev mock → skipped (not sent); opt-in UX on client profile; breakdown panel; confirmation dialog before run
- [WhatsApp Phase 2B — Hebrew template support](project_whatsapp_phase2b.md) — testSendPassedAt schema field; test send saves milestone; he/he_IL quick-select; production readiness milestones in checklist
