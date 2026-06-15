import { describe, it, expect } from "vitest";
import { validatePublicBooking } from "@/lib/validation/public-booking";
import { validateBooking } from "@/lib/validation/booking";
import { validateService } from "@/lib/validation/service";
import {
  validateWeeklyRules,
  validateException,
} from "@/lib/validation/availability";

describe("validatePublicBooking", () => {
  const valid = {
    serviceId: "svc_1",
    clientName: "דנה",
    phone: "0501234567",
    date: "2026-07-01",
    requestedTime: "10:00",
    note: "",
  };

  it("accepts a fully valid booking and trims values", () => {
    const r = validatePublicBooking({ ...valid, clientName: "  דנה  " });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.clientName).toBe("דנה");
  });

  it("requires service, name, phone, date, time", () => {
    const r = validatePublicBooking({
      serviceId: "",
      clientName: "",
      phone: "",
      date: "",
      requestedTime: "",
      note: "",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.serviceId).toBeTruthy();
      expect(r.errors.clientName).toBeTruthy();
      expect(r.errors.phone).toBeTruthy();
      expect(r.errors.date).toBeTruthy();
      expect(r.errors.requestedTime).toBeTruthy();
    }
  });

  it("rejects an invalid phone", () => {
    const r = validatePublicBooking({ ...valid, phone: "123" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.phone).toBeTruthy();
  });

  it("treats missing keys as empty (no crash)", () => {
    const r = validatePublicBooking({} as Record<string, string>);
    expect(r.ok).toBe(false);
  });
});

describe("validateBooking (owner side)", () => {
  it("validates required fields and phone", () => {
    const bad = validateBooking({
      clientName: "",
      phone: "abc",
      serviceId: "",
      date: "",
      startTime: "",
      notes: "",
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.errors.clientName).toBeTruthy();
      expect(bad.errors.phone).toBeTruthy();
      expect(bad.errors.serviceId).toBeTruthy();
    }
  });

  it("accepts valid input", () => {
    const r = validateBooking({
      clientName: "דנה",
      phone: "0501234567",
      serviceId: "svc_1",
      date: "2026-07-01",
      startTime: "10:00",
      notes: "הערה",
    });
    expect(r.ok).toBe(true);
  });
});

describe("validateService", () => {
  const base = {
    name: "מניקור",
    durationMinutes: "60",
    price: "150",
  } as Record<string, string>;

  it("accepts a valid service", () => {
    const r = validateService(base);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.durationMinutes).toBe(60);
      expect(r.value.price).toBe(150);
    }
  });

  it("never surfaces deposit fields on a validated service", () => {
    const r = validateService(base);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect("requiresDeposit" in r.value).toBe(false);
      expect("depositAmount" in r.value).toBe(false);
    }
  });

  it("requires name", () => {
    const r = validateService({ ...base, name: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.name).toBeTruthy();
  });

  it("rejects duration out of [5,480]", () => {
    expect(validateService({ ...base, durationMinutes: "4" }).ok).toBe(false);
    expect(validateService({ ...base, durationMinutes: "481" }).ok).toBe(false);
    expect(validateService({ ...base, durationMinutes: "0" }).ok).toBe(false);
  });

  it("rejects negative price", () => {
    expect(validateService({ ...base, price: "-1" }).ok).toBe(false);
  });

  it("ignores any deposit fields sent from the client", () => {
    const r = validateService({
      ...base,
      requiresDeposit: "true",
      depositAmount: "200",
    });
    // No deposit validation exists anymore — the service still validates fine.
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect("requiresDeposit" in r.value).toBe(false);
      expect("depositAmount" in r.value).toBe(false);
    }
  });

  it("ignores an invalid category key but keeps valid ones", () => {
    const bad = validateService({ ...base, categoryKey: "spaceships" });
    expect(bad.ok).toBe(true);
    if (bad.ok) expect(bad.value.categoryKey).toBeUndefined();

    const good = validateService({ ...base, categoryKey: "nails" });
    expect(good.ok).toBe(true);
    if (good.ok) expect(good.value.categoryKey).toBe("nails");
  });
});

describe("validateWeeklyRules", () => {
  function day(isOpen: boolean, startTime = "", endTime = "") {
    return { isOpen, startTime, endTime };
  }

  it("ignores closed days and keeps open ones", () => {
    const days = [
      day(true, "09:00", "17:00"),
      day(false),
      ...Array(5).fill(day(false)),
    ];
    const r = validateWeeklyRules(days);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.rules).toHaveLength(1);
      expect(r.rules[0]).toEqual({ weekday: 0, startMinutes: 540, endMinutes: 1020 });
    }
  });

  it("requires start/end on open days", () => {
    const r = validateWeeklyRules([day(true, "", "")]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.dayErrors[0]).toBeTruthy();
  });

  it("rejects end <= start", () => {
    const r = validateWeeklyRules([day(true, "17:00", "09:00")]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.dayErrors[0]?.endTime).toBeTruthy();
  });

  it("rejects invalid time format", () => {
    const r = validateWeeklyRules([day(true, "9am", "17:00")]);
    expect(r.ok).toBe(false);
  });
});

describe("validateException", () => {
  it("accepts a closed day exception", () => {
    const r = validateException({
      date: "2026-07-01",
      type: "closed",
      startTime: "",
      endTime: "",
      reason: "חופשה",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.type).toBe("closed");
      expect(r.value.reason).toBe("חופשה");
    }
  });

  it("requires hours for custom_hours and validates order", () => {
    const missing = validateException({
      date: "2026-07-01",
      type: "custom_hours",
      startTime: "",
      endTime: "",
      reason: "",
    });
    expect(missing.ok).toBe(false);

    const reversed = validateException({
      date: "2026-07-01",
      type: "custom_hours",
      startTime: "17:00",
      endTime: "09:00",
      reason: "",
    });
    expect(reversed.ok).toBe(false);

    const good = validateException({
      date: "2026-07-01",
      type: "custom_hours",
      startTime: "09:00",
      endTime: "13:00",
      reason: "",
    });
    expect(good.ok).toBe(true);
    if (good.ok) {
      expect(good.value.startMinutes).toBe(540);
      expect(good.value.endMinutes).toBe(780);
    }
  });

  it("rejects missing date and bad type", () => {
    const r = validateException({
      date: "",
      type: "weird",
      startTime: "",
      endTime: "",
      reason: "",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.date).toBeTruthy();
      expect(r.errors.type).toBeTruthy();
    }
  });
});
