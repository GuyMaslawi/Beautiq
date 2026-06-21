import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Coverage for the structured logger.
 *
 * `isProd`/`MIN_WEIGHT` are computed at module load from NODE_ENV, so each
 * env-mode branch resets the module registry and re-imports the logger after
 * stubbing NODE_ENV. We assert level routing (log/warn/error), the prod JSON
 * vs dev human format, the debug min-weight gate, and captureError's
 * Error/non-Error serialization.
 */

let logSpy: ReturnType<typeof vi.spyOn>;
let warnSpy: ReturnType<typeof vi.spyOn>;
let errSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.resetModules();
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

async function loadLogger() {
  return import("@/lib/logger");
}

describe("logger — development format", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development");
  });

  it("routes info/debug to console.log with a [LEVEL] prefix", async () => {
    const { logger } = await loadLogger();
    logger.info("hello", { a: 1 });
    logger.debug("dbg");
    expect(logSpy).toHaveBeenCalledWith("[INFO]", "hello", { a: 1 });
    // debug is shown in dev (MIN_WEIGHT = debug)
    expect(logSpy).toHaveBeenCalledWith("[DEBUG]", "dbg", "");
  });

  it("routes warn to console.warn and error to console.error", async () => {
    const { logger } = await loadLogger();
    logger.warn("careful");
    logger.error("boom", { code: 5 });
    expect(warnSpy).toHaveBeenCalledWith("[WARN]", "careful", "");
    expect(errSpy).toHaveBeenCalledWith("[ERROR]", "boom", { code: 5 });
  });

  it("omits the fields arg when fields is an empty object", async () => {
    const { logger } = await loadLogger();
    logger.info("nofields", {});
    expect(logSpy).toHaveBeenCalledWith("[INFO]", "nofields", "");
  });
});

describe("logger — production JSON format", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
  });

  it("emits one JSON line per record and routes by level", async () => {
    const { logger } = await loadLogger();
    logger.info("prod-info", { user: "u1" });
    logger.warn("prod-warn");
    logger.error("prod-error");

    const infoLine = JSON.parse(String(logSpy.mock.calls[0][0]));
    expect(infoLine).toMatchObject({ level: "info", msg: "prod-info", user: "u1" });
    expect(typeof infoLine.time).toBe("string");

    expect(JSON.parse(String(warnSpy.mock.calls[0][0])).level).toBe("warn");
    expect(JSON.parse(String(errSpy.mock.calls[0][0])).level).toBe("error");
  });

  it("drops debug records in production (below MIN_WEIGHT)", async () => {
    const { logger } = await loadLogger();
    logger.debug("should-not-appear");
    expect(logSpy).not.toHaveBeenCalled();
  });
});

describe("captureError", () => {
  it("serializes an Error with name/message/stack and merges context (dev)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { captureError } = await loadLogger();
    const err = new Error("kaboom");
    captureError("payments.webhook", err, { bookingId: "bkg_1" });

    expect(errSpy).toHaveBeenCalledTimes(1);
    const [prefix, message, fields] = errSpy.mock.calls[0] as [string, string, Record<string, unknown>];
    expect(prefix).toBe("[ERROR]");
    expect(message).toBe("[payments.webhook] kaboom");
    expect(fields).toMatchObject({
      scope: "payments.webhook",
      errName: "Error",
      errMessage: "kaboom",
      bookingId: "bkg_1",
    });
    expect(typeof fields.errStack).toBe("string");
  });

  it("serializes a non-Error value via String() and uses a generic message", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { captureError } = await loadLogger();
    captureError("cron.morning-reminder", "raw string failure");

    const line = JSON.parse(String(errSpy.mock.calls[0][0]));
    expect(line.msg).toBe("[cron.morning-reminder] error");
    expect(line.errMessage).toBe("raw string failure");
    expect(line.scope).toBe("cron.morning-reminder");
    expect(line.errName).toBeUndefined();
  });

  it("works with no context argument", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { captureError } = await loadLogger();
    captureError("scope.only", new Error("x"));
    expect(errSpy).toHaveBeenCalledTimes(1);
  });
});
