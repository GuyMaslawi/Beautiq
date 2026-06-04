import type { DefaultSession } from "next-auth";

/**
 * Module augmentation: add our user id to the session and JWT types so the rest
 * of the app gets full type-safety on `session.user.id` and `token.id`.
 */
declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
  }
}
