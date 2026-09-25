export const PMS_REFRESH_MESSAGE_SOURCE = 'dsh'
export const PMS_REFRESH_REQUEST_MESSAGE = 'pms.refresh.request'
export const PMS_REFRESH_MESSAGE_VERSION = 1

export interface PmsRefreshRequest {
  requestId: string
  scopes: string[]
}

export function parsePmsRefreshRequest(value: unknown): PmsRefreshRequest | undefined {
  if (value === null || typeof value !== 'object') return undefined
  const message = value as Record<string, unknown>
  if (message.source !== PMS_REFRESH_MESSAGE_SOURCE
    || message.type !== PMS_REFRESH_REQUEST_MESSAGE
    || message.version !== PMS_REFRESH_MESSAGE_VERSION
    || typeof message.requestId !== 'string'
    || message.requestId.length === 0
    || message.requestId.length > 128
    || !Array.isArray(message.scopes)
    || message.scopes.length > 32) return undefined
  if (!message.scopes.every((scope) => typeof scope === 'string' && scope.length > 0 && scope.length <= 128)) {
    return undefined
  }
  return { requestId: message.requestId, scopes: [...message.scopes] as string[] }
}

export function shouldReloadForRefresh(scopes: readonly string[]): boolean {
  if (scopes.length === 0) return true
  return scopes.some((scope) =>
    scope === 'current-page'
    || scope === 'project-list'
    || scope === 'project-detail'
    || scope === 'project-dashboard')
}
