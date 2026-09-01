export type RequestErrorKind = 'business' | 'timeout' | 'unreachable' | 'server' | 'unknown'

type RequestErrorLike = {
  response?: { status?: number; data?: { msg?: string } }
  code?: string
  message?: string
}

export function requestErrorKind(error: unknown): RequestErrorKind {
  const err = (error || {}) as RequestErrorLike
  if (err.response?.data?.msg) return 'business'
  const status = err.response?.status
  if (status === 502 || status === 503 || status === 504) return 'unreachable'
  if (!err.response) {
    const code = err.code || ''
    const msg = (err.message || '').toLowerCase()
    if (code === 'ECONNABORTED' || msg.includes('timeout')) return 'timeout'
    return 'unreachable'
  }
  if (status != null && status >= 500) return 'server'
  return 'unknown'
}

export function requestErrorMessage(error: unknown, labels: {
  timeout: string
  unreachable: string
  server: string
  fallback: string
}): string {
  const kind = requestErrorKind(error)
  const err = (error || {}) as RequestErrorLike
  if (kind === 'business' && err.response?.data?.msg) return err.response.data.msg
  if (kind === 'timeout') return labels.timeout
  if (kind === 'unreachable') return labels.unreachable
  if (kind === 'server') return labels.server
  return labels.fallback
}
