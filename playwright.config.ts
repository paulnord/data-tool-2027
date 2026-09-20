import { defineConfig } from "@playwright/test";
const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH;
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  // Clipboard is shared by browser processes on Linux CI.
  workers: process.env.CI ? 1 : undefined,
  use: {
    baseURL: "http://127.0.0.1:5174",
    channel: executablePath ? undefined : "chrome",
    // This opt-in path is used only in constrained development containers.
    launchOptions: executablePath
      ? {
          executablePath,
          args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-gpu",
            "--disable-webgl",
          ],
        }
      : undefined,
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
    storageState: {
      cookies: [],
      origins: [
        {
          origin: "http://127.0.0.1:5174",
          localStorage: [
            {
              name: "data-tool-2027.advanced-features",
              value: "true",
            },
          ],
        },
      ],
    },
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:5174",
    reuseExistingServer: !process.env.CI,
  },
});
