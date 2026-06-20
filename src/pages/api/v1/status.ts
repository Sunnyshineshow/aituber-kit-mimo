import type { NextApiRequest, NextApiResponse } from 'next'
import {
  getClientQueueSummary,
  getClientStatus,
} from '@/features/api/messageGateway'
import {
  getClientIdFromRequest,
  requireApiKey,
  sendMethodNotAllowed,
} from '@/features/api/http'
import {
  isRestrictedMode,
  createRestrictedModeErrorResponse,
} from '@/utils/restrictedMode'

const handler = (req: NextApiRequest, res: NextApiResponse) => {
  if (isRestrictedMode()) {
    return res.status(403).json(createRestrictedModeErrorResponse('v1/status'))
  }

  if (req.method !== 'GET') {
    return sendMethodNotAllowed(res)
  }

  if (!requireApiKey(req, res)) return

  const clientId = getClientIdFromRequest(req)
  if (!clientId) {
    return res.status(400).json({ error: 'Client ID is required' })
  }

  return res.status(200).json({
    ok: true,
    clientId,
    status: getClientStatus(clientId),
    queue: getClientQueueSummary(clientId),
  })
}

export default handler
