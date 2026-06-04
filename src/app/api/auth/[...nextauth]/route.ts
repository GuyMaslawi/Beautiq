import { handlers } from "@/server/auth/config";

// NextAuth's catch-all route handler (login/logout/session/csrf endpoints).
export const { GET, POST } = handlers;
