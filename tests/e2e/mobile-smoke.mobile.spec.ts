import { expect, test } from '@playwright/test'
import {
  expectPersistedSetting,
  gotoHome,
  openSettings,
  openSettingsTab,
  prepareApp,
} from './helpers/app'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Element.prototype, 'requestFullscreen', {
      configurable: true,
      value: undefined,
    })
  })

  await prepareApp(page, {
    network: {
      blockExternal: true,
      mockUnhandledApi: true,
    },
    settings: {
      kioskModeEnabled: false,
      kioskPasscode: '0000',
      kioskMaxInputLength: 200,
      kioskNgWords: [],
      kioskNgWordEnabled: false,
      kioskTemporaryUnlock: false,
    },
  })
})

test('opens the mobile shell, chat input, settings dropdown, and kiosk overlay', async ({
  page,
}) => {
  await gotoHome(page)

  await page
    .getByRole('button', { name: /Conversation Log/ })
    .evaluate((element) => {
      ;(element as HTMLElement).click()
    })
  await expect(page.getByTestId('chat-message-input')).toBeVisible()
  await expect(page.getByTestId('chat-send-button')).toBeVisible()

  await openSettings(page)
  await openSettingsTab(page, 'kiosk')
  await expect(
    page.getByRole('heading', { name: 'Kiosk Mode Settings' })
  ).toBeVisible()

  await page.getByTestId('kiosk-mode-toggle').evaluate((element) => {
    ;(element as HTMLElement).click()
  })
  await expectPersistedSetting(page, 'kioskModeEnabled', true)
  await expect(page.getByTestId('kiosk-overlay')).toBeVisible()
  await expect(page.getByTestId('settings-panel')).toBeHidden()
})
