# Phase 3 — Revenue Forecast & Pricing Insights: IA Recommendation

**Status:** Recommendation only. No UI/schema/API changes are proposed for implementation in this phase.
**Scope:** Where should `/revenue-forecast` and `/pricing` live, what should be promoted vs. hidden, and what the future information architecture should look like.
**Constraints respected:** No schema changes, no deletion of routes, preserve all existing capabilities. Everything below is reversible and additive.

---

## 0. Mental model used for the recommendation

Three surfaces, three distinct jobs. Every placement decision below maps a widget to the surface whose job it matches:

| Surface | Job | Owner question it answers |
|---|---|---|
| **Dashboard** | Command center / glance | "What needs my attention today?" |
| **Finance** | Ledger / actuals | "What happened — revenue, expenses, profit?" |
| **Services** | Catalog / operations | "What do I offer and at what price?" |
| **Forecast (today)** | Forward projection | "Will I hit my target this month?" |

Key facts that shape the recommendation:

- **Both pages are already out of the sidebar.** `/revenue-forecast` and `/pricing` are legacy routes reachable only by direct URL or scattered links. So "standalone" today already means "hidden destination," not "primary nav." The real question is *where the value should resurface*, not whether to remove a nav item (there is none).
- **There is zero data overlap today** between Forecast and Dashboard/Finance — they are separate queries. So consolidation is about *surfacing*, not deduping data.
- **There is heavy *conceptual* overlap.** Forecast re-derives things the rest of the app already shows: empty-slots CTAs, at-risk CTAs, win-back CTAs, and a "top services" list that Finance already renders. This is the main simplification opportunity.

---

## 1. Revenue Forecast

### 1.1 What it is today (widget inventory)

`/revenue-forecast` (813 lines) is powered by a single `getRevenueForecastData()` query and renders six blocks:

| # | Widget | Shows | Nature |
|---|---|---|---|
| 1 | **Hero card** (dark/premium) "צפי החודש" | Expected month-end revenue, on-track status, actual-vs-expected progress bars, confidence, day-of-month progress | Glanceable KPI + motivation |
| 2 | **Metric grid (6)** | Completed revenue, Expected revenue, Monthly target, Gap-to-target, Avg booking value, Lost revenue | Glanceable KPIs |
| 3 | **Revenue timeline** "פירוט הצפי החודשי" | Stacked bar: completed / upcoming / gap / lost | Analytical visualization |
| 4 | **Action recommendations** "מה אפשר לעשות כדי להגיע ליעד?" | CTA cards → empty slots, at-risk clients, win-back campaigns | Action / recommendation |
| 5 | **Top services** "שירותים שמכניסים הכי הרבה" | Top 5 services by completed revenue this month | Analytical breakdown |
| 6 | **Low-data banner** | "עדיין אין מספיק נתונים לתחזית מדויקת" | Informational guard |

### 1.2 Evaluation

**The genuinely unique, high-value part is the *forward* lens:** expected month-end revenue, the monthly target, the gap-to-target, on-track status, and the confidence/maturity signal. Nothing else in the app answers "will I hit my target?" This is worth keeping and worth making *visible* (it's currently buried on a hidden page).

**The weak parts are the ones that duplicate the rest of the app:**

- **Action recommendations (widget 4)** re-implement CTAs that already exist and are better-placed elsewhere: empty-slots and at-risk and win-back all now live in the `/bring-back` hub, and the Dashboard already has `AttentionCards` + `GrowthInsightsSection` driving the same actions. Three copies of "send a win-back campaign" is exactly the duplicate-surface problem this whole effort is removing.
- **Top services (widget 5)** duplicates Finance's existing `TopServices` section. Finance already ranks top-5 services by revenue for the selected period.
- **Lost revenue** is analytically interesting but emotionally discouraging as a glance metric for a non-technical owner. It belongs in a detail view, not on the Dashboard.

### 1.3 Recommendation

**Should it remain a standalone page?**
**No — demote it.** Split the unique forward-looking value across Dashboard (glance) and Finance (detail), and stop re-deriving CTAs/top-services that already exist. After the split, the standalone page has no unique content left, so it should be **retired as an entry point** (keep the route per the no-deletion rule; optionally reachable as a Finance "deep-dive" link, see below).

**Which parts belong on the Dashboard (promote — glance):**

- One **forecast "gold" card** (a condensed version of the Hero): expected month-end revenue + gap-to-target + on-track status + confidence. This is the single most motivating, most "command-center" piece, and the Dashboard currently has *no* forward-looking revenue view at all — only the month-to-date `הכנסה החודש` KPI. Place it in/next to `GrowthInsightsSection`.
- Gate it on `hasEnoughData` / `targetReliable` so new businesses don't see a noisy or low-confidence number (reuse the existing flags).

**Which parts belong in Finance (move — detail):**

- **Monthly target + gap-to-target** as a "יעד מול ביצוע" section in the Finance **month** view. Finance is the natural home for "target vs actual" — it already shows period revenue and `Upcoming Revenue`. The forecast's *expected* (completed + upcoming) maps directly onto Finance's existing completed + upcoming concepts.
- **Revenue timeline** (completed / upcoming / gap / lost composition) below the Finance summary cards — it's the same data Finance already has, drawn as a target-aware breakdown.
- **Metric grid:** fold the 2 net-new metrics (Monthly target, Gap-to-target) into Finance's month view. The other four already exist or are trivially derivable in Finance (completed revenue, avg booking value, upcoming) — **do not duplicate them.**

**What to hide / retire:**

- **Action-recommendation cards (widget 4):** retire. The actions already live in Dashboard `AttentionCards`/`GrowthInsightsSection` and in the `/bring-back` hub. If anything, add a single "פער ליעד" attention card to the Dashboard that links to `/bring-back` when a gap exists — one CTA, not a parallel recommendation engine.
- **Top services (widget 5):** retire from forecast; Finance's `TopServices` already covers it.
- **Lost revenue:** keep only inside the Finance detail timeline, not on the Dashboard.

**Net:** Forecast stops being a destination and becomes *two surfaced insights* — a Dashboard gold card (forward glance) and a Finance "target vs. actual" section (forward detail) — with its duplicate CTA/top-services blocks dropped.

---

## 2. Pricing Insights

### 2.1 What it is today

`/pricing` (174 lines), logic in `src/lib/pricing/insights.ts`. A business-wide summary header + a per-service card list with rule-based insights. The `Service` model already has `marketMinPrice` / `marketAveragePrice` / `marketMaxPrice` — and the **only** place to edit them is a collapsible inside each pricing card (they are *not* editable in the Services edit form).

**Business-wide summary (3 cards):** active services count · avg price per hour · count of services with a market range.

**Per-service insight types (7):**

| Insight | Rule | Needs manual input? | Value |
|---|---|---|---|
| נמוך מהטווח שהוגדר (below range) | `price < marketMinPrice` | Yes (range) | High *if* range set |
| בטווח שהוגדר (within range) | `min ≤ price ≤ max` | Yes (range) | Reassurance |
| גבוה מהטווח שהוגדר (above range) | `price > marketMaxPrice` | Yes (range) | Info |
| מחיר נמוך יחסית לשעה (low hourly value) | `pricePerHour < 0.7 × business avg` | **No** | Medium |
| שירות ארוך עם מחיר נמוך לשעה (long + low) | `duration ≥ 90 min AND pricePerHour < business avg` | **No** | **High — concrete, non-obvious** |
| מחיר גבוה יחסית לשעה (high hourly value) | `pricePerHour > 1.4 × business avg` | **No** | Info |
| שירות מבוקש (popular) | `completedBookings ≥ 1.5 × business avg` | **No** | Medium opportunity |

### 2.2 Evaluation

- **The market-range insights (below/within/above) require the owner to manually research and enter regional/category prices** with no data source behind it. For a non-technical beauty owner this is high friction and likely low adoption. These should be treated as an *optional power-user* feature, not the headline.
- **The self-referential insights need zero input and just work:** hourly value vs. the business's own average, the "long service priced low per hour" flag, and "popular service — consider price." The **long + low-price** flag is the standout — it catches genuinely underpriced 90+ minute services, which is exactly the kind of non-obvious, money-on-the-table insight that justifies the feature.
- **Almost every insight is per-service.** Only the 3 summary cards are business-wide, and that summary is thin.
- **There is already a per-service detail/edit page** (`/services/[serviceId]`) editing name, price, duration, buffers, category, active — the natural home for a per-service pricing health readout. Today an owner editing a price there gets no pricing feedback, and can't even set the market range there.

### 2.3 Recommendation

**Should it remain standalone? Should it move under Services?**
**Move it under Services.** Pricing is an attribute of a service, the insights are per-service, and Services already has both a list and a detail/edit screen. A separate pricing destination splits "manage my services" into two places for no benefit.

**Proposed split:**

- **Service detail page (`/services/[serviceId]`) — primary home.** Add a compact **"בריאות תמחור"** section showing, for that one service:
  - price-per-hour vs. business average (a single indicator, reusing the existing `insights.ts` logic),
  - any flagged insight for it (e.g. long+low, popular, below/above range),
  - the market-range fields made editable *here* (reuse the existing `market-range-form` component) so price + range + feedback live in one place.
- **Services list — lightweight summary.** Surface the 3 business-wide numbers (active services · avg ₪/hour · services with range) as a small banner or header strip on `/services`, plus a subtle badge on any list card that currently has a flagged insight, so owners can spot which services need a look without a separate page.
- **Retire `/pricing` as an entry point** once the above exists (keep the route per the no-deletion rule).

**Which insights provide real value (promote):**
- שירות ארוך עם מחיר נמוך לשעה (long + low) — **highest value**, no input needed.
- מחיר נמוך יחסית לשעה (low hourly value) — good, no input needed.
- שירות מבוקש (popular) — useful opportunity nudge.
- below/within/above range — valuable *only when* a range is set; keep as optional.

**Which parts are unnecessary complexity (de-emphasize):**
- The **manual market-range fields** as a headline feature — keep them, but make them optional/secondary (a "set a target range" affordance on the service detail), not the first thing an owner sees. Without an external benchmark data source they're friction for most users.
- The **high hourly value** insight — purely informational; keep but lowest priority.
- "within range" reassurance — fine as a quiet green badge, not a card that competes for attention.

---

## 3. Proposed future information architecture

```
Dashboard  (glance / command center)
├─ existing KPIs, attention cards, growth insights …
└─ [NEW] Forecast gold card        ← expected month-end revenue, gap-to-target,
                                      on-track + confidence  (gated on enough data)
   └─ "פער ליעד" → links to /bring-back when a gap exists

Finance  (actuals + now also "target vs. actual")
├─ period filter · summary cards · profit visual · TopServices · expenses (existing)
└─ [NEW] "יעד מול ביצוע" section (month view)  ← monthly target, gap, expected
   └─ revenue timeline (completed / upcoming / gap / lost)
   └─ optional "תחזית מלאה" deep-dive link → /revenue-forecast (route kept, not in nav)

Services  (catalog + pricing health)
├─ list: existing cards + [NEW] business-wide pricing summary strip + insight badges
└─ /services/[serviceId]: existing fields + [NEW] "בריאות תמחור" section
       (price/hour vs avg, flagged insight, editable market range)
   └─ optional deep-dive link → /pricing (route kept, not in nav)

Retired as destinations (routes kept alive, no nav, no new entry points):
  /revenue-forecast   → value surfaced on Dashboard + Finance
  /pricing            → value surfaced under Services
```

### What gets promoted vs. hidden — at a glance

| Item | Decision | New home |
|---|---|---|
| Expected month-end revenue + gap + confidence | **Promote** | Dashboard gold card |
| Monthly target + gap (detail) | **Move** | Finance month view |
| Revenue timeline (composition) | **Move** | Finance |
| Forecast action-recommendation cards | **Retire** (duplicate) | already in Dashboard + /bring-back |
| Forecast "top services" | **Retire** (duplicate) | already in Finance |
| Lost revenue | **Demote** | Finance detail only |
| Per-service pricing insights | **Move** | service detail "בריאות תמחור" |
| Long-service-low-price flag | **Promote** (best signal) | service detail + list badge |
| Pricing business-wide summary (3 cards) | **Move** | Services list strip |
| Manual market-range fields | **Keep, de-emphasize** | optional on service detail |

---

## 4. Suggested sequencing (for a future implementation phase — not now)

A low-risk order when/if approved, each step additive and independently shippable:

1. **Finance "target vs. actual" section** — highest-value, reuses `getRevenueForecastData()` data the app already computes; makes Finance the forward+backward money hub.
2. **Dashboard forecast gold card** — small, glanceable, gated on `hasEnoughData`.
3. **Service-detail "בריאות תמחור"** + make market range editable there.
4. **Services-list pricing summary strip + insight badges.**
5. Only after 1–4 are live and validated: retire `/revenue-forecast` and `/pricing` from any remaining entry points (routes stay, mirroring how Phase 2 handled the legacy bring-back routes).

### Open questions for the product owner
- **Forecast as a Pro feature:** the page carries a "Pro" badge. If forecast is meant to be monetized/gated, that argues for keeping a richer standalone deep-dive (linked from Finance) rather than fully dissolving it. Decision needed before step 5.
- **Market-range ambition:** is manual market pricing worth keeping long-term, or should it be dropped in favor of the zero-input self-referential insights until a real benchmark data source exists?

---

*No code was changed for this document. Phases 4 and 5 are not started.*
