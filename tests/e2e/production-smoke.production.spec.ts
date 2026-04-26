import { expect, test } from '@playwright/test'
import { gotoHome, openSettings, prepareApp } from './helpers/app'

test.beforeEach(async ({ page }) => {
  await prepareApp(page, {
    network: {
      blockExternal: true,
      mockUnhandledApi: true,
    },
  })
})

test('loads the production app shell and core controls', async ({ page }) => {
  await gotoHome(page)

  await page.getByRole('button', { name: /Conversation Log/ }).click()
  await expect(page.getByTestId('chat-message-input')).toBeVisible()
  await expect(page.getByTestId('chat-send-button')).toBeVisible()

  await openSettings(page)
  await expect(page.getByTestId('settings-panel')).toBeVisible()
  await expect(
    page.getByTestId('settings-tab-ai').filter({ visible: true })
  ).toHaveCount(1)
})
