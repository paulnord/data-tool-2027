import { defineConfig } from "@playwright/test";
const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH;
export default defineConfig({
  testDir: "./tests/web",
  workers: 1,
  use: {
    baseURL:
      process.env.DATA_TOOL_WEB_URL ?? "http://127.0.0.1:5175/data-tool-2027/",
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
