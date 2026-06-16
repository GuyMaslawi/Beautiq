import { describe, it, expect } from "vitest";
import { buildMetaErrorReason } from "@/lib/whatsapp/meta-cloud-api";

/**
 * Meta error reasons must surface the diagnostic fields (code / type /
 * error_subcode / fbtrace_id) so the audit trail explains the exact failure —
 * and must NEVER include credentials (only Meta's own error fields are passed in).
 */
describe("buildMetaErrorReason", () => {
  it("includes message plus code/type/subcode/fbtrace_id", () => {
    const reason = buildMetaErrorReason(
      {
        message: "Template name does not exist",
        type: "OAuthException",
        code: 132001,
        error_subcode: 2494075,
        fbtrace_id: "AbCdEf123",
      },
      400,
    );
    expect(reason).toContain("Template name does not exist");
    expect(reason).toContain("code 132001");
    expect(reason).toContain("type OAuthException");
    expect(reason).toContain("subcode 2494075");
    expect(reason).toContain("trace AbCdEf123");
  });

  it("falls back to an HTTP-status message when no error object", () => {
    expect(buildMetaErrorReason(undefined, 500)).toBe("Meta API שגיאה 500");
  });

  it("omits missing optional fields gracefully", () => {
    const reason = buildMetaErrorReason({ message: "Bad request", code: 100 }, 400);
    expect(reason).toBe("Bad request [code 100]");
  });
});
