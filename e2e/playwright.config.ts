import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

const e2eDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(e2eDir, "..");
const stateDir = join(e2eDir, ".playwright");
const databasePath = join(stateDir, "markr-e2e.db");

const apiUrl = "http://127.0.0.1:4568";
const webUrl = "http://127.0.0.1:3001";

export default defineConfig({
  testDir: ".",
  outputDir: "test-results",
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: true,
  reporter: process.env.CI
    ? [
        ["github"],
        ["html", { open: "never", outputFolder: "playwright-report" }],
      ]
    : "list",
  use: {
    baseURL: webUrl,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: `mkdir -p ${stateDir} && rm -f ${databasePath} ${databasePath}-* && DATABASE_PATH=${databasePath} PORT=4568 CORS_ORIGINS=http://127.0.0.1:3001,http://localhost:3001 pnpm --filter @markr/api start`,
      cwd: repoRoot,
      url: `${apiUrl}/health`,
      timeout: 30_000,
      reuseExistingServer: false,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: `VITE_API_BASE_URL=${apiUrl} pnpm --filter @markr/web exec vite --host 0.0.0.0 --port 3001`,
      cwd: repoRoot,
      url: webUrl,
      timeout: 30_000,
      reuseExistingServer: false,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});
