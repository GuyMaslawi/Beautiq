import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  withTransientDbRetry,
  isTransientDbError,
  getPrismaErrorCode,
} from "@/server/db/retry";

/**
 * P1001 בפרודקשן מגיע כ-PrismaClientInitializationError שחושף `errorCode`.
 * שגיאות KnownRequest חושפות `code`. בבדיקות משחזרים את שתי הצורות.
 */
function initError(errorCode: string): Error {
  return Object.assign(new Error("Can't reach database server"), { errorCode });
}

function knownRequestError(code: string): Error {
  return Object.assign(new Error("db error"), { code });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("isTransientDbError / getPrismaErrorCode", () => {
  it("recognizes P1001/P1002/P1017 via errorCode or code", () => {
    expect(isTransientDbError(initError("P1001"))).toBe(true);
    expect(isTransientDbError(initError("P1002"))).toBe(true);
    expect(isTransientDbError(knownRequestError("P1017"))).toBe(true);
    expect(getPrismaErrorCode(initError("P1001"))).toBe("P1001");
    expect(getPrismaErrorCode(knownRequestError("P1017"))).toBe("P1017");
  });

  it("rejects non-transient values", () => {
    expect(isTransientDbError(knownRequestError("P2025"))).toBe(false);
    expect(isTransientDbError(new Error("boom"))).toBe(false);
    expect(isTransientDbError(null)).toBe(false);
    expect(isTransientDbError("P1001")).toBe(false);
  });
});

describe("withTransientDbRetry", () => {
  it("retries once after P1001 and returns the second attempt's result", async () => {
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(initError("P1001"))
      .mockResolvedValueOnce("ok");

    const promise = withTransientDbRetry("cron.test", operation);

    // הניסיון החוזר הראשון מתוזמן אחרי 500ms
    await vi.advanceTimersByTimeAsync(500);

    await expect(promise).resolves.toBe("ok");
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("fails after 3 attempts when the error persists", async () => {
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValue(initError("P1001"));

    const promise = withTransientDbRetry("cron.test", operation);
    const assertion = expect(promise).rejects.toMatchObject({ errorCode: "P1001" });

    // שתי השהיות: 500ms ואז 1500ms
    await vi.advanceTimersByTimeAsync(500);
    await vi.advanceTimersByTimeAsync(1500);

    await assertion;
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it("does not retry a non-transient error", async () => {
    const validationError = knownRequestError("P2025");
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValue(validationError);

    await expect(withTransientDbRetry("cron.test", operation)).rejects.toBe(
      validationError,
    );
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("does not retry a plain exception without a Prisma code", async () => {
    const businessError = new Error("invalid input");
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValue(businessError);

    await expect(withTransientDbRetry("cron.test", operation)).rejects.toBe(
      businessError,
    );
    expect(operation).toHaveBeenCalledTimes(1);
  });
});
