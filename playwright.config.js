const { defineConfig, devices } = require('@playwright/test');
const path = require('path');

const extensionPath = path.join(__dirname, 'extension');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30000,
  use: {
    headless: false,
  },
  projects: [
    {
      name: 'chromium-extension',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            `--disable-extensions-except=${extensionPath}`,
            `--load-extension=${extensionPath}`,
            '--no-sandbox',
          ],
          headless: false,
        },
      },
    },
  ],
});
