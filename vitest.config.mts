import { defineConfig } from "vitest/config";
import { fileURLToPath } from "url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // Pure domain logic only — no DOM needed.
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
