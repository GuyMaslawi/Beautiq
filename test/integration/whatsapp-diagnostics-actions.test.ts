import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeBusiness, BUSINESS_A } from "../helpers/factories";

const requireCurrentBusiness = vi.fn();
const getCurrentUser = vi.fn();
vi.mock("@/server/auth/session", () => ({
  requireCurrentBusiness: () => requireCurrentBusiness(),
  getCurrentUser: () => getCurrentUser(),
}));

const evaluateWhatsAppSend = vi.fn();
vi.mock("@/server/whatsapp/diagnostics", () => ({
  evaluateWhatsAppSend: (...a: unknown[]) => evaluateWhatsAppSend(...a),
}));

const sendReviewDemoTestMessage = vi.fn();
vi.mock("@/server/whatsapp/review-demo", () => ({
  sendReviewDemoTestMessage: (...a: unknown[]) => sendReviewDemoTestMessage(...a),
}));

import {
  runWhatsAppDryRunAction,
  runWhatsAppTestSendAction,
} from "@/server/whatsapp/diagnostics-actions";

beforeEach(() => {
  requireCurrentBusiness.mockReset().mockResolvedValue(makeBusiness({ id: BUSINESS_A }));
  getCurrentUser.mockReset().mockResolvedValue({ id: "admin", isAdmin: true });
  evaluateWhatsAppSend.mockReset();
  sendReviewDemoTestMessage.mockReset();
});

describe("runWhatsAppDryRunAction — admin only", () => {
  it("rejects a non-admin without evaluating", async () => {
    getCurrentUser.mockResolvedValue({ id: "u1", isAdmin: false });
    const res = await runWhatsAppDryRunAction({ messageType: "booking_confirmation" });
    expect(res.ok).toBe(false);
    expect(res.error).toBeTruthy();
    expect(evaluateWhatsAppSend).not.toHaveBeenCalled();
  });

  it("rejects when there is no user", async () => {
    getCurrentUser.mockResolvedValue(null);
    const res = await runWhatsAppDryRunAction({ messageType: "booking_confirmation" });
    expect(res.ok).toBe(false);
    expect(evaluateWhatsAppSend).not.toHaveBeenCalled();
  });

  it("evaluates scoped to the current business for an admin", async () => {
    evaluateWhatsAppSend.mockResolvedValue({ wouldSend: true });
    const res = await runWhatsAppDryRunAction({
      messageType: "booking_confirmation",
      clientId: "cli_1",
    });
    expect(res.ok).toBe(true);
    expect(res.evaluation).toEqual({ wouldSend: true });
    expect(evaluateWhatsAppSend).toHaveBeenCalledWith({
      businessId: BUSINESS_A,
      messageType: "booking_confirmation",
      clientId: "cli_1",
    });
  });

  it("normalizes an empty clientId to undefined", async () => {
    evaluateWhatsAppSend.mockResolvedValue({ wouldSend: false });
    await runWhatsAppDryRunAction({ messageType: "win_back", clientId: "" });
    expect(evaluateWhatsAppSend).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: undefined }),
    );
  });
});

describe("runWhatsAppTestSendAction — admin only", () => {
  it("rejects a non-admin without sending", async () => {
    getCurrentUser.mockResolvedValue({ id: "u1", isAdmin: false });
    const res = await runWhatsAppTestSendAction();
    expect(res.ok).toBe(false);
    expect(res.sent).toBe(false);
    expect(sendReviewDemoTestMessage).not.toHaveBeenCalled();
  });

  it("returns a sent result when the guarded path succeeds", async () => {
    sendReviewDemoTestMessage.mockResolvedValue({
      success: true,
      status: "sent",
      runId: "run_1",
    });
    const res = await runWhatsAppTestSendAction();
    expect(res.ok).toBe(true);
    expect(res.sent).toBe(true);
    expect(res.status).toBe("sent");
    expect(res.runId).toBe("run_1");
    expect(sendReviewDemoTestMessage).toHaveBeenCalledWith(BUSINESS_A);
  });

  it("reports a non-send (sent=false) with the block reason when the path refuses", async () => {
    sendReviewDemoTestMessage.mockResolvedValue({
      success: false,
      status: "skipped",
      reason: "אין תבנית מאושרת",
    });
    const res = await runWhatsAppTestSendAction();
    expect(res.ok).toBe(true);
    expect(res.sent).toBe(false);
    expect(res.status).toBe("skipped");
    expect(res.message).toBe("אין תבנית מאושרת");
  });

  it("uses a default Hebrew message when no reason is provided", async () => {
    sendReviewDemoTestMessage.mockResolvedValue({ success: false });
    const res = await runWhatsAppTestSendAction();
    expect(res.sent).toBe(false);
    expect(res.message).toBeTruthy();
  });
});
