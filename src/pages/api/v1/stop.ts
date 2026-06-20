import type { NextApiRequest, NextApiResponse } from 'next'
import { ApiStopMode, enqueueStopCommand } from '@/features/api/messageGateway'
import {
  getClientIdFromRequest,
  requireApiKey,
  sendMethodNotAllowed,
} from '@/features/api/http'
import {
  isRestrictedMode,
  createRestrictedModeErrorResponse,
} from '@/utils/restrictedMode'

const normalizeStopMode = (mode: unknown): ApiStopMode => {
  if (mode === 'speech' || mode === 'queue' || mode === 'all') return mode
  return 'all'
}

const handler = (req: NextApiRequest, res: NextApiResponse) => {
  if (isRestrictedMode()) {
    return res.status(403).json(createRestrictedModeErrorResponse('v1/stop'))
  }

  if (req.method !== 'POST') {
    return sendMethodNotAllowed(res)
  }

  if (!requireApiKey(req, res)) return

  const clientId = getClientIdFromRequest(req, req.body?.clientId)
  if (!clientId) {
    return res.status(400).json({ error: 'Client ID is required' })
  }

  const command = enqueueStopCommand(
    clientId,
    normalizeStopMode(req.body?.mode),
    typeof req.body?.reason === 'string' ? req.body.reason : undefined
  )

  return res.status(202).json({
    ok: true,
    clientId,
    commandId: command.id,
    mode: command.mode,
  })
}

export default handler
