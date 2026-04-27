import { test, expect, Page } from '@playwright/test'
import {
  expectPersistedSetting,
  gotoHome,
  openSettings,
  openSettingsTab,
  prepareApp,
  readPersistedSetting,
} from './helpers/app'

const lockoutStorageKey = 'aituber-kiosk-lockout'

async function disableFullscreenPrompt(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(Element.prototype, 'requestFullscreen', {
      configurable: true,
      value: undefined,
    })
  })
}

async function clickElement(page: Page, testId: string) {
  await page.getByTestId(testId).evaluate((element) => {
    ;(element as HTMLElement).click()
  })
}

test.beforeEach(async ({ page }) => {
  await disableFullscreenPrompt(page)
})

test('can configure kiosk mode and enforce browser input restrictions', async ({
  page,
}) => {
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

  await gotoHome(page)
  await openSettings(page)
  await openSettingsTab(page, 'kiosk')

  await expect(
    page.getByRole('heading', { name: 'Kiosk Mode Settings' })
  ).toBeVisible()

  await page.getByTestId('kiosk-passcode-input').fill('E2E9')
  await page.getByTestId('kiosk-passcode-input').blur()
  await expectPersistedSetting(page, 'kioskPasscode', 'E2E9')

  await page.getByTestId('kiosk-max-input-length-input').fill('50')
  await page.getByTestId('kiosk-max-input-length-input').blur()
  await expectPersistedSetting(page, 'kioskMaxInputLength', 50)

  await clickElement(page, 'kiosk-ng-word-toggle')
  await expectPersistedSetting(page, 'kioskNgWordEnabled', true)

  await page.getByTestId('kiosk-ng-words-input').fill('blocked, spam')
  await page.getByTestId('kiosk-ng-words-input').blur()
  await expect
    .poll(() => readPersistedSetting<string[]>(page, 'kioskNgWords'))
    .toEqual(['blocked', 'spam'])

  await clickElement(page, 'kiosk-mode-toggle')
  await expectPersistedSetting(page, 'kioskModeEnabled', true)
  await expect(page.getByTestId('kiosk-overlay')).toBeVisible()
  await expect(page.getByTestId('settings-panel')).toBeHidden()

  const messageInput = page.getByTestId('chat-message-input')
  await expect(messageInput).toHaveAttribute('maxlength', '50')

  await messageInput.fill('')
  await messageInput.pressSequentially('x'.repeat(60))
  await expect
    .poll(async () => (await messageInput.inputValue()).length)
    .toBeLessThanOrEqual(50)

  const aiRequests: string[] = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.pathname.startsWith('/api/ai/')) {
      aiRequests.push(url.pathname)
    }
  })

  await messageInput.fill('this contains blocked')
  await page.getByTestId('chat-send-button').click({ force: true })

  await expect(page.getByText('不適切な内容が含まれています')).toBeVisible()
  expect(aiRequests).toHaveLength(0)
})

test('opens the passcode dialog from kiosk overlay and temporarily unlocks settings', async ({
  page,
}) => {
  await prepareApp(page, {
    network: {
      blockExternal: true,
      mockUnhandledApi: true,
    },
    settings: {
      kioskModeEnabled: true,
      kioskPasscode: '2468',
      kioskTemporaryUnlock: false,
    },
  })

  await gotoHome(page)

  await expect(page.getByTestId('kiosk-overlay')).toBeVisible()
  await expect(page.getByTestId('open-settings-button')).toBeHidden()

  for (let i = 0; i < 5; i += 1) {
    await clickElement(page, 'kiosk-multi-tap-zone')
  }

  await expect(page.getByTestId('kiosk-passcode-dialog')).toBeVisible()
  await page.getByTestId('kiosk-passcode-dialog-input').fill('2468')
  await clickElement(page, 'kiosk-passcode-unlock-button')

  await expect(page.getByTestId('kiosk-passcode-dialog')).toBeHidden()
  await expect(page.getByTestId('kiosk-overlay')).toBeHidden()
  await expect(page.getByTestId('open-settings-button')).toBeVisible()

  await openSettings(page)
  await expect(page.getByTestId('settings-panel')).toBeVisible()
})

test('locks passcode entry after repeated failures and restores lockout from localStorage', async ({
  page,
}) => {
  await prepareApp(page, {
    network: {
      blockExternal: true,
      mockUnhandledApi: true,
    },
    settings: {
      kioskModeEnabled: true,
      kioskPasscode: '1357',
      kioskTemporaryUnlock: false,
    },
  })

  await gotoHome(page)

  for (let i = 0; i < 5; i += 1) {
    await clickElement(page, 'kiosk-multi-tap-zone')
  }

  await expect(page.getByTestId('kiosk-passcode-dialog')).toBeVisible()

  for (let i = 0; i < 3; i += 1) {
    await page.getByTestId('kiosk-passcode-dialog-input').fill(`wrong-${i}`)
    await clickElement(page, 'kiosk-passcode-unlock-button')
  }

  await expect(page.getByTestId('kiosk-passcode-lockout')).toBeVisible()
  await expect(page.getByTestId('kiosk-passcode-dialog-input')).toBeDisabled()
  await expect(page.getByTestId('kiosk-passcode-unlock-button')).toBeDisabled()

  const lockoutState = await page.evaluate((storageKey) => {
    const raw = localStorage.getItem(storageKey)
    return raw ? JSON.parse(raw) : null
  }, lockoutStorageKey)

  expect(lockoutState).toEqual(
    expect.objectContaining({
      totalFailures: 3,
    })
  )
  expect(lockoutState.lockoutUntil).toBeGreaterThan(Date.now())
})

test('restores an active kiosk passcode lockout without waiting for the timeout', async ({
  page,
}) => {
  await prepareApp(page, {
    network: {
      blockExternal: true,
      mockUnhandledApi: true,
    },
    settings: {
      kioskModeEnabled: true,
      kioskPasscode: '1357',
      kioskTemporaryUnlock: false,
    },
  })
  await page.addInitScript((storageKey) => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        lockoutUntil: Date.now() + 30_000,
        totalFailures: 3,
      })
    )
  }, lockoutStorageKey)

  await gotoHome(page)

  for (let i = 0; i < 5; i += 1) {
    await clickElement(page, 'kiosk-multi-tap-zone')
  }

  await expect(page.getByTestId('kiosk-passcode-dialog')).toBeVisible()
  await expect(page.getByTestId('kiosk-passcode-lockout')).toBeVisible()
  await expect(page.getByTestId('kiosk-passcode-dialog-input')).toBeDisabled()
})
