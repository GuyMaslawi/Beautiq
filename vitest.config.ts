import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

/**
 * Vitest configuration for Allura.
 *
 * - `tsconfigPaths` wires up the `@/*` alias from tsconfig so tests import the
 *   same way app code does.
 * - Default environment is `node` (server actions, libs, business logic). Files
 *   that render React components opt into jsdom with a top-of-file pragma:
 *     // @vitest-environment jsdom
 * - `setup.ts` registers jest-dom matchers and resets env between tests.
 */
export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./test/setup.ts"],
    include: ["test/**/*.test.{ts,tsx}", "src/**/*.test.{ts,tsx}"],
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: "v8",
      reportsDirectory: "./coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/page.tsx",
        "src/**/layout.tsx",
        "src/types/**",
      ],
    },
  },
});
