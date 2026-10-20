import { defineConfig } from "@playwright/test";
const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH;
export default defineConfig({
  testDir: "./e2e",
  // Independent tests may run within the same file, including fit.spec.ts.
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  projects: [
    { name: "independent", grepInvert: /@clipboard/ },
    {
      name: "clipboard",
      grep: /@clipboard/,
      // The real system clipboard is shared across browser processes.
      // Keep all readers AND writers in this lane, including cross-window tests.
      fullyParallel: false,
      workers: 1,
    },
  ],
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
