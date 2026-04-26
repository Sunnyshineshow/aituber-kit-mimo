import { test, expect } from '@playwright/test'
import {
  closeSettings,
  expectPersistedSetting,
  gotoHome,
  openSettings,
  openSettingsTab,
  prepareApp,
} from './helpers/app'

test.beforeEach(async ({ page }) => {
  await prepareApp(page)
})

test('can configure YouTube mode and start or stop polling without API keys', async ({
  page,
}) => {
  await gotoHome(page)
  await openSettings(page)

  await openSettingsTab(page, 'youtube')
  await expect(page.getByTestId('youtube-mode-toggle')).toBeVisible()

  await page.getByTestId('youtube-mode-toggle').click()
  await expectPersistedSetting(page, 'youtubeMode', true)

  await page.getByTestId('youtube-api-key-input').fill('test-youtube-api-key')
  await expectPersistedSetting(page, 'youtubeApiKey', 'test-youtube-api-key')

  await page.getByTestId('youtube-live-id-input').fill('test-live-id')
  await expectPersistedSetting(page, 'youtubeLiveId', 'test-live-id')

  await page.getByTestId('youtube-source-onecomme-button').click()
  await expectPersistedSetting(page, 'youtubeCommentSource', 'onecomme')

  await page.getByTestId('onecomme-port-input').fill('11181')
  await expectPersistedSetting(page, 'onecommePort', 11181)

  await page.getByTestId('youtube-source-api-button').click()
  await expectPersistedSetting(page, 'youtubeCommentSource', 'youtube-api')
  await page.getByTestId('youtube-api-key-input').fill('')
  await page.getByTestId('youtube-live-id-input').fill('')

  await closeSettings(page)

  await expect(page.getByTestId('youtube-play-toggle-button')).toBeVisible()
  await page.getByTestId('youtube-play-toggle-button').click()
  await expect(page.getByTestId('youtube-play-toggle-button')).toHaveAttribute(
    'aria-pressed',
    'true'
  )

  await page.getByTestId('youtube-play-toggle-button').click()
  await expect(page.getByTestId('youtube-play-toggle-button')).toHaveAttribute(
    'aria-pressed',
    'false'
  )
})
