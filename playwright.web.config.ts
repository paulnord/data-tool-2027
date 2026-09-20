import { defineConfig } from "@playwright/test";
const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH;
const baseURL =
  process.env.DATA_TOOL_WEB_URL ?? "http://127.0.0.1:5175/data-tool-2027/";
export default defineConfig({
  testDir: "./tests/web",
  workers: 1,
  use: {
    baseURL,
    channel: executablePath ? undefined : "chrome",
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
    viewport: { width: 1366, height: 768 },
    trace: "retain-on-failure",
    storageState: {
      cookies: [],
      origins: [
        {
          origin: new URL(baseURL).origin,
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
  webServer: process.env.DATA_TOOL_WEB_URL
    ? undefined
    : {
        command:
          "npm run preview -- --port 5175 --strictPort --base=/data-tool-2027/",
        url: "http://127.0.0.1:5175/data-tool-2027/",
        reuseExistingServer: false,
      },
});
