const { defineConfig } = require("@playwright/test");

const isCI = Boolean(process.env.CI);

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
  ...(isCI
    ? {
        webServer: {
          command: "python app.py",
          url: "http://127.0.0.1:5000/health",
          reuseExistingServer: false,
          timeout: 120_000,
          env: {
            MONGO_URI: process.env.MONGO_URI || "mongodb://127.0.0.1:27017/",
            MONGO_DB_NAME: process.env.MONGO_DB_NAME || "address_book",
            MONGO_COLLECTION: process.env.MONGO_COLLECTION || "contacts",
            PORT: "5000",
          },
        },
      }
    : {}),
});
