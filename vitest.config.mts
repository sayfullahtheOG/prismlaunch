import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // lib/ only — component and E2E tests are out of scope for this timeline
    // (context/code-standards.md §Testing).
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: { "@": import.meta.dirname },
  },
});
