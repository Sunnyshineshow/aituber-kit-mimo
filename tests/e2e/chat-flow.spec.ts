import { test, expect } from '@playwright/test'
import { gotoHome, prepareApp } from './helpers/app'
import {
  getMultimodalImagePart,
  getMultimodalTextPart,
  mockChatFlowApis,
  pasteImageIntoChatInput,
  readHomeChatLog,
} from './helpers/chat'

test.beforeEach(async ({ page }) => {
  await prepareApp(page)
})

test('sends a user message and renders the mocked assistant response', async ({
  page,
}) => {
  const userMessage = 'Please answer from the E2E test.'
  const assistantReply = 'This is a mocked assistant response from Playwright.'
  const apiMocks = await mockChatFlowApis(page, { reply: assistantReply })

  await gotoHome(page)
  await page.getByRole('button', { name: /Conversation Log/ }).click()

  const messageInput = page.getByTestId('chat-message-input')
  const sendButton = page.getByTestId('chat-send-button')
  await expect(messageInput).toBeVisible()
  await expect(sendButton).toBeDisabled()

  await messageInput.fill(userMessage)
  await expect(sendButton).toBeEnabled()
  await sendButton.click()

  await expect(
    page.getByTestId('chat-message-user').filter({ hasText: userMessage })
  ).toBeVisible()
  await expect(
    page
      .getByTestId('chat-message-assistant')
      .filter({ hasText: assistantReply })
  ).toBeVisible()

  await expect.poll(() => apiMocks.aiRequests.length).toBe(1)
  expect(apiMocks.aiRequests[0]).toEqual(
    expect.objectContaining({
      stream: true,
      aiService: 'openai',
      model: 'gpt-4o',
    })
  )
  expect(apiMocks.aiRequests[0].messages?.[0]).toEqual(
    expect.objectContaining({
      role: 'system',
    })
  )
  expect(apiMocks.aiRequests[0].messages?.at(-1)).toEqual(
    expect.objectContaining({
      role: 'user',
      content: userMessage,
    })
  )
  expect(apiMocks.externalRequests).toEqual([])

  await expect
    .poll(() => readHomeChatLog(page))
    .toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'user',
          content: userMessage,
        }),
        expect.objectContaining({
          role: 'assistant',
          content: assistantReply,
        }),
      ])
    )
})

test('sends pasted image attachment as multimodal text and image content', async ({
  page,
}) => {
  const userMessage = 'Please describe the attached E2E image.'
  const assistantReply = 'The mocked image looks ready for E2E.'
  const apiMocks = await mockChatFlowApis(page, { reply: assistantReply })

  await gotoHome(page)
  await page.getByRole('button', { name: /Conversation Log/ }).click()

  const messageInput = page.getByTestId('chat-message-input')
  const sendButton = page.getByTestId('chat-send-button')
  await expect(messageInput).toBeVisible()

  await pasteImageIntoChatInput(page)

  await messageInput.fill(userMessage)
  await expect(sendButton).toBeEnabled()
  await sendButton.click()

  await expect(page.getByAltText('Pasted image')).toBeHidden()
  await expect(
    page.getByTestId('chat-message-user').filter({ hasText: userMessage })
  ).toBeVisible()
  await expect(
    page
      .getByTestId('chat-message-assistant')
      .filter({ hasText: assistantReply })
  ).toBeVisible()

  await expect.poll(() => apiMocks.aiRequests.length).toBe(1)

  const lastMessage = apiMocks.aiRequests[0].messages?.at(-1)
  expect(lastMessage).toEqual(
    expect.objectContaining({
      role: 'user',
    })
  )
  expect(getMultimodalTextPart(lastMessage?.content)).toEqual({
    type: 'text',
    text: userMessage,
  })
  expect(getMultimodalImagePart(lastMessage?.content)).toEqual({
    type: 'image',
    image: expect.stringMatching(/^data:image\/png;base64,/),
  })
  expect(apiMocks.aiRequests[0]).toEqual(
    expect.objectContaining({
      stream: true,
      aiService: 'openai',
      model: 'gpt-4o',
    })
  )

  await expect
    .poll(() => apiMocks.saveChatLogRequests.length)
    .toBeGreaterThan(0)
  expect(apiMocks.externalRequests).toEqual([])
})
