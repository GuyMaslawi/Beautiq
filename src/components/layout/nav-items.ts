import { NAV } from "@/lib/constants/he";

export interface NavItem {
  href: string;
  label: string;
}

export interface NavGroup {
  label: string;
  items: readonly NavItem[];
}

/** Flat list — kept for any code that iterates all items without grouping. */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/dashboard", label: NAV.dashboard },
  { href: "/bookings", label: NAV.bookings },
  { href: "/clients", label: NAV.clients },
  { href: "/services", label: NAV.services },
  { href: "/availability", label: NAV.availability },
  { href: "/messages", label: NAV.messages },
  { href: "/retention", label: NAV.retention },
  { href: "/reputation", label: NAV.reputation },
  { href: "/pricing", label: NAV.pricing },
  { href: "/settings", label: NAV.settings },
];

/** Grouped nav — used by sidebar and mobile drawer. */
export const NAV_GROUPS: readonly NavGroup[] = [
  {
    label: "ניהול יומי",
    items: [
      { href: "/dashboard", label: NAV.dashboard },
      { href: "/bookings", label: NAV.bookings },
      { href: "/clients", label: NAV.clients },
    ],
  },
  {
    label: "העסק",
    items: [
      { href: "/services", label: NAV.services },
      { href: "/availability", label: NAV.availability },
      { href: "/messages", label: NAV.messages },
    ],
  },
  {
    label: "צמיחה",
    items: [
      { href: "/retention", label: NAV.retention },
      { href: "/reputation", label: NAV.reputation },
      { href: "/pricing", label: NAV.pricing },
    ],
  },
  {
    label: "מערכת",
    items: [{ href: "/settings", label: NAV.settings }],
  },
];
