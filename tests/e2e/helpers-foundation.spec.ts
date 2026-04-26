import { expect, test } from '@playwright/test'
import {
  collectPageDiagnostics,
  expectNoPageErrors,
  expectPersistedSetting,
  gotoHome,
  openSettings,
  openSettingsTab,
  prepareApp,
  readPersistedSetting,
  setControlValue,
} from './helpers/app'

test('foundation helpers seed storage, operate settings, collect diagnostics, and mock network', async ({
  page,
}) => {
  const diagnostics = collectPageDiagnostics(page)

  try {
    await prepareApp(page, {
      settings: {
        youtubeMode: true,
        youtubeApiKey: 'seeded-api-key',
      },
      network: {
        mockUnhandledApi: true,
        apiMocks: {
          '/api/e2e-foundation-probe': {
            json: { ok: true, source: 'mocked-api' },
          },
          '/api/e2e-foundation-text-probe': {
            contentType: 'text/plain; charset=utf-8',
            body: 'plain mocked body',
          },
        },
      },
    })

    await gotoHome(page)
    await expect(await readPersistedSetting(page, 'youtubeMode')).toBe(true)
    await expectPersistedSetting(page, 'youtubeApiKey', 'seeded-api-key')

    await openSettings(page)
    await openSettingsTab(page, 'youtube')
    await setControlValue(page, 'youtube-comment-interval-input', '12')
    await expectPersistedSetting(page, 'youtubeCommentInterval', 12)

    await page.evaluate(() => {
      console.warn('e2e-foundation-diagnostic-warning')
    })
    await expect
      .poll(() =>
        diagnostics.console.some((entry) =>
          entry.text.includes('e2e-foundation-diagnostic-warning')
        )
      )
      .toBe(true)

    const probe = await page.evaluate(async () => {
      const internalResponse = await fetch('/api/e2e-foundation-probe')
      const textResponse = await fetch('/api/e2e-foundation-text-probe')
      const unhandledResponse = await fetch('/api/e2e-unhandled-probe')
      const externalResponse = await fetch('https://e2e.invalid/probe')

      return {
        internal: {
          contentType: internalResponse.headers.get('content-type'),
          body: await internalResponse.json(),
        },
        text: {
          contentType: textResponse.headers.get('content-type'),
          body: await textResponse.text(),
        },
        unhandled: {
          status: unhandledResponse.status,
          body: await unhandledResponse.json(),
        },
        external: {
          contentType: externalResponse.headers.get('content-type'),
          body: await externalResponse.json(),
        },
      }
    })

    expect(probe.internal).toEqual({
      contentType: expect.stringContaining('application/json'),
      body: { ok: true, source: 'mocked-api' },
    })
    expect(probe.text).toEqual({
      contentType: expect.stringContaining('text/plain'),
      body: 'plain mocked body',
    })
    expect(probe.unhandled).toEqual({
      status: 501,
      body: {
        error: 'Unhandled E2E API mock',
        errorCode: 'UnhandledE2EApiMock',
      },
    })
    expect(probe.external).toEqual({
      contentType: expect.stringContaining('application/json'),
      body: { ok: true, blockedByE2E: true },
    })

    await expectNoPageErrors(diagnostics)
  } finally {
    diagnostics.dispose()
  }
})
