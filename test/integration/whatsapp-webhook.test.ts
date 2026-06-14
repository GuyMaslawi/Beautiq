import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import crypto from "crypto";

/**
 * SECURITY-CRITICAL: the public webhook endpoint must:
 *   - GET: only echo hub.challenge when the verify token matches; else 403.
 *   - POST: reject forged payloads when META_WEBHOOK_APP_SECRET is set (bad signature -> 401).
 *   - POST: update only the matching (scoped) message/connection records.
 *   - POST: process STOP/opt-out without leaking data across businesses incorrectly
 *     (opt-out applies by phone across businesses, by design).
 */

vi.mock("@/server/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");
  const g = globalThis as Record<string, unknown>;
  g.__prismaMock ??= createPrismaMock();
  return { prisma: g.__prismaMock };
});
const prisma = (globalThis as Record<string, unknown>)
  .__prismaMock as ReturnType<typeof import("../helpers/prisma-mock").createPrismaMock>;

import { resetPrismaMock } from "../helpers/prisma-mock";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/whatsapp/webhook/route";
import { BUSINESS_A } from "../helpers/factories";

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  resetPrismaMock(prisma);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

function getReq(params: Record<string, string>): NextRequest {
  const url = new URL("https://example.com/api/whatsapp/webhook");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url.toString(), { method: "GET" });
}

function postReq(body: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("https://example.com/api/whatsapp/webhook", {
    method: "POST",
    body,
    headers,
  });
}

function sign(body: string, secret: string): string {
  return `sha256=${crypto.createHmac("sha256", secret).update(body).digest("hex")}`;
}

describe("webhook GET — verification challenge", () => {
  it("403 when META_WEBHOOK_VERIFY_TOKEN is not set", async () => {
    const res = await GET(getReq({ "hub.mode": "subscribe", "hub.verify_token": "x", "hub.challenge": "123" }));
    expect(res.status).toBe(403);
  });

  it("echoes the challenge when the verify token matches", async () => {
    process.env.META_WEBHOOK_VERIFY_TOKEN = "secret_verify";
    const res = await GET(
      getReq({ "hub.mode": "subscribe", "hub.verify_token": "secret_verify", "hub.challenge": "CHALLENGE_42" }),
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("CHALLENGE_42");
  });

  it("403 when verify token does not match", async () => {
    process.env.META_WEBHOOK_VERIFY_TOKEN = "secret_verify";
    const res = await GET(
      getReq({ "hub.mode": "subscribe", "hub.verify_token": "WRONG", "hub.challenge": "CHALLENGE_42" }),
    );
    expect(res.status).toBe(403);
  });

  it("403 when mode is not subscribe", async () => {
    process.env.META_WEBHOOK_VERIFY_TOKEN = "secret_verify";
    const res = await GET(
      getReq({ "hub.mode": "other", "hub.verify_token": "secret_verify", "hub.challenge": "C" }),
    );
    expect(res.status).toBe(403);
  });
});

describe("webhook POST — signature validation", () => {
  const validPayload = JSON.stringify({ object: "whatsapp_business_account", entry: [] });

  it("401 when signature is invalid and app secret is set", async () => {
    process.env.META_WEBHOOK_APP_SECRET = "app_secret";
    const res = await POST(postReq(validPayload, { "x-hub-signature-256": "sha256=deadbeef" }));
    expect(res.status).toBe(401);
  });

  it("401 when signature header is missing and app secret is set", async () => {
    process.env.META_WEBHOOK_APP_SECRET = "app_secret";
    const res = await POST(postReq(validPayload));
    expect(res.status).toBe(401);
  });

  it("200 when signature is valid", async () => {
    process.env.META_WEBHOOK_APP_SECRET = "app_secret";
    const sig = sign(validPayload, "app_secret");
    const res = await POST(postReq(validPayload, { "x-hub-signature-256": sig }));
    expect(res.status).toBe(200);
  });

  it("skips signature check (200) when app secret is unset, with a warning", async () => {
    const res = await POST(postReq(validPayload));
    expect(res.status).toBe(200);
    expect(warnSpy).toHaveBeenCalled();
  });

  it("400 on invalid JSON (after passing signature)", async () => {
    const res = await POST(postReq("{not json"));
    expect(res.status).toBe(400);
  });

  it("200 and ignores non-whatsapp objects", async () => {
    const res = await POST(postReq(JSON.stringify({ object: "page", entry: [] })));
    expect(res.status).toBe(200);
    expect(prisma.automationMessage.update).not.toHaveBeenCalled();
  });
});

describe("webhook POST — status events", () => {
  function statusPayload(status: string, providerMessageId: string, ts = "1700000000") {
    return JSON.stringify({
      object: "whatsapp_business_account",
      entry: [
        {
          id: "e1",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                statuses: [
                  { id: providerMessageId, status, timestamp: ts, recipient_id: "972501112222" },
                ],
              },
            },
          ],
        },
      ],
    });
  }

  it("updates the matching message scoped by its businessId on delivered", async () => {
    prisma.automationMessage.findFirst.mockResolvedValue({
      id: "msg_1",
      businessId: BUSINESS_A,
      sentAt: new Date(),
    });
    prisma.automationMessage.update.mockResolvedValue({});
    prisma.whatsAppConnection.updateMany.mockResolvedValue({ count: 1 });

    const res = await POST(postReq(statusPayload("delivered", "wamid.X")));
    expect(res.status).toBe(200);

    expect(prisma.automationMessage.findFirst).toHaveBeenCalledWith({
      where: { providerMessageId: "wamid.X" },
    });
    expect(prisma.automationMessage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "msg_1" },
        data: expect.objectContaining({ status: "delivered" }),
      }),
    );
    // Connection timestamps updated scoped to the message's business.
    expect(prisma.whatsAppConnection.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { businessId: BUSINESS_A } }),
    );
  });

  it("failed status records a failureReason", async () => {
    prisma.automationMessage.findFirst.mockResolvedValue({
      id: "msg_2",
      businessId: BUSINESS_A,
      sentAt: null,
    });
    prisma.automationMessage.update.mockResolvedValue({});
    prisma.whatsAppConnection.updateMany.mockResolvedValue({ count: 1 });

    const payload = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [
        {
          id: "e1",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                statuses: [
                  {
                    id: "wamid.F",
                    status: "failed",
                    timestamp: "1700000000",
                    recipient_id: "972501112222",
                    errors: [{ code: 131, title: "Undeliverable" }],
                  },
                ],
              },
            },
          ],
        },
      ],
    });
    await POST(postReq(payload));

    const updateArg = prisma.automationMessage.update.mock.calls[0][0] as {
      data: { failureReason?: string };
    };
    expect(updateArg.data.failureReason).toContain("Undeliverable");
  });

  it("ignores status events for unknown providerMessageId (no update)", async () => {
    prisma.automationMessage.findFirst.mockResolvedValue(null);
    const res = await POST(postReq(statusPayload("read", "wamid.UNKNOWN")));
    expect(res.status).toBe(200);
    expect(prisma.automationMessage.update).not.toHaveBeenCalled();
  });
});

describe("webhook POST — STOP opt-out", () => {
  function incomingPayload(text: string, from = "972501112222") {
    return JSON.stringify({
      object: "whatsapp_business_account",
      entry: [
        {
          id: "e1",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                messages: [{ from, id: "wamid.IN", timestamp: "1700000000", type: "text", text: { body: text } }],
              },
            },
          ],
        },
      ],
    });
  }

  it("STOP sets opt-out flags on matching client records", async () => {
    prisma.client.updateMany.mockResolvedValue({ count: 2 });
    const res = await POST(postReq(incomingPayload("STOP")));
    expect(res.status).toBe(200);

    expect(prisma.client.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          whatsappOptIn: false,
          marketingOptIn: false,
          unsubscribedAt: expect.any(Date),
        }),
      }),
    );
  });

  it("Hebrew הסר keyword triggers opt-out", async () => {
    prisma.client.updateMany.mockResolvedValue({ count: 1 });
    await POST(postReq(incomingPayload("הסר")));
    expect(prisma.client.updateMany).toHaveBeenCalled();
  });

  it("a normal (non-STOP) message does NOT opt anyone out", async () => {
    const res = await POST(postReq(incomingPayload("שלום, מתי התור שלי?")));
    expect(res.status).toBe(200);
    expect(prisma.client.updateMany).not.toHaveBeenCalled();
  });

  it("opt-out from unknown phone is a no-op (count 0) and still 200", async () => {
    prisma.client.updateMany.mockResolvedValue({ count: 0 });
    const res = await POST(postReq(incomingPayload("unsubscribe")));
    expect(res.status).toBe(200);
  });
});
