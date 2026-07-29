import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { headers } from "next/headers";
import { prisma } from "@/server/db/prisma";
import { verifyPassword } from "@/server/auth/password";
import { validateLogin } from "@/lib/validation/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { checkPersistentRateLimit } from "@/server/rate-limit/persistent";
import { logger } from "@/lib/logger";

/**
 * Central NextAuth (Auth.js) configuration — the single source of truth for
 * authentication (see CLAUDE.md §13).
 *
 * Two ways in: email + password (Credentials) and "Sign in with Google". Both
 * resolve to a row in our own `User` table — Google is only an identity
 * provider, never a separate account store. Sessions use the JWT strategy
 * (required by the Credentials provider) and carry only our user id.
 * Business/tenant context is never stored in the token — it is always
 * re-derived server-side from the authenticated user through BusinessUser (see
 * CLAUDE.md §10 and src/server/auth/session.ts).
 *
 * Google credentials come from the AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET env vars,
 * which Auth.js reads automatically. The provider's redirect URI is
 * `/api/auth/callback/google` — it must be registered in the Google Cloud OAuth
 * client for every origin (localhost + production).
 */

/**
 * Map a verified Google identity to a row in our own `User` table, creating it
 * on first sign-in and linking by email for an existing account (so someone who
 * signed up with a password can also sign in with Google, same email). Returns
 * our user id, or null if the email is missing/unverified.
 *
 * Written with inline Prisma (no logActivity import) to avoid an auth-module
 * import cycle — same reasoning as the Credentials authorize() below. Telemetry
 * is best-effort and must never block a valid sign-in.
 */
/** Per-IP burst cap on credential attempts. */
const LOGIN_IP_MAX = 10;
const LOGIN_IP_WINDOW_MS = 10 * 60_000;
/** Per-account cap, so guessing one owner's password cannot be spread over IPs. */
const LOGIN_ACCOUNT_MAX = 10;
const LOGIN_ACCOUNT_WINDOW_MS = 15 * 60_000;
/**
 * The shared (DB-backed) per-account ceiling. Slightly higher than the in-memory
 * one so a single busy instance never trips it first — it exists to catch the
 * attempts spread across instances that the in-memory counter cannot see.
 */
const LOGIN_ACCOUNT_PERSISTENT_MAX = 15;

/**
 * True while this credential attempt is within every rate-limit bucket.
 *
 * Resolves the client IP from request headers; if the header store is
 * unavailable (outside a request scope) the per-IP bucket is skipped rather than
 * failing the login, but the per-account buckets still apply.
 *
 * Two LAYERS, not just two buckets. The in-memory buckets stop a burst instantly
 * and for free, but they are per-process: on Vercel, concurrent attempts land on
 * different serverless instances that each hold their own counter, so the
 * effective ceiling silently multiplies by the number of live instances — which
 * grows precisely when an attacker pushes harder. The persistent per-account
 * bucket is shared by every instance, so guessing one owner's password has a
 * single real ceiling no matter how the attempts are spread. It fails open on a
 * DB error, which is why the in-memory layer stays in front of it.
 */
async function withinLoginRateLimit(email: string): Promise<boolean> {
  try {
    const h = await headers();
    const ip = getClientIp(h);
    if (!checkRateLimit(`login:ip:${ip}`, LOGIN_IP_MAX, LOGIN_IP_WINDOW_MS)) {
      logger.warn("[auth] login rate limit hit (ip)");
      return false;
    }
  } catch {
    // no request scope — fall through to the per-account buckets
  }
  if (!checkRateLimit(`login:acct:${email}`, LOGIN_ACCOUNT_MAX, LOGIN_ACCOUNT_WINDOW_MS)) {
    logger.warn("[auth] login rate limit hit (account)");
    return false;
  }
  if (
    !(await checkPersistentRateLimit(
      `login:acct:${email}`,
      LOGIN_ACCOUNT_PERSISTENT_MAX,
      LOGIN_ACCOUNT_WINDOW_MS,
    ))
  ) {
    logger.warn("[auth] login rate limit hit (account, shared)");
    return false;
  }
  return true;
}

async function resolveGoogleUser(profile: {
  email?: string | null;
  name?: string | null;
  email_verified?: boolean;
}): Promise<string | null> {
  const email = profile.email?.trim().toLowerCase();
  if (!email || profile.email_verified === false) return null;

  const existing = await prisma.user.findUnique({ where: { email } });
  const user =
    existing ??
    (await prisma.user.create({
      // No passwordHash — a Google-only account cannot log in with a password
      // until one is set. name falls back to the Google display name.
      data: { email, name: profile.name ?? null },
    }));

  try {
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        actorType: user.isAdmin ? "admin" : "owner",
        category: "auth",
        action: existing ? "auth.login" : "auth.signup",
        summary: existing
          ? `התחברות עם Google (${user.email})`
          : `נרשם משתמש חדש עם Google: ${user.email}`,
      },
    });
    await prisma.user.update({
      where: { id: user.id },
      data: { lastSeenAt: new Date() },
    });
  } catch {
    // ignore — best-effort telemetry
  }

  return user.id;
}
export const { handlers, auth, signIn, signOut } = NextAuth({
  // trustHost makes Auth.js derive its base URL from the inbound Host /
  // X-Forwarded-Host header. Vercel normalises those to a deployment-owned
  // domain, so trusting them there is safe — but on a self-hosted deployment
  // behind a permissive proxy an attacker could send `Host: attacker.tld` and
  // steer the OAuth callback URL. So: trust the platform, or dev, and require an
  // explicit AUTH_URL anywhere else in production.
  trustHost: process.env.VERCEL === "1" || process.env.NODE_ENV !== "production",
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      authorize: async (credentials) => {
        const parsed = validateLogin({
          email: String(credentials?.email ?? ""),
          password: String(credentials?.password ?? ""),
        });
        if (!parsed.ok) return null;

        // Throttle HERE, not only in loginAction: `handlers` is exported at
        // /api/auth/[...nextauth], so POST /api/auth/callback/credentials reaches
        // this function directly and never touches the server action's limiter.
        // Without this, the login form's rate limit was cosmetic — an attacker
        // could grab one CSRF token and then guess passwords at full speed.
        // Two independent buckets: per-IP (burst) and per-account (so a
        // distributed attack still cannot hammer one owner's password), each of
        // which also caps the bcrypt work this endpoint can be made to do.
        if (!(await withinLoginRateLimit(parsed.value.email))) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.value.email },
        });
        // Returning null yields a generic "invalid credentials" outcome and
        // never reveals whether the email exists. A Google-only account has no
        // passwordHash, so password login is (correctly) rejected the same way.
        if (!user || !user.passwordHash) return null;

        const valid = await verifyPassword(
          parsed.value.password,
          user.passwordHash,
        );
        if (!valid) return null;

        // Record the login + refresh last-seen (best-effort — written inline
        // rather than via logActivity() to avoid an auth-module import cycle).
        // Fully guarded: telemetry must never block or fail a valid login.
        try {
          await prisma.activityLog.create({
            data: {
              userId: user.id,
              actorType: user.isAdmin ? "admin" : "owner",
              category: "auth",
              action: "auth.login",
              summary: `התחברות למערכת (${user.email})`,
            },
          });
          await prisma.user.update({
            where: { id: user.id },
            data: { lastSeenAt: new Date() },
          });
        } catch {
          // ignore — best-effort
        }

        // Only public-safe fields — passwordHash never leaves the server.
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
    Google({
      // Ask Google for the account chooser every time and request only the
      // basic profile + email scopes we actually use.
      authorization: {
        params: { prompt: "select_account", scope: "openid email profile" },
      },
    }),
  ],
  callbacks: {
    // Only allow Google sign-in when Google asserts a verified email — that is
    // the identity we key our own User row on.
    signIn: ({ account, profile }) => {
      if (account?.provider === "google") {
        return Boolean(profile?.email && profile.email_verified !== false);
      }
      return true;
    },
    jwt: async ({ token, user, account, profile }) => {
      // Google: on first sign-in (account+profile present) resolve/create our
      // own User row and store OUR id on the token — not Google's `sub`.
      if (account?.provider === "google") {
        const id = await resolveGoogleUser({
          email: profile?.email,
          name: profile?.name,
          email_verified:
            typeof profile?.email_verified === "boolean"
              ? profile.email_verified
              : undefined,
        });
        if (id) {
          token.id = id;
          token.authAt = Date.now();
        }
        return token;
      }
      // Credentials: authorize() already returned our user with its real id.
      if (user) {
        token.id = user.id;
        // Stamp WHEN this session was issued, once, at sign-in. This is what
        // makes a JWT session revocable: getCurrentUser() rejects it if the
        // account's sessionsValidFrom is later. It must not be the token's own
        // `iat` — Auth.js re-encodes the token as the user browses, which would
        // keep bumping `iat` forward and make revocation impossible.
        token.authAt = Date.now();
      }
      return token;
    },
    session: ({ session, token }) => {
      if (session.user && typeof token.id === "string") {
        session.user.id = token.id;
        if (typeof token.authAt === "number") {
          session.user.authAt = token.authAt;
        }
      }
      return session;
    },
  },
});
