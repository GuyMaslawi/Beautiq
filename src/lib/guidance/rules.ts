import { GUIDANCE, EMPTY_SLOTS, RETENTION, REPUTATION, PRICING } from "@/lib/constants/he";
import type { GuidanceQueryData } from "@/server/guidance/queries";

export type GuidancePriority = "important" | "recommended" | "info";

export interface GuidanceItem {
  id: string;
  title: string;
  description: string;
  priority: GuidancePriority;
  actionLabel: string;
  href: string;
}

const MAX_VISIBLE_CARDS = 5;

const PRIORITY_ORDER: Record<GuidancePriority, number> = {
  important: 0,
  recommended: 1,
  info: 2,
};

export function generateGuidanceItems(
  data: GuidanceQueryData,
  emptySlotCount = 0,
): GuidanceItem[] {
  const items: GuidanceItem[] = [];

  // A. No active services — setup blocker
  if (data.activeServicesCount === 0) {
    items.push({
      id: "no-services",
      title: GUIDANCE.rules.noServices.title,
      description: GUIDANCE.rules.noServices.body,
      priority: "important",
      actionLabel: GUIDANCE.rules.noServices.action,
      href: "/services/new",
    });
  }

  // B. No availability rules — setup blocker
  if (data.activeAvailabilityCount === 0) {
    items.push({
      id: "no-availability",
      title: GUIDANCE.rules.noAvailability.title,
      description: GUIDANCE.rules.noAvailability.body,
      priority: "important",
      actionLabel: GUIDANCE.rules.noAvailability.action,
      href: "/availability",
    });
  }


  // E. Bookings awaiting approval
  if (data.pendingBookingsCount > 0) {
    items.push({
      id: "pending-bookings",
      title: GUIDANCE.rules.pendingBookings.title,
      description: GUIDANCE.rules.pendingBookings.body,
      priority: "important",
      actionLabel: GUIDANCE.rules.pendingBookings.action,
      href: "/bookings",
    });
  }

  // D. Bookings scheduled for today
  if (data.todayBookingsCount > 0) {
    items.push({
      id: "today-bookings",
      title: GUIDANCE.rules.todayBookings.title,
      description: GUIDANCE.rules.todayBookings.body,
      priority: "recommended",
      actionLabel: GUIDANCE.rules.todayBookings.action,
      href: "/bookings",
    });
  }

  // F. Clients who have not returned in 30+ days → link to retention center
  if (data.lostClientsCount > 0) {
    items.push({
      id: "clients-not-returned",
      title: RETENTION.guidance.title,
      description: RETENTION.guidance.body,
      priority: "recommended",
      actionLabel: RETENTION.guidance.action,
      href: "/bring-back",
    });
  }

  // H. System ready but no upcoming bookings (only when setup is complete)
  if (
    data.activeServicesCount > 0 &&
    data.activeAvailabilityCount > 0 &&
    data.upcomingBookingsCount === 0
  ) {
    items.push({
      id: "no-upcoming-bookings",
      title: GUIDANCE.rules.noUpcomingBookings.title,
      description: GUIDANCE.rules.noUpcomingBookings.body,
      priority: "recommended",
      actionLabel: GUIDANCE.rules.noUpcomingBookings.action,
      href: "/bookings/new",
    });
  }

  // G. Clients with no-show history
  if (data.noShowClientsCount > 0) {
    items.push({
      id: "no-show-clients",
      title: GUIDANCE.rules.noShowClients.title,
      description: GUIDANCE.rules.noShowClients.body,
      priority: "info",
      actionLabel: GUIDANCE.rules.noShowClients.action,
      href: "/clients",
    });
  }

  // I. Empty slots in the next 7 days (only when setup is complete)
  if (
    emptySlotCount > 0 &&
    data.activeServicesCount > 0 &&
    data.activeAvailabilityCount > 0
  ) {
    items.push({
      id: "empty-slots",
      title: EMPTY_SLOTS.guidance.title,
      description: EMPTY_SLOTS.guidance.body,
      priority: "recommended",
      actionLabel: EMPTY_SLOTS.guidance.action,
      href: "/empty-slots",
    });
  }

  // J. Recent completed bookings — opportunity for thank-you / review request
  if (data.recentCompletedBookingsCount > 0) {
    items.push({
      id: "reputation",
      title: REPUTATION.guidance.title,
      description: REPUTATION.guidance.body,
      priority: "recommended",
      actionLabel: REPUTATION.guidance.action,
      href: "/reputation",
    });
  }

  // K. Pricing concerns — price below the manually defined market range
  if (data.pricingConcernCount > 0) {
    items.push({
      id: "pricing-concerns",
      title: PRICING.guidance.title,
      description: PRICING.guidance.body,
      priority: "info",
      actionLabel: PRICING.guidance.action,
      href: "/services",
    });
  }

  // Sort: important → recommended → info (stable within same priority)
  items.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);

  return items.slice(0, MAX_VISIBLE_CARDS);
}
