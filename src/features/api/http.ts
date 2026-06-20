import type { NextApiRequest, NextApiResponse } from 'next'

export const MAX_IMAGE_CHARS = 10_000_000

export const getApiKey = () => process.env.AITUBERKIT_API_KEY || ''

export const getBearerToken = (req: NextApiRequest): string => {
  const authorization = req.headers.authorization
  if (authorization?.startsWith('Bearer ')) {
    return authorization.slice('Bearer '.length).trim()
  }

  const queryApiKey = req.query.apiKey
  if (typeof queryApiKey === 'string') {
    return queryApiKey
  }

  const headerApiKey = req.headers['x-aituberkit-api-key']
  if (typeof headerApiKey === 'string') {
    return headerApiKey
  }

  return ''
}

export const requireApiKey = (
  req: NextApiRequest,
  res: NextApiResponse
): boolean => {
  const configuredApiKey = getApiKey()

  if (!configuredApiKey) {
    res.status(503).json({
      error: 'AITuberKit API key is not configured',
      code: 'API_KEY_NOT_CONFIGURED',
    })
    return false
  }

  if (getBearerToken(req) !== configuredApiKey) {
    res.status(401).json({
      error: 'Invalid API key',
      code: 'INVALID_API_KEY',
    })
    return false
  }

  return true
}

export const getClientIdFromRequest = (
  req: NextApiRequest,
  bodyClientId?: unknown
): string => {
  const queryClientId = req.query.clientId
  if (typeof bodyClientId === 'string') {
    return bodyClientId.trim()
  }
  if (typeof queryClientId === 'string') {
    return queryClientId.trim()
  }
  return ''
}

export const normalizeMessages = (value: unknown): string[] => {
  if (typeof value === 'string') {
    return value.trim() ? [value] : []
  }

  if (Array.isArray(value)) {
    return value.filter(
      (item): item is string => typeof item === 'string' && item.trim() !== ''
    )
  }

  return []
}

export const normalizeImage = (
  image: unknown
):
  | { ok: true; image?: string }
  | { ok: false; status: number; error: string } => {
  if (image === null || image === undefined || image === '') {
    return { ok: true, image: undefined }
  }

  if (typeof image !== 'string') {
    return { ok: false, status: 400, error: 'Image is not a string' }
  }

  if (image.length > MAX_IMAGE_CHARS) {
    return { ok: false, status: 413, error: 'Image payload is too large' }
  }

  return { ok: true, image }
}

export const sendMethodNotAllowed = (res: NextApiResponse) =>
  res.status(405).json({ error: 'Method not allowed' })
