import type { NextApiRequest, NextApiResponse } from 'next'
import {
  enqueueMessages,
  enqueueStopCommand,
  MessageType,
} from '@/features/api/messageGateway'
import {
  getClientIdFromRequest,
  normalizeImage,
  normalizeMessages,
  requireApiKey,
  sendMethodNotAllowed,
} from '@/features/api/http'
import {
  isRestrictedMode,
  createRestrictedModeErrorResponse,
} from '@/utils/restrictedMode'

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
}

const normalizeChatMode = (mode: unknown): MessageType => {
  if (mode === 'ai_generate') return 'ai_generate'
  return 'user_input'
}

const handler = (req: NextApiRequest, res: NextApiResponse) => {
  if (isRestrictedMode()) {
    return res.status(403).json(createRestrictedModeErrorResponse('v1/chat'))
  }

  if (req.method !== 'POST') {
    return sendMethodNotAllowed(res)
  }

  if (!requireApiKey(req, res)) return

  const clientId = getClientIdFromRequest(req, req.body?.clientId)
  if (!clientId) {
    return res.status(400).json({ error: 'Client ID is required' })
  }

  const messages = normalizeMessages(req.body?.messages ?? req.body?.text)
  if (messages.length === 0) {
    return res.status(400).json({ error: 'Text or messages are required' })
  }

  const imageResult = normalizeImage(req.body?.image)
  if (!imageResult.ok) {
    return res.status(imageResult.status).json({ error: imageResult.error })
  }

  const mode = normalizeChatMode(req.body?.mode)
  const useCurrentSystemPrompt =
    typeof req.body?.useCurrentSystemPrompt === 'boolean'
      ? req.body.useCurrentSystemPrompt
      : true

  if (
    req.body?.systemPrompt !== undefined &&
    typeof req.body.systemPrompt !== 'string'
  ) {
    return res.status(400).json({ error: 'System prompt is not a string' })
  }

  const interrupt = req.body?.interrupt === true
  if (interrupt) {
    enqueueStopCommand(clientId, 'all', 'interrupt_before_chat')
  }

  const queuedMessages = enqueueMessages({
    clientId,
    messages,
    type: mode,
    systemPrompt:
      mode === 'ai_generate' && !useCurrentSystemPrompt
        ? req.body?.systemPrompt
        : undefined,
    useCurrentSystemPrompt:
      mode === 'ai_generate' ? useCurrentSystemPrompt : undefined,
    image: imageResult.image,
    priority: req.body?.priority === 'high' ? 'high' : 'normal',
    interrupt,
    source: 'v1',
  })

  return res.status(202).json({
    ok: true,
    clientId,
    mode,
    queued: queuedMessages.map((message) => message.id),
    count: queuedMessages.length,
  })
}

export default handler
