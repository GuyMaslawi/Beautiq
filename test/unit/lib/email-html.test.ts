import { describe, it, expect } from "vitest";
import { escapeHtml } from "@/lib/email/html";

/**
 * Owner-notification emails interpolate values that an ANONYMOUS visitor
 * controls — the client name and phone typed into the public booking form. Without
 * escaping, a name like `</td></tr></table><a href="https://evil.example">…</a>`
 * injected an attacker-authored link into a genuine, Allura-branded email to the
 * business owner (phishing).
 */
describe("escapeHtml", () => {
  it("escapes all five HTML-significant characters", () => {
    expect(escapeHtml('&<>"\'')).toBe("&amp;&lt;&gt;&quot;&#39;");
  });

  it("escapes the ampersand first so entities are not double-broken", () => {
    expect(escapeHtml("a&lt;b")).toBe("a&amp;lt;b");
  });

  it("neutralises a tag-injection payload in a client name", () => {
    const payload =
      '</td></tr></table><a href="https://evil.example">אישור התור</a><table>';
    const out = escapeHtml(payload);
    expect(out).not.toContain("<a href");
    expect(out).not.toContain("</table>");
    expect(out).toContain("&lt;a href=&quot;https://evil.example&quot;&gt;");
  });

  it("leaves ordinary Hebrew text untouched", () => {
    expect(escapeHtml("דנה כהן")).toBe("דנה כהן");
  });

  it("returns an empty string unchanged", () => {
    expect(escapeHtml("")).toBe("");
  });
});
