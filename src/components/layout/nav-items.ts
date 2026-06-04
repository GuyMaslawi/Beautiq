import { NAV } from "@/lib/constants/he";

/**
 * The primary navigation of the authenticated app shell. Order is intentional
 * and shared between the desktop sidebar and the mobile nav strip. Some targets
 * are placeholders for now (CLAUDE.md §19) but are shown so the product already
 * feels complete.
 */
export interface NavItem {
  href: string;
  label: string;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/dashboard", label: NAV.dashboard },
  { href: "/bookings", label: NAV.bookings },
  { href: "/clients", label: NAV.clients },
  { href: "/services", label: NAV.services },
  { href: "/availability", label: NAV.availability },
  { href: "/messages", label: NAV.messages },
  { href: "/settings", label: NAV.settings },
];
