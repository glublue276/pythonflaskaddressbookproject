const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests/e2e/ui-tests",
  timeout: 30_000,
  reporter: [["html", { open: "never" }]],
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: "http://127.0.0.1:5000",
    headless: true,
    trace: "on-first-retry",
  },
});
