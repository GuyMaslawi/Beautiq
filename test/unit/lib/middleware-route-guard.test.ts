import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Deny-by-default edge guard (src/middleware.ts).
 *
 * The point of the middleware is that a route nobody remembered to protect is
 * protected anyway. That property is invisible in normal use — it only shows up
 * the day someone adds a page and forgets the guard — so it is asserted here,
 * including the direction that actually matters: an UNKNOWN path must be closed.
 *
 * The public allowlist is asserted explicitly too. Accidentally dropping an entry
 * from it (say /b/ for the public booking page) would lock real clients out of
 * booking, and nothing else in the suite would notice.
 */

// NextRequest needs a real Request; construct the minimal surface middleware uses.
function makeRequest(pathname: string, cookies: string[] = []) {
  const url = `https://allura.info${pathname}`;
  return {
    nextUrl: { pathname },
    url,
    headers: new Headers(),
    cookies: {
      getAll: () => cookies.map((name) => ({ name, value: "x" })),
    },
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
let middleware: (req: any) => any;

beforeEach(async () => {
  vi.resetModules();
  ({ middleware } = await import("@/middleware"));
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const SESSION = "authjs.session-token";
const SECURE_SESSION = "__Secure-authjs.session-token";

describe("middleware — deny by default", () => {
  const protectedPaths = [
    "/dashboard",
    "/clients",
    "/settings",
    "/bookings",
    "/admin",
    "/finance",
    "/loyalty",
    "/subscribe",
    "/upgrade",
    // The one that matters most: a route that does not exist yet.
    "/some-page-added-next-month",
  ];

  it.each(protectedPaths)("redirects %s to /login without a session", (path) => {
    const res = middleware(makeRequest(path));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
  });

  it.each(["/api/owner/slots", "/api/upload", "/api/admin/automation/run-now"])(
    "answers %s with 401 rather than an HTML redirect",
    (path) => {
      const res = middleware(makeRequest(path));
      // A fetch() caller must get JSON it can read, not a login page that would
      // deserialize as a successful response.
      expect(res.status).toBe(401);
    },
  );

  it.each([SESSION, SECURE_SESSION, `${SESSION}.0`])(
    "lets a request through when cookie %s is present",
    (cookieName) => {
      const res = middleware(makeRequest("/dashboard", [cookieName]));
      expect(res.status).not.toBe(307);
      expect(res.status).not.toBe(401);
    },
  );

  it("ignores an unrelated cookie", () => {
    const res = middleware(makeRequest("/dashboard", ["theme", "locale"]));
    expect(res.status).toBe(307);
  });
});

describe("middleware — public allowlist", () => {
  const publicPaths = [
    "/",
    "/login",
    "/signup",
    "/about",
    "/contact",
    "/privacy",
    "/terms",
    "/b/studio-noa", // public booking page
    "/api/auth/callback/google",
    "/api/public/studio-noa/slots",
    "/api/cron/morning-reminder", // CRON_SECRET
    "/api/health",
    "/api/subscription/webhook", // shared secret
    "/api/whatsapp/webhook", // Meta HMAC
  ];

  it.each(publicPaths)("serves %s without a session", (path) => {
    const res = middleware(makeRequest(path));
    expect(res.status).not.toBe(307);
    expect(res.status).not.toBe(401);
  });

  it("does not treat a lookalike prefix as public", () => {
    // "/api/publicity" starts with "/api/public" as a raw string but is not
    // inside the public API namespace.
    const res = middleware(makeRequest("/api/publicity/secrets"));
    expect(res.status).toBe(401);
  });
});

describe("middleware — design lab", () => {
  it("is hidden in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const res = middleware(makeRequest("/design-lab/allura-luxury"));
    expect(res.status).toBe(404);
  });
});

describe("middleware — Content-Security-Policy", () => {
  it("issues a fresh nonce per request and never allows inline script", () => {
    const first = middleware(makeRequest("/login"));
    const second = middleware(makeRequest("/login"));

    const cspA = first.headers.get("content-security-policy")!;
    const cspB = second.headers.get("content-security-policy")!;

    const nonceA = cspA.match(/'nonce-([a-f0-9]+)'/)?.[1];
    const nonceB = cspB.match(/'nonce-([a-f0-9]+)'/)?.[1];

    expect(nonceA).toBeTruthy();
    expect(nonceA).not.toBe(nonceB); // a reused nonce is no better than unsafe-inline

    // 'unsafe-inline' in script-src is what makes CSP decorative against XSS.
    const scriptSrc = cspA
      .split(";")
      .find((d: string) => d.trim().startsWith("script-src"))!;
    expect(scriptSrc).not.toContain("unsafe-inline");
    expect(scriptSrc).toContain("strict-dynamic");
  });

  it("allows same-origin framing so the public-page preview keeps working", () => {
    // frame-ancestors 'none' blocks self-framing too, which broke the /public-page
    // preview iframe of /b/[slug]. 'self' still blocks a foreign site.
    const res = middleware(makeRequest("/b/studio-noa"));
    const csp = res.headers.get("content-security-policy")!;
    expect(csp).toContain("frame-ancestors 'self'");
  });
});
