import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, vi } from "vitest";

/**
 * Global test setup.
 *
 * SAFETY: WhatsApp real-send env vars are forced OFF before every test so no
 * test can ever trigger a real send, even if it forgets to set them. Individual
 * tests that exercise the real-send guards set these explicitly and rely on the
 * afterEach reset below.
 */

// Snapshot the baseline env once, then restore to it after each test so env
// mutations never leak between tests.
const BASELINE_ENV = { ...process.env };

beforeEach(() => {
  // Hard safety defaults — never allow real WhatsApp sends by default.
  delete process.env.ENABLE_REAL_WHATSAPP_SEND;
  delete process.env.WHATSAPP_PROVIDER;
  delete process.env.WHATSAPP_TEST_MODE;
  delete process.env.WHATSAPP_TEST_PHONE;
  delete process.env.WHATSAPP_USE_ENV_FALLBACK;
  delete process.env.META_WHATSAPP_ACCESS_TOKEN;
  delete process.env.META_WHATSAPP_PHONE_NUMBER_ID;
  delete process.env.META_WHATSAPP_WABA_ID;
});

afterEach(() => {
  // Restore the full env to baseline (removes any keys a test added).
  for (const key of Object.keys(process.env)) {
    if (!(key in BASELINE_ENV)) delete process.env[key];
  }
  Object.assign(process.env, BASELINE_ENV);
  vi.restoreAllMocks();
});
