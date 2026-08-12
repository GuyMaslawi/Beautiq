import { describe, it, expect } from "vitest";
import { parseCallback, isGrowConfigured, bodyCarriesSecret } from "@/lib/subscription/grow";

/**
 * Grow server-to-server callback parsing — the security-critical bit. The
 * webhook trusts this to decide whether a plan is paid, so it must only report
 * `paid` on a genuine approved status and must surface processId/token/nonce
 * exactly for authentication.
 */
describe("parseCallback", () => {
  it("returns null when nothing can tie the event to a subscription", () => {
    expect(parseCallback({})).toBeNull();
    expect(parseCallback({ data: { statusCode: "2" } })).toBeNull();
  });

  it("parses an approved first charge (statusCode 2) from a nested data object", () => {
    const event = parseCallback({
      data: {
        processId: "12345",
        processToken: "ptok",
        cField1: "nonce-abc",
        transactionId: "tx-9",
        directDebitId: "dd-777",
        cardSuffix: "4242",
        sum: "149.00",
        statusCode: "2",
      },
    });
    expect(event).not.toBeNull();
    expect(event).toMatchObject({
      processId: "12345",
      processToken: "ptok",
      nonce: "nonce-abc",
      outcome: "paid",
      transactionId: "tx-9",
      directDebitId: "dd-777",
      cardSuffix: "4242",
      sumMinor: 14900,
      isRecurringRun: false,
    });
  });

  it("flags an automatic monthly direct-debit run", () => {
    const event = parseCallback({
      data: {
        directDebitId: "dd-777",
        transactionId: "tx-second",
        paymentSource: "ריצת הוראת קבע",
        sum: "149.00",
        statusCode: "2",
      },
    });
    expect(event).toMatchObject({
      directDebitId: "dd-777",
      isRecurringRun: true,
      outcome: "paid",
    });
    // No processId on recurring runs — matched by directDebitId instead.
    expect(event?.processId).toBeUndefined();
  });

  it("does NOT mark unapproved statuses as paid", () => {
    const event = parseCallback({
      data: { processId: "1", processToken: "t", statusCode: "0" },
    });
    expect(event?.outcome).toBe("failed");
  });

  it("reads identifiers from a flat (non-nested) payload too", () => {
    const event = parseCallback({
      processId: "77",
      processToken: "flat-token",
      statusCode: "2",
      sum: 249,
    });
    expect(event).toMatchObject({ processId: "77", outcome: "paid", sumMinor: 24900 });
  });

  // ── The account-level webhook channel ────────────────────────────────────
  // Grow's dashboard webhooks name the same things differently, and this is the
  // ONLY channel that reports the automatic monthly renewals ("ריצות הוראת
  // קבע"). Reading `sum`/`transactionId` alone made every renewal unmatchable.

  it("parses a renewal reported by the account-level transaction webhook", () => {
    const event = parseCallback({
      data: {
        transactionCode: "TR-556",
        asmachta: "9911",
        directDebitId: "dd-777",
        paymentSum: 199,
        paymentsNum: 2,
        cardSuffix: "4242",
        statusCode: "2",
      },
    });
    expect(event).toMatchObject({
      transactionId: "TR-556",
      directDebitId: "dd-777",
      sumMinor: 19900,
      outcome: "paid",
      // No processId of ours: it can only be an automatic run.
      isRecurringRun: true,
    });
  });

  it("parses a failed standing order, which identifies it as regular_payment_id", () => {
    const event = parseCallback({
      data: {
        regular_payment_id: "dd-777",
        error_message: "כרטיס פג תוקף",
        charges_attempts: "3",
      },
    });
    expect(event).toMatchObject({
      directDebitId: "dd-777",
      outcome: "failed",
      failureReason: "כרטיס פג תוקף",
      attempts: 3,
      isRecurringRun: true,
    });
  });

  // The first real ₪1 charge, captured verbatim from production on 11.8.2026.
  // Two things it settled that no amount of reading the docs could: Grow reports
  // `sum` in SHEKELS, and the id we stored at checkout comes back as
  // `paymentLinkProcessId` — `processId` is a different id belonging to the
  // transaction. Matching on `processId` found nothing, so a real payment was
  // received and dropped.
  it("matches the payment-link process pair, not the transaction's", () => {
    const event = parseCallback({
      data: {
        status: "שולם",
        statusCode: "2",
        paymentType: "1",
        sum: "1",
        processId: "774449",
        processToken: "1fd4e4f21dccfae1d636433ea46822b9",
        transactionId: "535585",
        directDebitId: "236680",
        paymentLinkProcessId: "63984",
        paymentLinkProcessToken: "7c25af2ad67a4276a726ee16f29042fd",
        recurringDebitId: "9051",
        asmachta: "7096419",
        cardSuffix: "1398",
        customFields: "",
      },
    });

    // The link's id first — that is the one stored on the subscription row.
    expect(event?.processIds).toEqual(["63984", "774449"]);
    expect(event?.processTokens).toEqual([
      "7c25af2ad67a4276a726ee16f29042fd",
      "1fd4e4f21dccfae1d636433ea46822b9",
    ]);
    expect(event).toMatchObject({
      processId: "63984",
      processToken: "7c25af2ad67a4276a726ee16f29042fd",
      outcome: "paid",
      directDebitId: "236680",
      recurringDebitId: "9051",
      cardSuffix: "1398",
      // ₪1 reported as "1" — shekels, not agorot.
      sumMinor: 100,
    });
    // An empty customFields must not become a nonce that fails the match.
    expect(event?.nonce).toBeUndefined();
  });

  it("does not call a first purchase a renewal because of a zero periodical sum", () => {
    // Grow sends `periodicalPaymentSum=0` on every callback, first purchase
    // included. Reading its mere presence as evidence labelled every payment a
    // renewal in the ledger — and would have sent a FAILED first charge down
    // the renewal path, lapsing an account that should simply stay pending.
    const event = parseCallback({
      data: {
        statusCode: "2",
        sum: "1",
        paymentType: "1",
        paymentLinkProcessId: "64126",
        paymentLinkProcessToken: "090a3e90d6a76c59ccd6aa2be29cebab",
        processId: "774781",
        directDebitId: "236854",
        firstPaymentSum: "0",
        periodicalPaymentSum: "0",
      },
    });
    expect(event?.isRecurringRun).toBe(false);
  });

  it("still flags a run that carries a real periodical sum", () => {
    const event = parseCallback({
      data: { directDebitId: "236854", statusCode: "2", periodicalPaymentSum: "199" },
    });
    expect(event?.isRecurringRun).toBe(true);
  });

  it("reads the nonce Grow returns nested under customFields", () => {
    // Grow echoes the custom fields as `customFields.cField1`, not as a flat
    // `cField1`. Reading the container itself stringified the object, so the
    // value we round-trip specifically to authenticate never took part.
    const event = parseCallback({
      data: {
        paymentLinkProcessId: "3829492",
        statusCode: "2",
        sum: "1",
        customFields: {
          cField1: "e1f4a377-018c-4f50-9add-197562ab076c",
          cField2: "cmspq46cq0000i304i5hsb18z",
        },
      },
    });
    expect(event?.nonce).toBe("e1f4a377-018c-4f50-9add-197562ab076c");
  });

  it("reports `unknown` rather than guessing when there is no outcome at all", () => {
    // Neither an approval status nor a failure reason. Calling this paid grants
    // a free month; calling it failed locks out a paying customer. Both are
    // worse than stopping and asking a human.
    const event = parseCallback({ data: { directDebitId: "dd-777", paymentSum: 199 } });
    expect(event?.outcome).toBe("unknown");
  });

  it("treats an explicit error message as failure even alongside an approved status", () => {
    // The "failed standing order" webhook fires only on failure and may carry
    // the attempt's own status code.
    const event = parseCallback({
      data: { regular_payment_id: "dd-1", statusCode: "2", error_message: "אין יתרה" },
    });
    expect(event?.outcome).toBe("failed");
  });
});

/**
 * Sender authentication for the account-level channel. It cannot carry our
 * `?t=` query string — Grow echoes a constant we configure ("פרמטר מזהה")
 * inside the body instead.
 */
describe("bodyCarriesSecret", () => {
  const SECRET = "s3cret-value-long-enough";

  it("accepts the secret wherever Grow chooses to put it", () => {
    expect(bodyCarriesSecret({ customParam: SECRET }, SECRET)).toBe(true);
    expect(bodyCarriesSecret({ data: { identifier: SECRET } }, SECRET)).toBe(true);
  });

  it("rejects a body without it, and fails closed with no secret configured", () => {
    expect(bodyCarriesSecret({ data: { identifier: "wrong" } }, SECRET)).toBe(false);
    expect(bodyCarriesSecret({ customParam: SECRET }, undefined)).toBe(false);
    expect(bodyCarriesSecret({ customParam: "" }, "")).toBe(false);
  });

  it("ignores oversized values so a hostile body cannot burn CPU", () => {
    expect(bodyCarriesSecret({ blob: "x".repeat(5000) }, SECRET)).toBe(false);
  });
});

describe("isGrowConfigured", () => {
  it("is false without the feature flag and merchant identifiers", () => {
    // Tests never set SUBSCRIPTIONS_ENABLED / GROW_* — must resolve to false so
    // the checkout falls back to the safe dev activation and never hits Grow.
    expect(isGrowConfigured()).toBe(false);
  });
});
