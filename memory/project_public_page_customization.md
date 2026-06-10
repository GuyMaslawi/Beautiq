---
name: project-public-page-customization
description: Public page customization feature — /public-page config and /b/[slug] redesign as premium mini-site
metadata:
  type: project
---

Public client-facing page customization implemented (Step 5).

**Why:** Business owners need to control what clients see on their public booking page, making it a premium mini-site not just a form.

**How to apply:** When touching the public page or booking flow, these are the key files:

- Schema: `GalleryImage` and `ClientReview` models added; `Business` has new public fields (`logoUrl`, `coverImageUrl`, `instagramUrl`, `introMessage`, visibility toggles: `showServices`, `showPrices`, `showHours`, `showReviews`, `showGallery`, `showCancellationPolicy`, `showPhone`, `showAddress`)
- Migration: `20260609123545_add_public_page_fields`
- Server: `src/server/public-page/queries.ts` and `src/server/public-page/actions.ts`
- Updated `src/server/public-booking/queries.ts` — now includes all new fields + gallery, reviews, availability hours
- Components: `src/components/public-page/` (public-profile-form, branding-form, visibility-form, gallery-manager, reviews-manager, public-link-preview)
- Owner config: `src/app/(app)/public-page/page.tsx` — full config page (no longer placeholder)
- Public page: `src/app/b/[slug]/page.tsx` — premium hero + services + gallery + reviews + hours layout
