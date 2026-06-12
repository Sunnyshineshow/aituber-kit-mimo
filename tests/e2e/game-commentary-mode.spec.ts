import { test, expect } from '@playwright/test'
import {
  closeSettings,
  expectPersistedSetting,
  gotoHome,
  openSettings,
  prepareApp,
  setControlValue,
} from './helpers/app'

test.beforeEach(async ({ page }) => {
  await prepareApp(page)
})

test('can configure game commentary mode and start or stop capture-driven playback', async ({
  page,
}) => {
  await gotoHome(page)
  await openSettings(page)

  await page.getByTestId('settings-tab-gameCommentary').click()
  await expect(page.getByTestId('game-commentary-enabled-toggle')).toBeVisible()

  await page.getByTestId('game-commentary-enabled-toggle').click()
  await expectPersistedSetting(page, 'gameCommentaryEnabled', true)

  await setControlValue(page, 'game-commentary-capture-interval-input', '10')
  await expectPersistedSetting(page, 'gameCommentaryCaptureInterval', 10)

  await setControlValue(page, 'game-commentary-image-quality-input', '0.8')
  await expectPersistedSetting(page, 'gameCommentaryImageQuality', 0.8)

  await page
    .getByTestId('game-commentary-resize-width-select')
    .selectOption('768')
  await expectPersistedSetting(page, 'gameCommentaryResizeWidth', 768)

  await page.getByTestId('game-commentary-context-count-input').fill('4')
  await expectPersistedSetting(page, 'gameCommentaryContextCount', 4)

  await page
    .getByTestId('game-commentary-prompt-template-input')
    .fill('Describe the current game situation in one short sentence.')
  await expectPersistedSetting(
    page,
    'gameCommentaryPromptTemplate',
    'Describe the current game situation in one short sentence.'
  )

  await page.getByTestId('game-commentary-save-to-chat-toggle').click()
  await expectPersistedSetting(page, 'gameCommentarySaveToChat', false)

  await page.getByTestId('game-commentary-advanced-settings-toggle').click()
  await expect(
    page.getByTestId('game-commentary-background-analysis-toggle')
  ).toBeVisible()

  await page.getByTestId('game-commentary-background-analysis-toggle').click()
  await expectPersistedSetting(
    page,
    'gameCommentaryBackgroundAnalysisEnabled',
    true
  )

  await page
    .getByTestId('game-commentary-background-prompt-template-input')
    .fill('Summarize background changes.')
  await expectPersistedSetting(
    page,
    'gameCommentaryBackgroundAnalysisPromptTemplate',
    'Summarize background changes.'
  )

  await setControlValue(page, 'game-commentary-background-interval-input', '4')
  await expectPersistedSetting(
    page,
    'gameCommentaryBackgroundAnalysisInterval',
    4
  )

  await closeSettings(page)

  await expect(
    page.getByTestId('game-commentary-play-toggle-button')
  ).toBeVisible()
  await page.getByTestId('game-commentary-play-toggle-button').click()
  await expect(
    page.getByTestId('game-commentary-play-toggle-button')
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('game-commentary-indicator')).toBeVisible()

  await page.getByTestId('game-commentary-play-toggle-button').click()
  await expect(
    page.getByTestId('game-commentary-play-toggle-button')
  ).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByTestId('game-commentary-indicator')).toBeHidden()
})
