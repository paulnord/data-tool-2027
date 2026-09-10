import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/web",
  workers: 1,
  use: {
    baseURL:
      process.env.DATA_TOOL_WEB_URL ?? "http://127.0.0.1:5175/data-tool-2027/",
    channel: "chrome",
    viewport: { width: 1366, height: 768 },
    trace: "retain-on-failure",
  },
  webServer: process.env.DATA_TOOL_WEB_URL
    ? undefined
    : {
        command: "npm run preview -- --port 5175 --strictPort --base=/data-tool-2027/",
        url: "http://127.0.0.1:5175/data-tool-2027/",
        reuseExistingServer: false,
      },
});
