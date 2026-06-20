import type { NextApiRequest, NextApiResponse } from 'next'
import { updateClientStatus } from '@/features/api/messageGateway'
import {
  getClientIdFromRequest,
  sendMethodNotAllowed,
} from '@/features/api/http'
import {
  isRestrictedMode,
  createRestrictedModeErrorResponse,
} from '@/utils/restrictedMode'

const handler = (req: NextApiRequest, res: NextApiResponse) => {
  if (isRestrictedMode()) {
    return res
      .status(403)
      .json(createRestrictedModeErrorResponse('v1/client/status'))
  }

  if (req.method !== 'POST') {
    return sendMethodNotAllowed(res)
  }

  const clientId = getClientIdFromRequest(req, req.body?.clientId)
  if (!clientId) {
    return res.status(400).json({ error: 'Client ID is required' })
  }

  const status = updateClientStatus(clientId, {
    connected: req.body?.connected === true,
    isSpeaking: req.body?.isSpeaking === true,
    chatProcessing: req.body?.chatProcessing === true,
    messageReceiverEnabled: req.body?.messageReceiverEnabled === true,
    modelType:
      typeof req.body?.modelType === 'string' ? req.body.modelType : undefined,
    aiService:
      typeof req.body?.aiService === 'string' ? req.body.aiService : undefined,
    voiceEngine:
      typeof req.body?.voiceEngine === 'string'
        ? req.body.voiceEngine
        : undefined,
    externalLinkageMode: req.body?.externalLinkageMode === true,
  })

  return res.status(200).json({ ok: true, status })
}

export default handler
