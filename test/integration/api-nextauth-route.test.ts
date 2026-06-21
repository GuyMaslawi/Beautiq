import { describe, it, expect, vi } from "vitest";

/**
 * The NextAuth catch-all route is a pure re-export of `handlers.{GET,POST}` from
 * the auth config. There is no branching logic to exercise — we mock the auth
 * config (so importing it never touches env/NextAuth internals) and assert the
 * route forwards the two handler functions verbatim.
 */
const { GET_HANDLER, POST_HANDLER } = vi.hoisted(() => ({
  GET_HANDLER: vi.fn(),
  POST_HANDLER: vi.fn(),
}));
vi.mock("@/server/auth/config", () => ({
  handlers: { GET: GET_HANDLER, POST: POST_HANDLER },
}));

import { GET, POST } from "@/app/api/auth/[...nextauth]/route";

describe("GET/POST /api/auth/[...nextauth]", () => {
  it("re-exports the NextAuth GET and POST handlers", () => {
    expect(GET).toBe(GET_HANDLER);
    expect(POST).toBe(POST_HANDLER);
    expect(typeof GET).toBe("function");
    expect(typeof POST).toBe("function");
  });
});
