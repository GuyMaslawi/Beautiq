import { describe, it, expect } from "vitest";
import { slugify, isValidSlug, SLUG_MIN_LENGTH, SLUG_MAX_LENGTH } from "@/lib/slug";

describe("slugify", () => {
  it("lowercases and hyphenates ASCII names", () => {
    expect(slugify("Studio Yofi")).toBe("studio-yofi");
  });

  it("collapses runs of separators into single hyphens", () => {
    expect(slugify("a   b___c")).toBe("a-b-c");
  });

  it("trims leading/trailing hyphens", () => {
    expect(slugify("  -Hello-  ")).toBe("hello");
  });

  it("returns empty string for Hebrew-only names (nothing usable)", () => {
    expect(slugify("סטודיו יופי")).toBe("");
  });

  it("caps length at SLUG_MAX_LENGTH and trims trailing hyphen", () => {
    const long = "a".repeat(SLUG_MAX_LENGTH + 20);
    const result = slugify(long);
    expect(result.length).toBeLessThanOrEqual(SLUG_MAX_LENGTH);
  });
});

describe("isValidSlug", () => {
  it("accepts well-formed slugs within length range", () => {
    expect(isValidSlug("studio-yofi")).toBe(true);
    expect(isValidSlug("abc")).toBe(true);
    expect(isValidSlug("nails123")).toBe(true);
  });

  it("rejects slugs that are too short", () => {
    expect(isValidSlug("ab")).toBe(false);
    expect(isValidSlug("")).toBe(false);
  });

  it("rejects slugs that are too long", () => {
    expect(isValidSlug("a".repeat(SLUG_MAX_LENGTH + 1))).toBe(false);
  });

  it("rejects uppercase, spaces and non-ascii", () => {
    expect(isValidSlug("Studio")).toBe(false);
    expect(isValidSlug("studio yofi")).toBe(false);
    expect(isValidSlug("סטודיו")).toBe(false);
  });

  it("rejects leading/trailing/double hyphens", () => {
    expect(isValidSlug("-abc")).toBe(false);
    expect(isValidSlug("abc-")).toBe(false);
    expect(isValidSlug("a--b")).toBe(false);
  });

  it("honors the exported boundary constants", () => {
    expect(isValidSlug("a".repeat(SLUG_MIN_LENGTH))).toBe(true);
    expect(isValidSlug("a".repeat(SLUG_MIN_LENGTH - 1))).toBe(false);
  });
});
