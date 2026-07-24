import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { prisma } from "@/server/db/prisma";
import { verifyPassword } from "@/server/auth/password";
import { validateLogin } from "@/lib/validation/auth";

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
  // We run behind a single known host in dev; trust it so callback URLs resolve.
  trustHost: true,
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
        if (id) token.id = id;
        return token;
      }
      // Credentials: authorize() already returned our user with its real id.
      if (user) token.id = user.id;
      return token;
    },
    session: ({ session, token }) => {
      if (session.user && typeof token.id === "string") {
        session.user.id = token.id;
      }
      return session;
    },
  },
});
