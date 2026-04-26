import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import {
  expectPersistedSetting,
  expectPersistedSlideSetting,
  gotoHome,
  openSettings,
  openSettingsTab,
  prepareApp,
} from './helpers/app'

const slideHtml = `
  <div class="marpit">
    <svg viewBox="0 0 1280 720"><foreignObject><section><h1>First E2E slide</h1></section></foreignObject></svg>
    <svg viewBox="0 0 1280 720"><foreignObject><section><h1>Second E2E slide</h1></section></foreignObject></svg>
  </div>
`

async function clickElementByTestId(page: Page, testId: string) {
  await page.getByTestId(testId).evaluate((element) => {
    ;(element as HTMLElement).click()
  })
}

test.beforeEach(async ({ page }) => {
  await prepareApp(page, {
    network: {
      blockExternal: true,
      mockUnhandledApi: true,
      apiMocks: {
        '/api/getSlideFolders': { json: ['demo'] },
        '/api/convertMarkdown': {
          json: {
            html: slideHtml,
            css: '',
          },
        },
        '/slides/demo/slides.md': {
          contentType: 'text/markdown; charset=utf-8',
          body: '# First E2E slide\n\n---\n\n# Second E2E slide\n',
        },
      },
    },
    settings: {
      slideMode: false,
      youtubeMode: false,
      gameCommentaryEnabled: false,
      selectAIService: 'openai',
      selectAIModel: 'gpt-4o',
      enableMultiModal: true,
    },
    slide: {
      selectedSlideDocs: '',
    },
  })
})

test('can enable slide mode, persist the selected deck, and navigate rendered slides', async ({
  page,
}) => {
  await gotoHome(page)
  await openSettings(page)
  await openSettingsTab(page, 'slide')

  await expect(
    page.getByRole('heading', { name: 'Slide Settings' })
  ).toBeVisible()
  await expect(page.getByTestId('slide-folder-select')).toHaveValue('')

  await page.getByTestId('slide-folder-select').selectOption('demo')
  await expectPersistedSlideSetting(page, 'selectedSlideDocs', 'demo')

  await clickElementByTestId(page, 'slide-mode-toggle')
  await expectPersistedSetting(page, 'slideMode', true)

  await expect(page.getByTestId('slide-mode-viewer')).toBeVisible()
  await expect(page.getByTestId('slide-marpit-container')).toContainText(
    'First E2E slide'
  )
  await expect(page.getByTestId('slide-controls')).toHaveAttribute(
    'data-slide-count',
    '2'
  )
  await expect(page.getByTestId('slide-controls')).toHaveAttribute(
    'data-current-slide',
    '0'
  )
  await expect(page.getByTestId('slide-prev-button')).toBeDisabled()
  await expect(page.getByTestId('slide-next-button')).toBeEnabled()

  await clickElementByTestId(page, 'slide-next-button')
  await expect(page.getByTestId('slide-controls')).toHaveAttribute(
    'data-current-slide',
    '1'
  )
  await expect(page.getByTestId('slide-prev-button')).toBeEnabled()
  await expect(page.getByTestId('slide-next-button')).toBeDisabled()

  await clickElementByTestId(page, 'slide-prev-button')
  await expect(page.getByTestId('slide-controls')).toHaveAttribute(
    'data-current-slide',
    '0'
  )

  await clickElementByTestId(page, 'slide-visibility-toggle-button')
  await expect(page.getByTestId('slide-mode-viewer')).toBeHidden()
  await clickElementByTestId(page, 'slide-visibility-toggle-button')
  await expect(page.getByTestId('slide-mode-viewer')).toBeVisible()

  await clickElementByTestId(page, 'slide-mode-toggle')
  await expectPersistedSetting(page, 'slideMode', false)
  await expect(page.getByTestId('slide-mode-viewer')).toBeHidden()
})
