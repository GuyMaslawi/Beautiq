import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests up to the limit then blocks", () => {
    const key = `test-key-${Math.random()}`;
    expect(checkRateLimit(key, 3, 1000)).toBe(true);
    expect(checkRateLimit(key, 3, 1000)).toBe(true);
    expect(checkRateLimit(key, 3, 1000)).toBe(true);
    expect(checkRateLimit(key, 3, 1000)).toBe(false); // 4th blocked
  });

  it("resets after the window elapses", () => {
    const key = `test-window-${Math.random()}`;
    expect(checkRateLimit(key, 1, 1000)).toBe(true);
    expect(checkRateLimit(key, 1, 1000)).toBe(false);
    vi.advanceTimersByTime(1001);
    expect(checkRateLimit(key, 1, 1000)).toBe(true);
  });

  it("tracks different keys independently", () => {
    const a = `a-${Math.random()}`;
    const b = `b-${Math.random()}`;
    expect(checkRateLimit(a, 1, 1000)).toBe(true);
    expect(checkRateLimit(a, 1, 1000)).toBe(false);
    // Different key still allowed
    expect(checkRateLimit(b, 1, 1000)).toBe(true);
  });
});

describe("getClientIp", () => {
  function headersFrom(map: Record<string, string>) {
    return { get: (name: string) => map[name.toLowerCase()] ?? null };
  }

  // The RIGHTMOST x-forwarded-for hop is the one appended by the closest trusted
  // proxy. Taking the leftmost value would let a caller mint a fresh rate-limit
  // bucket per request with a forged header, neutralising every limit.
  it("uses the last (trusted) IP from x-forwarded-for", () => {
    const h = headersFrom({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
    expect(getClientIp(h)).toBe("5.6.7.8");
  });

  it("prefers the platform-set x-real-ip over a client-supplied x-forwarded-for", () => {
    const h = headersFrom({
      "x-real-ip": "9.9.9.9",
      "x-forwarded-for": "1.2.3.4",
    });
    expect(getClientIp(h)).toBe("9.9.9.9");
  });

  it("falls back to x-real-ip", () => {
    const h = headersFrom({ "x-real-ip": "9.9.9.9" });
    expect(getClientIp(h)).toBe("9.9.9.9");
  });

  it("returns 'unknown' when no IP header present", () => {
    expect(getClientIp(headersFrom({}))).toBe("unknown");
  });
});
