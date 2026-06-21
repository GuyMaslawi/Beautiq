// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const h = vi.hoisted(() => ({
  connect: vi.fn(),
  diagnostic: vi.fn(),
  createTpl: vi.fn(),
  syncTpl: vi.fn(),
  disconnect: vi.fn(),
}));
vi.mock("@/server/admin/whatsapp-actions", () => ({
  adminConnectBusinessFromEnv: h.connect,
  adminCheckWhatsAppDiagnostic: h.diagnostic,
  adminCreateTemplatesForBusiness: h.createTpl,
  adminSyncTemplatesForBusiness: h.syncTpl,
  adminDisconnectBusiness: h.disconnect,
}));

import { WhatsAppAdminPanel } from "@/app/admin/businesses/[businessId]/_components/whatsapp-admin-panel";

beforeEach(() => {
  vi.clearAllMocks();
  for (const fn of Object.values(h)) fn.mockReset();
});

describe("WhatsAppAdminPanel", () => {
  it("renders all admin action buttons", () => {
    render(<WhatsAppAdminPanel businessId="b1" />);
    expect(screen.getByRole("button", { name: "בדיקת חיבור WhatsApp" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "חיבור WhatsApp לעסק בדיקה" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "יצירת תבניות" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "סנכרון תבניות" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ניתוק" })).toBeInTheDocument();
  });

  it("runs the diagnostic and renders its details", async () => {
    h.diagnostic.mockResolvedValue({
      ok: true,
      statusLabel: "החיבור תקין",
      details: [
        { ok: true, label: "טוקן", value: "קיים" },
        { ok: false, label: "תבניות", value: null },
      ],
    });
    render(<WhatsAppAdminPanel businessId="b1" />);
    await userEvent.click(screen.getByRole("button", { name: "בדיקת חיבור WhatsApp" }));
    expect(await screen.findByText("החיבור תקין")).toBeInTheDocument();
    expect(screen.getByText("טוקן")).toBeInTheDocument();
    expect(h.diagnostic).toHaveBeenCalledWith("b1");
  });

  it("connects from env then re-runs the diagnostic", async () => {
    h.connect.mockResolvedValue({
      success: true,
      statusLabel: "חובר בהצלחה",
      phoneNumberId: "pn_123",
    });
    h.diagnostic.mockResolvedValue({ ok: true, statusLabel: "תקין", details: [] });
    render(<WhatsAppAdminPanel businessId="b1" />);
    await userEvent.click(
      screen.getByRole("button", { name: "חיבור WhatsApp לעסק בדיקה" }),
    );
    expect(await screen.findByText("חובר בהצלחה")).toBeInTheDocument();
    expect(screen.getByText(/pn_123/)).toBeInTheDocument();
    expect(h.connect).toHaveBeenCalledWith("b1");
    expect(h.diagnostic).toHaveBeenCalledWith("b1");
  });

  it("creates templates and shows per-item results", async () => {
    h.createTpl.mockResolvedValue({
      success: false,
      statusLabel: "נוצרו עם אזהרות",
      items: [
        { name: "confirmation", status: "created" },
        { name: "reminder", status: "error", error: "rejected" },
      ],
    });
    render(<WhatsAppAdminPanel businessId="b1" />);
    await userEvent.click(screen.getByRole("button", { name: "יצירת תבניות" }));
    expect(await screen.findByText("נוצרו עם אזהרות")).toBeInTheDocument();
    expect(screen.getByText(/confirmation — created/)).toBeInTheDocument();
    expect(screen.getByText(/reminder — error \(rejected\)/)).toBeInTheDocument();
    expect(h.createTpl).toHaveBeenCalledWith("b1");
  });

  it("syncs templates", async () => {
    h.syncTpl.mockResolvedValue({ success: true, statusLabel: "סונכרן", items: [] });
    render(<WhatsAppAdminPanel businessId="b1" />);
    await userEvent.click(screen.getByRole("button", { name: "סנכרון תבניות" }));
    expect(await screen.findByText("סונכרן")).toBeInTheDocument();
    expect(h.syncTpl).toHaveBeenCalledWith("b1");
  });

  it("disconnects only after confirm() is accepted", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    h.diagnostic.mockResolvedValue({ ok: false, statusLabel: "מנותק", details: [] });
    render(<WhatsAppAdminPanel businessId="b1" />);

    await userEvent.click(screen.getByRole("button", { name: "ניתוק" }));
    expect(h.disconnect).not.toHaveBeenCalled();

    confirmSpy.mockReturnValue(true);
    await userEvent.click(screen.getByRole("button", { name: "ניתוק" }));
    expect(h.disconnect).toHaveBeenCalledWith("b1");
    expect(await screen.findByText("מנותק")).toBeInTheDocument();
    confirmSpy.mockRestore();
  });
});
