import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";
const chrome = process.env.NILE_CHROME_PATH;
const liveDemo = process.env.NILE_LIVE_DEMO_URL;
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 35000,
  reporter: "list",
  use: {
    baseURL: liveDemo || "http://127.0.0.1:3001",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
    launchOptions: chrome ? { executablePath: chrome } : {},
  },
  webServer: liveDemo
    ? undefined
    : {
        command: "npx next start --hostname 127.0.0.1 --port 3001",
        url: "http://127.0.0.1:3001",
        reuseExistingServer: false,
        timeout: 30000,
        env: {
          NILE_DB_PATH: resolve(`.nile/e2e-${Date.now()}.sqlite`),
          OPENAI_API_KEY: "",
          OPENAI_MODEL: "",
        },
        gracefulShutdown: { signal: "SIGTERM", timeout: 1000 },
      },
});
