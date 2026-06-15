# Allura — Claude Code Project Rules

## Product Focus Clarification

Allura is primarily a CRM and internal business management system for beauty and wellness business owners.

Allura is not primarily a customer-facing platform.

The main product experience is the authenticated business dashboard used by the business owner.

The core product should focus on:
- Services and pricing
- Availability
- Bookings
- Clients
- Client history
- Deposits
- Cancellations and no-shows
- WhatsApp-ready messages
- Client retention
- Empty time slots
- Business insights
- Rule-based recommendations

Public/client-facing pages are secondary supporting tools only.

A public booking page or public service page may exist in the future, but it should stay simple and serve the business owner’s workflow.

Do not overbuild:
- Customer accounts
- Customer dashboards
- Marketplace
- Social features
- Discovery platform
- Client-side product experience

Always prioritize the business owner’s CRM, daily workflow, and operational pain points.

## Playwright / E2E Testing Rules

Do not use Playwright by default.

During active MVP development, prioritize fast implementation and validation.

For each feature, normally run only:
- npm run typecheck
- npm run lint
- npm run build

Manual browser checks are enough unless the user explicitly asks for Playwright.

Do not:
- Create Playwright tests automatically
- Run Playwright after every change
- Spend time debugging Playwright unless requested
- Add E2E test infrastructure unless explicitly requested

Use Playwright only when:
- The user explicitly asks for E2E tests
- A flow is critical and stable enough to justify E2E coverage
- We are near a release/stabilization phase

For now, prefer:
- TypeScript validation
- Lint
- Build
- Focused manual test checklist
- Simple unit tests only if they are directly useful for business logic

If a feature prompt mentions manual tests, perform them manually or describe how to verify them.
Do not interpret manual tests as a request to write or run Playwright.

## 1. Product Context

We are building **Allura**, a Hebrew-only multi-tenant SaaS product for beauty and wellness businesses.

Allura helps small beauty businesses manage:
- Bookings
- Clients
- Services
- Availability
- Deposits
- Cancellations
- No-shows
- WhatsApp-ready messages
- Waitlists
- Empty time slots
- Client retention
- Business insights
- Future AI recommendations

Allura is not just a booking calendar.

Allura should become a smart business assistant that helps beauty business owners:
- Reduce manual work
- Prevent lost revenue
- Fill empty slots
- Bring clients back
- Manage the business more professionally
- Understand what actions to take today

---

## 2. Target Users

The main users are small beauty and wellness business owners in Israel.

Examples:
- Nail artists
- Brow artists
- Lash artists
- Hair stylists
- Makeup artists
- Cosmetics clinics
- Laser hair removal businesses
- Aesthetic treatment businesses
- Massage therapists
- Spa businesses
- Permanent makeup artists
- Other beauty/wellness service providers

Most users are not technical.

The product must be:
- Simple
- Clear
- Friendly
- Fast
- Easy to use
- Hebrew-first
- Mobile-friendly

---

## 3. Core Product Rule

The product must be generic for beauty and wellness businesses.

Do not build the system specifically for:
- Nails
- Brows
- Lashes
- Hair
- Makeup
- Cosmetics

Every treatment must be modeled as a generic `Service`.

A business can belong to one or more beauty/wellness categories.

Good model names:
- `Business`
- `BusinessCategory`
- `Service`
- `Client`
- `Booking`

Bad model names:
- `NailTreatment`
- `HairAppointment`
- `LashBooking`
- `BrowClient`

---

## 4. Tech Stack

Use:
- Next.js
- TypeScript
- PostgreSQL
- Prisma
- Tailwind CSS
- App Router

Do not use:
- MongoDB
- Firebase as the main database
- NoSQL as the core database
- Unnecessary libraries
- Overly complex architecture
- Microservices

Keep the architecture simple, clean, and scalable.

---

## 5. Language Rules

Allura is currently **Hebrew-only**.

All user-facing UI text must be in Hebrew only.

This includes:
- Navigation
- Buttons
- Forms
- Labels
- Empty states
- Error messages
- Success messages
- Dashboard cards
- Public booking page
- Client-facing messages
- WhatsApp-ready templates
- Status labels
- Settings
- Onboarding
- Tooltips
- Page titles

The Hebrew must be:
- Correct
- Simple
- Clear
- Natural
- Friendly
- Professional
- Easy to understand for non-technical users

Avoid:
- English UI labels
- Mixed Hebrew/English UI
- Technical jargon
- Robotic translations
- Overly formal Hebrew
- Slang that feels unprofessional
- Complicated wording

Good Hebrew examples:
- קביעת תור
- התורים שלי
- לקוחות
- שירותים ומחירים
- שעות פעילות
- תור חדש
- התור נקבע בהצלחה
- לא נמצאו תורים להיום
- שליחת הודעה בוואטסאפ
- מקדמה שולמה
- ממתין לאישור
- הלקוחה לא הגיעה
- ביטול תור
- שינוי מועד
- לקוחות שלא חזרו
- חלונות פנויים
- רשימת המתנה
- הגדרות העסק

Bad examples:
- Booking
- Dashboard
- Clients
- Service Management
- Submit
- No show
- Pending approval
- WhatsApp Template Manager

---

## 6. RTL Rules

The entire product must support RTL from the beginning.

Rules:
- Set Hebrew and RTL as the default product direction.
- Text should align right by default.
- Forms should be RTL.
- Tables should be readable in RTL.
- Navigation should support RTL.
- Icons should make sense in RTL.
- Spacing should feel natural for Hebrew.
- Public booking pages must be mobile-first and RTL.
- Do not build the UI in English and translate later.
- Build the UI Hebrew-first from the beginning.

Use Israeli/Hebrew-friendly date and time formats.

Examples:
- יום ראשון, 12 בינואר
- 14:30
- מחר ב־10:00
- היום
- השבוע
- החודש

---

## 7. Tone of Voice

Allura should sound like a helpful business assistant, not a technical admin panel.

Tone should be:
- Clear
- Warm
- Helpful
- Calm
- Professional
- Business-oriented
- Trustworthy

Avoid tone that is:
- Too technical
- Too cold
- Too childish
- Too salesy
- Too complicated

---

## 8. UX Principles

Prioritize:
- Simple flows
- Minimal clicks
- Mobile-friendly screens
- Clear empty states
- Clear success states
- Clear error states
- Fast actions
- Friendly Hebrew microcopy
- Beautiful but practical UI
- Premium and modern visual style
- Simple onboarding
- Easy daily use

Most beauty business owners need the product to feel obvious without training.

---

## 9. Design Direction

The UI should feel:
- Modern
- Clean
- Premium
- Soft
- Trustworthy
- Elegant
- Simple
- Mobile-first

The design should fit the beauty/wellness world without becoming childish or overloaded.

Avoid:
- Cluttered dashboards
- Too many colors
- Heavy admin-panel feeling
- Complex tables when simple cards are better
- Dense technical layouts

---

## 10. Multi-Tenant Data Rules

Allura is a multi-tenant SaaS product.

Tenant isolation is critical.

Almost every business-owned table must include `businessId`.

Every query for business-owned data must be scoped by the current `businessId`.

Never fetch, update, or delete business data only by record id.

Bad:

```ts
getBooking({ id: bookingId })
```

Good:

```ts
getBooking({
  id: bookingId,
  businessId: currentBusinessId
})
```

This rule applies to:
- Services
- Clients
- Bookings
- Payments
- Availability
- Message templates
- Reminders
- Waitlist entries
- Recommendations
- Business settings

Never expose data from one business to another.

---

## 11. Database Rules

Use PostgreSQL as the main database.

Use Prisma as the ORM.

Core models should include:
- User
- Business
- BusinessUser
- BusinessCategory
- Service
- Client
- Booking
- AvailabilityRule
- AvailabilityException
- Payment
- CancellationPolicy
- MessageTemplate
- Reminder
- WaitlistEntry
- Recommendation

Data modeling rules:
- Use generic models.
- Do not create domain-specific treatment models.
- Add `businessId` to tenant-owned models.
- Add `createdAt` and `updatedAt` to relevant models.
- Use enums for statuses and categories where useful.
- Use JSON only for flexible settings or metadata.
- Do not store core entities inside JSON.
- Do not store bookings, clients, services, or payments inside JSON fields.
- Add proper relations.
- Add indexes for common queries.
- Add unique constraints where needed.
- Think about fast insert and fast retrieval from the beginning.

Important indexes:
- `Business.slug` unique
- `BusinessUser.userId`
- `BusinessUser.businessId`
- `Service.businessId`
- `Service.businessId + isActive`
- `Client.businessId`
- `Client.businessId + phone`
- `Booking.businessId + startTime`
- `Booking.businessId + status`
- `Booking.businessId + clientId`
- `Booking.businessId + serviceId`
- `Payment.businessId + bookingId`
- `MessageTemplate.businessId + type`
- `WaitlistEntry.businessId + status`
- `Recommendation.businessId + status`

---

## 12. Booking Rules

Booking statuses:
- `pending`
- `approved`
- `completed`
- `cancelled`
- `no_show`
- `rescheduled`

Booking flow:
1. Client selects service.
2. Client selects available date/time.
3. Client enters name and phone.
4. Booking is created.
5. Business owner can approve, cancel, complete, mark as no-show, or reschedule.

Prevent accidental double-booking where possible.

Always consider:
- Service duration
- Business availability
- Availability exceptions
- Existing bookings
- Booking status
- Buffer time before/after service, if configured

---

## 13. Payment and Deposit Rules

Payment/deposit statuses:
- `not_required`
- `pending`
- `paid`
- `failed`
- `refunded`

V1 does not require real payment provider integration.

For V1:
- Support manual deposit tracking.
- Allow business owner to mark deposit as paid.
- Allow services to require deposit.
- Allow deposit amount per service.
- Allow cancellation policy per business.

Do not implement a real payment provider unless explicitly requested.

---

## 14. WhatsApp Rules

V1 should not integrate the real WhatsApp API.

Instead, implement WhatsApp-ready message templates.

The system should generate ready-to-send WhatsApp messages using dynamic variables.

Supported variables can include:
- `clientName`
- `businessName`
- `serviceName`
- `bookingDate`
- `bookingTime`
- `price`
- `depositAmount`

Message template types:
- `booking_confirmation`
- `booking_reminder`
- `booking_cancelled`
- `booking_rescheduled`
- `after_treatment`
- `rebook_reminder`
- `empty_slot_offer`
- `waitlist_offer`

All templates must be written in correct, simple Hebrew.

Example:

```text
היי {clientName}, התור שלך ל־{serviceName} אצל {businessName} נקבע ל־{bookingDate} בשעה {bookingTime}.
נשמח לראות אותך ❤️
```

---

## 15. Recommendation Rules

V1 should use rule-based recommendations, not real AI.

Do not build advanced AI unless explicitly requested.

Examples of rule-based recommendations:
- Client has not returned for more than X days.
- Tomorrow has empty slots.
- Booking is missing deposit.
- Client has multiple cancellations.
- Client was marked as no-show.
- Revenue this month is lower than previous month.
- There are clients in the waitlist who may want an earlier appointment.

Recommendation examples in Hebrew:
- יש לך 3 לקוחות שלא קבעו תור יותר מחודש
- מחר יש לך חלון פנוי בשעה 12:00
- לתור הזה עדיין לא סומנה מקדמה
- הלקוחה הזו ביטלה פעמיים בחודש האחרון
- ההכנסות החודש ירדו לעומת החודש הקודם

---

## 16. Authentication and Authorization Rules

Private business routes must be protected.

Public business pages can be accessed by slug, but only public-safe data should be exposed.

Do not expose private business data on public pages.

Do not expose unnecessary internal ids.

Protect:
- Dashboard
- Bookings
- Clients
- Payments
- Settings
- Recommendations
- Message templates

---

## 17. Code Quality Rules

Use strict TypeScript.

Rules:
- Keep components small and readable.
- Separate server logic from UI components.
- Use clear folder structure.
- Use reusable UI components.
- Validate inputs.
- Handle loading states.
- Handle empty states.
- Handle error states.
- Handle success states.
- Avoid unnecessary abstractions.
- Avoid unnecessary libraries.
- Avoid clever code when simple code is better.
- Do not hardcode business-specific data.
- Do not hardcode Hebrew text all over the app if a simple constants structure is better.
- Prefer maintainable code.
- Add comments only where they explain important business logic.

---

## 18. Mock Data and Seed Data

Avoid mock data in real flows.

Mock data is allowed only if:
- It is clearly marked as development seed data.
- It is not mixed with production logic.
- It can be removed easily.

Prefer real database-backed flows as early as possible.

---

## 19. Implementation Phases

Work in phases.

Do not build everything at once.

### Phase 1 — Planning

Create a planning document only.

No code.

### Phase 2 — Project Setup

Set up:
- Next.js
- TypeScript
- Tailwind CSS
- Prisma
- PostgreSQL connection
- Basic app shell
- Hebrew + RTL foundation

### Phase 3 — Database

Implement:
- Prisma schema
- Migrations
- Development seed data only if needed

### Phase 4 — Auth and Onboarding

Implement:
- Signup/login
- Create business
- Select categories
- Basic business profile

### Phase 5 — Business Core

Implement:
- Dashboard
- Services
- Availability
- Bookings

### Phase 6 — Public Client Flow

Implement:
- Public business page
- Service selection
- Date/time selection
- Client details
- Submit booking request

### Phase 7 — Business Operations

Implement:
- Clients
- Manual deposits
- Message templates
- Basic rule-based recommendations

Do not implement a later phase unless the current phase is stable or the user explicitly asks.

---

## 20. Out of Scope for Now

Do not build yet:
- Mobile app
- Marketplace
- Full accounting system
- Real payment provider
- Real WhatsApp API
- Advanced AI
- Complex staff management
- Complex multi-branch support
- Complex inventory management
- Loyalty program
- Marketing automation suite

These can be future features.

---

## 21. Working Style

Before making major changes:
- Explain the approach briefly.
- Keep changes focused.
- Do not rewrite unrelated files.
- Do not introduce big architecture changes without explaining why.
- If something is unclear, make a reasonable assumption and state it.
- Prefer progress with clean, simple implementation.

When implementing:
- Make one logical step at a time.
- Keep the app runnable.
- Avoid breaking existing flows.
- Check for TypeScript errors.
- Check for lint/build issues when possible.
- Update relevant documentation if needed.

---

## 22. First Claude Code Instruction

After this file is added to the project, the first instruction to Claude Code should be:

```text
Please read CLAUDE.md carefully and confirm that you understand the Allura project rules.

Do not create the project yet.
Do not write code yet.

After reading the rules, summarize:
1. The product goal
2. The technical stack
3. The most important architecture rules
4. The Hebrew/RTL requirements
5. What is out of scope for now
```

---

## 23. Current Instruction Priority

These project rules should guide all future work on Allura.

When the user asks for a new feature, always keep in mind:
- Hebrew-only UI
- RTL-first UX
- Multi-tenant safety
- PostgreSQL + Prisma
- Generic beauty/wellness data model
- Simple UX for non-technical users
- Clean, maintainable code
