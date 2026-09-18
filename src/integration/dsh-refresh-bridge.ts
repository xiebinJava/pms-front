import { resolveParentOrigin } from './dsh-auth-bridge'

export const DSH_REFRESH_MESSAGE_SOURCE = 'dsh'
export const DSH_REFRESH_REQUEST_MESSAGE = 'pms.refresh.request'
export const DSH_REFRESH_MESSAGE_VERSION = 1

interface DshRefreshRequest {
  readonly source: typeof DSH_REFRESH_MESSAGE_SOURCE
  readonly type: typeof DSH_REFRESH_REQUEST_MESSAGE
  readonly version: typeof DSH_REFRESH_MESSAGE_VERSION
  readonly requestId: string
  readonly scopes: string[]
}

/** Reload the current PMS route after a confirmed, successful DSH write. */
export function installDshRefreshBridge(): () => void {
  const win = window
  const parentOrigin = resolveParentOrigin(document.referrer)
  if (!parentOrigin || win.parent === win) return () => undefined

  const handledRequestIds = new Set<string>()
  let refreshTimer: number | undefined
  const onMessage = (event: MessageEvent<unknown>): void => {
    if (event.source !== win.parent || event.origin !== parentOrigin) return
    const request = parseDshRefreshRequest(event.data)
    if (request === undefined || handledRequestIds.has(request.requestId)) return
    handledRequestIds.add(request.requestId)
    if (handledRequestIds.size > 32) {
      const oldest = handledRequestIds.values().next().value
      if (typeof oldest === 'string') handledRequestIds.delete(oldest)
    }
    if (refreshTimer !== undefined) window.clearTimeout(refreshTimer)
    // The write response has already reached DSH. A short debounce coalesces
    // adjacent writes while preserving the current PMS URL and route.
    refreshTimer = window.setTimeout(() => {
      refreshTimer = undefined
      win.location.reload()
    }, 120)
  }

  win.addEventListener('message', onMessage)
  return () => {
    win.removeEventListener('message', onMessage)
    if (refreshTimer !== undefined) window.clearTimeout(refreshTimer)
  }
}

function parseDshRefreshRequest(value: unknown): DshRefreshRequest | undefined {
  if (value === null || typeof value !== 'object') return undefined
  const message = value as Partial<DshRefreshRequest>
  if (message.source !== DSH_REFRESH_MESSAGE_SOURCE
    || message.type !== DSH_REFRESH_REQUEST_MESSAGE
    || message.version !== DSH_REFRESH_MESSAGE_VERSION
    || typeof message.requestId !== 'string'
    || message.requestId.length === 0
    || message.requestId.length > 128
    || !Array.isArray(message.scopes)
    || message.scopes.length > 32
    || !message.scopes.every(scope => typeof scope === 'string' && scope.length > 0 && scope.length <= 128)) return undefined
  return {
    source: DSH_REFRESH_MESSAGE_SOURCE,
    type: DSH_REFRESH_REQUEST_MESSAGE,
    version: DSH_REFRESH_MESSAGE_VERSION,
    requestId: message.requestId,
    scopes: [...message.scopes],
  }
}
