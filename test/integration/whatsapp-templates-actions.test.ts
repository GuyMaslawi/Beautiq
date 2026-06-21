import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeBusiness, BUSINESS_A } from "../helpers/factories";

const requireCurrentBusiness = vi.fn();
vi.mock("@/server/auth/session", () => ({
  requireCurrentBusiness: () => requireCurrentBusiness(),
}));

const createDefaultTemplatesForBusiness = vi.fn();
const syncTemplatesForBusiness = vi.fn();
vi.mock("@/server/whatsapp/templates-core", () => ({
  createDefaultTemplatesForBusiness: (...a: unknown[]) => createDefaultTemplatesForBusiness(...a),
  syncTemplatesForBusiness: (...a: unknown[]) => syncTemplatesForBusiness(...a),
}));

import {
  createDefaultTemplatesAction,
  syncTemplatesAction,
} from "@/server/whatsapp/templates-actions";

beforeEach(() => {
  requireCurrentBusiness.mockReset().mockResolvedValue(makeBusiness({ id: BUSINESS_A }));
  createDefaultTemplatesForBusiness.mockReset();
  syncTemplatesForBusiness.mockReset();
});

describe("createDefaultTemplatesAction", () => {
  it("delegates to templates-core scoped to the current business", async () => {
    createDefaultTemplatesForBusiness.mockResolvedValue({ ok: true });
    const res = await createDefaultTemplatesAction();
    expect(res).toEqual({ ok: true });
    expect(createDefaultTemplatesForBusiness).toHaveBeenCalledWith(BUSINESS_A, undefined);
  });

  it("passes a single template name through for per-row retry", async () => {
    createDefaultTemplatesForBusiness.mockResolvedValue({ ok: true });
    await createDefaultTemplatesAction("booking_confirmation");
    expect(createDefaultTemplatesForBusiness).toHaveBeenCalledWith(
      BUSINESS_A,
      "booking_confirmation",
    );
  });

  it("requires an authenticated business (auth throws → action throws)", async () => {
    requireCurrentBusiness.mockRejectedValue(new Error("no session"));
    await expect(createDefaultTemplatesAction()).rejects.toThrow();
    expect(createDefaultTemplatesForBusiness).not.toHaveBeenCalled();
  });
});

describe("syncTemplatesAction", () => {
  it("delegates to templates-core scoped to the current business", async () => {
    syncTemplatesForBusiness.mockResolvedValue({ ok: true, synced: 4 });
    const res = await syncTemplatesAction();
    expect(res).toEqual({ ok: true, synced: 4 });
    expect(syncTemplatesForBusiness).toHaveBeenCalledWith(BUSINESS_A);
  });

  it("requires an authenticated business", async () => {
    requireCurrentBusiness.mockRejectedValue(new Error("no session"));
    await expect(syncTemplatesAction()).rejects.toThrow();
    expect(syncTemplatesForBusiness).not.toHaveBeenCalled();
  });
});
