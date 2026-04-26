import { defineConfig, devices } from '@playwright/test'

const port = Number(process.env.E2E_PORT || 3100)
const baseURL = `http://127.0.0.1:${port}`
const e2eMode = process.env.E2E_MODE || 'development'
const isProductionMode = e2eMode === 'production'
const nextBin = './node_modules/next/dist/bin/next'

const desktopSpecs = /^(?!.*\.(mobile|production)\.spec\.ts$).*\.spec\.ts$/
const mobileSpecs = /.*\.mobile\.spec\.ts$/
const productionSpecs = /.*\.production\.spec\.ts$/

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: isProductionMode
      ? `npm run build && node ${nextBin} start -p ${port}`
      : `node scripts/start-e2e-server.js`,
    url: baseURL,
    reuseExistingServer: !process.env.CI && !isProductionMode,
    timeout: isProductionMode ? 240_000 : 120_000,
    env: {
      E2E_PORT: String(port),
      NEXT_PUBLIC_SHOW_INTRODUCTION: 'false',
      NEXT_PUBLIC_MODEL_TYPE: 'pngtuber',
      NEXT_PUBLIC_SELECTED_PNGTUBER_PATH: '/pngtuber/nike01',
    },
  },
  projects: isProductionMode
    ? [
        {
          name: 'production-chromium',
          testMatch: productionSpecs,
          use: { ...devices['Desktop Chrome'] },
        },
      ]
    : [
        {
          name: 'chromium',
          testMatch: desktopSpecs,
          use: { ...devices['Desktop Chrome'] },
        },
        {
          name: 'mobile-chromium',
          testMatch: mobileSpecs,
          use: { ...devices['Pixel 5'] },
        },
      ],
})
