import { describe, it, expect, vi } from "vitest";

// template.ts transitively imports prisma + resolver; mock prisma so importing the
// module never instantiates a real client. The functions under test are pure.
vi.mock("@/server/db/prisma", () => ({ prisma: {} }));

import {
  firstName,
  buildCampaignVariables,
  renderCampaignPreview,
  type CampaignTemplateInfo,
} from "@/server/whatsapp/campaigns/template";

const NEUTRAL: CampaignTemplateInfo = {
  name: "win_back_offer_he",
  language: "he",
  category: "MARKETING",
  label: "החזרת לקוחות",
  variableNames: ["clientName", "businessName"],
  body: "היי {{1}}, מזמן לא ראינו אותך ב{{2}}.",
  example: ["נועה", "הסטודיו"],
  status: "approved",
  available: true,
  isAlluraManaged: true,
};

const RICHER: CampaignTemplateInfo = {
  ...NEUTRAL,
  variableNames: ["clientName", "businessName", "offer", "bookingUrl"],
  body: "היי {{1}} מ{{2}}: {{3}} — {{4}}",
};

describe("firstName", () => {
  it("returns the first token of a full name", () => {
    expect(firstName("נועה כהן לוי")).toBe("נועה");
    expect(firstName("  דנה  ")).toBe("דנה");
    expect(firstName("")).toBe("");
  });
});

describe("buildCampaignVariables", () => {
  it("maps clientName→first name and businessName positionally", () => {
    const vars = buildCampaignVariables(NEUTRAL, {
      clientFullName: "נועה כהן",
      businessName: "סטודיו יופי",
    });
    expect(vars).toEqual({ "1": "נועה", "2": "סטודיו יופי" });
  });

  it("fills owner-supplied values only for variables the template declares", () => {
    const vars = buildCampaignVariables(RICHER, {
      clientFullName: "דנה לוי",
      businessName: "הסטודיו",
      payload: { offer: "20% הנחה", bookingUrl: "https://x.co/b" },
    });
    expect(vars).toEqual({
      "1": "דנה",
      "2": "הסטודיו",
      "3": "20% הנחה",
      "4": "https://x.co/b",
    });
  });

  it("leaves an unknown declared variable empty when no payload provided", () => {
    const vars = buildCampaignVariables(RICHER, {
      clientFullName: "דנה",
      businessName: "הסטודיו",
    });
    expect(vars["3"]).toBe("");
    expect(vars["4"]).toBe("");
  });
});

describe("renderCampaignPreview", () => {
  it("substitutes positional placeholders", () => {
    const preview = renderCampaignPreview(NEUTRAL, { "1": "נועה", "2": "הסטודיו" });
    expect(preview).toBe("היי נועה, מזמן לא ראינו אותך בהסטודיו.");
  });
});
