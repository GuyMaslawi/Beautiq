import { describe, it, expect } from "vitest";
import {
  buildMetaErrorReason,
  buildMetaErrorDetails,
} from "@/lib/whatsapp/meta-cloud-api";

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

describe("buildMetaErrorDetails", () => {
  it("extracts structured fields and a sanitized raw with no credentials", () => {
    const details = buildMetaErrorDetails({
      message: "Recipient phone number not in allowed list",
      type: "OAuthException",
      code: 131030,
      error_subcode: 2655007,
      fbtrace_id: "AfbTrace999",
      error_data: { details: "not in allowed list" },
    });
    expect(details?.code).toBe(131030);
    expect(details?.subcode).toBe(2655007);
    expect(details?.type).toBe("OAuthException");
    expect(details?.fbtraceId).toBe("AfbTrace999");
    // raw is parseable and carries only Meta's own diagnostic fields
    const raw = JSON.parse(details!.rawSanitized!);
    expect(raw.code).toBe(131030);
    expect(raw.fbtrace_id).toBe("AfbTrace999");
    expect(JSON.stringify(raw)).not.toMatch(/Bearer|EAA|access_token/i);
  });

  it("returns undefined when there is no error object", () => {
    expect(buildMetaErrorDetails(undefined)).toBeUndefined();
  });

  it("leaves non-numeric code/subcode as undefined", () => {
    const details = buildMetaErrorDetails({ message: "x" });
    expect(details?.code).toBeUndefined();
    expect(details?.subcode).toBeUndefined();
  });
});
