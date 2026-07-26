/**
 * Simple in-memory rate limiter for public API routes and server actions.
 *
 * NOTE: This is per-process. On multi-instance deployments each instance has
 * its own counter, so effective limits are (limit × num-instances). For an
 * early-stage single-region SaaS this is an acceptable trade-off — no external
 * service required.
 */

type Entry = { count: number; resetAt: number };

const store = new Map<string, Entry>();

// Prune expired entries every 2 minutes to avoid unbounded memory growth.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}, 120_000).unref?.();

/**
 * Check whether `key` is within its rate limit window.
 * Returns `true` (allowed) or `false` (blocked — limit exceeded).
 */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= maxRequests) return false;

  entry.count++;
  return true;
}

/** מנקה את כל המונים — לשימוש בבדיקוֹת בלבד (בידוד בין test cases). */
export function __resetRateLimitForTests(): void {
  store.clear();
}

/**
 * Extract a best-effort client IP from Next.js request headers.
 *
 * Order matters for security. `x-real-ip` is set by the platform edge (Vercel)
 * and is not client-controllable, so it is preferred. When falling back to
 * `x-forwarded-for` we take the RIGHTMOST hop, not the leftmost: the leftmost
 * value is whatever the caller sent, so `-H 'X-Forwarded-For: 1.2.3.<random>'`
 * would mint a fresh rate-limit bucket per request and neutralise every limit in
 * the app. The rightmost entry is the one appended by the closest trusted proxy.
 *
 * Falls back to "unknown" when no IP header is present (local dev, etc.) — that
 * shares a single bucket, which is the safe direction to fail.
 */
export function getClientIp(
  headers: { get(name: string): string | null },
): string {
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;

  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded
      .split(",")
      .map((h) => h.trim())
      .filter(Boolean);
    if (hops.length > 0) return hops[hops.length - 1];
  }
  return "unknown";
}
