/**
 * Premium design-system tokens (shared by all Allura premium components).
 * Maps the semantic "tint" families to the CSS aura/gradient variables
 * defined in globals.css. Pure data — safe to import in server components.
 */

export type Tint =
  | "blush"
  | "rose"
  | "mauve"
  | "plum"
  | "champagne"
  | "sage";

/** Page ambient background (used by PremiumPageShell via --page-aura). */
export const tintAura: Record<Tint, string> = {
  blush: "var(--aura-blush)",
  rose: "var(--aura-rose)",
  mauve: "var(--aura-mauve)",
  plum: "var(--aura-plum)",
  champagne: "var(--aura-champagne)",
  sage: "var(--aura-sage)",
};

/** Medallion / icon-chip gradient fill per family. */
export const tintGradient: Record<Tint, string> = {
  blush: "var(--grad-blush)",
  rose: "var(--grad-blush)",
  mauve: "var(--grad-mauve)",
  plum: "var(--grad-plum)",
  champagne: "var(--grad-champagne)",
  sage: "var(--grad-sage)",
};

/** Solid-ish accent color per family (for text / thin accents). */
export const tintAccent: Record<Tint, string> = {
  blush: "#c97898",
  rose: "#b86b8c",
  mauve: "#9d6aa8",
  plum: "#7c3a61",
  champagne: "#b88a3e",
  sage: "#3d8b6e",
};

/** Soft tinted surface wash per family (for nested chips / aura panels). */
export const tintWash: Record<Tint, string> = {
  blush: "rgba(247,238,243,0.7)",
  rose: "rgba(247,238,243,0.7)",
  mauve: "rgba(243,238,246,0.7)",
  plum: "rgba(241,232,238,0.7)",
  champagne: "rgba(247,241,232,0.7)",
  sage: "rgba(232,245,240,0.7)",
};

export type ToneKey =
  | "neutral"
  | "brand"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "gold";

/** Semantic tone → {accent text, soft bg, border}. Used by pills/insights. */
export const tone: Record<ToneKey, { fg: string; bg: string; border: string; glow: string }> = {
  neutral: { fg: "#3d3545", bg: "rgba(138,129,144,0.10)", border: "rgba(138,129,144,0.22)", glow: "rgba(138,129,144,0.14)" },
  brand:   { fg: "#b86b8c", bg: "rgba(184,107,140,0.10)", border: "rgba(184,107,140,0.24)", glow: "rgba(201,120,152,0.20)" },
  success: { fg: "#2f7d61", bg: "rgba(61,139,110,0.10)", border: "rgba(61,139,110,0.24)", glow: "rgba(61,139,110,0.18)" },
  warning: { fg: "#a06a14", bg: "rgba(184,124,30,0.10)", border: "rgba(184,124,30,0.24)", glow: "rgba(184,124,30,0.18)" },
  danger:  { fg: "#b13b3b", bg: "rgba(190,74,74,0.10)", border: "rgba(190,74,74,0.24)", glow: "rgba(190,74,74,0.16)" },
  info:    { fg: "#2f6aa0", bg: "rgba(59,122,181,0.10)", border: "rgba(59,122,181,0.24)", glow: "rgba(59,122,181,0.16)" },
  gold:    { fg: "#a87c2a", bg: "rgba(192,149,96,0.12)", border: "rgba(192,149,96,0.28)", glow: "rgba(192,149,96,0.22)" },
};
