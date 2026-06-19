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
  { href: "/bring-back", label: NAV.bringBack },
  { href: "/automations", label: NAV.automations },
  { href: "/finance", label: NAV.finance },
  { href: "/public-page", label: NAV.publicPage },
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
      { href: "/public-page", label: NAV.publicPage },
    ],
  },
  {
    label: "הגדלת הכנסות",
    items: [
      { href: "/bring-back", label: NAV.bringBack },
      { href: "/finance", label: NAV.finance },
    ],
  },
  {
    label: "מערכת",
    items: [
      { href: "/automations", label: NAV.automations },
      { href: "/settings", label: NAV.settings },
    ],
  },
];
