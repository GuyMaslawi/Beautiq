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

/**
 * Extract a best-effort client IP from Next.js request headers.
 * Falls back to "unknown" when no IP header is present (local dev, etc.).
 */
export function getClientIp(
  headers: { get(name: string): string | null },
): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    // x-forwarded-for may be comma-separated; the first value is the client IP.
    return forwarded.split(",")[0].trim();
  }
  return headers.get("x-real-ip") ?? "unknown";
}
