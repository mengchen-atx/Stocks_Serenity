import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["lib/ai-normalize.ts", "lib/tickers.ts", "lib/session-token.ts", "lib/guest.ts", "lib/retry.ts", "lib/hash.ts"],
    },
  },
});
