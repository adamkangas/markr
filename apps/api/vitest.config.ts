import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    env: {
      DATABASE_PATH: join(tmpdir(), "markr-api-vitest", "markr.db"),
    },
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
