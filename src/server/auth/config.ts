import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/server/db/prisma";
import { verifyPassword } from "@/server/auth/password";
import { validateLogin } from "@/lib/validation/auth";

/**
 * Central NextAuth (Auth.js) configuration — the single source of truth for
 * authentication (see CLAUDE.md §13).
 *
 * V1 uses email + password only: a Credentials provider, no social login, no
 * magic links. Sessions use the JWT strategy (required by the Credentials
 * provider) and carry only the user id. Business/tenant context is never stored
 * in the token — it is always re-derived server-side from the authenticated
 * user through BusinessUser (see CLAUDE.md §10 and src/server/auth/session.ts).
 */
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
        // never reveals whether the email exists.
        if (!user) return null;

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
  ],
  callbacks: {
    jwt: ({ token, user }) => {
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
