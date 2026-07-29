import type { DefaultSession } from "next-auth";

/**
 * Module augmentation: add our user id to the session and JWT types so the rest
 * of the app gets full type-safety on `session.user.id` and `token.id`.
 *
 * `authAt` is the epoch-ms moment the session was ISSUED (stamped once, at
 * sign-in). It is what makes JWT sessions revocable: getCurrentUser() compares
 * it against User.sessionsValidFrom, so a password reset can invalidate tokens
 * handed out earlier. Deliberately NOT the JWT's own `iat` — Auth.js re-encodes
 * the token on activity, which resets `iat` and would keep a stolen session
 * alive indefinitely.
 */
declare module "next-auth" {
  interface Session {
    user: { id: string; authAt?: number } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    authAt?: number;
  }
}
