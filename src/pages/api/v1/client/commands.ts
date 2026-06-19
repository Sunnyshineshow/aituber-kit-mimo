import type { NextApiRequest, NextApiResponse } from 'next'
import { dequeueCommands } from '@/features/api/messageGateway'
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
      .json(createRestrictedModeErrorResponse('v1/client/commands'))
  }

  if (req.method !== 'GET') {
    return sendMethodNotAllowed(res)
  }

  const clientId = getClientIdFromRequest(req)
  if (!clientId) {
    return res.status(400).json({ error: 'Client ID is required' })
  }

  return res.status(200).json({ commands: dequeueCommands(clientId) })
}

export default handler
