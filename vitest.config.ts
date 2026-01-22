import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    includeSource: ["src/**/*.ts"],
    include: ["tests/**/*.test.ts"],
  },
  define: {
    "import.meta.vitest": "undefined",
  },
});
